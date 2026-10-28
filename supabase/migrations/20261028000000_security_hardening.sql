-- En-silla · Endurecimiento de seguridad y corrección de reglas de negocio.
--
-- CONTEXTO
-- La migración inicial (20261027194500_init.sql) es inmutable: ya está aplicada
-- en producción. Este archivo corrige los hallazgos de la auditoría sin tocar
-- el historial. Se puede aplicar sobre bases nuevas y sobre bases existentes.
--
-- CAMBIOS
-- 1. Normalización de teléfonos parametrizada por país (antes estaba fija a 54).
-- 2. Privilegios a nivel de columna: un usuario ya no puede auto-asignarse
--    `role` ni `active` en `profiles` (escalada de privilegios crítica).
-- 3. `appointments` deja de ser escribible directamente por el cliente: toda
--    alta pasa por las RPC y toda actualización se limita a columnas seguras.
-- 4. `clients` separa lectura/escritura de borrado (borrado solo administrador)
--    y deja de borrar en cascada el historial de turnos.
-- 5. Reserva pública: no pisa el nombre de un cliente existente, limita la
--    longitud de los campos y aplica un freno anti-abuso por teléfono.
-- 6. La confirmación pública deja de exponer el teléfono del barbero.
-- 7. Las funciones internas dejan de ser ejecutables por `anon`/`authenticated`.
-- 8. Un usuario que se registre por su cuenta queda INACTIVO hasta que un
--    administrador lo habilite (antes entraba como barbero activo).

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. Normalización de teléfonos
-- ---------------------------------------------------------------------------

-- Deja solo dígitos y quita el prefijo internacional y el 0 de marcado local.
-- El código de país se toma de la configuración de la barbería, de modo que el
-- producto deja de estar atado a Argentina.
create or replace function public.normalize_phone(
  p_phone text,
  p_country_code text default '57'
)
returns text
language plpgsql
immutable
as $$
declare
  v_digits text;
  v_cc text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_cc := regexp_replace(coalesce(p_country_code, '57'), '\D', '', 'g');

  -- Prefijo internacional de marcado (00) o 0 de larga distancia.
  v_digits := regexp_replace(v_digits, '^0+', '');

  -- Código de país solo si al quitarlo queda un número plausible.
  if length(v_cc) > 0
     and left(v_digits, length(v_cc)) = v_cc
     and length(v_digits) - length(v_cc) >= 8 then
    v_digits := substr(v_digits, length(v_cc) + 1);
  end if;

  -- 0 de marcado local que puede quedar después del código de país.
  v_digits := regexp_replace(v_digits, '^0', '');

  return v_digits;
end;
$$;

-- Función de uso interno: no se expone a los clientes de la API.
revoke all on function public.normalize_phone(text, text) from public;
revoke all on function public.normalize_phone(text, text) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Privilegios de columna en `profiles`
-- ---------------------------------------------------------------------------
-- Sin esto, cualquier usuario autenticado podía ejecutar
--   update profiles set role = 'ADMIN', active = true where id = auth.uid()
-- y convertirse en administrador. La política RLS permitía la fila; el
-- privilegio de tabla permitía todas las columnas.
--
-- Regla: el cliente solo edita los datos de presentación. `role` y `active`
-- se cambian exclusivamente desde la Edge Function `admin-users`, que usa
-- service_role y valida que quien invoca sea administrador.

revoke update on public.profiles from anon, authenticated;
grant update (name, phone, bio, color) on public.profiles to authenticated;

-- El borrado de perfiles deja de estar disponible desde el cliente: un perfil
-- está ligado a un usuario de Auth y a turnos históricos.
drop policy if exists profiles_delete_admin on public.profiles;
revoke delete on public.profiles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Privilegios de columna en `appointments`
-- ---------------------------------------------------------------------------
-- Las altas deben pasar por `create_public_booking` / `create_staff_appointment`
-- para validar horarios, precios y solapamientos. Las actualizaciones desde el
-- panel se limitan al estado, las notas y el recordatorio.

revoke insert, update, delete on public.appointments from anon, authenticated;
grant update (status, notes, reminder_sent_at) on public.appointments to authenticated;

-- Las políticas de INSERT/DELETE directo quedan sin efecto y se eliminan para
-- que el modelo de permisos sea explícito.
drop policy if exists appointments_staff_insert on public.appointments;
drop policy if exists appointments_staff_delete on public.appointments;

-- ---------------------------------------------------------------------------
-- 4. Políticas de `clients` y borrado en cascada
-- ---------------------------------------------------------------------------

drop policy if exists clients_staff_all on public.clients;

