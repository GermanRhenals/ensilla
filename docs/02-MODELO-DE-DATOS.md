# 02 · Modelo de datos

Fuente de verdad: `supabase/migrations/`. El esquema no se edita a mano en el
panel de Supabase: se versiona con migraciones.

## Diagrama

```text
shops (barbería / tenant)
  │ 1:N
  ├── profiles ───────────────┐
  │      │ 1:N                │ 1:N
  │      ▼                    ▼
  │   appointments ◀── clients   time_off
  │      │              │
  │      │ N:1          │ 1:N
  │      ▼              ▼
  ├── services      haircut_ideas
  ├── business_hours (7 filas por barbería)
  └── notifications (N:1 con profiles)

auth.users (Supabase)
    │ 1:1
    ▼
profiles
```

Todas las tablas operativas llevan `shop_id` con FK a `shops` y `on delete
restrict`: una barbería con historia no se borra por accidente.

## Tablas

### `shops`

Raíz del tenant. El `slug` es la identidad pública y no se cambia desde el
navegador.

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid | PK |
| `slug` | text | Único; minúsculas, números y guiones simples |
| `name`, `tagline` | text | Identidad visible |
| `description`, `address`, `phone`, `whatsapp`, `email`, `instagram` | text | Opcionales |
| `currency` | text | ISO-4217, por defecto `COP` |
| `timezone` | text | IANA, por defecto `America/Bogota` |
| `locale` | text | Por defecto `es-CO` |
| `whatsapp_country_code` | text | Por defecto `57` |
| `slot_step_min` | integer | Paso de la grilla: 5 a 60 |
| `buffer_min` | integer | Colchón entre turnos: 0 a 120 |
| `lead_time_min` | integer | Anticipación mínima: 0 a 1440 |
| `booking_window_days` | integer | Días hacia adelante: 1 a 120 |
| `active` | boolean | Una barbería inactiva desaparece del sitio y bloquea a su equipo; solo se cambia con la clave de servicio |

La tabla reemplaza a `shop_setting`. La migración multi-barbería copió la
barbería existente y eliminó la tabla monolocal.

### `profiles`

Extiende `auth.users`. Un perfil no existe sin usuario de Auth.

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid | PK, FK a `auth.users` con `on delete cascade` |
| `shop_id` | uuid | FK a `shops`; define el tenant del usuario |
| `name` | text | Obligatorio |
| `email` | text | Único sin distinguir mayúsculas |
| `role` | text | `ADMIN` o `BARBER` |
| `phone`, `bio` | text | Opcionales |
| `color` | text | Color de agenda, por defecto `#c2703d` |
| `active` | boolean | Inactivo = no puede entrar ni recibir turnos nuevos |

Invariantes:

- Un usuario que se registra por su cuenta nace con `active = false` y en la
  barbería indicada en `raw_user_meta_data.shop_id`; si falta, en la más
  antigua.
- Siempre debe quedar al menos un `ADMIN` activo por barbería; lo garantiza la
  Edge Function, no la base.
- `role`, `active` y `shop_id` no son editables por el cliente (privilegios de
  columna).

### `business_hours`

Una fila por día de la semana dentro de cada barbería (`weekday` 0 = domingo a
6 = sábado). Único por `(shop_id, weekday)`.

| Columna | Tipo | Notas |
| --- | --- | --- |
| `shop_id` | uuid | FK a `shops` |
| `weekday` | integer | 0 a 6 |
| `open_minute`, `close_minute` | integer | Minutos desde medianoche, 0 a 1440 |
| `active` | boolean | Día cerrado si es `false` |

Los minutos se interpretan en la zona horaria de la barbería.

### `time_off`

Bloqueos de agenda (vacaciones, trámites, descansos).

| Columna | Tipo | Notas |
| --- | --- | --- |
| `shop_id` | uuid | FK a `shops` |
| `user_id` | uuid | Perfil afectado; `null` = toda la barbería |
| `start_at`, `end_at` | timestamptz | `end_at > start_at` |
| `reason` | text | Opcional |

