-- En-silla · Búsqueda tolerante a signos y espacios.
--
-- CONTEXTO
-- `search_shops` comparaba con `ilike` sobre el nombre tal cual. Por eso
-- "ensilla" no encontraba "En-silla Barbershop": el guion rompía la
-- coincidencia. La marca se escribe "En-silla", "en silla" y "ensilla", así que
-- la comparación tiene que ignorar todo lo que no sea letra o número.
--
-- ALCANCE
-- Solo cambia la función de búsqueda pública. No toca datos ni privilegios.

set search_path = public, extensions;

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

-- `create or replace` conserva los permisos, pero se reafirman para que la
-- política quede explícita en el historial de migraciones.
revoke all on function public.search_shops(text) from public;
revoke all on function public.search_shops(text) from anon, authenticated;
grant execute on function public.search_shops(text) to anon, authenticated;
