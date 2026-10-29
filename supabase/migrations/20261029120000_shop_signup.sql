-- En-silla · Alta autoservicio de barberías.
--
-- CONTEXTO
-- Hasta ahora una barbería solo se podía crear con `scripts/create-shop.mjs` y
-- la clave de servicio. Este archivo abre el alta desde el sitio público sin
-- habilitar el registro libre de Supabase Auth: la Edge Function `shop-signup`
-- crea la barbería, genera el enlace de confirmación y lo envía por Resend.
--
-- INVARIANTES
-- 1. `active` significa "puede operar"; `published` significa "aparece en el
--    sitio público". Una barbería nueva nace activa pero no publicada.
-- 2. El dueño no puede entrar hasta confirmar su correo. El perfil queda
--    inactivo y `pending_signup = true` hasta que el enlace se usa.
-- 3. El navegador nunca inserta barberías: el alta pasa por la Edge Function y
--    por `create_shop_signup`, que solo ejecuta la clave de servicio.
-- 4. Publicar exige un mínimo operativo: servicio activo, día de atención y
--    alguien que atienda. Se valida en `set_shop_published`.
-- 5. El sitio público solo resuelve barberías publicadas. `shops` deja de ser
--    legible por `anon` para cerrar la enumeración de tenants.
--
-- ORDEN
-- La migración es transaccional. No editar migraciones anteriores.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. Publicación y estado de alta
-- ---------------------------------------------------------------------------

-- Las barberías existentes se conservan visibles: el default es `true` y el
-- alta autoservicio inserta `false` de forma explícita.
alter table public.shops
  add column if not exists published boolean not null default true;

-- Marca las cuentas creadas por `shop-signup`. No se puede deducir de
-- `raw_user_meta_data` porque el usuario puede editar sus propios metadatos.
alter table public.profiles
  add column if not exists pending_signup boolean not null default false;

create index if not exists shops_published_idx
  on public.shops (published)
  where published = true;

-- ---------------------------------------------------------------------------
-- 2. Intentos de alta (límite anti-abuso)
-- ---------------------------------------------------------------------------
-- La Edge Function usa la clave de servicio y registra cada intento. La tabla
-- no tiene políticas: `anon` y `authenticated` no pueden leerla ni escribirla.

create table if not exists public.shop_signup_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip text,
  action text not null check (action in ('signup', 'resend')),
  created_at timestamptz not null default now()
);

create index if not exists shop_signup_attempts_email_idx
  on public.shop_signup_attempts (email, created_at desc);
create index if not exists shop_signup_attempts_ip_idx
  on public.shop_signup_attempts (ip, created_at desc);

alter table public.shop_signup_attempts enable row level security;

revoke all on public.shop_signup_attempts from anon, authenticated;
grant select, insert, delete on public.shop_signup_attempts to service_role;

-- ---------------------------------------------------------------------------
-- 3. Slug único a partir del nombre
-- ---------------------------------------------------------------------------

create or replace function public.shop_slug_from_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(
        translate(lower(coalesce(p_name, '')), 'áéíóúüñ', 'aeiouun'),
        '[^a-z0-9]+',
        '-',
        'g'
      )),
      ''
    ),
    'barberia'
  );
$$;

revoke all on function public.shop_slug_from_name(text) from public;
revoke all on function public.shop_slug_from_name(text) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Provisión de la barbería
-- ---------------------------------------------------------------------------
-- Crea la barbería oculta y su horario inicial. El perfil del dueño lo crea el
-- trigger `handle_new_user` cuando la Edge Function crea el usuario de Auth.
-- `p_owner_name` se valida acá y viaja en los metadatos del usuario.

