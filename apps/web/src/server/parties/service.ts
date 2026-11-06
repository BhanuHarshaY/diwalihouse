import {
  DAAK_LIMITS,
  generateInviteCode,
  nameKey,
  type CreatePartyInput,
  type DaakSnapshot,
  type EmblemId,
  type JoinPartyInput,
  type MemberRole,
  type PartySnapshot,
  type PostcardInput,
  type StampId,
} from '@diwali/contracts';
import type { Sql, TransactionSql } from '@diwali/db';
import { DomainError, isUniqueViolation } from '../errors';
import { enterPartyScope, isUuid, withPartyScope } from '../scope';
import { hashToken, isWellFormedToken, newSessionToken } from '../tokens';

/**
 * Party service: the only code that reads or writes party data.
 *
 * Two kinds of entry point:
 *  - Unscoped (`createParty`, `previewInvite`, `joinParty`, `authenticate`)
 *    take no identity; they either create a party, resolve an invitation
 *    code, or check a credential.
 *  - Scoped functions take a `MemberContext`, which only `authenticate` can
 *    produce. Holding one proves the caller presented a live session for
 *    that party. Each scoped function still re-checks membership and role
 *    inside its own transaction, so a member removed mid-request loses access
 *    immediately.
 */

declare const authenticated: unique symbol;

export interface MemberContext {
  readonly partyId: string;
  readonly memberId: string;
  readonly role: MemberRole;
  readonly sessionId: string;
  readonly [authenticated]: true;
}

export interface IssuedSession {
  partyId: string;
  memberId: string;
  /** Bearer token for the session cookie. Never log or persist it. */
  token: string;
}

export const SESSION_TTL_DAYS = 30;

// ---------------------------------------------------------------------------
// Unscoped entry points
// ---------------------------------------------------------------------------

export async function createParty(
  sql: Sql,
  input: CreatePartyInput,
): Promise<IssuedSession & { inviteCode: string }> {
  const session = newSessionToken();
  return (await sql.begin(async (tx) => {
    const [party] = await tx<{ id: string }[]>`
      insert into diwali.parties (name) values (${input.partyName}) returning id`;
    if (!party) throw new Error('party insert returned no row');

    // Everything after the party row exists goes through the RLS scope.
    await enterPartyScope(tx, party.id);

    const [host] = await tx<{ id: string }[]>`
      insert into diwali.members (party_id, display_name, name_key, emblem, role)
      values (${party.id}, ${input.displayName}, ${nameKey(input.displayName)}, ${input.emblem}, 'host')
      returning id`;
    if (!host) throw new Error('host insert returned no row');

    const inviteCode = await insertInvite(tx, party.id, host.id);
    await insertSession(tx, party.id, host.id, session.hash);
    return { partyId: party.id, memberId: host.id, token: session.token, inviteCode };
  })) as IssuedSession & { inviteCode: string };
}

export interface ResolvedInvite {
  partyId: string;
  partyName: string;
  hostName: string;
  memberCount: number;
  joinable: boolean;
}

/**
 * Looks up a live invitation by canonical code. Returns only what someone
 * holding the code is entitled to see before joining.
 */
export async function previewInvite(sql: Sql, code: string): Promise<ResolvedInvite | null> {
  const [row] = await sql<
    {
      party_id: string;
      party_name: string;
      host_name: string;
      member_count: number;
      max_members: number;
      status: string;
    }[]
  >`
    select
      p.id as party_id,
      p.name as party_name,
      p.status,
      p.max_members,
      h.display_name as host_name,
      (select count(*)::int from diwali.members m
        where m.party_id = p.id and m.left_at is null and m.removed_at is null) as member_count
    from diwali.invites i
    join diwali.parties p on p.id = i.party_id
    join diwali.members h on h.party_id = p.id and h.role = 'host'
    where i.code = ${code} and i.revoked_at is null`;
  if (!row) return null;
  return {
    partyId: row.party_id,
    partyName: row.party_name,
    hostName: row.host_name,
    memberCount: row.member_count,
    joinable: row.status === 'open' && row.member_count < row.max_members,
  };
}

