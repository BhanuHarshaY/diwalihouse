import type {
  CourtyardClientMessage,
  GameClientMessage,
  GameKind,
  MehfilClientMessage,
} from '@diwali/realtime-protocol';
import { seededRng } from '@diwali/game-kit';
import type { CharadesView } from '@diwali/charades';
import type { RajaMantriView } from '@diwali/raja-mantri';
import type { TambolaView } from '@diwali/tambola';
import type { TableView } from '@diwali/teen-patti';
import { describe, expect, it } from 'vitest';
import type { Stroke } from '@diwali/rangoli';
import { CourtyardCore, SNAPSHOT_PART } from './courtyard-core.ts';
import { GameCore, type Connection } from './game-core.ts';
import { MehfilCore, type MehfilConnection } from './mehfil-core.ts';
import { youtubeLookup, type Lookup } from './oembed.ts';
import { presence, ReplayGuard, upsertGame } from './party-core.ts';

const asha: Connection = { member: 'm-asha', role: 'host', name: 'Asha', emblem: 'diya' };
const meera: Connection = { member: 'm-meera', role: 'guest', name: 'Meera', emblem: 'kamal' };
const dev: Connection = { member: 'm-dev', role: 'guest', name: 'Dev', emblem: 'mor' };
const chitra: Connection = { member: 'm-chitra', role: 'guest', name: 'Chitra', emblem: 'patang' };

const rng = seededRng(5);
let n = 0;
const id = () => `req_${String(++n).padStart(8, '0')}`;

function game(kind: GameKind, options = {}) {
  const core = GameCore.create(
    { party: 'p1', game: 'abcd', kind, createdBy: 'Asha', createdAt: 0 },
    options,
  );
  for (const c of [asha, meera, dev, chitra]) core.greet(c);
  return core;
}

function act(core: GameCore, c: Connection, action: Record<string, unknown>) {
  const message = { t: 'action', id: id(), action } as GameClientMessage;
  return core.handle(c, message, 1000, rng);
}

function view<T>(core: GameCore, c: Connection): T {
  const message = core.viewMessage(c);
  if (message.t !== 'view') throw new Error('not a view');
  return message.view as T;
}

describe('GameCore (any game)', () => {
  it('refuses an action that belongs to a different game', () => {
    const core = game('tambola');
    expect(act(core, meera, { type: 'bet', amount: 10 }).reply).toMatchObject({
      ok: false,
      error: 'bad-action',
    });
    expect(core.seq).toBe(0);
  });

  it('answers a repeated request id with the original result, acting only once', () => {
    const core = game('teen-patti');
    const message = {
      t: 'action',
      id: 'req_repeat01',
      action: { type: 'sit' },
    } as GameClientMessage;
    const first = core.handle(meera, message, 1000, rng);
    const second = core.handle(meera, message, 1000, rng);
    expect(first.changed).toBe(true);
    expect(second).toEqual({ reply: first.reply, changed: false });
    // Ids are per member: someone else's identical id is a different request.
    expect(core.handle(dev, message, 1000, rng).changed).toBe(true);
  });

  it('survives being saved and restored, including remembered requests', () => {
    const core = game('teen-patti');
    const message = {
      t: 'action',
      id: 'req_persist1',
      action: { type: 'sit' },
    } as GameClientMessage;
    core.handle(meera, message, 1000, rng);
    const restored = new GameCore(structuredClone(core.save()));
    expect(restored.handle(meera, message, 1000, rng).changed).toBe(false);
    expect(restored.state).toEqual(core.state);
  });
});

