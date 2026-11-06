import type { Actor } from '@diwali/game-kit';
import { describe, expect, it } from 'vitest';
import { clampToDisc, simplify, splitLine, strokeShape, symmetries } from './geometry.ts';
import {
  applyRangoli,
  createRangoli,
  isValidStroke,
  LIMITS,
  RADIUS,
  strokesByMember,
  type RangoliAction,
  type RangoliState,
  type StrokeInput,
} from './rangoli.ts';

const guest = (id: string): Actor => ({ kind: 'player', id, host: false });
const host: Actor = { kind: 'player', id: 'asha', host: true };

const dot = (x = 100, y = 0): StrokeInput => ({
  tool: 'dot',
  colour: 'marigold',
  size: 'medium',
  points: [x, y],
});

function run(state: RangoliState, action: RangoliAction, actor: Actor, now = 0) {
  const out = applyRangoli(state, action, actor, now);
  if (!out.ok) throw new Error(`refused: ${out.error}`);
  return out;
}

function refused(state: RangoliState, action: RangoliAction, actor: Actor, now = 0) {
  const out = applyRangoli(state, action, actor, now);
  if (out.ok) throw new Error('expected a refusal');
  return out.error;
}

describe('drawing', () => {
  it('adds a stroke with a server id and the drawer as its author', () => {
    const s = createRangoli();
    const sent = { ...dot(), id: 99, by: 'someone-else', extra: true } as StrokeInput;
    const out = run(s, { type: 'draw', stroke: sent }, guest('meera'));
    expect(out.state.strokes).toEqual([
      { id: 1, by: 'meera', tool: 'dot', colour: 'marigold', size: 'medium', points: [100, 0] },
    ]);
    expect(out.events).toEqual([{ type: 'drawn', stroke: out.state.strokes[0] }]);
    expect(s.strokes).toHaveLength(0);
  });

  it('refuses strokes that are off the disc or the wrong shape for their tool', () => {
    const s = createRangoli();
    const bad: StrokeInput[] = [
      dot(RADIUS, 1),
      dot(1.5, 0),
      { ...dot(), points: [1, 2, 3] },
      { ...dot(), points: [1, 2, 3, 4] },
      { tool: 'line', colour: 'white', size: 'fine', points: [0, 0] },
      {
        tool: 'line',
        colour: 'white',
        size: 'fine',
        points: Array.from({ length: (LIMITS.linePoints + 1) * 2 }, (_, i) => i),
      },
      { tool: 'petal', colour: 'rose', size: 'bold', points: [100, 100, 105, 105] },
      { tool: 'ring', colour: 'teal', size: 'fine', points: [3, 4] },
      { ...dot(), colour: 'black' as never },
      { ...dot(), tool: 'spray' as never },
    ];
    for (const stroke of bad) {
      expect(isValidStroke(stroke), JSON.stringify(stroke)).toBe(false);
      expect(refused(s, { type: 'draw', stroke }, guest('meera'))).toBe('bad-stroke');
    }
    expect(
      isValidStroke({ tool: 'petal', colour: 'rose', size: 'bold', points: [0, 0, 0, 300] }),
    ).toBe(true);
  });

  it('allows a quick burst, then asks people to slow down until it refills', () => {
    let s = createRangoli();
    for (let i = 0; i < LIMITS.burst; i++)
      s = run(s, { type: 'draw', stroke: dot() }, guest('meera')).state;
    expect(refused(s, { type: 'draw', stroke: dot() }, guest('meera'))).toBe('slow-down');
    // Someone else's budget is their own.
    s = run(s, { type: 'draw', stroke: dot() }, guest('bilal')).state;
    // A second later, `perSecond` more are allowed.
    for (let i = 0; i < LIMITS.perSecond; i++) {
      s = run(s, { type: 'draw', stroke: dot() }, guest('meera'), 1000).state;
    }
    expect(refused(s, { type: 'draw', stroke: dot() }, guest('meera'), 1000)).toBe('slow-down');
  });

  it('caps one person’s share and the whole rangoli', () => {
    const mine = Array.from({ length: LIMITS.perMember }, (_, i) => ({
      ...dot(),
      id: i + 1,
      by: 'meera',
    }));
    let s: RangoliState = { ...createRangoli(), strokes: mine, nextId: mine.length + 1 };
    expect(refused(s, { type: 'draw', stroke: dot() }, guest('meera'))).toBe('share-used');
    expect(run(s, { type: 'draw', stroke: dot() }, guest('bilal')).ok).toBe(true);

    const all = Array.from({ length: LIMITS.strokes }, (_, i) => ({
      ...dot(),
      id: i + 1,
      by: `g${i % 50}`,
    }));
    s = { ...createRangoli(), strokes: all, nextId: all.length + 1 };
    expect(refused(s, { type: 'draw', stroke: dot() }, guest('new'))).toBe('full');
  });
});