### `clients`

Ficha del cliente. Se identifica por teléfono normalizado dentro de cada
barbería: único por `(shop_id, phone)`.

| Columna | Tipo | Notas |
| --- | --- | --- |
| `shop_id` | uuid | FK a `shops` |
| `name` | text | Obligatorio |
| `phone` | text | Normalizado con `normalize_phone` |
| `email` | text | Opcional; se usa para el recordatorio |
| `birth_date` | date | Opcional |
| `notes`, `hair_type`, `preferred_style`, `products`, `allergies` | text | Memoria del oficio |
| `preferred_barber_id` | uuid | FK a `profiles` con `on delete set null` |

El mismo teléfono puede ser cliente de dos barberías sin compartir ficha.

### `services`

Catálogo de servicios por barbería.

| Columna | Tipo | Notas |
| --- | --- | --- |
| `shop_id` | uuid | FK a `shops` |
| `name`, `description` | text | Descripción opcional |
| `duration_min` | integer | 5 a 480 minutos |
| `price_cents` | integer | Mayor o igual a 0 |
| `active` | boolean | Solo los activos se ofrecen al público |
| `sort_order` | integer | Orden de presentación |

### `appointments`

Turno reservado. Es la tabla con más reglas.

| Columna | Tipo | Notas |
| --- | --- | --- |
| `shop_id` | uuid | FK a `shops` |
| `client_id` | uuid | FK `on delete restrict` |
| `barber_id` | uuid | FK a `profiles` con `on delete restrict` |
| `service_id` | uuid | FK a `services` con `on delete restrict` |
| `start_at`, `end_at` | timestamptz | Instantes en UTC; `end_at > start_at` |
| `status` | text | `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW` |
| `price_cents` | integer | Precio congelado al momento de reservar |
| `notes` | text | Notas internas |
| `source` | text | `PUBLIC` o `STAFF` |
| `reminder_sent_at` | timestamptz | Marca del último recordatorio enviado |

Restricción clave:

```sql
constraint appointments_no_overlap exclude using gist (
  barber_id with =,
  tstzrange(start_at, end_at, '[)') with &&
) where (status in ('PENDING', 'CONFIRMED', 'COMPLETED'))
```

Un barbero no puede tener dos turnos activos superpuestos. La restricción se
combina con el bloqueo por día de las RPC para evitar carreras.

### `haircut_ideas`

Ideas de corte asociadas a un cliente.

| Columna | Tipo | Notas |
| --- | --- | --- |
| `shop_id` | uuid | FK a `shops` |
| `title`, `description` | text | Obligatorios |
| `tags` | text | Opcional, separado por comas |
| `client_id` | uuid | FK `on delete restrict` |
| `created_by_id` | uuid | FK a `profiles` con `on delete set null` |

### `notifications`

Bandeja interna del equipo.

| Columna | Tipo | Notas |
| --- | --- | --- |
| `shop_id` | uuid | FK a `shops` |
| `user_id` | uuid | Destinatario; FK con `on delete cascade` |
| `title`, `body` | text | Contenido |
| `href` | text | Enlace interno opcional |
| `read_at` | timestamptz | `null` = no leída |

Solo las crea el backend (RPC con `security definer`). El cliente únicamente
puede leer las propias y marcarlas como leídas.

## Vista `barbers_public`

Proyección segura para el sitio público:

```sql
select id, shop_id, name, role, bio, color
from profiles
where active = true
  and role in ('ADMIN', 'BARBER')
  and is_active_shop(shop_id)
```

No expone correo, teléfono ni estado interno. Se consulta sin sesión y siempre
filtrada por `shop_id`.

## Funciones RPC

