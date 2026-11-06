import type { MehfilView } from '@diwali/mehfil';
import { COLOURS, LIMITS, RADIUS, SIZES, TOOLS, type Folds, type Stroke } from '@diwali/rangoli';
import type { TableView } from '@diwali/teen-patti';
import { z } from 'zod';

/**
 * Every message on the realtime sockets. Client messages are parsed with
 * these schemas before anything acts on them; server messages are typed.
 *
 * `id` on client requests is the idempotency key: a room replays its
 * original answer to a repeated id instead of acting twice (double taps,
 * retries after a reconnect).
 *
 * Names never come from the client: a `join` or `sit` is completed with the
 * name on the player's verified ticket.
 */

export const GAME_KINDS = ['teen-patti', 'tambola', 'raja-mantri', 'charades'] as const;
export type GameKind = (typeof GAME_KINDS)[number];
export const gameKindSchema = z.enum(GAME_KINDS);

const requestId = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);
const chips = z.number().int().positive().max(10_000_000);
const memberId = z.string().min(1).max(64);

export const tableActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('sit'), seat: z.number().int().min(0).max(9).optional() }),
  z.object({ type: z.literal('leave') }),
  z.object({ type: z.literal('top-up'), target: memberId, amount: chips }),
  z.object({ type: z.literal('deal') }),
  z.object({ type: z.literal('see') }),
  z.object({ type: z.literal('bet'), amount: chips }),
  z.object({ type: z.literal('pack') }),
  z.object({ type: z.literal('show') }),
  z.object({ type: z.literal('sideshow') }),
  z.object({ type: z.literal('sideshow-reply'), accept: z.boolean() }),
]);

export const tambolaActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join') }),
  z.object({ type: z.literal('leave') }),
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('call') }),
  z.object({ type: z.literal('auto'), seconds: z.number().int().min(3).max(60).nullable() }),
  z.object({
    type: z.literal('mark'),
    ticket: z.number().int().min(0).max(2),
    number: z.number().int().min(1).max(90),
  }),
  z.object({
    type: z.literal('unmark'),
    ticket: z.number().int().min(0).max(2),
    number: z.number().int().min(1).max(90),
  }),
  z.object({
    type: z.literal('claim'),
    ticket: z.number().int().min(0).max(2),
    prize: z.enum([
      'early-five',
      'top-line',
      'middle-line',
      'bottom-line',
      'corners',
      'full-house',
    ]),
  }),
]);

export const rajaMantriActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join') }),
  z.object({ type: z.literal('leave') }),
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('accuse'), accused: memberId }),
  z.object({ type: z.literal('next') }),
]);

export const charadesActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join'), team: z.union([z.literal(0), z.literal(1)]).optional() }),
  z.object({ type: z.literal('switch-team') }),
  z.object({ type: z.literal('leave') }),
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('begin') }),
  z.object({ type: z.literal('guess'), text: z.string().min(1).max(80) }),
  z.object({ type: z.literal('got-it') }),
  z.object({ type: z.literal('pass') }),
  z.object({ type: z.literal('next') }),
]);

export const ACTION_SCHEMAS = {
  'teen-patti': tableActionSchema,
  tambola: tambolaActionSchema,
  'raja-mantri': rajaMantriActionSchema,
  charades: charadesActionSchema,
} as const;

export type TableAction = z.infer<typeof tableActionSchema>;
export type TambolaClientAction = z.infer<typeof tambolaActionSchema>;
export type RajaMantriClientAction = z.infer<typeof rajaMantriActionSchema>;
export type CharadesClientAction = z.infer<typeof charadesActionSchema>;

/** Game messages carry an action whose shape depends on the room's game. */
export const gameClientMessageSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('action'),
    id: requestId,
    action: z.object({ type: z.string() }).passthrough(),
  }),
  z.object({ t: z.literal('ping') }),
]);

/** Per-game options, chosen when a game is opened. */
export const gameOptionsSchema = z
  .object({
    boot: z.union([z.literal(5), z.literal(10), z.literal(25), z.literal(50)]).optional(),
    ticketsPerPlayer: z.number().int().min(1).max(3).optional(),
    rounds: z.number().int().min(1).max(10).optional(),
    turnsPerTeam: z.number().int().min(1).max(6).optional(),
    turnSeconds: z.number().int().min(30).max(180).optional(),
  })
  .strict();

export type GameOptions = z.infer<typeof gameOptionsSchema>;

export const partyClientMessageSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('create-game'),
    id: requestId,
    kind: gameKindSchema,
    options: gameOptionsSchema.optional(),
  }),
  z.object({ t: z.literal('ping') }),
]);

/**
 * The Rangoli Courtyard. Shapes are checked here; whether a stroke sits on
 * the disc, and who may erase what, is the rangoli engine's job.
 */
