import { rankValue, suitOf, type Card } from './cards.ts';

/**
 * Hand ranking (docs/games/teen-patti-rules.md § 6), high to low:
 * trail, pure sequence, sequence, colour, pair, high card. Suits never
 * break ties.
 */

export type Category = 'trail' | 'pure-sequence' | 'sequence' | 'colour' | 'pair' | 'high-card';

const CATEGORY_RANK: Record<Category, number> = {
  trail: 6,
  'pure-sequence': 5,
  sequence: 4,
  colour: 3,
  pair: 2,
  'high-card': 1,
};

export type A23Rank = 'second' | 'lowest';

export interface HandValue {
  category: Category;
  /** Compared left to right after the category. */
  key: number[];
}

function sequenceTop(values: number[], a23: A23Rank): number | null {
  const [hi, mid, lo] = values as [number, number, number];
  if (hi === 14 && mid === 3 && lo === 2) {
    // A-2-3 sits just below A-K-Q (top 14), or below 4-3-2 (top 4).
    return a23 === 'second' ? 13.5 : 3;
  }
  return hi - mid === 1 && mid - lo === 1 ? hi : null;
}

export function evaluate(cards: readonly Card[], a23: A23Rank = 'second'): HandValue {
  if (cards.length !== 3) throw new RangeError('A Teen Patti hand has three cards');
  const values = cards.map(rankValue).sort((x, y) => y - x);
  const [hi, mid, lo] = values as [number, number, number];
  const flush = cards.every((card) => suitOf(card) === suitOf(cards[0]!));
  const top = sequenceTop(values, a23);

  if (hi === lo) return { category: 'trail', key: [hi] };
  if (top !== null && flush) return { category: 'pure-sequence', key: [top] };
  if (top !== null) return { category: 'sequence', key: [top] };
  if (flush) return { category: 'colour', key: [hi, mid, lo] };
  if (hi === mid) return { category: 'pair', key: [hi, lo] };
  if (mid === lo) return { category: 'pair', key: [mid, hi] };
  return { category: 'high-card', key: [hi, mid, lo] };
}

/** Positive if `a` beats `b`, negative if it loses, 0 if equal. */
export function compare(a: HandValue, b: HandValue): number {
  const byCategory = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
  if (byCategory !== 0) return byCategory;
  for (let i = 0; i < Math.max(a.key.length, b.key.length); i++) {
    const diff = (a.key[i] ?? 0) - (b.key[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function compareCards(
  a: readonly Card[],
  b: readonly Card[],
  a23: A23Rank = 'second',
): number {
  return compare(evaluate(a, a23), evaluate(b, a23));
}

export const CATEGORY_LABEL: Record<Category, string> = {
  trail: 'Trail',
  'pure-sequence': 'Pure sequence',
  sequence: 'Sequence',
  colour: 'Colour',
  pair: 'Pair',
  'high-card': 'High card',
};
