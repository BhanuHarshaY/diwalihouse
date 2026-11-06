import type { Actor, Outcome } from '@diwali/game-kit';
import { isVideoId } from './youtube.ts';

/**
 * The Music Mehfil: one shared queue of YouTube songs per party, as pure
 * rules (docs/music-mehfil.md). Guests request songs and vote; one device,
 * the speaker, plays them in YouTube's own player and reports when each
 * ends. Titles come from YouTube (looked up by the room), never from guests.
 */

export const LIMITS = {
  /** Songs waiting in the queue (about four hours of music). */
  queue: 60,
  /** Songs one person may have waiting at once. */
  perMember: 3,
  dedication: 80,
  title: 140,
  channel: 80,
  /** Recently played songs kept for the list. */
  history: 10,
} as const;

export interface Song {
  id: number;
  /** YouTube video id. */
  video: string;
  title: string;
  channel: string;
  /** Member id of whoever requested it. */
  by: string;
  dedication: string | null;
  /** Members who have voted it up (never the requester). */
  votes: string[];
}

/** The one browser tab that plays the music, and whose it is. */
export interface Speaker {
  member: string;
  device: string;
}

export interface MehfilState {
  queue: Song[];
  playing: Song | null;
  /** Newest first. */
  played: Song[];
  speaker: Speaker | null;
  /** Besides the host, the one member allowed to play the music on their device. */
  delegate: string | null;
  nextId: number;
}

export type FinishedHow = 'ended' | 'skipped' | 'failed';

export type MehfilAction =
  | { type: 'add'; video: string; title: string; channel: string; dedication: string | null }
  | { type: 'vote'; song: number; up: boolean }
  | { type: 'remove'; song: number }
  | { type: 'skip'; song: number }
  | { type: 'claim'; device: string }
  | { type: 'release' }
  | { type: 'delegate'; member: string | null }
  | { type: 'ended'; song: number; device: string }
  | { type: 'failed'; song: number; device: string };

export type MehfilEvent =
  | { type: 'added'; song: Song }
  | { type: 'voted'; song: number }
  | { type: 'removed'; song: number }
  | { type: 'started'; song: Song }
  | { type: 'finished'; song: number; how: FinishedHow }
  | { type: 'speaker'; speaker: Speaker | null }
  | { type: 'delegated'; member: string | null };

export type MehfilViolation =
  | 'not-member'
  | 'not-host'
  | 'bad-song'
  | 'queue-full'
  | 'your-limit'
  | 'already-queued'
  | 'no-such-song'
  | 'own-song'
  | 'not-yours'
  | 'not-playing'
  | 'not-speaker'
  | 'bad-device';

export type MehfilOutcome = Outcome<MehfilState, MehfilEvent, MehfilViolation>;

export function createMehfil(): MehfilState {
  return { queue: [], playing: null, played: [], speaker: null, delegate: null, nextId: 1 };
}

const DEVICE = /^[A-Za-z0-9_-]{8,40}$/;