drop policy if exists clients_staff_select on public.clients;
create policy clients_staff_select on public.clients
for select to authenticated using (public.is_staff());

drop policy if exists clients_staff_insert on public.clients;
create policy clients_staff_insert on public.clients
for insert to authenticated with check (public.is_staff());

drop policy if exists clients_staff_update on public.clients;
create policy clients_staff_update on public.clients
for update to authenticated
using (public.is_staff()) with check (public.is_staff());

-- Borrar un cliente elimina su historial de turnos: solo administradores.
drop policy if exists clients_admin_delete on public.clients;
create policy clients_admin_delete on public.clients
for delete to authenticated using (public.is_admin());

revoke insert, update, delete on public.clients from anon, authenticated;
grant insert, update on public.clients to authenticated;
grant delete on public.clients to authenticated; -- la política restringe a admin

-- El historial de turnos y las ideas ya no se pierden al borrar un cliente.
alter table public.appointments
  drop constraint if exists appointments_client_id_fkey;
alter table public.appointments
  add constraint appointments_client_id_fkey
  foreign key (client_id) references public.clients(id) on delete restrict;

alter table public.haircut_ideas
  drop constraint if exists haircut_ideas_client_id_fkey;
alter table public.haircut_ideas
  add constraint haircut_ideas_client_id_fkey
  foreign key (client_id) references public.clients(id) on delete restrict;

-- ---------------------------------------------------------------------------
-- 5. Notificaciones: solo las crean las RPC (security definer) o el backend
-- ---------------------------------------------------------------------------

drop policy if exists notifications_insert_staff on public.notifications;
revoke insert on public.notifications from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Reserva pública endurecida
-- ---------------------------------------------------------------------------
-- Reglas nuevas:
--   - El nombre de un cliente existente nunca se sobrescribe desde el sitio
--     público (evita que cualquiera cambie el nombre de otra persona).
--   - El teléfono se normaliza con el país configurado por la barbería.
--   - Todos los campos de texto tienen tope de longitud.
--   - Máximo de reservas públicas por teléfono en una hora (anti-abuso).

