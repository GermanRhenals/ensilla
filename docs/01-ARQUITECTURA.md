# 01 · Arquitectura

## Resumen

En-silla es un marketplace de barberías con frontend estático y backend
gestionado. El visitante busca una barbería por nombre, reserva en ella y recibe
un recordatorio por correo. Cada barbería opera con datos completamente
aislados.

El navegador habla directamente con la API de Supabase; no existe una capa
intermedia propia.

```text
┌──────────────────────────────┐
│ Navegador                    │
│  Next.js (export estático)   │
│  React 19 · TypeScript       │
└──────────────┬───────────────┘
               │ HTTPS · JWT de Supabase Auth
               ▼
┌──────────────────────────────┐        ┌──────────────────────────┐
│ Supabase                     │        │ GitHub Pages             │
│  PostgREST  → tablas + RLS   │        │  out/ (HTML, JS, CSS)    │
│  RPC        → reglas         │        └──────────────────────────┘
│  Auth       → sesiones       │
│  Edge Fn    → cuentas        │
│  Edge Fn    → alta           │
│  Edge Fn    → recordatorios  │────────▶ Brevo o Resend
└──────────────┬───────────────┘
               ▼
        Postgres 17
```

La decisión central: **la seguridad y las reglas de negocio viven en la base de
datos**. El frontend puede ser inspeccionado o manipulado por cualquier
persona; Postgres no.

## Multi-barbería

- La tabla `shops` es la raíz del tenant. Tiene `slug` único, configuración de
  agenda, contacto y dos estados: `active` (puede operar) y `published`
  (aparece en el sitio público). Una barbería nueva nace `active = true` y
  `published = false`; el dueño la publica cuando tiene el mínimo operativo.
  Suspender una barbería (`active = false`) corta el acceso de todo su equipo.
- Todas las tablas operativas (`profiles`, `business_hours`, `services`,
  `clients`, `appointments`, `time_off`, `haircut_ideas`, `notifications`)
  llevan `shop_id`.
- Las políticas RLS comparan `shop_id` con `current_shop_id()`. Un usuario
  autenticado solo ve y escribe datos de su barbería; si la barbería está
  inactiva, `current_shop_id()` devuelve `null` y el acceso se corta.
  `current_shop_id()` no exige `published`: el panel funciona durante el
  borrador.
- El sitio público nunca recibe un listado completo ni puede leer `shops`
  directamente: busca por nombre o slug y solo ve barberías activas y
  publicadas.
- El alta es autoservicio (`/registro` → Edge Function `shop-signup`). La vía
  asistida con `scripts/create-shop.mjs` y la clave de servicio sigue disponible
  para provisionar una barbería ya publicada.

## Capas del frontend

| Capa | Ubicación | Responsabilidad |
| --- | --- | --- |
| Rutas y vistas | `src/app` | Composición de pantallas, estado local y navegación |
| Componentes | `src/components` | Piezas de interfaz reutilizables |
| Dominio | `src/lib/*.ts` | Agenda, disponibilidad, estadísticas, fechas, formato, ICS |
| Datos | `src/lib/data` | Única puerta a tablas de Supabase |
| Infraestructura | `src/lib/supabase.ts` | Cliente único de Supabase |

Regla práctica: una página puede importar de `lib` y de `components`, pero no
debe construir consultas de tablas. Si necesita un dato nuevo, se agrega una
función en `src/lib/data`.

## Flujo público

```text
/
  └─ ShopSearch → search_shops(consulta)
        │  mínimo 2 caracteres, solo barberías activas y publicadas
        ▼
/reservar?barberia=<slug>
  ├─ fetchShopBySlug(slug)     → RPC get_public_shop
  ├─ fetchPublicBarbers(shop.id) → vista barbers_public
  ├─ fetchBusinessHours(shop.id) → horario semanal
  └─ fetchServices(true, shop.id) → catálogo activo
        │
        ▼  elección de servicio, barbero y día
  getAvailability() ──RPC──▶ get_availability(p_shop_id, fecha, servicio, barbero)
        │                    calcula huecos reales en Postgres
        ▼
  createPublicBooking() ─RPC▶ create_public_booking(p_shop_id, ...)
        │                    valida, bloquea el día con advisory lock,
        │                    crea o reutiliza cliente dentro de la barbería,
        │                    inserta turno y notificación
        ▼
/reservar/confirmacion?id=<uuid>
  ├─ fetchConfirmation() ─RPC▶ get_booking_confirmation(uuid)
  ├─ saveBookingEmail()  ─RPC▶ set_booking_email(uuid, correo)
  └─ sendBookingReminder() ─Edge Function▶ send-reminder → Brevo o Resend
```

