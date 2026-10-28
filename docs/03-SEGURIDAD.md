# 03 · Seguridad

## Principio rector

El navegador es hostil por definición. Cualquier persona puede abrir las
herramientas de desarrollo, leer el JavaScript, cambiar el estado de React o
llamar a la API de Supabase con la clave pública. Por eso:

1. **RLS** decide qué filas puede ver cada sesión.
2. Los **privilegios por columna** deciden qué campos puede escribir.
3. Las **RPC** encapsulan las operaciones que no deben hacerse con un `insert`
   directo.
4. La **Edge Function** es la única vía para cambios de rol y credenciales.

Si una regla solo existe en el frontend, no es una regla de seguridad: es una
sugerencia de interfaz.

## Modelo de amenazas

| Amenaza | Mitigación |
| --- | --- |
| Visitante intenta leer clientes o turnos | RLS: `anon` no tiene políticas sobre `clients` ni `appointments` |
| Usuario autenticado se asciende a administrador | `update` de `profiles` limitado a `name, phone, bio, color` |
| Barbero intenta ver turnos de otro barbero | Política de `select` con `is_staff()` y alcance por `barber_id` en consultas; el panel filtra por usuario |
| Cliente borra su historial al borrar un cliente | `on delete restrict` en `appointments` y `haircut_ideas`; borrado solo `ADMIN` |
| Se insertan turnos falsos o con precios manipulados | `insert` revocado; altas solo por RPC con precio tomado del catálogo |
| Se modifican horarios o precios de un turno | `update` limitado a `status`, `notes`, `reminder_sent_at` |
| Spam de reservas públicas | Máximo 3 reservas públicas por teléfono por hora |
| Se sobrescribe el nombre de un cliente existente | El `upsert` público conserva el nombre guardado |
| Se inyecta SQL o filtros mal formados | Consultas parametrizadas de PostgREST; la búsqueda escapa caracteres especiales |
| Se leen datos internos desde la confirmación pública | RPC devuelve solo nombre, teléfono del cliente, servicio, barbero y precio |
| Cuenta inactiva sigue entrando | `AuthProvider` cierra la sesión si el perfil está inactivo; RLS usa `current_app_role()` que exige `active = true` |
| Autoregistro crea un empleado | `handle_new_user` crea el perfil con `active = false`; además el registro debe estar cerrado en Supabase |
| Escalada por la Edge Function | Verifica JWT, perfil `ADMIN` activo, última cuenta admin y valida todos los campos |
| Fuga de la clave de servicio | Solo vive en `.env` local y en el entorno de Supabase; nunca en `NEXT_PUBLIC_*` |

## Matriz de acceso

### Tablas

| Tabla | `anon` | `authenticated` | Notas |
| --- | --- | --- | --- |
| `shop_setting` | lectura | lectura | Escritura solo `ADMIN` |
| `business_hours` | lectura | lectura | Escritura solo `ADMIN` |
| `services` | lectura de activos | lectura total | Escritura solo `ADMIN` |
| `profiles` | sin acceso | lectura si es personal | Edición propia limitada; `role`/`active` por Edge Function |
| `clients` | sin acceso | lectura/alta/edición si es personal | Borrado solo `ADMIN` |
| `appointments` | sin acceso | lectura y edición acotada | Alta por RPC; sin `insert` ni `delete` directo |
| `haircut_ideas` | sin acceso | lectura/escritura si es personal | FK restrict a cliente |
| `time_off` | sin acceso | lectura si es personal | Escritura propia o `ADMIN` |
| `notifications` | sin acceso | lectura y marcado propio | Sin `insert` |
| `barbers_public` (vista) | lectura | lectura | Solo datos públicos del equipo |

### Columnas escribibles por el cliente

| Tabla | Columnas permitidas |
| --- | --- |
| `profiles` | `name`, `phone`, `bio`, `color` |
| `appointments` | `status`, `notes`, `reminder_sent_at` |
| `clients` | todas (RLS restringe a personal) |
| `services` | todas (RLS restringe a `ADMIN`) |
| `shop_setting` | todas (RLS restringe a `ADMIN`) |
| `business_hours` | todas (RLS restringe a `ADMIN`) |
| `haircut_ideas` | todas (RLS restringe a personal) |
| `notifications` | `read_at` |

Cualquier columna fuera de esa lista está protegida por `revoke update` y
`grant update (columna)`.

## Autenticación

- Supabase Auth con correo y contraseña. No hay registro público.
- La sesión se guarda en el navegador (persistencia de Supabase). El token se
  renueva automáticamente.
- El perfil se carga después del login. Si no existe o está inactivo, se cierra
  la sesión.
- Contraseñas: mínimo 8 caracteres (Edge Function y configuración local de
  Supabase). No se almacenan ni se registran en el frontend.
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
   `role = ADMIN` y `active = true`. No confía en el cuerpo de la petición.
3. Valida nombre, correo, color, teléfono, bio y contraseña.
4. Impide dejar la instalación sin administradores activos.
5. Si el perfil falla después de crear el usuario de Auth, revierte la cuenta.
6. Devuelve mensajes en español sin datos internos.

