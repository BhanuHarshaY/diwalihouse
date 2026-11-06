import type { Actor } from '@diwali/game-kit';
import { describe, expect, it } from 'vitest';
import {
  applyMehfil,
  cleanText,
  createMehfil,
  LIMITS,
  upNext,
  viewMehfil,
  withoutMember,
  type MehfilAction,
  type MehfilState,
} from './mehfil.ts';
import { parseVideoId } from './youtube.ts';

const host: Actor = { kind: 'player', id: 'asha', host: true };
const guest = (id: string): Actor => ({ kind: 'player', id, host: false });
const DEVICE = 'tab_host_laptop';

let n = 0;
const video = () => `vid${String(++n).padStart(8, '0')}`;
type AddAction = Extract<MehfilAction, { type: 'add' }>;
const add = (dedication: string | null = null): AddAction => ({
  type: 'add',
  video: video(),
  title: 'Kajra Re',
  channel: 'Sony Music India',
  dedication,
});

function run(state: MehfilState, action: MehfilAction, actor: Actor) {
  const out = applyMehfil(state, action, actor);
  if (!out.ok) throw new Error(`refused: ${out.error}`);
  return out;
}
function refused(state: MehfilState, action: MehfilAction, actor: Actor) {
  const out = applyMehfil(state, action, actor);
  if (out.ok) throw new Error('expected a refusal');
  return out.error;
}

describe('YouTube links', () => {
  it('finds the video id in the links people paste', () => {
    for (const link of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://music.youtube.com/watch?v=dQw4w9WgXcQ&feature=share',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      '  https://www.youtube.com/live/dQw4w9WgXcQ  ',
    ]) {
      expect(parseVideoId(link), link).toBe('dQw4w9WgXcQ');
    }
  });

  it('refuses anything else', () => {
    for (const text of [
      'dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=short',
      'https://www.youtube.com/@RickAstleyYT',
      'https://evil.example/watch?v=dQw4w9WgXcQ',
      'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
      'javascript:alert(1)',
      'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
    ]) {
      expect(parseVideoId(text), text).toBeNull();
    }
  });
});

describe('requests', () => {
  it('queue a song with its dedication, tidied, credited to who asked', () => {
    const out = run(createMehfil(), add('  for  Nani,\nfrom Meera '), guest('meera'));
    expect(out.state.queue).toEqual([
      expect.objectContaining({
        id: 1,
        by: 'meera',
        dedication: 'for Nani, from Meera',
        votes: [],
      }),
    ]);
    expect(out.state.playing).toBeNull();
    expect(cleanText('a\u0000b‮c', 10)).toBe('a b c');
  });

  it('limit each person to three waiting songs, and refuse repeats', () => {
    let s = createMehfil();
    for (let i = 0; i < LIMITS.perMember; i++) s = run(s, add(), guest('meera')).state;
    expect(refused(s, add(), guest('meera'))).toBe('your-limit');
    const again = { ...add(), video: s.queue[0]!.video };
    expect(refused(s, again, guest('bilal'))).toBe('already-queued');
    expect(refused(s, { ...add(), video: 'not-an-id' }, guest('bilal'))).toBe('bad-song');
    expect(refused(s, { ...add(), title: '   ' }, guest('bilal'))).toBe('bad-song');
  });

  it('play in order of votes, then of asking; you can’t vote for your own', () => {
    let s = createMehfil();
    s = run(s, add(), guest('meera')).state;
    s = run(s, add(), guest('bilal')).state;
    s = run(s, add(), guest('dev')).state;
    expect(refused(s, { type: 'vote', song: 1, up: true }, guest('meera'))).toBe('own-song');
    s = run(s, { type: 'vote', song: 3, up: true }, guest('meera')).state;
    s = run(s, { type: 'vote', song: 3, up: true }, guest('meera')).state;
    expect(s.queue.find((q) => q.id === 3)!.votes).toEqual(['meera']);
    expect(upNext(s.queue).map((q) => q.id)).toEqual([3, 1, 2]);
    s = run(s, { type: 'vote', song: 3, up: false }, guest('meera')).state;
    expect(upNext(s.queue).map((q) => q.id)).toEqual([1, 2, 3]);
  });

  it('can be withdrawn by whoever asked, or by the host', () => {
    const s = run(createMehfil(), add(), guest('meera')).state;
    expect(refused(s, { type: 'remove', song: 1 }, guest('bilal'))).toBe('not-yours');
    expect(run(s, { type: 'remove', song: 1 }, guest('meera')).state.queue).toEqual([]);
    expect(run(s, { type: 'remove', song: 1 }, host).state.queue).toEqual([]);
  });
});