/** One line of plain text: no control characters, single spaces, at most `max` long. */
export function cleanText(text: string, max: number): string {
  return text
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

/** What plays next: most votes first, then whoever asked first. */
export function upNext(queue: readonly Song[]): Song[] {
  return [...queue].sort((a, b) => b.votes.length - a.votes.length || a.id - b.id);
}

function advance(s: MehfilState, events: MehfilEvent[], how: FinishedHow) {
  if (s.playing) {
    events.push({ type: 'finished', song: s.playing.id, how });
    s.played = [s.playing, ...s.played].slice(0, LIMITS.history);
  }
  const next = upNext(s.queue)[0] ?? null;
  s.playing = next;
  if (next) {
    s.queue = s.queue.filter((song) => song.id !== next.id);
    events.push({ type: 'started', song: next });
  }
}

/** Starts the next song if there is a speaker and nothing is playing. */
function startIfIdle(s: MehfilState, events: MehfilEvent[]) {
  if (!s.playing && s.speaker) advance(s, events, 'ended');
}

export function applyMehfil(state: MehfilState, action: MehfilAction, actor: Actor): MehfilOutcome {
  const draft = structuredClone(state);
  const events: MehfilEvent[] = [];
  const error = reduce(draft, action, actor, events);
  return error ? { ok: false, error } : { ok: true, state: draft, events };
}

function reduce(
  s: MehfilState,
  action: MehfilAction,
  actor: Actor,
  events: MehfilEvent[],
): MehfilViolation | null {
  if (actor.kind !== 'player') return 'not-member';
  const isSpeaker = (device?: string) =>
    !!s.speaker &&
    s.speaker.member === actor.id &&
    (device === undefined || s.speaker.device === device);

  switch (action.type) {
    case 'add': {
      const title = cleanText(action.title, LIMITS.title);
      if (!isVideoId(action.video) || !title) return 'bad-song';
      if (s.queue.length >= LIMITS.queue) return 'queue-full';
      if (s.playing?.video === action.video || s.queue.some((q) => q.video === action.video)) {
        return 'already-queued';
      }
      if (s.queue.filter((q) => q.by === actor.id).length >= LIMITS.perMember) return 'your-limit';
      const dedication = action.dedication ? cleanText(action.dedication, LIMITS.dedication) : '';
      const song: Song = {
        id: s.nextId++,
        video: action.video,
        title,
        channel: cleanText(action.channel, LIMITS.channel),
        by: actor.id,
        dedication: dedication || null,
        votes: [],
      };
      s.queue.push(song);
      events.push({ type: 'added', song });
      startIfIdle(s, events);
      return null;
    }

    case 'vote': {
      const song = s.queue.find((q) => q.id === action.song);
      if (!song) return 'no-such-song';
      if (song.by === actor.id) return 'own-song';
      song.votes = song.votes.filter((v) => v !== actor.id);
      if (action.up) song.votes.push(actor.id);
      events.push({ type: 'voted', song: song.id });
      return null;
    }

    case 'remove': {
      const song = s.queue.find((q) => q.id === action.song);
      if (!song) return 'no-such-song';
      if (song.by !== actor.id && !actor.host) return 'not-yours';
      s.queue = s.queue.filter((q) => q.id !== song.id);
      events.push({ type: 'removed', song: song.id });
      return null;
    }

    case 'skip':
      if (!actor.host && !isSpeaker()) return 'not-host';
      if (s.playing?.id !== action.song) return 'not-playing';
      advance(s, events, 'skipped');
      return null;

    case 'claim':
      if (!actor.host && s.delegate !== actor.id) return 'not-host';
      if (!DEVICE.test(action.device)) return 'bad-device';
      s.speaker = { member: actor.id, device: action.device };
      events.push({ type: 'speaker', speaker: { ...s.speaker } });
      startIfIdle(s, events);
      return null;

    case 'release':
      if (!s.speaker || (!actor.host && !isSpeaker())) return 'not-speaker';
      s.speaker = null;
      events.push({ type: 'speaker', speaker: null });
      return null;

    case 'delegate':
      if (!actor.host) return 'not-host';
      s.delegate = action.member;
      // Taking the role away from someone also stops their device playing.
      if (s.speaker && s.speaker.member !== actor.id && s.speaker.member !== action.member) {
        s.speaker = null;
        events.push({ type: 'speaker', speaker: null });
      }
      events.push({ type: 'delegated', member: action.member });
      return null;

    case 'ended':
    case 'failed':
      // Only the speaker's own device reports on the song it is playing, so
      // a late or repeated report can't skip the next one.
      if (!isSpeaker(action.device)) return 'not-speaker';
      if (s.playing?.id !== action.song) return 'not-playing';
      advance(s, events, action.type);
      return null;
  }
}

/** Someone left the party: they stop being the speaker or the delegate. Their requests stay. */
export function withoutMember(state: MehfilState, member: string): MehfilState {
  return {
    ...state,
    speaker: state.speaker?.member === member ? null : state.speaker,
    delegate: state.delegate === member ? null : state.delegate,
  };
}

/** What everyone sees. Device ids stay in the room; each tab is told separately if it is the speaker. */
export interface MehfilView {
  playing: Song | null;
  upNext: Song[];
  played: Song[];
  speaker: { member: string; online: boolean } | null;
  delegate: string | null;
}

export function viewMehfil(state: MehfilState, onlineDevices: ReadonlySet<string>): MehfilView {
  return {
    playing: state.playing ? structuredClone(state.playing) : null,
    upNext: structuredClone(upNext(state.queue)),
    played: structuredClone(state.played),
    speaker: state.speaker
      ? { member: state.speaker.member, online: onlineDevices.has(state.speaker.device) }
      : null,
    delegate: state.delegate,
  };
}
