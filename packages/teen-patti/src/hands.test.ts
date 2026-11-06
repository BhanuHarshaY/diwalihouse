import { describe, expect, it } from 'vitest';
import type { Card } from './cards.ts';
import { compareCards, evaluate } from './hands.ts';

const h = (...cards: Card[]) => cards;
const beats = (a: Card[], b: Card[], a23: 'second' | 'lowest' = 'second') =>
  expect(compareCards(a, b, a23)).toBeGreaterThan(0);

describe('hand categories', () => {
  it.each([
    [h('As', 'Ah', 'Ad'), 'trail'],
    [h('Qh', 'Kh', 'Ah'), 'pure-sequence'],
    [h('Qh', 'Ks', 'Ad'), 'sequence'],
    [h('2c', '9c', 'Jc'), 'colour'],
    [h('7s', '7d', 'Kc'), 'pair'],
    [h('2s', '7d', 'Kc'), 'high-card'],
  ] as const)('%j is a %s', (cards, category) => {
    expect(evaluate(cards).category).toBe(category);
  });

  it('K-A-2 is not a sequence', () => {
    expect(evaluate(h('Ks', 'Ad', '2c')).category).toBe('high-card');
  });
});

describe('ranking between categories', () => {
  it('orders trail > pure sequence > sequence > colour > pair > high card', () => {
    const ladder = [
      h('2s', '2h', '2d'),
      h('4h', '3h', '2h'),
      h('4h', '3s', '2d'),
      h('2c', '5c', '9c'),
      h('2s', '2c', '3d'),
      h('As', 'Kd', 'Jc'),
    ];
    for (let i = 0; i < ladder.length - 1; i++) beats(ladder[i]!, ladder[i + 1]!);
  });
});

describe('ranking within categories', () => {
  it('A-A-A is the best trail and 2-2-2 the worst', () => {
    beats(h('As', 'Ah', 'Ad'), h('Ks', 'Kh', 'Kd'));
    beats(h('3s', '3h', '3d'), h('2s', '2h', '2d'));
  });

  it('A-K-Q is the highest sequence; A-2-3 comes second by default', () => {
    beats(h('As', 'Kd', 'Qc'), h('As', '2d', '3c'));
    beats(h('As', '2d', '3c'), h('Ks', 'Qd', 'Jc'));
  });

  it('with the "lowest" house rule, A-2-3 ranks below 4-3-2', () => {
    beats(h('4s', '3d', '2c'), h('As', '2d', '3c'), 'lowest');
    beats(h('Ks', 'Qd', 'Jc'), h('As', '2d', '3c'), 'lowest');
  });

  it('pairs compare the pair first, then the odd card', () => {
    beats(h('9s', '9d', '2c'), h('8s', '8d', 'Ac'));
    beats(h('9s', '9d', 'Kc'), h('9h', '9c', 'Qd'));
  });

  it('colours and high cards compare highest card first', () => {
    beats(h('Ac', '3c', '2c'), h('Kc', 'Qc', '9c'));
    beats(h('As', 'Kd', '3c'), h('As', 'Qd', 'Jc'));
    beats(h('As', 'Kd', '4c'), h('Ah', 'Ks', '3d'));
  });

  it('suits never break ties', () => {
    expect(compareCards(h('As', 'Kd', '9c'), h('Ah', 'Kc', '9s'))).toBe(0);
    expect(compareCards(h('Qh', 'Kh', 'Ah'), h('Qs', 'Ks', 'As'))).toBe(0);
  });
});
