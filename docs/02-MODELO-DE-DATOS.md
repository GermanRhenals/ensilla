# 02 · Modelo de datos

Fuente de verdad: `supabase/migrations/`. El esquema no se edita a mano en el
panel de Supabase: se versiona con migraciones.

## Diagrama

```text
auth.users (Supabase)
    │ 1:1
    ▼
profiles ────────────────┐
    │ 1:N                 │ 1:N
    ▼                     ▼
appointments ◀── clients   time_off
    │              │
    │ N:1          │ 1:N
    ▼              ▼
services      haircut_ideas

shop_setting (fila única)
business_hours (7 filas, una por día)
notifications (N:1 con profiles)
```

## Tablas

### `shop_setting`

Configuración global. Solo existe la fila `id = 1` (restricción `check`).

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | integer | Siempre 1 |
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

### `profiles`

Extiende `auth.users`. Un perfil no existe sin usuario de Auth.

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid | PK, FK a `auth.users` con `on delete cascade` |
| `name` | text | Obligatorio |
| `email` | text | Único sin distinguir mayúsculas |
| `role` | text | `ADMIN` o `BARBER` |
| `phone`, `bio` | text | Opcionales |
| `color` | text | Color de agenda, por defecto `#c2703d` |
| `active` | boolean | Inactivo = no puede entrar ni recibir turnos nuevos |

Invariantes:

- Un usuario que se registra por su cuenta nace con `active = false`.
- Siempre debe quedar al menos un `ADMIN` activo; lo garantiza la Edge
  Function, no la base.
- `role` y `active` no son editables por el cliente (privilegios de columna).

### `business_hours`

Una fila por día de la semana (`weekday` 0 = domingo a 6 = sábado).

| Columna | Tipo | Notas |
| --- | --- | --- |
| `weekday` | integer | Único, 0 a 6 |
| `open_minute`, `close_minute` | integer | Minutos desde medianoche, 0 a 1440 |
| `active` | boolean | Día cerrado si es `false` |

Los minutos se interpretan en la zona horaria de `shop_setting`.

### `time_off`

Bloqueos de agenda (vacaciones, trámites, descansos).

| Columna | Tipo | Notas |
| --- | --- | --- |
| `user_id` | uuid | Perfil afectado; `null` = toda la barbería |
| `start_at`, `end_at` | timestamptz | `end_at > start_at` |
| `reason` | text | Opcional |

### `clients`

Ficha del cliente. Se identifica por teléfono normalizado.

| Columna | Tipo | Notas |
| --- | --- | --- |
| `name` | text | Obligatorio |
| `phone` | text | Único; normalizado con `normalize_phone` |
| `email` | text | Opcional |
| `birth_date` | date | Opcional |
| `notes`, `hair_type`, `preferred_style`, `products`, `allergies` | text | Memoria del oficio |
| `preferred_barber_id` | uuid | FK a `profiles` con `on delete set null` |

### `services`

Catálogo de servicios.

| Columna | Tipo | Notas |
| --- | --- | --- |
| `name`, `description` | text | Descripción opcional |
| `duration_min` | integer | 5 a 480 minutos |
| `price_cents` | integer | Mayor o igual a 0 |
| `active` | boolean | Solo los activos se ofrecen al público |
| `sort_order` | integer | Orden de presentación |

### `appointments`

Turno reservado. Es la tabla con más reglas.

| Columna | Tipo | Notas |
| --- | --- | --- |
| `client_id` | uuid | FK `on delete restrict` |
| `barber_id` | uuid | FK a `profiles` con `on delete restrict` |
| `service_id` | uuid | FK a `services` con `on delete restrict` |
| `start_at`, `end_at` | timestamptz | Instantes en UTC; `end_at > start_at` |
| `status` | text | `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW` |
| `price_cents` | integer | Precio congelado al momento de reservar |
| `notes` | text | Notas internas |
| `source` | text | `PUBLIC` o `STAFF` |
| `reminder_sent_at` | timestamptz | Marca de recordatorio enviado |

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
| `title`, `description` | text | Obligatorios |
| `tags` | text | Opcional, separado por comas |
| `client_id` | uuid | FK `on delete restrict` |
| `created_by_id` | uuid | FK a `profiles` con `on delete set null` |

### `notifications`

Bandeja interna del equipo.

| Columna | Tipo | Notas |
| --- | --- | --- |
| `user_id` | uuid | Destinatario; FK con `on delete cascade` |
| `title`, `body` | text | Contenido |
| `href` | text | Enlace interno opcional |
| `read_at` | timestamptz | `null` = no leída |

Solo las crea el backend (RPC con `security definer`). El cliente únicamente
puede leer las propias y marcarlas como leídas.

## Vista `barbers_public`

Proyección segura para el sitio público:

```sql
select id, name, role, bio, color
from profiles
where active = true and role in ('ADMIN', 'BARBER')
```

No expone correo, teléfono ni estado interno. Se consulta sin sesión.

## Funciones RPC

| Función | Quién | Qué garantiza |
| --- | --- | --- |
| `get_availability(date, uuid, uuid)` | `anon`, `authenticated` | Huecos reales según horario, turnos, bloqueos, anticipación y ventana |
| `create_public_booking(...)` | `anon`, `authenticated` | Alta pública validada, cliente sin sobrescritura de nombre, anti-abuso y notificación |
| `create_staff_appointment(...)` | `authenticated` | Alta desde el panel, respeta el alcance del barbero |
| `get_booking_confirmation(uuid)` | `anon`, `authenticated` | Datos mínimos de una reserva concreta |
| `is_staff()`, `is_admin()`, `current_app_role()` | `anon`, `authenticated` | Helpers de RLS |
| `normalize_phone(text, text)` | interno | Normalización compartida con el frontend |
| `booking_validate(...)` | interno | Validación previa de servicio, barbero y horario |
| `handle_new_user()`, `handle_user_email_change()` | trigger | Sincronización con Auth |
| `set_updated_at()` | trigger | Actualización de `updated_at` |

Las funciones internas tienen `execute` revocado para `public`, `anon` y
`authenticated`.

## Convenciones de nombres

- Tablas en plural (`clients`, `appointments`), salvo configuración
  (`shop_setting`).
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

Reglas:

1. Una migración aplicada no se modifica. Los cambios se agregan al final.
2. Toda migración debe poder aplicarse sobre una base existente con datos.
3. Los `revoke`/`grant` forman parte del diseño, no son un detalle opcional.
4. Después de cambiar el esquema, actualizar este documento y ejecutar
   `npm run smoke:supabase`.

## Volumen y crecimiento

- Un año de operación de una barbería de barrio ronda los miles de turnos, no
  millones. Postgres y los índices actuales sobran.
- `appointments` tiene índices por `(barber_id, start_at)`, `client_id` y
  `start_at`.
- `notification` se poda de forma natural porque la consulta trae las últimas
  60; si crece demasiado, se puede agregar una tarea de limpieza mensual.
