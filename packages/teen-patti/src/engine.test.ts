import { beforeEach, describe, expect, it } from 'vitest';
import type { Card } from './cards.ts';
import {
  apply,
  createTable,
  type Action,
  type Actor,
  type RuleViolation,
  type TableConfig,
  type TableState,
} from './engine.ts';
import { seededRng } from './rng.ts';

let now = 0;
const host = (id: string): Actor => ({ kind: 'player', id, host: true });
const p = (id: string): Actor => ({ kind: 'player', id, host: false });
const system: Actor = { kind: 'system' };

function run(state: TableState, action: Action, actor: Actor) {
  const out = apply(state, action, actor, { now, rng: seededRng(42) });
  if (!out.ok) throw new Error(`unexpected ${out.error} for ${JSON.stringify(action)}`);
  return out;
}

function refuse(state: TableState, action: Action, actor: Actor, error: RuleViolation) {
  const out = apply(state, action, actor, { now, rng: seededRng(42) });
  expect(out).toEqual({ ok: false, error });
}

/** Seats players in order (seat 0, 1, …) and deals. Dealer = first seat. */
function table(ids: string[], config: Partial<TableConfig> = {}): TableState {
  let s = createTable(config);
  for (const id of ids) s = run(s, { type: 'sit', name: id.toUpperCase() }, p(id)).state;
  return run(s, { type: 'deal' }, host(ids[0]!)).state;
}

/** Replaces the dealt cards so a test can decide who wins. */
function rig(state: TableState, hands: Record<string, Card[]>): TableState {
  const s = structuredClone(state);
  for (const [id, cards] of Object.entries(hands)) s.hand!.cards[id] = cards;
  return s;
}

const stack = (s: TableState, id: string) => s.players.find((x) => x.id === id)!.stack;

beforeEach(() => {
  now = 1_000_000;
});

describe('seating', () => {
  it('seats players in the lowest free seat with the buy-in', () => {
    let s = createTable();
    s = run(s, { type: 'sit', name: 'A' }, p('a')).state;
    s = run(s, { type: 'sit', name: 'B', seat: 3 }, p('b')).state;
    s = run(s, { type: 'sit', name: 'C' }, p('c')).state;
    expect(s.players.map((x) => [x.id, x.seat, x.stack])).toEqual([
      ['a', 0, 1000],
      ['c', 1, 1000],
      ['b', 3, 1000],
    ]);
  });

  it('refuses a taken seat, a second seat, and a full table', () => {
    let s = createTable({ maxSeats: 2 });
    s = run(s, { type: 'sit', name: 'A' }, p('a')).state;
    refuse(s, { type: 'sit', name: 'A' }, p('a'), 'already-seated');
    refuse(s, { type: 'sit', name: 'B', seat: 0 }, p('b'), 'seat-taken');
    s = run(s, { type: 'sit', name: 'B' }, p('b')).state;
    refuse(s, { type: 'sit', name: 'C' }, p('c'), 'table-full');
  });
});

describe('dealing', () => {
  it('needs the host and at least two players with chips', () => {
    let s = createTable();
    s = run(s, { type: 'sit', name: 'A' }, p('a')).state;
    refuse(s, { type: 'deal' }, host('a'), 'not-enough-players');
    s = run(s, { type: 'sit', name: 'B' }, p('b')).state;
    refuse(s, { type: 'deal' }, p('b'), 'not-host');
  });

  it('collects the boot, deals three unique cards each, and starts left of the dealer', () => {
    const s = table(['a', 'b', 'c']);
    const hand = s.hand!;
    expect(hand.dealer).toBe('a');
    expect(hand.order).toEqual(['b', 'c', 'a']);
    expect(hand.turn).toBe('b');
    expect(hand.pot).toBe(30);
    expect(hand.stake).toBe(10);
    expect(['a', 'b', 'c'].map((id) => stack(s, id))).toEqual([990, 990, 990]);
    const all = Object.values(hand.cards).flat();
    expect(all).toHaveLength(9);
    expect(new Set(all).size).toBe(9);
  });

  it('moves the deal one seat clockwise each hand', () => {
    let s = table(['a', 'b', 'c']);
    s = run(s, { type: 'pack' }, p('b')).state;
    s = run(s, { type: 'pack' }, p('c')).state;
    expect(s.hand!.result?.winners).toEqual(['a']);
    s = run(s, { type: 'deal' }, host('a')).state;
    expect(s.hand!.dealer).toBe('b');
    expect(s.hand!.order).toEqual(['c', 'a', 'b']);
  });

  it('refuses to deal over a hand in progress', () => {
    refuse(table(['a', 'b']), { type: 'deal' }, host('a'), 'hand-in-progress');
  });
});

