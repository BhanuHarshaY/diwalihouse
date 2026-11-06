import type { TransactionSql } from '@diwali/db';
import { describe, expect, it } from 'vitest';
import { connectTestSql } from '@/test/db';
import { DomainError } from '../errors';
import { withPartyScope } from '../scope';
import {
  authenticate,
  createParty,
  getPartySnapshot,
  joinParty,
  leaveParty,
  previewInvite,
  removeMember,
  rotateInvite,
  type MemberContext,
} from './service';

const sql = connectTestSql();

async function hostParty(name = 'Rao Diwali', host = 'Asha') {
  const created = await createParty(sql, { partyName: name, displayName: host, emblem: 'diya' });
  const ctx = await authenticate(sql, created.partyId, created.token);
  if (!ctx) throw new Error('host failed to authenticate');
  return { ...created, ctx };
}

async function joinAs(code: string, displayName: string) {
  const joined = await joinParty(sql, code, { displayName, emblem: 'kamal' });
  const ctx = await authenticate(sql, joined.partyId, joined.token);
  if (!ctx) throw new Error('guest failed to authenticate');
  return { ...joined, ctx };
}

function expectCode(code: DomainError['code']) {
  return expect.objectContaining({ name: 'DomainError', code });
}

describe('creating and joining a party', () => {
  it('gives the host a working session, an invite, and the host role', async () => {
    const { ctx, inviteCode } = await hostParty();
    expect(ctx.role).toBe('host');

    const snapshot = await getPartySnapshot(sql, ctx);
    expect(snapshot.party.name).toBe('Rao Diwali');
    expect(snapshot.invite?.code).toBe(inviteCode);
    expect(snapshot.me).toEqual({ memberId: ctx.memberId, role: 'host' });
    expect(snapshot.members.map((m) => m.displayName)).toEqual(['Asha']);
  });

  it('previews an invite with only what an invitee may see', async () => {
    const { inviteCode } = await hostParty('Mehta Mehfil', 'Kabir');
    const preview = await previewInvite(sql, inviteCode);
    expect(preview).toMatchObject({
      partyName: 'Mehta Mehfil',
      hostName: 'Kabir',
      memberCount: 1,
      joinable: true,
    });
  });

  it('lets a guest join with the code and shows them to everyone', async () => {
    const host = await hostParty();
    const guest = await joinAs(host.inviteCode, 'Meera');
    expect(guest.ctx.role).toBe('guest');
    expect(guest.partyId).toBe(host.partyId);

    const seenByHost = await getPartySnapshot(sql, host.ctx);
    expect(seenByHost.members.map((m) => [m.displayName, m.role])).toEqual([
      ['Asha', 'host'],
      ['Meera', 'guest'],
    ]);
  });

  it('shows the invitation code to the host only', async () => {
    const host = await hostParty();
    const guest = await joinAs(host.inviteCode, 'Meera');
    expect((await getPartySnapshot(sql, host.ctx)).invite?.code).toBe(host.inviteCode);
    const seenByGuest = await getPartySnapshot(sql, guest.ctx);
    expect(seenByGuest.invite).toBeNull();
    expect(JSON.stringify(seenByGuest)).not.toContain(host.inviteCode);
  });

  it('treats compatibility look-alike names as the same name', async () => {
    const host = await hostParty();
    await expect(
      joinParty(sql, host.inviteCode, { displayName: '\uFF21\uFF53\uFF48\uFF41', emblem: 'mor' }),
    ).rejects.toEqual(expectCode('name_taken'));
  });

  it('refuses a name already in use, ignoring case, until that guest leaves', async () => {
    const host = await hostParty();
    const meera = await joinAs(host.inviteCode, 'Meera');
    await expect(
      joinParty(sql, host.inviteCode, { displayName: 'MEERA', emblem: 'mor' }),
    ).rejects.toEqual(expectCode('name_taken'));

    await leaveParty(sql, meera.ctx);
    await expect(joinAs(host.inviteCode, 'Meera')).resolves.toBeTruthy();
  });

  it('allows the same name in two different parties', async () => {
    const a = await hostParty();
    const b = await hostParty();
    await joinAs(a.inviteCode, 'Dev');
    await expect(joinAs(b.inviteCode, 'Dev')).resolves.toBeTruthy();
  });

  it('rejects unknown codes', async () => {
    await expect(joinParty(sql, 'ZZZZZZZZ', { displayName: 'X', emblem: 'diya' })).rejects.toEqual(
      expectCode('invite_not_found'),
    );
    expect(await previewInvite(sql, 'ZZZZZZZZ')).toBeNull();
  });

  it('turns guests away once the party is full, even under concurrent joins', async () => {
    const host = await hostParty();
    await sql`update diwali.parties set max_members = 5 where id = ${host.partyId}`;

    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        joinParty(sql, host.inviteCode, { displayName: `Guest ${i}`, emblem: 'genda' }),
      ),
    );
    const joined = attempts.filter((a) => a.status === 'fulfilled');
    const refused = attempts.filter(
      (a) => a.status === 'rejected' && (a.reason as DomainError).code === 'party_full',
    );
    expect(joined).toHaveLength(4);
    expect(refused).toHaveLength(6);

    const snapshot = await getPartySnapshot(sql, host.ctx);
    expect(snapshot.members).toHaveLength(5);
    expect((await previewInvite(sql, host.inviteCode))?.joinable).toBe(false);
  });

  it('refuses joins once the host has closed the party', async () => {
    const host = await hostParty();
    await sql`update diwali.parties set status = 'closed' where id = ${host.partyId}`;
    await expect(joinAs(host.inviteCode, 'Late')).rejects.toEqual(expectCode('party_closed'));
  });
});