describe('Teen Patti through the core', () => {
  it('seats people under the name on their ticket, and only the host deals', () => {
    const core = game('teen-patti');
    act(core, asha, { type: 'sit' });
    act(core, meera, { type: 'sit', name: 'Impostor' });
    expect(view<TableView>(core, asha).seats.map((s) => s.name)).toEqual(['Asha', 'Meera']);
    expect(act(core, meera, { type: 'deal' }).reply).toMatchObject({
      ok: false,
      error: 'not-host',
    });
    expect(act(core, asha, { type: 'deal' }).reply).toMatchObject({ ok: true });
    expect(core.summary()).toMatchObject({ kind: 'teen-patti', players: 2, status: 'playing' });
  });

  it('runs the turn timer', () => {
    const core = game('teen-patti');
    act(core, asha, { type: 'sit' });
    act(core, meera, { type: 'sit' });
    act(core, asha, { type: 'deal' });
    const deadline = core.deadline()!;
    expect(core.tick(deadline - 1, rng)).toBe(false);
    expect(core.tick(deadline, rng)).toBe(true);
    expect(core.deadline()).toBeNull();
  });
});

describe('Tambola through the core', () => {
  it('keeps each ticket private and lets the host call', () => {
    const core = game('tambola');
    act(core, meera, { type: 'join' });
    act(core, dev, { type: 'join' });
    act(core, asha, { type: 'start' });
    act(core, asha, { type: 'call' });
    const mine = view<TambolaView>(core, meera);
    const theirs = view<TambolaView>(core, dev);
    expect(mine.me.tickets).toHaveLength(1);
    expect(JSON.stringify(theirs)).not.toContain(JSON.stringify(mine.me.tickets));
    expect(mine.called).toHaveLength(1);
    expect(core.summary().detail).toBe('1 of 90 called');
  });

  it('auto-calls from the room timer', () => {
    const core = game('tambola');
    act(core, meera, { type: 'join' });
    act(core, asha, { type: 'start' });
    act(core, asha, { type: 'auto', seconds: 5 });
    expect(core.tick(core.deadline()!, rng)).toBe(true);
    expect(view<TambolaView>(core, meera).called).toHaveLength(1);
  });
});

describe('Raja Mantri Chor Sipahi through the core', () => {
  it('each player sees only their own chit', () => {
    const core = game('raja-mantri');
    for (const c of [asha, meera, dev, chitra]) act(core, c, { type: 'join' });
    act(core, asha, { type: 'start' });
    for (const c of [asha, meera, dev, chitra]) {
      const v = view<RajaMantriView>(core, c);
      expect(v.me.role).not.toBeNull();
      expect(Object.keys(v.known)).toHaveLength(2);
    }
  });
});

describe('Charades through the core', () => {
  it('only the actor sees the film', () => {
    const core = game('charades');
    act(core, asha, { type: 'join', team: 0 });
    act(core, meera, { type: 'join', team: 0 });
    act(core, dev, { type: 'join', team: 1 });
    act(core, chitra, { type: 'join', team: 1 });
    act(core, asha, { type: 'start' });
    act(core, asha, { type: 'begin' });
    const film = view<CharadesView>(core, asha).me.card!;
    expect(film).toBeTruthy();
    for (const c of [meera, dev, chitra]) expect(JSON.stringify(view(core, c))).not.toContain(film);
    expect(core.deadline()).not.toBeNull();
  });
});

describe('party helpers', () => {
  it('collapses several tabs into one present member', () => {
    expect(presence([asha, meera, asha])).toEqual([
      { member: 'm-asha', name: 'Asha', emblem: 'diya', role: 'host', connections: 2 },
      { member: 'm-meera', name: 'Meera', emblem: 'kamal', role: 'guest', connections: 1 },
    ]);
  });

  it('keeps the game directory in creation order', () => {
    const g = (game: string, createdAt: number) => ({
      game,
      kind: 'tambola' as const,
      createdBy: 'A',
      createdAt,
      players: 0,
      status: 'lobby' as const,
      detail: '',
    });
    let games = upsertGame([], g('b', 2));
    games = upsertGame(games, g('a', 1));
    games = upsertGame(games, { ...g('b', 2), players: 3 });
    expect(games.map((x) => [x.game, x.players])).toEqual([
      ['a', 0],
      ['b', 3],
    ]);
  });

  it('refuses a ticket used twice within its lifetime', () => {
    const guard = new ReplayGuard();
    expect(guard.accept('jti-1', 2000, 1000)).toBe(true);
    expect(guard.accept('jti-1', 2000, 1500)).toBe(false);
    expect(guard.accept('jti-1', 3000, 2500)).toBe(true);
  });
});

