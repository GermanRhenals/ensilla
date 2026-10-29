# 05 · Desarrollo

Guía para cambiar el código sin romper reglas de negocio, el aislamiento entre
barberías ni la seguridad.

## Preparación

```bash
npm install
cp .env.example .env      # completar claves
npm run dev
```

Antes de abrir un pull request:

```bash
npm run typecheck
npm run lint
npm run build
```

Si el cambio toca base de datos, además:

```bash
npx supabase db push      # contra el proyecto de desarrollo
npm run smoke:supabase    # contra el proyecto de desarrollo
```

Si el cambio toca recordatorios o el alta autoservicio, desplegar la función y
probar el envío real:

```bash
npx supabase functions deploy send-reminder
npx supabase functions deploy shop-signup
SMOKE_SEND_REMINDER=true npm run smoke:supabase
```

## Estructura mental

- **Página**: compone la pantalla, maneja estado de formulario y navegación.
- **Módulo de datos**: habla con Supabase, devuelve tipos del dominio.
- **Módulo de dominio**: reglas sin acceso directo a la base (agenda, stats,
  fechas, formato).
- **Migración**: reglas que deben cumplirse aunque alguien llame a la API por
  fuera de la aplicación.
- **Barbería (`shop`)**: raíz del tenant. Todo dato operativo cuelga de un
  `shop_id`.

## Reglas para la capa de datos

1. Toda consulta a tablas vive en `src/lib/data/`.
2. Toda función pública se exporta desde `src/lib/data/index.ts`.
3. Las respuestas de Supabase son `unknown`: normalizarlas con `text`,
   `numberValue`, `boolValue`, `nullableText` (`rows.ts`).
4. Mapear `snake_case` a `camelCase` en `mappers.ts`.
5. Convertir errores con `fail(error)`; para errores de negocio conocidos
   (por ejemplo, teléfono duplicado, código `23505`) devolver un mensaje claro.
6. Si la consulta puede superar 1000 filas, usar `selectAllPages` con `order`
   estable.
7. Si se agrega una columna, actualizar el mapper y el tipo en `types.ts`.

### Barbería en la capa de datos

Hay tres formas de resolver una barbería y no son intercambiables:

| Contexto | Función | Origen |
| --- | --- | --- |
| Panel autenticado | `fetchShop()` | RPC `current_shop`, deduce el `shop_id` del perfil |
| Sitio público por enlace | `fetchShopBySlug(slug)` | RPC `get_public_shop`, solo barberías activas y publicadas |
| Buscador de portada | `searchShops(query)` | RPC `search_shops`, mínimo 2 caracteres |
| Alta autoservicio | `requestShopSignup()` / `resendShopSignup()` | Edge Function `shop-signup` |
| Publicación | `setShopPublished(published)` | RPC `set_shop_published` |

Reglas:

- **Nunca** tomar el `shop_id` de un query param para escribir. En el panel se
  deduce del perfil; en el sitio público se envía a las RPC, que vuelven a
  validar que el servicio y el barbero pertenezcan a esa barbería.
- Las consultas a tablas del tenant dentro del panel **no** necesitan filtrar
  por `shop_id`: RLS ya lo hace con `current_shop_id()`. Agregar el filtro es
  opcional para legibilidad, no un mecanismo de seguridad.
- El sitio público **sí** debe filtrar por `shop_id` al leer `services`,
  `barbers_public` y `business_hours`: `anon` puede ver datos públicos de
  cualquier barbería activa y publicada.
- `FALLBACK_SHOP` tiene `id` vacío a propósito. Si una vista va a escribir, debe
  esperar a que la barbería real esté cargada.

Ejemplo de función nueva:

```ts
export async function fetchSomething(id: string) {
  const { data, error } = await supabase
    .from("tabla")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) fail(error);
  return data ? mapSomething(data) : null;
}
```

## Reglas para las vistas

- Usar `useAsync` y renderizar `error` con `<Flash>`. No dejar un spinner
  eterno cuando la consulta falla.
- Las páginas que leen `useSearchParams` van dentro de `<Suspense>`.
- Los formularios muestran el error de negocio y limpian el mensaje anterior.
- Después de una mutación exitosa, llamar `reload()` o navegar.
- No calcular disponibilidad ni precios en el navegador: pedirlos a la RPC.
- No leer `clients` desde el sitio público: no hay política para `anon`.
- El correo del cliente solo se muestra como `hasEmail`. No agregarlo a
  payloads públicos, logs ni analítica.

## Flujo público