export async function joinParty(
  sql: Sql,
  code: string,
  input: JoinPartyInput,
): Promise<IssuedSession> {
  const [invite] = await sql<{ party_id: string }[]>`
    select party_id from diwali.invites where code = ${code} and revoked_at is null`;
  if (!invite) throw new DomainError('invite_not_found');

  const session = newSessionToken();
  try {
    return await withPartyScope(sql, invite.party_id, async (tx) => {
      // Lock the party row: serialises joins against each other (capacity)
      // and against invite rotation (a code revoked mid-join is refused).
      const [party] = await tx<{ status: string; max_members: number }[]>`
        select status, max_members from diwali.parties
        where id = ${invite.party_id} for update`;
      const [stillLive] = await tx`
        select 1 from diwali.invites where code = ${code} and revoked_at is null`;
      if (!party || !stillLive) throw new DomainError('invite_not_found');
      if (party.status !== 'open') throw new DomainError('party_closed');

      const [{ count } = { count: 0 }] = await tx<{ count: number }[]>`
        select count(*)::int as count from diwali.members
        where party_id = ${invite.party_id} and left_at is null and removed_at is null`;
      if (count >= party.max_members) throw new DomainError('party_full');

      const [member] = await tx<{ id: string }[]>`
        insert into diwali.members (party_id, display_name, name_key, emblem, role)
        values (${invite.party_id}, ${input.displayName}, ${nameKey(input.displayName)},
                ${input.emblem}, 'guest')
        returning id`;
      if (!member) throw new Error('member insert returned no row');

      await insertSession(tx, invite.party_id, member.id, session.hash);
      return { partyId: invite.party_id, memberId: member.id, token: session.token };
    });
  } catch (error) {
    if (isUniqueViolation(error, 'members_active_name_uq')) {
      throw new DomainError('name_taken', undefined, {
        displayName: ['Someone in the party already goes by that name.'],
      });
    }
    throw error;
  }
}

/**
 * Resolves a session token presented for one specific party. A token issued
 * by any other party resolves to `null`: the lookup runs inside that party's
 * scope, where other parties' sessions do not exist.
 */
export async function authenticate(
  sql: Sql,
  partyId: string,
  token: string | undefined,
): Promise<MemberContext | null> {
  if (!isUuid(partyId) || !isWellFormedToken(token)) return null;
  const hash = hashToken(token);

  return withPartyScope(sql, partyId, async (tx) => {
    const [row] = await tx<{ session_id: string; member_id: string; role: MemberRole }[]>`
      select s.id as session_id, m.id as member_id, m.role
      from diwali.member_sessions s
      join diwali.members m on m.party_id = s.party_id and m.id = s.member_id
      where s.token_hash = ${hash}
        and s.party_id = ${partyId}
        and s.revoked_at is null
        and s.expires_at > now()
        and m.left_at is null
        and m.removed_at is null`;
    if (!row) return null;

    await tx`
      update diwali.member_sessions set last_seen_at = now()
      where id = ${row.session_id} and last_seen_at < now() - interval '1 minute'`;

    return {
      partyId,
      memberId: row.member_id,
      role: row.role,
      sessionId: row.session_id,
    } as MemberContext;
  });
}

// ---------------------------------------------------------------------------
// Scoped operations
// ---------------------------------------------------------------------------

/**
 * The caller's view of the party. Only the host receives the invitation code:
 * if guests could see it, a guest who leaked the code could read the new one
 * the moment the host rotated it.
 */