describe('undo and moderation', () => {
  function drawn() {
    let s = createRangoli();
    for (const [who, at] of [
      ['meera', 1],
      ['bilal', 2],
      ['meera', 3],
      ['bilal', 4],
    ] as const) {
      s = run(s, { type: 'draw', stroke: dot(at * 10) }, guest(who)).state;
    }
    return s;
  }

  it('undo removes only my latest stroke', () => {
    const out = run(drawn(), { type: 'undo' }, guest('meera'));
    expect(out.events).toEqual([{ type: 'erased', ids: [3] }]);
    expect(out.state.strokes.map((s) => s.id)).toEqual([1, 2, 4]);
    expect(refused(createRangoli(), { type: 'undo' }, guest('meera'))).toBe('nothing-to-undo');
  });

  it('only the host can erase someone’s strokes, and it takes all of them', () => {
    const s = drawn();
    expect(refused(s, { type: 'erase', member: 'bilal' }, guest('meera'))).toBe('not-host');
    const out = run(s, { type: 'erase', member: 'bilal' }, host);
    expect(out.events).toEqual([{ type: 'erased', ids: [2, 4] }]);
    expect(strokesByMember(out.state)).toEqual(new Map([['meera', 2]]));
    expect(refused(out.state, { type: 'erase', member: 'bilal' }, host)).toBe('nothing-to-erase');
  });

  it('only the host can start a fresh rangoli; stroke ids never repeat', () => {
    const s = drawn();
    expect(refused(s, { type: 'fresh', folds: 6 }, guest('meera'))).toBe('not-host');
    expect(refused(s, { type: 'fresh', folds: 7 as never }, host)).toBe('bad-folds');
    const out = run(s, { type: 'fresh', folds: 12 }, host);
    expect(out.state).toMatchObject({ folds: 12, edition: 2, strokes: [] });
    expect(out.events).toEqual([{ type: 'fresh', folds: 12, edition: 2 }]);
    const next = run(out.state, { type: 'draw', stroke: dot() }, guest('meera'));
    expect(next.state.strokes[0]!.id).toBe(5);
  });

  it('refuses anyone who is not a player', () => {
    expect(refused(createRangoli(), { type: 'draw', stroke: dot() }, { kind: 'system' })).toBe(
      'not-member',
    );
  });
});

describe('geometry', () => {
  it('has 2 × folds symmetries, starting with the identity, all rigid', () => {
    for (const folds of [6, 8, 12] as const) {
      const maps = symmetries(folds);
      expect(maps).toHaveLength(folds * 2);
      expect(maps[0]).toEqual({ a: 1, b: 0, c: -0, d: 1 });
      for (const { a, b, c, d } of maps) {
        expect(Math.abs(a * d - b * c)).toBeCloseTo(1);
        expect(a * c + b * d).toBeCloseTo(0);
      }
      // Rotations keep orientation; the mirrored half reverses it.
      expect(maps.filter(({ a, b, c, d }) => a * d - b * c < 0)).toHaveLength(folds);
    }
  });

  it('draws each tool as path data that starts where the stroke starts', () => {
    expect(
      strokeShape({ tool: 'line', colour: 'white', size: 'fine', points: [0, 0, 10, 0] }).d,
    ).toBe('M0 0L10 0');
    const curve = strokeShape({
      tool: 'line',
      colour: 'white',
      size: 'bold',
      points: [0, 0, 10, 10, 20, 0, 30, 10],
    });
    expect(curve).toMatchObject({ paint: 'stroke', width: 26, once: false });
    expect(curve.d).toBe('M0 0Q10 10 15 5Q20 0 30 10');
    const petal = strokeShape({
      tool: 'petal',
      colour: 'rose',
      size: 'medium',
      points: [0, -100, 0, -400],
    });
    expect(petal.d.startsWith('M0 -100C')).toBe(true);
    expect(petal.d).toContain(' 0 -400C');
    expect(petal.paint).toBe('fill');
    expect(
      strokeShape({ tool: 'ring', colour: 'teal', size: 'fine', points: [300, 400] }),
    ).toMatchObject({
      d: 'M-500 0a500 500 0 1 0 1000 0a500 500 0 1 0 -1000 0Z',
      once: true,
    });
  });

  it('clamps points onto the disc and the integer grid', () => {
    expect(clampToDisc(12.4, -7.6)).toEqual([12, -8]);
    const [x, y] = clampToDisc(3000, 4000);
    expect(Math.hypot(x, y)).toBeLessThanOrEqual(RADIUS);
    expect(isValidStroke(dot(x, y))).toBe(true);
  });

  it('simplifies a wobbly line and splits a long one into joined pieces', () => {
    const straight: Array<[number, number]> = Array.from({ length: 50 }, (_, i) => [i * 10, i % 2]);
    expect(simplify(straight, 2)).toEqual([
      [0, 0],
      [490, 1],
    ]);
    const corner: Array<[number, number]> = [
      [0, 0],
      [50, 1],
      [100, 0],
      [100, 100],
    ];
    expect(simplify(corner, 3)).toEqual([
      [0, 0],
      [100, 0],
      [100, 100],
    ]);
    const long = Array.from({ length: 200 }, (_, i) => [i, 0] as [number, number]);
    const pieces = splitLine(long, LIMITS.linePoints);
    expect(pieces.every((p) => p.length / 2 <= LIMITS.linePoints)).toBe(true);
    expect(pieces.map((p) => p.slice(0, 2))).toEqual([
      [0, 0],
      [95, 0],
      [190, 0],
    ]);
    expect(pieces.at(-1)!.slice(-2)).toEqual([199, 0]);
  });
});
