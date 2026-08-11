-- Docsy 0003 — Row Level Security and column privileges
--
-- Model: the publishable key can read the active catalog and approved reviews.
-- Nothing else, and nothing at all is writable from the browser. Every write,
-- and every read of buyer data, goes through a server action holding the secret
-- key (which bypasses RLS) or an authenticated admin session.

alter table categories     enable row level security;
alter table products       enable row level security;
alter table product_images enable row level security;
alter table reviews        enable row level security;
alter table manual_orders  enable row level security;
alter table orders         enable row level security;
alter table admin_users    enable row level security;

-- ---------------------------------------------------------------- categories
drop policy if exists categories_public_read on categories;
create policy categories_public_read on categories
  for select using (true);

drop policy if exists categories_admin_write on categories;
create policy categories_admin_write on categories
  for all using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------------ products
-- Drafts and archived rows stay invisible to the public.
drop policy if exists products_public_read on products;
create policy products_public_read on products
  for select using (status = 'active');

drop policy if exists products_admin_all on products;
create policy products_admin_all on products
  for all using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------ product_images
drop policy if exists product_images_public_read on product_images;
create policy product_images_public_read on product_images
  for select using (
    exists (select 1 from products p where p.id = product_id and p.status = 'active')
  );

drop policy if exists product_images_admin_all on product_images;
create policy product_images_admin_all on product_images
  for all using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------------- reviews
-- Approved only. There is deliberately no public INSERT policy: a visitor
-- review has to be forced to status='pending' and source='visitor', and a
-- WITH CHECK clause cannot stop a client from simply sending
-- status='approved'. Submissions go through a server action that sets those
-- fields itself.
drop policy if exists reviews_public_read on reviews;
create policy reviews_public_read on reviews
  for select using (status = 'approved');

drop policy if exists reviews_admin_all on reviews;
create policy reviews_admin_all on reviews
  for all using (is_admin()) with check (is_admin());

-- ------------------------------------------------- manual_orders and orders
-- Buyer email addresses. Admin-only, no public policy of any kind.
drop policy if exists manual_orders_admin_all on manual_orders;
create policy manual_orders_admin_all on manual_orders
  for all using (is_admin()) with check (is_admin());

drop policy if exists orders_admin_all on orders;
create policy orders_admin_all on orders
  for all using (is_admin()) with check (is_admin());

-- --------------------------------------------------------------- admin_users
-- A signed-in admin may confirm their own membership; nobody else sees the list.
drop policy if exists admin_users_self_read on admin_users;
create policy admin_users_self_read on admin_users
  for select using (id = auth.uid());

-- ------------------------------------------------------- column privileges
-- RLS decides which ROWS you see; it says nothing about which COLUMNS.
--
-- With only row policies in place, `GET /rest/v1/products?select=file_url`
-- returns the private Storage path of every paid file to anyone holding the
-- publishable key. Those paths are the whole product. Row policies cannot
-- express "this column is off limits" — only a column grant can.
--
-- Consequence: the anon role can no longer `select *` on products. Public
-- queries must name their columns — see PRODUCT_COLUMNS in src/lib/queries.ts.
revoke select on products from anon, authenticated;

grant select (
  id, title, slug, description, short_description,
  benefits, story_content, how_it_works, announcement_text,
  price, compare_at_price, currency, category_id,
  file_size_mb, file_type,
  preview_image_url,
  is_featured, views_count, sales_count,
  rating_avg, rating_count,
  status, created_at, updated_at
) on products to anon, authenticated;

-- Postgres requires the SELECT privilege on any column named in a WHERE
-- clause, not merely in the projection. Omitting this makes
-- `textSearch('search_vector', …)` fail with "permission denied for table
-- products", so every search 500s while the rest of the site looks fine.
--
-- Granting it is safe: a tsvector is a lossy bag of stems derived from title
-- and description, both already public, and no query ever returns the column.
grant select (search_vector) on products to anon, authenticated;

-- Buyer-facing tables never expose a column to the browser at all.
revoke select on manual_orders from anon, authenticated;
revoke select on orders from anon, authenticated;