create or replace function public.create_shop_signup(
  p_name text,
  p_owner_name text,
  p_email text,
  p_phone text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_owner text := btrim(coalesce(p_owner_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_base text;
  v_slug text;
  v_suffix integer := 2;
  v_shop_id uuid;
begin
  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'El nombre de la barbería debe tener entre 2 y 80 caracteres.';
  end if;

  if length(v_owner) < 2 or length(v_owner) > 80 then
    raise exception 'El nombre del responsable debe tener entre 2 y 80 caracteres.';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 160 then
    raise exception 'Ingresá un correo válido.';
  end if;

  if v_phone is not null and length(v_phone) > 40 then
    raise exception 'El teléfono es demasiado largo.';
  end if;

  -- Un correo pertenece a una sola barbería. La Edge Function vuelve a
  -- comprobarlo contra Auth antes de crear el usuario.
  if exists (
    select 1
    from public.profiles p
    where lower(p.email) = v_email
  ) then
    raise exception 'Ese correo ya tiene una cuenta.';
  end if;

  v_base := left(public.shop_slug_from_name(v_name), 60);
  v_base := trim(both '-' from v_base);
  if v_base = '' then
    v_base := 'barberia';
  end if;

  -- Las colisiones se resuelven con sufijos numéricos estables. El chequeo es
  -- suficiente para el volumen del producto; la restricción unique es la red
  -- final ante una carrera.
  v_slug := v_base;
  while exists (select 1 from public.shops s where s.slug = v_slug) loop
    v_slug := v_base || '-' || v_suffix;
    v_suffix := v_suffix + 1;
    if v_suffix > 99 then
      v_slug := v_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
      exit;
    end if;
  end loop;

  insert into public.shops (
    slug,
    name,
    tagline,
    email,
    phone,
    currency,
    timezone,
    locale,
    whatsapp_country_code,
    active,
    published
  ) values (
    v_slug,
    v_name,
    'Cortes con memoria',
    v_email,
    v_phone,
    'COP',
    'America/Bogota',
    'es-CO',
    '57',
    true,
    false
  )
  returning id into v_shop_id;

  -- Mismo horario inicial que `scripts/create-shop.mjs`: martes a viernes de
  -- 10 a 20 y sábado de 9 a 18. El dueño lo ajusta en el panel.
  insert into public.business_hours (
    shop_id,
    weekday,
    open_minute,
    close_minute,
    active
  ) values
    (v_shop_id, 0, 0, 0, false),
    (v_shop_id, 1, 0, 0, false),
    (v_shop_id, 2, 600, 1200, true),
    (v_shop_id, 3, 600, 1200, true),
    (v_shop_id, 4, 600, 1200, true),
    (v_shop_id, 5, 600, 1200, true),
    (v_shop_id, 6, 540, 1080, true);

  return jsonb_build_object(
    'id', v_shop_id,
    'slug', v_slug,
    'name', v_name
  );
end;
$$;

revoke all on function public.create_shop_signup(text, text, text, text) from public;
revoke all on function public.create_shop_signup(text, text, text, text) from anon, authenticated;
grant execute on function public.create_shop_signup(text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Publicación controlada
-- ---------------------------------------------------------------------------
-- `published` no se otorga como columna editable: publicar u ocultar pasa por
-- esta RPC, que exige el mínimo operativo para que el sitio no muestre una
-- barbería sin servicios, sin horario o sin nadie que atienda.

create or replace function public.set_shop_published(p_published boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
begin
  if v_shop_id is null or not public.is_admin() then
    raise exception 'Solo un administrador puede publicar la barbería.';
  end if;

  if p_published then
    if not exists (
      select 1 from public.services
      where shop_id = v_shop_id and active = true
    ) then
      raise exception 'Agregá al menos un servicio activo antes de publicar.';
    end if;

    if not exists (
      select 1 from public.business_hours
      where shop_id = v_shop_id and active = true
    ) then
      raise exception 'Marcá al menos un día de atención antes de publicar.';
    end if;

    if not exists (
      select 1 from public.profiles
      where shop_id = v_shop_id
        and active = true
        and role in ('ADMIN', 'BARBER')
    ) then
      raise exception 'Necesitás al menos un integrante activo antes de publicar.';
    end if;
  end if;

  update public.shops
  set published = p_published,
      updated_at = now()
  where id = v_shop_id;

  return p_published;
end;
$$;

revoke all on function public.set_shop_published(boolean) from public;
revoke all on function public.set_shop_published(boolean) from anon, authenticated;
grant execute on function public.set_shop_published(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Confirmación del correo del dueño
-- ---------------------------------------------------------------------------
-- El trigger de Auth activa el perfil cuando Supabase confirma el correo. La
-- RPC es una red de seguridad para la pantalla `/confirmar`: exige una sesión
-- con el correo ya confirmado y solo toca el perfil propio pendiente.

create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.profiles
    set active = true,
        pending_signup = false,
        updated_at = now()
    where id = new.id
      and pending_signup = true;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
after update of email_confirmed_at on auth.users
for each row execute function public.handle_user_confirmed();

revoke all on function public.handle_user_confirmed() from public;

create or replace function public.confirm_shop_signup()
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sesión requerida.';
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = v_uid
      and u.email_confirmed_at is not null
  ) then
    raise exception 'Todavía falta confirmar el correo.';
  end if;

  update public.profiles
  set active = true,
      pending_signup = false,
      updated_at = now()
  where id = v_uid
    and pending_signup = true;

  return true;
end;
$$;

revoke all on function public.confirm_shop_signup() from public;
revoke all on function public.confirm_shop_signup() from anon, authenticated;
grant execute on function public.confirm_shop_signup() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Alta de usuarios sin barbería implícita
-- ---------------------------------------------------------------------------
-- Se elimina el fallback a "la barbería más antigua": una cuenta sin `shop_id`
-- queda huérfana y es preferible que el alta falle. `create-shop.mjs` y
-- `admin-users` siempre envían `shop_id`; `shop-signup` lo agrega después de
-- crear la barbería.

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
    raise exception 'La cuenta no tiene una barbería asignada.';
  end if;

  insert into public.profiles (id, shop_id, email, name, role, active, pending_signup)
  values (
    new.id,
    v_shop_id,
    lower(coalesce(new.email, '')),
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, 'barbero'), '@', 1)
    ),
    'BARBER',
    false,
    false
  )
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

-- ---------------------------------------------------------------------------
-- 8. La puerta pública exige publicación
-- ---------------------------------------------------------------------------

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
      and published = true
  );
$$;

revoke all on function public.is_active_shop(uuid) from public;
revoke all on function public.is_active_shop(uuid) from anon, authenticated;
grant execute on function public.is_active_shop(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Búsqueda y ficha pública
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

  -- Se compara solo con letras y números, sin acentos ni signos.
  v_term := regexp_replace(extensions.unaccent(lower(v_term)), '[^a-z0-9]+', '', 'g');

  -- Dos caracteres como mínimo, medidos después de limpiar la entrada.
  if length(v_term) < 2 then
    return;
  end if;

  return query
    select s.id, s.slug, s.name, s.tagline, s.address, s.instagram
    from public.shops s
    where s.active = true
      and s.published = true
      and (
        regexp_replace(extensions.unaccent(lower(s.name)), '[^a-z0-9]+', '', 'g')
          like '%' || v_term || '%'
        or regexp_replace(lower(s.slug), '[^a-z0-9]+', '', 'g')
          like '%' || v_term || '%'
      )
    order by
      case
        when regexp_replace(extensions.unaccent(lower(s.name)), '[^a-z0-9]+', '', 'g') = v_term
          then 0
        else 1
      end,
      s.name asc
    limit 12;
end;
$$;

revoke all on function public.search_shops(text) from public;
revoke all on function public.search_shops(text) from anon, authenticated;
grant execute on function public.search_shops(text) to anon, authenticated;

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
    and s.active = true
    and s.published = true;
$$;

revoke all on function public.get_public_shop(text) from public;
revoke all on function public.get_public_shop(text) from anon, authenticated;
grant execute on function public.get_public_shop(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. Disponibilidad pública
-- ---------------------------------------------------------------------------
-- `booking_validate` se mantiene sin filtro de publicación a propósito: el
-- panel debe poder cargar turnos de prueba antes de publicar. El filtro se
-- aplica en las dos puertas públicas (`get_availability` y
-- `create_public_booking`).

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
  where id = p_shop_id
    and active = true
    and published = true;
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

revoke all on function public.get_availability(uuid, date, uuid, uuid) from public;
revoke all on function public.get_availability(uuid, date, uuid, uuid) from anon, authenticated;
grant execute on function public.get_availability(uuid, date, uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 11. Reserva pública
-- ---------------------------------------------------------------------------

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
  where id = p_shop_id
    and active = true
    and published = true;

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

revoke all on function public.create_public_booking(uuid, uuid, uuid, timestamptz, text, text, text, text, text, text) from public;
revoke all on function public.create_public_booking(uuid, uuid, uuid, timestamptz, text, text, text, text, text, text) from anon, authenticated;
grant execute on function public.create_public_booking(uuid, uuid, uuid, timestamptz, text, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 12. `shops` deja de ser un directorio para `anon`
-- ---------------------------------------------------------------------------
-- La barbería pública se resuelve por RPC. El panel solo necesita su propia
-- fila, así que la política queda acotada a `current_shop_id()`.

drop policy if exists shops_select on public.shops;
create policy shops_select on public.shops
for select to authenticated
using (id = public.current_shop_id());

revoke all on public.shops from anon, authenticated;
grant select on public.shops to authenticated;
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

-- ---------------------------------------------------------------------------
-- 13. Privilegios de las funciones nuevas
-- ---------------------------------------------------------------------------
-- Se reafirman los privilegios de las funciones reemplazadas para que el
-- contrato quede explícito en el historial.

revoke all on function public.current_shop() from public;
revoke all on function public.current_shop() from anon, authenticated;
grant execute on function public.current_shop() to authenticated;

revoke all on function public.current_shop_id() from public;
revoke all on function public.current_shop_id() from anon, authenticated;
grant execute on function public.current_shop_id() to anon, authenticated;

revoke all on function public.is_staff() from public;
revoke all on function public.is_staff() from anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
