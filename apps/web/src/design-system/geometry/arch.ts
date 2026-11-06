/**
 * Cusped (multifoil) arch geometry, the doorway shape of Rajput and Mughal
 * architecture. Pure functions so the same arch can be drawn at any size and
 * aspect ratio without distortion, and tested without a DOM.
 */

export type Point = readonly [number, number];

export interface ArchSpec {
  /** Horizontal centre. */
  cx: number;
  /** Bottom of the jambs (the threshold). */
  baseY: number;
  /** Height at which the jambs stop and the arch begins. */
  springY: number;
  /** Highest point of the arch. */
  apexY: number;
  /** Half the clear width between the jambs. */
  halfWidth: number;
  /** Foils on each side of the apex. */
  lobes: number;
  /** Foil radius as a fraction of each foil's chord; 0.5 is a semicircle. */
  lobeRoundness?: number;
}

export interface Arch {
  /** SVG path data, drawn left jamb → apex → right jamb. */
  d: string;
  /** The sharp points between foils, apex included: where bulbs hang. */
  cusps: Point[];
}

function cubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/** `count + 1` points spaced evenly by arc length along a cubic Bézier. */
function evenlySpaced(p0: Point, p1: Point, p2: Point, p3: Point, count: number): Point[] {
  const samples = 240;
  const points: Point[] = [];
  const lengths: number[] = [0];
  let previous = p0;
  points.push(p0);
  for (let i = 1; i <= samples; i++) {
    const point = cubic(p0, p1, p2, p3, i / samples);
    lengths.push(lengths[i - 1]! + Math.hypot(point[0] - previous[0], point[1] - previous[1]));
    points.push(point);
    previous = point;
  }
  const total = lengths[samples]!;
  const result: Point[] = [p0];
  let cursor = 1;
  for (let k = 1; k < count; k++) {
    const target = (total * k) / count;
    while (lengths[cursor]! < target) cursor++;
    const span = lengths[cursor]! - lengths[cursor - 1]!;
    const f = span === 0 ? 0 : (target - lengths[cursor - 1]!) / span;
    const a = points[cursor - 1]!;
    const b = points[cursor]!;
    result.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  result.push(p3);
  return result;
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

export function cuspedArch(spec: ArchSpec): Arch {
  const { cx, baseY, springY, apexY, halfWidth, lobes } = spec;
  const roundness = spec.lobeRoundness ?? 0.62;
  const rise = springY - apexY;

  // Left half: a slightly ogee curve from the left spring point to the apex.
  const p0: Point = [cx - halfWidth, springY];
  const p1: Point = [cx - halfWidth, springY - rise * 0.58];
  const p2: Point = [cx - halfWidth * 0.32, apexY + rise * 0.16];
  const p3: Point = [cx, apexY];
  const left = evenlySpaced(p0, p1, p2, p3, lobes);
  const right = left
    .slice(0, -1)
    .reverse()
    .map(([x, y]) => [2 * cx - x, y] as Point);
  const outline = [...left, ...right];

  let d = `M${fmt(cx - halfWidth)} ${fmt(baseY)}L${fmt(p0[0])} ${fmt(p0[1])}`;
  for (let i = 1; i < outline.length; i++) {
    const [ax, ay] = outline[i - 1]!;
    const [bx, by] = outline[i]!;
    const r = Math.hypot(bx - ax, by - ay) * roundness;
    // sweep=1: each foil bulges away from the opening, leaving inward cusps.
    d += `A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(bx)} ${fmt(by)}`;
  }
  d += `L${fmt(cx + halfWidth)} ${fmt(baseY)}`;

  return { d, cusps: outline.slice(1, -1) };
}