```text
/                          Portada con buscador por nombre
/registro                  Alta autoservicio de barbería
/confirmar/                Activación de la cuenta desde el correo
/reservar?barberia=<slug>  Servicio → barbero → día → hora → datos
/reservar/confirmacion?id=<uuid>
```

- Sin `?barberia=`, `/reservar` muestra el buscador en lugar de un error.
- Un slug inexistente, una barbería inactiva o una no publicada se tratan igual:
  no se revela si existió.
- `/registro` crea la barbería oculta y el perfil pendiente. La cuenta no puede
  entrar hasta abrir el enlace de `/confirmar/`.
- `/confirmar/` procesa los tokens a mano y llama a `confirm_shop_signup`; no
  agregar `detectSessionInUrl` sin quitar ese procesamiento.
- La confirmación usa el UUID como credencial. No listar reservas ni permitir
  cambios de horario desde ese enlace.
- El correo se agrega después de confirmar con `set_booking_email`. El botón
  "Enviar recordatorio" llama a la Edge Function `send-reminder`.
- "Cerrar" vuelve a la portada; el enlace de la barbería queda en el pie para
  reservar de nuevo.

## Autenticación, alta y recuperación

- `/login` inicia sesión; `/recuperar` pide el enlace por correo y
  `/restablecer` define la contraseña nueva. El alta de barberías usa
  `/registro` y `/confirmar`.
- El cliente de Supabase tiene `detectSessionInUrl: false`: `/restablecer` y
  `/confirmar` procesan los tokens del hash o el código PKCE, limpian la URL y
  recién entonces llaman a `updateUser` o a `confirm_shop_signup`.
- Las URLs de retorno se arman con `recoveryRedirectUrl()` y el `basePath`, y
  deben estar registradas en Authentication > URL Configuration como
  `.../restablecer/` y `.../confirmar/`.
- No revelar si el correo existe: `resetPasswordForEmail` y el reenvío de
  `shop-signup` responden igual en ambos casos. Tras guardar la contraseña se
  cierra la sesión de recuperación.

## Reglas para SQL

1. Migración nueva por cada cambio. Nunca editar una aplicada.
2. Nombrar el archivo con fecha: `YYYYMMDDHHMMSS_descripcion.sql`.
3. Empezar con un comentario que explique el **porqué** y los efectos.
4. Toda función `security definer` debe fijar `search_path` y validar el rol
   dentro de la función si corresponde.
5. Cada tabla nueva necesita `enable row level security` y políticas explícitas.
6. Cada función nueva necesita revisar sus `grant execute`: por defecto
   Postgres concede a `PUBLIC`.
7. Si se agrega una columna sensible, evaluar privilegios por columna.
8. Probar la migración sobre una base con datos, no solo vacía.

### Una tabla nueva del tenant

1. Agregar `shop_id uuid not null default public.current_shop_id() references
   public.shops(id) on delete restrict`.
2. Crear índice por `shop_id` y por las columnas de búsqueda habituales.
3. `enable row level security`.
4. Política de `select` que compare `shop_id = public.current_shop_id()`.
5. Política de escritura solo para `is_staff()` o `is_admin()` según el caso.
6. Si el sitio público debe leerla, agregar una política acotada a
   `is_active_shop(shop_id)` y una proyección con los datos mínimos.
7. Revisar los `grant` de tabla y de columna.

El `default current_shop_id()` permite que el panel inserte sin enviar
`shop_id`; el valor se resuelve en el servidor y no se puede falsificar.

### Una RPC nueva

1. Escribirla como `security definer` con `set search_path = public`.
2. Si es pública, recibir `p_shop_id` y validar que barbería, servicio, barbero y
   turno pertenezcan al mismo tenant.
3. Si es del panel, deducir la barbería con `current_shop_id()` y no aceptarla
   como parámetro.
4. Revocar `execute` de `public`, `anon` y `authenticated`, y otorgarlo solo a
   quien corresponda.
5. Consumirla desde `src/lib/booking.ts`, `src/lib/availability.ts` o un módulo
   de datos.
6. Documentar el contrato en `docs/02-MODELO-DE-DATOS.md`.

## Cómo agregar una funcionalidad

### Un campo nuevo en una tabla existente

1. Crear la migración con `alter table ... add column`.
2. Evaluar si el cliente debe poder escribirlo. Si no, no otorgar el privilegio
   de columna.
3. Actualizar el tipo en `src/lib/types.ts`.
4. Actualizar el mapper correspondiente.
5. Actualizar el formulario y la vista.
6. Verificar con `typecheck`, `lint`, `build`.

