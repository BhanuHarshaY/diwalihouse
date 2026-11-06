import { applyWith, shuffle, type Actor, type Context, type Outcome } from '@diwali/game-kit';
import { FILMS, type Film } from './films.ts';

/**
 * Bollywood dumb charades, two teams, as a pure state machine
 * (docs/games/charades-rules.md). The actor sees a film title only they can
 * see and acts it out; teammates type guesses (checked here) or call them out
 * (the actor taps "Got it"). Teams alternate; actors rotate within a team.
 */

export interface CharadesConfig {
  turnSeconds: number;
  turnsPerTeam: number;
}

export type Team = 0 | 1;

export interface TurnResult {
  team: Team;
  actor: string;
  film: string;
  outcome: 'guessed' | 'passed' | 'timeout';
  /** Who typed the right answer, when it was typed. */
  by: string | null;
}

export interface CharadesState {
  config: CharadesConfig;
  phase: 'lobby' | 'ready' | 'acting' | 'between' | 'finished';
  players: Array<{ id: string; name: string; team: Team }>;
  scores: [number, number];
  /** Turns completed so far. */
  turn: number;
  team: Team;
  /** Next actor position within each team. */
  rotation: [number, number];
  actor: string | null;
  card: number | null;
  deck: number[];
  deadline: number | null;
  guesses: Array<{ by: string; text: string }>;
  results: TurnResult[];
}

export type CharadesAction =
  | { type: 'join'; name: string; team?: Team }
  | { type: 'switch-team' }
  | { type: 'leave' }
  | { type: 'start' }
  | { type: 'begin' }
  | { type: 'guess'; text: string }
  | { type: 'got-it' }
  | { type: 'pass' }
  | { type: 'next' }
  | { type: 'tick' };

export type CharadesEvent =
  | { type: 'joined'; player: string; team: Team }
  | { type: 'switched'; player: string; team: Team }
  | { type: 'left'; player: string }
  | { type: 'started' }
  | { type: 'turn-ready'; team: Team; actor: string }
  | { type: 'turn-began'; actor: string; words: number }
  | { type: 'wrong-guess'; by: string }
  | { type: 'turn-ended'; result: TurnResult }
  | { type: 'finished'; winner: Team | null };

export type CharadesViolation =
  | 'already-joined'
  | 'not-joined'
  | 'not-in-lobby'
  | 'not-host'
  | 'teams-too-small'
  | 'not-actor'
  | 'not-ready'
  | 'not-acting'
  | 'not-your-team'
  | 'actor-cannot-guess'
  | 'empty-guess'
  | 'not-between'
  | 'not-due';

export type CharadesOutcome = Outcome<CharadesState, CharadesEvent, CharadesViolation>;

export function createCharades(config: Partial<CharadesConfig> = {}): CharadesState {
  return {
    config: { turnSeconds: 90, turnsPerTeam: 3, ...config },
    phase: 'lobby',
    players: [],
    scores: [0, 0],
    turn: 0,
    team: 0,
    rotation: [0, 0],
    actor: null,
    card: null,
    deck: [],
    deadline: null,
    guesses: [],
    results: [],
  };
}

