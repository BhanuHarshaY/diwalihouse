/**
 * The clay diya, drawn on a 400 × 250 grid, seen from the front with its
 * spout towards the viewer. The decorative band is computed from the body
 * curves so the petals follow the bowl's curvature exactly.
 */

type P = readonly [number, number];

function cubic(p0: P, p1: P, p2: P, p3: P, t: number): P {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

/** y on a (left-half) curve at a given x, by dense sampling. */
function yAt(curve: [P, P, P, P], x: number): number {
  let best: P = curve[0];
  for (let i = 0; i <= 400; i++) {
    const point = cubic(...curve, i / 400);
    if (Math.abs(point[0] - x) < Math.abs(best[0] - x)) best = point;
  }
  return best[1];
}

// Left halves; the right halves mirror about x = 200.
const FRONT_EDGE: [P, P, P, P] = [
  [28, 112],
  [82, 126],
  [156, 132],
  [200, 146],
];
const BOTTOM: [P, P, P, P] = [
  [28, 112],
  [44, 172],
  [108, 214],
  [200, 216],
];

export const DIYA = {
  /** Lit top of the rim (back edge to front lip). */
  rim: 'M28 112C92 84 308 84 372 112C318 126 244 132 200 146C156 132 82 126 28 112Z',
  /** Oil pooled inside the rim. */
  oil: 'M52 112C110 93 290 93 348 112C302 121 242 127 200 137C158 127 98 121 52 112Z',
  /** The visible front of the bowl. */
  body: 'M28 112C82 126 156 132 200 146C244 132 318 126 372 112C356 172 292 214 200 216C108 214 44 172 28 112Z',
  foot: 'M152 208C170 216 230 216 248 208L260 233C238 243 162 243 140 233Z',
  footBand: 'M146 221C172 229 228 229 254 221',
  wick: 'M193.5 139C195.5 128 204.5 128 206.5 139C204 142.5 196 142.5 193.5 139Z',
  /** Where the flame's base sits, in diya units. */
  wickTip: [200, 133] as P,
} as const;

function span(x: number): { top: number; bottom: number } {
  const mx = x > 200 ? 400 - x : x;
  return { top: yAt(FRONT_EDGE, mx), bottom: yAt(BOTTOM, mx) };
}

function petal(x: number, base: number, width: number, height: number): string {
  const w = width / 2;
  const r = (n: number) => Math.round(n * 10) / 10;
  return (
    `M${r(x - w)} ${r(base)}` +
    `C${r(x - w)} ${r(base - height * 0.55)} ${r(x - w * 0.2)} ${r(base - height * 0.82)} ${r(x)} ${r(base - height)}` +
    `C${r(x + w * 0.2)} ${r(base - height * 0.82)} ${r(x + w)} ${r(base - height * 0.55)} ${r(x + w)} ${r(base)}`
  );
}

const PETALS = 9;
const BAND_LEFT = 96;
const BAND_RIGHT = 304;

export const DIYA_BAND = (() => {
  const petals: string[] = [];
  const dots: P[] = [];
  const step = (BAND_RIGHT - BAND_LEFT) / (PETALS - 1);
  for (let i = 0; i < PETALS; i++) {
    const x = BAND_LEFT + step * i;
    const { top, bottom } = span(x);
    const depth = bottom - top;
    const base = top + depth * 0.8;
    // Foreshortening: petals shrink towards the sides of the bowl.
    const edge = 1 - Math.abs(x - 200) / 200;
    petals.push(petal(x, base, step * (0.55 + edge * 0.3), depth * 0.5));
    if (i < PETALS - 1) {
      const mid = x + step / 2;
      const m = span(mid);
      dots.push([
        Math.round(mid * 10) / 10,
        Math.round((m.top + (m.bottom - m.top) * 0.74) * 10) / 10,
      ]);
    }
  }

  // The printed band line just under the lip, following the front edge.
  let line = '';
  for (let x = 64; x <= 336; x += 8) {
    const { top, bottom } = span(x);
    const y = Math.round((top + (bottom - top) * 0.16) * 10) / 10;
    line += `${line ? 'L' : 'M'}${x} ${y}`;
  }

  return { petals, dots, line };
})();