describe('the speaker', () => {
  it('only the host, or the member they choose, can play the music on their device', () => {
    const s = createMehfil();
    expect(refused(s, { type: 'claim', device: 'tab_meera_phone' }, guest('meera'))).toBe(
      'not-host',
    );
    expect(refused(s, { type: 'claim', device: 'x' }, host)).toBe('bad-device');
    const chosen = run(s, { type: 'delegate', member: 'tv' }, host).state;
    expect(
      run(chosen, { type: 'claim', device: 'tab_living_tv' }, guest('tv')).state.speaker,
    ).toEqual({
      member: 'tv',
      device: 'tab_living_tv',
    });
  });

  it('starts the top song when it is claimed, and the next as each one ends', () => {
    let s = createMehfil();
    s = run(s, add(), guest('meera')).state;
    s = run(s, add(), guest('bilal')).state;
    const claimed = run(s, { type: 'claim', device: DEVICE }, host);
    expect(claimed.state.playing?.id).toBe(1);
    expect(claimed.events.map((e) => e.type)).toEqual(['speaker', 'started']);
    const ended = run(claimed.state, { type: 'ended', song: 1, device: DEVICE }, host);
    expect(ended.state.playing?.id).toBe(2);
    expect(ended.state.played.map((p) => p.id)).toEqual([1]);
    // When the queue runs dry, the next request starts at once.
    const dry = run(ended.state, { type: 'ended', song: 2, device: DEVICE }, host).state;
    expect(dry.playing).toBeNull();
    expect(run(dry, add(), guest('dev')).state.playing?.title).toBe('Kajra Re');
  });

  it('accepts reports only from the speaker’s device, about the song it is playing', () => {
    let s = createMehfil();
    s = run(s, add(), guest('meera')).state;
    s = run(s, add(), guest('bilal')).state;
    s = run(s, { type: 'claim', device: DEVICE }, host).state;
    expect(refused(s, { type: 'ended', song: 1, device: 'tab_other_tab' }, host)).toBe(
      'not-speaker',
    );
    expect(refused(s, { type: 'ended', song: 1, device: DEVICE }, guest('meera'))).toBe(
      'not-speaker',
    );
    s = run(s, { type: 'failed', song: 1, device: DEVICE }, host).state;
    // A late second report about song 1 must not skip song 2.
    expect(refused(s, { type: 'ended', song: 1, device: DEVICE }, host)).toBe('not-playing');
    expect(s.playing?.id).toBe(2);
  });

  it('only the host (or the speaker) can skip, and only the song that is playing', () => {
    let s = run(createMehfil(), add(), guest('meera')).state;
    s = run(s, { type: 'claim', device: DEVICE }, host).state;
    expect(refused(s, { type: 'skip', song: 1 }, guest('meera'))).toBe('not-host');
    expect(refused(s, { type: 'skip', song: 9 }, host)).toBe('not-playing');
    const out = run(s, { type: 'skip', song: 1 }, host);
    expect(out.events).toContainEqual({ type: 'finished', song: 1, how: 'skipped' });
    expect(out.state.playing).toBeNull();
  });

  it('stops playing on a delegate’s device when the host takes the role back', () => {
    let s = run(createMehfil(), { type: 'delegate', member: 'tv' }, host).state;
    s = run(s, { type: 'claim', device: 'tab_living_tv' }, guest('tv')).state;
    s = run(s, { type: 'delegate', member: null }, host).state;
    expect(s.speaker).toBeNull();
    expect(refused(s, { type: 'claim', device: 'tab_living_tv' }, guest('tv'))).toBe('not-host');
  });

  it('forgets a member who leaves as speaker or delegate, but keeps their requests', () => {
    let s = run(createMehfil(), { type: 'delegate', member: 'tv' }, host).state;
    s = run(s, { type: 'claim', device: 'tab_living_tv' }, guest('tv')).state;
    s = run(s, add(), guest('tv')).state;
    const after = withoutMember(s, 'tv');
    expect(after).toMatchObject({ speaker: null, delegate: null });
    expect(after.playing?.by).toBe('tv');
  });
});

describe('the view', () => {
  it('shows the queue in playing order and whether the speaker is online, never device ids', () => {
    let s = run(createMehfil(), add(), guest('meera')).state;
    s = run(s, add(), guest('bilal')).state;
    s = run(s, { type: 'vote', song: 2, up: true }, guest('meera')).state;
    s = run(s, { type: 'claim', device: DEVICE }, host).state;
    const view = viewMehfil(s, new Set(['tab_someone_else']));
    expect(view.playing?.id).toBe(2);
    expect(view.upNext.map((q) => q.id)).toEqual([1]);
    expect(view.speaker).toEqual({ member: 'asha', online: false });
    expect(JSON.stringify(view)).not.toContain(DEVICE);
    expect(viewMehfil(s, new Set([DEVICE])).speaker?.online).toBe(true);
  });
});
