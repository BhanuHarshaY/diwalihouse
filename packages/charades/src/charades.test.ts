import { seededRng, type Actor } from '@diwali/game-kit';
import { describe, expect, it } from 'vitest';
import {
  applyCharades,
  createCharades,
  matches,
  normalizeTitle,
  viewCharades,
  wordCount,
  type CharadesAction,
  type CharadesState,
  type CharadesViolation,
} from './engine.ts';
import { FILMS } from './films.ts';

let now = 0;
const actor = (id: string): Actor => ({ kind: 'player', id, host: id === 'asha' });
const system: Actor = { kind: 'system' };

function run(s: CharadesState, action: CharadesAction, id: string | null) {
  const out = applyCharades(s, action, id ? actor(id) : system, { now, rng: seededRng(4) });
  if (!out.ok) throw new Error(`unexpected ${out.error}`);
  return out;
}
function refuse(s: CharadesState, action: CharadesAction, id: string, error: CharadesViolation) {
  expect(applyCharades(s, action, actor(id), { now, rng: seededRng(4) })).toEqual({
    ok: false,
    error,
  });
}

/** asha, chitra on team 0; bilal, dev on team 1. */
function ready(turnsPerTeam = 2): CharadesState {
  let s = createCharades({ turnsPerTeam, turnSeconds: 60 });
  s = run(s, { type: 'join', name: 'Asha', team: 0 }, 'asha').state;
  s = run(s, { type: 'join', name: 'Bilal', team: 1 }, 'bilal').state;
  s = run(s, { type: 'join', name: 'Chitra', team: 0 }, 'chitra').state;
  s = run(s, { type: 'join', name: 'Dev', team: 1 }, 'dev').state;
  return run(s, { type: 'start' }, 'asha').state;
}

const title = (s: CharadesState) => FILMS[s.card!]!.title;

describe('titles', () => {
  it('match however people type them', () => {
    const ddlj = FILMS.find((f) => f.title === 'Dilwale Dulhania Le Jayenge')!;
    expect(matches(ddlj, '  dilwale dulhania le jayenge ')).toBe(true);
    expect(matches(ddlj, 'DDLJ')).toBe(true);
    expect(matches(ddlj, 'Dilwale')).toBe(false);
    expect(normalizeTitle('Chak De! India')).toBe('chak de india');
    expect(normalizeTitle('Kapoor & Sons')).toBe('kapoor and sons');
    expect(wordCount('Kabhi Khushi Kabhie Gham')).toBe(4);
  });

  it('the deck has no duplicates', () => {
    const titles = FILMS.map((f) => normalizeTitle(f.title));
    expect(new Set(titles).size).toBe(titles.length);
    expect(FILMS.length).toBeGreaterThanOrEqual(100);
  });
});

describe('setup', () => {
  it('balances teams on join, and needs two per team to start', () => {
    let s = createCharades();
    s = run(s, { type: 'join', name: 'A' }, 'a').state;
    s = run(s, { type: 'join', name: 'B' }, 'b').state;
    s = run(s, { type: 'join', name: 'C' }, 'c').state;
    expect(s.players.map((p) => p.team)).toEqual([0, 1, 0]);
    refuse(s, { type: 'start' }, 'asha', 'teams-too-small');
  });

  it('starts with team 0’s first player ready to act', () => {
    const s = ready();
    expect(s.phase).toBe('ready');
    expect(s.actor).toBe('asha');
  });
});

describe('a turn', () => {
  it('only the actor sees the film', () => {
    let s = ready();
    s = run(s, { type: 'begin' }, 'asha').state;
    expect(viewCharades(s, 'asha').me.card).toBe(title(s));
    for (const other of ['chitra', 'bilal', 'dev', 'stranger']) {
      const view = viewCharades(s, other);
      expect(view.me.card).toBeNull();
      expect(JSON.stringify(view)).not.toContain(title(s));
    }
    expect(viewCharades(s, 'bilal').words).toBe(wordCount(title(s)));
  });

  it('a teammate’s typed guess is checked and scores', () => {
    let s = run(ready(), { type: 'begin' }, 'asha').state;
    refuse(s, { type: 'guess', text: title(s) }, 'bilal', 'not-your-team');
    refuse(s, { type: 'guess', text: title(s) }, 'asha', 'actor-cannot-guess');
    s = run(s, { type: 'guess', text: 'definitely not a film' }, 'chitra').state;
    expect(viewCharades(s, 'chitra').guesses).toHaveLength(1);
    expect(viewCharades(s, 'bilal').guesses).toHaveLength(0);
    s = run(s, { type: 'guess', text: title(s).toUpperCase() }, 'chitra').state;
    expect(s.scores).toEqual([1, 0]);
    expect(s.results[0]).toMatchObject({ outcome: 'guessed', by: 'chitra' });
  });

  it('the actor can confirm a spoken guess, or pass', () => {
    let s = run(ready(), { type: 'begin' }, 'asha').state;
    refuse(s, { type: 'got-it' }, 'chitra', 'not-actor');
    s = run(s, { type: 'got-it' }, 'asha').state;
    expect(s.scores).toEqual([1, 0]);
  });

  it('time running out ends the turn with no point', () => {
    let s = run(ready(), { type: 'begin' }, 'asha').state;
    now += 60_000;
    s = run(s, { type: 'tick' }, null).state;
    expect(s.phase).toBe('between');
    expect(s.results[0]!.outcome).toBe('timeout');
    expect(s.scores).toEqual([0, 0]);
  });
});

describe('the whole game', () => {
  it('alternates teams, rotates actors, and names the winner', () => {
    let s = ready(2);
    const actors: string[] = [];
    for (let turn = 0; turn < 4; turn++) {
      actors.push(s.actor!);
      s = run(s, { type: 'begin' }, s.actor).state;
      s = run(s, turn % 2 === 0 ? { type: 'got-it' } : { type: 'pass' }, s.actor).state;
      s = run(s, { type: 'next' }, 'asha').state;
    }
    expect(actors).toEqual(['asha', 'bilal', 'chitra', 'dev']);
    expect(s.phase).toBe('finished');
    expect(s.scores).toEqual([2, 0]);
  });
});