describe('betting', () => {
  it('blind players bet one to two times the stake; doubling doubles the stake', () => {
    let s = table(['a', 'b', 'c']);
    refuse(s, { type: 'bet', amount: 9 }, p('b'), 'bet-out-of-range');
    refuse(s, { type: 'bet', amount: 21 }, p('b'), 'bet-out-of-range');
    s = run(s, { type: 'bet', amount: 20 }, p('b')).state;
    expect(s.hand!.stake).toBe(20);
    expect(s.hand!.turn).toBe('c');
    expect(s.hand!.pot).toBe(50);
  });

  it('seen players bet two to four times the stake, in even amounts; the stake becomes half', () => {
    let s = table(['a', 'b', 'c']);
    s = run(s, { type: 'see' }, p('b')).state;
    refuse(s, { type: 'bet', amount: 10 }, p('b'), 'bet-out-of-range');
    refuse(s, { type: 'bet', amount: 41 }, p('b'), 'bet-out-of-range');
    refuse(s, { type: 'bet', amount: 25 }, p('b'), 'invalid-amount');
    s = run(s, { type: 'bet', amount: 40 }, p('b')).state;
    expect(s.hand!.stake).toBe(20);
  });

  it('only the player whose turn it is may bet', () => {
    refuse(table(['a', 'b', 'c']), { type: 'bet', amount: 10 }, p('c'), 'not-your-turn');
  });

  it('caps every bet at the chaal limit', () => {
    let s = table(['a', 'b'], { boot: 10, chaalLimit: 30 });
    s = run(s, { type: 'bet', amount: 20 }, p('b')).state;
    s = run(s, { type: 'see' }, p('a')).state;
    // Seen minimum would be 40, but nothing may exceed 30.
    refuse(s, { type: 'bet', amount: 40 }, p('a'), 'bet-out-of-range');
    s = run(s, { type: 'bet', amount: 30 }, p('a')).state;
    expect(s.hand!.pot).toBe(70);
  });

  it('a player who can’t afford the minimum must pack (or show when two remain)', () => {
    let s = table(['a', 'b', 'c']);
    s.players.find((x) => x.id === 'b')!.stack = 5;
    refuse(s, { type: 'bet', amount: 10 }, p('b'), 'insufficient-chips');
    refuse(s, { type: 'show' }, p('b'), 'show-not-allowed');
    s = run(s, { type: 'pack' }, p('b')).state;
    expect(s.hand!.turn).toBe('c');
  });
});

describe('seeing', () => {
  it('can be done out of turn, once, and does not move the turn', () => {
    let s = table(['a', 'b', 'c']);
    s = run(s, { type: 'see' }, p('c')).state;
    expect(s.hand!.status['c']).toBe('seen');
    expect(s.hand!.turn).toBe('b');
    refuse(s, { type: 'see' }, p('c'), 'already-seen');
  });
});

describe('packing', () => {
  it('passes the turn on, and the last player standing takes the pot', () => {
    let s = table(['a', 'b', 'c']);
    s = run(s, { type: 'bet', amount: 10 }, p('b')).state;
    s = run(s, { type: 'pack' }, p('c')).state;
    expect(s.hand!.turn).toBe('a');
    const out = run(s, { type: 'pack' }, p('a'));
    s = out.state;
    expect(s.hand!.result).toEqual({
      winners: ['b'],
      payouts: { b: 40 },
      reason: 'last-standing',
      revealed: {},
    });
    expect(stack(s, 'b')).toBe(1020); // 1000 − 10 boot − 10 bet + 40 pot
    expect(out.events.at(-1)).toEqual({
      type: 'won',
      winners: ['b'],
      pot: 40,
      reason: 'last-standing',
    });
  });
});

