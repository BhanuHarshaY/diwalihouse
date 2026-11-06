import { applyWith, shuffle, type Actor, type Context, type Outcome } from '@diwali/game-kit';
import { generateTicket, rowNumbers, ticketNumbers, type Ticket } from './tickets.ts';

/**
 * Tambola (housie), as a pure state machine (docs/games/tambola-rules.md).
 * The host calls numbers (by hand or on a timer); players mark their own
 * tickets; every claim is checked against the numbers actually called.
 */

export const PRIZES = [
  'early-five',
  'top-line',
  'middle-line',
  'bottom-line',
  'corners',
  'full-house',
] as const;
export type PrizeId = (typeof PRIZES)[number];

export const PRIZE_LABEL: Record<PrizeId, string> = {
  'early-five': 'Early five',
  'top-line': 'Top line',
  'middle-line': 'Middle line',
  'bottom-line': 'Bottom line',
  corners: 'Four corners',
  'full-house': 'Full house',
};

export const PRIZE_POINTS: Record<PrizeId, number> = {
  'early-five': 10,
  'top-line': 15,
  'middle-line': 15,
  'bottom-line': 15,
  corners: 10,
  'full-house': 40,
};

export interface TambolaConfig {
  ticketsPerPlayer: number;
  /** Seconds between automatic calls; null means the host calls by hand. */
  autoCallSeconds: number | null;
  maxPlayers: number;
}

export interface TambolaPlayer {
  id: string;
  name: string;
  tickets: Ticket[];
  /** Numbers the player has marked, per ticket. Only ever called numbers. */
  marks: number[][];
  points: number;
}

export interface PrizeWin {
  winner: string;
  ticket: number;
  /** How many numbers had been called when it was won. */
  atCall: number;
}

export interface TambolaState {
  config: TambolaConfig;
  phase: 'lobby' | 'calling' | 'finished';
  players: TambolaPlayer[];
  /** Numbers still to come, in their (secret) order. */
  bag: number[];
  called: number[];
  prizes: Record<PrizeId, PrizeWin | null>;
  bogeys: Record<string, number>;
  nextCallAt: number | null;
}

export type TambolaAction =
  | { type: 'join'; name: string }
  | { type: 'leave' }
  | { type: 'start' }
  | { type: 'call' }
  | { type: 'auto'; seconds: number | null }
  | { type: 'mark'; ticket: number; number: number }
  | { type: 'unmark'; ticket: number; number: number }
  | { type: 'claim'; ticket: number; prize: PrizeId }
  | { type: 'tick' };

export type TambolaEvent =
  | { type: 'joined'; player: string }
  | { type: 'left'; player: string }
  | { type: 'started'; players: number }
  | { type: 'called'; number: number; count: number }
  | { type: 'auto'; seconds: number | null }
  | { type: 'won'; player: string; prize: PrizeId; points: number }
  | { type: 'bogey'; player: string; prize: PrizeId }
  | { type: 'finished'; reason: 'full-house' | 'bag-empty' };

export type TambolaViolation =
  | 'already-joined'
  | 'not-joined'
  | 'game-full'
  | 'not-in-lobby'
  | 'not-calling'
  | 'not-host'
  | 'no-players'
  | 'bag-empty'
  | 'bad-ticket'
  | 'not-called'
  | 'not-on-ticket'
  | 'already-won'
  | 'bogey'
  | 'bad-interval'
  | 'not-due';

export type TambolaOutcome = Outcome<TambolaState, TambolaEvent, TambolaViolation>;

export function createTambola(config: Partial<TambolaConfig> = {}): TambolaState {
  return {
    config: { ticketsPerPlayer: 1, autoCallSeconds: null, maxPlayers: 50, ...config },
    phase: 'lobby',
    players: [],
    bag: [],
    called: [],
    prizes: Object.fromEntries(PRIZES.map((p) => [p, null])) as Record<PrizeId, PrizeWin | null>,
    bogeys: {},
    nextCallAt: null,
  };
}

