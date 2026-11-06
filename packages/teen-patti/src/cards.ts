/**
 * Cards are two-character codes: rank (2–9, T, J, Q, K, A) then suit
 * (s, h, d, c). `"Ah"` is the ace of hearts, `"Td"` the ten of diamonds.
 * Strings keep states and views small, serialisable and easy to read in logs.
 */

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export const SUITS = ['s', 'h', 'd', 'c'] as const;

export type RankChar = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
export type Card = `${RankChar}${Suit}`;

/** 2 → 2 … A → 14. */
export function rankValue(card: Card): number {
  return RANKS.indexOf(card[0] as RankChar) + 2;
}

export function suitOf(card: Card): Suit {
  return card[1] as Suit;
}

export function fullDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => `${rank}${suit}` as Card));
}

export function isCard(value: string): value is Card {
  return (
    value.length === 2 && RANKS.includes(value[0] as RankChar) && SUITS.includes(value[1] as Suit)
  );
}
