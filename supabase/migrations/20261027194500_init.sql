-- En-silla · Supabase schema
-- Mirrors prisma/schema.prisma with RLS and the scheduling RPCs used by the static app.

set search_path = public, extensions;

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.shop_setting (
  id integer primary key default 1 check (id = 1),
  name text not null default 'En-silla Barbershop',
  tagline text not null default 'Cortes con memoria',
  description text,
  address text,
  phone text,
  whatsapp text,
  email text,
  instagram text,
  currency text not null default 'ARS',
  timezone text not null default 'America/Argentina/Buenos_Aires',
  slot_step_min integer not null default 15 check (slot_step_min between 5 and 60),
  buffer_min integer not null default 10 check (buffer_min between 0 and 120),
  lead_time_min integer not null default 60 check (lead_time_min between 0 and 1440),
  booking_window_days integer not null default 21 check (booking_window_days between 1 and 120),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'BARBER' check (role in ('ADMIN', 'BARBER')),
  phone text,
  bio text,
  color text not null default '#c2703d',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_email_key on public.profiles (lower(email));

create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  weekday integer not null unique check (weekday between 0 and 6),
  open_minute integer not null default 600 check (open_minute between 0 and 1440),
  close_minute integer not null default 1200 check (close_minute between 0 and 1440),
  active boolean not null default true
);

