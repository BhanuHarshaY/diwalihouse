import {
  ACTION_SCHEMAS,
  type GameKind,
  type GameOptions,
  type GameSummary,
} from '@diwali/realtime-protocol';
import { applyCharades, createCharades, viewCharades, type CharadesState } from '@diwali/charades';
import type { Actor, Context } from '@diwali/game-kit';
import {
  applyRajaMantri,
  createRajaMantri,
  viewRajaMantri,
  type RajaMantriState,
} from '@diwali/raja-mantri';
import { applyTambola, createTambola, viewTambola, type TambolaState } from '@diwali/tambola';
import {
  apply as applyTeenPatti,
  createTable,
  handInProgress,
  viewFor,
  type TableState,
} from '@diwali/teen-patti';
import type { Connection } from './game-core.ts';

/**
 * One adapter per game, so a single Durable Object class can host any of
 * them. Adapters only translate: rules live in the engine packages.
 */

export type Applied =
  { ok: true; state: unknown; events: unknown[] } | { ok: false; error: string };

export interface GameAdapter {
  kind: GameKind;
  create(options: GameOptions): unknown;
  /**
   * Validates a client action against this game's schema and completes it
   * with identity from the verified ticket. Null if it isn't a valid action.
   */
  prepare(action: unknown, connection: Connection): unknown | null;
  apply(state: unknown, action: unknown, actor: Actor, ctx: Context): Applied;
  /** The game's timer (turn clock, auto-caller), when one is running. */
  tick(state: unknown, ctx: Context): Applied;
  deadline(state: unknown): number | null;
  view(state: unknown, member: string, host: boolean): unknown;
  summary(state: unknown): Pick<GameSummary, 'players' | 'status' | 'detail'>;
}

const system: Actor = { kind: 'system' };

function withName(action: unknown, connection: Connection, types: string[]): unknown {
  const a = action as { type: string };
  return types.includes(a.type) ? { ...a, name: connection.name } : a;
}

const teenPatti: GameAdapter = {
  kind: 'teen-patti',
  create: (options) => createTable({ boot: options.boot ?? 10 }),
  prepare(action, connection) {
    const parsed = ACTION_SCHEMAS['teen-patti'].safeParse(action);
    return parsed.success ? withName(parsed.data, connection, ['sit']) : null;
  },
  apply: (state, action, actor, ctx) =>
    applyTeenPatti(state as TableState, action as never, actor, ctx),
  tick: (state, ctx) => applyTeenPatti(state as TableState, { type: 'tick' }, system, ctx),
  deadline: (state) => {
    const s = state as TableState;
    return handInProgress(s) ? (s.hand?.deadline ?? null) : null;
  },
  view: (state, member, host) => viewFor(state as TableState, member, host),
  summary: (state) => {
    const s = state as TableState;
    return {
      players: s.players.length,
      status: handInProgress(s) ? 'playing' : 'lobby',
      detail: `Boot ${s.config.boot}`,
    };
  },
};

const tambola: GameAdapter = {
  kind: 'tambola',
  create: (options) => createTambola({ ticketsPerPlayer: options.ticketsPerPlayer ?? 1 }),
  prepare(action, connection) {
    const parsed = ACTION_SCHEMAS.tambola.safeParse(action);
    return parsed.success ? withName(parsed.data, connection, ['join']) : null;
  },
  apply: (state, action, actor, ctx) =>
    applyTambola(state as TambolaState, action as never, actor, ctx),
  tick: (state, ctx) => applyTambola(state as TambolaState, { type: 'tick' }, system, ctx),
  deadline: (state) => {
    const s = state as TambolaState;
    return s.phase === 'calling' ? s.nextCallAt : null;
  },
  view: (state, member, host) => viewTambola(state as TambolaState, member, host),
  summary: (state) => {
    const s = state as TambolaState;
    return {
      players: s.players.length,
      status: s.phase === 'lobby' ? 'lobby' : s.phase === 'calling' ? 'playing' : 'finished',
      detail:
        s.phase === 'lobby'
          ? `${s.config.ticketsPerPlayer} ticket${s.config.ticketsPerPlayer === 1 ? '' : 's'} each`
          : s.phase === 'calling'
            ? `${s.called.length} of 90 called`
            : 'Game over',
    };
  },
};

const rajaMantri: GameAdapter = {
  kind: 'raja-mantri',
  create: (options) => createRajaMantri({ rounds: options.rounds ?? 5 }),
  prepare(action, connection) {
    const parsed = ACTION_SCHEMAS['raja-mantri'].safeParse(action);
    return parsed.success ? withName(parsed.data, connection, ['join']) : null;
  },
  apply: (state, action, actor, ctx) =>
    applyRajaMantri(state as RajaMantriState, action as never, actor, ctx),
  tick: () => ({ ok: false, error: 'not-due' }),
  deadline: () => null,
  view: (state, member, host) => viewRajaMantri(state as RajaMantriState, member, host),
  summary: (state) => {
    const s = state as RajaMantriState;
    return {
      players: s.players.length,
      status: s.phase === 'lobby' ? 'lobby' : s.phase === 'finished' ? 'finished' : 'playing',
      detail:
        s.phase === 'lobby'
          ? `${s.players.length} of 4 seated`
          : `Round ${s.round} of ${s.config.rounds}`,
    };
  },
};

const charades: GameAdapter = {
  kind: 'charades',
  create: (options) =>
    createCharades({
      turnsPerTeam: options.turnsPerTeam ?? 3,
      turnSeconds: options.turnSeconds ?? 90,
    }),
  prepare(action, connection) {
    const parsed = ACTION_SCHEMAS.charades.safeParse(action);
    return parsed.success ? withName(parsed.data, connection, ['join']) : null;
  },
  apply: (state, action, actor, ctx) =>
    applyCharades(state as CharadesState, action as never, actor, ctx),
  tick: (state, ctx) => applyCharades(state as CharadesState, { type: 'tick' }, system, ctx),
  deadline: (state) => {
    const s = state as CharadesState;
    return s.phase === 'acting' ? s.deadline : null;
  },
  view: (state, member, host) => viewCharades(state as CharadesState, member, host),
  summary: (state) => {
    const s = state as CharadesState;
    return {
      players: s.players.length,
      status: s.phase === 'lobby' ? 'lobby' : s.phase === 'finished' ? 'finished' : 'playing',
      detail:
        s.phase === 'lobby' ? `${s.players.length} joined` : `Score ${s.scores[0]}–${s.scores[1]}`,
    };
  },
};

export const ADAPTERS: Record<GameKind, GameAdapter> = {
  'teen-patti': teenPatti,
  tambola,
  'raja-mantri': rajaMantri,
  charades,
};
