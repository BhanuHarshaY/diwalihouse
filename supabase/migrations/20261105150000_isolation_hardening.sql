-- Diwali House · isolation hardening (from the Phase 1 security review)
--
-- 1. Name uniqueness on a normalised key, so "Asha" and "Ａｓｈａ" (fullwidth)
--    cannot both be in one party. The key is computed by the app
--    (`nameKey()` in @diwali/contracts): NFKC, lower case, shaping marks removed.
-- 2. Column-level UPDATE grants: inside the party scope, only the columns the
--    service actually changes are writable. A bug or injection there can no
--    longer promote a guest to host or extend a session.
-- 3. Functions in the schema are no longer executable by PUBLIC.

alter table diwali.members add column name_key text;
update diwali.members set name_key = lower(display_name);
alter table diwali.members alter column name_key set not null;
alter table diwali.members
  add constraint members_name_key_length check (char_length(name_key) between 1 and 64);

drop index diwali.members_active_name_uq;
create unique index members_active_name_uq
  on diwali.members (party_id, name_key)
  where left_at is null and removed_at is null;

revoke update on diwali.parties, diwali.members, diwali.invites, diwali.member_sessions
  from diwali_party_scope;
-- `status` also makes `select … for update` on the party row possible.
grant update (status) on diwali.parties to diwali_party_scope;
grant update (left_at, removed_at) on diwali.members to diwali_party_scope;
grant update (revoked_at) on diwali.invites to diwali_party_scope;
grant update (revoked_at, last_seen_at) on diwali.member_sessions to diwali_party_scope;

revoke execute on function diwali.current_party_id() from public;
grant execute on function diwali.current_party_id() to diwali_party_scope;
alter default privileges in schema diwali revoke execute on functions from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'alter default privileges in schema diwali revoke all on tables from anon, authenticated';
    execute 'alter default privileges in schema diwali revoke all on functions from anon, authenticated';
  end if;
end
$$;