create table if not exists public.time_off (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index if not exists time_off_range_idx on public.time_off (start_at, end_at);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  email text,
  birth_date date,
  notes text,
  hair_type text,
  preferred_style text,
  products text,
  allergies text,
  preferred_barber_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_name_idx on public.clients (name);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  duration_min integer not null check (duration_min between 5 and 480),
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  barber_id uuid not null references public.profiles(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'CONFIRMED'
    check (status in ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  price_cents integer not null check (price_cents >= 0),
  notes text,
  source text not null default 'PUBLIC' check (source in ('PUBLIC', 'STAFF')),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  constraint appointments_no_overlap exclude using gist (
    barber_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (status in ('PENDING', 'CONFIRMED', 'COMPLETED'))
);
create index if not exists appointments_barber_start_idx on public.appointments (barber_id, start_at);
create index if not exists appointments_client_idx on public.appointments (client_id);
create index if not exists appointments_start_idx on public.appointments (start_at);

create table if not exists public.haircut_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  tags text,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_by_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists haircut_ideas_client_idx on public.haircut_ideas (client_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_read_idx on public.notifications (user_id, read_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists shop_setting_updated_at on public.shop_setting;
create trigger shop_setting_updated_at before update on public.shop_setting
for each row execute function public.set_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists services_updated_at on public.services;
create trigger services_updated_at before update on public.services
for each row execute function public.set_updated_at();

drop trigger if exists appointments_updated_at on public.appointments;
create trigger appointments_updated_at before update on public.appointments
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth profile sync
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(coalesce(new.email, 'barbero'), '@', 1)),
    'BARBER'
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = lower(coalesce(new.email, '')) where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
after update of email on auth.users
for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Role helpers (security definer so RLS policies never recurse)
-- ---------------------------------------------------------------------------

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('ADMIN', 'BARBER'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'ADMIN', false);
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.shop_setting enable row level security;
alter table public.profiles enable row level security;
alter table public.business_hours enable row level security;
alter table public.time_off enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.haircut_ideas enable row level security;
alter table public.notifications enable row level security;

drop policy if exists shop_setting_select on public.shop_setting;
create policy shop_setting_select on public.shop_setting
for select to anon, authenticated using (true);

drop policy if exists shop_setting_admin_write on public.shop_setting;
create policy shop_setting_admin_write on public.shop_setting
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists business_hours_select on public.business_hours;
create policy business_hours_select on public.business_hours
for select to anon, authenticated using (true);

drop policy if exists business_hours_admin_write on public.business_hours;
create policy business_hours_admin_write on public.business_hours
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists services_select on public.services;
create policy services_select on public.services
for select to anon, authenticated using (active or public.is_staff());

drop policy if exists services_admin_write on public.services;
create policy services_admin_write on public.services
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_select_staff on public.profiles;
create policy profiles_select_staff on public.profiles
for select to authenticated using (public.is_staff());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
for delete to authenticated using (public.is_admin());

drop policy if exists clients_staff_all on public.clients;
create policy clients_staff_all on public.clients
for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists appointments_staff_select on public.appointments;
create policy appointments_staff_select on public.appointments
for select to authenticated using (public.is_staff());

drop policy if exists appointments_staff_insert on public.appointments;
create policy appointments_staff_insert on public.appointments
for insert to authenticated
with check (public.is_admin() or barber_id = auth.uid());

drop policy if exists appointments_staff_update on public.appointments;
create policy appointments_staff_update on public.appointments
for update to authenticated
using (public.is_admin() or barber_id = auth.uid())
with check (public.is_admin() or barber_id = auth.uid());

drop policy if exists appointments_staff_delete on public.appointments;
create policy appointments_staff_delete on public.appointments
for delete to authenticated using (public.is_admin());

drop policy if exists time_off_staff_select on public.time_off;
create policy time_off_staff_select on public.time_off
for select to authenticated using (public.is_staff());

drop policy if exists time_off_write on public.time_off;
create policy time_off_write on public.time_off
for all to authenticated
using (public.is_admin() or user_id = auth.uid())
with check (public.is_admin() or user_id = auth.uid());

drop policy if exists ideas_staff_all on public.haircut_ideas;
create policy ideas_staff_all on public.haircut_ideas
for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notifications_insert_staff on public.notifications;
create policy notifications_insert_staff on public.notifications
for insert to authenticated with check (public.is_staff());

-- Safe public projection for the landing/booking pages.
create or replace view public.barbers_public
with (security_invoker = false) as
select id, name, role, bio, color
from public.profiles
where active = true and role in ('ADMIN', 'BARBER')
order by role asc, name asc;

revoke all on public.barbers_public from public;
grant select on public.barbers_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Availability
-- ---------------------------------------------------------------------------

create or replace function public.get_availability(
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
  v_shop public.shop_setting%rowtype;
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
  select * into v_shop from public.shop_setting where id = 1;
  if not found then
    return;
  end if;

  v_tz := coalesce(v_shop.timezone, 'America/Argentina/Buenos_Aires');
  v_duration := 0;
  v_buffer := coalesce(v_shop.buffer_min, 10);
  v_step := coalesce(v_shop.slot_step_min, 15);
  v_lead := coalesce(v_shop.lead_time_min, 60);
  v_window := coalesce(v_shop.booking_window_days, 21);

  select * into v_service
  from public.services
  where id = p_service_id and active = true;
  if not found then
    return;
  end if;
  v_duration := v_service.duration_min;

  select * into v_hours
  from public.business_hours
  where weekday = extract(dow from p_date)::int;
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
        where (t.user_id is null or t.user_id = p.id)
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
-- Booking creation
-- ---------------------------------------------------------------------------

create or replace function public.booking_validate(
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
  v_shop public.shop_setting%rowtype;
  v_service public.services%rowtype;
  v_barber public.profiles%rowtype;
  v_hours public.business_hours%rowtype;
  v_tz text;
  v_date date;
  v_start_minute integer;
begin
  select * into v_shop from public.shop_setting where id = 1;
  if not found then
    raise exception 'La barbería todavía no está configurada.';
  end if;
  v_tz := coalesce(v_shop.timezone, 'America/Argentina/Buenos_Aires');

  select * into v_service from public.services where id = p_service_id and active = true;
  if not found then
    raise exception 'El servicio no está disponible.';
  end if;

  select * into v_barber from public.profiles where id = p_barber_id and active = true;
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

  select * into v_hours from public.business_hours where weekday = extract(dow from v_date)::int;
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
  v_service_name text;
  v_service_duration integer;
  v_service_price integer;
  v_end timestamptz;
  v_date date;
  v_day_key text;
  v_buffer integer;
  v_tz text;
  v_phone text;
  v_name text := nullif(trim(p_name), '');
  v_client_id uuid;
  v_client_name text;
  v_appointment_id uuid;
begin
  select service_name, service_duration_min, service_price_cents, shop_timezone, shop_buffer_min
  into v_service_name, v_service_duration, v_service_price, v_tz, v_buffer
  from public.booking_validate(p_barber_id, p_service_id, p_start, true);

  if v_name is null or length(v_name) < 2 then
    raise exception 'Ingresá tu nombre completo.';
  end if;

  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_phone := regexp_replace(v_phone, '^54', '');
  if left(v_phone, 1) = '9' and length(v_phone) = 11 then
    v_phone := substr(v_phone, 2);
  end if;
  v_phone := regexp_replace(v_phone, '^0', '');
  if length(v_phone) < 6 then
    raise exception 'Ingresá un teléfono válido.';
  end if;

  v_date := (p_start at time zone v_tz)::date;
  v_day_key := to_char(v_date, 'YYYY-MM-DD');
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

  insert into public.clients (name, phone, email, hair_type, preferred_style)
  values (
    v_name,
    v_phone,
    nullif(trim(p_email), ''),
    nullif(trim(p_hair_type), ''),
    nullif(trim(p_preferred_style), '')
  )
  on conflict (phone) do update set
    name = case when excluded.name <> '' then excluded.name else public.clients.name end,
    email = coalesce(excluded.email, public.clients.email),
    hair_type = coalesce(excluded.hair_type, public.clients.hair_type),
    preferred_style = coalesce(excluded.preferred_style, public.clients.preferred_style)
  returning id, name into v_client_id, v_client_name;

  begin
    insert into public.appointments (
      client_id, barber_id, service_id, start_at, end_at, status, price_cents, notes, source
    ) values (
      v_client_id, p_barber_id, p_service_id, p_start, v_end, 'CONFIRMED',
      v_service_price, nullif(trim(p_notes), ''), 'PUBLIC'
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
  v_client_name text;
begin
  if not public.is_staff() then
    raise exception 'No tenés permiso para crear turnos.';
  end if;

  if not public.is_admin() and p_barber_id <> auth.uid() then
    raise exception 'No podés crear turnos para otro barbero.';
  end if;

  select service_duration_min, service_price_cents, shop_timezone, shop_buffer_min
  into v_service_duration, v_service_price, v_tz, v_buffer
  from public.booking_validate(p_barber_id, p_service_id, p_start, false);

  v_day_key := to_char((p_start at time zone v_tz)::date, 'YYYY-MM-DD');
  v_end := p_start + make_interval(mins => v_service_duration);

  perform pg_advisory_xact_lock(hashtext(p_barber_id::text), hashtext(v_day_key));

  if v_client_id is null then
    v_phone := regexp_replace(coalesce(p_client_phone, ''), '\D', '', 'g');
    v_phone := regexp_replace(v_phone, '^54', '');
    if left(v_phone, 1) = '9' and length(v_phone) = 11 then
      v_phone := substr(v_phone, 2);
    end if;
    v_phone := regexp_replace(v_phone, '^0', '');
    v_name := nullif(trim(p_client_name), '');
    if v_name is null or length(v_phone) < 6 then
      raise exception 'Indicá el nombre y teléfono del cliente.';
    end if;

    insert into public.clients (name, phone, email)
    values (v_name, v_phone, nullif(trim(p_client_email), ''))
    on conflict (phone) do update set
      name = case when excluded.name <> '' then excluded.name else public.clients.name end,
      email = coalesce(excluded.email, public.clients.email)
    returning id into v_client_id;
  else
    select name into v_client_name from public.clients where id = v_client_id;
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
-- Public confirmation payload (UUID acts as the unguessable link)
-- ---------------------------------------------------------------------------

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
    'barber', jsonb_build_object('name', p.name, 'phone', p.phone)
  )
  from public.appointments a
  join public.clients c on c.id = a.client_id
  join public.services s on s.id = a.service_id
  join public.profiles p on p.id = a.barber_id
  where a.id = p_id;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant execute on function public.get_availability(date, uuid, uuid) to anon, authenticated;
grant execute on function public.create_public_booking(uuid, uuid, timestamptz, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.create_staff_appointment(uuid, text, text, text, uuid, uuid, timestamptz, text, text, text) to authenticated;
grant execute on function public.get_booking_confirmation(uuid) to anon, authenticated;

grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_app_role() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Defaults
-- ---------------------------------------------------------------------------

insert into public.shop_setting (id)
values (1)
on conflict (id) do nothing;

insert into public.business_hours (weekday, open_minute, close_minute, active)
values
  (0, 0, 0, false),
  (1, 0, 0, false),
  (2, 600, 1200, true),
  (3, 600, 1200, true),
  (4, 600, 1200, true),
  (5, 600, 1200, true),
  (6, 540, 1080, true)
on conflict (weekday) do nothing;

