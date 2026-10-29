# 03 · Seguridad

## Principio rector

El navegador es hostil por definición. Cualquier persona puede abrir las
herramientas de desarrollo, leer el JavaScript, cambiar el estado de React o
llamar a la API de Supabase con la clave pública. Por eso:

1. **RLS** decide qué filas puede ver cada sesión.
2. Los **privilegios por columna** deciden qué campos puede escribir.
3. Las **RPC** encapsulan las operaciones que no deben hacerse con un `insert`
   directo.
4. Las **Edge Functions** son la única vía para cambios de rol, credenciales y
   envío de correo.

Si una regla solo existe en el frontend, no es una regla de seguridad: es una
sugerencia de interfaz.

## Aislamiento por barbería

- `shops` es la raíz del tenant y `profiles.shop_id` define a qué barbería
  pertenece cada usuario.
- Todas las tablas operativas tienen `shop_id` y políticas que lo comparan con
  `current_shop_id()`.
- `current_shop_id()` es `security definer` y solo devuelve el `shop_id` de un
  perfil activo. Un usuario desactivado no obtiene barbería y, por lo tanto, no
  pasa ninguna política.
- `is_active_shop(uuid)` permite que el sitio público lea solo barberías
  activas y publicadas sin exponer la tabla completa. `anon` no tiene `select`
  sobre `shops`: las únicas vías públicas son `search_shops` y
  `get_public_shop`.
- Una barbería en borrador (`published = false`) sigue accesible para su equipo,
  pero no para el sitio público ni para reservas nuevas.
- Las RPC de negocio validan que servicio, barbero, cliente y turno pertenezcan
  a la misma barbería. No alcanza con que el navegador envíe un `shop_id`.

## Modelo de amenazas

| Amenaza | Mitigación |
| --- | --- |
| Visitante intenta leer clientes o turnos | RLS: `anon` no tiene políticas sobre `clients` ni `appointments` |
| Usuario de una barbería intenta leer otra | RLS compara `shop_id` con `current_shop_id()` en todas las tablas del tenant |
| Usuario autenticado se asciende a administrador | `update` de `profiles` limitado a `name, phone, bio, color`; `role`, `active` y `shop_id` fuera del alcance |
| Barbero intenta ver turnos de otro barbero | Política de `appointments` y consultas del panel filtran por usuario; la escritura se limita al propio turno salvo `ADMIN` |
| Cliente borra su historial al borrar un cliente | `on delete restrict` en `appointments` y `haircut_ideas`; borrado solo `ADMIN` y de su barbería |
| Se insertan turnos falsos o con precios manipulados | `insert` revocado; altas solo por RPC con precio tomado del catálogo |
| Se modifican horarios o precios de un turno | `update` limitado a `status`, `notes`, `reminder_sent_at` |
| Se crea una barbería desde el navegador | Sin política de `insert` en `shops`; el alta pasa por la Edge Function `shop-signup` y `create_shop_signup` con la clave de servicio |
| Se enumera el directorio de barberías | `anon` no puede leer `shops`; `search_shops` exige 2 caracteres, devuelve 12 como máximo y solo barberías activas y publicadas |
| Se publica una barbería vacía o incompleta | `set_shop_published` exige servicio, horario y equipo activos; `published` no se escribe por `update` |
| Se salta la confirmación del correo | El perfil nace `active = false` y `pending_signup = true`; `handle_user_confirmed` lo activa solo con el correo confirmado |
| Se activa una cuenta ajena desde `/confirmar` | `confirm_shop_signup` usa `auth.uid()` y solo activa el perfil pendiente propio |
| Spam de altas | Rate limit por correo e IP en `shop_signup_attempts`; un correo = una cuenta |
| Se inyecta SQL o filtros mal formados | Consultas parametrizadas de PostgREST; la búsqueda quita `%` y `_` antes de armar el patrón |
| Spam de reservas públicas | Máximo 3 reservas públicas por teléfono y barbería por hora |
| Se sobrescribe el nombre de un cliente existente | El `upsert` público conserva el nombre guardado |
| Se leen datos internos desde la confirmación | RPC devuelve nombre y teléfono del cliente, servicio, barbero, barbería y `has_email`; nunca el correo |
| Se usa el recordatorio como spam masivo | UUID como credencial, solo turnos pendientes o confirmados, enfriamiento de 2 minutos y destinatario único |
| Cuenta inactiva sigue entrando | `AuthProvider` cierra la sesión; RLS exige perfil activo vía `current_shop_id()` |
| Autoregistro crea un empleado | `handle_new_user` crea el perfil con `active = false` y sin fallback de barbería; el registro público de Supabase debe seguir cerrado |
| Escalada por la Edge Function | Verifica JWT, perfil `ADMIN` activo, mismo `shop_id`, última cuenta admin de la barbería y valida todos los campos |
| Fuga de la clave de servicio o de Resend | Solo viven en el entorno de Supabase y en el `.env` local; nunca en `NEXT_PUBLIC_*` |

