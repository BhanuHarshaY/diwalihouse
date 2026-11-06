import {
  applyRangoli,
  createRangoli,
  type Folds,
  type RangoliAction,
  type RangoliState,
  type Stroke,
} from '@diwali/rangoli';
import type { CourtyardClientMessage, Profile, ServerMessage } from '@diwali/realtime-protocol';
import type { Connection } from './game-core.ts';
import { presence } from './party-core.ts';

/**
 * Everything the Rangoli Courtyard room does, minus the Durable Object
 * plumbing: identity, idempotency, the rangoli rules, and the messages to
 * send. Strokes are stored one row each by the DO; the rest is `save()`.
 *
 * Unlike a game, the courtyard sends changes, not whole views: a rangoli
 * can hold thousands of strokes, and everyone sees the same one.
 */

export interface SavedCourtyard {
  party: string;
  folds: Folds;
  edition: number;
  nextId: number;
  seq: number;
  profiles: Record<string, Profile>;
  recent: Array<[string, ServerMessage]>;
}

/** What the DO must write to its stroke table after a change. */
export type StrokeChange = { insert: Stroke } | { remove: number[] } | { clear: true };

export interface Handled {
  /** For the sender only. */
  reply: ServerMessage;
  /** For every socket in the courtyard, sent before the reply. */
  broadcast: ServerMessage | null;
  changes: StrokeChange[];
}

const RECENT_LIMIT = 200;
/** Strokes per snapshot message; a full courtyard is sent in several. */
export const SNAPSHOT_PART = 400;

export class CourtyardCore {
  party: string;
  seq: number;
  profiles: Record<string, Profile>;
  private state: RangoliState;
  private recent: Map<string, ServerMessage>;

  constructor(saved: SavedCourtyard, strokes: Stroke[]) {
    this.party = saved.party;
    this.seq = saved.seq;
    this.profiles = saved.profiles;
    this.recent = new Map(saved.recent);
    this.state = {
      folds: saved.folds,
      edition: saved.edition,
      nextId: saved.nextId,
      strokes,
      buckets: {},
    };
  }

  static create(party: string): CourtyardCore {
    const fresh = createRangoli();
    return new CourtyardCore(
      {
        party,
        folds: fresh.folds,
        edition: fresh.edition,
        nextId: fresh.nextId,
        seq: 0,
        profiles: {},
        recent: [],
      },
      [],
    );
  }

  get strokes(): readonly Stroke[] {
    return this.state.strokes;
  }

  save(): SavedCourtyard {
    return {
      party: this.party,
      folds: this.state.folds,
      edition: this.state.edition,
      nextId: this.state.nextId,
      seq: this.seq,
      profiles: this.profiles,
      recent: [...this.recent],
    };
  }

  /** Remembers who someone is, from their verified ticket. True if anything changed. */
  greet(connection: Connection): boolean {
    const known = this.profiles[connection.member];
    if (known?.name === connection.name && known.emblem === connection.emblem) return false;
    this.profiles[connection.member] = { name: connection.name, emblem: connection.emblem };
    return true;
  }

  handle(connection: Connection, message: CourtyardClientMessage, now: number): Handled {
    if (message.t === 'ping') return { reply: { t: 'pong' }, broadcast: null, changes: [] };

    const key = `${connection.member}:${message.id}`;
    const seen = this.recent.get(key);
    if (seen) return { reply: seen, broadcast: null, changes: [] };

    const action: RangoliAction =
      message.t === 'draw'
        ? { type: 'draw', stroke: message.stroke }
        : message.t === 'undo'
          ? { type: 'undo' }
          : message.t === 'erase'
            ? { type: 'erase', member: message.member }
            : { type: 'fresh', folds: message.folds };
    const actor = {
      kind: 'player',
      id: connection.member,
      host: connection.role === 'host',
    } as const;
    const outcome = applyRangoli(this.state, action, actor, now);

    if (!outcome.ok) {
      const reply: ServerMessage = { t: 'result', id: message.id, ok: false, error: outcome.error };
      this.remember(key, reply);
      return { reply, broadcast: null, changes: [] };
    }

    this.state = outcome.state;
    this.seq += 1;
    const event = outcome.events[0]!;
    let handled: Handled;
    switch (event.type) {
      case 'drawn':
        handled = {
          reply: { t: 'result', id: message.id, ok: true, data: { stroke: event.stroke.id } },
          broadcast: { t: 'drawn', seq: this.seq, stroke: event.stroke },
          changes: [{ insert: event.stroke }],
        };
        break;
      case 'erased':
        handled = {
          reply: { t: 'result', id: message.id, ok: true, data: { erased: event.ids.length } },
          broadcast: { t: 'erased', seq: this.seq, ids: event.ids },
          changes: [{ remove: event.ids }],
        };
        break;
      case 'fresh':
        handled = {
          reply: { t: 'result', id: message.id, ok: true },
          broadcast: { t: 'fresh', seq: this.seq, folds: event.folds, edition: event.edition },
          changes: [{ clear: true }],
        };
        break;
    }
    this.remember(key, handled.reply);
    return handled;
  }

  /** The whole rangoli, in parts small enough for one socket message each. */
  snapshot(you: Connection): ServerMessage[] {
    const strokes = this.state.strokes;
    const parts = Math.max(1, Math.ceil(strokes.length / SNAPSHOT_PART));
    return Array.from({ length: parts }, (_, part) => ({
      t: 'courtyard' as const,
      seq: this.seq,
      folds: this.state.folds,
      edition: this.state.edition,
      part,
      done: part === parts - 1,
      strokes: strokes.slice(part * SNAPSHOT_PART, (part + 1) * SNAPSHOT_PART),
      profiles: part === 0 ? this.profiles : {},
      you: { member: you.member, role: you.role },
    }));
  }

  artists(connections: Connection[]): ServerMessage {
    return { t: 'artists', here: presence(connections), profiles: this.profiles };
  }

  private remember(key: string, reply: ServerMessage) {
    this.recent.set(key, reply);
    if (this.recent.size > RECENT_LIMIT) {
      const oldest = this.recent.keys().next().value;
      if (oldest !== undefined) this.recent.delete(oldest);
    }
  }
}
