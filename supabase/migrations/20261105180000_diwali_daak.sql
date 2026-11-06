-- Diwali House · Diwali Daak, the party's guestbook of postcards
--
-- Same isolation model as the rest of the schema: row-level security on the
-- scope role, a composite foreign key so a postcard can only be written by a
-- member of its own party, and column-level UPDATE grants. Postcards are
-- never deleted from inside the scope: the writer withdraws one, the host
-- hides one, and both are reversible records.

create table diwali.postcards (
  id           uuid primary key default gen_random_uuid(),
  party_id     uuid not null references diwali.parties (id) on delete cascade,
  author_id    uuid not null,
  -- Who it is to, in the writer's words. Null: to everyone at the party.
  to_line      text check (to_line is null or char_length(to_line) between 1 and 40),
  message      text not null check (char_length(message) between 1 and 280),
  stamp        text not null check (stamp ~ '^[a-z]{2,16}$'),
  created_at   timestamptz not null default now(),
  withdrawn_at timestamptz,
  hidden_at    timestamptz,
  foreign key (party_id, author_id) references diwali.members (party_id, id) on delete cascade
);

create index postcards_party_created_idx on diwali.postcards (party_id, created_at desc);
create index postcards_author_idx on diwali.postcards (party_id, author_id);

alter table diwali.postcards enable row level security;

create policy party_scope on diwali.postcards for all to diwali_party_scope
  using (party_id = diwali.current_party_id())
  with check (party_id = diwali.current_party_id());

grant select, insert on diwali.postcards to diwali_party_scope;
grant update (withdrawn_at, hidden_at) on diwali.postcards to diwali_party_scope;