describe('show', () => {
  function headsUp(cards: Record<string, Card[]>, config: Partial<TableConfig> = {}) {
    // a deals, b acts first.
    return rig(table(['a', 'b'], config), cards);
  }

  it('is only possible with exactly two players left', () => {
    refuse(table(['a', 'b', 'c']), { type: 'show' }, p('b'), 'show-not-allowed');
  });

  it('costs a blind player the stake; the better hand wins and both are revealed', () => {
    let s = headsUp({ a: ['2s', '7d', '9c'], b: ['As', 'Ad', '4c'] });
    s = run(s, { type: 'show' }, p('b')).state;
    expect(s.hand!.result!.winners).toEqual(['b']);
    expect(s.hand!.result!.reason).toBe('show');
    expect(s.hand!.result!.payouts).toEqual({ b: 30 });
    expect(Object.keys(s.hand!.result!.revealed).sort()).toEqual(['a', 'b']);
  });

  it('costs a seen player twice the stake', () => {
    let s = headsUp({ a: ['As', 'Ad', 'Ac'], b: ['2s', '7d', '9c'] });
    s = run(s, { type: 'see' }, p('b')).state;
    s = run(s, { type: 'see' }, p('a')).state;
    s = run(s, { type: 'show' }, p('b')).state;
    expect(s.hand!.pot).toBe(40);
    expect(s.hand!.result!.winners).toEqual(['a']);
  });

  it('a seen player may not show against a blind one', () => {
    let s = headsUp({ a: ['2s', '7d', '9c'], b: ['As', 'Ad', '4c'] });
    s = run(s, { type: 'see' }, p('b')).state;
    refuse(s, { type: 'show' }, p('b'), 'show-not-allowed');
  });

  it('on equal hands the player who asked loses, unless the table splits ties', () => {
    const equal = { a: ['As', 'Kd', '9c'] as Card[], b: ['Ah', 'Kc', '9s'] as Card[] };
    let s = run(headsUp(equal), { type: 'show' }, p('b')).state;
    expect(s.hand!.result!.winners).toEqual(['a']);

    s = run(headsUp(equal, { showTie: 'split' }), { type: 'show' }, p('b')).state;
    expect(s.hand!.result!.winners.sort()).toEqual(['a', 'b']);
    expect(s.hand!.result!.payouts).toEqual({ b: 15, a: 15 });
  });

  it('a short stack shows with everything it has', () => {
    let s = headsUp({ a: ['2s', '7d', '9c'], b: ['As', 'Ad', '4c'] });
    s.players.find((x) => x.id === 'b')!.stack = 4;
    s = run(s, { type: 'show' }, p('b')).state;
    expect(stack(s, 'b')).toBe(24);
    expect(s.hand!.result!.winners).toEqual(['b']);
  });
});

describe('sideshow', () => {
  /** Four players; a deals; order b, c, d, a. Everyone sees. */
  function seenTable(cards: Record<string, Card[]>, config: Partial<TableConfig> = {}) {
    let s = rig(table(['a', 'b', 'c', 'd'], config), cards);
    for (const id of ['a', 'b', 'c', 'd']) s = run(s, { type: 'see' }, p(id)).state;
    s = run(s, { type: 'bet', amount: 20 }, p('b')).state; // turn → c
    return s;
  }
  const cards: Record<string, Card[]> = {
    a: ['2s', '5d', '9c'],
    b: ['As', 'Ad', '4c'],
    c: ['3s', '3d', 'Kc'],
    d: ['Qh', 'Kh', 'Ah'],
  };

  it('is asked of the previous player, who must also be seen, with three or more left', () => {
    let s = seenTable(cards);
    const out = run(s, { type: 'sideshow' }, p('c'));
    s = out.state;
    expect(s.hand!.sideshow).toEqual({ from: 'c', to: 'b' });
    expect(out.events).toContainEqual({ type: 'sideshow-requested', from: 'c', to: 'b' });
    expect(s.hand!.pot).toBe(40 + 20 + 20);
    refuse(s, { type: 'bet', amount: 20 }, p('c'), 'awaiting-sideshow');
    refuse(s, { type: 'sideshow-reply', accept: true }, p('d'), 'not-your-turn');
  });

  it('is refused against a blind player, or with only two left', () => {
    let s = rig(table(['a', 'b', 'c']), cards);
    s = run(s, { type: 'see' }, p('c')).state;
    s = run(s, { type: 'bet', amount: 10 }, p('b')).state;
    refuse(s, { type: 'sideshow' }, p('c'), 'sideshow-not-allowed');
  });

  it('can be switched off per table', () => {
    refuse(
      seenTable(cards, { sideshow: false }),
      { type: 'sideshow' },
      p('c'),
      'sideshow-not-allowed',
    );
  });

  it('declined: play continues after the player who asked', () => {
    let s = run(seenTable(cards), { type: 'sideshow' }, p('c')).state;
    s = run(s, { type: 'sideshow-reply', accept: false }, p('b')).state;
    expect(s.hand!.sideshow).toBeNull();
    expect(s.hand!.turn).toBe('d');
    expect(s.hand!.status['b']).toBe('seen');
  });

  it('accepted: the lower hand packs, privately', () => {
    let s = run(seenTable(cards), { type: 'sideshow' }, p('c')).state;
    s = run(s, { type: 'sideshow-reply', accept: true }, p('b')).state;
    expect(s.hand!.status['c']).toBe('packed');
    expect(s.hand!.status['b']).toBe('seen');
    expect(s.hand!.sideshowReveal?.viewers).toEqual(['c', 'b']);
    expect(s.hand!.turn).toBe('d');
  });

  it('accepted with equal hands: the player who asked packs', () => {
    const equal = { ...cards, b: ['As', 'Kd', '9c'] as Card[], c: ['Ah', 'Kc', '9s'] as Card[] };
    let s = run(seenTable(equal), { type: 'sideshow' }, p('c')).state;
    s = run(s, { type: 'sideshow-reply', accept: true }, p('b')).state;
    expect(s.hand!.status['c']).toBe('packed');
  });
});