describe('CourtyardCore', () => {
  const dot = { tool: 'dot', colour: 'marigold', size: 'medium', points: [120, -40] } as const;
  const draw = (stroke: object = dot): CourtyardClientMessage =>
    ({ t: 'draw', id: id(), stroke }) as CourtyardClientMessage;

  function courtyard() {
    const core = CourtyardCore.create('p1');
    for (const c of [asha, meera, dev]) core.greet(c);
    return core;
  }

  it('stamps each stroke with its author and an id, and broadcasts it', () => {
    const core = courtyard();
    const out = core.handle(meera, draw(), 1000);
    const stroke = { id: 1, by: 'm-meera', ...dot, points: [120, -40] };
    expect(out.broadcast).toEqual({ t: 'drawn', seq: 1, stroke });
    expect(out.changes).toEqual([{ insert: stroke }]);
    expect(out.reply).toMatchObject({ t: 'result', ok: true, data: { stroke: 1 } });
    expect(core.strokes).toEqual([stroke]);
  });

  it('replays a repeated request instead of drawing twice', () => {
    const core = courtyard();
    const message = draw();
    const first = core.handle(meera, message, 1000);
    const again = core.handle(meera, message, 1001);
    expect(again).toEqual({ reply: first.reply, broadcast: null, changes: [] });
    expect(core.strokes).toHaveLength(1);
    // The same id from someone else is a different request.
    expect(core.handle(dev, message, 1002).broadcast).not.toBeNull();
  });

  it('refuses strokes off the disc, and host actions from guests', () => {
    const core = courtyard();
    const off = core.handle(meera, draw({ ...dot, points: [999, 999] }), 1000);
    expect(off).toMatchObject({ reply: { ok: false, error: 'bad-stroke' }, broadcast: null });
    core.handle(meera, draw(), 1000);
    for (const message of [
      { t: 'erase', id: id(), member: 'm-meera' },
      { t: 'fresh', id: id(), folds: 6 },
    ] as CourtyardClientMessage[]) {
      expect(core.handle(dev, message, 1000)).toMatchObject({
        reply: { ok: false, error: 'not-host' },
        changes: [],
      });
    }
    expect(core.strokes).toHaveLength(1);
  });

  it('lets people undo their own strokes and the host erase anyone’s, or start afresh', () => {
    const core = courtyard();
    core.handle(meera, draw(), 1000);
    core.handle(dev, draw(), 1000);
    core.handle(meera, draw(), 1000);
    expect(core.handle(dev, { t: 'undo', id: id() }, 1000).changes).toEqual([{ remove: [2] }]);
    const erased = core.handle(asha, { t: 'erase', id: id(), member: 'm-meera' }, 1000);
    expect(erased.broadcast).toEqual({ t: 'erased', seq: 5, ids: [1, 3] });
    expect(core.strokes).toEqual([]);
    core.handle(dev, draw(), 1000);
    const fresh = core.handle(asha, { t: 'fresh', id: id(), folds: 12 }, 1000);
    expect(fresh.broadcast).toEqual({ t: 'fresh', seq: 7, folds: 12, edition: 2 });
    expect(fresh.changes).toEqual([{ clear: true }]);
    expect(core.save()).toMatchObject({ folds: 12, edition: 2, nextId: 5, seq: 7 });
  });

  it('sends a large rangoli in parts, with profiles once', () => {
    const strokes: Stroke[] = Array.from({ length: SNAPSHOT_PART * 2 + 5 }, (_, i) => ({
      id: i + 1,
      by: 'm-meera',
      ...dot,
      points: [...dot.points],
    }));
    const core = new CourtyardCore({ ...courtyard().save(), nextId: strokes.length + 1 }, strokes);
    const parts = core.snapshot(meera);
    expect(
      parts.map((p) => (p.t === 'courtyard' ? [p.part, p.done, p.strokes.length] : null)),
    ).toEqual([
      [0, false, SNAPSHOT_PART],
      [1, false, SNAPSHOT_PART],
      [2, true, 5],
    ]);
    expect(parts[0]).toMatchObject({
      profiles: { 'm-meera': { name: 'Meera' } },
      you: { member: 'm-meera', role: 'guest' },
    });
    expect(parts[1]).toMatchObject({ profiles: {} });
    expect(CourtyardCore.create('p1').snapshot(asha)).toEqual([
      expect.objectContaining({ part: 0, done: true, strokes: [] }),
    ]);
  });

  it('lists who is here once per person, and everyone who has drawn', () => {
    const core = courtyard();
    expect(core.greet(meera)).toBe(false);
    expect(core.greet({ ...meera, name: 'Meera R' })).toBe(true);
    const message = core.artists([meera, meera, dev]);
    expect(message).toMatchObject({
      t: 'artists',
      here: [
        { member: 'm-dev', connections: 1 },
        { member: 'm-meera', connections: 2 },
      ],
    });
    expect(Object.keys(message.t === 'artists' ? message.profiles : {})).toEqual([
      'm-asha',
      'm-meera',
      'm-dev',
    ]);
  });
});