| Función | Quién | Qué garantiza |
| --- | --- | --- |
| `search_shops(text)` | `anon`, `authenticated` | Busca barberías activas por nombre o slug; mínimo 2 caracteres y tope de 12 |
| `get_public_shop(text)` | `anon`, `authenticated` | Configuración pública de una barbería activa por slug |
| `current_shop()` | `authenticated` | Configuración de la barbería del perfil autenticado |
| `current_shop_id()` | `anon`, `authenticated` | `shop_id` del perfil activo en una barbería activa; base de las políticas RLS |
| `is_active_shop(uuid)` | `anon`, `authenticated` | Verdadero solo para barberías publicadas |
| `get_availability(uuid, date, uuid, uuid)` | `anon`, `authenticated` | Huecos reales según barbería, horario, turnos, bloqueos, anticipación y ventana |
| `create_public_booking(uuid, uuid, uuid, timestamptz, text, text, text, text, text, text)` | `anon`, `authenticated` | Alta pública validada, cliente por barbería, anti-abuso y notificación |
| `create_staff_appointment(...)` | `authenticated` | Alta desde el panel; deduce la barbería con `current_shop_id()` |
| `get_booking_confirmation(uuid)` | `anon`, `authenticated` | Datos mínimos de una reserva, con su barbería y `has_email` |
| `set_booking_email(uuid, text)` | `anon`, `authenticated` | Completa el correo faltante después de reservar; solo en turnos pendientes o confirmados |
| `is_staff()`, `is_admin()`, `current_app_role()` | `anon`, `authenticated` | Helpers de RLS |
| `normalize_phone(text, text)` | interno | Normalización compartida con el frontend |
| `booking_validate(...)` | interno | Validación previa de barbería, servicio, barbero y horario |
| `handle_new_user()` | trigger | Crea el perfil inactivo en la barbería indicada por metadatos |
| `handle_user_email_change()` | trigger | Sincronización de correo con Auth |
| `set_updated_at()` | trigger | Actualización de `updated_at` |

Las funciones internas tienen `execute` revocado para `public`, `anon` y
`authenticated`.

## Provisión de barberías

No hay alta pública. El script `scripts/create-shop.mjs` usa la clave de
servicio para:

1. Crear o actualizar la fila de `shops` por slug.
2. Crear el horario semanal por defecto si la barbería no tiene uno.
3. Crear el primer usuario administrador con `shop_id` en los metadatos y
   activar su perfil.

Después del alta, el administrador completa servicios, equipo y ajustes desde
el panel.

## Convenciones de nombres

- Tablas en plural (`shops`, `clients`, `appointments`).
- Columnas en `snake_case`; el frontend las convierte a `camelCase` en
  `src/lib/data/mappers.ts`.
- Dinero: sufijo `_cents`, siempre entero.
- Fechas: sufijo `_at` para instantes (`timestamptz`), `_date` para días.
- Booleanos con nombre afirmativo (`active`, no `inactive`).

## Migraciones

| Archivo | Contenido |
| --- | --- |
| `20261027194500_init.sql` | Esquema inicial, RLS, vista pública, disponibilidad, alta de turnos |
| `20261027210000_shop_locale.sql` | Idioma y país de WhatsApp por barbería |
| `20261028000000_security_hardening.sql` | Privilegios por columna, anti-abuso, integridad y autoregistro inactivo |
| `20261029000000_multi_shop.sql` | `shops`, `shop_id` en todo el tenant, RLS por barbería, búsqueda pública, correo posterior y confirmación con barbería |

Reglas:

1. Una migración aplicada no se modifica. Los cambios se agregan al final.
2. Toda migración debe poder aplicarse sobre una base existente con datos.
3. Los `revoke`/`grant` forman parte del diseño, no son un detalle opcional.
4. Después de cambiar el esquema, actualizar este documento y ejecutar
   `npm run smoke:supabase`.

## Volumen y crecimiento

- Un año de operación de una barbería de barrio ronda los miles de turnos, no
  millones. Postgres y los índices actuales sobran.
- `appointments` tiene índices por barbería y por `(barber_id, start_at)`,
  `client_id` y `start_at`.
- `notifications` se poda de forma natural porque la consulta trae las últimas
  60; si crece demasiado, se puede agregar una tarea de limpieza mensual.
- El crecimiento del marketplace se mide en barberías, no en filas: cada tenant
  tiene su propio conjunto de datos y sus índices por `shop_id`.
