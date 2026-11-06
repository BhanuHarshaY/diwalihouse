import { fullDeck, type Card } from './cards.ts';
import { compareCards, evaluate, type A23Rank } from './hands.ts';
import { shuffle, type Rng } from './rng.ts';

/**
 * The Teen Patti table as a pure state machine (docs/games/teen-patti-rules.md).
 *
 *   apply(state, action, actor, ctx) → { state, events } | { error }
 *
 * No I/O, no clock, no ambient randomness: `ctx` supplies the time and the
 * RNG. A rejected action never changes state. Events are public and never
 * contain cards; each player's cards reach them only through `viewFor`.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TableConfig {
  boot: number;
  buyIn: number;
  /** Largest single bet. */
  chaalLimit: number;
  /** When the pot reaches this, everyone still in shows. */
  potLimit: number;
  sideshow: boolean;
  a23: A23Rank;
  showTie: 'requester-loses' | 'split';
  seenMayShowBlind: boolean;
  turnSeconds: number;
  maxSeats: number;
}

export function defaultConfig(boot = 10): TableConfig {
  return {
    boot,
    buyIn: 100 * boot,
    chaalLimit: 128 * boot,
    potLimit: 1024 * boot,
    sideshow: true,
    a23: 'second',
    showTie: 'requester-loses',
    seenMayShowBlind: false,
    turnSeconds: 30,
    maxSeats: 6,
  };
}

export interface Player {
  id: string;
  name: string;
  seat: number;
  stack: number;
}

export type PlayerStatus = 'blind' | 'seen' | 'packed';

export interface HandResult {
  winners: string[];
  payouts: Record<string, number>;
  reason: 'last-standing' | 'show' | 'pot-limit';
  /** Hands revealed to the whole table (shows only). */
  revealed: Record<string, Card[]>;
}

export interface SideshowReveal {
  viewers: [string, string];
  cards: Record<string, Card[]>;
  loser: string;
}

export interface Hand {
  number: number;
  dealer: string;
  /** Participants, clockwise from the dealer's left. */
  order: string[];
  status: Record<string, PlayerStatus>;
  cards: Record<string, Card[]>;
  contributed: Record<string, number>;
  pot: number;
  stake: number;
  turn: string | null;
  deadline: number | null;
  sideshow: { from: string; to: string } | null;
  sideshowReveal: SideshowReveal | null;
  result: HandResult | null;
}

export interface TableState {
  config: TableConfig;
  players: Player[];
  hand: Hand | null;
  handsPlayed: number;
  lastDealerSeat: number | null;
}

export type Action =
  | { type: 'sit'; name: string; seat?: number }
  | { type: 'leave' }
  | { type: 'top-up'; target: string; amount: number }
  | { type: 'deal' }
  | { type: 'see' }
  | { type: 'bet'; amount: number }
  | { type: 'pack' }
  | { type: 'show' }
  | { type: 'sideshow' }
  | { type: 'sideshow-reply'; accept: boolean }
  | { type: 'tick' };

export type Actor = { kind: 'player'; id: string; host: boolean } | { kind: 'system' };

export interface Context {
  now: number;
  rng: Rng;
}

export type TableEvent =
  | { type: 'sat'; player: string; seat: number }
  | { type: 'left'; player: string }
  | { type: 'topped-up'; player: string; amount: number }
  | { type: 'dealt'; hand: number; dealer: string; order: string[]; boot: number }
  | { type: 'saw'; player: string }
  | { type: 'bet'; player: string; amount: number; blind: boolean }
  | { type: 'packed'; player: string; reason: 'chose' | 'timeout' | 'left' | 'sideshow' }
  | { type: 'show'; player: string; against: string }
  | { type: 'sideshow-requested'; from: string; to: string }
  | { type: 'sideshow-declined'; from: string; to: string; reason: 'chose' | 'timeout' }
  | { type: 'sideshow-accepted'; from: string; to: string; loser: string }
  | { type: 'won'; winners: string[]; pot: number; reason: HandResult['reason'] };

