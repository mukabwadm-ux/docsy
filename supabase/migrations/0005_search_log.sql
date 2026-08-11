-- Docsy 0005 — what visitors search for
--
-- The most commercially useful signal a shop has is a search that returned
-- nothing: someone arrived wanting to pay for a thing, and we did not have it.
-- Without this table that signal is generated on every search and immediately
-- discarded.
--
-- Aggregated rather than append-only, keyed on the normalised query. A log of
-- individual searches would grow without bound and every read would be a GROUP
-- BY over the whole history; this keeps one row per distinct phrase and makes
-- the admin view a plain ordered select.

create table if not exists search_queries (
  -- Lowercased, whitespace-collapsed form. Primary key, so counting is an upsert.
  normalized text primary key,
  -- Last raw spelling seen, purely so the admin sees "Résumé Template" rather
  -- than the flattened key.
  sample text not null,
  hits int not null default 1,
  -- Result count from the most recent time this was searched. Deliberately not
  -- a historical record: what matters is whether it finds anything *now*.
  result_count int not null default 0,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

-- The two orderings the insights page uses.
create index if not exists search_queries_hits_idx
  on search_queries (hits desc);
create index if not exists search_queries_empty_idx
  on search_queries (hits desc) where result_count = 0;

alter table search_queries enable row level security;

-- Admin-only, and no public policy of any kind. Writes go through a route
-- handler holding the secret key, which is also what stops a visitor from
-- inflating the counts through PostgREST directly.
drop policy if exists search_queries_admin_read on search_queries;
create policy search_queries_admin_read on search_queries
  for select using (is_admin());

revoke select on search_queries from anon, authenticated;

/**
 * Records one search.
 *
 * SECURITY DEFINER with a fixed search_path so the route handler can call it as
 * a single statement rather than doing a read-modify-write, which would lose
 * counts whenever two visitors searched the same phrase at once.
 */
create or replace function record_search(p_query text, p_result_count int)
returns void language plpgsql security definer set search_path = public as $$
declare
  norm text := lower(regexp_replace(btrim(p_query), '\s+', ' ', 'g'));
begin
  -- Junk and single letters are not signal, and unbounded length is a way to
  -- bloat the table.
  if norm is null or length(norm) < 3 or length(norm) > 120 then
    return;
  end if;

  insert into search_queries (normalized, sample, hits, result_count)
  values (norm, btrim(p_query), 1, greatest(p_result_count, 0))
  on conflict (normalized) do update
    set hits = search_queries.hits + 1,
        sample = excluded.sample,
        result_count = excluded.result_count,
        last_seen = now();
end;
$$;

-- Not callable by the browser: it is invoked server-side with the secret key.
revoke execute on function record_search(text, int) from anon, authenticated;