## Matriz de acceso

### Tablas

| Tabla | `anon` | `authenticated` | Notas |
| --- | --- | --- | --- |
| `shops` | sin acceso (select revocado) | lectura de la propia | Escritura solo `ADMIN` de la propia barbería; el slug, `active` y `published` no se editan desde el panel |
| `business_hours` | lectura de barberías activas y publicadas | lectura del personal propio | Escritura solo `ADMIN` |
| `services` | lectura de activos | lectura del personal propio | Escritura solo `ADMIN` |
| `profiles` | sin acceso | lectura si es personal de la barbería | Edición propia limitada; `role`, `active`, `shop_id` y `pending_signup` por Edge Function o confirmación |
| `clients` | sin acceso | lectura/alta/edición del personal propio | Borrado solo `ADMIN` |
| `appointments` | sin acceso | lectura del personal propio | Alta por RPC; sin `insert` ni `delete` directo |
| `haircut_ideas` | sin acceso | lectura/escritura del personal propio | FK restrict a cliente |
| `time_off` | sin acceso | lectura del personal propio | Escritura propia o `ADMIN` |
| `notifications` | sin acceso | lectura y marcado propio | Sin `insert` |
| `shop_signup_attempts` | sin acceso | sin acceso | Solo la usa la Edge Function `shop-signup` con la clave de servicio |
| `barbers_public` (vista) | lectura | lectura | Solo datos públicos del equipo, filtrado por `shop_id` |

### Columnas escribibles por el cliente

| Tabla | Columnas permitidas |
| --- | --- |
| `profiles` | `name`, `phone`, `bio`, `color` |
| `appointments` | `status`, `notes`, `reminder_sent_at` |
| `clients` | todas (RLS restringe al personal de la barbería) |
| `services` | todas (RLS restringe a `ADMIN`) |
| `business_hours` | todas (RLS restringe a `ADMIN`) |
| `haircut_ideas` | todas (RLS restringe al personal) |
| `notifications` | `read_at` |
| `shops` | datos de contacto y agenda; no `id`, `slug`, `active`, `published`, `created_at` ni `updated_at` |

Cualquier columna fuera de esa lista está protegida por `revoke update` y
`grant update (columna)`.

## Autenticación

- Supabase Auth con correo y contraseña. El registro público sigue desactivado:
  las cuentas se crean desde el panel, con `create-shop` o por la Edge Function
  `shop-signup`.
- El alta autoservicio exige confirmar el correo: el perfil nace inactivo con
  `pending_signup = true` y `/confirmar/` procesa el enlace a mano (igual que
  `/restablecer`, porque el cliente usa `detectSessionInUrl: false`). Esa URL
  debe estar en la lista blanca de Authentication > URL Configuration.
- La recuperación de contraseña con `resetPasswordForEmail`: el enlace es de un
  solo uso, vence en una hora y vuelve a `/restablecer/`. Esa URL debe estar en
  la lista blanca de Authentication > URL Configuration. La sesión temporal de
  recuperación se cierra después de guardar la contraseña.
- La sesión se guarda en el navegador (persistencia de Supabase). El token se
  renueva automáticamente.
- El perfil se carga después del login. Si no existe o está inactivo, se cierra
  la sesión.
- Contraseñas: mínimo 8 caracteres (Edge Function y script de provisión). No se
  almacenan ni se registran en el frontend.
- Roles: `ADMIN` y `BARBER`. El rol vive en `profiles`, no en el token, para que
  un cambio de rol tenga efecto inmediato al recargar el perfil.