export type RuleViolation =
  | 'not-seated'
  | 'already-seated'
  | 'table-full'
  | 'seat-taken'
  | 'hand-in-progress'
  | 'no-hand'
  | 'not-host'
  | 'not-enough-players'
  | 'not-in-hand'
  | 'not-your-turn'
  | 'already-seen'
  | 'bet-out-of-range'
  | 'insufficient-chips'
  | 'show-not-allowed'
  | 'sideshow-not-allowed'
  | 'awaiting-sideshow'
  | 'no-sideshow-pending'
  | 'invalid-amount'
  | 'not-due';

export type Outcome =
  { ok: true; state: TableState; events: TableEvent[] } | { ok: false; error: RuleViolation };

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function createTable(config: Partial<TableConfig> = {}): TableState {
  return {
    config: { ...defaultConfig(config.boot), ...config },
    players: [],
    hand: null,
    handsPlayed: 0,
    lastDealerSeat: null,
  };
}

export function handInProgress(state: TableState): boolean {
  return state.hand !== null && state.hand.result === null;
}

export function activePlayers(hand: Hand): string[] {
  return hand.order.filter((id) => hand.status[id] !== 'packed');
}

/** The allowed range for `id`'s next bet, or null if they can't bet now. */
export function betRange(state: TableState, id: string): { min: number; max: number } | null {
  const hand = state.hand;
  if (!hand || hand.result || hand.turn !== id || hand.sideshow) return null;
  const seen = hand.status[id] === 'seen';
  const cap = state.config.chaalLimit;
  const min = Math.min(seen ? 2 * hand.stake : hand.stake, cap);
  const max = Math.min(seen ? 4 * hand.stake : 2 * hand.stake, cap);
  const stack = player(state, id)?.stack ?? 0;
  if (stack < min) return null;
  return { min, max: Math.min(max, seen ? stack - (stack % 2) : stack) };
}

/** Cost of a show for `id` now, or null if a show isn't allowed. */
export function showCost(state: TableState, id: string): number | null {
  const hand = state.hand;
  if (!hand || hand.result || hand.turn !== id || hand.sideshow) return null;
  const active = activePlayers(hand);
  if (active.length !== 2) return null;
  const other = active.find((p) => p !== id)!;
  const seen = hand.status[id] === 'seen';
  if (seen && hand.status[other] === 'blind' && !state.config.seenMayShowBlind) return null;
  const cost = seen ? 2 * hand.stake : hand.stake;
  // Short-stacked players show with everything they have.
  return Math.min(cost, player(state, id)?.stack ?? 0);
}

/** Who a sideshow from `id` would be asked of, or null if it isn't allowed. */
export function sideshowTarget(state: TableState, id: string): string | null {
  const hand = state.hand;
  if (!state.config.sideshow || !hand || hand.result || hand.turn !== id || hand.sideshow)
    return null;
  if (hand.status[id] !== 'seen') return null;
  if (activePlayers(hand).length < 3) return null;
  const target = previousActive(hand, id);
  if (!target || hand.status[target] !== 'seen') return null;
  if ((player(state, id)?.stack ?? 0) < 2 * hand.stake) return null;
  return target;
}

