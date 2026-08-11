# Docsy

A digital-products storefront — ebooks, templates, guides and design assets. Next.js 14
(App Router), TypeScript, Supabase, Tailwind.

## Launch checklist

Everything below is already done except steps 4 and 5.

1. **Database** — schema, RLS, triggers and storage buckets are applied.
2. **Admin account** — created. Sign in at `/admin/login`.
3. **Demo catalog** — six placeholder products are live so every page can be seen working.
4. **Your real products** — upload them at `/admin/products`. See below.
5. **Deploy** — push to GitHub, import to Vercel, paste the env vars.

## Running it

```bash
npm run dev          # http://localhost:3000
npm run build        # production build
npm run start        # serve the production build
```

## Adding a real product

1. `/admin/categories` — add a category if you need a new one.
2. `/admin/products/new` — title, price, then **Create product**.
3. On the edit screen that follows:
   - **The file** — upload the actual deliverable. It goes to a private bucket; buyers
     only ever get a link that expires after 7 days.
   - **Images** — the first one becomes the cover and the hero. Add up to 8.
   - **Benefits** — one per line. These become the red-tick list beside the buy button.
     Four or five converts best.
   - **Story blocks** — the pitch. Alternating copy and image down the page.
   - **What you get** — three numbered cards on the cream band.
   - **Announcement bar** — optional urgency strip across the very top.
4. Set status to **Active** and save. It is live within a minute.

Leave any section empty and it disappears from the page rather than rendering a hole.

## Taking an order

Phase 1 has no payment gateway. "Get instant access" collects a name and email and records
the order.

1. `/admin/orders` shows what is waiting, oldest first.
2. **Get link** mints a signed download URL for that product's file.
3. **Email it** opens your mail client with the link and a written message already filled in.
4. **Mark sent** once you have actually sent it — this is what counts toward `sales_count`.

Generating a link and marking an order delivered are separate steps on purpose: you need
the link before you can send anything, so auto-marking would flag orders as fulfilled that
were never emailed.

## Reviews

Visitor reviews arrive as `pending` and stay off the page until approved at
`/admin/reviews`. The same screen lets you add a testimonial you collected yourself — those
are stored as `source='seed'` so they stay distinguishable from organic ones forever.

Approving or rejecting moves the product's star average immediately, via a database
trigger, so the number on the card can never drift from the reviews on the page.

## Scripts

```bash
npm run db:migrate                    # apply supabase/migrations in order (idempotent)
npm run db:seed                       # demo catalog; --wipe clears first
npm run admin:grant you@example.com 'password'
```

## Deploying to Vercel

Import the repo, then set these environment variables from your `.env.local`:

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe |
| `SUPABASE_SECRET_KEY` | **Server only.** Never prefix with `NEXT_PUBLIC_` |
| `DATABASE_URL` | Transaction pooler, port 6543 |
| `DIRECT_URL` | Session pooler, port 5432 — migrations only |
| `NEXT_PUBLIC_SITE_URL` | Your real domain, e.g. `https://getdocsy.com` |

## Phase 2: real checkout

The `orders` table, `issue_download_token()` and the `download_expires_at` column already
exist and are unused. Wiring up a gateway means adding a checkout action and a webhook that
flips an order to `paid` and issues a token — no schema changes, and `sales_count` already
counts paid orders and delivered manual orders together, so the number does not reset to
zero on the day you switch over.

## Architecture notes worth knowing

- **`file_url` is invisible to the public key.** RLS filters rows, not columns, so a column
  grant in `0003_rls.sql` is what stops `select=file_url` from handing out the path to
  every paid file. Public queries therefore name their columns — see `PRODUCT_COLUMNS` in
  `src/lib/queries.ts`. `select *` will fail.
- **Uploads bypass the server.** A Server Action body is capped at 1 MB, so the browser
  uploads straight to Storage using a single-use signed URL. See `src/actions/admin.ts`.
- **The storefront is statically rendered** with a 60-second ISR window. Admin writes call
  `revalidatePath` so edits appear immediately instead of up to a minute later.
