-- Docsy 0010 — display currency and the rate behind it
--
-- Prices are authored in USD and stay that way. KES is a *display* conversion
-- applied at render time, and the amount the buyer actually agrees to is
-- snapshotted onto the order along with the rate that produced it.
--
-- That split is the whole design. Without it, "how much have we earned" becomes
-- unanswerable the moment two currencies are in the orders table: summing raw
-- amounts adds shillings to dollars, and back-converting later uses today's rate
-- rather than the one the buyer saw.

create table if not exists store_settings (
  -- Single row, enforced. A settings table with two rows is a bug that shows up
  -- as prices changing depending on which one a query happened to read.
  id int primary key default 1 check (id = 1),

  /**
   * How many KES to one USD. Set by the owner rather than fetched live: a shop
   * needs a rate it controls, because a mid-session change between the price a
   * buyer saw and the amount they are charged is indefensible, and a free FX API
   * going down should not take pricing with it.
   */
  usd_to_kes numeric(12,4) not null default 129.0000,

  /**
   * KES prices are rounded up to a multiple of this. 19 USD at 129 is 2451,
   * which reads like a rounding artefact; 2460 reads like a price. Rounding up
   * rather than to nearest means the shop is never short after conversion.
   */
  kes_rounding int not null default 10 check (kes_rounding between 1 and 100),

  /** Turn geo detection off entirely and show USD to everyone. */
  geo_pricing_enabled boolean not null default true,

  rate_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into store_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists store_settings_set_updated_at on store_settings;
create trigger store_settings_set_updated_at
  before update on store_settings
  for each row execute function set_updated_at();

alter table store_settings enable row level security;

-- The rate is needed to render a price to an anonymous visitor, so it is public.
-- Nothing here is sensitive; it is the shop's own published exchange rate.
drop policy if exists store_settings_public_read on store_settings;
create policy store_settings_public_read on store_settings for select using (true);

drop policy if exists store_settings_admin_write on store_settings;
create policy store_settings_admin_write on store_settings
  for all using (is_admin()) with check (is_admin());

grant select (id, usd_to_kes, kes_rounding, geo_pricing_enabled, rate_updated_at)
  on store_settings to anon, authenticated;

-- ------------------------------------------- what the buyer actually agreed to
--
-- `amount` and `currency` already record the charge. These add the two things
-- needed to reconcile it: the USD equivalent, which every revenue figure sums,
-- and the rate used, so the arithmetic can be re-checked years later.
alter table manual_orders
  add column if not exists base_amount numeric(10,2),
  add column if not exists fx_rate numeric(12,4);

alter table orders
  add column if not exists base_amount numeric(10,2),
  add column if not exists fx_rate numeric(12,4);

-- Existing orders were all USD, so the base is the amount and the rate is 1.
update manual_orders set base_amount = amount, fx_rate = 1
 where base_amount is null;
update orders set base_amount = amount, fx_rate = 1
 where base_amount is null;

create index if not exists manual_orders_base_amount_idx
  on manual_orders (status) where base_amount is not null;

/**
 * Converts a USD price to the display currency, applying the shop's rate and
 * rounding.
 *
 * In the database so that the storefront, the checkout and the admin all get the
 * same number from the same rule. A second implementation in application code is
 * how a product page and a receipt end up disagreeing by ten shillings.
 */
create or replace function price_in(p_usd numeric, p_currency text)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  s record;
begin
  if p_usd is null then
    return null;
  end if;
  if upper(coalesce(p_currency, 'USD')) = 'USD' then
    return round(p_usd, 2);
  end if;

  select usd_to_kes, kes_rounding into s from store_settings where id = 1;
  if s is null then
    return round(p_usd, 2);
  end if;

  -- ceil to the rounding step: never leave the shop short after conversion.
  return ceil((p_usd * s.usd_to_kes) / s.kes_rounding) * s.kes_rounding;
end;
$$;

grant execute on function price_in(numeric, text) to anon, authenticated;