describe('MehfilCore', () => {
  const tab = (c: Connection, device: string): MehfilConnection => ({ ...c, device });
  const ashaLaptop = tab(asha, 'tab_asha_laptop');
  const ashaPhone = tab(asha, 'tab_asha_phone');
  const meeraPhone = tab(meera, 'tab_meera_phone');
  const songs: Record<string, string> = {
    dQw4w9WgXcQ: 'Kajra Re',
    '9bZkp7q19f0': 'Chaiyya Chaiyya',
  };
  const lookups: string[] = [];
  const lookup: Lookup = async (video) => {
    lookups.push(video);
    if (video === 'noEmbed0001') return { ok: false, error: 'not-embeddable' };
    const title = songs[video];
    return title ? { ok: true, title, channel: 'T-Series' } : { ok: false, error: 'not-found' };
  };
  const send = (core: MehfilCore, c: MehfilConnection, m: Record<string, unknown>) =>
    core.handle(c, { id: id(), ...m } as MehfilClientMessage, lookup);
  const view = (core: MehfilCore, c: MehfilConnection, online = [ashaLaptop, meeraPhone]) => {
    const message = core.view(c, online);
    if (message.t !== 'mehfil') throw new Error('not a mehfil view');
    return message;
  };

  it('takes the title from YouTube, never from the guest', async () => {
    const core = MehfilCore.create('p1');
    const out = await send(core, meeraPhone, {
      t: 'add',
      url: 'https://youtu.be/dQw4w9WgXcQ',
      dedication: 'for Nani',
    });
    expect(out).toMatchObject({ changed: true, reply: { ok: true, data: { title: 'Kajra Re' } } });
    expect(view(core, meeraPhone).view.upNext[0]).toMatchObject({
      title: 'Kajra Re',
      channel: 'T-Series',
      by: 'm-meera',
      dedication: 'for Nani',
    });
  });

  it('explains links it can’t use, without asking YouTube about non-YouTube ones', async () => {
    const core = MehfilCore.create('p1');
    lookups.length = 0;
    const refused = async (url: string) => (await send(core, meeraPhone, { t: 'add', url })).reply;
    expect(await refused('https://example.com/song.mp3')).toMatchObject({ error: 'not-youtube' });
    expect(lookups).toEqual([]);
    expect(await refused('https://youtu.be/noEmbed0001')).toMatchObject({
      error: 'not-embeddable',
    });
    expect(await refused('https://youtu.be/missing0001')).toMatchObject({ error: 'not-found' });
  });

  it('answers a re-sent request once, even while the first is still looking up', async () => {
    const core = MehfilCore.create('p1');
    const message = {
      t: 'add',
      id: id(),
      url: 'https://youtu.be/9bZkp7q19f0',
    } as MehfilClientMessage;
    const [first, second] = await Promise.all([
      core.handle(meeraPhone, message, lookup),
      core.handle(meeraPhone, message, lookup),
    ]);
    expect(first.reply).toEqual(second.reply);
    expect([first.changed, second.changed]).toEqual([true, false]);
    expect(view(core, meeraPhone).view.upNext).toHaveLength(1);
  });

  it('plays on the tab that claimed the speaker, and only that tab can report', async () => {
    const core = MehfilCore.create('p1');
    await send(core, meeraPhone, { t: 'add', url: 'https://youtu.be/dQw4w9WgXcQ' });
    expect((await send(core, meeraPhone, { t: 'claim' })).reply).toMatchObject({
      error: 'not-host',
    });
    await send(core, ashaLaptop, { t: 'claim' });
    expect(view(core, ashaLaptop).you.speaker).toBe(true);
    expect(view(core, ashaPhone).you.speaker).toBe(false);
    expect(view(core, meeraPhone).view.speaker).toEqual({ member: 'm-asha', online: true });
    expect(view(core, meeraPhone, [meeraPhone]).view.speaker).toEqual({
      member: 'm-asha',
      online: false,
    });
    const playing = view(core, meeraPhone).view.playing!;
    // The host's other tab is not the speaker, so its report is refused.
    expect((await send(core, ashaPhone, { t: 'ended', song: playing.id })).reply).toMatchObject({
      error: 'not-speaker',
    });
    expect((await send(core, ashaLaptop, { t: 'ended', song: playing.id })).changed).toBe(true);
    expect(view(core, meeraPhone).view.played[0]?.id).toBe(playing.id);
  });

  it('forgets a speaker who leaves the party', async () => {
    const core = MehfilCore.create('p1');
    await send(core, ashaLaptop, { t: 'delegate', member: 'm-meera' });
    await send(core, meeraPhone, { t: 'claim' });
    expect(core.forget('m-meera')).toBe(true);
    expect(view(core, ashaLaptop).view).toMatchObject({ speaker: null, delegate: null });
    expect(core.forget('m-meera')).toBe(false);
  });
});