/** Lower-case, accents and punctuation removed, "&" read as "and". */
export function normalizeTitle(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function matches(film: Film, guess: string): boolean {
  const g = normalizeTitle(guess);
  if (!g) return false;
  return [film.title, ...(film.aliases ?? [])].some((t) => normalizeTitle(t) === g);
}

export function wordCount(title: string): number {
  return normalizeTitle(title).split(' ').filter(Boolean).length;
}

export function applyCharades(
  state: CharadesState,
  action: CharadesAction,
  actor: Actor,
  ctx: Context,
): CharadesOutcome {
  return applyWith(state, action, actor, ctx, reduce);
}

function teamOf(s: CharadesState, team: Team) {
  return s.players.filter((p) => p.team === team);
}

function prepareTurn(s: CharadesState, events: CharadesEvent[]) {
  const members = teamOf(s, s.team);
  const actor = members[s.rotation[s.team] % members.length]!;
  s.actor = actor.id;
  s.phase = 'ready';
  s.card = null;
  s.deadline = null;
  s.guesses = [];
  events.push({ type: 'turn-ready', team: s.team, actor: actor.id });
}

function endTurn(
  s: CharadesState,
  outcome: TurnResult['outcome'],
  by: string | null,
  events: CharadesEvent[],
) {
  const result: TurnResult = {
    team: s.team,
    actor: s.actor!,
    film: FILMS[s.card!]!.title,
    outcome,
    by,
  };
  if (outcome === 'guessed') s.scores[s.team] += 1;
  s.results.push(result);
  s.phase = 'between';
  s.deadline = null;
  events.push({ type: 'turn-ended', result });
}

function reduce(
  s: CharadesState,
  action: CharadesAction,
  actor: Actor,
  ctx: Context,
  events: CharadesEvent[],
): CharadesViolation | null {
  if (action.type === 'tick') {
    if (s.phase !== 'acting' || s.deadline === null || ctx.now < s.deadline) return 'not-due';
    endTurn(s, 'timeout', null, events);
    return null;
  }
  if (actor.kind !== 'player') return 'not-joined';
  const me = s.players.find((p) => p.id === actor.id);

  switch (action.type) {
    case 'join': {
      if (s.phase !== 'lobby') return 'not-in-lobby';
      if (me) return 'already-joined';
      const team =
        action.team ?? (teamOf(s, 0).length <= teamOf(s, 1).length ? (0 as Team) : (1 as Team));
      s.players.push({ id: actor.id, name: action.name, team });
      events.push({ type: 'joined', player: actor.id, team });
      return null;
    }

    case 'switch-team':
      if (!me) return 'not-joined';
      if (s.phase !== 'lobby') return 'not-in-lobby';
      me.team = me.team === 0 ? 1 : 0;
      events.push({ type: 'switched', player: me.id, team: me.team });
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
      // Each team needs an actor and at least one guesser.
      if (teamOf(s, 0).length < 2 || teamOf(s, 1).length < 2) return 'teams-too-small';
      s.deck = shuffle(
        FILMS.map((_, i) => i),
        ctx.rng,
      );
      events.push({ type: 'started' });
      prepareTurn(s, events);
      return null;

    case 'begin': {
      if (s.phase !== 'ready') return 'not-ready';
      if (actor.id !== s.actor && !actor.host) return 'not-actor';
      s.card = s.deck.pop() ?? ctx.rng.int(FILMS.length);
      s.phase = 'acting';
      s.deadline = ctx.now + s.config.turnSeconds * 1000;
      events.push({ type: 'turn-began', actor: s.actor!, words: wordCount(FILMS[s.card]!.title) });
      return null;
    }

    case 'guess': {
      if (s.phase !== 'acting') return 'not-acting';
      if (!me || me.team !== s.team) return 'not-your-team';
      if (me.id === s.actor) return 'actor-cannot-guess';
      const text = action.text.trim().slice(0, 80);
      if (!text) return 'empty-guess';
      if (matches(FILMS[s.card!]!, text)) {
        endTurn(s, 'guessed', me.id, events);
      } else {
        s.guesses = [...s.guesses, { by: me.id, text }].slice(-8);
        events.push({ type: 'wrong-guess', by: me.id });
      }
      return null;
    }

    case 'got-it':
    case 'pass':
      if (s.phase !== 'acting') return 'not-acting';
      if (actor.id !== s.actor && !actor.host) return 'not-actor';
      endTurn(s, action.type === 'got-it' ? 'guessed' : 'passed', null, events);
      return null;

    case 'next': {
      if (s.phase !== 'between') return 'not-between';
      if (!actor.host && actor.id !== s.actor) return 'not-actor';
      s.rotation[s.team] += 1;
      s.turn += 1;
      if (s.turn >= s.config.turnsPerTeam * 2) {
        s.phase = 'finished';
        s.actor = null;
        const [a, b] = s.scores;
        events.push({ type: 'finished', winner: a === b ? null : a > b ? 0 : 1 });
        return null;
      }
      s.team = s.team === 0 ? 1 : 0;
      prepareTurn(s, events);
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export interface CharadesView {
  kind: 'charades';
  phase: CharadesState['phase'];
  config: CharadesConfig;
  scores: [number, number];
  turn: number;
  totalTurns: number;
  team: Team;
  actor: string | null;
  deadline: number | null;
  /** Word count of the current film, which the actor signals anyway. */
  words: number | null;
  players: Array<{ id: string; name: string; team: Team }>;
  /** The acting team's wrong guesses, shown to that team only. */
  guesses: Array<{ by: string; text: string }>;
  last: TurnResult | null;
  me: {
    id: string;
    joined: boolean;
    team: Team | null;
    acting: boolean;
    /** The film, for the actor only, while they act. */
    card: string | null;
    can: {
      join: boolean;
      switchTeam: boolean;
      leave: boolean;
      start: boolean;
      begin: boolean;
      guess: boolean;
      gotIt: boolean;
      pass: boolean;
      next: boolean;
    };
  };
}

export function viewCharades(state: CharadesState, viewer: string, host = false): CharadesView {
  const me = state.players.find((p) => p.id === viewer);
  const isActor = state.actor === viewer;
  const acting = state.phase === 'acting';
  const onActingTeam = !!me && me.team === state.team;
  const film = state.card !== null ? FILMS[state.card]! : null;
  return {
    kind: 'charades',
    phase: state.phase,
    config: { ...state.config },
    scores: [...state.scores] as [number, number],
    turn: state.turn,
    totalTurns: state.config.turnsPerTeam * 2,
    team: state.team,
    actor: state.actor,
    deadline: state.deadline,
    words: acting && film ? wordCount(film.title) : null,
    players: state.players.map((p) => ({ ...p })),
    guesses: acting && onActingTeam ? state.guesses.map((g) => ({ ...g })) : [],
    last:
      state.phase === 'between' || state.phase === 'finished'
        ? (state.results.at(-1) ?? null)
        : null,
    me: {
      id: viewer,
      joined: !!me,
      team: me?.team ?? null,
      acting: isActor,
      card: acting && isActor && film ? film.title : null,
      can: {
        join: !me && state.phase === 'lobby',
        switchTeam: !!me && state.phase === 'lobby',
        leave: !!me && state.phase === 'lobby',
        start: host && state.phase === 'lobby',
        begin: state.phase === 'ready' && (isActor || host),
        guess: acting && onActingTeam && !isActor,
        gotIt: acting && (isActor || host),
        pass: acting && (isActor || host),
        next: state.phase === 'between' && (isActor || host),
      },
    },
  };
}
