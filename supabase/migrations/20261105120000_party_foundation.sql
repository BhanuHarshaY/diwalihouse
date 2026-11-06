-- Diwali House · party foundation
--
-- Parties, their members, invitation codes, guest sessions, and rate-limit
-- buckets. Everything lives in the `diwali` schema, which Supabase's
-- PostgREST does not expose; the browser never talks to the database.
--
-- Isolation model (see docs/architecture.md § Party isolation):
--   1. The application authenticates every request against one party.
--   2. Party-scoped work runs in a transaction that sets `diwali.party_id`
--      and switches to the `diwali_party_scope` role. Row-level security on
--      that role hides every row belonging to any other party, so a query
--      that forgets its `party_id` filter still cannot cross parties.
--   3. Composite foreign keys make it impossible for a session or invite to
--      point at a member of a different party.

create schema if not exists diwali;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'diwali_party_scope') then
    create role diwali_party_scope nologin noinherit;
  end if;
end
$$;

-- The migrating role (the app's connection role) must be able to SET ROLE.
grant diwali_party_scope to current_user;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table diwali.parties (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 64),
  status      text not null default 'open' check (status in ('open', 'closed')),
  max_members integer not null default 50 check (max_members between 2 and 200),
  created_at  timestamptz not null default now()
);

create table diwali.members (
  id           uuid primary key default gen_random_uuid(),
  party_id     uuid not null references diwali.parties (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 32),
  emblem       text not null check (emblem ~ '^[a-z]{2,16}$'),
  role         text not null check (role in ('host', 'guest')),
  joined_at    timestamptz not null default now(),
  left_at      timestamptz,
  removed_at   timestamptz,
  unique (party_id, id)
);

-- Names are unique among the people currently in the party.
create unique index members_active_name_uq
  on diwali.members (party_id, lower(display_name))
  where left_at is null and removed_at is null;

-- Exactly one host per party (host transfer is a later phase).
create unique index members_one_host_uq
  on diwali.members (party_id)
  where role = 'host';

create table diwali.invites (
  id         uuid primary key default gen_random_uuid(),
  party_id   uuid not null references diwali.parties (id) on delete cascade,
  code       text not null unique check (code ~ '^[0-9A-HJKMNP-TV-Z]{8}$'),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (party_id, created_by) references diwali.members (party_id, id)
);

-- At most one live invitation per party; rotating revokes the old one.
create unique index invites_one_active_uq
  on diwali.invites (party_id)
  where revoked_at is null;

create table diwali.member_sessions (
  id           uuid primary key default gen_random_uuid(),
  party_id     uuid not null,
  member_id    uuid not null,
  -- SHA-256 of the bearer token. The token itself is never stored.
  token_hash   bytea not null unique check (octet_length(token_hash) = 32),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  foreign key (party_id, member_id) references diwali.members (party_id, id) on delete cascade
);

create index member_sessions_member_idx on diwali.member_sessions (party_id, member_id);

create table diwali.rate_limit_buckets (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------------------
-- Party scope
-- ---------------------------------------------------------------------------

-- The party the current transaction is scoped to, or NULL when unset. NULL
-- never equals anything, so an unscoped transaction on the scope role sees
-- nothing at all: the policy fails closed.
create function diwali.current_party_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('diwali.party_id', true), '')::uuid $$;

alter table diwali.parties         enable row level security;
alter table diwali.members         enable row level security;
alter table diwali.invites         enable row level security;
alter table diwali.member_sessions enable row level security;
alter table diwali.rate_limit_buckets enable row level security;

create policy party_scope on diwali.parties for all to diwali_party_scope
  using (id = diwali.current_party_id())
  with check (id = diwali.current_party_id());

create policy party_scope on diwali.members for all to diwali_party_scope
  using (party_id = diwali.current_party_id())
  with check (party_id = diwali.current_party_id());

create policy party_scope on diwali.invites for all to diwali_party_scope
  using (party_id = diwali.current_party_id())
  with check (party_id = diwali.current_party_id());

create policy party_scope on diwali.member_sessions for all to diwali_party_scope
  using (party_id = diwali.current_party_id())
  with check (party_id = diwali.current_party_id());

-- Least privilege: parties are created outside the scope, nothing is ever
-- hard-deleted from inside it, and rate limits are not party data.
grant usage on schema diwali to diwali_party_scope;
grant execute on function diwali.current_party_id() to diwali_party_scope;
grant select, update on diwali.parties to diwali_party_scope;
grant select, insert, update on diwali.members, diwali.invites, diwali.member_sessions
  to diwali_party_scope;

-- On Supabase, make sure the API roles can never reach this schema even if
-- someone later adds it to the exposed schemas list.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema diwali from anon, authenticated';
    execute 'revoke all on all tables in schema diwali from anon, authenticated';
  end if;
end
$$;
