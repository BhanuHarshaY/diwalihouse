/**
 * Scene 1 camera. The stage is a row of lamps on a threshold; the "camera"
 * starts close on the centre lamp and pulls back to reveal the row.
 *
 * Each lamp is its own composited layer, rendered at its close-up size and
 * only ever scaled *down*, so it stays crisp and the browser never repaints
 * during the pull-back. This module is the pure maths behind that: given the
 * viewport and a zoom `z` (1 = whole row, `zMax` = close-up) it returns where
 * every lamp goes.
 */

export interface Viewport {
  width: number;
  height: number;
}

export interface StageLayout {
  viewport: Viewport;
  /** Lamps in the row (odd). */
  count: number;
  /** Lamp width at z = 1. */
  rowLampWidth: number;
  /** Centre-to-centre distance at z = 1. */
  spacing: number;
  /** Zoom of the opening close-up. */
  zMax: number;
  /** Rendered lamp width before scaling (= close-up width). */
  baseWidth: number;
  /** Lamp height / width for the artwork. */
  aspect: number;
  /** y of the lamp feet at z = 1 and at z = zMax. */
  rowY: number;
  closeY: number;
  /** The arch that frames the row. */
  archHalfWidth: number;
}

export interface LampPlacement {
  /** Translate for the lamp's top-left corner, before scaling about its foot. */
  x: number;
  y: number;
  scale: number;
  /** Centre of the lamp on screen, for pointer maths. */
  centerX: number;
}

/** Lamp artwork is 400 × 360 units: 110 of flame above a 250-unit diya. */
export const LAMP_ASPECT = 360 / 400;

export function stageLayout(viewport: Viewport): StageLayout {
  const { width, height } = viewport;
  const narrow = width < 640;
  const count = narrow ? 7 : 9;
  const archHalfWidth = narrow ? width * 0.44 : Math.min(width * 0.43, 620);
  const spacing = (archHalfWidth * 2 * 0.86) / count;
  const rowLampWidth = spacing * 0.8;
  const closeWidth = narrow
    ? Math.min(width * 0.66, height * 0.38, 320)
    : Math.min(width * 0.3, height * 0.52, 460);

  return {
    viewport,
    count,
    rowLampWidth,
    spacing,
    zMax: closeWidth / rowLampWidth,
    baseWidth: closeWidth,
    aspect: LAMP_ASPECT,
    rowY: height * (narrow ? 0.7 : 0.74),
    closeY: height * (narrow ? 0.8 : 0.86),
    archHalfWidth,
  };
}

/** Offsets from the centre lamp, centre first: 0, -1, 1, -2, 2, … */
export function lampOffsets(count: number): number[] {
  const half = (count - 1) / 2;
  const offsets = [0];
  for (let k = 1; k <= half; k++) offsets.push(-k, k);
  return offsets;
}

export function placeLamp(layout: StageLayout, offset: number, z: number): LampPlacement {
  const { viewport, spacing, zMax, baseWidth, aspect, rowY, closeY } = layout;
  const t = zMax === 1 ? 0 : (z - 1) / (zMax - 1);
  const foot = rowY + (closeY - rowY) * t;
  const centerX = viewport.width / 2 + offset * spacing * z;
  return {
    x: centerX - baseWidth / 2,
    y: foot - baseWidth * aspect,
    scale: z / zMax,
    centerX,
  };
}

/**
 * The closest zoom that still shows every lamp out to `radius` lamps from
 * the centre, with a margin. Lighting a lamp pulls the camera back just far
 * enough to see it.
 */
export function zoomToShow(layout: StageLayout, radius: number): number {
  const halfVisible = layout.viewport.width * 0.47;
  const needed = radius * layout.spacing + layout.rowLampWidth / 2;
  return Math.max(1, Math.min(layout.zMax, halfVisible / needed));
}
