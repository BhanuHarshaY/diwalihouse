import { seededRng, type Actor } from '@diwali/game-kit';
import { describe, expect, it } from 'vitest';
import {
  applyRajaMantri,
  createRajaMantri,
  holderOf,
  viewRajaMantri,
  type RajaMantriAction,
  type RajaMantriState,
  type RajaMantriViolation,
} from './engine.ts';

const ids = ['asha', 'bilal', 'chitra', 'dev'];
const actor = (id: string): Actor => ({ kind: 'player', id, host: id === 'asha' });
let seed = 1;

function run(s: RajaMantriState, action: RajaMantriAction, id: string) {
  const out = applyRajaMantri(s, action, actor(id), { now: 0, rng: seededRng(seed) });
  if (!out.ok) throw new Error(`unexpected ${out.error}`);
  return out;
}
function refuse(
  s: RajaMantriState,
  action: RajaMantriAction,
  id: string,
  error: RajaMantriViolation,
) {
  expect(applyRajaMantri(s, action, actor(id), { now: 0, rng: seededRng(seed) })).toEqual({
    ok: false,
    error,
  });
}

function started(rounds = 3): RajaMantriState {
  let s = createRajaMantri({ rounds });
  for (const id of ids) s = run(s, { type: 'join', name: id }, id).state;
  return run(s, { type: 'start' }, 'asha').state;
}

describe('setup', () => {
  it('needs exactly four players, and the host to start', () => {
    let s = createRajaMantri();
    for (const id of ids.slice(0, 3)) s = run(s, { type: 'join', name: id }, id).state;
    refuse(s, { type: 'start' }, 'asha', 'need-four');
    s = run(s, { type: 'join', name: 'dev' }, 'dev').state;
    refuse(s, { type: 'join', name: 'eve' }, 'eve', 'game-full');
    refuse(s, { type: 'start' }, 'bilal', 'not-host');
  });

  it('deals one of each chit', () => {
    const s = started();
    expect(Object.values(s.roles).sort()).toEqual(['chor', 'mantri', 'raja', 'sipahi']);
    expect(s.phase).toBe('guessing');
  });
});

describe('a round', () => {
  it('only the Mantri accuses, and only the Chor or the Sipahi', () => {
    const s = started();
    const raja = holderOf(s, 'raja')!;
    const mantri = holderOf(s, 'mantri')!;
    refuse(s, { type: 'accuse', accused: holderOf(s, 'chor')! }, raja, 'not-mantri');
    refuse(s, { type: 'accuse', accused: raja }, mantri, 'bad-accusation');
  });

  it('a right guess: Raja 1000, Mantri 800, Sipahi 500, Chor nothing', () => {
    let s = started();
    s = run(s, { type: 'accuse', accused: holderOf(s, 'chor')! }, holderOf(s, 'mantri')!).state;
    const scores = Object.fromEntries(s.players.map((p) => [s.roles[p.id], p.score]));
    expect(scores).toEqual({ raja: 1000, mantri: 800, sipahi: 500, chor: 0 });
    expect(s.history[0]!.correct).toBe(true);
  });

  it('a wrong guess: the Chor takes the Mantri’s 800', () => {
    let s = started();
    s = run(s, { type: 'accuse', accused: holderOf(s, 'sipahi')! }, holderOf(s, 'mantri')!).state;
    const scores = Object.fromEntries(s.players.map((p) => [s.roles[p.id], p.score]));
    expect(scores).toEqual({ raja: 1000, mantri: 0, sipahi: 500, chor: 800 });
  });

  it('runs the configured number of rounds, then names the winner', () => {
    let s = started(2);
    for (let round = 0; round < 2; round++) {
      s = run(s, { type: 'accuse', accused: holderOf(s, 'chor')! }, holderOf(s, 'mantri')!).state;
      const out = run(s, { type: 'next' }, 'asha');
      s = out.state;
      if (round === 1) expect(out.events[0]).toMatchObject({ type: 'finished' });
    }
    expect(s.phase).toBe('finished');
    expect(s.players.reduce((sum, p) => sum + p.score, 0)).toBe(2 * 2300);
  });
});

describe('views', () => {
  it('each player knows only their own chit, plus who is Raja and Mantri', () => {
    for (seed = 1; seed < 30; seed++) {
      const s = started();
      const chor = holderOf(s, 'chor')!;
      const sipahi = holderOf(s, 'sipahi')!;
      for (const viewer of ids) {
        const view = viewRajaMantri(s, viewer);
        expect(view.me.role).toBe(s.roles[viewer]);
        expect(Object.values(view.known).sort()).toEqual(['mantri', 'raja']);
        expect(view.known[chor]).toBeUndefined();
        expect(view.known[sipahi]).toBeUndefined();
      }
      // The Mantri is offered exactly the two hidden players.
      const mantriView = viewRajaMantri(s, holderOf(s, 'mantri')!);
      expect(mantriView.me.can.accuse.sort()).toEqual([chor, sipahi].sort());
    }
  });

  it('a spectator sees no chits at all while guessing', () => {
    const view = viewRajaMantri(started(), 'someone-else');
    expect(view.me.role).toBeNull();
    expect(Object.keys(view.known)).toHaveLength(2);
  });

  it('everything is revealed after the accusation', () => {
    let s = started();
    s = run(s, { type: 'accuse', accused: holderOf(s, 'chor')! }, holderOf(s, 'mantri')!).state;
    expect(Object.keys(viewRajaMantri(s, 'someone-else').known)).toHaveLength(4);
  });
});
