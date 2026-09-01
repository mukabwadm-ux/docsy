# Docsy

A digital-product storefront (Payhip alternative) for selling ebooks, PDFs, templates,
and guides. Owner uploads products, then markets them.

Status: built and verified against the live database — storefront, conversion product
pages, live search, resumable checkout, buyer accounts with wishlists, admin panel,
insights, and the full email template set. No payment gateway yet; phase 1 is manual
fulfilment by design. See README.md for how to run and operate it, and
"Where we left off" at the bottom for the current state and what is next.

Stack: Next.js 14 (App Router), TypeScript, Supabase (Postgres + Storage + Auth), Tailwind,
lucide-react. UI primitives are shadcn-style (Radix + CVA) written into `src/components/ui`
rather than pulled in with the CLI.

## Where this lives

| Thing | Value |
| --- | --- |
| Local root | `c:\Users\VIZX\Documents\docsy` |
| Git remote | `https://github.com/mukabwadm-ux/docsy.git` (was empty at setup) |
| Supabase project | `docsy`, ref `jwpmojkhlpcgtuyqcflz`, region `eu-central-1` |
| Postgres | 17.6, database `postgres` (not `docsy` — Supabase always names it `postgres`) |
| Supabase URL | `https://jwpmojkhlpcgtuyqcflz.supabase.co` |

Credentials live in `.env.local` (gitignored). `.env.example` documents the shape.

## Verified infrastructure facts

These were tested on 2026-08-11, not assumed. Re-check before contradicting them.

1. **Direct DB host does not exist.** `db.jwpmojkhlpcgtuyqcflz.supabase.co` returns
   `ENOENT` — no DNS record. The direct connection string in the owner's notes will not
   work. Use the pooler:
   - transaction pooler `aws-0-eu-central-1.pooler.supabase.com:6543` — app queries
   - session pooler `aws-0-eu-central-1.pooler.supabase.com:5432` — migrations, DDL
   - Postgres user is `postgres.jwpmojkhlpcgtuyqcflz`, **not** `postgres`.
2. **The DB password contains a `#`.** Inside any URL it must be percent-encoded as
   `%23` — see the real values in `.env.local`, which is gitignored. A raw `#` starts a
   URL fragment and silently truncates the password, producing an auth failure that looks
   like a wrong password. Passing it to a driver as a literal password field (not a URL)
   needs no encoding.
3. **New-style API keys.** This project uses `sb_publishable_…` / `sb_secret_…`, not the
   legacy `anon` / `service_role` JWTs. They go in the `apikey` header the same way.
   The `sb_secret_` key bypasses RLS — server-side only.
4. **pgcrypto lives in the `extensions` schema, not `public`.** Any SECURITY DEFINER
   function calling `gen_random_bytes` must pin `search_path = public, extensions`.
   Pinning to `public` alone hides it and every call fails with "function
   gen_random_bytes(integer) does not exist" — see migration 0007, which fixed
   exactly that in two token-minting functions.
5. **Eight migrations are applied** (0001–0008). The database was a clean slate at
   setup; it now holds the demo catalog, seeded reviews, and the owner's own test
   order. `npm run db:seed -- --wipe` resets the catalog.

## Conventions

- Secrets never reach the client. Only `NEXT_PUBLIC_*` vars are browser-safe.
- Paid files must never be publicly readable. Use a private storage bucket plus
  short-lived signed URLs issued only after payment is confirmed server-side.
- Every table in `public` gets Row Level Security enabled with explicit policies.

## Design decisions that are not obvious from the code

- **The palette is the conversion reference's, not Sokofy's.** The build spec described the
  colours as "the same tokens as Sokofy", but Sokofy is emerald/violet/amber. The hexes the
  spec actually listed (`#EB2437` red, `#F6E3BB` tan, `#FFF6DB` cream) come from the
  product-page reference image. Those hexes won, since they were stated explicitly and they
  match the layout being copied. Typography (Oswald 700 + Lora) genuinely is shared.
