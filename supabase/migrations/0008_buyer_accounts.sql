-- Docsy 0008 — buyer accounts, wishlists, and campaign consent
--
-- Buyers and admins share auth.users but are distinguished by which side table
-- they appear in: admin_users grants the admin panel, buyer_profiles grants a
-- customer dashboard. A buyer signing in therefore cannot reach /admin, because
-- is_admin() looks in admin_users and finds nothing — the separation is a
-- property of the data, not of route naming.

-- ------------------------------------------------------------ buyer_profiles
create table if not exists buyer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,

  /**
   * True until the buyer has chosen their own password.
   *
   * Accounts created during checkout are reached through an emailed link rather
   * than a password we invented, so there is a window where the account exists
   * and has no password the buyer knows. This flag is what forces them through
   * the set-password screen before the dashboard will render.
   */
  must_set_password boolean not null default true,

  /**
   * Campaign consent, separate from transactional email. A receipt or a download
   * link is part of the purchase and always sends; a marketing campaign must not.
   * Conflating the two is how a shop ends up in spam folders.
   */
  marketing_opt_in boolean not null default true,
  unsubscribed_at timestamptz,

  -- One-click unsubscribe without needing to be signed in.
  unsubscribe_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists buyer_profiles_email_idx on buyer_profiles (lower(email));

drop trigger if exists buyer_profiles_set_updated_at on buyer_profiles;
create trigger buyer_profiles_set_updated_at
  before update on buyer_profiles
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------ wishlists
create table if not exists wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Saving the same product twice is not a different intention.
  unique (user_id, product_id)
);

create index if not exists wishlists_user_idx on wishlists (user_id, created_at desc);
create index if not exists wishlists_product_idx on wishlists (product_id);

-- ------------------------------------------------- link orders to an account
alter table manual_orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists manual_orders_user_idx on manual_orders (user_id, created_at desc);

alter table orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- --------------------------------------------------------------------- RLS
alter table buyer_profiles enable row level security;
alter table wishlists      enable row level security;

drop policy if exists buyer_profiles_self on buyer_profiles;
create policy buyer_profiles_self on buyer_profiles
  for select using (id = auth.uid());

drop policy if exists buyer_profiles_self_update on buyer_profiles;
create policy buyer_profiles_self_update on buyer_profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists buyer_profiles_admin on buyer_profiles;
create policy buyer_profiles_admin on buyer_profiles
  for all using (is_admin()) with check (is_admin());

-- A wishlist is only ever the signed-in buyer's own.
drop policy if exists wishlists_self on wishlists;
create policy wishlists_self on wishlists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists wishlists_admin_read on wishlists;
create policy wishlists_admin_read on wishlists
  for select using (is_admin());

-- The unsubscribe token is a credential; it must not be readable by the account
-- holder's browser, let alone anyone else's.
revoke select on buyer_profiles from anon, authenticated;
grant select (id, email, full_name, must_set_password, marketing_opt_in, created_at)
  on buyer_profiles to authenticated;

grant select, insert, delete on wishlists to authenticated;

/**
 * Attaches previously-placed orders to an account.
 *
 * Called only once an email is proven — either because the buyer arrived through
 * a link sent to that address, or because Supabase confirmed it. Claiming on an
 * unverified email would let anyone type a stranger's address at signup and
 * inherit their purchase history, including the ability to re-download the files.
 */
create or replace function claim_orders_for_user(p_user_id uuid)
returns int language plpgsql security definer set search_path = public, extensions as $$
declare
  target_email text;
  claimed int;
begin
  select email into target_email
    from auth.users
   where id = p_user_id and email_confirmed_at is not null;

  if target_email is null then
    return 0;
  end if;

  update manual_orders
     set user_id = p_user_id
   where user_id is null
     and lower(buyer_email) = lower(target_email);
  get diagnostics claimed = row_count;

  update orders
     set user_id = p_user_id
   where user_id is null
     and lower(buyer_email) = lower(target_email);

  return claimed;
end;
$$;

revoke execute on function claim_orders_for_user(uuid) from anon, authenticated;

/**
 * Audience segments for campaigns.
 *
 * A single query so the two lists cannot drift apart: "has bought" means at least
 * one delivered order, and "no purchase" is the exact complement among consenting
 * accounts. Unsubscribed and opted-out profiles are excluded from both — that
 * filter belongs here, not in the code that sends, so it cannot be forgotten at a
 * call site.
 */
create or replace view campaign_audience as
  select
    bp.id,
    bp.email,
    bp.full_name,
    bp.created_at,
    coalesce(o.delivered_count, 0) as purchases,
    coalesce(o.total_spent, 0) as total_spent,
    o.last_order_at,
    (coalesce(o.delivered_count, 0) > 0) as has_purchased
  from buyer_profiles bp
  left join (
    select user_id,
           count(*) filter (where status = 'delivered') as delivered_count,
           sum(amount) filter (where status = 'delivered') as total_spent,
           max(created_at) as last_order_at
      from manual_orders
     where user_id is not null
     group by user_id
  ) o on o.user_id = bp.id
  where bp.marketing_opt_in and bp.unsubscribed_at is null;

alter view campaign_audience set (security_invoker = on);
revoke all on campaign_audience from anon, authenticated;