export const strokeInputSchema = z
  .object({
    tool: z.enum(TOOLS),
    colour: z.enum(COLOURS),
    size: z.enum(SIZES),
    points: z
      .array(z.number().int().min(-RADIUS).max(RADIUS))
      .min(2)
      .max(LIMITS.linePoints * 2),
  })
  .strict();

export const courtyardClientMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('draw'), id: requestId, stroke: strokeInputSchema }),
  z.object({ t: z.literal('undo'), id: requestId }),
  z.object({ t: z.literal('erase'), id: requestId, member: memberId }),
  z.object({
    t: z.literal('fresh'),
    id: requestId,
    folds: z.union([z.literal(6), z.literal(8), z.literal(12)]),
  }),
  z.object({ t: z.literal('ping') }),
]);

export type CourtyardClientMessage = z.infer<typeof courtyardClientMessageSchema>;

/** A browser tab's id for the Music Mehfil: which tab is the speaker. Not a credential. */
export const deviceIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,40}$/);

const songId = z.number().int().positive().max(1_000_000_000);

/**
 * The Music Mehfil. A request carries only a link: the room finds the video
 * id and asks YouTube for the title. The speaker's device id comes from the
 * connection, never from a message. Strict: unknown fields refuse the
 * message rather than being dropped.
 */
export const mehfilClientMessageSchema = z.discriminatedUnion('t', [
  z.strictObject({
    t: z.literal('add'),
    id: requestId,
    url: z.string().max(400),
    dedication: z.string().max(200).optional(),
  }),
  z.strictObject({ t: z.literal('vote'), id: requestId, song: songId, up: z.boolean() }),
  z.strictObject({ t: z.literal('remove'), id: requestId, song: songId }),
  z.strictObject({ t: z.literal('skip'), id: requestId, song: songId }),
  z.strictObject({ t: z.literal('claim'), id: requestId }),
  z.strictObject({ t: z.literal('release'), id: requestId }),
  z.strictObject({ t: z.literal('delegate'), id: requestId, member: memberId.nullable() }),
  z.strictObject({ t: z.literal('ended'), id: requestId, song: songId }),
  z.strictObject({ t: z.literal('failed'), id: requestId, song: songId }),
  z.strictObject({ t: z.literal('ping') }),
]);

export type MehfilClientMessage = z.infer<typeof mehfilClientMessageSchema>;

export type GameClientMessage = z.infer<typeof gameClientMessageSchema>;
export type PartyClientMessage = z.infer<typeof partyClientMessageSchema>;

export interface PresenceMember {
  member: string;
  name: string;
  emblem: string;
  role: 'host' | 'guest';
  /** Open connections (tabs, devices). */
  connections: number;
}

export interface GameSummary {
  game: string;
  kind: GameKind;
  createdBy: string;
  createdAt: number;
  players: number;
  status: 'lobby' | 'playing' | 'finished';
  /** One short line for the directory, e.g. "Boot 10" or "23 of 90 called". */
  detail: string;
}

export interface Profile {
  name: string;
  emblem: string;
}

export type ServerMessage =
  | { t: 'presence'; members: PresenceMember[] }
  | { t: 'games'; games: GameSummary[] }
  | {
      t: 'view';
      kind: GameKind;
      seq: number;
      view: unknown;
      profiles: Record<string, Profile>;
      events: unknown[];
    }
  /**
   * The whole rangoli, sent on connect in parts (a full courtyard is larger
   * than one socket message should be). Part 0 starts afresh; `done` marks
   * the last part. Changes after `seq` follow as drawn / erased / fresh.
   */
  | {
      t: 'courtyard';
      seq: number;
      folds: Folds;
      edition: number;
      part: number;
      done: boolean;
      strokes: Stroke[];
      profiles: Record<string, Profile>;
      /** Who this socket belongs to, from its ticket. Display only; the room enforces. */
      you: { member: string; role: 'host' | 'guest' };
    }
  | { t: 'drawn'; seq: number; stroke: Stroke }
  | { t: 'erased'; seq: number; ids: number[] }
  | { t: 'fresh'; seq: number; folds: Folds; edition: number }
  /** Who is in the courtyard now, and everyone who has drawn in it. */
  | { t: 'artists'; here: PresenceMember[]; profiles: Record<string, Profile> }
  /** The Music Mehfil, whole, after every change. `you.speaker`: this tab plays the music. */
  | {
      t: 'mehfil';
      seq: number;
      view: MehfilView;
      here: PresenceMember[];
      profiles: Record<string, Profile>;
      you: { member: string; role: 'host' | 'guest'; speaker: boolean };
    }
  | { t: 'result'; id: string; ok: true; data?: unknown }
  | { t: 'result'; id: string; ok: false; error: string }
  | { t: 'pong' }
  | { t: 'error'; error: string }
  /** You left or were removed from the party; the room is closing your socket. */
  | { t: 'revoked' };

/** Narrowing helper for the Teen Patti UI. */
export type TeenPattiViewMessage = Extract<ServerMessage, { t: 'view' }> & { view: TableView };