### Una pantalla nueva en el panel

1. Crear `src/app/panel/<ruta>/page.tsx`.
2. Si necesita datos, agregar la función en `src/lib/data`.
3. Envolver en `<Suspense>` si usa `useSearchParams`.
4. Usar `Flash` para errores y estados vacíos con `EmptyState`.
5. Agregar el enlace en `src/components/panel/panel-nav.tsx`.
6. Proteger la vista por rol en la interfaz **y** por RLS en la base.
7. No hardcodear la barbería: usar `fetchShop()` y su `id`, `timezone`,
   `currency` y `locale`.

### Una operación con reglas propias

Si la operación no puede expresarse con `insert`/`update` seguros:

1. Escribir una RPC `security definer` en una migración.
2. Validar rol, datos, estado y pertenencia a la barbería dentro de la función.
3. Revocar `execute` de `public`, `anon` y `authenticated`, y otorgarlo solo a
   quien corresponda.
4. Consumirla desde `src/lib/booking.ts`, `src/lib/availability.ts` o un módulo
   de datos.
5. Documentar el contrato en `docs/02-MODELO-DE-DATOS.md`.

## Provisión de barberías

La vía normal en desarrollo es el alta autoservicio en `/registro`; requiere la
Edge Function `shop-signup` desplegada y los secretos del proveedor de correo. La
barbería nace oculta y se publica desde **Panel > Ajustes** cuando tiene
servicio, horario y equipo.

Para crear una barbería ya publicada sin pasar por el correo (por ejemplo, una
demo o una migración asistida):

```bash
npm run db:create-shop -- \
  --slug barberia-del-parque \
  --name "Barbería del Parque" \
  --admin-name "Nombre Apellido" \
  --admin-email admin@barberia.com \
  --admin-password "una-clave-larga"
```

El script:

- Hace upsert por `slug`; si ya existe, exige `--update`.
- Con `--update` solo escribe los campos enviados.
- Crea el horario semanal por defecto si la barbería no tiene ninguno.
- Crea el usuario de Auth con `shop_id` en `user_metadata` y deja su perfil como
  `ADMIN` activo.
- Crea la barbería con `published = true`.

Para probar aislamiento, crear una segunda barbería con otro slug y otro
administrador, y verificar que ninguna sesión vea datos de la otra. El smoke test
hace esta comprobación con una barbería temporal que luego elimina.

## Recordatorios y correo de alta

- La Edge Function `send-reminder` recibe `{ appointmentId }`, lee el correo con
  la clave de servicio y envía.
- La Edge Function `shop-signup` usa el mismo remitente para el enlace de
  confirmación del alta.
- Ambas comparten `_shared/email.ts`: envían por Brevo si existe `BREVO_API_KEY`
  y por Resend si existe `RESEND_API_KEY`.
- Secretos: `BREVO_API_KEY` o `RESEND_API_KEY`, `REMINDER_FROM_EMAIL`, opcional
  `REMINDER_FROM_NAME` y `APP_BASE_URL`. Se configuran con
  `npx supabase secrets set`.
- Brevo no exige dominio propio, pero reescribe el remitente por uno suyo. Con
  Resend el remitente debe pertenecer a un dominio verificado.
- El enfriamiento de 2 minutos vive en la función; no duplicar esa regla en el
  navegador.
- Nunca devolver el correo del cliente, el enlace de confirmación ni las claves
  del proveedor.
- Para desarrollo sin dominio, usar Brevo con un remitente verificado por código
  y un correo propio.

## Comentarios

El proyecto se hereda: los comentarios son parte de la entrega.

- Español, sin emojis.
- Explicar decisiones, invariantes y riesgos; no repetir lo que el código ya
  dice.
- Comentar el encabezado de cada módulo con `RESPONSABILIDAD` y, si aplica,
  `SEGURIDAD` o `IMPORTANTE`.
- En SQL, comentar el bloque completo antes de las sentencias.

Ejemplo:

```ts
/**
 * Normalización de teléfonos del lado del cliente.
 *
 * IMPORTANTE
 * Debe producir el mismo resultado que `public.normalize_phone` en Postgres.
 */
```

## Estilo

- TypeScript estricto, sin `any`.
- Funciones y variables en inglés; textos de interfaz en español.
- Componentes en `PascalCase`, archivos de página en `page.tsx`.
- Evitar dependencias nuevas si el problema se resuelve con la plataforma.
- No agregar `next/font/google` ni iconos de marca en `lucide-react` v1.
- Mantener el orden de imports que usa el repositorio.