Detalles importantes:

- La disponibilidad **no** se calcula en el navegador porque exigiría leer
  turnos de otros clientes.
- El alta usa un bloqueo por barbero y día (`pg_advisory_xact_lock`) y además
  la restricción de exclusión de Postgres. Dos personas que reservan a la vez
  no pueden superponerse.
- El enlace de confirmación contiene un UUID no adivinable que actúa como
  credencial. No se listan reservas ni se permite modificarlas desde ese enlace.
- El correo es opcional y solo se guarda después de confirmar. La confirmación
  pública nunca devuelve el correo: apenas indica `has_email`.
- El archivo `.ics` se genera en el navegador (`src/lib/ics.ts`): no hay API ni
  almacenamiento de archivos.

## Flujo de alta de una barbería

```text
/registro
  └─ requestShopSignup() ─Edge Function▶ shop-signup (acción signup)
        ├─ valida nombre, responsable, correo, contraseña y rate limit
        ├─ create_shop_signup() ─RPC─▶ shops (published = false) + horario inicial
        ├─ admin.generateLink(type signup) → usuario de Auth
        │     └─ handle_new_user crea el perfil inactivo
        ├─ el perfil queda ADMIN, active = false, pending_signup = true
        └─ el proveedor envía el enlace a /confirmar/
              │
              ▼
/confirmar/  (procesa tokens a mano, como /restablecer)
  └─ confirm_shop_signup() ─RPC─▶ activa el perfil pendiente
        │
        ▼
/panel/ajustes  →  servicio + horario + equipo
  └─ setShopPublished(true) ─RPC─▶ exige el mínimo operativo
```

Detalles importantes:

- El registro público de Supabase Auth sigue desactivado: la Edge Function usa
  la clave de servicio y `admin.generateLink` para crear la cuenta y obtener el
  enlace. La contraseña viaja solo al backend.
- El perfil nace inactivo y con `pending_signup = true`. La activación depende de
  esa columna, no de `raw_user_meta_data`, que el usuario puede modificar.
- `create_shop_signup` deriva el slug del nombre y resuelve colisiones con
  sufijos numéricos. Un correo solo puede tener una cuenta
  (`profiles_email_key`).
- La barbería no aparece en el buscador ni acepta reservas públicas hasta que
  `published = true`. El panel sí funciona antes de publicar.
- El reenvío (`acción resend`) responde igual exista o no la cuenta pendiente,
  para no enumerar correos.

## Flujo del panel

```text
/login
  └─ supabase.auth.signInWithPassword
        │
        ▼
  AuthProvider → fetchProfile(id)
        │  perfil inactivo o inexistente → cierra sesión
        ▼
/panel
  ├─ fetchShop()   RPC current_shop → barbería del perfil
  ├─ Agenda        getAgenda(fecha, barbero)
  ├─ Citas         fetchAppointments + detalle + recordatorio real
  ├─ Clientes      búsqueda en servidor + ficha con historial
  ├─ Servicios     catálogo de la barbería
  ├─ Estadísticas  getOverview(rango, barbero)
  ├─ Ajustes       shops + business_hours (solo ADMIN)
  └─ Equipo        perfiles + Edge Function admin-users (solo ADMIN)
```

El panel es una aplicación de cliente: no hay renderizado en servidor ni
sesiones del lado del servidor. La autorización efectiva la aplica RLS en cada
consulta, de modo que un barbero no puede leer datos de otra barbería ni de otro
barbero aunque manipule el HTML.

## Mapa de módulos

```text
src/lib/
  supabase.ts       Cliente único; credenciales públicas.
  auth-context.tsx  Sesión, perfil, login/logout, guardas de UI.
  use-async.ts      Carga con cancelación, error y recarga.
  constants.ts      Estados, etiquetas, locales y valores por defecto.
  types.ts          Tipos de dominio; reexporta AppointmentStatus.
  datetime.ts       Claves de día, zona horaria, formatos en español.
  phone.ts          Normalización de teléfonos (espejo del SQL).
  format.ts         Moneda, iniciales, teléfono, enlaces de WhatsApp.
  availability.ts   RPC get_availability.
  booking.ts        RPC de alta de turnos.
  agenda.ts         Agenda diaria y resumen del día.
  stats.ts          Métricas agregadas del panel.
  ideas.ts          Sugerencias de corte según la ficha del cliente.
  ics.ts            Generación y descarga de calendario.

src/lib/data/
  rows.ts           Helpers de normalización, paginación y errores.
  mappers.ts        snake_case de Postgres → camelCase del dominio.
  shop.ts           shops, búsqueda pública, alta, publicación y ajustes.
  catalog.ts        services.
  profiles.ts       profiles, barbers_public y Edge Function.
  clients.ts        clients, historial e ideas.
  appointments.ts   appointments, confirmación, correo y recordatorio.
  notifications.ts  notifications.
  index.ts          Barrel público.
```

