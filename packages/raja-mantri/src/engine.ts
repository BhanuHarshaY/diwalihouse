import { applyWith, shuffle, type Actor, type Context, type Outcome } from '@diwali/game-kit';

/**
 * Raja Mantri Chor Sipahi, the four-player chit game, as a pure state
 * machine (docs/games/raja-mantri-rules.md). Each round four chits are
 * shuffled out in secret. The Raja and the Mantri are announced; the
 * Mantri must say which of the other two is the Chor. Right, and the Mantri
 * keeps their points; wrong, and the Chor walks off with them.
 */

export const ROLES = ['raja', 'mantri', 'chor', 'sipahi'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_POINTS: Record<Role, number> = { raja: 1000, mantri: 800, sipahi: 500, chor: 0 };
export const ROLE_LABEL: Record<Role, { en: string; hi: string }> = {
  raja: { en: 'Raja', hi: 'राजा' },
  mantri: { en: 'Mantri', hi: 'मंत्री' },
  chor: { en: 'Chor', hi: 'चोर' },
  sipahi: { en: 'Sipahi', hi: 'सिपाही' },
};

export interface RajaMantriConfig {
  rounds: number;
}

export interface RoundResult {
  round: number;
  roles: Record<string, Role>;
  accused: string;
  correct: boolean;
  points: Record<string, number>;
}

export interface RajaMantriState {
  config: RajaMantriConfig;
  phase: 'lobby' | 'guessing' | 'reveal' | 'finished';
  players: Array<{ id: string; name: string; score: number }>;
  round: number;
  /** Secret until the reveal, except to each player for their own chit. */
  roles: Record<string, Role>;
  history: RoundResult[];
}

export type RajaMantriAction =
  | { type: 'join'; name: string }
  | { type: 'leave' }
  | { type: 'start' }
  | { type: 'accuse'; accused: string }
  | { type: 'next' };

export type RajaMantriEvent =
  | { type: 'joined'; player: string }
  | { type: 'left'; player: string }
  | { type: 'dealt'; round: number; raja: string; mantri: string }
  | { type: 'accused'; mantri: string; accused: string; correct: boolean }
  | { type: 'finished'; winners: string[] };

export type RajaMantriViolation =
  | 'already-joined'
  | 'not-joined'
  | 'game-full'
  | 'not-in-lobby'
  | 'need-four'
  | 'not-host'
  | 'not-mantri'
  | 'not-guessing'
  | 'bad-accusation'
  | 'not-revealed';

export type RajaMantriOutcome = Outcome<RajaMantriState, RajaMantriEvent, RajaMantriViolation>;

export function createRajaMantri(config: Partial<RajaMantriConfig> = {}): RajaMantriState {
  return {
    config: { rounds: 5, ...config },
    phase: 'lobby',
    players: [],
    round: 0,
    roles: {},
    history: [],
  };
}

export function holderOf(state: RajaMantriState, role: Role): string | undefined {
  return Object.entries(state.roles).find(([, r]) => r === role)?.[0];
}

export function applyRajaMantri(
  state: RajaMantriState,
  action: RajaMantriAction,
  actor: Actor,
  ctx: Context,
): RajaMantriOutcome {
  return applyWith(state, action, actor, ctx, reduce);
}

function deal(s: RajaMantriState, ctx: Context, events: RajaMantriEvent[]) {
  const chits = shuffle([...ROLES], ctx.rng);
  s.roles = Object.fromEntries(s.players.map((p, i) => [p.id, chits[i]!]));
  s.round += 1;
  s.phase = 'guessing';
  events.push({
    type: 'dealt',
    round: s.round,
    raja: holderOf(s, 'raja')!,
    mantri: holderOf(s, 'mantri')!,
  });
}

function reduce(
  s: RajaMantriState,
  action: RajaMantriAction,
  actor: Actor,
  ctx: Context,
  events: RajaMantriEvent[],
): RajaMantriViolation | null {
  if (actor.kind !== 'player') return 'not-joined';
  const me = s.players.find((p) => p.id === actor.id);

  switch (action.type) {
    case 'join':
      if (s.phase !== 'lobby') return 'not-in-lobby';
      if (me) return 'already-joined';
      if (s.players.length >= 4) return 'game-full';
      s.players.push({ id: actor.id, name: action.name, score: 0 });
      events.push({ type: 'joined', player: actor.id });
      return null;

    case 'leave':
      if (!me) return 'not-joined';
      if (s.phase !== 'lobby') return 'not-in-lobby';
      s.players = s.players.filter((p) => p.id !== actor.id);
      events.push({ type: 'left', player: actor.id });
      return null;

    case 'start':
      if (!actor.host) return 'not-host';
      if (s.phase !== 'lobby') return 'not-in-lobby';
      if (s.players.length !== 4) return 'need-four';
      deal(s, ctx, events);
      return null;

    case 'accuse': {
      if (s.phase !== 'guessing') return 'not-guessing';
      if (s.roles[actor.id] !== 'mantri') return 'not-mantri';
      const suspect = s.roles[action.accused];
      if (suspect !== 'chor' && suspect !== 'sipahi') return 'bad-accusation';
      const correct = suspect === 'chor';
      const points: Record<string, number> = {};
      for (const [id, role] of Object.entries(s.roles)) {
        if (role === 'mantri') points[id] = correct ? ROLE_POINTS.mantri : 0;
        else if (role === 'chor') points[id] = correct ? 0 : ROLE_POINTS.mantri;
        else points[id] = ROLE_POINTS[role];
      }
      for (const p of s.players) p.score += points[p.id] ?? 0;
      s.history.push({
        round: s.round,
        roles: { ...s.roles },
        accused: action.accused,
        correct,
        points,
      });
      s.phase = 'reveal';
      events.push({ type: 'accused', mantri: actor.id, accused: action.accused, correct });
      return null;
    }

    case 'next': {
      if (!actor.host) return 'not-host';
      if (s.phase !== 'reveal') return 'not-revealed';
      if (s.round >= s.config.rounds) {
        s.phase = 'finished';
        const best = Math.max(...s.players.map((p) => p.score));
        events.push({
          type: 'finished',
          winners: s.players.filter((p) => p.score === best).map((p) => p.id),
        });
        return null;
      }
      deal(s, ctx, events);
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export interface RajaMantriView {
  kind: 'raja-mantri';
  phase: RajaMantriState['phase'];
  config: RajaMantriConfig;
  round: number;
  players: Array<{ id: string; name: string; score: number }>;
  /** Public roles: the Raja and the Mantri while guessing; everyone after the reveal. */
  known: Record<string, Role>;
  last: RoundResult | null;
  me: {
    id: string;
    joined: boolean;
    role: Role | null;
    can: { join: boolean; leave: boolean; start: boolean; accuse: string[]; next: boolean };
  };
}

export function viewRajaMantri(
  state: RajaMantriState,
  viewer: string,
  host = false,
): RajaMantriView {
  const joined = state.players.some((p) => p.id === viewer);
  const known: Record<string, Role> = {};
  if (state.phase === 'guessing') {
    for (const role of ['raja', 'mantri'] as const) {
      const id = holderOf(state, role);
      if (id) known[id] = role;
    }
  } else if (state.phase !== 'lobby') {
    Object.assign(known, state.roles);
  }
  const myRole = state.phase === 'lobby' ? null : (state.roles[viewer] ?? null);
  const suspects =
    state.phase === 'guessing' && myRole === 'mantri'
      ? state.players.map((p) => p.id).filter((id) => !(id in known))
      : [];
  return {
    kind: 'raja-mantri',
    phase: state.phase,
    config: { ...state.config },
    round: state.round,
    players: state.players.map((p) => ({ ...p })),
    known,
    last: state.history.at(-1) ? structuredClone(state.history.at(-1)!) : null,
    me: {
      id: viewer,
      joined,
      role: myRole,
      can: {
        join: !joined && state.phase === 'lobby' && state.players.length < 4,
        leave: joined && state.phase === 'lobby',
        start: host && state.phase === 'lobby' && state.players.length === 4,
        accuse: suspects,
        next: host && state.phase === 'reveal',
      },
    },
  };
}
