# En-silla

Marketplace de reservas para barberías de barrio. El visitante busca su barbería
por nombre, elige servicio, barbero y horario, confirma y puede dejar su correo
para recibir un recordatorio. Cada barbería administra su agenda, sus clientes y
su equipo desde un panel privado, con los datos aislados de las demás.

El sistema no tiene servidor propio: el frontend es un sitio estático de
Next.js y toda la lógica de negocio vive en Supabase (Postgres + RLS + RPC). Eso
mantiene el costo operativo bajo y el despliegue simple, sin descuidar la
seguridad: **cada regla crítica se valida en la base de datos, no en el
navegador**.

---

## Stack

| Capa | Tecnología |
| --- | --- |
| Interfaz | Next.js 16 (App Router, export estático), React 19, TypeScript estricto |
| Estilos | Tailwind CSS v4 (tokens en `src/app/globals.css`) |
| Datos y autenticación | Supabase (Postgres 17, Auth, RLS, RPC, Edge Functions) |
| Correo | Brevo o Resend, a través de las Edge Functions `shop-signup` y `send-reminder` |
| Despliegue | GitHub Pages (sitio estático) + GitHub Actions |
| Fechas y zonas horarias | `date-fns` + `date-fns-tz` |

Sin servidor Node en producción, sin rutas de API, sin middleware. Las
operaciones sensibles se resuelven con funciones SQL `security definer` y con
Edge Functions que guardan la clave de servicio.

---

## Cómo funciona

```text
/  →  buscás tu barbería por nombre o slug
      ↓
/reservar?barberia=<slug>
      ├─ elegís servicio
      ├─ elegís barbero
      ├─ elegís día y horario disponible
      └─ confirmás con nombre y teléfono (el correo es opcional)
      ↓
/reservar/confirmacion?id=<uuid>
      ├─ "Se ha confirmado tu reserva."
      ├─ agregar correo
      ├─ enviar recordatorio por correo
      └─ cerrar
```

La disponibilidad se calcula en Postgres: el navegador nunca ve turnos de otras
personas. El enlace de confirmación contiene un UUID no adivinable que funciona
como credencial.

El alta de una barbería también es autoservicio:

```text
/registro  →  nombre del local, responsable, correo y contraseña
      ↓
Edge Function shop-signup
      ├─ crea la barbería oculta (published = false)
      ├─ crea la cuenta del dueño inactiva
      └─ envía un enlace de confirmación por correo
      ↓
/confirmar/  →  activa la cuenta
      ↓
/panel/ajustes  →  servicios + horario + equipo → publicar
```

El registro libre de Supabase Auth sigue desactivado: la Edge Function usa la
clave de servicio y el enlace de confirmación viaja por el proveedor de correo.
Una barbería recién creada no aparece en el buscador hasta que el dueño completa
el mínimo operativo y la publica.

---

## Puesta en marcha (15 minutos)

### 1. Requisitos

- Node.js 22 o superior.
- Una cuenta de Supabase y el CLI (`npx supabase`).
- Git.
- Opcional: una cuenta de Brevo o Resend para probar recordatorios reales.

### 2. Instalar dependencias

```bash
git clone <url-del-repositorio>
cd ensilla
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Completar en `.env`:

- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`: claves públicas
  del proyecto (Project Settings > API).
- `SUPABASE_SERVICE_ROLE_KEY`: solo para scripts y Edge Functions. **Nunca**
  debe llevar el prefijo `NEXT_PUBLIC_` ni subirse al repositorio.
- `SUPABASE_DB_PASSWORD`: solo si se aplican migraciones por conexión directa.

Dejar `NEXT_PUBLIC_DEMO_MODE="false"` salvo que se quiera mostrar las cuentas de
demostración en el login.

Los secretos del proveedor de correo no se usan en el build: se configuran en
Supabase. Con `BREVO_API_KEY` el envío sale por Brevo, que no exige dominio
propio y reescribe el remitente por uno suyo; con `RESEND_API_KEY` sale por
Resend, que solo entrega a cualquier destinatario si el dominio está verificado.

### 4. Crear el esquema

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Las migraciones de `supabase/migrations/` son la única fuente de verdad del
esquema. No se editan una vez aplicadas: los cambios se agregan como una
migración nueva. La migración `20261029000000_multi_shop.sql` convierte el
esquema de barbería única en marketplace y conserva los datos existentes;
`20261029120000_shop_signup.sql` agrega el alta autoservicio, la publicación de
barberías y la confirmación de la cuenta del dueño.

