import { describe, expect, it } from 'vitest';
import { fullDeck, type Card } from './cards.ts';
import { apply, createTable, type Actor, type TableState } from './engine.ts';
import { cryptoRng, seededRng, shuffle } from './rng.ts';
import { viewFor } from './views.ts';

const p = (id: string): Actor => ({ kind: 'player', id, host: id === 'a' });
const ctx = { now: 0, rng: seededRng(3) };

function dealt(ids: string[]): TableState {
  let s = createTable();
  for (const id of ids) {
    const out = apply(s, { type: 'sit', name: id }, p(id), ctx);
    if (!out.ok) throw new Error(out.error);
    s = out.state;
  }
  const out = apply(s, { type: 'deal' }, p('a'), ctx);
  if (!out.ok) throw new Error(out.error);
  return out.state;
}

function act(s: TableState, id: string, action: Parameters<typeof apply>[1]): TableState {
  const out = apply(s, action, p(id), ctx);
  if (!out.ok) throw new Error(out.error);
  return out.state;
}

/** Every card code anywhere in a serialised view. */
function cardsIn(view: unknown): Set<string> {
  const found = new Set<string>();
  const deck = new Set<string>(fullDeck());
  JSON.stringify(view, (_key, value) => {
    if (typeof value === 'string' && deck.has(value)) found.add(value);
    return value;
  });
  return found;
}

describe('private views', () => {
  it('a blind player is not shown their own cards until they choose to see', () => {
    let s = dealt(['a', 'b', 'c']);
    expect(viewFor(s, 'b').me.cards).toBeNull();
    expect(cardsIn(viewFor(s, 'b')).size).toBe(0);
    s = act(s, 'b', { type: 'see' });
    expect(viewFor(s, 'b').me.cards).toEqual(s.hand!.cards['b']);
  });

  it('no view ever contains another player’s cards, the deck, or the seed', () => {
    let s = dealt(['a', 'b', 'c', 'd']);
    for (const id of ['a', 'b', 'c', 'd']) s = act(s, id, { type: 'see' });
    for (const viewer of ['a', 'b', 'c', 'd', 'spectator']) {
      const view = viewFor(s, viewer, viewer === 'a');
      const own = new Set(s.hand!.cards[viewer] ?? []);
      for (const card of cardsIn(view)) expect(own.has(card as Card)).toBe(true);
      expect(JSON.stringify(view)).not.toMatch(/deck|seed|rng/i);
    }
  });

  it('a spectator sees no cards at all during a hand', () => {
    let s = dealt(['a', 'b', 'c']);
    for (const id of ['a', 'b', 'c']) s = act(s, id, { type: 'see' });
    const view = viewFor(s, 'someone-watching');
    expect(view.me.seated).toBe(false);
    expect(cardsIn(view).size).toBe(0);
  });

  it('a show reveals both hands to everyone, spectators included', () => {
    let s = dealt(['a', 'b']);
    s = act(s, 'b', { type: 'show' });
    const seenByStranger = cardsIn(viewFor(s, 'someone-watching'));
    for (const card of [...s.hand!.cards['a']!, ...s.hand!.cards['b']!]) {
      expect(seenByStranger.has(card)).toBe(true);
    }
    expect(Object.keys(viewFor(s, 'x').hand!.result!.labels).sort()).toEqual(['a', 'b']);
  });

  it('a sideshow reveals the two hands to its two players only', () => {
    let s = dealt(['a', 'b', 'c', 'd']);
    for (const id of ['a', 'b', 'c', 'd']) s = act(s, id, { type: 'see' });
    s = act(s, 'b', { type: 'bet', amount: 20 });
    s = act(s, 'c', { type: 'sideshow' });
    s = act(s, 'b', { type: 'sideshow-reply', accept: true });
    const pair = [...s.hand!.cards['b']!, ...s.hand!.cards['c']!];
    for (const viewer of ['b', 'c']) {
      const seen = cardsIn(viewFor(s, viewer));
      for (const card of pair) expect(seen.has(card)).toBe(true);
    }
    for (const viewer of ['a', 'd', 'stranger']) {
      const seen = cardsIn(viewFor(s, viewer));
      const own = new Set(s.hand!.cards[viewer] ?? []);
      for (const card of seen) expect(own.has(card as Card)).toBe(true);
    }
  });

  it('offers each player only the moves the rules allow them', () => {
    const s = dealt(['a', 'b', 'c']);
    expect(viewFor(s, 'b').me.can.bet).toEqual({ min: 10, max: 20 });
    expect(viewFor(s, 'c').me.can.bet).toBeNull();
    expect(viewFor(s, 'b').me.can.show).toBeNull();
    expect(viewFor(s, 'a', true).me.can.deal).toBe(false);
  });
});

describe('shuffling', () => {
  it('is uniform: every card lands in every position about equally often', () => {
    const rng = seededRng(2026);
    const trials = 26_000;
    const counts = new Array<number>(52).fill(0);
    for (let t = 0; t < trials; t++) {
      const deck = shuffle([...Array(52).keys()], rng);
      counts[deck.indexOf(0)]! += 1;
    }
    const expected = trials / 52;
    const chiSquare = counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
    // 51 degrees of freedom: 99.9th percentile ≈ 90.
    expect(chiSquare).toBeLessThan(90);
  });

  it('deals every card at most once', () => {
    for (let seed = 0; seed < 200; seed++) {
      const deck = shuffle(fullDeck(), seededRng(seed));
      expect(new Set(deck).size).toBe(52);
    }
  });

  it('the cryptographic RNG stays in range', () => {
    for (let i = 0; i < 2000; i++) {
      const n = cryptoRng.int(52);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(52);
    }
    expect(() => cryptoRng.int(0)).toThrow();
  });
});