/** The numbers a prize needs, on one ticket. */
export function prizeNumbers(ticket: Ticket, prize: PrizeId): number[] | 'any-five' {
  switch (prize) {
    case 'early-five':
      return 'any-five';
    case 'top-line':
      return rowNumbers(ticket, 0);
    case 'middle-line':
      return rowNumbers(ticket, 1);
    case 'bottom-line':
      return rowNumbers(ticket, 2);
    case 'corners': {
      const top = rowNumbers(ticket, 0);
      const bottom = rowNumbers(ticket, 2);
      return [top[0]!, top.at(-1)!, bottom[0]!, bottom.at(-1)!];
    }
    case 'full-house':
      return ticketNumbers(ticket);
  }
}

export function isComplete(ticket: Ticket, prize: PrizeId, called: ReadonlySet<number>): boolean {
  const needed = prizeNumbers(ticket, prize);
  if (needed === 'any-five') return ticketNumbers(ticket).filter((n) => called.has(n)).length >= 5;
  return needed.every((n) => called.has(n));
}

export function applyTambola(
  state: TambolaState,
  action: TambolaAction,
  actor: Actor,
  ctx: Context,
): TambolaOutcome {
  return applyWith(state, action, actor, ctx, reduce);
}

function reduce(
  s: TambolaState,
  action: TambolaAction,
  actor: Actor,
  ctx: Context,
  events: TambolaEvent[],
): TambolaViolation | null {
  if (action.type === 'tick') {
    if (s.phase !== 'calling' || s.nextCallAt === null || ctx.now < s.nextCallAt) return 'not-due';
    return call(s, ctx, events);
  }
  if (actor.kind !== 'player') return 'not-joined';
  const me = s.players.find((p) => p.id === actor.id);

  switch (action.type) {
    case 'join':
      if (s.phase !== 'lobby') return 'not-in-lobby';
      if (me) return 'already-joined';
      if (s.players.length >= s.config.maxPlayers) return 'game-full';
      s.players.push({ id: actor.id, name: action.name, tickets: [], marks: [], points: 0 });
      events.push({ type: 'joined', player: actor.id });
      return null;

    case 'leave':
      if (!me) return 'not-joined';
      s.players = s.players.filter((p) => p.id !== actor.id);
      events.push({ type: 'left', player: actor.id });
      return null;

    case 'start':
      if (!actor.host) return 'not-host';
      if (s.phase !== 'lobby') return 'not-in-lobby';
      if (s.players.length === 0) return 'no-players';
      for (const p of s.players) {
        p.tickets = Array.from({ length: s.config.ticketsPerPlayer }, () =>
          generateTicket(ctx.rng),
        );
        p.marks = p.tickets.map(() => []);
      }
      s.bag = shuffle(
        Array.from({ length: 90 }, (_, i) => i + 1),
        ctx.rng,
      );
      s.phase = 'calling';
      s.nextCallAt = s.config.autoCallSeconds ? ctx.now + s.config.autoCallSeconds * 1000 : null;
      events.push({ type: 'started', players: s.players.length });
      return null;

    case 'call':
      if (!actor.host) return 'not-host';
      if (s.phase !== 'calling') return 'not-calling';
      return call(s, ctx, events);

    case 'auto': {
      if (!actor.host) return 'not-host';
      const seconds = action.seconds;
      if (seconds !== null && (!Number.isInteger(seconds) || seconds < 3 || seconds > 60)) {
        return 'bad-interval';
      }
      s.config.autoCallSeconds = seconds;
      s.nextCallAt = s.phase === 'calling' && seconds ? ctx.now + seconds * 1000 : null;
      events.push({ type: 'auto', seconds });
      return null;
    }

    case 'mark':
    case 'unmark': {
      if (!me) return 'not-joined';
      if (s.phase === 'lobby') return 'not-calling';
      const ticket = me.tickets[action.ticket];
      if (!ticket) return 'bad-ticket';
      if (!ticketNumbers(ticket).includes(action.number)) return 'not-on-ticket';
      const marks = me.marks[action.ticket]!;
      if (action.type === 'unmark') {
        me.marks[action.ticket] = marks.filter((n) => n !== action.number);
        return null;
      }
      if (!s.called.includes(action.number)) return 'not-called';
      if (!marks.includes(action.number)) marks.push(action.number);
      return null;
    }

    case 'claim': {
      if (!me) return 'not-joined';
      if (s.phase !== 'calling') return 'not-calling';
      const ticket = me.tickets[action.ticket];
      if (!ticket) return 'bad-ticket';
      if (s.prizes[action.prize]) return 'already-won';
      if (!isComplete(ticket, action.prize, new Set(s.called))) {
        // A bogus claim is refused and counted; it costs nothing else.
        s.bogeys[me.id] = (s.bogeys[me.id] ?? 0) + 1;
        events.push({ type: 'bogey', player: me.id, prize: action.prize });
        return null;
      }
      const points = PRIZE_POINTS[action.prize];
      s.prizes[action.prize] = { winner: me.id, ticket: action.ticket, atCall: s.called.length };
      me.points += points;
      events.push({ type: 'won', player: me.id, prize: action.prize, points });
      if (action.prize === 'full-house') finish(s, 'full-house', events);
      return null;
    }
  }
}

