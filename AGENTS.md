# En-silla — notas para agentes

Aplicación de reservas y panel para una barbería. Español de Colombia, precios
en centavos y fechas en la zona horaria de la barbería.

Stack real: **Next.js 16 con export estático** (`output: "export"`), React 19,
TypeScript estricto, Tailwind v4 y **Supabase** como backend completo. No hay
Prisma, ni servidor Node, ni rutas de API, ni middleware, ni Server Actions.
Todo el código de `src/app` corre en el navegador.

La documentación de referencia está en `docs/`. Este archivo es el resumen
operativo para quien edita el código.

## Comandos

- Instalar: `npm install`.
- Desarrollo: `npm run dev` (3000).
- Verificar siempre en este orden: `npm run typecheck`, `npm run lint`,
  `npm run build`. No hay tests automatizados; el build más el recorrido manual
  de rutas es la verificación mínima.
- Build local servido: `npm run build` y `npm start` (sirve `out/`).
- Base de datos: `npx supabase link --project-ref <ref>` y
  `npx supabase db push`.
- Datos demo: `npm run db:seed:supabase` (usa la API y crea usuarios de Auth).
- Humo contra Supabase real: `npm run smoke:supabase`.
- `allowScripts` en `package.json` es necesario para `unrs-resolver`; no borrar.
  `npm install` avisa que `eslint@9` está deprecado: es esperado.

## Arquitectura

- Rutas públicas en `src/app/(public)`: `/`, `/reservar`,
  `/reservar/confirmacion`.
- Login en `src/app/login`; todo el resto vive bajo `src/app/panel`.
- No hay `middleware` ni `proxy`: la protección real es RLS en Postgres. El
  panel redirige a `/login` cuando no hay perfil, pero eso es solo experiencia
  de usuario.
- La única puerta de lectura/escritura de datos es `src/lib/data/`. Ninguna
  página debe importar `supabase` directamente para tablas; sí puede usar
  `src/lib/booking.ts` y `src/lib/availability.ts` para RPC de negocio.
- `src/lib/data/index.ts` es el barrel público. Los módulos internos
  (`rows`, `mappers`, `shop`, `catalog`, `profiles`, `clients`,
  `appointments`, `notifications`) se importan solo entre ellos.
- Toda vista usa `useAsync` (`src/lib/use-async.ts`): devuelve `data`, `loading`,
  `error` y `reload`. Las páginas deben mostrar `error` con `<Flash>`; no dejar
  spinners infinitos.
- La autenticación es Supabase Auth. `AuthProvider` (`src/lib/auth-context.tsx`)
  carga el perfil y cierra la sesión si el perfil no existe o está inactivo.

## Reglas de negocio que no se pueden romper

- **Alta de turnos**: solo por RPC. `create_public_booking` para el sitio
  público y `create_staff_appointment` para el panel. Validan horario, precio,
  solapamiento (restricción `exclude using gist`), bloqueos y anticipación.
- **Actualización de turnos**: desde el panel solo se pueden escribir
  `status`, `notes` y `reminder_sent_at`. El resto de columnas está revocado a
  nivel de columna. No agregar formularios que escriban otras columnas.
- **Perfiles**: `role` y `active` no se cambian por `update` directo. Van por la
  Edge Function `admin-users` (acciones `create`, `update`, `toggle`), que
  verifica que quien invoca sea `ADMIN` activo y que quede al menos un
  administrador activo.
- **Borrado de clientes**: solo administradores. `appointments.client_id` y
  `haircut_ideas.client_id` usan `on delete restrict`: un cliente con historial
  no se puede borrar.
- **Reserva pública**: nunca sobrescribe el nombre de un cliente existente,
  normaliza el teléfono con el país configurado, limita longitudes y acepta
  como máximo 3 reservas públicas por teléfono por hora.
- **Teléfonos**: `src/lib/phone.ts` y `public.normalize_phone(text, text)` deben
  producir el mismo resultado. Si cambia una, cambiar la otra.
- **Confirmación pública**: se lee por RPC `get_booking_confirmation`; el UUID
  funciona como credencial. No agregar teléfono del barbero ni datos internos.
- **Notificaciones**: las crea el backend (RPC `security definer`). El cliente
  solo puede leer las propias y marcarlas como leídas.

## Convenciones de dominio

- Zona horaria, moneda, idioma y país de WhatsApp salen de `shop_setting`
  (`fetchShop()`). Usar `src/lib/datetime.ts` para cualquier conversión o
  formato; nunca `new Date().toLocaleString()` con la zona del navegador.
- Dinero en centavos (`priceCents`) formateado con `formatMoney`.
- Estados de turno y etiquetas en `src/lib/constants.ts`. El tipo
  `AppointmentStatus` se reexporta desde `src/lib/types.ts`.
- Origen del turno: `PUBLIC` o `STAFF`.
- Paginación: PostgREST devuelve como máximo 1000 filas. Para totales o
  históricos usar `selectAllPages` (siempre con `order` estable).

## Interfaz

- Tailwind v4 sin `tailwind.config`: tokens y clases compartidas (`.card`,
  `.card-pad`, `.input`, `.select`, `.textarea`, `.btn-*`, `.chip`, `.badge`,
  `.container-page`) están en `src/app/globals.css`.
- Paleta: `ink`, `cream`, `sand`, `copper`, `sage`, `plum`, `amber`.
- Tipografía de títulos: Georgia del sistema. No agregar `next/font/google`.
- `lucide-react` v1 no incluye iconos de marca; usar genéricos (`AtSign`).
- El texto de la interfaz es español rioplatense-colombiano neutro ("reservá",
  "turno", "barbería"). Mantener ese registro.
- Las páginas que usan `useSearchParams` deben estar dentro de `<Suspense>`.

## Comentarios y estilo

- Comentarios en español, sin emojis, explicando el **porqué** y los
  invariantes; no traducir el código línea por línea.
- Evitar código muerto o utilidades "por si acaso". Si algo no se usa, se borra.
- TypeScript estricto: no usar `any`; normalizar las respuestas de Supabase con
  los helpers de `src/lib/data/rows.ts`.
- Los errores de PostgREST se traducen con `fail()`; no mostrar mensajes
  técnicos al usuario.

## Despliegue y entorno

- `NEXT_PUBLIC_BASE_PATH` debe ser `/<nombre-del-repositorio>` en GitHub Pages.
- `deploy.yml` se ejecuta a mano (`workflow_dispatch`); `ci.yml` verifica cada
  push y pull request a `main`.
- El registro público de Supabase Auth debe estar desactivado. Las cuentas se
  crean desde el panel. Si se habilita, los usuarios nuevos nacen inactivos por
  la migración de endurecimiento.
- `NEXT_PUBLIC_DEMO_MODE` controla las credenciales de ejemplo del login. En
  producción debe ser `false`.

## Trampas conocidas

- No editar migraciones ya aplicadas: agregar una nueva en
  `supabase/migrations/`.
- No otorgar `update` de tabla completa sobre `profiles` ni `appointments`;
  rompe el modelo de privilegios por columna.
- No leer `clients` desde el sitio público: no hay política para `anon`.
- El enlace de confirmación es la única credencial del cliente: no registrar
  esos UUID en logs ni en analytics.
- El build estático falla si una página usa APIs exclusivas del servidor.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
