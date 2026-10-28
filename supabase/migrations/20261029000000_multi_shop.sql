-- En-silla · Marketplace multi-barbería.
--
-- CONTEXTO
-- Hasta ahora todo el producto asumía una sola barbería (`shop_setting` con
-- `id = 1`). Este archivo convierte el esquema en multi-tenant: cada barbería
-- tiene su propia fila en `shops`, y todos los datos operativos quedan aislados
-- por `shop_id`.
--
-- INVARIANTES
-- 1. Un perfil pertenece a una sola barbería (`profiles.shop_id`).
-- 2. Servicios, horarios, clientes, turnos, bloqueos y notificaciones también
--    pertenecen a una barbería.
-- 3. Las políticas RLS comparan `shop_id` con `current_shop_id()`. Un usuario
--    nunca puede leer ni escribir datos de otra barbería.
-- 4. El sitio público solo ve barberías activas y nunca lee `clients`.
-- 5. La barbería existente se conserva: se copia desde `shop_setting` y luego
--    esa tabla se elimina.
--
-- ORDEN
-- La migración es transaccional. No editar migraciones anteriores.

set search_path = public, extensions;

-- `unaccent` vive en el esquema `extensions` en Supabase. Se crea el esquema
-- antes por si la instalación no lo trae, y así las funciones pueden calificar
-- `extensions.unaccent` sin depender de un `search_path` puntual.
create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Tabla de barberías
-- ---------------------------------------------------------------------------

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  tagline text not null default 'Cortes con memoria',
  description text,
  address text,
  phone text,
  whatsapp text,
  email text,
  instagram text,
  currency text not null default 'COP',
  timezone text not null default 'America/Bogota',
  locale text not null default 'es-CO',
  whatsapp_country_code text not null default '57',
  slot_step_min integer not null default 15 check (slot_step_min between 5 and 60),
  buffer_min integer not null default 10 check (buffer_min between 0 and 120),
  lead_time_min integer not null default 60 check (lead_time_min between 0 and 1440),
  booking_window_days integer not null default 21 check (booking_window_days between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists shops_updated_at on public.shops;
create trigger shops_updated_at before update on public.shops
for each row execute function public.set_updated_at();

-- Copia la barbería existente. El slug se deriva del nombre y se limpia para
-- cumplir el formato; si el nombre queda vacío se usa un valor estable.
insert into public.shops (
  slug,
  name,
  tagline,
  description,
  address,
  phone,
  whatsapp,
  email,
  instagram,
  currency,
  timezone,
  locale,
  whatsapp_country_code,
  slot_step_min,
  buffer_min,
  lead_time_min,
  booking_window_days,
  active,
  created_at,
  updated_at
)
select
  coalesce(
    nullif(
      trim(both '-' from regexp_replace(
        translate(lower(name), 'áéíóúüñ', 'aeiouun'),
        '[^a-z0-9]+',
        '-',
        'g'
      )),
      ''
    ),
    'barberia'
  ),
  name,
  tagline,
  description,
  address,
  phone,
  whatsapp,
  email,
  instagram,
  currency,
  timezone,
  locale,
  whatsapp_country_code,
  slot_step_min,
  buffer_min,
  lead_time_min,
  booking_window_days,
  true,
  updated_at,
  updated_at
from public.shop_setting
where id = 1
  and not exists (select 1 from public.shops);

-- Si una instalación llegó sin `shop_setting`, el producto igual necesita una
-- barbería para que los perfiles tengan destino.
insert into public.shops (slug, name)
select 'en-silla', 'En-silla Barbershop'
where not exists (select 1 from public.shops);

-- ---------------------------------------------------------------------------
-- 2. `shop_id` en todas las tablas del tenant
-- ---------------------------------------------------------------------------
-- Primero se agrega anulable, se rellena con la barbería existente y recién
-- después se marca NOT NULL. Así la migración funciona sobre datos reales.

alter table public.profiles add column if not exists shop_id uuid;
alter table public.business_hours add column if not exists shop_id uuid;
alter table public.time_off add column if not exists shop_id uuid;
alter table public.clients add column if not exists shop_id uuid;
alter table public.services add column if not exists shop_id uuid;
alter table public.appointments add column if not exists shop_id uuid;
alter table public.haircut_ideas add column if not exists shop_id uuid;
alter table public.notifications add column if not exists shop_id uuid;

update public.profiles
set shop_id = (select id from public.shops order by created_at asc limit 1)
where shop_id is null;

update public.business_hours
set shop_id = (select id from public.shops order by created_at asc limit 1)
where shop_id is null;

update public.time_off
set shop_id = (select id from public.shops order by created_at asc limit 1)
where shop_id is null;

update public.clients
set shop_id = (select id from public.shops order by created_at asc limit 1)
where shop_id is null;

update public.services
set shop_id = (select id from public.shops order by created_at asc limit 1)
where shop_id is null;

update public.appointments
set shop_id = (select id from public.shops order by created_at asc limit 1)
where shop_id is null;

update public.haircut_ideas
set shop_id = (select id from public.shops order by created_at asc limit 1)
where shop_id is null;

update public.notifications
set shop_id = (select id from public.shops order by created_at asc limit 1)
where shop_id is null;

alter table public.profiles alter column shop_id set not null;
alter table public.business_hours alter column shop_id set not null;
alter table public.time_off alter column shop_id set not null;
alter table public.clients alter column shop_id set not null;
alter table public.services alter column shop_id set not null;
alter table public.appointments alter column shop_id set not null;
alter table public.haircut_ideas alter column shop_id set not null;
alter table public.notifications alter column shop_id set not null;

alter table public.profiles
  drop constraint if exists profiles_shop_id_fkey;
alter table public.profiles
  add constraint profiles_shop_id_fkey
  foreign key (shop_id) references public.shops(id) on delete restrict;

alter table public.business_hours
  drop constraint if exists business_hours_shop_id_fkey;
alter table public.business_hours
  add constraint business_hours_shop_id_fkey
  foreign key (shop_id) references public.shops(id) on delete restrict;

alter table public.time_off
  drop constraint if exists time_off_shop_id_fkey;
alter table public.time_off
  add constraint time_off_shop_id_fkey
  foreign key (shop_id) references public.shops(id) on delete restrict;

alter table public.clients
  drop constraint if exists clients_shop_id_fkey;
alter table public.clients
  add constraint clients_shop_id_fkey
  foreign key (shop_id) references public.shops(id) on delete restrict;

alter table public.services
  drop constraint if exists services_shop_id_fkey;
alter table public.services
  add constraint services_shop_id_fkey
  foreign key (shop_id) references public.shops(id) on delete restrict;

alter table public.appointments
  drop constraint if exists appointments_shop_id_fkey;
alter table public.appointments
  add constraint appointments_shop_id_fkey
  foreign key (shop_id) references public.shops(id) on delete restrict;

alter table public.haircut_ideas
  drop constraint if exists haircut_ideas_shop_id_fkey;
alter table public.haircut_ideas
  add constraint haircut_ideas_shop_id_fkey
  foreign key (shop_id) references public.shops(id) on delete restrict;

alter table public.notifications
  drop constraint if exists notifications_shop_id_fkey;
alter table public.notifications
  add constraint notifications_shop_id_fkey
  foreign key (shop_id) references public.shops(id) on delete restrict;

-- Los teléfonos y los días de atención dejan de ser únicos globalmente: ahora
-- son únicos dentro de cada barbería.
alter table public.business_hours
  drop constraint if exists business_hours_weekday_key;
alter table public.business_hours
  add constraint business_hours_shop_weekday_key unique (shop_id, weekday);

alter table public.clients
  drop constraint if exists clients_phone_key;
alter table public.clients
  add constraint clients_shop_phone_key unique (shop_id, phone);

create index if not exists profiles_shop_idx on public.profiles (shop_id);
create index if not exists business_hours_shop_idx on public.business_hours (shop_id);
create index if not exists time_off_shop_idx on public.time_off (shop_id);
create index if not exists clients_shop_idx on public.clients (shop_id);
create index if not exists services_shop_idx on public.services (shop_id);
create index if not exists appointments_shop_idx on public.appointments (shop_id);
create index if not exists haircut_ideas_shop_idx on public.haircut_ideas (shop_id);
create index if not exists notifications_shop_idx on public.notifications (shop_id);

-- ---------------------------------------------------------------------------
-- 3. Helpers de sesión
-- ---------------------------------------------------------------------------

-- Barbería del usuario autenticado. Se usa en políticas RLS y como valor por
-- defecto al insertar datos desde el panel.
--
-- Exige que la barbería esté activa: suspender una barbería corta el acceso de
-- todo su equipo, aunque sus perfiles sigan activos. Sin esta condición la
-- suspensión solo la ocultaba del sitio público.
create or replace function public.current_shop_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.shop_id
  from public.profiles p
  join public.shops s on s.id = p.shop_id
  where p.id = auth.uid()
    and p.active = true
    and s.active = true;
$$;

-- Evita que una política RLS tenga que consultar `shops` (lo que podría
-- recursar). Devuelve verdadero solo para barberías publicadas.
create or replace function public.is_active_shop(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shops
    where id = p_shop_id
      and active = true
  );
$$;

-- La barbería se resuelve sola en las altas hechas desde el panel. Las RPC y
-- los scripts pasan `shop_id` de forma explícita.
alter table public.business_hours alter column shop_id set default public.current_shop_id();
alter table public.time_off alter column shop_id set default public.current_shop_id();
alter table public.clients alter column shop_id set default public.current_shop_id();
alter table public.services alter column shop_id set default public.current_shop_id();
alter table public.appointments alter column shop_id set default public.current_shop_id();
alter table public.haircut_ideas alter column shop_id set default public.current_shop_id();
alter table public.notifications alter column shop_id set default public.current_shop_id();

-- ---------------------------------------------------------------------------
-- 4. RLS por barbería
-- ---------------------------------------------------------------------------

alter table public.shops enable row level security;

drop policy if exists shops_select on public.shops;
create policy shops_select on public.shops
for select to anon, authenticated
using (active or id = public.current_shop_id());

drop policy if exists shops_admin_update on public.shops;
create policy shops_admin_update on public.shops
for update to authenticated
using (id = public.current_shop_id() and public.is_admin())
with check (id = public.current_shop_id() and public.is_admin());

-- La barbería se crea con el script de provisión (service_role), no desde el
-- navegador. El borrado queda fuera del alcance del cliente.

drop policy if exists shop_setting_select on public.shop_setting;
drop policy if exists shop_setting_admin_write on public.shop_setting;

drop policy if exists business_hours_select on public.business_hours;
create policy business_hours_select on public.business_hours
for select to anon, authenticated
using (
  (public.current_shop_id() is null and public.is_active_shop(shop_id))
  or (public.is_staff() and shop_id = public.current_shop_id())
);

drop policy if exists business_hours_admin_write on public.business_hours;
create policy business_hours_admin_write on public.business_hours
for all to authenticated
using (shop_id = public.current_shop_id() and public.is_admin())
with check (shop_id = public.current_shop_id() and public.is_admin());

drop policy if exists services_select on public.services;
create policy services_select on public.services
for select to anon, authenticated
using (
  (public.current_shop_id() is null and active and public.is_active_shop(shop_id))
  or (public.is_staff() and shop_id = public.current_shop_id())
);

drop policy if exists services_admin_write on public.services;
create policy services_admin_write on public.services
for all to authenticated
using (shop_id = public.current_shop_id() and public.is_admin())
with check (shop_id = public.current_shop_id() and public.is_admin());

drop policy if exists profiles_select_staff on public.profiles;
create policy profiles_select_staff on public.profiles
for select to authenticated
using (public.is_staff() and shop_id = public.current_shop_id());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
for update to authenticated
using (
  id = auth.uid()
  or (public.is_admin() and shop_id = public.current_shop_id())
)
with check (
  id = auth.uid()
  or (public.is_admin() and shop_id = public.current_shop_id())
);

drop policy if exists clients_staff_select on public.clients;
create policy clients_staff_select on public.clients
for select to authenticated
using (public.is_staff() and shop_id = public.current_shop_id());

drop policy if exists clients_staff_insert on public.clients;
create policy clients_staff_insert on public.clients
for insert to authenticated
with check (public.is_staff() and shop_id = public.current_shop_id());

drop policy if exists clients_staff_update on public.clients;
create policy clients_staff_update on public.clients
for update to authenticated
using (public.is_staff() and shop_id = public.current_shop_id())
with check (public.is_staff() and shop_id = public.current_shop_id());

drop policy if exists clients_admin_delete on public.clients;
create policy clients_admin_delete on public.clients
for delete to authenticated
using (public.is_admin() and shop_id = public.current_shop_id());

drop policy if exists appointments_staff_select on public.appointments;
create policy appointments_staff_select on public.appointments
for select to authenticated
using (public.is_staff() and shop_id = public.current_shop_id());

drop policy if exists appointments_staff_update on public.appointments;
create policy appointments_staff_update on public.appointments
for update to authenticated
using (
  shop_id = public.current_shop_id()
  and (public.is_admin() or barber_id = auth.uid())
)
with check (
  shop_id = public.current_shop_id()
  and (public.is_admin() or barber_id = auth.uid())
);

drop policy if exists time_off_staff_select on public.time_off;
create policy time_off_staff_select on public.time_off
for select to authenticated
using (public.is_staff() and shop_id = public.current_shop_id());

drop policy if exists time_off_write on public.time_off;
create policy time_off_write on public.time_off
for all to authenticated
using (
  shop_id = public.current_shop_id()
  and (public.is_admin() or user_id = auth.uid())
)
with check (
  shop_id = public.current_shop_id()
  and (public.is_admin() or user_id = auth.uid())
);

drop policy if exists ideas_staff_all on public.haircut_ideas;
create policy ideas_staff_all on public.haircut_ideas
for all to authenticated
using (public.is_staff() and shop_id = public.current_shop_id())
with check (public.is_staff() and shop_id = public.current_shop_id());

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
for select to authenticated
using (user_id = auth.uid() and shop_id = public.current_shop_id());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update to authenticated
using (user_id = auth.uid() and shop_id = public.current_shop_id())
with check (user_id = auth.uid() and shop_id = public.current_shop_id());

-- ---------------------------------------------------------------------------
-- 5. Proyección pública del equipo
-- ---------------------------------------------------------------------------
-- La vista se ejecuta con privilegios del dueño para no depender de las RLS de
-- `profiles`. Solo expone datos de presentación de barberías activas.

drop view if exists public.barbers_public;
create view public.barbers_public
with (security_invoker = false) as
select id, shop_id, name, role, bio, color
from public.profiles p
where p.active = true
  and p.role in ('ADMIN', 'BARBER')
  and public.is_active_shop(p.shop_id)
order by p.role asc, p.name asc;

revoke all on public.barbers_public from public;
grant select on public.barbers_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Búsqueda pública de barberías
-- ---------------------------------------------------------------------------

create or replace function public.search_shops(p_query text)
returns table (
  id uuid,
  slug text,
  name text,
  tagline text,
  address text,
  instagram text
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_term text;
begin
  v_term := btrim(coalesce(p_query, ''));

  -- Se quitan los comodines para que la entrada no funcione como patrón:
  -- `%%` no debe convertirse en un listado de la plataforma.
  v_term := replace(replace(v_term, '%', ''), '_', '');

  -- Dos caracteres como mínimo, medidos después de limpiar la entrada: la
  -- búsqueda es por nombre conocido, no un directorio completo.
  if length(v_term) < 2 then
    return;
  end if;

  return query
    select s.id, s.slug, s.name, s.tagline, s.address, s.instagram
    from public.shops s
    where s.active = true
      and (
        extensions.unaccent(s.name) ilike '%' || extensions.unaccent(v_term) || '%'
        or s.slug ilike '%' || lower(v_term) || '%'
      )
    order by
      case
        when extensions.unaccent(lower(s.name)) =
             extensions.unaccent(lower(v_term)) then 0
        else 1
      end,
      s.name asc
    limit 12;
end;
$$;

create or replace function public.get_public_shop(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(s) - 'created_at' - 'updated_at'
  from public.shops s
  where s.slug = btrim(coalesce(p_slug, ''))
    and s.active = true;
$$;

-- Configuración de la barbería del usuario autenticado (panel).
create or replace function public.current_shop()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(s) - 'created_at' - 'updated_at'
  from public.shops s
  where s.id = public.current_shop_id();
$$;

-- ---------------------------------------------------------------------------
-- 7. Disponibilidad por barbería
-- ---------------------------------------------------------------------------

drop function if exists public.get_availability(date, uuid, uuid);

create or replace function public.get_availability(
  p_shop_id uuid,
  p_date date,
  p_service_id uuid,
  p_barber_id uuid default null
)
returns table (
  start_at timestamptz,
  end_at timestamptz,
  barber_id uuid,
  barber_name text,
  barber_color text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shop public.shops%rowtype;
  v_service public.services%rowtype;
  v_hours public.business_hours%rowtype;
  v_tz text;
  v_duration integer;
  v_buffer integer;
  v_step integer;
  v_lead integer;
  v_window integer;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_min_start timestamptz;
  v_window_limit timestamptz;
  v_minute integer;
  v_start timestamptz;
  v_end timestamptz;
  v_barber record;
begin
  select * into v_shop
  from public.shops
  where id = p_shop_id and active = true;
  if not found then
    return;
  end if;

  v_tz := coalesce(v_shop.timezone, 'America/Bogota');
  v_duration := 0;
  v_buffer := coalesce(v_shop.buffer_min, 10);
  v_step := coalesce(v_shop.slot_step_min, 15);
  v_lead := coalesce(v_shop.lead_time_min, 60);
  v_window := coalesce(v_shop.booking_window_days, 21);

  select * into v_service
  from public.services
  where id = p_service_id
    and shop_id = p_shop_id
    and active = true;
  if not found then
    return;
  end if;
  v_duration := v_service.duration_min;

  select * into v_hours
  from public.business_hours
  where shop_id = p_shop_id
    and weekday = extract(dow from p_date)::int;
  if not found or not v_hours.active then
    return;
  end if;

  v_day_start := (p_date + make_interval(mins => v_hours.open_minute)) at time zone v_tz;
  v_day_end := (p_date + make_interval(mins => v_hours.close_minute)) at time zone v_tz;
  v_min_start := now() + make_interval(mins => v_lead);
  v_window_limit := now() + make_interval(days => v_window);

  if v_day_end < now() or v_day_start > v_window_limit then
    return;
  end if;

  for v_minute in
    select generate_series(
      v_hours.open_minute,
      v_hours.close_minute - v_duration,
      v_step
    )
  loop
    v_start := (p_date + make_interval(mins => v_minute)) at time zone v_tz;
    v_end := v_start + make_interval(mins => v_duration);

    continue when v_start < v_min_start;

    select p.id, p.name, p.color
      into v_barber
    from public.profiles p
    where p.active = true
      and p.shop_id = p_shop_id
      and p.role in ('ADMIN', 'BARBER')
      and (p_barber_id is null or p.id = p_barber_id)
      and not exists (
        select 1
        from public.appointments a
        where a.barber_id = p.id
          and a.status in ('PENDING', 'CONFIRMED', 'COMPLETED')
          and a.start_at < v_end + make_interval(mins => v_buffer)
          and a.end_at > v_start - make_interval(mins => v_buffer)
      )
      and not exists (
        select 1
        from public.time_off t
        where t.shop_id = p_shop_id
          and (t.user_id is null or t.user_id = p.id)
          and t.start_at < v_end
          and t.end_at > v_start
      )
    order by (
      select coalesce(sum(extract(epoch from (a.end_at - a.start_at))), 0)
      from public.appointments a
      where a.barber_id = p.id
        and a.status in ('PENDING', 'CONFIRMED', 'COMPLETED')
        and a.start_at >= v_day_start
        and a.start_at < v_day_end
    ) asc, p.name asc
    limit 1;

    if found then
      start_at := v_start;
      end_at := v_end;
      barber_id := v_barber.id;
      barber_name := v_barber.name;
      barber_color := v_barber.color;
      return next;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Validación compartida de turnos
-- ---------------------------------------------------------------------------

drop function if exists public.booking_validate(uuid, uuid, timestamptz, boolean);

create or replace function public.booking_validate(
  p_shop_id uuid,
  p_barber_id uuid,
  p_service_id uuid,
  p_start timestamptz,
  p_enforce_lead boolean
)
returns table (
  service_name text,
  service_duration_min integer,
  service_price_cents integer,
  barber_name text,
  shop_timezone text,
  shop_buffer_min integer,
  shop_lead_time_min integer,
  shop_booking_window_days integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shop public.shops%rowtype;
  v_service public.services%rowtype;
  v_barber public.profiles%rowtype;
  v_hours public.business_hours%rowtype;
  v_tz text;
  v_date date;
  v_start_minute integer;
begin
  select * into v_shop
  from public.shops
  where id = p_shop_id and active = true;

  if not found then
    raise exception 'La barbería no está disponible.';
  end if;

  v_tz := coalesce(v_shop.timezone, 'America/Bogota');

  select * into v_service
  from public.services
  where id = p_service_id
    and shop_id = p_shop_id
    and active = true;

  if not found then
    raise exception 'El servicio no está disponible.';
  end if;

  select * into v_barber
  from public.profiles
  where id = p_barber_id
    and shop_id = p_shop_id
    and active = true;

  if not found or v_barber.role not in ('ADMIN', 'BARBER') then
    raise exception 'El barbero no está disponible.';
  end if;

  v_date := (p_start at time zone v_tz)::date;
  v_start_minute := extract(hour from (p_start at time zone v_tz))::int * 60
    + extract(minute from (p_start at time zone v_tz))::int;

  if p_enforce_lead and p_start < now() + make_interval(mins => v_shop.lead_time_min) then
    raise exception 'Ese horario ya no está disponible. Elegí otro turno.';
  end if;

  if p_enforce_lead and p_start > now() + make_interval(days => v_shop.booking_window_days) then
    raise exception 'Todavía no se pueden reservar turnos para esa fecha.';
  end if;

  select * into v_hours
  from public.business_hours
  where shop_id = p_shop_id
    and weekday = extract(dow from v_date)::int;

  if not found or not v_hours.active then
    raise exception 'La barbería está cerrada ese día.';
  end if;

  if v_start_minute < v_hours.open_minute
     or v_start_minute + v_service.duration_min > v_hours.close_minute then
    raise exception 'Ese horario está fuera del horario de atención.';
  end if;

  service_name := v_service.name;
  service_duration_min := v_service.duration_min;
  service_price_cents := v_service.price_cents;
  barber_name := v_barber.name;
  shop_timezone := v_tz;
  shop_buffer_min := coalesce(v_shop.buffer_min, 10);
  shop_lead_time_min := coalesce(v_shop.lead_time_min, 60);
  shop_booking_window_days := coalesce(v_shop.booking_window_days, 21);
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Reserva pública por barbería
-- ---------------------------------------------------------------------------

drop function if exists public.create_public_booking(uuid, uuid, timestamptz, text, text, text, text, text, text);

create or replace function public.create_public_booking(
  p_shop_id uuid,
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
  v_shop public.shops%rowtype;
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
  select * into v_shop
  from public.shops
  where id = p_shop_id and active = true;

  if not found then
    raise exception 'La barbería no está disponible.';
  end if;

  select service_name, service_duration_min, service_price_cents, shop_timezone, shop_buffer_min
  into v_service_name, v_service_duration, v_service_price, v_tz, v_buffer
  from public.booking_validate(p_shop_id, p_barber_id, p_service_id, p_start, true);

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
    where t.shop_id = p_shop_id
      and (t.user_id is null or t.user_id = p_barber_id)
      and t.start_at < v_end
      and t.end_at > p_start
  ) then
    raise exception 'El barbero no está disponible en ese horario.';
  end if;

  -- Alta o actualización del cliente dentro de la barbería. El nombre existente
  -- se conserva: el visitante solo completa los datos que falten.
  insert into public.clients (shop_id, name, phone, email, hair_type, preferred_style)
  values (p_shop_id, v_name, v_phone, v_email, v_hair_type, v_preferred_style)
  on conflict (shop_id, phone) do update set
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
      shop_id, client_id, barber_id, service_id, start_at, end_at, status, price_cents, notes, source
    ) values (
      p_shop_id, v_client_id, p_barber_id, p_service_id, p_start, v_end, 'CONFIRMED',
      v_service_price, v_notes, 'PUBLIC'
    )
    returning id into v_appointment_id;
  exception when exclusion_violation then
    raise exception 'Ese horario ya está ocupado. Elegí otro turno.';
  end;

  insert into public.notifications (shop_id, user_id, title, body, href)
  values (
    p_shop_id,
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
-- 10. Alta de turnos desde el panel
-- ---------------------------------------------------------------------------
-- La firma no cambia: la barbería se deduce del administrador/barbero que
-- invoca. Así el panel no puede crear turnos en otra barbería.

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
  v_shop_id uuid := public.current_shop_id();
  v_shop public.shops%rowtype;
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
  if not public.is_staff() or v_shop_id is null then
    raise exception 'No tenés permiso para crear turnos.';
  end if;

  if not public.is_admin() and p_barber_id <> auth.uid() then
    raise exception 'No podés crear turnos para otro barbero.';
  end if;

  select * into v_shop
  from public.shops
  where id = v_shop_id and active = true;

  if not found then
    raise exception 'La barbería no está disponible.';
  end if;

  select service_duration_min, service_price_cents, shop_timezone, shop_buffer_min
  into v_service_duration, v_service_price, v_tz, v_buffer
  from public.booking_validate(v_shop_id, p_barber_id, p_service_id, p_start, false);

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

    insert into public.clients (shop_id, name, phone, email)
    values (v_shop_id, v_name, v_phone, nullif(trim(p_client_email), ''))
    on conflict (shop_id, phone) do update set
      name = excluded.name,
      email = coalesce(excluded.email, public.clients.email),
      updated_at = now()
    returning id into v_client_id;
  else
    perform 1
    from public.clients
    where id = v_client_id
      and shop_id = v_shop_id;

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
    where t.shop_id = v_shop_id
      and (t.user_id is null or t.user_id = p_barber_id)
      and t.start_at < v_end
      and t.end_at > p_start
  ) then
    raise exception 'El barbero no está disponible en ese horario.';
  end if;

  begin
    insert into public.appointments (
      shop_id, client_id, barber_id, service_id, start_at, end_at, status, price_cents, notes, source
    ) values (
      v_shop_id, v_client_id, p_barber_id, p_service_id, p_start, v_end, v_status,
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
-- 11. Confirmación pública con datos de la barbería
-- ---------------------------------------------------------------------------
-- El UUID sigue siendo la credencial. Se agrega la barbería para que la
-- pantalla de confirmación no dependa de "la única barbería" y pueda mostrar
-- dirección, moneda, zona horaria y WhatsApp correctos. El correo del cliente
-- no se expone: solo si existe (`has_email`), que es lo que necesita la
-- pantalla para ofrecer el recordatorio.

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
    'client', jsonb_build_object(
      'name', c.name,
      'phone', c.phone,
      'has_email', c.email is not null
    ),
    'service', jsonb_build_object(
      'name', s.name,
      'duration_min', s.duration_min
    ),
    'barber', jsonb_build_object('name', p.name),
    'shop', to_jsonb(sh) - 'created_at' - 'updated_at'
  )
  from public.appointments a
  join public.clients c on c.id = a.client_id
  join public.services s on s.id = a.service_id
  join public.profiles p on p.id = a.barber_id
  join public.shops sh on sh.id = a.shop_id
  where a.id = p_id
    and a.shop_id = c.shop_id
    and a.shop_id = s.shop_id
    and a.shop_id = p.shop_id;
$$;

-- Agrega el correo después de confirmar la reserva. Se usa desde la pantalla
-- de confirmación, sin sesión: el UUID de la reserva es la credencial. No se
-- permite modificar reservas canceladas ni completadas.
--
-- Solo completa un correo faltante. Si el cliente ya tenía uno, la llamada no
-- lo cambia: el enlace es una credencial de lectura y no debe servir para
-- reemplazar un dato de contacto existente.
create or replace function public.set_booking_email(p_id uuid, p_email text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_email text := nullif(btrim(p_email), '');
  v_client_id uuid;
  v_status text;
begin
  if v_email is null
     or length(v_email) > 160
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Ingresá un correo válido.';
  end if;

  select client_id, status
    into v_client_id, v_status
  from public.appointments
  where id = p_id;

  if not found then
    raise exception 'No encontramos esa reserva.';
  end if;

  if v_status not in ('PENDING', 'CONFIRMED') then
    raise exception 'Esta reserva ya no admite cambios.';
  end if;

  update public.clients
  set email = v_email,
      updated_at = now()
  where id = v_client_id
    and email is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Alta de usuarios: barbería desde los metadatos
-- ---------------------------------------------------------------------------
-- La Edge Function `admin-users` crea la cuenta con `shop_id` en
-- `raw_user_meta_data`. El perfil nace inactivo; la Edge Function lo activa.
-- Si el metadato falta (cuenta creada a mano desde el panel de Supabase), se
-- asigna la barbería más antigua solo para no romper el alta; la cuenta queda
-- inactiva y sin acceso hasta que un administrador la habilite.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
begin
  begin
    v_shop_id := nullif(new.raw_user_meta_data->>'shop_id', '')::uuid;
  exception when invalid_text_representation then
    v_shop_id := null;
  end;

  if v_shop_id is null then
    select id into v_shop_id
    from public.shops
    order by created_at asc
    limit 1;
  end if;

  if v_shop_id is null then
    raise exception 'No hay barberías configuradas.';
  end if;

  insert into public.profiles (id, shop_id, email, name, role, active)
  values (
    new.id,
    v_shop_id,
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

-- ---------------------------------------------------------------------------
-- 13. Privilegios
-- ---------------------------------------------------------------------------

-- La tabla de barberías se lee desde el sitio público (con RLS) y se edita
-- desde el panel por columnas. El slug no se cambia desde el navegador para no
-- romper enlaces públicos, y `active` tampoco: suspender o reactivar una
-- barbería es una decisión operativa que se toma con la clave de servicio
-- (script o SQL directo), no desde el panel.
revoke all on public.shops from anon, authenticated;
grant select on public.shops to anon, authenticated;
grant update (
  name,
  tagline,
  description,
  address,
  phone,
  whatsapp,
  email,
  instagram,
  currency,
  timezone,
  locale,
  whatsapp_country_code,
  slot_step_min,
  buffer_min,
  lead_time_min,
  booking_window_days
) on public.shops to authenticated;

revoke all on function public.booking_validate(uuid, uuid, uuid, timestamptz, boolean) from public;
revoke all on function public.booking_validate(uuid, uuid, uuid, timestamptz, boolean) from anon, authenticated;

revoke all on function public.normalize_phone(text, text) from public;
revoke all on function public.normalize_phone(text, text) from anon, authenticated;

revoke all on function public.handle_new_user() from public;
revoke all on function public.set_updated_at() from public;

revoke all on function public.search_shops(text) from public;
revoke all on function public.search_shops(text) from anon, authenticated;
revoke all on function public.get_public_shop(text) from public;
revoke all on function public.get_public_shop(text) from anon, authenticated;
revoke all on function public.current_shop() from public;
revoke all on function public.current_shop() from anon, authenticated;
revoke all on function public.current_shop_id() from public;
revoke all on function public.current_shop_id() from anon, authenticated;
revoke all on function public.is_active_shop(uuid) from public;
revoke all on function public.is_active_shop(uuid) from anon, authenticated;
revoke all on function public.set_booking_email(uuid, text) from public;
revoke all on function public.set_booking_email(uuid, text) from anon, authenticated;
revoke all on function public.get_availability(uuid, date, uuid, uuid) from public;
revoke all on function public.get_availability(uuid, date, uuid, uuid) from anon, authenticated;
revoke all on function public.create_public_booking(uuid, uuid, uuid, timestamptz, text, text, text, text, text, text) from public;
revoke all on function public.create_public_booking(uuid, uuid, uuid, timestamptz, text, text, text, text, text, text) from anon, authenticated;
revoke all on function public.create_staff_appointment(uuid, text, text, text, uuid, uuid, timestamptz, text, text, text) from public;
revoke all on function public.create_staff_appointment(uuid, text, text, text, uuid, uuid, timestamptz, text, text, text) from anon, authenticated;
revoke all on function public.get_booking_confirmation(uuid) from public;
revoke all on function public.get_booking_confirmation(uuid) from anon, authenticated;

grant execute on function public.search_shops(text) to anon, authenticated;
grant execute on function public.get_public_shop(text) to anon, authenticated;
grant execute on function public.current_shop() to authenticated;
grant execute on function public.current_shop_id() to anon, authenticated;
grant execute on function public.is_active_shop(uuid) to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_app_role() to anon, authenticated;
grant execute on function public.set_booking_email(uuid, text) to anon, authenticated;
grant execute on function public.get_availability(uuid, date, uuid, uuid) to anon, authenticated;
grant execute on function public.create_public_booking(uuid, uuid, uuid, timestamptz, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.create_staff_appointment(uuid, text, text, text, uuid, uuid, timestamptz, text, text, text) to authenticated;
grant execute on function public.get_booking_confirmation(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 14. Retiro de la configuración monolocal
-- ---------------------------------------------------------------------------
-- Sus datos ya viven en `shops`. Las funciones fueron reescritas antes de este
-- punto para no depender de `shop_setting`.

drop trigger if exists shop_setting_updated_at on public.shop_setting;
drop table if exists public.shop_setting;
