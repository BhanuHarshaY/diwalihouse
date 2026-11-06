import { seededRng, type Actor } from '@diwali/game-kit';
import { describe, expect, it } from 'vitest';
import {
  applyTambola,
  createTambola,
  isComplete,
  viewTambola,
  type TambolaAction,
  type TambolaState,
  type TambolaViolation,
} from './engine.ts';
import { columnRange, generateTicket, rowNumbers, ticketNumbers } from './tickets.ts';

let now = 0;
const host: Actor = { kind: 'player', id: 'asha', host: true };
const guest = (id: string): Actor => ({ kind: 'player', id, host: false });
const system: Actor = { kind: 'system' };

function run(s: TambolaState, action: TambolaAction, actor: Actor) {
  const out = applyTambola(s, action, actor, { now, rng: seededRng(11) });
  if (!out.ok) throw new Error(`unexpected ${out.error}`);
  return out;
}
function refuse(s: TambolaState, action: TambolaAction, actor: Actor, error: TambolaViolation) {
  expect(applyTambola(s, action, actor, { now, rng: seededRng(11) })).toEqual({ ok: false, error });
}

function started(players = ['asha', 'meera']): TambolaState {
  let s = createTambola();
  for (const id of players) s = run(s, { type: 'join', name: id }, guest(id)).state;
  return run(s, { type: 'start' }, host).state;
}

function callUntil(s: TambolaState, done: (s: TambolaState) => boolean): TambolaState {
  while (!done(s) && s.phase === 'calling') s = run(s, { type: 'call' }, host).state;
  return s;
}

describe('tickets', () => {
  it('always follow the rules of a 90-ball ticket', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 2000; i++) {
      const ticket = generateTicket(rng);
      expect(ticket).toHaveLength(3);
      expect(ticketNumbers(ticket)).toHaveLength(15);
      for (let row = 0; row < 3; row++) expect(rowNumbers(ticket, row)).toHaveLength(5);
      for (let column = 0; column < 9; column++) {
        const numbers = [0, 1, 2]
          .map((r) => ticket[r]![column])
          .filter((n): n is number => n !== null);
        expect(numbers.length).toBeGreaterThanOrEqual(1);
        const [lo, hi] = columnRange(column);
        for (const n of numbers) {
          expect(n).toBeGreaterThanOrEqual(lo);
          expect(n).toBeLessThanOrEqual(hi);
        }
        expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
      }
      expect(new Set(ticketNumbers(ticket)).size).toBe(15);
    }
  });
});

describe('the game', () => {
  it('only the host starts and calls; everyone gets a ticket at the start', () => {
    let s = createTambola();
    s = run(s, { type: 'join', name: 'Meera' }, guest('meera')).state;
    refuse(s, { type: 'start' }, guest('meera'), 'not-host');
    s = run(s, { type: 'start' }, host).state;
    expect(s.players[0]!.tickets).toHaveLength(1);
    refuse(s, { type: 'call' }, guest('meera'), 'not-host');
    refuse(s, { type: 'join', name: 'Late' }, guest('late'), 'not-in-lobby');
  });

  it('calls each of the 90 numbers exactly once, then ends', () => {
    let s = started();
    s = callUntil(s, () => false);
    expect(s.phase).toBe('finished');
    expect([...s.called].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 90 }, (_, i) => i + 1),
    );
    refuse(s, { type: 'call' }, host, 'not-calling');
  });

  it('auto-calls on a timer when the host turns it on', () => {
    let s = started();
    s = run(s, { type: 'auto', seconds: 8 }, host).state;
    refuse(s, { type: 'tick' }, system, 'not-due');
    now += 8000;
    s = run(s, { type: 'tick' }, system).state;
    expect(s.called).toHaveLength(1);
    expect(s.nextCallAt).toBe(now + 8000);
    refuse(s, { type: 'auto', seconds: 1 }, host, 'bad-interval');
  });

  it('players can mark only called numbers that are on their ticket', () => {
    let s = started();
    const ticket = s.players.find((p) => p.id === 'meera')!.tickets[0]!;
    const onTicket = ticketNumbers(ticket);
    const notOnTicket = Array.from({ length: 90 }, (_, i) => i + 1).find(
      (n) => !onTicket.includes(n),
    )!;
    refuse(s, { type: 'mark', ticket: 0, number: onTicket[0]! }, guest('meera'), 'not-called');
    refuse(s, { type: 'mark', ticket: 0, number: notOnTicket }, guest('meera'), 'not-on-ticket');
    s = callUntil(s, (x) => x.called.includes(onTicket[0]!));
    s = run(s, { type: 'mark', ticket: 0, number: onTicket[0]! }, guest('meera')).state;
    expect(s.players.find((p) => p.id === 'meera')!.marks[0]).toEqual([onTicket[0]]);
  });
});

