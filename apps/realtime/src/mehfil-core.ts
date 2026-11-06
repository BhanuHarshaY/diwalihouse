import {
  applyMehfil,
  createMehfil,
  parseVideoId,
  viewMehfil,
  withoutMember,
  type MehfilAction,
  type MehfilState,
} from '@diwali/mehfil';
import type { MehfilClientMessage, Profile, ServerMessage } from '@diwali/realtime-protocol';
import type { Connection } from './game-core.ts';
import type { Lookup } from './oembed.ts';
import { presence } from './party-core.ts';

/**
 * Everything the Music Mehfil room does, minus the Durable Object plumbing:
 * identity, idempotency, the YouTube lookup, the queue rules, and the view
 * each tab receives. The lookup is passed in, so tests never touch YouTube.
 */

/** A socket in the Mehfil: who, plus which browser tab (to find the speaker). */
export interface MehfilConnection extends Connection {
  device: string;
}

export interface SavedMehfil {
  party: string;
  state: MehfilState;
  seq: number;
  profiles: Record<string, Profile>;
  recent: Array<[string, ServerMessage]>;
}

const RECENT_LIMIT = 200;

export class MehfilCore {
  party: string;
  seq: number;
  profiles: Record<string, Profile>;
  private state: MehfilState;
  private recent: Map<string, ServerMessage>;
  /** Requests waiting on a lookup, so a re-send gets the same answer. */
  private inFlight = new Map<string, Promise<{ reply: ServerMessage; changed: boolean }>>();

  constructor(saved: SavedMehfil) {
    this.party = saved.party;
    this.state = saved.state;
    this.seq = saved.seq;
    this.profiles = saved.profiles;
    this.recent = new Map(saved.recent);
  }

  static create(party: string): MehfilCore {
    return new MehfilCore({ party, state: createMehfil(), seq: 0, profiles: {}, recent: [] });
  }

  save(): SavedMehfil {
    return {
      party: this.party,
      state: this.state,
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

  handle(
    connection: MehfilConnection,
    message: MehfilClientMessage,
    lookup: Lookup,
  ): Promise<{ reply: ServerMessage; changed: boolean }> {
    if (message.t === 'ping') return Promise.resolve({ reply: { t: 'pong' }, changed: false });
    const key = `${connection.member}:${message.id}`;
    const seen = this.recent.get(key);
    if (seen) return Promise.resolve({ reply: seen, changed: false });
    const running = this.inFlight.get(key);
    if (running) return running.then(({ reply }) => ({ reply, changed: false }));
    const work = this.run(connection, message, lookup).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, work);
    return work;
  }

  private async run(
    connection: MehfilConnection,
    message: Exclude<MehfilClientMessage, { t: 'ping' }>,
    lookup: Lookup,
  ): Promise<{ reply: ServerMessage; changed: boolean }> {
    const refuse = (error: string) => {
      const reply: ServerMessage = { t: 'result', id: message.id, ok: false, error };
      this.remember(`${connection.member}:${message.id}`, reply);
      return { reply, changed: false };
    };

    let action: MehfilAction;
    switch (message.t) {
      case 'add': {
        const video = parseVideoId(message.url);
        if (!video) return refuse('not-youtube');
        // The lookup is the slow part; the rules are checked after it, against
        // the queue as it is then.
        const found = await lookup(video);
        if (!found.ok) return refuse(found.error);
        action = {
          type: 'add',
          video,
          title: found.title,
          channel: found.channel,
          dedication: message.dedication ?? null,
        };
        break;
      }
      case 'vote':
        action = { type: 'vote', song: message.song, up: message.up };
        break;
      case 'remove':
      case 'skip':
        action = { type: message.t, song: message.song };
        break;
      case 'claim':
        action = { type: 'claim', device: connection.device };
        break;
      case 'release':
        action = { type: 'release' };
        break;
      case 'delegate':
        action = { type: 'delegate', member: message.member };
        break;
      case 'ended':
      case 'failed':
        action = { type: message.t, song: message.song, device: connection.device };
        break;
    }

    const actor = {
      kind: 'player',
      id: connection.member,
      host: connection.role === 'host',
    } as const;
    const outcome = applyMehfil(this.state, action, actor);
    if (!outcome.ok) return refuse(outcome.error);
    this.state = outcome.state;
    this.seq += 1;
    const added = outcome.events.find((e) => e.type === 'added');
    const reply: ServerMessage = {
      t: 'result',
      id: message.id,
      ok: true,
      ...(added && added.type === 'added'
        ? { data: { song: added.song.id, title: added.song.title } }
        : {}),
    };
    this.remember(`${connection.member}:${message.id}`, reply);
    return { reply, changed: true };
  }

  /** A member left the party. True if the Mehfil changed. */
  forget(member: string): boolean {
    const next = withoutMember(this.state, member);
    if (next.speaker === this.state.speaker && next.delegate === this.state.delegate) return false;
    this.state = next;
    this.seq += 1;
    return true;
  }

  view(connection: MehfilConnection, connections: MehfilConnection[]): ServerMessage {
    const speaker = this.state.speaker;
    return {
      t: 'mehfil',
      seq: this.seq,
      view: viewMehfil(this.state, new Set(connections.map((c) => c.device))),
      here: presence(connections),
      profiles: this.profiles,
      you: {
        member: connection.member,
        role: connection.role,
        speaker:
          !!speaker && speaker.member === connection.member && speaker.device === connection.device,
      },
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