## Pruebas manuales mínimas

No hay suite automatizada. Antes de publicar, recorrer:

1. `/` carga y el buscador no devuelve nada con una sola letra.
2. Buscar una barbería por nombre o slug muestra el resultado correcto.
3. `/reservar?barberia=<slug>` permite elegir servicio, barbero, día y horario.
4. La reserva aparece en `/reservar/confirmacion?id=...` con el nombre de la
   barbería y el mensaje "Se ha confirmado tu reserva."
5. Agregar un correo habilita "Enviar recordatorio"; el correo llega a la
   bandeja.
6. "Cerrar" vuelve a la portada.
7. El turno aparece en la agenda del panel de **esa** barbería.
8. Otra barbería no ve el turno, el cliente ni el servicio.
9. El panel permite cambiar estado y notas del turno.
10. Un usuario `BARBER` no ve Ajustes, Equipo ni Servicios.
11. Un usuario desactivado no puede entrar.
12. La búsqueda de clientes encuentra por nombre y por teléfono.
13. "¿La olvidaste?" envía el correo, el enlace abre `/restablecer/` y la
    contraseña nueva permite entrar. Un enlace vencido o reutilizado muestra el
    mensaje de error, nunca el formulario.
14. `/registro` crea la barbería y muestra la vista de correo enviado; el enlace
    abre `/confirmar/` y activa la cuenta.
15. La barbería recién creada no aparece en el buscador ni acepta reservas
    públicas hasta publicarse.
16. El checklist de **Ajustes** impide publicar sin servicio, horario o equipo, y
    publicar habilita la ruta pública.
17. Un segundo registro con el mismo correo es rechazado; el reenvío responde
    igual para correos existentes y desconocidos.

El smoke test cubre el circuito de datos:

```bash
npm run smoke:supabase
```

Incluye búsqueda pública, barbería por slug, disponibilidad, alta pública,
confirmación sin datos internos, correo posterior, alta desde el panel,
aislamiento entre barberías, creación de usuario por Edge Function y bloqueo de
escalada de privilegios. El envío real de correo queda opt-in con
`SMOKE_SEND_REMINDER=true`.

## Errores comunes

| Error | Causa | Solución |
| --- | --- | --- |
| `permission denied for table profiles` | Falta el privilegio de columna | Revisar el `grant` de la migración |
| `new row violates row-level security policy` | Política ausente, perfil inactivo o `shop_id` distinto | Revisar RLS, `current_shop_id()` y el perfil |
| `column ... does not exist` | Migración no aplicada | `npx supabase db push` |
| `JWT expired` | Sesión vencida | Volver a iniciar sesión |
| `useSearchParams() should be wrapped in a suspense boundary` | Falta `<Suspense>` | Envolver la vista |
| El build falla por `window` | Código de navegador en un componente de servidor | Agregar `"use client"` |
| `FunctionsHttpError` al crear usuario | Falta desplegar la Edge Function | `npx supabase functions deploy admin-users` |
| `FunctionsHttpError` en `/registro` | Falta desplegar `shop-signup` o faltan secretos | `npx supabase functions deploy shop-signup` y revisar secretos |
| La búsqueda no devuelve la barbería | Menos de 2 caracteres, barbería inactiva o no publicada | Revisar `shops.active`, `shops.published` y el término |
| No se puede publicar desde Ajustes | Falta servicio, horario o integrante activo | Completar el checklist antes de publicar |
| El perfil queda inactivo tras confirmar | `pending_signup` no coincide o la cuenta no es la que abrió el enlace | Revisar `profiles.pending_signup` y volver a pedir el enlace |
| `send-reminder` responde 500 | Faltan secretos del proveedor o el remitente no está verificado | Configurar secretos y revisar Brevo o Resend |

## Pull requests

1. Rama corta y descriptiva (`fix/agenda-desactivados`).
2. Un cambio por PR, con contexto en la descripción.
3. Verificación escrita: comandos ejecutados y resultado.
4. Si toca SQL, indicar la migración y cómo se probó.
5. Si cambia una regla de negocio, actualizar `docs/` en el mismo PR.
6. No mezclar formateo masivo con cambios funcionales.

## Publicación

El CI valida cada push y PR a `main`. El workflow **Deploy to GitHub Pages** se
dispara con cada push a `main` y también se puede ejecutar a mano. Como publica
el build del navegador, la migración de Supabase va antes del merge. Ver
`docs/04-OPERACION.md`.
