# En-silla

Reservas online y panel de gestión para una barbería. El cliente reserva desde
el sitio público; el equipo administra agenda, clientes, servicios y estadísticas
desde un panel privado.

El sistema no tiene servidor propio: el frontend es un sitio estático de
Next.js y toda la lógica de negocio vive en Supabase (Postgres + RLS + RPC).
Eso mantiene el costo operativo bajo y el despliegue simple, sin descuidar la
seguridad: **cada regla crítica se valida en la base de datos, no en el
navegador**.

---

## Stack

| Capa | Tecnología |
| --- | --- |
| Interfaz | Next.js 16 (App Router, export estático), React 19, TypeScript estricto |
| Estilos | Tailwind CSS v4 (tokens en `src/app/globals.css`) |
| Datos y autenticación | Supabase (Postgres 17, Auth, RLS, RPC, Edge Functions) |
| Despliegue | GitHub Pages (sitio estático) + GitHub Actions |
| Fechas y zonas horarias | `date-fns` + `date-fns-tz` |

Sin servidor Node en producción, sin rutas de API, sin middleware. Las
operaciones sensibles se resuelven con funciones SQL `security definer` y con
una Edge Function que guarda la clave de servicio.

---

## Puesta en marcha (15 minutos)

### 1. Requisitos

- Node.js 22 o superior.
- Una cuenta de Supabase y el CLI (`npx supabase`).
- Git.

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

### 4. Crear el esquema

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Las migraciones de `supabase/migrations/` son la única fuente de verdad del
esquema. No se editan una vez aplicadas: los cambios se agregan como una
migración nueva.

### 5. Cargar datos de demostración (opcional)

```bash
npm run db:seed:supabase
```

Crea la barbería, servicios, horarios, clientes de ejemplo y tres usuarios:

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | `admin@ensilla.app` | `admin123` |
| Barbero | `bruno@ensilla.app` | `barber123` |
| Barbero | `valentina@ensilla.app` | `barber123` |

Cambiar o eliminar estas cuentas antes de operar con clientes reales.

### 6. Desarrollo

```bash
npm run dev
```

Sitio público: <http://localhost:3000>. Panel: `/login` y luego `/panel`.

### 7. Verificar

```bash
npm run typecheck
npm run lint
npm run build
```

Y, contra un Supabase real:

```bash
npm run smoke:supabase
```

---

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Export estático a `out/` |
| `npm start` | Sirve `out/` localmente para probar el build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir archivos |
| `npm run db:seed:supabase` | Carga datos de demostración vía API |
| `npm run smoke:supabase` | Prueba de humo de RPC y permisos |

---

## Estructura

```text
src/
  app/
    (public)/            Sitio público, reserva y confirmación
    login/               Acceso del equipo
    panel/               Panel privado (agenda, citas, clientes, ajustes...)
    error.tsx            Frontera de error global
    not-found.tsx        Página 404
  components/            Componentes de interfaz reutilizables
  lib/
    data/                Capa de acceso a datos (única puerta a Supabase)
    booking.ts           Alta de turnos vía RPC
    availability.ts      Consulta de horarios disponibles
    agenda.ts            Agenda diaria y resumen
    stats.ts             Métricas del panel
    datetime.ts          Conversión y formato con zona horaria
    phone.ts             Normalización de teléfonos (espejo del SQL)
supabase/
  migrations/            Esquema, RLS, RPC y endurecimiento
  functions/admin-users/ Edge Function para cuentas del equipo
scripts/                 Seed y smoke test contra Supabase
docs/                    Documentación de arquitectura y operación
```

---

## Funcionalidades

- **Reserva pública** en pasos: servicio, barbero, día, horario y datos de
  contacto. La disponibilidad se calcula en Postgres, así el navegador nunca
  ve turnos de otras personas.
- **Confirmación** con enlace único, resumen del turno, descarga de calendario
  (`.ics`) y contacto por WhatsApp.
- **Panel** con agenda diaria, alta y edición de citas, ficha de clientes con
  historial e ideas de corte, catálogo de servicios, estadísticas y ajustes de
  la barbería.
- **Notificaciones internas** cuando entra una reserva.
- **Roles**: `ADMIN` administra todo; `BARBER` ve su agenda y sus métricas.

---

## Seguridad en una frase

El cliente solo puede leer lo que es público y escribir a través de funciones
validadas; los cambios de rol, la activación de cuentas y las operaciones
administrativas pasan por una Edge Function que verifica el rol real contra la
base. Ver [docs/03-SEGURIDAD.md](docs/03-SEGURIDAD.md).

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
El software conserva esa memoria y evita que la operación dependa de una sola
persona. Por eso la documentación y las migraciones son parte del producto, no
un extra.

Los valores por defecto (Bogotá, COP, español de Colombia) se pueden cambiar
desde **Panel > Ajustes** sin tocar código.