export async function getPartySnapshot(sql: Sql, ctx: MemberContext): Promise<PartySnapshot> {
  return withPartyScope(sql, ctx.partyId, async (tx) => {
    const role = await requireActiveRole(tx, ctx);
    const [party] = await tx<
      {
        id: string;
        name: string;
        status: 'open' | 'closed';
        max_members: number;
        created_at: Date;
      }[]
    >`
      select id, name, status, max_members, created_at
      from diwali.parties where id = ${ctx.partyId}`;
    if (!party) throw new DomainError('not_authenticated');

    const members = await tx<
      { id: string; display_name: string; emblem: EmblemId; role: MemberRole; joined_at: Date }[]
    >`
      select id, display_name, emblem, role, joined_at
      from diwali.members
      where party_id = ${ctx.partyId} and left_at is null and removed_at is null
      order by joined_at, id`;
    const [invite] =
      role === 'host'
        ? await tx<{ code: string }[]>`
            select code from diwali.invites
            where party_id = ${ctx.partyId} and revoked_at is null`
        : [];

    return {
      party: {
        id: party.id,
        name: party.name,
        status: party.status,
        maxMembers: party.max_members,
        createdAt: party.created_at.toISOString(),
      },
      invite: invite ? { code: invite.code } : null,
      me: { memberId: ctx.memberId, role },
      members: members.map((member) => ({
        id: member.id,
        displayName: member.display_name,
        emblem: member.emblem,
        role: member.role,
        joinedAt: member.joined_at.toISOString(),
      })),
    };
  });
}

/** The caller's own name and emblem, for their realtime ticket. */
export async function getMemberProfile(
  sql: Sql,
  ctx: MemberContext,
): Promise<{ displayName: string; emblem: EmblemId; role: MemberRole }> {
  return withPartyScope(sql, ctx.partyId, async (tx) => {
    const role = await requireActiveRole(tx, ctx);
    const [row] = await tx<{ display_name: string; emblem: EmblemId }[]>`
      select display_name, emblem from diwali.members
      where party_id = ${ctx.partyId} and id = ${ctx.memberId}`;
    if (!row) throw new DomainError('not_authenticated');
    return { displayName: row.display_name, emblem: row.emblem, role };
  });
}

/** Revokes the party's live invitation and issues a new code. Host only. */
export async function rotateInvite(sql: Sql, ctx: MemberContext): Promise<{ code: string }> {
  return withPartyScope(sql, ctx.partyId, async (tx) => {
    await tx`select 1 from diwali.parties where id = ${ctx.partyId} for update`;
    await requireActiveRole(tx, ctx, 'host');
    await tx`
      update diwali.invites set revoked_at = now()
      where party_id = ${ctx.partyId} and revoked_at is null`;
    const code = await insertInvite(tx, ctx.partyId, ctx.memberId);
    return { code };
  });
}

/** Removes a guest and ends all of their sessions. Host only. */
export async function removeMember(sql: Sql, ctx: MemberContext, memberId: string): Promise<void> {
  if (!isUuid(memberId)) throw new DomainError('not_found');
  await withPartyScope(sql, ctx.partyId, async (tx) => {
    await requireActiveRole(tx, ctx, 'host');
    if (memberId === ctx.memberId) {
      throw new DomainError('forbidden', 'Hosts cannot remove themselves.');
    }
    const removed = await tx`
      update diwali.members set removed_at = now()
      where party_id = ${ctx.partyId} and id = ${memberId} and role = 'guest'
        and left_at is null and removed_at is null
      returning id`;
    if (removed.length === 0) throw new DomainError('not_found');
    await revokeSessions(tx, ctx.partyId, memberId);
  });
}

/** The caller leaves the party; all of their sessions end. Guests only, for now. */
export async function leaveParty(sql: Sql, ctx: MemberContext): Promise<void> {
  await withPartyScope(sql, ctx.partyId, async (tx) => {
    const role = await requireActiveRole(tx, ctx);
    if (role === 'host') throw new DomainError('host_cannot_leave');
    await tx`
      update diwali.members set left_at = now()
      where party_id = ${ctx.partyId} and id = ${ctx.memberId}`;
    await revokeSessions(tx, ctx.partyId, ctx.memberId);
  });
}

