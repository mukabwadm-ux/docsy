-- Docsy 0004 — Storage buckets
--
-- product-images   : public read. Covers, story images and step images. These
--                    are marketing assets and are meant to be hotlinkable.
-- digital-products : PRIVATE. The paid files themselves. Nothing but the
--                    secret-key server code ever reads an object here, and
--                    only after it has verified the buyer is entitled to it.
--
-- The split is the entire paywall. A public bucket would make every ebook
-- downloadable by URL guess, and no amount of application code could fix that.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 10485760,
  array['image/jpeg','image/png','image/webp','image/avif','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 500 MB ceiling: a design-asset ZIP with layered source files gets large, and
-- a rejected upload halfway through a launch is worse than a big object.
-- allowed_mime_types is deliberately left null — Figma and Canva exports arrive
-- with types we cannot enumerate ahead of time, and the bucket is private, so
-- an unexpected type here is not a security question the way it would be in a
-- public bucket serving them back to browsers.
insert into storage.buckets (id, name, public, file_size_limit)
values ('digital-products', 'digital-products', false, 524288000)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- -------------------------------------------------------- product-images RLS
drop policy if exists "product images are public" on storage.objects;
create policy "product images are public" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "admins manage product images" on storage.objects;
create policy "admins manage product images" on storage.objects
  for all using (bucket_id = 'product-images' and is_admin())
  with check (bucket_id = 'product-images' and is_admin());

-- ------------------------------------------------------ digital-products RLS
-- Note what is absent: any policy granting select to anon or authenticated.
-- Only the secret key reads these objects, and only to mint a short-lived
-- signed URL after checking entitlement.
drop policy if exists "admins manage digital products" on storage.objects;
create policy "admins manage digital products" on storage.objects
  for all using (bucket_id = 'digital-products' and is_admin())
  with check (bucket_id = 'digital-products' and is_admin());