describe('the YouTube lookup', () => {
  const reply = (status: number, body: unknown = {}) =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('reads the title, and what each refusal means', async () => {
    const ok = youtubeLookup(
      'https://yt',
      reply(200, { title: 'Kajra Re', author_name: 'SonyMusic' }),
    );
    expect(await ok('dQw4w9WgXcQ')).toEqual({ ok: true, title: 'Kajra Re', channel: 'SonyMusic' });
    expect(await youtubeLookup('https://yt', reply(401))('x')).toEqual({
      ok: false,
      error: 'not-embeddable',
    });
    expect(await youtubeLookup('https://yt', reply(400))('x')).toEqual({
      ok: false,
      error: 'not-found',
    });
    expect(await youtubeLookup('https://yt', reply(500))('x')).toEqual({
      ok: false,
      error: 'lookup-failed',
    });
    const down = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await youtubeLookup('https://yt', down)('x')).toEqual({
      ok: false,
      error: 'lookup-failed',
    });
  });

  it('asks about the watch page of exactly that video', async () => {
    const asked: string[] = [];
    const spy = (async (url: string) => {
      asked.push(url);
      return new Response('{"title":"t"}');
    }) as unknown as typeof fetch;
    await youtubeLookup('https://www.youtube.com', spy)('dQw4w9WgXcQ');
    expect(asked).toEqual([
      'https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ',
    ]);
  });
});