// ---------------------------------------------------------------------------
// Diwali Daak: the guestbook (docs/diwali-daak.md)
// ---------------------------------------------------------------------------

/**
 * The postcards on the wall, newest first. A hidden card reaches only the
 * host and its writer: it is left out here, in the database query, not in
 * the page. Cards from a guest the host removed leave with them; cards from
 * someone who left on their own stay.
 */
export async function getDaak(sql: Sql, ctx: MemberContext): Promise<DaakSnapshot> {
  return withPartyScope(sql, ctx.partyId, async (tx) => {
    const role = await requireActiveRole(tx, ctx);
    const [party] = await tx<{ name: string }[]>`
      select name from diwali.parties where id = ${ctx.partyId}`;
    if (!party) throw new DomainError('not_authenticated');
    const rows = await tx<
      {
        id: string;
        author_id: string;
        display_name: string;
        emblem: EmblemId;
        here: boolean;
        to_line: string | null;
        message: string;
        stamp: StampId;
        created_at: Date;
        hidden: boolean;
      }[]
    >`
      select p.id, p.author_id, m.display_name, m.emblem, (m.left_at is null) as here,
             p.to_line, p.message, p.stamp, p.created_at, (p.hidden_at is not null) as hidden
      from diwali.postcards p
      join diwali.members m on m.party_id = p.party_id and m.id = p.author_id
      where p.party_id = ${ctx.partyId}
        and p.withdrawn_at is null
        and m.removed_at is null
        and (p.hidden_at is null or ${role === 'host'}::boolean or p.author_id = ${ctx.memberId})
      order by p.created_at desc, p.id
      limit ${DAAK_LIMITS.perParty}`;
    return {
      partyName: party.name,
      me: {
        memberId: ctx.memberId,
        role,
        sent: rows.filter((row) => row.author_id === ctx.memberId).length,
      },
      postcards: rows.map((row) => ({
        id: row.id,
        from: {
          memberId: row.author_id,
          displayName: row.display_name,
          emblem: row.emblem,
          here: row.here,
        },
        to: row.to_line,
        message: row.message,
        stamp: row.stamp,
        postedAt: row.created_at.toISOString(),
        hidden: row.hidden,
      })),
    };
  });
}

/** Posts a postcard from the caller. `input` must already be parsed by `postcardInputSchema`. */
export async function sendPostcard(
  sql: Sql,
  ctx: MemberContext,
  input: PostcardInput,
): Promise<{ id: string }> {
  return withPartyScope(sql, ctx.partyId, async (tx) => {
    await requireActiveRole(tx, ctx);
    // One writer's posts go one at a time, so the limits hold under double taps.
    await tx`
      select 1 from diwali.members
      where party_id = ${ctx.partyId} and id = ${ctx.memberId} for update`;
    const [stats] = await tx<{ mine: number; total: number; recent: boolean }[]>`
      select
        count(*) filter (where author_id = ${ctx.memberId} and withdrawn_at is null)::int as mine,
        count(*) filter (where withdrawn_at is null)::int as total,
        coalesce(bool_or(author_id = ${ctx.memberId}
          and created_at > now() - make_interval(secs => ${DAAK_LIMITS.secondsBetween}::int)), false)
          as recent
      from diwali.postcards where party_id = ${ctx.partyId}`;
    if (stats && stats.mine >= DAAK_LIMITS.perMember) {
      throw new DomainError(
        'limit_reached',
        `You have ${DAAK_LIMITS.perMember} postcards on the wall, the most one person can. Withdraw one to send another.`,
      );
    }
    if (stats && stats.total >= DAAK_LIMITS.perParty) {
      throw new DomainError('limit_reached', 'The letterbox is full.');
    }
    if (stats?.recent) {
      throw new DomainError(
        'rate_limited',
        'One moment: the postman is still at the door. Try again in a few seconds.',
      );
    }
    const [card] = await tx<{ id: string }[]>`
      insert into diwali.postcards (party_id, author_id, to_line, message, stamp)
      values (${ctx.partyId}, ${ctx.memberId}, ${input.to}, ${input.message}, ${input.stamp})
      returning id`;
    if (!card) throw new Error('postcard insert returned no row');
    return card;
  });
}

