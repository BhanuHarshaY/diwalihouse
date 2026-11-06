import { describe, expect, it } from 'vitest';
import {
  ACTION_SCHEMAS,
  courtyardClientMessageSchema,
  gameClientMessageSchema,
  mehfilClientMessageSchema,
  partyClientMessageSchema,
} from './messages.ts';
import {
  generateTicketKeys,
  signRevocation,
  signTicket,
  TICKET_TTL_MS,
  verifyRevocation,
  verifyTicket,
  type TicketClaims,
} from './ticket.ts';

const now = 1_800_000_000_000;
const claims = (over: Partial<TicketClaims> = {}): TicketClaims => ({
  v: 1,
  party: 'party-a',
  member: 'member-1',
  role: 'guest',
  name: 'Meera',
  emblem: 'kamal',
  exp: now + TICKET_TTL_MS,
  jti: 'abc123',
  ...over,
});

describe('tickets', async () => {
  const keys = await generateTicketKeys();
  const other = await generateTicketKeys();

  it('round-trips a valid ticket', async () => {
    const token = await signTicket(keys.privateJwk, claims());
    const result = await verifyTicket(keys.publicJwk, token, { now, party: 'party-a' });
    expect(result).toEqual({ ok: true, claims: claims() });
  });

  it('refuses a ticket for another party', async () => {
    const token = await signTicket(keys.privateJwk, claims());
    expect(await verifyTicket(keys.publicJwk, token, { now, party: 'party-b' })).toEqual({
      ok: false,
      reason: 'wrong-party',
    });
  });

  it('refuses expired tickets and implausibly long-lived ones', async () => {
    const expired = await signTicket(keys.privateJwk, claims({ exp: now - 1 }));
    expect((await verifyTicket(keys.publicJwk, expired, { now, party: 'party-a' })).ok).toBe(false);
    const forever = await signTicket(keys.privateJwk, claims({ exp: now + 3_600_000 }));
    expect(await verifyTicket(keys.publicJwk, forever, { now, party: 'party-a' })).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('refuses a ticket signed by another key, or altered after signing', async () => {
    const forged = await signTicket(other.privateJwk, claims());
    expect(await verifyTicket(keys.publicJwk, forged, { now, party: 'party-a' })).toEqual({
      ok: false,
      reason: 'bad-signature',
    });

    const token = await signTicket(keys.privateJwk, claims());
    const [v, , sig] = token.split('.');
    const promoted = Buffer.from(JSON.stringify(claims({ role: 'host' }))).toString('base64url');
    expect(
      await verifyTicket(keys.publicJwk, `${v}.${promoted}.${sig}`, { now, party: 'party-a' }),
    ).toEqual({
      ok: false,
      reason: 'bad-signature',
    });
  });

  it('refuses garbage', async () => {
    for (const junk of ['', 'v1', 'v1..', 'v2.a.b', 'v1.!!!.???']) {
      expect((await verifyTicket(keys.publicJwk, junk, { now, party: 'party-a' })).ok).toBe(false);
    }
  });
});

describe('revocation notices', async () => {
  const keys = await generateTicketKeys();
  const notice = {
    v: 1,
    party: 'party-a',
    member: 'member-1',
    exp: now + TICKET_TTL_MS,
    jti: 'r1',
  } as const;

  it('round-trip for their own party only', async () => {
    const token = await signRevocation(keys.privateJwk, notice);
    expect(await verifyRevocation(keys.publicJwk, token, { now, party: 'party-a' })).toEqual({
      ok: true,
      claims: notice,
    });
    expect(await verifyRevocation(keys.publicJwk, token, { now, party: 'party-b' })).toEqual({
      ok: false,
      reason: 'wrong-party',
    });
  });

  it('can’t be swapped with tickets, either way', async () => {
    const ticket = await signTicket(keys.privateJwk, claims());
    expect((await verifyRevocation(keys.publicJwk, ticket, { now, party: 'party-a' })).ok).toBe(
      false,
    );
    const revocation = await signRevocation(keys.privateJwk, notice);
    expect((await verifyTicket(keys.publicJwk, revocation, { now, party: 'party-a' })).ok).toBe(
      false,
    );
    // Relabelling the prefix breaks the signature, which covers it.
    const relabelled = revocation.replace(/^r1\./, 'v1.');
    expect(await verifyTicket(keys.publicJwk, relabelled, { now, party: 'party-a' })).toEqual({
      ok: false,
      reason: 'bad-signature',
    });
  });
});

describe('courtyard messages', () => {
  const draw = (stroke: object) =>
    courtyardClientMessageSchema.safeParse({ t: 'draw', id: 'req_12345678', stroke }).success;
  const dot = { tool: 'dot', colour: 'marigold', size: 'fine', points: [10, -20] };

  it('accept well-formed strokes and host actions', () => {
    expect(draw(dot)).toBe(true);
    expect(
      courtyardClientMessageSchema.safeParse({ t: 'fresh', id: 'req_12345678', folds: 12 }).success,
    ).toBe(true);
    expect(
      courtyardClientMessageSchema.safeParse({ t: 'erase', id: 'req_12345678', member: 'm-1' })
        .success,
    ).toBe(true);
  });

  it('reject strokes that claim an author or id, or are out of range', () => {
    expect(draw({ ...dot, by: 'someone-else' })).toBe(false);
    expect(draw({ ...dot, id: 7 })).toBe(false);
    expect(draw({ ...dot, points: [10.5, 0] })).toBe(false);
    expect(draw({ ...dot, points: [1001, 0] })).toBe(false);
    expect(draw({ ...dot, colour: 'black' })).toBe(false);
    expect(draw({ ...dot, points: Array.from({ length: 500 }, () => 1) })).toBe(false);
    expect(
      courtyardClientMessageSchema.safeParse({ t: 'fresh', id: 'req_12345678', folds: 7 }).success,
    ).toBe(false);
  });
});

describe('client messages', () => {
  it('accept well-formed actions for each game', () => {
    expect(ACTION_SCHEMAS['teen-patti'].safeParse({ type: 'bet', amount: 20 }).success).toBe(true);
    expect(
      ACTION_SCHEMAS.tambola.safeParse({ type: 'claim', ticket: 0, prize: 'full-house' }).success,
    ).toBe(true);
    expect(
      ACTION_SCHEMAS['raja-mantri'].safeParse({ type: 'accuse', accused: 'm-1' }).success,
    ).toBe(true);
    expect(ACTION_SCHEMAS.charades.safeParse({ type: 'guess', text: 'Lagaan' }).success).toBe(true);
  });

  it('reject anything a game does not know, and system-only actions', () => {
    expect(ACTION_SCHEMAS['teen-patti'].safeParse({ type: 'tick' }).success).toBe(false);
    expect(ACTION_SCHEMAS['teen-patti'].safeParse({ type: 'bet', amount: 2.5 }).success).toBe(
      false,
    );
    expect(ACTION_SCHEMAS.tambola.safeParse({ type: 'mark', ticket: 0, number: 91 }).success).toBe(
      false,
    );
    expect(ACTION_SCHEMAS.charades.safeParse({ type: 'guess', text: 'x'.repeat(81) }).success).toBe(
      false,
    );
    expect(ACTION_SCHEMAS.tambola.safeParse({ type: 'bet', amount: 10 }).success).toBe(false);
  });

  it('never take a name from the client', () => {
    const sit = ACTION_SCHEMAS['teen-patti'].parse({ type: 'sit', name: 'Impostor' });
    expect(sit).not.toHaveProperty('name');
    const join = ACTION_SCHEMAS.tambola.parse({ type: 'join', name: 'Impostor' });
    expect(join).not.toHaveProperty('name');
  });

  it('validate envelopes and game options', () => {
    expect(
      gameClientMessageSchema.safeParse({ t: 'action', id: 'short', action: { type: 'pack' } })
        .success,
    ).toBe(false);
    expect(
      partyClientMessageSchema.safeParse({
        t: 'create-game',
        id: 'req_12345678',
        kind: 'tambola',
        options: { ticketsPerPlayer: 2 },
      }).success,
    ).toBe(true);
    expect(
      partyClientMessageSchema.safeParse({ t: 'create-game', id: 'req_12345678', kind: 'chess' })
        .success,
    ).toBe(false);
    expect(
      partyClientMessageSchema.safeParse({
        t: 'create-game',
        id: 'req_12345678',
        kind: 'tambola',
        options: { evil: 1 },
      }).success,
    ).toBe(false);
  });
});

describe('mehfil messages', () => {
  const ok = (m: object) =>
    mehfilClientMessageSchema.safeParse({ id: 'req_12345678', ...m }).success;

  it('accept requests, votes and speaker reports', () => {
    expect(ok({ t: 'add', url: 'https://youtu.be/dQw4w9WgXcQ', dedication: 'for Nani' })).toBe(
      true,
    );
    expect(ok({ t: 'vote', song: 3, up: false })).toBe(true);
    expect(ok({ t: 'claim' })).toBe(true);
    expect(ok({ t: 'delegate', member: null })).toBe(true);
    expect(ok({ t: 'ended', song: 1 })).toBe(true);
  });

  it('reject titles, authors or devices sent by the client', () => {
    expect(ok({ t: 'add', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Fake' })).toBe(false);
    expect(ok({ t: 'claim', device: 'tab_someone_else' })).toBe(false);
    expect(ok({ t: 'ended', song: 1, device: 'tab_someone_else' })).toBe(false);
    expect(ok({ t: 'add', url: 'x'.repeat(401) })).toBe(false);
    expect(ok({ t: 'vote', song: -1, up: true })).toBe(false);
  });
});