## Decisiones y compromisos

### Export estático en lugar de servidor Node

- Ventaja: hospedaje gratuito en GitHub Pages, superficie de ataque menor, sin
  procesos que mantener.
- Costo: no hay rutas de API, ni middleware, ni renderizado en servidor. Toda
  regla que necesite secreto va a Supabase.
- Consecuencia: la primera carga es JavaScript; las pantallas muestran estados
  de carga explícitos y errores visibles.

### Seguridad en Postgres

- RLS decide filas; los privilegios por columna deciden campos; las RPC
  encapsulan operaciones que no deben hacerse con un `insert` directo.
- Las funciones internas (`booking_validate`, `handle_new_user`,
  `set_updated_at`, `normalize_phone`) no son ejecutables desde la API.
- El aislamiento entre barberías se aplica en la base, no en el filtro de la
  interfaz.

### Búsqueda por nombre, no directorio

- El visitante conoce el nombre de su barbería. `search_shops` exige al menos
  dos caracteres y devuelve como máximo 12 resultados activos y publicados.
- No existe una ruta que liste todas las barberías: reduce la enumeración y
  mantiene el foco del producto. `anon` tampoco puede leer `shops` directamente.

### Alta autoservicio sin registro público

- El alta crea la cuenta con `admin.generateLink` desde una Edge Function, no
  con el signup público de Auth. Así se valida el negocio antes de crear la
  barbería y no se abre una puerta de registro genérica.
- La barbería nace oculta y el perfil inactivo: el dueño debe confirmar el correo
  antes de entrar y completar el mínimo operativo antes de publicar.
- La publicación es un RPC (`set_shop_published`) y no un `update`: exige
  servicio, horario y equipo, y no se puede forzar desde el navegador.

### Recordatorio por correo

- La Edge Function `send-reminder` recibe el UUID de la reserva, lee el correo
  con la clave de servicio, envía por Brevo o Resend y marca `reminder_sent_at`.
- El navegador nunca recibe el correo del cliente ni las claves del proveedor.
- Tiene un enfriamiento de dos minutos para que el botón no se convierta en un
  amplificador de spam.

### Cliente de Supabase único

- `src/lib/supabase.ts` mantiene una sola instancia y persiste la sesión en el
  navegador. Crear clientes adicionales duplica listeners de autenticación y
  produce cierres de sesión inesperados.

### Paginación explícita

- PostgREST devuelve como máximo 1000 filas. Las consultas de históricos y
  agregados usan `selectAllPages` con un `order` estable; las listas de trabajo
  usan límites razonables (300 clientes, 300 turnos, 60 notificaciones).

### Idioma y zona horaria

- Los textos están en español y las fechas se formatean con la zona de cada
  barbería. El servidor no formatea fechas para el usuario.
- Cambiar la zona horaria de una barbería cambia la interpretación de sus
  horarios de atención, no los instantes ya guardados.

## Manejo de errores

| Situación | Comportamiento |
| --- | --- |
| Una consulta falla | `useAsync` expone `error`; la página muestra `<Flash error>`. |
| Una RPC rechaza la operación | Se muestra el mensaje de negocio en español. |
| La ruta no existe | `not-found.tsx` (404 estático). |
| Error de render | `error.tsx` ofrece reintentar o volver al inicio. |
| Sesión sin perfil activo | `AuthProvider` cierra la sesión y el panel redirige a `/login`. |
| Slug inexistente en `/reservar` | Se muestra el buscador para retomar el flujo. |
| Enlace de confirmación vencido o usado | `/confirmar/` explica el problema y ofrece reenviar desde `/registro`. |
| Barbería no publicada | El sitio público no la encuentra; el panel muestra un aviso con enlace a ajustes. |

## Rendimiento

- Las vistas cargan datos en paralelo con `Promise.all` cuando las consultas son
  independientes.
- La búsqueda de clientes se resuelve con `ilike` en Postgres, no descargando la
  tabla completa.
- Los cálculos pesados (disponibilidad, solapamientos) los hace Postgres, que
  tiene los índices.

## Lo que no existe (y no hace falta)

- Servidor propio, contenedores, balanceadores.
- API intermedia o BFF.
- ORM o capa de migraciones distinta de Supabase CLI.
- SMS ni notificaciones push: el recordatorio es por correo y WhatsApp es un
  enlace.
- Almacenamiento de archivos: no se suben imágenes ni documentos.
