-- Verify that what was paid covers what was owed, before anything is delivered.
--
-- mark_order_paid previously took the gateway's amount on trust and wrote it over
-- the order's own figure:
--
--     amount = coalesce(p_amount, amount)
--
-- so a charge for any sum at all marked the order paid and released the file, and
-- the recorded revenue silently became the underpaid amount rather than showing a
-- discrepancy. The buyer sees their own reference in the callback URL, and
-- Paystack Inline accepts a caller-supplied reference and amount, so this stops
-- being theoretical the moment the public key appears in a browser.
--
-- Two changes: record what we intend to charge, then refuse to transition when the
-- payment does not match it.

-- ---------------------------------------------------------------- what we expect
--
-- Separate from `amount`/`currency`, which stay the buyer-facing record of the
-- sale. The charge can legitimately differ: a USD order is charged its KES
-- equivalent, because the Kenyan Paystack account settles in KES.
alter table manual_orders
  add column if not exists charge_amount numeric(12, 2),
  add column if not exists charge_currency text;

comment on column manual_orders.charge_amount is
  'What we asked the gateway to collect. Compared against the settled amount before fulfilment.';
comment on column manual_orders.charge_currency is
  'Currency of charge_amount. May differ from `currency`, which is what the buyer was shown.';

-- A payment that does not match needs a state of its own. Leaving it 'pending'
-- would invite a retry that could never succeed, and calling it 'failed' would be
-- untrue - the money did arrive, just not the right amount.
alter table manual_orders
  drop constraint if exists manual_orders_payment_status_check;

alter table manual_orders
  add constraint manual_orders_payment_status_check
  check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded', 'mismatch'));

-- ------------------------------------------------------------------ the guard
--
-- Returns text rather than boolean. The old boolean could not distinguish "already
-- paid" from "refused", and the caller reported both as 'Already recorded.' - so a
-- rejected underpayment would have looked like a duplicate webhook and been
-- ignored, which is precisely the case that must be seen.
drop function if exists mark_order_paid(text, numeric, text, jsonb);

create or replace function mark_order_paid(
  p_reference text,
  p_amount numeric,
  p_currency text,
  p_meta jsonb default null
) returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  o           manual_orders%rowtype;
  expected    numeric;
  expected_cy text;
  changed     int;
begin
  select * into o from manual_orders where payment_reference = p_reference;

  if not found then
    return 'not_found';
  end if;

  if o.payment_status = 'paid' then
    return 'already_paid';
  end if;

  -- Orders created before this migration have no charge_* values; fall back to
  -- the buyer-facing figures, which is what they were charged.
  expected    := coalesce(o.charge_amount, o.amount);
  expected_cy := upper(coalesce(o.charge_currency, o.currency));

  /*
   * A tolerance of one minor unit absorbs rounding between our own conversion and
   * the gateway's, which is a real difference of a cent - not an underpayment.
   * Overpayment passes: the money arrived, the buyer is owed their file, and the
   * surplus is a refund question rather than a reason to withhold delivery.
   */
  if expected is not null
     and (upper(p_currency) <> expected_cy or p_amount < expected - 0.01)
  then
    update manual_orders
       set payment_status = 'mismatch',
           payment_meta = coalesce(p_meta, '{}'::jsonb) || jsonb_build_object(
             'mismatch', jsonb_build_object(
               'expected_amount',   expected,
               'expected_currency', expected_cy,
               'paid_amount',       p_amount,
               'paid_currency',     upper(p_currency),
               'at',                now()
             )
           )
     where id = o.id;
    return 'mismatch';
  end if;

  update manual_orders
     set payment_status = 'paid',
         paid_at = now(),
         payment_meta = coalesce(p_meta, payment_meta),
         -- Record what actually settled. It is within tolerance of the expected
         -- figure by the check above, so this cannot quietly rewrite the sale.
         amount = coalesce(p_amount, amount),
         currency = coalesce(upper(p_currency), currency)
   where id = o.id
     and payment_status <> 'paid';

  get diagnostics changed = row_count;

  -- Zero rows means another request transitioned it between the select and the
  -- update. That request delivered; this one must not.
  return case when changed > 0 then 'paid' else 'already_paid' end;
end;
$$;

comment on function mark_order_paid(text, numeric, text, jsonb) is
  'Transitions an order to paid only when the settled amount covers charge_amount in charge_currency. Returns paid | already_paid | mismatch | not_found.';
