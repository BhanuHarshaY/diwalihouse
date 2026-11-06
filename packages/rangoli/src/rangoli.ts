import type { Actor, Outcome } from '@diwali/game-kit';

/**
 * The Rangoli Courtyard's one shared rangoli, as pure rules
 * (docs/rangoli-courtyard.md). Guests add strokes; each stroke is drawn
 * `folds` times around the centre and mirrored, so the rangoli is
 * symmetrical by construction. Coordinates are integers on a disc of
 * radius RADIUS around the origin: small to send, simple to check.
 */

export const RADIUS = 1000;

export const FOLDS = [6, 8, 12] as const;
export type Folds = (typeof FOLDS)[number];

export const TOOLS = ['line', 'petal', 'dot', 'ring'] as const;
export type Tool = (typeof TOOLS)[number];

/** Powder colours. The web app maps each to a palette pigment. */
export const COLOURS = [
  'white',
  'turmeric',
  'marigold',
  'vermilion',
  'rani',
  'rose',
  'peacock',
  'teal',
] as const;
export type Colour = (typeof COLOURS)[number];

export const SIZES = ['fine', 'medium', 'bold'] as const;
export type Size = (typeof SIZES)[number];

export const LIMITS = {
  /** Strokes in one rangoli. Past this the host starts a fresh one. */
  strokes: 2500,
  /** Strokes one person may have in it, so nobody fills the courtyard alone. */
  perMember: 600,
  /** Points in one line; longer lines are sent as several strokes. */
  linePoints: 96,
  /** Rate limit: a burst of this many strokes, refilling at `perSecond`. */
  burst: 24,
  perSecond: 4,
  /** Shortest petal, and smallest ring, in coordinate units. */
  minLength: 20,
} as const;

export interface StrokeInput {
  tool: Tool;
  colour: Colour;
  size: Size;
  /** Flat integer pairs: [x0, y0, x1, y1, …]. */
  points: number[];
}

export interface Stroke extends StrokeInput {
  id: number;
  /** Member id of the person who drew it. */
  by: string;
}

interface Bucket {
  tokens: number;
  at: number;
}

export interface RangoliState {
  folds: Folds;
  /** Increments each time the host starts a fresh rangoli. */
  edition: number;
  strokes: Stroke[];
  nextId: number;
  /** Rate-limit buckets per member. Not worth persisting: they refill in seconds. */
  buckets: Record<string, Bucket>;
}

export type RangoliAction =
  | { type: 'draw'; stroke: StrokeInput }
  | { type: 'undo' }
  | { type: 'erase'; member: string }
  | { type: 'fresh'; folds: Folds };

export type RangoliEvent =
  | { type: 'drawn'; stroke: Stroke }
  | { type: 'erased'; ids: number[] }
  | { type: 'fresh'; folds: Folds; edition: number };

export type RangoliViolation =
  | 'not-member'
  | 'not-host'
  | 'bad-stroke'
  | 'full'
  | 'share-used'
  | 'slow-down'
  | 'nothing-to-undo'
  | 'nothing-to-erase'
  | 'bad-folds';

export type RangoliOutcome = Outcome<RangoliState, RangoliEvent, RangoliViolation>;

export function createRangoli(folds: Folds = 8): RangoliState {
  return { folds, edition: 1, strokes: [], nextId: 1, buckets: {} };
}

const POINT_COUNT: Record<Tool, [min: number, max: number]> = {
  line: [2, LIMITS.linePoints],
  petal: [2, 2],
  dot: [1, 1],
  ring: [1, 1],
};

