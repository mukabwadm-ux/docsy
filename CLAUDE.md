# Docsy

A digital-product storefront (Payhip alternative) for selling ebooks, PDFs, templates,
and guides. Owner uploads products, then markets them.

Status: built and verified. Storefront, admin panel, manual purchase flow and demo catalog
all working against the live database. No payment gateway yet — phase 1 is manual
fulfilment by design. See README.md for how to run and operate it.

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
4. **Database is a clean slate.** No tables in `public`, no storage buckets, 0 auth
   users. Extensions present: `pgcrypto`, `uuid-ossp`, `pg_stat_statements`,
   `supabase_vault`, `plpgsql`.

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
- Only four environment variables are needed in Vercel:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`. `DATABASE_URL` and `DIRECT_URL` are read
  only by `scripts/`, which run locally.
- `NEXT_PUBLIC_*` values are inlined at build time, so changing one in the dashboard has no
  effect until a rebuild.
- `docsy.vercel.app` belongs to someone else. The production alias for this project is
  `docsy-mukabwadm-5850s-projects.vercel.app`.

## Known gaps

- Delivery emails are composed via a `mailto:` link, not sent by a service. Wiring up Resend
  is the obvious next step; `EMAIL_FROM` and `RESEND_API_KEY` are already stubbed in
  `.env.local`.
- No rate limiting on the review or purchase forms.
- The `orders` table is schema-only until a real gateway is wired up.