describe('sessions', () => {
  it('a revoked session loses access even with a context issued before revocation', async () => {
    const host = await hostParty();
    const guest = await joinAs(host.inviteCode, 'Meera');
    await sql`update diwali.member_sessions set revoked_at = now() where id = ${guest.ctx.sessionId}`;
    await expect(getPartySnapshot(sql, guest.ctx)).rejects.toEqual(expectCode('not_authenticated'));
    await expect(leaveParty(sql, guest.ctx)).rejects.toEqual(expectCode('not_authenticated'));
  });

  it('rejects malformed, unknown, and expired tokens', async () => {
    const host = await hostParty();
    expect(await authenticate(sql, host.partyId, undefined)).toBeNull();
    expect(await authenticate(sql, host.partyId, 'not-a-token')).toBeNull();
    expect(await authenticate(sql, host.partyId, 'A'.repeat(43))).toBeNull();
    expect(await authenticate(sql, 'not-a-uuid', host.token)).toBeNull();

    await sql`
      update diwali.member_sessions set expires_at = now() - interval '1 second'
      where member_id = ${host.memberId}`;
    expect(await authenticate(sql, host.partyId, host.token)).toBeNull();
  });
});

describe('party isolation', () => {
  it('a session from one party never authenticates against another', async () => {
    const a = await hostParty('Party A', 'Asha');
    const b = await hostParty('Party B', 'Bilal');
    expect(await authenticate(sql, b.partyId, a.token)).toBeNull();
    expect(await authenticate(sql, a.partyId, b.token)).toBeNull();
  });

  it("a host cannot remove another party's guest", async () => {
    const a = await hostParty('Party A', 'Asha');
    const b = await hostParty('Party B', 'Bilal');
    const bGuest = await joinAs(b.inviteCode, 'Chitra');

    await expect(removeMember(sql, a.ctx, bGuest.memberId)).rejects.toEqual(
      expectCode('not_found'),
    );
    expect(await authenticate(sql, b.partyId, bGuest.token)).not.toBeNull();
  });

  it('a forged context for another party sees nothing', async () => {
    const a = await hostParty('Party A', 'Asha');
    const b = await hostParty('Party B', 'Bilal');
    // Simulates a bug that pairs A's member with B's party id.
    const forged = { ...a.ctx, partyId: b.partyId } as MemberContext;
    await expect(getPartySnapshot(sql, forged)).rejects.toEqual(expectCode('not_authenticated'));
    await expect(rotateInvite(sql, forged)).rejects.toEqual(expectCode('not_authenticated'));
  });

  it('row-level security hides other parties even from an unfiltered query', async () => {
    const a = await hostParty('Party A', 'Asha');
    const b = await hostParty('Party B', 'Bilal');
    await joinAs(b.inviteCode, 'Dhruv');

    const visible = await withPartyScope(sql, a.partyId, async (tx) => ({
      parties: await tx<{ id: string }[]>`select id from diwali.parties`,
      members: await tx<{ party_id: string }[]>`select party_id from diwali.members`,
      sessions: await tx<{ party_id: string }[]>`select party_id from diwali.member_sessions`,
      invites: await tx<{ party_id: string }[]>`select party_id from diwali.invites`,
    }));

    expect(visible.parties.map((p) => p.id)).toEqual([a.partyId]);
    for (const rows of [visible.members, visible.sessions, visible.invites]) {
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.party_id === a.partyId)).toBe(true);
    }
  });

  it("row-level security refuses writes into another party's rows", async () => {
    const a = await hostParty('Party A', 'Asha');
    const b = await hostParty('Party B', 'Bilal');

    await expect(
      withPartyScope(
        sql,
        a.partyId,
        (tx) => tx`
          insert into diwali.members (party_id, display_name, emblem, role)
          values (${b.partyId}, 'Intruder', 'diya', 'guest')`,
      ),
    ).rejects.toThrow(/row-level security/);

    const closed = await withPartyScope(
      sql,
      a.partyId,
      (tx) => tx`update diwali.parties set status = 'closed' where id = ${b.partyId} returning id`,
    );
    expect(closed).toHaveLength(0);
  });

  it('the scope role may only change the columns the service changes', async () => {
    const host = await hostParty();
    const guest = await joinAs(host.inviteCode, 'Meera');
    const attempts: Array<(tx: TransactionSql) => Promise<unknown>> = [
      (tx) => tx`update diwali.members set role = 'host' where id = ${guest.memberId}`,
      (tx) => tx`update diwali.member_sessions set expires_at = now() + interval '1 year'`,
      (tx) => tx`update diwali.invites set code = 'AAAAAAAA'`,
      (tx) => tx`update diwali.parties set max_members = 200`,
    ];
    for (const attempt of attempts) {
      await expect(withPartyScope(sql, host.partyId, attempt)).rejects.toThrow(/permission denied/);
    }
  });

  it('the scope role sees nothing at all when no party is set', async () => {
    await hostParty();
    const rows = await sql.begin(async (tx) => {
      await tx`set local role diwali_party_scope`;
      return tx`select id from diwali.members`;
    });
    expect(rows).toHaveLength(0);
  });

  it('the scope role cannot read rate-limit data or delete rows', async () => {
    const a = await hostParty();
    await expect(
      withPartyScope(sql, a.partyId, (tx) => tx`select * from diwali.rate_limit_buckets`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      withPartyScope(sql, a.partyId, (tx) => tx`delete from diwali.members`),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('host powers', () => {
  it('rotating the invite kills the old code and keeps the party', async () => {
    const host = await hostParty();
    const { code } = await rotateInvite(sql, host.ctx);
    expect(code).not.toBe(host.inviteCode);

    await expect(joinAs(host.inviteCode, 'Old Code')).rejects.toEqual(
      expectCode('invite_not_found'),
    );
    const guest = await joinAs(code, 'New Code');
    expect(guest.partyId).toBe(host.partyId);
  });

  it('only the host can rotate the invite or remove guests', async () => {
    const host = await hostParty();
    const guest = await joinAs(host.inviteCode, 'Meera');
    const other = await joinAs(host.inviteCode, 'Neel');

    await expect(rotateInvite(sql, guest.ctx)).rejects.toEqual(expectCode('forbidden'));
    await expect(removeMember(sql, guest.ctx, other.memberId)).rejects.toEqual(
      expectCode('forbidden'),
    );
  });

  it('removing a guest ends their sessions immediately', async () => {
    const host = await hostParty();
    const guest = await joinAs(host.inviteCode, 'Meera');

    await removeMember(sql, host.ctx, guest.memberId);
    expect(await authenticate(sql, host.partyId, guest.token)).toBeNull();
    // A context obtained before the removal is no longer honoured either.
    await expect(getPartySnapshot(sql, guest.ctx)).rejects.toEqual(expectCode('not_authenticated'));

    const snapshot = await getPartySnapshot(sql, host.ctx);
    expect(snapshot.members.map((m) => m.displayName)).toEqual(['Asha']);
  });

  it('a host cannot remove themselves or leave', async () => {
    const host = await hostParty();
    await expect(removeMember(sql, host.ctx, host.memberId)).rejects.toEqual(
      expectCode('forbidden'),
    );
    await expect(leaveParty(sql, host.ctx)).rejects.toEqual(expectCode('host_cannot_leave'));
  });
});