La clave `SUPABASE_SERVICE_ROLE_KEY` solo existe en el entorno de Supabase
(secrets de la función) y en el `.env` de quien ejecuta scripts.

## Reserva pública endurecida

`create_public_booking`:

- Valida servicio activo, barbero activo, día abierto, horario y anticipación.
- Toma el precio del catálogo, nunca del navegador.
- Bloquea el día con `pg_advisory_xact_lock` para evitar carreras.
- Rechaza solapamientos y bloqueos (`time_off`).
- Normaliza el teléfono con el país configurado.
- Limita longitudes: nombre 80, correo 160, tipo de cabello 80, estilo 80,
  notas 500.
- No sobrescribe el nombre de un cliente existente; solo completa campos vacíos.
- Limita a 3 reservas públicas por teléfono en la última hora.
- Crea la notificación interna.

## Confirmación pública

`get_booking_confirmation(uuid)` devuelve:

```json
{
  "id": "...",
  "start_at": "...",
  "end_at": "...",
  "price_cents": 4500000,
  "status": "CONFIRMED",
  "client": { "name": "...", "phone": "..." },
  "service": { "name": "...", "duration_min": 45 },
  "barber": { "name": "..." }
}
```

El UUID es la credencial. No incluye correo del cliente, notas internas,
teléfono del barbero ni el historial. No permitir listados ni modificaciones
desde este endpoint.

## Gestión de secretos

| Secreto | Dónde vive | Quién lo usa |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Build y navegador | Público por diseño |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build y navegador | Público por diseño; RLS lo limita |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` local + secrets de la función | Scripts y Edge Function |
| `SUPABASE_DB_PASSWORD` | `.env` local | Migraciones por conexión directa |
| Secrets de GitHub | Repositorio > Settings > Secrets | `deploy.yml` |

Reglas:

- Nunca prefijar un secreto con `NEXT_PUBLIC_`.
- Nunca pegar la clave de servicio en una consulta SQL, un issue o un log.
- Rotar la clave de servicio si se filtró (Project Settings > API > Rotate).
- El `.env` está ignorado por Git; `.env.example` solo contiene marcadores.

## Checklist antes de operar con clientes reales

- [ ] Registro público desactivado en Supabase Auth (Email > Allow new users to
      sign up).
- [ ] Confirmación de correo activada si se van a crear cuentas reales.
- [ ] Contraseñas de demostración cambiadas o cuentas demo eliminadas.
- [ ] `NEXT_PUBLIC_DEMO_MODE` en `false`.
- [ ] Migraciones aplicadas, incluida `20261028000000_security_hardening.sql`.
- [ ] `npm run smoke:supabase` en verde contra el proyecto real.
- [ ] Verificar en SQL que `profiles` no tenga `update` de tabla completa.
- [ ] Autenticación en dos pasos en la cuenta de Supabase y en GitHub.
- [ ] Copia de seguridad automática de Supabase activa (plan de pago) o
      exportación periódica.
- [ ] Una persona responsable de la cuenta de Supabase identificada.

## Verificación rápida en SQL

```sql
-- Debe mostrar solo las columnas permitidas para authenticated.
select grantee, column_name
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'profiles'
  and privilege_type = 'UPDATE'
  and grantee = 'authenticated';

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
```

## Riesgos residuales asumidos

1. **Enlace de confirmación sin vencimiento.** El UUID funciona como credencial
   permanente. Si se comparte, cualquiera con el enlace ve el turno. No se
   puede enumerar. Mitigación: no registrar el enlace en analítica ni en chats
   grupales.
2. **Sin captcha.** El freno por teléfono y el límite de Supabase Auth cubren el
   caso normal. Si aparece spam coordinado, agregar Turnstile en `/reservar`.
3. **CORS abierto en la Edge Function.** Cualquier origen puede invocarla, pero
   necesita un JWT de administrador. Se puede restringir el origen si el
   despliegue tiene un dominio fijo.
4. **El panel confía en el filtrado del cliente para la experiencia.** La
   seguridad real está en RLS; un barbero que llame a la API directamente
   obtiene lo que las políticas permiten, que es el conjunto del personal. Si se
   necesita aislamiento estricto entre barberos, hay que endurecer las políticas
   de `select` por `barber_id`.
5. **Sin auditoría de cambios.** No hay tabla de historial. Para operaciones
   sensibles, Supabase conserva logs de API según el plan contratado.

## Respuesta a incidentes

1. Rotar `SUPABASE_SERVICE_ROLE_KEY` y las claves de GitHub.
2. Revisar `auth.users` y `profiles` en busca de cuentas desconocidas o roles
   alterados.
3. Revisar `appointments` creados fuera del horario o con precios incoherentes.
4. Si se filtró un enlace de confirmación, contactar al cliente afectado.
5. Aplicar la corrección como una migración nueva y volver a correr el smoke
   test.
6. Documentar qué pasó y qué se cambió en `docs/04-OPERACION.md`.