describe('turn timer', () => {
  it('auto-packs the player who runs out of time', () => {
    let s = table(['a', 'b', 'c']);
    refuse(s, { type: 'tick' }, system, 'not-due');
    now += 30_000;
    const out = run(s, { type: 'tick' }, system);
    s = out.state;
    expect(s.hand!.status['b']).toBe('packed');
    expect(out.events).toContainEqual({ type: 'packed', player: 'b', reason: 'timeout' });
    expect(s.hand!.turn).toBe('c');
    expect(s.hand!.deadline).toBe(now + 30_000);
  });

  it('auto-declines a sideshow nobody answers', () => {
    let s = rig(table(['a', 'b', 'c']), {
      a: ['2s', '5d', '9c'],
      b: ['As', 'Ad', '4c'],
      c: ['3s', '3d', 'Kc'],
    });
    for (const id of ['a', 'b', 'c']) s = run(s, { type: 'see' }, p(id)).state;
    s = run(s, { type: 'bet', amount: 20 }, p('b')).state;
    s = run(s, { type: 'sideshow' }, p('c')).state;
    now += 30_000;
    const out = run(s, { type: 'tick' }, system);
    expect(out.state.hand!.sideshow).toBeNull();
    expect(out.events).toContainEqual({
      type: 'sideshow-declined',
      from: 'c',
      to: 'b',
      reason: 'timeout',
    });
  });
});

describe('pot limit', () => {
  it('forces everyone still in to show when the pot reaches the limit', () => {
    let s = rig(table(['a', 'b', 'c'], { potLimit: 60 }), {
      a: ['2s', '5d', '9c'],
      b: ['As', 'Ad', '4c'],
      c: ['Qh', 'Kh', 'Ah'],
    });
    s = run(s, { type: 'bet', amount: 20 }, p('b')).state; // pot 50
    s = run(s, { type: 'bet', amount: 20 }, p('c')).state; // pot 70 ≥ 60
    expect(s.hand!.result!.reason).toBe('pot-limit');
    expect(s.hand!.result!.winners).toEqual(['c']);
    expect(Object.keys(s.hand!.result!.revealed).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('leaving and topping up', () => {
  it('leaving mid-hand packs the player first', () => {
    let s = table(['a', 'b', 'c']);
    s = run(s, { type: 'leave' }, p('b')).state;
    expect(s.hand!.status['b']).toBe('packed');
    expect(s.hand!.turn).toBe('c');
    expect(s.players.map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('only the host tops up, and only between hands', () => {
    let s = table(['a', 'b']);
    refuse(s, { type: 'top-up', target: 'b', amount: 100 }, host('a'), 'hand-in-progress');
    s = run(s, { type: 'pack' }, p('b')).state;
    refuse(s, { type: 'top-up', target: 'b', amount: 100 }, p('b'), 'not-host');
    s = run(s, { type: 'top-up', target: 'b', amount: 100 }, host('a')).state;
    expect(stack(s, 'b')).toBe(1090);
  });
});

describe('purity', () => {
  it('never mutates the state it was given, accepted or refused', () => {
    const s = table(['a', 'b', 'c']);
    const before = JSON.stringify(s);
    apply(s, { type: 'bet', amount: 20 }, p('b'), { now, rng: seededRng(1) });
    apply(s, { type: 'bet', amount: 999 }, p('b'), { now, rng: seededRng(1) });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('replays identically from the same seed and actions', () => {
    const play = () => {
      let s = createTable();
      for (const id of ['a', 'b', 'c']) {
        const sat = apply(s, { type: 'sit', name: id }, p(id), { now, rng: seededRng(9) });
        if (sat.ok) s = sat.state;
      }
      const out = apply(s, { type: 'deal' }, host('a'), { now, rng: seededRng(9) });
      return out.ok ? out.state : null;
    };
    expect(JSON.stringify(play())).toBe(JSON.stringify(play()));
  });

  it('chips are conserved across a whole hand', () => {
    let s = table(['a', 'b', 'c', 'd']);
    const total = () =>
      s.players.reduce((sum, x) => sum + x.stack, 0) + (s.hand?.result ? 0 : s.hand!.pot);
    const start = total();
    s = run(s, { type: 'bet', amount: 20 }, p('b')).state;
    s = run(s, { type: 'see' }, p('c')).state;
    s = run(s, { type: 'bet', amount: 40 }, p('c')).state;
    s = run(s, { type: 'pack' }, p('d')).state;
    s = run(s, { type: 'bet', amount: 20 }, p('a')).state;
    s = run(s, { type: 'pack' }, p('b')).state;
    s = run(s, { type: 'pack' }, p('c')).state;
    expect(total()).toBe(start);
  });
});
