import type {
  GameClientMessage,
  GameKind,
  GameOptions,
  GameSummary,
  Profile,
  ServerMessage,
} from '@diwali/realtime-protocol';
import type { Rng } from '@diwali/game-kit';
import { ADAPTERS } from './engines.ts';

/**
 * Everything a game room does, minus the Durable Object plumbing: identity,
 * idempotency, the game's engine, and per-person views. Pure enough to test
 * in Node; the DO only persists it and moves bytes.
 */

export interface Connection {
  member: string;
  role: 'host' | 'guest';
  name: string;
  emblem: string;
}

export interface GameMeta {
  party: string;
  game: string;
  kind: GameKind;
  createdBy: string;
  createdAt: number;
}

export interface SavedGame {
  meta: GameMeta;
  state: unknown;
  profiles: Record<string, Profile>;
  seq: number;
  recent: Array<[string, ServerMessage]>;
}

const RECENT_LIMIT = 200;

export class GameCore {
  meta: GameMeta;
  state: unknown;
  profiles: Record<string, Profile>;
  seq: number;
  /** Events from the last change, broadcast with the next views. */
  lastEvents: unknown[] = [];
  private recent: Map<string, ServerMessage>;

  constructor(saved: SavedGame) {
    this.meta = saved.meta;
    this.state = saved.state;
    this.profiles = saved.profiles;
    this.seq = saved.seq;
    this.recent = new Map(saved.recent);
  }

  static create(meta: GameMeta, options: GameOptions = {}): GameCore {
    return new GameCore({
      meta,
      state: ADAPTERS[meta.kind].create(options),
      profiles: {},
      seq: 0,
      recent: [],
    });
  }

  private get adapter() {
    return ADAPTERS[this.meta.kind];
  }

  save(): SavedGame {
    return {
      meta: this.meta,
      state: this.state,
      profiles: this.profiles,
      seq: this.seq,
      recent: [...this.recent],
    };
  }

  /** Remember who someone is, from their verified ticket. */
  greet(connection: Connection): void {
    this.profiles[connection.member] = { name: connection.name, emblem: connection.emblem };
  }

  handle(
    connection: Connection,
    message: GameClientMessage,
    now: number,
    rng: Rng,
  ): { reply: ServerMessage; changed: boolean } {
    if (message.t === 'ping') return { reply: { t: 'pong' }, changed: false };

    const key = `${connection.member}:${message.id}`;
    const seen = this.recent.get(key);
    if (seen) return { reply: seen, changed: false };

    const action = this.adapter.prepare(message.action, connection);
    let reply: ServerMessage;
    let changed = false;
    if (action === null) {
      reply = { t: 'result', id: message.id, ok: false, error: 'bad-action' };
    } else {
      const outcome = this.adapter.apply(
        this.state,
        action,
        { kind: 'player', id: connection.member, host: connection.role === 'host' },
        { now, rng },
      );
      if (outcome.ok) {
        this.state = outcome.state;
        this.lastEvents = outcome.events;
        this.seq += 1;
        changed = true;
        reply = { t: 'result', id: message.id, ok: true };
      } else {
        reply = { t: 'result', id: message.id, ok: false, error: outcome.error };
      }
    }
    this.remember(key, reply);
    return { reply, changed };
  }

  /** The game's timer. True if something happened. */
  tick(now: number, rng: Rng): boolean {
    const outcome = this.adapter.tick(this.state, { now, rng });
    if (!outcome.ok) return false;
    this.state = outcome.state;
    this.lastEvents = outcome.events;
    this.seq += 1;
    return true;
  }

  deadline(): number | null {
    return this.adapter.deadline(this.state);
  }

  viewMessage(connection: Pick<Connection, 'member' | 'role'>): ServerMessage {
    return {
      t: 'view',
      kind: this.meta.kind,
      seq: this.seq,
      view: this.adapter.view(this.state, connection.member, connection.role === 'host'),
      profiles: this.profiles,
      events: this.lastEvents,
    };
  }

  summary(): GameSummary {
    return {
      game: this.meta.game,
      kind: this.meta.kind,
      createdBy: this.meta.createdBy,
      createdAt: this.meta.createdAt,
      ...this.adapter.summary(this.state),
    };
  }

  private remember(key: string, reply: ServerMessage) {
    this.recent.set(key, reply);
    if (this.recent.size > RECENT_LIMIT) {
      const oldest = this.recent.keys().next().value;
      if (oldest !== undefined) this.recent.delete(oldest);
    }
  }
}