> **Correos de Auth:** en **Authentication > URL Configuration** agregar a
> `Redirect URLs` las rutas de retorno del despliegue:
> `http://localhost:3000/restablecer/`,
> `http://localhost:3000/confirmar/`,
> `https://<usuario>.github.io/<repositorio>/restablecer/` y
> `https://<usuario>.github.io/<repositorio>/confirmar/`. Sin esas entradas, los
> enlaces del correo vuelven a la portada. En el proyecto hospedado, activar
> **Confirm email** en Authentication > Sign In / Providers > Email: el alta
> exige que el dueño confirme antes de entrar. Para producción conviene
> configurar SMTP propio en **Authentication > Emails**: el servicio incluido
> tiene límites bajos.

### 5. Desplegar las Edge Functions

```bash
npx supabase functions deploy admin-users
npx supabase functions deploy send-reminder
npx supabase functions deploy shop-signup
```

`admin-users` administra las cuentas del equipo, `send-reminder` envía el correo
del turno y `shop-signup` crea las barberías del alta autoservicio. Para que los
correos funcionen:

```bash
npx supabase secrets set \
  BREVO_API_KEY=xkeysib-... \
  REMINDER_FROM_EMAIL=turnos@tu-dominio.com \
  REMINDER_FROM_NAME="En-silla" \
  APP_BASE_URL=https://<usuario>.github.io/<repositorio>
```

Con Brevo no hace falta dominio: alcanza con verificar el remitente en Brevo y
usar esa misma dirección en `REMINDER_FROM_EMAIL`. Brevo reescribe el remitente
por uno de su dominio para cumplir con SPF y DMARC, así que el "De" no mostrará
el dominio propio. Con Resend, en cambio, el dominio del remitente debe estar
verificado. `APP_BASE_URL` es la URL pública del sitio (con el `basePath` si
corresponde) y se usa para armar el retorno del enlace de confirmación. Si falta,
la función intenta usar el `Origin` de la petición; en producción conviene
fijarla.

### 6. Crear la primera barbería

La vía normal es el alta autoservicio en `/registro`: el dueño crea su cuenta,
confirma el correo y publica la barbería desde el panel. Para provisionar una
barbería desde la operación (por ejemplo, una migración asistida), sigue
disponible el script con la clave de servicio:

```bash
npm run db:create-shop -- \
  --slug mi-barberia \
  --name "Mi Barbería" \
  --admin-name "Nombre Apellido" \
  --admin-email admin@mi-barberia.com \
  --admin-password "una-clave-larga"
```

El script crea la barbería publicada, un horario semanal por defecto y el primer
administrador activo. Imprime la ruta pública
`/reservar?barberia=mi-barberia`. Para modificar una barbería existente, repetir
con `--update` y solo los campos a cambiar.

El alta autoservicio, en cambio, nace con `published = false` y el perfil
inactivo hasta que el dueño abre el enlace del correo. Para publicar se exige al
menos un servicio activo, un día de atención y un integrante activo.

### 7. Cargar datos de demostración (opcional)

```bash
npm run db:seed:supabase
```

Crea la barbería demo `en-silla`, sus servicios, horarios, clientes y turnos, y
tres usuarios:

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | `admin@ensilla.app` | `admin123` |
| Barbero | `bruno@ensilla.app` | `barber123` |
| Barbero | `valentina@ensilla.app` | `barber123` |

El seed es destructivo **solo con la barbería demo**: no toca otras barberías.
Cambiar o eliminar estas cuentas antes de operar con clientes reales.

### 8. Desarrollo

```bash
npm run dev
```

Sitio público: <http://localhost:3000>. Panel: `/login` y luego `/panel`.

### 9. Verificar

```bash
npm run typecheck
npm run lint
npm run build
```

Y, contra un Supabase real:

```bash
npm run smoke:supabase
```

El smoke crea una barbería temporal para comprobar el aislamiento y la elimina
al final. El envío real de correo solo ocurre con `SMOKE_SEND_REMINDER="true"`.

---

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Export estático a `out/` |
| `npm start` | Sirve `out/` localmente para probar el build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir archivos |
| `npm run db:create-shop` | Crea una barbería y su primer administrador |
| `npm run db:seed:supabase` | Carga datos de demostración vía API |
| `npm run smoke:supabase` | Prueba de humo de RPC, permisos y aislamiento |

