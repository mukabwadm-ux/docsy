-- Docsy 0002 — generated columns, triggers, helper functions

-- --------------------------------------------------------- full-text search
-- Weighted so a title hit outranks a description hit.
alter table products drop column if exists search_vector;
alter table products add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(short_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored;

create index if not exists products_search_idx on products using gin (search_vector);

-- Trigram index powers the autocomplete dropdown, where people type partial
-- words that tsquery will not match ("templ" -> "template").
create extension if not exists pg_trgm;
create index if not exists products_title_trgm_idx
  on products using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------- updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

-- ----------------------------------------------------- review aggregate sync
-- Only approved reviews count toward the public average, so rejecting a review
-- has to move the number back down — hence firing on delete and update too,
-- not just insert.
create or replace function sync_product_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(new.product_id, old.product_id);
begin
  update products p
     set rating_avg = coalesce(agg.avg_rating, 0),
         rating_count = coalesce(agg.n, 0)
    from (
      select round(avg(rating)::numeric, 2) as avg_rating, count(*) as n
        from reviews
       where product_id = target and status = 'approved'
    ) agg
   where p.id = target;
  return null;
end;
$$;

drop trigger if exists reviews_sync_rating on reviews;
create trigger reviews_sync_rating
  after insert or update or delete on reviews
  for each row execute function sync_product_rating();

-- --------------------------------------------------------------- sales_count
-- Counts both delivered manual orders and paid real orders, so the social
-- proof on a product card stays truthful through the phase-1 -> phase-2
-- switchover instead of resetting to zero the day Stripe goes live.
create or replace function sync_product_sales()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(new.product_id, old.product_id);
begin
  if target is null then
    return null;
  end if;

  update products p
     set sales_count = (
       select (select count(*) from orders
                where product_id = target and status = 'paid')
            + (select count(*) from manual_orders
                where product_id = target and status = 'delivered')
     )
   where p.id = target;
  return null;
end;
$$;

drop trigger if exists orders_sync_sales on orders;
create trigger orders_sync_sales
  after insert or update or delete on orders
  for each row execute function sync_product_sales();

drop trigger if exists manual_orders_sync_sales on manual_orders;
create trigger manual_orders_sync_sales
  after insert or update or delete on manual_orders
  for each row execute function sync_product_sales();

-- ------------------------------------------------------------------ is_admin
-- SECURITY DEFINER so it can read admin_users while that table's own policies
-- call back into it — otherwise the policy recurses infinitely.
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users where id = auth.uid());
$$;

grant execute on function is_admin() to anon, authenticated;

-- -------------------------------------------------------------- view counter
-- Public-callable: a page view is not sensitive and the column is advisory.
create or replace function increment_product_views(p_product_id uuid)
returns void language sql security definer set search_path = public as $$
  update products set views_count = views_count + 1 where id = p_product_id;
$$;

grant execute on function increment_product_views(uuid) to anon, authenticated;

-- ------------------------------------------------------------ download token
-- Phase 2. Issued only after a webhook confirms payment.
create or replace function issue_download_token(p_order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  tok text := encode(gen_random_bytes(24), 'hex');
begin
  update orders
     set download_token = tok,
         download_expires_at = now() + interval '30 days'
   where id = p_order_id;
  return tok;
end;
$$;

-- Never public: the download route runs server-side with the secret key.
revoke execute on function issue_download_token(uuid) from anon, authenticated;
