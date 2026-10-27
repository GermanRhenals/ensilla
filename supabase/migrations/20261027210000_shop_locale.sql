-- Regional settings per shop: dates, prices and WhatsApp follow its country.
alter table public.shop_setting
  add column if not exists locale text not null default 'es-CO';

alter table public.shop_setting
  add column if not exists whatsapp_country_code text not null default '57';

alter table public.shop_setting
  alter column timezone set default 'America/Bogota';

alter table public.shop_setting
  alter column currency set default 'COP';

-- Normalize only untouched fresh installs. Configured shops keep their values.
update public.shop_setting
set timezone = 'America/Bogota',
    currency = 'COP',
    locale = 'es-CO',
    whatsapp_country_code = '57'
where id = 1
  and timezone = 'America/Argentina/Buenos_Aires'
  and currency = 'ARS'
  and not exists (select 1 from public.services);