describe('claims', () => {
  it('are checked against the numbers called, not what a player says', () => {
    const s = started();
    const out = run(s, { type: 'claim', ticket: 0, prize: 'early-five' }, guest('meera'));
    expect(out.events).toEqual([{ type: 'bogey', player: 'meera', prize: 'early-five' }]);
    expect(out.state.bogeys['meera']).toBe(1);
    expect(out.state.prizes['early-five']).toBeNull();
  });

  it('award points to the first valid claim, and only once per prize', () => {
    let s = started();
    const ticket = s.players.find((p) => p.id === 'meera')!.tickets[0]!;
    s = callUntil(s, (x) => isComplete(ticket, 'early-five', new Set(x.called)));
    s = run(s, { type: 'claim', ticket: 0, prize: 'early-five' }, guest('meera')).state;
    expect(s.prizes['early-five']).toMatchObject({ winner: 'meera', ticket: 0 });
    expect(s.players.find((p) => p.id === 'meera')!.points).toBe(10);
    refuse(s, { type: 'claim', ticket: 0, prize: 'early-five' }, guest('meera'), 'already-won');
  });

  it('lines, corners and full house need exactly their numbers', () => {
    const ticket = generateTicket(seededRng(3));
    const called = new Set(rowNumbers(ticket, 0));
    expect(isComplete(ticket, 'top-line', called)).toBe(true);
    expect(isComplete(ticket, 'middle-line', called)).toBe(false);
    const top = rowNumbers(ticket, 0);
    const bottom = rowNumbers(ticket, 2);
    expect(isComplete(ticket, 'corners', new Set([top[0]!, top[4]!, bottom[0]!, bottom[4]!]))).toBe(
      true,
    );
    expect(isComplete(ticket, 'full-house', new Set(ticketNumbers(ticket)))).toBe(true);
    expect(isComplete(ticket, 'full-house', new Set(ticketNumbers(ticket).slice(1)))).toBe(false);
  });

  it('a full house ends the game', () => {
    let s = started();
    const ticket = s.players.find((p) => p.id === 'meera')!.tickets[0]!;
    s = callUntil(s, (x) => isComplete(ticket, 'full-house', new Set(x.called)));
    const out = run(s, { type: 'claim', ticket: 0, prize: 'full-house' }, guest('meera'));
    expect(out.state.phase).toBe('finished');
    expect(out.events).toContainEqual({ type: 'finished', reason: 'full-house' });
  });
});

describe('views', () => {
  it('show your own tickets, never anyone else’s, and never the bag', () => {
    const s = started(['asha', 'meera', 'dev']);
    const view = viewTambola(s, 'meera');
    expect(view.me.tickets).toEqual(s.players.find((p) => p.id === 'meera')!.tickets);
    const text = JSON.stringify(view);
    expect(text).not.toContain('"bag"');
    const others = s.players.filter((p) => p.id !== 'meera').map((p) => JSON.stringify(p.tickets));
    for (const t of others) expect(text).not.toContain(t);
    expect(view.remaining).toBe(90);
  });

  it('offer the host the caller’s controls and guests the claims', () => {
    const s = started();
    expect(viewTambola(s, 'asha', true).me.can.call).toBe(true);
    expect(viewTambola(s, 'meera').me.can.call).toBe(false);
    expect(viewTambola(s, 'meera').me.can.claim).toContain('full-house');
  });
});