export function canDeal(state: TableState): boolean {
  return !handInProgress(state) && eligible(state).length >= 2;
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export function apply(state: TableState, action: Action, actor: Actor, ctx: Context): Outcome {
  const next = structuredClone(state);
  const events: TableEvent[] = [];
  const error = reduce(next, action, actor, ctx, events);
  return error ? { ok: false, error } : { ok: true, state: next, events };
}

function reduce(
  s: TableState,
  action: Action,
  actor: Actor,
  ctx: Context,
  events: TableEvent[],
): RuleViolation | null {
  if (action.type === 'tick') return tick(s, ctx, events);
  if (actor.kind !== 'player') return 'not-seated';
  const id = actor.id;

  switch (action.type) {
    case 'sit': {
      if (player(s, id)) return 'already-seated';
      if (s.players.length >= s.config.maxSeats) return 'table-full';
      const taken = new Set(s.players.map((p) => p.seat));
      let seat = action.seat;
      if (seat === undefined) {
        seat = 0;
        while (taken.has(seat)) seat++;
      }
      if (!Number.isInteger(seat) || seat < 0 || seat >= s.config.maxSeats) return 'seat-taken';
      if (taken.has(seat)) return 'seat-taken';
      s.players.push({ id, name: action.name, seat, stack: s.config.buyIn });
      s.players.sort((a, b) => a.seat - b.seat);
      events.push({ type: 'sat', player: id, seat });
      return null;
    }

    case 'leave': {
      if (!player(s, id)) return 'not-seated';
      const hand = s.hand;
      if (hand && !hand.result && hand.order.includes(id) && hand.status[id] !== 'packed') {
        pack(s, id, 'left', ctx, events);
      }
      s.players = s.players.filter((p) => p.id !== id);
      events.push({ type: 'left', player: id });
      return null;
    }

    case 'top-up': {
      if (!actor.host) return 'not-host';
      if (handInProgress(s)) return 'hand-in-progress';
      const target = player(s, action.target);
      if (!target) return 'not-seated';
      if (
        !Number.isInteger(action.amount) ||
        action.amount <= 0 ||
        action.amount > 10 * s.config.buyIn
      ) {
        return 'invalid-amount';
      }
      target.stack += action.amount;
      events.push({ type: 'topped-up', player: target.id, amount: action.amount });
      return null;
    }

    case 'deal':
      if (!actor.host) return 'not-host';
      return deal(s, ctx, events);

    case 'see': {
      const hand = s.hand;
      if (!hand || hand.result) return 'no-hand';
      if (!hand.order.includes(id) || hand.status[id] === 'packed') return 'not-in-hand';
      if (hand.status[id] === 'seen') return 'already-seen';
      hand.status[id] = 'seen';
      events.push({ type: 'saw', player: id });
      return null;
    }

    case 'bet': {
      const hand = s.hand;
      if (!hand || hand.result) return 'no-hand';
      if (hand.sideshow) return 'awaiting-sideshow';
      if (hand.turn !== id) return 'not-your-turn';
      if (!Number.isInteger(action.amount)) return 'invalid-amount';
      const seen = hand.status[id] === 'seen';
      const range = betRange(s, id);
      if (!range) return 'insufficient-chips';
      if (action.amount < range.min || action.amount > range.max) return 'bet-out-of-range';
      if (seen && action.amount % 2 !== 0) return 'invalid-amount';
      putIn(s, id, action.amount);
      hand.stake = seen ? action.amount / 2 : action.amount;
      events.push({ type: 'bet', player: id, amount: action.amount, blind: !seen });
      if (hand.pot >= s.config.potLimit) {
        settle(s, activePlayers(hand), 'pot-limit', true, events);
      } else {
        advance(s, id, ctx);
      }
      return null;
    }

    case 'pack': {
      const hand = s.hand;
      if (!hand || hand.result) return 'no-hand';
      if (!hand.order.includes(id) || hand.status[id] === 'packed') return 'not-in-hand';
      pack(s, id, 'chose', ctx, events);
      return null;
    }

    case 'show': {
      const hand = s.hand;
      if (!hand || hand.result) return 'no-hand';
      if (hand.sideshow) return 'awaiting-sideshow';
      if (hand.turn !== id) return 'not-your-turn';
      const cost = showCost(s, id);
      if (cost === null) return 'show-not-allowed';
      const other = activePlayers(hand).find((p) => p !== id)!;
      putIn(s, id, cost);
      events.push({ type: 'show', player: id, against: other });
      const result = compareCards(hand.cards[id]!, hand.cards[other]!, s.config.a23);
      const winners =
        result > 0
          ? [id]
          : result < 0
            ? [other]
            : s.config.showTie === 'split'
              ? [id, other]
              : [other];
      settle(s, winners, 'show', true, events, [id, other]);
      return null;
    }

    case 'sideshow': {
      const hand = s.hand;
      if (!hand || hand.result) return 'no-hand';
      if (hand.sideshow) return 'awaiting-sideshow';
      if (hand.turn !== id) return 'not-your-turn';
      const target = sideshowTarget(s, id);
      if (!target) return 'sideshow-not-allowed';
      const cost = 2 * hand.stake;
      putIn(s, id, cost);
      events.push({ type: 'bet', player: id, amount: cost, blind: false });
      hand.sideshow = { from: id, to: target };
      hand.deadline = ctx.now + s.config.turnSeconds * 1000;
      events.push({ type: 'sideshow-requested', from: id, to: target });
      return null;
    }

    case 'sideshow-reply': {
      const hand = s.hand;
      if (!hand || hand.result) return 'no-hand';
      if (!hand.sideshow) return 'no-sideshow-pending';
      if (hand.sideshow.to !== id) return 'not-your-turn';
      resolveSideshow(s, action.accept, 'chose', ctx, events);
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function player(s: TableState, id: string): Player | undefined {
  return s.players.find((p) => p.id === id);
}

function eligible(s: TableState): Player[] {
  return s.players.filter((p) => p.stack >= s.config.boot);
}

function deal(s: TableState, ctx: Context, events: TableEvent[]): RuleViolation | null {
  if (handInProgress(s)) return 'hand-in-progress';
  const seated = eligible(s); // sorted by seat
  if (seated.length < 2) return 'not-enough-players';

  // The deal moves one seat clockwise each hand.
  const dealerIndex =
    s.lastDealerSeat === null
      ? 0
      : (() => {
          const after = seated.findIndex((p) => p.seat > s.lastDealerSeat!);
          return after === -1 ? 0 : after;
        })();
  const dealer = seated[dealerIndex]!;
  const order = [...seated.slice(dealerIndex + 1), ...seated.slice(0, dealerIndex + 1)].map(
    (p) => p.id,
  );

  const deck = shuffle(fullDeck(), ctx.rng);
  const cards: Record<string, Card[]> = {};
  for (const id of order) cards[id] = [];
  for (let round = 0; round < 3; round++) {
    for (const id of order) cards[id]!.push(deck.pop()!);
  }

  const status: Record<string, PlayerStatus> = {};
  const contributed: Record<string, number> = {};
  for (const id of order) {
    status[id] = 'blind';
    contributed[id] = 0;
  }

  s.hand = {
    number: s.handsPlayed + 1,
    dealer: dealer.id,
    order,
    status,
    cards,
    contributed,
    pot: 0,
    stake: s.config.boot,
    turn: order[0]!,
    deadline: ctx.now + s.config.turnSeconds * 1000,
    sideshow: null,
    sideshowReveal: null,
    result: null,
  };
  for (const id of order) putIn(s, id, s.config.boot);
  s.handsPlayed += 1;
  events.push({
    type: 'dealt',
    hand: s.hand.number,
    dealer: dealer.id,
    order,
    boot: s.config.boot,
  });
  return null;
}

function putIn(s: TableState, id: string, amount: number) {
  const hand = s.hand!;
  const p = player(s, id)!;
  p.stack -= amount;
  hand.contributed[id] = (hand.contributed[id] ?? 0) + amount;
  hand.pot += amount;
}

function nextActive(hand: Hand, from: string): string | null {
  const start = hand.order.indexOf(from);
  for (let step = 1; step <= hand.order.length; step++) {
    const id = hand.order[(start + step) % hand.order.length]!;
    if (hand.status[id] !== 'packed' && id !== from) return id;
  }
  return null;
}

function previousActive(hand: Hand, from: string): string | null {
  const start = hand.order.indexOf(from);
  const n = hand.order.length;
  for (let step = 1; step <= n; step++) {
    const id = hand.order[(start - step + n) % n]!;
    if (hand.status[id] !== 'packed' && id !== from) return id;
  }
  return null;
}

function advance(s: TableState, from: string, ctx: Context) {
  const hand = s.hand!;
  hand.turn = nextActive(hand, from);
  hand.deadline = ctx.now + s.config.turnSeconds * 1000;
}

function pack(
  s: TableState,
  id: string,
  reason: 'chose' | 'timeout' | 'left' | 'sideshow',
  ctx: Context,
  events: TableEvent[],
) {
  const hand = s.hand!;
  if (hand.sideshow && (hand.sideshow.from === id || hand.sideshow.to === id)) {
    const { from } = hand.sideshow;
    hand.sideshow = null;
    // Play resumes after whoever asked for the sideshow.
    if (hand.turn === from && from !== id) {
      hand.status[id] = 'packed';
      events.push({ type: 'packed', player: id, reason });
      if (activePlayers(hand).length === 1)
        return settle(s, activePlayers(hand), 'last-standing', false, events);
      return advance(s, from, ctx);
    }
  }
  const hadTurn = hand.turn === id;
  hand.status[id] = 'packed';
  events.push({ type: 'packed', player: id, reason });
  const active = activePlayers(hand);
  if (active.length === 1) return settle(s, active, 'last-standing', false, events);
  if (hadTurn) advance(s, id, ctx);
}

function resolveSideshow(
  s: TableState,
  accept: boolean,
  reason: 'chose' | 'timeout',
  ctx: Context,
  events: TableEvent[],
) {
  const hand = s.hand!;
  const { from, to } = hand.sideshow!;
  hand.sideshow = null;
  if (!accept) {
    events.push({ type: 'sideshow-declined', from, to, reason });
    return advance(s, from, ctx);
  }
  // Equal hands: the player who asked packs.
  const loser = compareCards(hand.cards[from]!, hand.cards[to]!, s.config.a23) > 0 ? to : from;
  hand.sideshowReveal = {
    viewers: [from, to],
    cards: { [from]: [...hand.cards[from]!], [to]: [...hand.cards[to]!] },
    loser,
  };
  events.push({ type: 'sideshow-accepted', from, to, loser });
  hand.status[loser] = 'packed';
  events.push({ type: 'packed', player: loser, reason: 'sideshow' });
  // Three or more were active, so at least two remain.
  advance(s, from, ctx);
}

function settle(
  s: TableState,
  winners: string[],
  reason: HandResult['reason'],
  reveal: boolean,
  events: TableEvent[],
  revealOnly?: string[],
) {
  const hand = s.hand!;
  // Ties at a forced show split the pot between every best hand.
  let finalWinners = winners;
  if (reason === 'pot-limit') {
    const best = [...winners].sort((a, b) =>
      compareCards(hand.cards[b]!, hand.cards[a]!, s.config.a23),
    )[0]!;
    finalWinners = winners.filter(
      (id) => compareCards(hand.cards[id]!, hand.cards[best]!, s.config.a23) === 0,
    );
  }
  const share = Math.floor(hand.pot / finalWinners.length);
  const payouts: Record<string, number> = {};
  finalWinners.forEach((id, i) => {
    // Indivisible chips go to the first winner clockwise.
    payouts[id] = share + (i === 0 ? hand.pot - share * finalWinners.length : 0);
    const p = player(s, id);
    if (p) p.stack += payouts[id]!;
  });
  const revealed: Record<string, Card[]> = {};
  if (reveal) {
    for (const id of revealOnly ?? winners) revealed[id] = [...hand.cards[id]!];
  }
  hand.result = { winners: finalWinners, payouts, reason, revealed };
  hand.turn = null;
  hand.deadline = null;
  hand.sideshow = null;
  const dealerSeat = player(s, hand.dealer)?.seat;
  s.lastDealerSeat = dealerSeat ?? s.lastDealerSeat;
  events.push({ type: 'won', winners: finalWinners, pot: hand.pot, reason });
}

function tick(s: TableState, ctx: Context, events: TableEvent[]): RuleViolation | null {
  const hand = s.hand;
  if (!hand || hand.result || hand.deadline === null) return 'no-hand';
  if (ctx.now < hand.deadline) return 'not-due';
  if (hand.sideshow) {
    resolveSideshow(s, false, 'timeout', ctx, events);
  } else if (hand.turn) {
    pack(s, hand.turn, 'timeout', ctx, events);
  }
  return null;
}

/** Exposed for tests and for describing results in the UI. */
export function handValue(state: TableState, id: string) {
  const cards = state.hand?.cards[id];
  return cards ? evaluate(cards, state.config.a23) : null;
}
