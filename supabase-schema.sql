-- Run this once in Supabase: Project → SQL Editor → New query → paste → Run.
--
-- The app stores each top-level piece of data (rules, company, payments,
-- landing, clients, loans, staff, activity) as one row in this table, with
-- the actual data in a jsonb column. This keeps lib/store.js simple and
-- means no schema migration is needed if you add new fields later — they
-- just live inside the jsonb value.

create table if not exists store_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Keep updated_at current on every write (optional, but handy for debugging).
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists store_kv_set_updated_at on store_kv;
create trigger store_kv_set_updated_at
before update on store_kv
for each row execute function set_updated_at();

-- Row Level Security: the app only ever talks to Supabase using the
-- service role key from server-side API routes, which bypasses RLS by
-- design. Enabling RLS with no policies still blocks the anon/public key
-- from reading or writing this table if it's ever exposed by mistake.
alter table store_kv enable row level security;