/** The writer takes their own postcard down. */
export async function withdrawPostcard(
  sql: Sql,
  ctx: MemberContext,
  postcardId: string,
): Promise<void> {
  if (!isUuid(postcardId)) throw new DomainError('not_found');
  await withPartyScope(sql, ctx.partyId, async (tx) => {
    await requireActiveRole(tx, ctx);
    const withdrawn = await tx`
      update diwali.postcards set withdrawn_at = now()
      where party_id = ${ctx.partyId} and id = ${postcardId}
        and author_id = ${ctx.memberId} and withdrawn_at is null
      returning id`;
    if (withdrawn.length === 0) throw new DomainError('not_found');
  });
}

/** Hides a postcard from the party, or shows it again. Host only. */
export async function setPostcardHidden(
  sql: Sql,
  ctx: MemberContext,
  postcardId: string,
  hidden: boolean,
): Promise<void> {
  if (!isUuid(postcardId)) throw new DomainError('not_found');
  await withPartyScope(sql, ctx.partyId, async (tx) => {
    await requireActiveRole(tx, ctx, 'host');
    const changed = await tx`
      update diwali.postcards
      set hidden_at = case when ${hidden}::boolean then now() end
      where party_id = ${ctx.partyId} and id = ${postcardId} and withdrawn_at is null
      returning id`;
    if (changed.length === 0) throw new DomainError('not_found');
  });
}

// ---------------------------------------------------------------------------
// Helpers (all expect to run inside the party scope)
// ---------------------------------------------------------------------------

/**
 * Re-checks, inside the operation's own transaction, that the caller is still
 * an active member *and* that the session they authenticated with is still
 * live. Closes the gap between `authenticate()` and the operation.
 */
async function requireActiveRole(
  tx: TransactionSql,
  ctx: MemberContext,
  required?: MemberRole,
): Promise<MemberRole> {
  const [row] = await tx<{ role: MemberRole }[]>`
    select m.role
    from diwali.members m
    join diwali.member_sessions s on s.party_id = m.party_id and s.member_id = m.id
    where m.party_id = ${ctx.partyId} and m.id = ${ctx.memberId} and s.id = ${ctx.sessionId}
      and m.left_at is null and m.removed_at is null
      and s.revoked_at is null and s.expires_at > now()`;
  if (!row) throw new DomainError('not_authenticated');
  if (required && row.role !== required) throw new DomainError('forbidden');
  return row.role;
}

async function insertInvite(
  tx: TransactionSql,
  partyId: string,
  createdBy: string,
): Promise<string> {
  // 40-bit codes make collisions vanishingly rare; retry rather than assume.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const rows = await tx`
      insert into diwali.invites (party_id, code, created_by)
      values (${partyId}, ${code}, ${createdBy})
      on conflict (code) do nothing
      returning code`;
    if (rows.length === 1) return code;
  }
  throw new Error('could not allocate a unique invite code');
}

async function insertSession(
  tx: TransactionSql,
  partyId: string,
  memberId: string,
  tokenHash: Buffer,
): Promise<void> {
  await tx`
    insert into diwali.member_sessions (party_id, member_id, token_hash, expires_at)
    values (${partyId}, ${memberId}, ${tokenHash},
            now() + make_interval(days => ${SESSION_TTL_DAYS}::int))`;
}

async function revokeSessions(
  tx: TransactionSql,
  partyId: string,
  memberId: string,
): Promise<void> {
  await tx`
    update diwali.member_sessions set revoked_at = now()
    where party_id = ${partyId} and member_id = ${memberId} and revoked_at is null`;
}