function call(s: TambolaState, ctx: Context, events: TambolaEvent[]): TambolaViolation | null {
  const next = s.bag.pop();
  if (next === undefined) return 'bag-empty';
  s.called.push(next);
  events.push({ type: 'called', number: next, count: s.called.length });
  if (s.bag.length === 0) {
    finish(s, 'bag-empty', events);
    return null;
  }
  s.nextCallAt = s.config.autoCallSeconds ? ctx.now + s.config.autoCallSeconds * 1000 : null;
  return null;
}

function finish(s: TambolaState, reason: 'full-house' | 'bag-empty', events: TambolaEvent[]) {
  s.phase = 'finished';
  s.nextCallAt = null;
  events.push({ type: 'finished', reason });
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export interface TambolaView {
  kind: 'tambola';
  phase: TambolaState['phase'];
  config: TambolaConfig;
  called: number[];
  last: number | null;
  remaining: number;
  nextCallAt: number | null;
  prizes: Record<PrizeId, (PrizeWin & { name: string }) | null>;
  players: Array<{ id: string; name: string; points: number }>;
  me: {
    id: string;
    joined: boolean;
    tickets: Ticket[];
    marks: number[][];
    bogeys: number;
    can: {
      join: boolean;
      leave: boolean;
      start: boolean;
      call: boolean;
      auto: boolean;
      claim: PrizeId[];
    };
  };
}

/** What one person may see: their own tickets, never anyone else's or the bag. */
export function viewTambola(state: TambolaState, viewer: string, host = false): TambolaView {
  const me = state.players.find((p) => p.id === viewer);
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? 'Someone';
  return {
    kind: 'tambola',
    phase: state.phase,
    config: { ...state.config },
    called: [...state.called],
    last: state.called.at(-1) ?? null,
    remaining: state.phase === 'lobby' ? 90 : state.bag.length,
    nextCallAt: state.nextCallAt,
    prizes: Object.fromEntries(
      PRIZES.map((p) => {
        const win = state.prizes[p];
        return [p, win ? { ...win, name: nameOf(win.winner) } : null];
      }),
    ) as TambolaView['prizes'],
    players: state.players
      .map((p) => ({ id: p.id, name: p.name, points: p.points }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)),
    me: {
      id: viewer,
      joined: !!me,
      tickets: me ? structuredClone(me.tickets) : [],
      marks: me ? structuredClone(me.marks) : [],
      bogeys: state.bogeys[viewer] ?? 0,
      can: {
        join: !me && state.phase === 'lobby' && state.players.length < state.config.maxPlayers,
        leave: !!me && state.phase === 'lobby',
        start: host && state.phase === 'lobby' && state.players.length > 0,
        call: host && state.phase === 'calling',
        auto: host && state.phase !== 'finished',
        claim: me && state.phase === 'calling' ? PRIZES.filter((p) => !state.prizes[p]) : [],
      },
    },
  };
}
