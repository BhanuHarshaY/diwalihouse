import {
  RADIUS,
  strokeShape,
  symmetries,
  type Colour,
  type Folds,
  type StrokeInput,
} from '@diwali/rangoli';
import { PALETTE } from '@/design-system/palette';

/**
 * Painting the rangoli onto a canvas. Every stroke is drawn once per
 * symmetry (2 × folds times), from path data the rangoli package computes,
 * so the screen and the saved image always agree.
 */

/** Powder colours, as palette pigments. */
export const INK: Record<Colour, string> = {
  white: PALETTE.ivory50,
  turmeric: PALETTE.marigold400,
  marigold: PALETTE.marigold600,
  vermilion: PALETTE.vermilion500,
  rani: PALETTE.rani500,
  rose: PALETTE.gulab400,
  peacock: PALETTE.peacock500,
  teal: PALETTE.peacock300,
};

export const INK_NAME: Record<Colour, string> = {
  white: 'Rice-flour white',
  turmeric: 'Turmeric',
  marigold: 'Marigold',
  vermilion: 'Vermilion',
  rani: 'Rani pink',
  rose: 'Rose',
  peacock: 'Peacock',
  teal: 'Teal',
};

/** Swept earth, where the rangoli is drawn. */
export const FLOOR = PALETTE.mitti900;

// Path2D objects are cheap to keep and costly to rebuild for thousands of
// strokes on every redraw; stroke objects never change once made.
const cache = new WeakMap<StrokeInput, { path: Path2D; shape: ReturnType<typeof strokeShape> }>();

function prepared(stroke: StrokeInput) {
  let entry = cache.get(stroke);
  if (!entry) {
    const shape = strokeShape(stroke);
    entry = { path: new Path2D(shape.d), shape };
    cache.set(stroke, entry);
  }
  return entry;
}

/** Puts the canvas in rangoli coordinates: origin at the centre, the disc filling it. */
export function toRangoliSpace(ctx: CanvasRenderingContext2D, size: number, inset = 0) {
  const scale = (size - 2 * inset) / (2 * RADIUS);
  ctx.setTransform(scale, 0, 0, scale, size / 2, size / 2);
}

/** Paints strokes through every symmetry. Expects rangoli space. */
export function paintStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Iterable<StrokeInput>,
  folds: Folds,
) {
  const maps = symmetries(folds);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, RADIUS, 0, Math.PI * 2);
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const stroke of strokes) {
    const { path, shape } = prepared(stroke);
    ctx.fillStyle = INK[stroke.colour];
    ctx.strokeStyle = INK[stroke.colour];
    ctx.lineWidth = shape.width;
    for (const m of shape.once ? maps.slice(0, 1) : maps) {
      ctx.save();
      ctx.transform(m.a, m.b, m.c, m.d, 0, 0);
      if (shape.paint === 'fill') ctx.fill(path);
      else ctx.stroke(path);
      ctx.restore();
    }
  }
  ctx.restore();
}

/**
 * The rangoli as a framed square image: a border of lamp dots on an earth
 * band, a brass hairline, then the floor. Resolves to a PNG.
 */
export function renderImage(
  strokes: readonly StrokeInput[],
  folds: Folds,
  size = 2048,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  const band = Math.round(size * 0.045);
  ctx.fillStyle = PALETTE.mitti700;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = PALETTE.marigold200;
  const step = band * 0.9;
  for (let at = band / 2; at <= size - band / 2 + 1; at += step) {
    for (const [x, y] of [
      [at, band / 2],
      [at, size - band / 2],
      [band / 2, at],
      [size - band / 2, at],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, band * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = PALETTE.brass500;
  ctx.fillRect(band, band, size - 2 * band, size - 2 * band);
  const field = band + Math.max(2, Math.round(size * 0.002));
  ctx.fillStyle = FLOOR;
  ctx.fillRect(field, field, size - 2 * field, size - 2 * field);
  toRangoliSpace(ctx, size, field + band * 0.4);
  paintStrokes(ctx, strokes, folds);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
