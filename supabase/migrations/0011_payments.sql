-- Docsy 0011 — real payments
--
-- Payment columns go onto manual_orders rather than switching to the unused
-- `orders` table. Everything already points at manual_orders — the admin queue,
-- every revenue figure, the buyer dashboard, the campaign audience view — and
-- moving would mean re-pointing all of it for no gain the buyer can see. The
-- table's name is now a slight misnomer; that is cheaper than the migration.
--
-- Two independent states, deliberately not collapsed into one:
--
--   payment_status — has the money arrived?
--   status         — has the file been sent?
--
-- They are usually both settled within a second of each other now that delivery
-- is automatic. Keeping them apart is what makes "paid but not delivered" a
-- visible, fixable state rather than an invisible one.

alter table manual_orders
  add column if not exists payment_provider text,
  add column if not exists payment_reference text,
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  add column if not exists paid_at timestamptz,
  -- What the gateway said, kept verbatim for reconciliation and disputes.
  add column if not exists payment_meta jsonb;

/**
 * One order per gateway reference.
 *
 * This is the idempotency guarantee for the webhook. Paystack retries delivery
 * and can send the same charge.success more than once; without a unique
 * reference, a retry could be applied twice — and since payment now triggers
 * delivery, twice means two emails and a double-counted sale.
 */
create unique index if not exists manual_orders_payment_reference_idx
  on manual_orders (payment_reference) where payment_reference is not null;

create index if not exists manual_orders_payment_status_idx
  on manual_orders (payment_status, created_at desc);

-- Existing rows predate payments: they were arranged by hand, so they are marked
-- as such rather than left looking unpaid.
update manual_orders
   set payment_provider = 'manual',
       payment_status = case when status = 'delivered' then 'paid' else 'unpaid' end,
       paid_at = case when status = 'delivered' then coalesce(delivered_at, created_at) else null end
 where payment_provider is null;

/**
 * Marks an order paid, exactly once.
 *
 * The whole transition is one statement guarded by `payment_status <> 'paid'`, so
 * two concurrent webhook deliveries cannot both pass the check and both proceed —
 * the second updates zero rows and gets `false` back. Doing this as a read, a
 * decision and then a write in application code is precisely the race that sends
 * a buyer two copies of their file.
 *
 * Returns true only for the call that actually made the transition, so only that
 * caller sends the delivery email.
 */
create or replace function mark_order_paid(
  p_reference text,
  p_amount numeric,
  p_currency text,
  p_meta jsonb default null
) returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  changed int;
begin
  update manual_orders
     set payment_status = 'paid',
         paid_at = now(),
         payment_meta = coalesce(p_meta, payment_meta),
         -- Trust the gateway's figures over our own snapshot: this is what was
         -- actually collected, and a mismatch should be visible in the record.
         amount = coalesce(p_amount, amount),
         currency = coalesce(upper(p_currency), currency)
   where payment_reference = p_reference
     and payment_status <> 'paid';

  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke execute on function mark_order_paid(text, numeric, text, jsonb) from anon, authenticated;

-- Revenue counts a delivered manual order or a paid one. With payments live the
-- two coincide, but a hand-arranged sale still has no payment_status of 'paid'.
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
                where product_id = target
                  and (status = 'delivered' or payment_status = 'paid'))
     )
   where p.id = target;
  return null;
end;
$$;
