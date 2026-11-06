import type { Card } from './cards.ts';
import { CATEGORY_LABEL, evaluate } from './hands.ts';
import {
  activePlayers,
  betRange,
  canDeal,
  handInProgress,
  showCost,
  sideshowTarget,
  type HandResult,
  type PlayerStatus,
  type TableConfig,
  type TableState,
} from './engine.ts';

/**
 * What one person at (or watching) the table is allowed to know.
 *
 * Guarantees, each covered by a test:
 *  - never the deck, the RNG, or anyone else's cards;
 *  - a blind player's own cards are withheld until they choose to see;
 *  - other hands appear only when shown to the table (`result.revealed`)
 *    or, for its two participants only, after an accepted sideshow.
 */

export interface SeatView {
  id: string;
  name: string;
  seat: number;
  stack: number;
  status: PlayerStatus | 'sitting-out';
  contributed: number;
}

export interface TableView {
  config: Pick<
    TableConfig,
    'boot' | 'buyIn' | 'chaalLimit' | 'potLimit' | 'sideshow' | 'turnSeconds' | 'maxSeats'
  >;
  seats: SeatView[];
  hand: null | {
    number: number;
    dealer: string;
    order: string[];
    pot: number;
    stake: number;
    turn: string | null;
    deadline: number | null;
    sideshow: { from: string; to: string } | null;
    result: (HandResult & { labels: Record<string, string> }) | null;
  };
  me: {
    id: string;
    seated: boolean;
    inHand: boolean;
    /** Own cards: only once seen, or after the hand is over. */
    cards: Card[] | null;
    label: string | null;
    sideshowReveal: { cards: Record<string, Card[]>; loser: string } | null;
    can: {
      sit: boolean;
      leave: boolean;
      deal: boolean;
      see: boolean;
      pack: boolean;
      bet: { min: number; max: number } | null;
      show: number | null;
      sideshow: string | null;
      replySideshow: boolean;
    };
  };
}

function label(cards: Card[], state: TableState): string {
  return CATEGORY_LABEL[evaluate(cards, state.config.a23).category];
}

export function viewFor(state: TableState, viewerId: string, viewerIsHost = false): TableView {
  const hand = state.hand;
  const { config } = state;
  const seated = state.players.some((p) => p.id === viewerId);
  const inHand = !!hand && hand.order.includes(viewerId);
  const live = handInProgress(state);
  const myStatus = inHand ? hand!.status[viewerId] : undefined;

  let cards: Card[] | null = null;
  if (inHand && hand) {
    const over = hand.result !== null;
    if (myStatus === 'seen' || over) cards = [...hand.cards[viewerId]!];
  }

  const reveal = hand?.sideshowReveal;
  const sideshowReveal =
    reveal && reveal.viewers.includes(viewerId)
      ? { cards: structuredClone(reveal.cards), loser: reveal.loser }
      : null;

  const result = hand?.result
    ? {
        ...structuredClone(hand.result),
        labels: Object.fromEntries(
          Object.entries(hand.result.revealed).map(([id, shown]) => [id, label(shown, state)]),
        ),
      }
    : null;

  const active = hand ? activePlayers(hand) : [];

  return {
    config: {
      boot: config.boot,
      buyIn: config.buyIn,
      chaalLimit: config.chaalLimit,
      potLimit: config.potLimit,
      sideshow: config.sideshow,
      turnSeconds: config.turnSeconds,
      maxSeats: config.maxSeats,
    },
    seats: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      stack: p.stack,
      status: hand && live && hand.order.includes(p.id) ? hand.status[p.id]! : 'sitting-out',
      contributed: hand?.contributed[p.id] ?? 0,
    })),
    hand: hand
      ? {
          number: hand.number,
          dealer: hand.dealer,
          order: [...hand.order],
          pot: hand.pot,
          stake: hand.stake,
          turn: hand.turn,
          deadline: hand.deadline,
          sideshow: hand.sideshow ? { ...hand.sideshow } : null,
          result,
        }
      : null,
    me: {
      id: viewerId,
      seated,
      inHand,
      cards,
      label: cards ? label(cards, state) : null,
      sideshowReveal,
      can: {
        sit: !seated && state.players.length < config.maxSeats,
        leave: seated,
        deal: viewerIsHost && canDeal(state),
        see: live && myStatus === 'blind',
        pack: live && inHand && myStatus !== 'packed' && active.includes(viewerId),
        bet: betRange(state, viewerId),
        show: showCost(state, viewerId),
        sideshow: sideshowTarget(state, viewerId),
        replySideshow: live && hand!.sideshow?.to === viewerId,
      },
    },
  };
}
