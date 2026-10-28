# En-silla — notas para agentes

Marketplace de reservas para barberías. Español de Colombia, precios en centavos
y fechas en la zona horaria de cada barbería.

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
- Nueva barbería: `npm run db:create-shop -- --slug ... --name ... --admin-email ...`
  (usa la clave de servicio; `--update` para modificarla).
- Datos demo: `npm run db:seed:supabase` (destructivo solo con la barbería
  `en-silla`; crea usuarios de Auth).
- Humo contra Supabase real: `npm run smoke:supabase`. El envío real de correo
  es opt-in con `SMOKE_SEND_REMINDER=true`.
- `allowScripts` en `package.json` es necesario para `unrs-resolver`; no borrar.
  `npm install` avisa que `eslint@9` está deprecado: es esperado.

## Arquitectura

- Rutas públicas en `src/app/(public)`: `/`, `/reservar`,
  `/reservar/confirmacion`.
- `/` muestra el buscador; `/reservar?barberia=<slug>` resuelve la barbería.
  Sin slug válido se vuelve al buscador, no a un error técnico.
- Login en `src/app/login`; recuperación de contraseña en `/recuperar` y
  `/restablecer`; todo el resto vive bajo `src/app/panel`.
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
- La recuperación de contraseña usa `resetPasswordForEmail` y procesa el enlace
  a mano en `/restablecer`, porque el cliente tiene `detectSessionInUrl: false`.
  La URL de retorno incluye el `basePath` y debe estar registrada en
  Authentication > URL Configuration como `.../restablecer/`.

## Multi-barbería

- `shops` es la raíz del tenant. `profiles.shop_id` define a qué barbería
  pertenece cada usuario.
- Todas las tablas operativas (`business_hours`, `services`, `clients`,
  `appointments`, `time_off`, `haircut_ideas`, `notifications`) llevan
  `shop_id` con FK `on delete restrict`.
- `current_shop_id()` devuelve la barbería del perfil activo y es la base de las
  políticas RLS. No reemplazarla por un `shop_id` que venga del navegador.
- `is_active_shop(uuid)` limita lo que `anon` puede leer.
- En el panel, `fetchShop()` llama a `current_shop`: no acepta `shopId` por
  parámetro. En el sitio público, `fetchShopBySlug()` y `searchShops()` cubren
  la resolución y el buscador.
- La búsqueda exige mínimo 2 caracteres, usa `unaccent`, devuelve como máximo 12
  barberías activas y nunca un directorio completo.
- No hay registro público de barberías: se provisionan con
  `scripts/create-shop.mjs` y la clave de servicio.

## Reglas de negocio que no se pueden romper

- **Alta de turnos**: solo por RPC. `create_public_booking` para el sitio
  público (recibe `p_shop_id`) y `create_staff_appointment` para el panel
  (deduce la barbería con `current_shop_id()`). Validan horario, precio,
  solapamiento (restricción `exclude using gist`), bloqueos y anticipación.
- **Actualización de turnos**: desde el panel solo se pueden escribir
  `status`, `notes` y `reminder_sent_at`. El resto de columnas está revocado a
  nivel de columna. No agregar formularios que escriban otras columnas.
- **Perfiles**: `role`, `active` y `shop_id` no se cambian por `update` directo.
  Van por la Edge Function `admin-users` (acciones `create`, `update`,
  `toggle`), que verifica que quien invoca sea `ADMIN` activo de la misma
  barbería y que quede al menos un administrador activo en ella.
- **Borrado de clientes**: solo administradores. `appointments.client_id` y
  `haircut_ideas.client_id` usan `on delete restrict`: un cliente con historial
  no se puede borrar.
- **Reserva pública**: nunca sobrescribe el nombre de un cliente existente,
  normaliza el teléfono con el país configurado, limita longitudes y acepta
  como máximo 3 reservas públicas por teléfono y barbería por hora.
- **Teléfonos**: `src/lib/phone.ts` y `public.normalize_phone(text, text)` deben
  producir el mismo resultado. Si cambia una, cambiar la otra.