- **The product page is a sales page, not a shop page.** Sokofy's product page is a
  conventional gallery-plus-buy-panel. Docsy's follows the conversion reference:
  announcement bar → hero with proof, benefits and CTA → story blocks → how-it-works →
  reviews → sticky mobile CTA. The `benefits`, `story_content` and `how_it_works` columns
  exist to drive exactly that, and the section order is hard-coded — a seller can empty a
  section but cannot reorder them.
- **`rating_avg`/`rating_count` are denormalised onto products.** Not in the original spec,
  but the catalog cards show stars and can sort by rating; computing that per card would
  make every grid an N+1. A trigger keeps them true.
- **The storefront's speed depends on nothing reading cookies.** In Next 14 a single
  `cookies()` call anywhere in a route's tree makes the whole route render on demand,
  and `Cache-Control` becomes `no-store` — no CDN, a fresh render and fresh Supabase
  queries in eu-central-1 for every visitor. This is easy to reintroduce by accident:
  the product page once read the buyer session just to fill in the wishlist heart, and
  that one call cost the page its prerendering. The heart now resolves itself client-side
  from `/api/wishlist`. If a storefront page needs per-visitor data, fetch it from the
  client rather than in the server render.
- **Layout reads are the other trap, and they hit every page.** `SiteHeader` and
  `Analytics` both read the database. An uncached read in a layout makes every route
  beneath it dynamic — that is why `/privacy` and `/terms`, which have no data at all,
  were once served `no-store`. Those reads go through `src/lib/cache.ts`; keep any new
  layout-level read wrapped the same way.
- **`revalidatePath` does not clear the data cache.** It drops rendered HTML; the cached
  queries behind it survive, so a re-render reads the same stale rows back and the save
  looks ignored. `revalidateStorefront` in `src/actions/admin.ts` therefore calls
  `revalidateTag` for every tag as well. It clears all of them rather than matching tags
  to each mutation, deliberately: it is the one funnel every storefront write passes
  through, and a missed tag is a change the owner cannot see.
- **Three of Sokofy's later bug-fix migrations are folded into Docsy's first four.** Column
  grants, NOT NULL counters, and the `search_vector` grant were each a production bug there;
  they are in the initial schema here. The comments in the migrations explain each one.

## Deployment (Vercel)

- **The framework preset must be Next.js.** It is pinned in `vercel.json` because the
  project was originally built with the "Other" preset, whose default output directory is
  `public/`. A Next.js app emits `.next/` and has no `public/` output, so every build
  succeeded and then failed at hand-off with *No Output Directory named "public" found*.
  The build log looked completely healthy right up to that last line, which made it read
  like an infrastructure problem rather than a settings one.
  Do **not** "fix" that error by creating an empty `public/` directory — that deploys the
  empty directory as a static site instead of the application.
- **Functions run in `fra1`, pinned in `vercel.json`.** Vercel defaults to `iad1`
  (Washington DC) while Supabase is in `eu-central-1` (Frankfurt), so every query on
  a dynamic route crossed the Atlantic — checkout makes several in sequence, and the
  page took ~1.2s warm from Kenya (`x-vercel-id` read `cpt1::iad1`). Putting the
  functions beside the database turns each query into a LAN hop. Buyers are in Kenya
  and Nairobi is closer to Frankfurt than to Washington, so this helps both legs. If
  the Supabase project ever moves region, move this with it.
- **Email never blocks a response.** An SMTP send is about five seconds. Both the
  order confirmation and the post-payment download email used to be awaited while
  the buyer watched a spinner. They now go through `afterResponse` in
  `src/lib/after.ts`, which is `waitUntil` — not a loose promise, because a
  serverless function can be torn down the moment it responds and the email would
  vanish some fraction of the time. The webhook path still awaits delivery: nobody
  is waiting there, and its result should say what actually happened.
