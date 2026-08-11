-- Docsy 0006 — resumable checkout
--
-- Gives every order a URL of its own. Two things follow from that:
--
--   1. A buyer whose phone died, or who closed the tab, can return to the same
--      order and finish it instead of starting again — and finish it against the
--      same row, so nothing is charged or delivered twice.
--   2. There is somewhere to put payment when a gateway is wired up. The page
--      exists and is already the destination of the buy button, so switching on
--      Stripe becomes a change to one screen rather than a new flow.
--
-- The token is the only credential. It is therefore generated server-side from
-- 24 random bytes, is unique, and expires — it is emailed and pasted around, so
-- it has to be safe to treat as semi-public and worthless once stale.
--
-- What is deliberately NOT here: any column for card data. Card details never
-- reach this database. A gateway tokenises them in the browser and we store its
-- reference, which is what makes an interrupted payment resumable without us
-- holding anything worth stealing.

alter table manual_orders
  add column if not exists checkout_token text,
  add column if not exists checkout_expires_at timestamptz;

-- Backfill so existing rows are reachable by URL too.
update manual_orders
   set checkout_token = encode(gen_random_bytes(24), 'hex')
 where checkout_token is null;

update manual_orders
   set checkout_expires_at = created_at + interval '30 days'
 where checkout_expires_at is null;

create unique index if not exists manual_orders_checkout_token_idx
  on manual_orders (checkout_token);

-- Still no public policy: the checkout page reads the row server-side with the
-- secret key after validating the token. Exposing this table to the anon role
-- would mean every buyer email was one crafted query away.

/**
 * Creates a checkout, or returns the one already open for this buyer and product.
 *
 * Reusing the open row is the point. Without it, a buyer who submits the form
 * twice — a double tap, a back button, a reload — ends up with two pending orders
 * for the same purchase, and the admin has to work out whether to send one file
 * or two. Matching on (product, email, pending) collapses that into one.
 */
create or replace function open_checkout(
  p_product_id uuid,
  p_email text,
  p_name text default null,
  p_note text default null
) returns text language plpgsql security definer set search_path = public as $$
declare
  existing record;
  tok text;
  price numeric(10,2);
  cur text;
begin
  select id, checkout_token into existing
    from manual_orders
   where product_id = p_product_id
     and lower(buyer_email) = lower(btrim(p_email))
     and status = 'pending'
     and (checkout_expires_at is null or checkout_expires_at > now())
   order by created_at desc
   limit 1;

  if existing.id is not null then
    -- Refresh the details in case they corrected a typo on the second attempt.
    update manual_orders
       set buyer_name = coalesce(nullif(btrim(p_name), ''), buyer_name),
           note = coalesce(nullif(btrim(p_note), ''), note),
           checkout_expires_at = now() + interval '30 days'
     where id = existing.id;
    return existing.checkout_token;
  end if;

  -- Price is read here rather than accepted from the caller, for the same reason
  -- the server action re-reads it: a number that arrived from a browser is a
  -- suggestion. A draft or archived product yields no row and no checkout.
  select p.price, p.currency into price, cur
    from products p
   where p.id = p_product_id and p.status = 'active';

  if price is null then
    return null;
  end if;

  tok := encode(gen_random_bytes(24), 'hex');

  insert into manual_orders (
    product_id, buyer_email, buyer_name, note, amount, currency,
    status, checkout_token, checkout_expires_at
  ) values (
    p_product_id, lower(btrim(p_email)), nullif(btrim(p_name), ''), nullif(btrim(p_note), ''),
    price, cur, 'pending', tok, now() + interval '30 days'
  );

  return tok;
end;
$$;

-- Server-side only: called by the checkout action with the secret key.
revoke execute on function open_checkout(uuid, text, text, text) from anon, authenticated;