- **Confirmación pública**: se lee por RPC `get_booking_confirmation`; el UUID
  funciona como credencial. No agregar teléfono del barbero ni datos internos.
  El correo del cliente se expone solo como `hasEmail`.
- **Correo posterior**: `set_booking_email` solo acepta reservas `PENDING` o
  `CONFIRMED`, únicamente completa un correo faltante y nunca devuelve el correo
  guardado.
- **Recordatorios**: solo por la Edge Function `send-reminder`, con enfriamiento
  de 2 minutos y un único destinatario. El navegador nunca ve el correo ni la
  clave de Resend.
- **Notificaciones**: las crea el backend (RPC `security definer`). El cliente
  solo puede leer las propias y marcarlas como leídas.

## Convenciones de dominio

- Zona horaria, moneda, idioma y país de WhatsApp salen de la barbería
  (`fetchShop()` en el panel, `fetchShopBySlug()` en el sitio público). Usar
  `src/lib/datetime.ts` para cualquier conversión o formato; nunca
  `new Date().toLocaleString()` con la zona del navegador.
- `FALLBACK_SHOP` tiene `id` vacío: sirve para renderizar, nunca para escribir.
- Dinero en centavos (`priceCents`) formateado con `formatMoney`.
- Estados de turno y etiquetas en `src/lib/constants.ts`. El tipo
  `AppointmentStatus` se reexporta desde `src/lib/types.ts`.
- Origen del turno: `PUBLIC` o `STAFF`.
- Paginación: PostgREST devuelve como máximo 1000 filas. Para totales o
  históricos usar `selectAllPages` (siempre con `order` estable).
- Nombres de tabla en plural, columnas en `snake_case`; el frontend las pasa a
  `camelCase` en `src/lib/data/mappers.ts`.

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
- La confirmación debe ofrecer "Enviar recordatorio" y "Cerrar". El recordatorio
  se habilita cuando la reserva tiene correo.

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
- `deploy.yml` se dispara con cada push a `main` (y a mano con
  `workflow_dispatch`); `ci.yml` verifica cada push y pull request a `main`. La
  migración de Supabase se aplica antes del merge, porque el push publica el
  frontend.
- El registro público de Supabase Auth debe estar desactivado. Las cuentas se
  crean desde el panel o con `create-shop`. Si se habilita, los usuarios nuevos
  nacen inactivos por la migración de endurecimiento.
- `NEXT_PUBLIC_DEMO_MODE` controla las credenciales de ejemplo del login. En
  producción debe ser `false`.
- `send-reminder` necesita `RESEND_API_KEY`, `REMINDER_FROM_EMAIL` y,
  opcionalmente, `REMINDER_FROM_NAME` en los secrets de Supabase. El remitente
  debe pertenecer a un dominio verificado en Resend.
- La clave de servicio y la de Resend nunca llevan prefijo `NEXT_PUBLIC_`.

## Trampas conocidas

- No editar migraciones ya aplicadas: agregar una nueva en
  `supabase/migrations/`.
- No otorgar `update` de tabla completa sobre `profiles` ni `appointments`;
  rompe el modelo de privilegios por columna.
- No agregar una tabla del tenant sin `shop_id`, RLS y política por
  `current_shop_id()`.
- No leer `clients` desde el sitio público: no hay política para `anon`.
- No confiar en un `shop_id` recibido del navegador para autorizar: las RPC
  vuelven a validar servicio, barbero y turno.
- El enlace de confirmación es la única credencial del cliente: no registrar
  esos UUID en logs ni en analytics.
- No activar `detectSessionInUrl` sin quitar antes el procesamiento manual de
  `/restablecer`: los tokens de recuperación se aplicarían dos veces.
- El enlace de recuperación es de un solo uso y vence en una hora; no mostrarlo
  en logs ni reutilizarlo en pruebas con datos reales.
- El build estático falla si una página usa APIs exclusivas del servidor.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
