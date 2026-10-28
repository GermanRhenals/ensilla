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
| Correo | Resend, a través de la Edge Function `send-reminder` |
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

---

## Puesta en marcha (15 minutos)

### 1. Requisitos

- Node.js 22 o superior.
- Una cuenta de Supabase y el CLI (`npx supabase`).
- Git.
- Opcional: una cuenta de Resend para probar recordatorios reales.

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

Los secretos de Resend no se usan en el build: se configuran en Supabase.

### 4. Crear el esquema

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Las migraciones de `supabase/migrations/` son la única fuente de verdad del
esquema. No se editan una vez aplicadas: los cambios se agregan como una
migración nueva. La migración `20261029000000_multi_shop.sql` convierte el
esquema de barbería única en marketplace y conserva los datos existentes.

> **Recuperación de contraseña:** en **Authentication > URL Configuration**
> agregar a `Redirect URLs` la ruta de retorno del despliegue:
> `http://localhost:3000/restablecer/` y
> `https://<usuario>.github.io/<repositorio>/restablecer/`. Sin esa entrada, el
> enlace del correo vuelve a la portada. Para producción conviene configurar
> SMTP propio en **Authentication > Emails**: el servicio incluido tiene
> límites bajos.

### 5. Desplegar las Edge Functions

```bash
npx supabase functions deploy admin-users
npx supabase functions deploy send-reminder
```

`admin-users` administra las cuentas del equipo y `send-reminder` envía el
correo. Para que el recordatorio funcione:

```bash
npx supabase secrets set \
  RESEND_API_KEY=re_... \
  REMINDER_FROM_EMAIL=turnos@tu-dominio.com \
  REMINDER_FROM_NAME="En-silla"
```

El dominio del remitente debe estar verificado en Resend.

### 6. Crear la primera barbería

No hay registro público de barberías: cada alta pasa por un script con la clave
de servicio.

```bash
npm run db:create-shop -- \
  --slug mi-barberia \
  --name "Mi Barbería" \
  --admin-name "Nombre Apellido" \
  --admin-email admin@mi-barberia.com \
  --admin-password "una-clave-larga"
```

El script crea la barbería, un horario semanal por defecto y el primer
administrador activo. Imprime la ruta pública
`/reservar?barberia=mi-barberia`. Para modificar una barbería existente, repetir
con `--update` y solo los campos a cambiar.

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
    admin-users/         Cuentas del equipo, acotadas por barbería
    send-reminder/       Envío de recordatorios con Resend
scripts/                 Provisión, seed y smoke test
docs/                    Documentación de arquitectura y operación
```

---

## Funcionalidades

- **Búsqueda por nombre**: el visitante encuentra su barbería por nombre o slug.
  La RPC exige al menos dos caracteres y solo devuelve barberías activas.
- **Reserva pública** en pasos: servicio, barbero, día, horario y datos de
  contacto. La disponibilidad se calcula en Postgres.
- **Confirmación inmediata** con enlace único, resumen del turno, correo
  opcional para el recordatorio, descarga de calendario (`.ics`) y contacto por
  WhatsApp.
- **Recordatorio real por correo** con Resend, disponible desde la confirmación
  y desde el detalle de la cita en el panel.
- **Panel multi-barbería** con agenda diaria, alta y edición de citas, ficha de
  clientes con historial e ideas de corte, catálogo de servicios, estadísticas y
  ajustes de la barbería.
- **Aislamiento total**: cada barbería ve solo su equipo, sus clientes, sus
  turnos y sus notificaciones.
- **Roles**: `ADMIN` administra todo; `BARBER` ve su agenda y sus métricas.

---

## Seguridad en una frase

El visitante solo puede leer datos públicos de barberías activas y reservar a
través de funciones validadas; el personal solo ve su propia barbería por RLS; y
los cambios de rol, la activación de cuentas y el envío de correo pasan por Edge
Functions que verifican el rol real contra la base. Ver
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