## Edge Function `admin-users`

Única vía para crear cuentas, cambiar correo, contraseña, rol o estado.

Contrato:

```json
{ "action": "create", "name": "...", "email": "...", "password": "...", "role": "BARBER", "color": "#3f7d6c" }
{ "action": "update", "id": "...", "name": "...", "email": "...", "password": "...", "role": "ADMIN", "active": true }
{ "action": "toggle", "id": "...", "active": false }
```

Controles:

1. Exige `Authorization: Bearer <jwt>` de un usuario válido.
2. Consulta con la clave de servicio el perfil de quien invoca y exige
   `role = ADMIN`, `active = true` y `shop_id` presente. No confía en el cuerpo
   de la petición.
3. Acota todas las operaciones al `shop_id` del administrador. No se puede
   crear, editar ni desactivar una cuenta de otra barbería.
4. Valida nombre, correo, color, teléfono, bio y contraseña.
5. Impide dejar una barbería sin administradores activos.
6. Si el perfil falla después de crear el usuario de Auth, revierte la cuenta.
7. Devuelve mensajes en español sin datos internos.

La clave `SUPABASE_SERVICE_ROLE_KEY` solo existe en el entorno de Supabase
(secrets de la función) y en el `.env` de quien ejecuta scripts.

## Edge Function `shop-signup`

Única vía de alta autoservicio. Es pública (`verify_jwt = false`) porque el
dueño todavía no tiene sesión, pero no confía en el cuerpo más allá de los datos
del formulario.

Contrato:

```json
{ "action": "signup", "name": "...", "ownerName": "...", "email": "...", "password": "...", "phone": "..." }
{ "action": "resend", "email": "..." }
```

Controles:

1. Valida nombre del local, responsable, correo, contraseña (mínimo 8) y
   longitudes.
2. Aplica rate limit por correo e IP con `shop_signup_attempts`.
3. Llama a `create_shop_signup` con la clave de servicio: crea la barbería con
   `published = false` y su horario inicial.
4. Genera el enlace con `admin.generateLink({ type: "signup" })`; el trigger
   crea el perfil inactivo y la función lo deja `ADMIN`, `active = false`,
   `pending_signup = true`. No habilita el signup público de Supabase.
5. Envía el enlace por Resend a `/confirmar/`.
6. Si falla la cuenta, el perfil o el correo, revierte la barbería y el usuario.
7. `resend` usa `generateLink({ type: "magiclink" })` para cuentas pendientes y
   responde igual exista o no la cuenta, para no enumerar correos.
8. Nunca devuelve la contraseña, el enlace ni datos internos al navegador.

Variables: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
`REMINDER_FROM_EMAIL`, `REMINDER_FROM_NAME` y `APP_BASE_URL`. La clave de
servicio y la de Resend nunca salen del entorno de Supabase.

## Búsqueda pública

`search_shops(p_query)`:

- Exige al menos 2 caracteres; con menos devuelve una lista vacía.
- Elimina `%` y `_` de la entrada para que no funcione como patrón.
- Solo considera `shops.active = true` y `shops.published = true`.
- Devuelve `id`, `slug`, `name`, `tagline`, `address` e `instagram`.
- Ordena primero la coincidencia exacta y limita a 12 resultados.

`get_public_shop(p_slug)` devuelve la configuración pública de una barbería
activa y publicada. No incluye datos de clientes ni de usuarios. `anon` no puede
leer `shops` directamente.

## Reserva pública endurecida

`create_public_booking`:

- Exige que la barbería exista, esté activa y publicada.
- Valida servicio activo y barbero activo **de esa barbería**.
- Valida día abierto, horario y anticipación.
- Toma el precio del catálogo, nunca del navegador.
- Bloquea el día con `pg_advisory_xact_lock` para evitar carreras.
- Rechaza solapamientos y bloqueos (`time_off`) de la barbería.
- Normaliza el teléfono con el país configurado por la barbería.
- Limita longitudes: nombre 80, correo 160, tipo de cabello 80, estilo 80,
  notas 500.