/** Whether a stroke is well formed: on the disc, the right shape for its tool. */
export function isValidStroke(stroke: StrokeInput): boolean {
  if (!TOOLS.includes(stroke.tool) || !COLOURS.includes(stroke.colour)) return false;
  if (!SIZES.includes(stroke.size)) return false;
  const p = stroke.points;
  if (!Array.isArray(p) || p.length % 2 !== 0) return false;
  const [min, max] = POINT_COUNT[stroke.tool];
  if (p.length / 2 < min || p.length / 2 > max) return false;
  for (let i = 0; i < p.length; i += 2) {
    const x = p[i]!;
    const y = p[i + 1]!;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
    if (x * x + y * y > RADIUS * RADIUS) return false;
  }
  if (stroke.tool === 'petal') {
    return Math.hypot(p[2]! - p[0]!, p[3]! - p[1]!) >= LIMITS.minLength;
  }
  if (stroke.tool === 'ring') return Math.hypot(p[0]!, p[1]!) >= LIMITS.minLength;
  return true;
}

function refill(bucket: Bucket | undefined, now: number): Bucket {
  if (!bucket) return { tokens: LIMITS.burst, at: now };
  const elapsed = Math.max(0, now - bucket.at) / 1000;
  return { tokens: Math.min(LIMITS.burst, bucket.tokens + elapsed * LIMITS.perSecond), at: now };
}

const ok = (state: RangoliState, events: RangoliEvent[]): RangoliOutcome => ({
  ok: true,
  state,
  events,
});
const refuse = (error: RangoliViolation): RangoliOutcome => ({ ok: false, error });

/**
 * Applies one person's action. Pure, and cheap with thousands of strokes:
 * the stroke list is copied by reference, never deep-cloned.
 */
export function applyRangoli(
  state: RangoliState,
  action: RangoliAction,
  actor: Actor,
  now: number,
): RangoliOutcome {
  if (actor.kind !== 'player') return refuse('not-member');

  switch (action.type) {
    case 'draw': {
      const input = action.stroke;
      if (!isValidStroke(input)) return refuse('bad-stroke');
      if (state.strokes.length >= LIMITS.strokes) return refuse('full');
      const mine = state.strokes.reduce((n, s) => n + (s.by === actor.id ? 1 : 0), 0);
      if (mine >= LIMITS.perMember) return refuse('share-used');
      const bucket = refill(state.buckets[actor.id], now);
      if (bucket.tokens < 1) return refuse('slow-down');
      // Copy field by field, so nothing else the client sent is kept.
      const stroke: Stroke = {
        id: state.nextId,
        by: actor.id,
        tool: input.tool,
        colour: input.colour,
        size: input.size,
        points: [...input.points],
      };
      return ok(
        {
          ...state,
          strokes: [...state.strokes, stroke],
          nextId: state.nextId + 1,
          buckets: { ...state.buckets, [actor.id]: { tokens: bucket.tokens - 1, at: now } },
        },
        [{ type: 'drawn', stroke }],
      );
    }

    case 'undo': {
      const last = state.strokes.findLast((s) => s.by === actor.id);
      if (!last) return refuse('nothing-to-undo');
      return ok({ ...state, strokes: state.strokes.filter((s) => s !== last) }, [
        { type: 'erased', ids: [last.id] },
      ]);
    }

    case 'erase': {
      if (!actor.host) return refuse('not-host');
      const ids = state.strokes.filter((s) => s.by === action.member).map((s) => s.id);
      if (ids.length === 0) return refuse('nothing-to-erase');
      return ok({ ...state, strokes: state.strokes.filter((s) => s.by !== action.member) }, [
        { type: 'erased', ids },
      ]);
    }

    case 'fresh': {
      if (!actor.host) return refuse('not-host');
      if (!FOLDS.includes(action.folds)) return refuse('bad-folds');
      const edition = state.edition + 1;
      // Ids keep counting up, so a late message about an old stroke can't
      // touch a new one.
      return ok({ ...state, folds: action.folds, edition, strokes: [] }, [
        { type: 'fresh', folds: action.folds, edition },
      ]);
    }
  }
}

/** How many strokes each person has in the rangoli. */
export function strokesByMember(state: Pick<RangoliState, 'strokes'>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of state.strokes) counts.set(s.by, (counts.get(s.by) ?? 0) + 1);
  return counts;
}
