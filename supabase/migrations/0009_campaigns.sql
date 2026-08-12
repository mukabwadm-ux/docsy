-- Docsy 0009 — email campaigns
--
-- Two tables, and the important one is `campaign_sends`.
--
-- A campaign is not sent by looping over an audience query. It is sent by first
-- writing one row per intended recipient, then working through those rows. That
-- shape buys three things that a loop cannot:
--
--   * Nobody is mailed twice. The unique constraint on (campaign_id, user_id) is
--     what enforces it, so a double-clicked send button, a retried request or two
--     browser tabs cannot produce a second email — the insert simply conflicts.
--   * A run is resumable. Serverless requests have a hard time limit, so a list
--     of any size has to be sent across several invocations. Pending rows are the
--     queue, and an interrupted run leaves a correct one behind.
--   * The result is auditable. "Who did this campaign actually reach, and what
--     failed" is a select, not a guess.

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,

  -- Content. Mirrors the campaignEmail() template's inputs.
  subject text not null,
  heading text not null,
  intro text not null,
  bullets text[] not null default '{}',
  cta_label text not null default 'Browse the shop',
  cta_url text not null,

  /**
   * Which segment to send to, resolved against the campaign_audience view at send
   * time rather than stored as a list of people. A campaign written on Monday and
   * sent on Friday should reach Friday's audience.
   */
  audience text not null default 'all'
    check (audience in ('all', 'purchased', 'no-purchase')),

  status text not null default 'draft'
    check (status in ('draft', 'sending', 'paused', 'sent', 'failed')),

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists campaigns_status_idx on campaigns (status, created_at desc);

drop trigger if exists campaigns_set_updated_at on campaigns;
create trigger campaigns_set_updated_at
  before update on campaigns
  for each row execute function set_updated_at();

-- ------------------------------------------------------------ campaign_sends
create table if not exists campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Snapshotted, not joined. If the buyer later changes their address, this still
  -- records where the message actually went.
  email text not null,

  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),

  -- The whole point. One row per person per campaign, enforced by the database
  -- rather than by remembering to check.
  unique (campaign_id, user_id)
);

-- The send loop's only query: the next pending rows for one campaign.
create index if not exists campaign_sends_queue_idx
  on campaign_sends (campaign_id, status, created_at);

alter table campaigns      enable row level security;
alter table campaign_sends enable row level security;

drop policy if exists campaigns_admin on campaigns;
create policy campaigns_admin on campaigns
  for all using (is_admin()) with check (is_admin());

drop policy if exists campaign_sends_admin on campaign_sends;
create policy campaign_sends_admin on campaign_sends
  for all using (is_admin()) with check (is_admin());

-- Recipient email addresses. No public access of any kind.
revoke select on campaigns from anon, authenticated;
revoke select on campaign_sends from anon, authenticated;

/**
 * Snapshots the audience for a campaign into campaign_sends.
 *
 * Reads campaign_audience, which already excludes anyone who opted out or
 * unsubscribed — putting that filter in the view means it cannot be forgotten
 * here or anywhere else.
 *
 * `on conflict do nothing` makes this safe to call more than once: a second call
 * adds people who have joined the segment since, and cannot duplicate anyone who
 * is already queued or already sent. Returns how many rows were newly added.
 */
create or replace function queue_campaign(p_campaign_id uuid)
returns int language plpgsql security definer set search_path = public, extensions as $$
declare
  target_audience text;
  added int;
begin
  select audience into target_audience from campaigns where id = p_campaign_id;
  if target_audience is null then
    return 0;
  end if;

  insert into campaign_sends (campaign_id, user_id, email)
  select p_campaign_id, a.id, a.email
    from campaign_audience a
   where target_audience = 'all'
      or (target_audience = 'purchased' and a.has_purchased)
      or (target_audience = 'no-purchase' and not a.has_purchased)
  on conflict (campaign_id, user_id) do nothing;

  get diagnostics added = row_count;
  return added;
end;
$$;

revoke execute on function queue_campaign(uuid) from anon, authenticated;

/**
 * How many people a campaign would reach, without queueing anything.
 *
 * Powers the dry run. Sending a marketing email is not undoable, so seeing the
 * real number first is the difference between a campaign and an incident.
 */
create or replace function campaign_audience_size(p_audience text)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
    from campaign_audience a
   where p_audience = 'all'
      or (p_audience = 'purchased' and a.has_purchased)
      or (p_audience = 'no-purchase' and not a.has_purchased);
$$;

revoke execute on function campaign_audience_size(text) from anon, authenticated;
