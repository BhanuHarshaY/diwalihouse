import { RADIUS, type Folds, type Size, type Stroke, type StrokeInput } from './rangoli.ts';

/**
 * Shapes and symmetry for drawing the rangoli. Strokes become SVG path data,
 * which a browser can hand straight to `Path2D` (canvas) or a `<path>`, so
 * the screen, the saved image and any future TV view draw identically.
 */

/** Line and ring width, in coordinate units (the disc's radius is 1000). */
export const STROKE_WIDTH: Record<Size, number> = { fine: 7, medium: 14, bold: 26 };
export const DOT_RADIUS: Record<Size, number> = { fine: 9, medium: 16, bold: 28 };
/** How far a petal's sides bow out, as a share of its length. */
const PETAL_BOW: Record<Size, number> = { fine: 0.16, medium: 0.24, bold: 0.34 };

/** A 2×2 linear map, in canvas `setTransform(a, b, c, d, …)` order. */
export interface Linear {
  a: number;
  b: number;
  c: number;
  d: number;
}

/**
 * The dihedral group of the rangoli: `folds` rotations, each also mirrored.
 * The first entry is the identity, so a stroke is always drawn where it was
 * made.
 */
export function symmetries(folds: Folds): Linear[] {
  const maps: Linear[] = [];
  for (let k = 0; k < folds; k++) {
    const angle = (2 * Math.PI * k) / folds;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    maps.push({ a: cos, b: sin, c: -sin, d: cos });
  }
  for (let k = 0; k < folds; k++) {
    const angle = (2 * Math.PI * k) / folds;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // A rotation after reflecting across the x axis.
    maps.push({ a: cos, b: sin, c: sin, d: -cos });
  }
  return maps;
}

const n1 = (v: number) => String(Math.round(v * 10) / 10);
const pt = (x: number, y: number) => `${n1(x)} ${n1(y)}`;

function circle(cx: number, cy: number, r: number): string {
  return `M${pt(cx - r, cy)}a${n1(r)} ${n1(r)} 0 1 0 ${n1(2 * r)} 0a${n1(r)} ${n1(r)} 0 1 0 ${n1(-2 * r)} 0Z`;
}

export interface Shape {
  d: string;
  paint: 'fill' | 'stroke';
  /** Line width for stroked shapes. */
  width: number;
  /** True when the shape is already symmetrical (a ring) and is drawn once. */
  once: boolean;
}

/** The stroke as drawn, before symmetry is applied. */
export function strokeShape(stroke: StrokeInput | Stroke): Shape {
  const p = stroke.points;
  switch (stroke.tool) {
    case 'line': {
      // Quadratic curves through the midpoints: smooth, and it still passes
      // through both ends.
      let d = `M${pt(p[0]!, p[1]!)}`;
      const n = p.length / 2;
      if (n === 2) d += `L${pt(p[2]!, p[3]!)}`;
      for (let i = 1; i < n - 1; i++) {
        const [x, y, nx, ny] = [p[2 * i]!, p[2 * i + 1]!, p[2 * i + 2]!, p[2 * i + 3]!];
        // The last curve ends on the last point; the others end halfway to the next.
        d +=
          i === n - 2
            ? `Q${pt(x, y)} ${pt(nx, ny)}`
            : `Q${pt(x, y)} ${pt((x + nx) / 2, (y + ny) / 2)}`;
      }
      return { d, paint: 'stroke', width: STROKE_WIDTH[stroke.size], once: false };
    }
    case 'petal': {
      const [bx, by, tx, ty] = p as [number, number, number, number];
      const length = Math.hypot(tx - bx, ty - by);
      const ux = (tx - bx) / length;
      const uy = (ty - by) / length;
      const w = length * PETAL_BOW[stroke.size];
      const along = (f: number, side: number) =>
        pt(bx + ux * length * f - uy * side, by + uy * length * f + ux * side);
      const d =
        `M${pt(bx, by)}C${along(0.25, w)} ${along(0.75, w * 0.8)} ${pt(tx, ty)}` +
        `C${along(0.75, -w * 0.8)} ${along(0.25, -w)} ${pt(bx, by)}Z`;
      return { d, paint: 'fill', width: 0, once: false };
    }
    case 'dot':
      return {
        d: circle(p[0]!, p[1]!, DOT_RADIUS[stroke.size]),
        paint: 'fill',
        width: 0,
        once: false,
      };
    case 'ring':
      return {
        d: circle(0, 0, Math.hypot(p[0]!, p[1]!)),
        paint: 'stroke',
        width: STROKE_WIDTH[stroke.size],
        once: true,
      };
  }
}

/** Pulls a point onto the disc (if it is outside) and onto the integer grid. */
export function clampToDisc(x: number, y: number): [number, number] {
  const r = Math.hypot(x, y);
  const scale = r > RADIUS - 1 ? (RADIUS - 1) / r : 1;
  return [Math.round(x * scale), Math.round(y * scale)];
}

/** Ramer–Douglas–Peucker: drops points that sit within `tolerance` of the line. */
export function simplify(
  points: Array<[number, number]>,
  tolerance: number,
): Array<[number, number]> {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    const [ax, ay] = points[start]!;
    const [bx, by] = points[end]!;
    const length = Math.hypot(bx - ax, by - ay);
    let worst = -1;
    let at = -1;
    for (let i = start + 1; i < end; i++) {
      const [px, py] = points[i]!;
      const distance =
        length === 0
          ? Math.hypot(px - ax, py - ay)
          : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
      if (distance > worst) {
        worst = distance;
        at = i;
      }
    }
    if (worst > tolerance) {
      keep[at] = 1;
      stack.push([start, at], [at, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Splits a long line into strokes of at most `max` points that join end to end. */
export function splitLine(points: Array<[number, number]>, max: number): number[][] {
  const pieces: number[][] = [];
  for (let start = 0; start < points.length - 1; start += max - 1) {
    pieces.push(points.slice(start, start + max).flat());
  }
  return pieces;
}
