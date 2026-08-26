-- Docsy 0012 — configuration the owner can edit without a deploy
--
-- Two kinds of value live here and they are treated very differently.
--
-- Public config (a Google Analytics ID, a Paystack *public* key, a support email)
-- is not sensitive — it ships to the browser anyway — and is stored as plain text.
--
-- Secrets (a Paystack secret key, an SMTP password) are stored encrypted with a
-- key that lives in the environment and never in this database. An attacker who
-- reaches Postgres therefore gets ciphertext; they need the environment too. That
-- is the whole reason this table can exist at all: a payment secret sitting in
-- plaintext in a row would be a worse arrangement than the env-var-only setup it
-- replaces.
--
-- Environment variables still win where both are present. The environment is the
-- more trusted source, and it means someone who can write to this table cannot
-- redirect the shop's payments.

create table if not exists app_config (
  key text primary key,

  /** Plain text for public config; AES-256-GCM ciphertext for secrets. */
  value text,

  /**
   * Set by the application from its own registry, not by the caller, so a value
   * cannot be smuggled in as public and then read back.
   */
  is_secret boolean not null default false,

  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

drop trigger if exists app_config_set_updated_at on app_config;
create trigger app_config_set_updated_at
  before update on app_config
  for each row execute function set_updated_at();

alter table app_config enable row level security;

drop policy if exists app_config_admin on app_config;
create policy app_config_admin on app_config
  for all using (is_admin()) with check (is_admin());

/**
 * No public access of any kind, not even to the non-secret rows.
 *
 * The storefront does need some of these — the analytics ID, for instance — but it
 * reads them server-side with the secret key and renders the result. Granting the
 * anon role access to this table would mean one crafted query returned the whole
 * configuration surface, ciphertext included, and ciphertext is worth having only
 * as long as nobody can collect it at leisure.
 */
revoke all on app_config from anon, authenticated;
