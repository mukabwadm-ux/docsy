-- Docsy 0001 — core schema
--
-- A digital-only catalog: ebooks, templates, guides and design assets. Every
-- product is a file behind a paywall, so unlike a physical catalog there is no
-- stock, no shipping and no variant matrix — the interesting columns are all
-- about *selling* the file (benefits, story, proof) rather than describing it.
--
-- Counters and aggregates are declared NOT NULL with defaults on purpose. A
-- PostgREST bulk insert sends the union of keys across the payload, so a key
-- omitted on one row arrives as an explicit NULL rather than falling back to
-- the column default. Left nullable, that silently produces NULL counters and
-- any arithmetic over them (sorting, scoring) evaluates to NULL for the whole
-- row. NOT NULL turns that into a loud failure at insert time instead.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- categories
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  icon text,                                    -- lucide icon name
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ products
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  short_description text,

  -- Conversion-page content. These three drive the product page's structure,
  -- which is why they live on the product rather than in a CMS: a product
  -- without benefits has no hero, and that must be visible when editing it.
  benefits text[] not null default '{}',        -- hero bullet points
  story_content jsonb not null default '[]',    -- [{heading, body, image_url}]
  how_it_works jsonb not null default '[]',     -- [{step_number, title, caption, image_url}]
  announcement_text text,                       -- optional urgency bar copy

  price numeric(10,2) not null,
  compare_at_price numeric(10,2),               -- shows as a struck-through anchor
  currency text not null default 'USD',
  category_id uuid references categories(id) on delete set null,

  -- Deliverable. file_url is a path inside the PRIVATE bucket, never a URL the
  -- browser can use. Column-level grants in 0003 keep it away from the anon
  -- role entirely — RLS filters rows, not columns, so without that grant a
  -- crafted `select=file_url` would hand every paid file's path to anyone.
  file_url text,
  file_size_mb numeric,
  file_type text,                               -- 'pdf' | 'zip' | 'figma' | 'canva' | ...

  preview_image_url text,
  is_featured boolean not null default false,
  views_count int not null default 0,
  sales_count int not null default 0,

  -- Denormalised review aggregates, maintained by trigger in 0002.
  -- Kept on-row so a catalog page is a single-table read and the stars render
  -- in the first paint — no post-hydration layout shift on the grid.
  rating_avg numeric(3,2) not null default 0,
  rating_count int not null default 0,

  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_status_created_idx
  on products (status, created_at desc);
create index if not exists products_category_idx
  on products (category_id) where status = 'active';
create index if not exists products_featured_idx
  on products (is_featured) where status = 'active' and is_featured;

-- ------------------------------------------------------------ product_images
create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_idx
  on product_images (product_id, sort_order);

-- ------------------------------------------------------------------- reviews
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  reviewer_name text not null,
  reviewer_location text,                       -- "London, UK" — reads as real proof
  rating int not null check (rating between 1 and 5),
  review_text text,
  source text not null default 'visitor' check (source in ('seed', 'visitor')),
  is_verified_purchase boolean not null default false,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists reviews_product_status_idx
  on reviews (product_id, status, created_at desc);

-- ------------------------------------------------------------- manual_orders
-- Phase 1 purchase intent. No gateway is wired up yet: the buyer submits an
-- email, we record it, and the file is delivered by hand. This exists as its
-- own table rather than as a status on `orders` so that switching on real
-- checkout later does not require untangling test rows from paid ones.
create table if not exists manual_orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  buyer_email text not null,
  buyer_name text,
  note text,                                    -- anything the buyer asked for
  amount numeric(10,2),                         -- price snapshot at request time
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending', 'delivered')),
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists manual_orders_status_idx
  on manual_orders (status, created_at desc);

-- -------------------------------------------------------------------- orders
-- Phase 2. Deliberately unused until a real gateway is wired up; it exists now
-- so that the download-token machinery and the admin order views have a stable
-- shape to be built against, and switching on Stripe is additive.
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  buyer_email text not null,
  buyer_name text,
  amount numeric(10,2),
  currency text not null default 'USD',
  payment_provider text,
  payment_reference text unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  download_token text unique,
  download_count int not null default 0,
  download_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists orders_email_idx on orders (buyer_email);
create index if not exists orders_status_idx on orders (status, created_at desc);

-- --------------------------------------------------------------- admin_users
create table if not exists admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);