---

## Estructura

```text
src/
  app/
    (public)/            Portada con buscador, reserva y confirmación
    registro/            Alta autoservicio de barberías
    confirmar/           Activación de la cuenta desde el correo
    login/               Acceso del equipo
    panel/               Panel privado (agenda, citas, clientes, ajustes...)
    error.tsx            Frontera de error global
    not-found.tsx        Página 404
  components/
    public/              Header, footer y buscador de barberías
    booking/             Wizard de reserva
    panel/               Navegación y piezas del panel
  lib/
    data/                Capa de acceso a datos (única puerta a Supabase)
    booking.ts           Alta de turnos vía RPC
    availability.ts      Consulta de horarios disponibles
    agenda.ts            Agenda diaria y resumen
    stats.ts             Métricas del panel
    datetime.ts          Conversión y formato con zona horaria
    phone.ts             Normalización de teléfonos (espejo del SQL)
supabase/
  migrations/            Esquema, RLS, RPC y marketplace multi-barbería
  functions/
    _shared/email.ts      Envío de correos por Brevo o Resend
    admin-users/         Cuentas del equipo, acotadas por barbería
    send-reminder/       Envío de recordatorios
    shop-signup/         Alta autoservicio y confirmación por correo
scripts/                 Provisión, seed y smoke test
docs/                    Documentación de arquitectura y operación
```

---

## Funcionalidades

- **Búsqueda por nombre**: el visitante encuentra su barbería por nombre o slug.
  La RPC exige al menos dos caracteres y solo devuelve barberías activas y
  publicadas.
- **Alta autoservicio**: el dueño crea su barbería en `/registro`, confirma el
  correo y publica cuando tiene servicio, horario y equipo. La barbería queda
  oculta hasta entonces.
- **Reserva pública** en pasos: servicio, barbero, día, horario y datos de
  contacto. La disponibilidad se calcula en Postgres.
- **Confirmación inmediata** con enlace único, resumen del turno, correo
  opcional para el recordatorio, descarga de calendario (`.ics`) y contacto por
  WhatsApp.
- **Recordatorio real por correo** con Brevo o Resend, disponible desde la
  confirmación y desde el detalle de la cita en el panel.
- **Panel multi-barbería** con agenda diaria, alta y edición de citas, ficha de
  clientes con historial e ideas de corte, catálogo de servicios, estadísticas y
  ajustes de la barbería.
- **Aislamiento total**: cada barbería ve solo su equipo, sus clientes, sus
  turnos y sus notificaciones.
- **Roles**: `ADMIN` administra todo; `BARBER` ve su agenda y sus métricas.

---

## Seguridad en una frase

El visitante solo puede leer datos públicos de barberías activas y publicadas, y
reservar a través de funciones validadas; el personal solo ve su propia barbería
por RLS; y los cambios de rol, la activación de cuentas y el envío de correo
pasan por Edge Functions que verifican el rol real contra la base. Ver
[docs/03-SEGURIDAD.md](docs/03-SEGURIDAD.md).

---

## Documentación

| Documento | Contenido |
| --- | --- |
| [docs/01-ARQUITECTURA.md](docs/01-ARQUITECTURA.md) | Capas, flujos y decisiones de diseño |
| [docs/02-MODELO-DE-DATOS.md](docs/02-MODELO-DE-DATOS.md) | Tablas, relaciones, RPC e invariantes |
| [docs/03-SEGURIDAD.md](docs/03-SEGURIDAD.md) | Modelo de amenazas, RLS y checklist |
| [docs/04-OPERACION.md](docs/04-OPERACION.md) | Despliegue, respaldos, rutinas y traspaso |
| [docs/05-DESARROLLO.md](docs/05-DESARROLLO.md) | Convenciones y guía para cambiar el código |
| [AGENTS.md](AGENTS.md) | Notas para asistentes de código |

---

## Contexto del producto

En-silla nació como una barbería de barrio que necesitaba recordar a cada
cliente: qué corte prefiere, qué producto usa, qué conversación quedó pendiente.
El software conserva esa memoria por barbería y evita que la operación dependa
de una sola persona. Por eso la documentación y las migraciones son parte del
producto, no un extra.

Los valores por defecto (Bogotá, COP, español de Colombia) se pueden cambiar por
barbería desde **Panel > Ajustes** sin tocar código.
