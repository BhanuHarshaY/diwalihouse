import { postcardInputSchema, type PostcardInput } from '@diwali/contracts';
import type { TransactionSql } from '@diwali/db';
import { describe, expect, it } from 'vitest';
import { connectTestSql } from '@/test/db';
import type { DomainError } from '../errors';
import { withPartyScope } from '../scope';
import {
  authenticate,
  createParty,
  getDaak,
  joinParty,
  leaveParty,
  removeMember,
  sendPostcard,
  setPostcardHidden,
  withdrawPostcard,
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

const card = (message: string, over: Record<string, unknown> = {}): PostcardInput =>
  postcardInputSchema.parse({ message, stamp: 'diya', ...over });

/** Moves a member's postcards back in time, so the gap between posts doesn't apply. */
async function age(partyId: string) {
  await sql`update diwali.postcards set created_at = created_at - interval '1 minute'
            where party_id = ${partyId}`;
}

const messages = async (ctx: MemberContext) =>
  (await getDaak(sql, ctx)).postcards.map((p) => p.message);

function expectCode(code: DomainError['code']) {
  return expect.objectContaining({ name: 'DomainError', code });
}

describe('postcards', () => {
  it('reach everyone in the party, newest first, with who wrote them', async () => {
    const host = await hostParty();
    const meera = await joinAs(host.inviteCode, 'Meera');
    await sendPostcard(sql, meera.ctx, card('Shubh Deepavali!', { to: 'Nani', stamp: 'genda' }));
    await age(host.partyId);
    await sendPostcard(sql, host.ctx, card('Thank you all for coming'));

    const daak = await getDaak(sql, meera.ctx);
    expect(daak.partyName).toBe('Rao Diwali');
    expect(daak.me).toEqual({ memberId: meera.memberId, role: 'guest', sent: 1 });
    expect(daak.postcards.map((p) => [p.message, p.from.displayName, p.to, p.stamp])).toEqual([
      ['Thank you all for coming', 'Asha', null, 'diya'],
      ['Shubh Deepavali!', 'Meera', 'Nani', 'genda'],
    ]);
  });

  it('can’t be sent twice in a few seconds, or past one person’s limit', async () => {
    const host = await hostParty();
    await sendPostcard(sql, host.ctx, card('One'));
    await expect(sendPostcard(sql, host.ctx, card('Two'))).rejects.toEqual(
      expectCode('rate_limited'),
    );
    await withPartyScope(sql, host.partyId, async (tx) => {
      for (let i = 0; i < 19; i++) {
        await tx`insert into diwali.postcards (party_id, author_id, message, stamp, created_at)
                 values (${host.partyId}, ${host.memberId}, ${`Card ${i}`}, 'diya', now() - interval '1 hour')`;
      }
    });
    await age(host.partyId);
    await expect(sendPostcard(sql, host.ctx, card('Twenty-first'))).rejects.toEqual(
      expectCode('limit_reached'),
    );
  });

  it('can be withdrawn by the writer only', async () => {
    const host = await hostParty();
    const meera = await joinAs(host.inviteCode, 'Meera');
    const { id } = await sendPostcard(sql, meera.ctx, card('Mine'));
    await expect(withdrawPostcard(sql, host.ctx, id)).rejects.toEqual(expectCode('not_found'));
    await withdrawPostcard(sql, meera.ctx, id);
    expect(await messages(host.ctx)).toEqual([]);
    await expect(withdrawPostcard(sql, meera.ctx, id)).rejects.toEqual(expectCode('not_found'));
  });
});

describe('the host', () => {
  it('can hide a postcard from guests; only the host and its writer still receive it', async () => {
    const host = await hostParty();
    const meera = await joinAs(host.inviteCode, 'Meera');
    const bilal = await joinAs(host.inviteCode, 'Bilal');
    const { id } = await sendPostcard(sql, meera.ctx, card('Rude joke'));

    await expect(setPostcardHidden(sql, bilal.ctx, id, true)).rejects.toEqual(
      expectCode('forbidden'),
    );
    await setPostcardHidden(sql, host.ctx, id, true);
    expect(await messages(bilal.ctx)).toEqual([]);
    expect((await getDaak(sql, host.ctx)).postcards).toEqual([
      expect.objectContaining({ message: 'Rude joke', hidden: true }),
    ]);
    expect((await getDaak(sql, meera.ctx)).postcards).toEqual([
      expect.objectContaining({ hidden: true }),
    ]);

    await setPostcardHidden(sql, host.ctx, id, false);
    expect(await messages(bilal.ctx)).toEqual(['Rude joke']);
  });

  it('removing a guest takes their postcards down; leaving does not', async () => {
    const host = await hostParty();
    const meera = await joinAs(host.inviteCode, 'Meera');
    const dev = await joinAs(host.inviteCode, 'Dev');
    await sendPostcard(sql, meera.ctx, card('From Meera'));
    await sendPostcard(sql, dev.ctx, card('From Dev'));
    await leaveParty(sql, meera.ctx);
    await removeMember(sql, host.ctx, dev.memberId);

    const daak = await getDaak(sql, host.ctx);
    expect(daak.postcards.map((p) => [p.message, p.from.here])).toEqual([['From Meera', false]]);
    await expect(getDaak(sql, dev.ctx)).rejects.toEqual(expectCode('not_authenticated'));
  });
});

describe('postcard isolation', () => {
  it('a member of one party sees none of another party’s postcards', async () => {
    const a = await hostParty('Party A', 'Asha');
    const b = await hostParty('Party B', 'Bilal');
    await sendPostcard(sql, b.ctx, card('Only for party B'));
    expect(await messages(a.ctx)).toEqual([]);
  });

  it('another party’s postcard can’t be withdrawn or hidden, even by its host', async () => {
    const a = await hostParty('Party A', 'Asha');
    const b = await hostParty('Party B', 'Bilal');
    const { id } = await sendPostcard(sql, b.ctx, card('Party B'));
    await expect(setPostcardHidden(sql, a.ctx, id, true)).rejects.toEqual(expectCode('not_found'));
    await expect(withdrawPostcard(sql, a.ctx, id)).rejects.toEqual(expectCode('not_found'));
    // A forged context pairing A's host with B's party gets nowhere either.
    const forged = { ...a.ctx, partyId: b.partyId } as MemberContext;
    await expect(setPostcardHidden(sql, forged, id, true)).rejects.toEqual(
      expectCode('not_authenticated'),
    );
    await expect(getDaak(sql, forged)).rejects.toEqual(expectCode('not_authenticated'));
    expect(await messages(b.ctx)).toEqual(['Party B']);
  });

  it('row-level security hides other parties’ postcards from an unfiltered query', async () => {
    const a = await hostParty('Party A', 'Asha');
    const b = await hostParty('Party B', 'Bilal');
    await sendPostcard(sql, a.ctx, card('A'));
    await sendPostcard(sql, b.ctx, card('B'));
    const seen = await withPartyScope(
      sql,
      a.partyId,
      (tx) => tx<{ message: string }[]>`select message from diwali.postcards`,
    );
    expect(seen.map((r) => r.message)).toEqual(['A']);
  });

  it('refuses a postcard written into another party, or signed by another party’s member', async () => {
    const a = await hostParty('Party A', 'Asha');
    const b = await hostParty('Party B', 'Bilal');
    await expect(
      withPartyScope(
        sql,
        a.partyId,
        (tx) => tx`insert into diwali.postcards (party_id, author_id, message, stamp)
                   values (${b.partyId}, ${b.memberId}, 'Intruder', 'diya')`,
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      withPartyScope(
        sql,
        a.partyId,
        (tx) => tx`insert into diwali.postcards (party_id, author_id, message, stamp)
                   values (${a.partyId}, ${b.memberId}, 'Forged', 'diya')`,
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it('the scope role can only withdraw or hide postcards, never rewrite or delete them', async () => {
    const host = await hostParty();
    const { id } = await sendPostcard(sql, host.ctx, card('Original'));
    const attempts: Array<(tx: TransactionSql) => Promise<unknown>> = [
      (tx) => tx`update diwali.postcards set message = 'Rewritten' where id = ${id}`,
      (tx) => tx`update diwali.postcards set author_id = ${host.memberId} where id = ${id}`,
      (tx) => tx`delete from diwali.postcards where id = ${id}`,
    ];
    for (const attempt of attempts) {
      await expect(withPartyScope(sql, host.partyId, attempt)).rejects.toThrow(/permission denied/);
    }
    expect(await messages(host.ctx)).toEqual(['Original']);
  });
});