- No sobrescribe el nombre de un cliente existente; solo completa campos vacíos.
- Crea o reutiliza el cliente dentro de `(shop_id, phone)`.
- Limita a 3 reservas públicas por teléfono y barbería en la última hora.
- Crea la notificación interna del barbero asignado.

## Confirmación pública

`get_booking_confirmation(uuid)` devuelve:

```json
{
  "id": "...",
  "start_at": "...",
  "end_at": "...",
  "price_cents": 4500000,
  "status": "CONFIRMED",
  "client": { "name": "...", "phone": "...", "has_email": true },
  "service": { "name": "...", "duration_min": 45 },
  "barber": { "name": "..." },
  "shop": { "id": "...", "slug": "...", "name": "...", "timezone": "...", "currency": "..." }
}
```

El UUID es la credencial. No incluye correo del cliente, notas internas ni
teléfono del barbero. No permite listados ni modificaciones directas.

`set_booking_email(uuid, correo)` permite agregar el correo después de
confirmar. Solo funciona en reservas `PENDING` o `CONFIRMED`, valida el formato
y únicamente completa un correo faltante: nunca reemplaza uno existente.
Cualquier persona con el UUID puede fijarlo; es el mismo modelo de confianza que
la confirmación y por eso el enlace no debe registrarse en analítica ni
compartirse.

## Recordatorio por correo

`send-reminder`:

- Acepta solo `POST` con `{ "appointmentId": "<uuid>" }`.
- Valida el formato del UUID y busca la reserva con la clave de servicio.
- Solo envía para turnos `PENDING` o `CONFIRMED`.
- Exige que el cliente tenga correo; si no, responde con un mensaje que invita a
  agregarlo.
- Aplica un enfriamiento de 2 minutos usando `reminder_sent_at`.
- Lee el correo del cliente, pero nunca lo devuelve al navegador.
- Si Resend falla, devuelve un mensaje genérico y no registra direcciones.
- Marca `reminder_sent_at` solo después de que Resend acepta el envío.

Variables de la función: `RESEND_API_KEY`, `REMINDER_FROM_EMAIL` y, opcional,
`REMINDER_FROM_NAME`. El remitente debe pertenecer a un dominio verificado en
Resend.

## Gestión de secretos

| Secreto | Dónde vive | Quién lo usa |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Build y navegador | Público por diseño |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build y navegador | Público por diseño; RLS lo limita |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` local + secrets de funciones | Scripts y Edge Functions |
| `SUPABASE_DB_PASSWORD` | `.env` local | Migraciones por conexión directa |
| `RESEND_API_KEY` | Secrets de la Edge Function | `send-reminder` y `shop-signup` |
| `REMINDER_FROM_EMAIL`, `REMINDER_FROM_NAME` | Secrets de la Edge Function | `send-reminder` y `shop-signup` |
| `APP_BASE_URL` | Secrets de la Edge Function | `shop-signup`, para armar el retorno del enlace |
| Secrets de GitHub | Repositorio > Settings > Secrets | `deploy.yml` |

Reglas:

- Nunca prefijar un secreto con `NEXT_PUBLIC_`.
- Nunca pegar una clave de servicio o de Resend en una consulta SQL, un issue o
  un log.
- Rotar la clave afectada si se filtró (Supabase > Project Settings > API;
  Resend > API Keys).
- El `.env` está ignorado por Git; `.env.example` solo contiene marcadores.

## Checklist antes de operar con clientes reales

- [ ] Registro público desactivado en Supabase Auth (Email > Allow new users to
      sign up). El alta usa `shop-signup`, no el signup público.
- [ ] Confirmación de correo activada en Authentication > Sign In / Providers >
      Email.
- [ ] URLs `.../restablecer/` y `.../confirmar/` registradas en Authentication >
      URL Configuration.
- [ ] Contraseñas de demostración cambiadas o cuentas demo eliminadas.
- [ ] `NEXT_PUBLIC_DEMO_MODE` en `false`.
- [ ] Migraciones aplicadas, incluidas `20261029000000_multi_shop.sql` y
      `20261029120000_shop_signup.sql`.
- [ ] Edge Functions `admin-users`, `send-reminder` y `shop-signup` desplegadas.
- [ ] Dominio de envío verificado en Resend y variables configuradas con
      `npx supabase secrets set`, incluida `APP_BASE_URL`.
- [ ] Al menos una barbería creada con `npm run db:create-shop` y su
      administrador probado.
- [ ] Un alta completa probada: registro, correo, confirmación y publicación.
- [ ] `npm run smoke:supabase` en verde contra el proyecto real.
- [ ] Verificar en SQL que `profiles` no tenga `update` de tabla completa.
- [ ] Autenticación en dos pasos en Supabase, GitHub y Resend.
- [ ] Copia de seguridad automática de Supabase activa (plan de pago) o
      exportación periódica.
- [ ] Una persona responsable de cada cuenta identificada.

## Verificación rápida en SQL

```sql
-- Debe mostrar solo las columnas permitidas para authenticated.
select grantee, column_name
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'profiles'
  and privilege_type = 'UPDATE'
  and grantee = 'authenticated';

