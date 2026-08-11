-- Docsy 0007 — let the token functions see pgcrypto
--
-- Both token-minting functions are SECURITY DEFINER with `set search_path =
-- public`, which is correct practice: it stops a caller from shadowing a table
-- or function name and having it run with the definer's rights.
--
-- But Supabase installs pgcrypto into the `extensions` schema, not `public`. So
-- pinning the path to public alone hid gen_random_bytes from exactly the two
-- functions that need it, and every call failed with:
--
--   function gen_random_bytes(integer) does not exist
--
-- This was live but unexercised. `issue_download_token` is phase-2 code, so the
-- first thing to hit it would have been a real buyer's download link after a
-- real payment — the worst possible moment to discover it. The backfill in 0006
-- worked only because it ran as a plain statement, where the default search_path
-- already includes extensions.
--
-- Adding `extensions` to the pinned path keeps the shadowing protection (the
-- path is still fixed, not inherited from the caller) while making pgcrypto
-- reachable.

create or replace function issue_download_token(p_order_id uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
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

revoke execute on function issue_download_token(uuid) from anon, authenticated;

create or replace function open_checkout(
  p_product_id uuid,
  p_email text,
  p_name text default null,
  p_note text default null
) returns text language plpgsql security definer set search_path = public, extensions as $$
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
    update manual_orders
       set buyer_name = coalesce(nullif(btrim(p_name), ''), buyer_name),
           note = coalesce(nullif(btrim(p_note), ''), note),
           checkout_expires_at = now() + interval '30 days'
     where id = existing.id;
    return existing.checkout_token;
  end if;

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

revoke execute on function open_checkout(uuid, text, text, text) from anon, authenticated;