create or replace function public.create_public_booking(
  p_service_id uuid,
  p_barber_id uuid,
  p_start timestamptz,
  p_name text,
  p_phone text,
  p_email text default null,
  p_hair_type text default null,
  p_preferred_style text default null,
  p_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_shop public.shop_setting%rowtype;
  v_service_name text;
  v_service_duration integer;
  v_service_price integer;
  v_end timestamptz;
  v_day_key text;
  v_buffer integer;
  v_tz text;
  v_phone text;
  v_name text := nullif(trim(p_name), '');
  v_email text := nullif(trim(p_email), '');
  v_hair_type text := nullif(trim(p_hair_type), '');
  v_preferred_style text := nullif(trim(p_preferred_style), '');
  v_notes text := nullif(trim(p_notes), '');
  v_client_id uuid;
  v_client_name text;
  v_appointment_id uuid;
  v_recent integer;
begin
  select * into v_shop from public.shop_setting where id = 1;
  if not found then
    raise exception 'La barbería todavía no está configurada.';
  end if;

  select service_name, service_duration_min, service_price_cents, shop_timezone, shop_buffer_min
  into v_service_name, v_service_duration, v_service_price, v_tz, v_buffer
  from public.booking_validate(p_barber_id, p_service_id, p_start, true);

  -- Validación de entrada: nombre, contacto y topes de longitud.
  if v_name is null or length(v_name) < 2 then
    raise exception 'Ingresá tu nombre completo.';
  end if;
  if length(v_name) > 80 then
    raise exception 'El nombre es demasiado largo.';
  end if;
  if v_email is not null and (length(v_email) > 160 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Ingresá un correo válido.';
  end if;
  if v_hair_type is not null and length(v_hair_type) > 80 then
    raise exception 'El tipo de cabello es demasiado largo.';
  end if;
  if v_preferred_style is not null and length(v_preferred_style) > 80 then
    raise exception 'El estilo preferido es demasiado largo.';
  end if;
  if v_notes is not null and length(v_notes) > 500 then
    raise exception 'Las notas son demasiado largas.';
  end if;

  v_phone := public.normalize_phone(p_phone, v_shop.whatsapp_country_code);
  if length(v_phone) < 6 or length(v_phone) > 20 then
    raise exception 'Ingresá un teléfono válido.';
  end if;

  v_day_key := to_char((p_start at time zone v_tz)::date, 'YYYY-MM-DD');
  v_end := p_start + make_interval(mins => v_service_duration);

  perform pg_advisory_xact_lock(hashtext(p_barber_id::text), hashtext(v_day_key));

  if exists (
    select 1 from public.appointments a
    where a.barber_id = p_barber_id
      and a.status in ('PENDING', 'CONFIRMED', 'COMPLETED')
      and a.start_at < v_end + make_interval(mins => v_buffer)
      and a.end_at > p_start - make_interval(mins => v_buffer)
  ) then
    raise exception 'Ese horario ya está ocupado. Elegí otro turno.';
  end if;

  if exists (
    select 1 from public.time_off t
    where (t.user_id is null or t.user_id = p_barber_id)
      and t.start_at < v_end
      and t.end_at > p_start
  ) then
    raise exception 'El barbero no está disponible en ese horario.';
  end if;

  -- Alta o actualización del cliente. El nombre existente se conserva: el
  -- visitante solo puede completar los datos que falten.
  insert into public.clients (name, phone, email, hair_type, preferred_style)
  values (v_name, v_phone, v_email, v_hair_type, v_preferred_style)
  on conflict (phone) do update set
    email = coalesce(excluded.email, public.clients.email),
    hair_type = coalesce(excluded.hair_type, public.clients.hair_type),
    preferred_style = coalesce(excluded.preferred_style, public.clients.preferred_style),
    updated_at = now()
  returning id, name into v_client_id, v_client_name;

  -- Freno anti-abuso: máximo 3 reservas públicas por teléfono en la última hora.
  select count(*) into v_recent
  from public.appointments a
  where a.client_id = v_client_id
    and a.source = 'PUBLIC'
    and a.created_at > now() - interval '1 hour';

  if v_recent >= 3 then
    raise exception 'Recibimos varias reservas con este teléfono. Esperá unos minutos o comunicate con la barbería.';
  end if;

  begin
    insert into public.appointments (
      client_id, barber_id, service_id, start_at, end_at, status, price_cents, notes, source
    ) values (
      v_client_id, p_barber_id, p_service_id, p_start, v_end, 'CONFIRMED',
      v_service_price, v_notes, 'PUBLIC'
    )
    returning id into v_appointment_id;
  exception when exclusion_violation then
    raise exception 'Ese horario ya está ocupado. Elegí otro turno.';
  end;

  insert into public.notifications (user_id, title, body, href)
  values (
    p_barber_id,
    'Nuevo turno reservado',
    v_client_name || ' reservó ' || v_service_name || ' para el '
      || to_char(p_start at time zone v_tz, 'DD/MM/YYYY HH24:MI') || '.',
    '/panel/agenda?date=' || v_day_key
  );

  return v_appointment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Alta de turnos desde el panel: misma normalización de teléfono
-- ---------------------------------------------------------------------------

create or replace function public.create_staff_appointment(
  p_client_id uuid,
  p_client_name text,
  p_client_phone text,
  p_client_email text,
  p_barber_id uuid,
  p_service_id uuid,
  p_start timestamptz,
  p_status text default 'CONFIRMED',
  p_notes text default null,
  p_source text default 'STAFF'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_shop public.shop_setting%rowtype;
  v_service_duration integer;
  v_service_price integer;
  v_end timestamptz;
  v_day_key text;
  v_buffer integer;
  v_tz text;
  v_phone text;
  v_name text;
  v_client_id uuid := p_client_id;
  v_status text := case when p_status = 'PENDING' then 'PENDING' else 'CONFIRMED' end;
  v_appointment_id uuid;
begin
  if not public.is_staff() then
    raise exception 'No tenés permiso para crear turnos.';
  end if;

  if not public.is_admin() and p_barber_id <> auth.uid() then
    raise exception 'No podés crear turnos para otro barbero.';
  end if;

  select * into v_shop from public.shop_setting where id = 1;
  if not found then
    raise exception 'La barbería todavía no está configurada.';
  end if;

  select service_duration_min, service_price_cents, shop_timezone, shop_buffer_min
  into v_service_duration, v_service_price, v_tz, v_buffer
  from public.booking_validate(p_barber_id, p_service_id, p_start, false);

  v_day_key := to_char((p_start at time zone v_tz)::date, 'YYYY-MM-DD');
  v_end := p_start + make_interval(mins => v_service_duration);

  perform pg_advisory_xact_lock(hashtext(p_barber_id::text), hashtext(v_day_key));

  if v_client_id is null then
    v_phone := public.normalize_phone(p_client_phone, v_shop.whatsapp_country_code);
    v_name := nullif(trim(p_client_name), '');
    if v_name is null or length(v_name) < 2 or length(v_name) > 80 then
      raise exception 'Indicá el nombre del cliente.';
    end if;
    if length(v_phone) < 6 or length(v_phone) > 20 then
      raise exception 'Indicá un teléfono válido.';
    end if;

    insert into public.clients (name, phone, email)
    values (v_name, v_phone, nullif(trim(p_client_email), ''))
    on conflict (phone) do update set
      name = excluded.name,
      email = coalesce(excluded.email, public.clients.email),
      updated_at = now()
    returning id into v_client_id;
  else
    perform 1 from public.clients where id = v_client_id;
    if not found then
      raise exception 'El cliente no existe.';
    end if;
  end if;

  if exists (
    select 1 from public.appointments a
    where a.barber_id = p_barber_id
      and a.status in ('PENDING', 'CONFIRMED', 'COMPLETED')
      and a.start_at < v_end + make_interval(mins => v_buffer)
      and a.end_at > p_start - make_interval(mins => v_buffer)
  ) then
    raise exception 'Ese horario ya está ocupado. Elegí otro turno.';
  end if;

  if exists (
    select 1 from public.time_off t
    where (t.user_id is null or t.user_id = p_barber_id)
      and t.start_at < v_end
      and t.end_at > p_start
  ) then
    raise exception 'El barbero no está disponible en ese horario.';
  end if;

  begin
    insert into public.appointments (
      client_id, barber_id, service_id, start_at, end_at, status, price_cents, notes, source
    ) values (
      v_client_id, p_barber_id, p_service_id, p_start, v_end, v_status,
      v_service_price, nullif(trim(p_notes), ''),
      case when p_source = 'PUBLIC' then 'PUBLIC' else 'STAFF' end
    )
    returning id into v_appointment_id;
  exception when exclusion_violation then
    raise exception 'Ese horario ya está ocupado. Elegí otro turno.';
  end;

  return v_appointment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Confirmación pública sin datos personales del barbero
-- ---------------------------------------------------------------------------
-- El enlace de confirmación es un UUID no adivinable y funciona como
-- credencial temporal. No necesita el teléfono del barbero: el contacto se
-- resuelve con los datos públicos de la barbería.

create or replace function public.get_booking_confirmation(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', a.id,
    'start_at', a.start_at,
    'end_at', a.end_at,
    'price_cents', a.price_cents,
    'status', a.status,
    'client', jsonb_build_object('name', c.name, 'phone', c.phone),
    'service', jsonb_build_object('name', s.name, 'duration_min', s.duration_min),
    'barber', jsonb_build_object('name', p.name)
  )
  from public.appointments a
  join public.clients c on c.id = a.client_id
  join public.services s on s.id = a.service_id
  join public.profiles p on p.id = a.barber_id
  where a.id = p_id;
$$;

-- ---------------------------------------------------------------------------
-- 9. Superficie de ejecución de funciones
-- ---------------------------------------------------------------------------
-- Postgres concede EXECUTE a PUBLIC por defecto. Se revoca todo lo que no
-- forma parte del contrato público del producto.

revoke all on function public.booking_validate(uuid, uuid, timestamptz, boolean) from public;
revoke all on function public.booking_validate(uuid, uuid, timestamptz, boolean) from anon, authenticated;

revoke all on function public.set_updated_at() from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_user_email_change() from public;

grant execute on function public.get_availability(date, uuid, uuid) to anon, authenticated;
grant execute on function public.create_public_booking(uuid, uuid, timestamptz, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.create_staff_appointment(uuid, text, text, text, uuid, uuid, timestamptz, text, text, text) to authenticated;
grant execute on function public.get_booking_confirmation(uuid) to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_app_role() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. Autoregistro sin privilegios
-- ---------------------------------------------------------------------------
-- `handle_new_user` crea un perfil por cada usuario nuevo de Auth. Antes lo
-- hacía como BARBER activo: si el registro público de Supabase estaba abierto,
-- cualquier persona podía crear una cuenta y leer todos los clientes, turnos y
-- notas de la barbería.
--
-- Regla nueva: el perfil nace inactivo. La activación es una decisión
-- administrativa y se hace desde la Edge Function `admin-users`, que valida que
-- quien invoca sea ADMIN.
--
-- ADEMÁS: en el panel de Supabase hay que desactivar
--   Authentication > Sign In / Providers > Email > "Allow new users to sign up"
-- porque el producto no tiene registro público. Esta migración limita el daño,
-- pero cerrar el registro es la primera línea de defensa.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, active)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, 'barbero'), '@', 1)
    ),
    'BARBER',
    false
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

