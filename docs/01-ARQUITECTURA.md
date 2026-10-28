# 01 · Arquitectura

## Resumen

En-silla es un frontend estático con backend gestionado. El navegador habla
directamente con la API de Supabase; no existe una capa intermedia propia.

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
└──────────────┬───────────────┘
               ▼
        Postgres 17
```

La decisión central: **la seguridad y las reglas de negocio viven en la base de
datos**. El frontend puede ser inspeccionado o manipulado por cualquier
persona; Postgres no.

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

## Flujo de una reserva pública

```text
/reservar
  ├─ fetchShop()            → configuración de la barbería
  ├─ fetchPublicBarbers()   → vista barbers_public (sin datos privados)
  ├─ fetchBusinessHours()   → horario semanal
  └─ fetchServices(true)    → catálogo activo
        │
        ▼  elección de servicio, barbero y día
  getAvailability()  ──RPC──▶  get_availability(fecha, servicio, barbero)
        │                     calcula huecos reales en Postgres
        ▼
  createPublicBooking() ─RPC▶ create_public_booking(...)
        │                     valida, bloquea el día con advisory lock,
        │                     crea o reutiliza cliente, inserta turno,
        │                     crea notificación
        ▼
/reservar/confirmacion?id=<uuid>
  └─ fetchConfirmation() ─RPC▶ get_booking_confirmation(uuid)
```

Detalles importantes:

- La disponibilidad **no** se calcula en el navegador porque exigiría leer
  turnos de otros clientes.
- El alta usa un bloqueo por barbero y día (`pg_advisory_xact_lock`) y además
  la restricción de exclusión de Postgres. Dos personas que reservan a la vez
  no pueden superponerse.
- El enlace de confirmación contiene un UUID no adivinable que actúa como
  credencial temporal. No se listan reservas ni se permite modificarlas desde
  ese enlace.
- El archivo `.ics` se genera en el navegador (`src/lib/ics.ts`): no hay API ni
  almacenamiento de archivos.

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
  ├─ Agenda        getAgenda(fecha, barbero)
  ├─ Citas         fetchAppointments + detalle
  ├─ Clientes      búsqueda en servidor + ficha con historial
  ├─ Servicios     catálogo
  ├─ Estadísticas  getOverview(rango, barbero)
  ├─ Ajustes       shop_setting + business_hours (solo ADMIN)
  └─ Equipo        perfiles + Edge Function admin-users (solo ADMIN)
```

El panel es una aplicación de cliente: no hay renderizado en servidor ni
sesiones del lado del servidor. La autorización efectiva la aplica RLS en cada
consulta, de modo que un barbero no puede leer datos de otro barbero aunque
manipule el HTML.

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
  shop.ts           shop_setting y business_hours.
  catalog.ts        services.
  profiles.ts       profiles, barbers_public y Edge Function.
  clients.ts        clients, historial e ideas.
  appointments.ts   appointments y confirmación pública.
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
  `set_updated_at`) no son ejecutables desde la API.

### Cliente de Supabase único

- `src/lib/supabase.ts` mantiene una sola instancia y persiste la sesión en el
  navegador. Crear clientes adicionales duplica listeners de autenticación y
  produce cierres de sesión inesperados.

### Paginación explícita

- PostgREST devuelve como máximo 1000 filas. Las consultas de históricos y
  agregados usan `selectAllPages` con un `order` estable; las listas de trabajo
  usan límites razonables (300 clientes, 300 turnos, 60 notificaciones).

### Idioma y zona horaria

- Los textos están en español y las fechas se formatean con la zona de la
  barbería. El servidor no formatea fechas para el usuario.
- Cambiar la zona horaria de la barbería cambia la interpretación de los
  horarios de atención, no los instantes ya guardados.

## Manejo de errores

| Situación | Comportamiento |
| --- | --- |
| Una consulta falla | `useAsync` expone `error`; la página muestra `<Flash error>`. |
| Una RPC rechaza la operación | Se muestra el mensaje de negocio en español. |
| La ruta no existe | `not-found.tsx` (404 estático). |
| Error de render | `error.tsx` ofrece reintentar o volver al inicio. |
| Sesión sin perfil activo | `AuthProvider` cierra la sesión y el panel redirige a `/login`. |

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
- Servicio de correo o SMS: las notificaciones son internas y WhatsApp es un
  enlace.
- Almacenamiento de archivos: no se suben imágenes ni documentos.