-- `shops` no debe otorgar update sobre id, slug, active, published ni timestamps.
select grantee, column_name
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'shops'
  and privilege_type = 'UPDATE'
  and grantee = 'authenticated';

-- `anon` no debe tener select directo sobre shops.
select grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and table_name = 'shops'
  and privilege_type = 'SELECT'
  and grantee = 'anon';

-- No debe existir INSERT para authenticated en appointments ni notifications.
select table_name, privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and grantee = 'authenticated'
  and privilege_type in ('INSERT', 'DELETE')
order by table_name;

-- Políticas activas por tabla.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Toda tabla del tenant debe tener shop_id.
select table_name
from information_schema.columns
where table_schema = 'public'
  and column_name = 'shop_id'
order by table_name;
```

## Riesgos residuales asumidos

1. **Enlace de confirmación sin vencimiento.** El UUID funciona como credencial
   permanente. Si se comparte, cualquiera con el enlace ve el turno y puede
   fijar el correo del recordatorio. No se puede enumerar. Mitigación: no
   registrar el enlace en analítica ni en chats grupales.
2. **Sin captcha.** El freno por teléfono y el límite de Supabase Auth cubren el
   caso normal. Si aparece spam coordinado, agregar Turnstile en `/reservar`.
3. **CORS abierto en las Edge Functions.** Cualquier origen puede invocarlas;
   `admin-users` exige un JWT de administrador y `send-reminder` exige un UUID
   válido. Se puede restringir el origen si el despliegue tiene un dominio fijo.
4. **Sin límite global de recordatorios.** El enfriamiento es por turno. Un
   atacante con muchos UUID válidos podría generar tráfico; el volumen depende
   de cuántas reservas reales existan y Resend aplica sus propios límites.
5. **El panel confía en el filtrado del cliente para la experiencia.** La
   seguridad real está en RLS; un barbero que llame a la API directamente
   obtiene lo que las políticas permiten: el conjunto del personal de su
   barbería. Si se necesita aislamiento estricto entre barberos, hay que
   endurecer las políticas de `select` por `barber_id`.
6. **Sin auditoría de cambios.** No hay tabla de historial. Para operaciones
   sensibles, Supabase conserva logs de API según el plan contratado.
7. **Alta autoservicio sin captcha.** El rate limit por correo e IP frena el
   abuso normal, pero un atacante distribuido podría crear barberías en
   borrador. No aparecen en el sitio hasta publicarse y se pueden desactivar
   desde operación. Si el problema crece, agregar Turnstile en `/registro`.
8. **Enlace de confirmación del alta.** Es de un solo uso y vence según la
   configuración de Supabase Auth; no debe registrarse en logs ni analítica.

## Respuesta a incidentes

1. Rotar `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` y las claves de GitHub.
2. Si el problema es una barbería concreta, poner `shops.active = false` o
   `shops.published = false`: la primera corta también el acceso del personal;
   la segunda solo la oculta del sitio público.
3. Revisar `auth.users` y `profiles` en busca de cuentas desconocidas o roles
   alterados; revisar `shop_signup_attempts` si hay altas sospechosas.
4. Revisar `appointments` creados fuera del horario o con precios incoherentes.
5. Si se filtró un enlace de confirmación, contactar al cliente afectado.
6. Aplicar la corrección como una migración nueva y volver a correr el smoke
   test.
7. Documentar qué pasó y qué se cambió en `docs/04-OPERACION.md`.