- Only four environment variables are needed in Vercel:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`. `DATABASE_URL` and `DIRECT_URL` are read
  only by `scripts/`, which run locally.
- `NEXT_PUBLIC_*` values are inlined at build time, so changing one in the dashboard has no
  effect until a rebuild.
- `docsy.vercel.app` belongs to someone else. The production alias for this project is
  `docsy-mukabwadm-5850s-projects.vercel.app`.

## Known gaps

- **Nothing can send email** until `RESEND_API_KEY` and `EMAIL_FROM` are set. Resend is
  fully wired — templates, one-click send from the orders queue, receipts, access links —
  and degrades to the manual link-and-mail-client path with a banner explaining why. This
  is the single biggest blocker: buyer accounts are created but cannot be opened without it.
- No bulk campaign sending yet. Segments and templates exist; the sender does not.
- No rate limiting on the review, purchase or search forms.
- The `orders` table is schema-only until a real gateway is wired up. `manual_orders`
  carries phase-1 orders, and revenue counts both so the total will not reset at cutover.
- Product `description` is empty on the seeded products, so search only sees their titles
  and one-line summaries. Real copy will noticeably improve search.

## Where we left off (end of 2026-08-11)

Everything below is live on `main` and verified in a browser. Twelve commits,
`efe064a` through `f27151d`.

### Built and working

| Area | State |
| --- | --- |
| Storefront | Homepage, catalog with filters/sorts/pagination, conversion product pages, sitemap, robots, favicon set |
| Search | Live typeahead (header, hero, search page) with category suggestions and a trigram fallback |
| Checkout | Two steps: email on the product page, then a resumable `/checkout/[token]` order screen |
| Buyer accounts | Auto-created on first purchase, emailed single-use link, forced password set, dashboard with re-download, wishlist, settings, one-click unsubscribe |
| Admin | Dashboard with earnings, products CRUD, orders queue with one-click send, reviews, categories, insights, audience segments, email previews |
| Emails | Eight templates on one shell in the site's brand and Oswald/Lora typography — previewable at `/admin/emails` |

### Blocked on the owner, not on code

1. **`RESEND_API_KEY` + `EMAIL_FROM` are not set.** This is the big one: no receipt,
   no delivery email and no account access link can send, so buyer accounts exist but
   cannot be opened. Everything degrades honestly and says so in the admin UI.
2. **Vercel Deployment Protection is still on** — the live URL shows a Vercel login
   to everyone except the owner.
3. **`NEXT_PUBLIC_SITE_URL` still points at `docsy.vercel.app`**, which belongs to a
   different project. `.env.vercel` already carries the intended value.
4. **`docsy.imprinnt.co` is not yet added** in the Vercel dashboard. imprinnt.co is
   already a Vercel domain, so this is mostly a two-click job — but check whether the
   two projects are in the same Vercel scope, since a domain belongs to one account.
5. Payment credentials are coming from the owner.

### Next session

- **Email campaign module.** Sending, not just templates: batching, per-recipient
  unsubscribe tokens, a send record so nobody is mailed twice, bounce handling, and a
  dry-run. The audience view and every template already exist; `campaign_audience`
  applies the consent filter itself, so the sender must read from it rather than from
  `buyer_profiles`.
- **Google and Apple sign-in.** Supabase social providers. Two things to get right:
  a social sign-in must create the `buyer_profiles` row (see `/account/callback`,
  which already backfills a missing profile) and must call `claim_orders_for_user` so
  a buyer who paid as a guest and later signs in with Google inherits their
  purchases. Google verifies the email, so claiming is safe; set
  `must_set_password = false` for social accounts, since there is no password to set.

### Two standing decisions worth not re-litigating

- **No card data ever touches this database.** Resumable checkout stores the order
  and a token, never a card. A gateway tokenises in the browser.
- **No passwords are emailed.** Accounts are opened with a single-use link and the
  buyer chooses their own password. This also proves the email address, which is what
  makes it safe to attach guest orders to the account.
