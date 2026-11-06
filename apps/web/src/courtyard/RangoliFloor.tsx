'use client';

import {
  clampToDisc,
  isValidStroke,
  LIMITS,
  RADIUS,
  simplify,
  splitLine,
  type Colour,
  type Folds,
  type Size,
  type Stroke,
  type StrokeInput,
  type Tool,
} from '@diwali/rangoli';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { PALETTE } from '@/design-system/palette';
import { paintStrokes, toRangoliSpace } from './draw';
import styles from './courtyard.module.css';

type Point = [number, number];

export interface Brush {
  tool: Tool;
  colour: Colour;
  size: Size;
}

interface Props {
  strokes: readonly Stroke[];
  folds: Folds;
  brush: Brush;
  /** Strokes sent but not yet confirmed, drawn over the floor meanwhile. */
  pending: readonly StrokeInput[];
  guides: boolean;
  disabled: boolean;
  /** Shown over an empty floor. */
  emptyHint: string | null;
  onDraw: (strokes: StrokeInput[]) => void;
  onAnnounce: (text: string) => void;
}

/** A tap with the petal tool makes one this long, pointing away from the centre. */
const TAP_PETAL = 160;
/** Keyboard brush steps, in coordinate units. */
const STEP = 25;

/** Rounded, so the server's and the browser's trigonometry render identical markup. */
const r1 = (n: number) => Math.round(n * 10) / 10;

function dist(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Turns a finished gesture into the strokes to send, or a reason it made none. */
function strokesFor(brush: Brush, points: Point[]): StrokeInput[] | string {
  const { colour, size } = brush;
  const first = points[0]!;
  const last = points.at(-1)!;
  switch (brush.tool) {
    case 'line': {
      const line = simplify(points, 2.5);
      // A tap with the line tool leaves a dot of the same size.
      if (line.length < 2 || dist(line[0]!, line.at(-1)!) < 3) {
        return [{ tool: 'dot', colour, size, points: [...first] }];
      }
      return splitLine(line, LIMITS.linePoints).map((p) => ({
        tool: 'line',
        colour,
        size,
        points: p,
      }));
    }
    case 'petal': {
      if (dist(first, last) >= LIMITS.minLength) {
        return [{ tool: 'petal', colour, size, points: [...first, ...last] }];
      }
      const r = Math.hypot(first[0], first[1]);
      const [ux, uy] = r < LIMITS.minLength ? [0, -1] : [first[0] / r, first[1] / r];
      const tip = clampToDisc(first[0] + ux * TAP_PETAL, first[1] + uy * TAP_PETAL);
      if (dist(first, tip) < LIMITS.minLength)
        return 'There’s no room for a petal that close to the edge.';
      return [{ tool: 'petal', colour, size, points: [...first, ...tip] }];
    }
    case 'dot':
      return [{ tool: 'dot', colour, size, points: [...last] }];
    case 'ring':
      if (Math.hypot(last[0], last[1]) < LIMITS.minLength) {
        return 'Draw a ring a little away from the centre.';
      }
      return [{ tool: 'ring', colour, size, points: [...last] }];
  }
}

/** What a gesture in progress looks like, before it is sent. */
function preview(brush: Brush, points: Point[]): StrokeInput | null {
  if (brush.tool === 'line' && points.length >= 2) {
    return { tool: 'line', colour: brush.colour, size: brush.size, points: points.flat() };
  }
  const made = strokesFor(brush, points);
  return typeof made === 'string' ? null : (made[0] ?? null);
}

export function RangoliFloor({
  strokes,
  folds,
  brush,
  pending,
  guides,
  disabled,
  emptyHint,
  onDraw,
  onAnnounce,
}: Props) {
  const help = useId();
  const field = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const [pixels, setPixels] = useState(0);
  const painted = useRef<{ strokes: readonly Stroke[]; folds: Folds; pixels: number } | null>(null);

  // What the overlay draws, kept in refs so pointer moves don't re-render.
  const gesture = useRef<{ id: number; points: Point[] } | null>(null);
  const keyLine = useRef<Point[] | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const live = useRef({ pending, folds, brush, cursor, pixels });
  const frame = useRef(0);

  // Size the canvases to the field, in device pixels (at most 2×).
  useEffect(() => {
    const element = field.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const css = entry?.contentRect.width ?? 0;
      setPixels(Math.round(css * Math.min(window.devicePixelRatio || 1, 2)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The strokes, on a transparent canvas over the floor and its guides: add
  // new strokes on top when that's all that changed, otherwise repaint.
  useEffect(() => {
    const canvas = base.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !pixels) return;
    const before = painted.current;
    const appended =
      before &&
      before.pixels === pixels &&
      before.folds === folds &&
      strokes.length >= before.strokes.length &&
      (before.strokes.length === 0 || strokes[before.strokes.length - 1] === before.strokes.at(-1));
    if (canvas.width !== pixels) canvas.width = canvas.height = pixels;
    if (!appended) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pixels, pixels);
    }
    toRangoliSpace(ctx, pixels);
    paintStrokes(ctx, appended ? strokes.slice(before.strokes.length) : strokes, folds);
    painted.current = { strokes, folds, pixels };
  }, [strokes, folds, pixels]);

  const repaintOverlay = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const canvas = overlay.current;
      const ctx = canvas?.getContext('2d');
      const now = live.current;
      if (!canvas || !ctx || !now.pixels) return;
      if (canvas.width !== now.pixels) canvas.width = canvas.height = now.pixels;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      toRangoliSpace(ctx, now.pixels);
      const drawing = gesture.current?.points ?? keyLine.current;
      const inProgress = drawing ? preview(now.brush, drawing) : null;
      paintStrokes(ctx, inProgress ? [...now.pending, inProgress] : now.pending, now.folds);
      if (now.cursor) {
        // The keyboard brush: a ring with a centre dot, in the brush's size.
        const [x, y] = now.cursor;
        ctx.lineWidth = 6;
        ctx.strokeStyle = PALETTE.marigold200;
        ctx.beginPath();
        ctx.arc(x, y, 34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = PALETTE.marigold200;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, []);

  useEffect(() => {
    live.current = { pending, folds, brush, cursor, pixels };
    repaintOverlay();
  }, [pending, folds, brush, cursor, pixels, repaintOverlay]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function unitsAt(clientX: number, clientY: number): Point {
    const rect = base.current!.getBoundingClientRect();
    return clampToDisc(
      ((clientX - rect.left) / rect.width - 0.5) * 2 * RADIUS,
      ((clientY - rect.top) / rect.height - 0.5) * 2 * RADIUS,
    );
  }

  function finish(points: Point[]) {
    const made = strokesFor(brush, points);
    if (typeof made === 'string') return onAnnounce(made);
    const valid = made.filter(isValidStroke);
    if (valid.length) onDraw(valid);
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || gesture.current) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { id: event.pointerId, points: [unitsAt(event.clientX, event.clientY)] };
    repaintOverlay();
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const sample of samples.length ? samples : [event.nativeEvent]) {
      const point = unitsAt(sample.clientX, sample.clientY);
      if (brush.tool !== 'line') g.points[1] = point;
      else if (dist(point, g.points.at(-1)!) >= 4) g.points.push(point);
    }
    repaintOverlay();
  }

  function onPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    gesture.current = null;
    finish(g.points);
    repaintOverlay();
  }

  function onPointerCancel() {
    gesture.current = null;
    repaintOverlay();
  }

  function onKeyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const step = event.shiftKey ? STEP * 4 : STEP;
    const move: Record<string, Point> = {
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
    };
    const at = cursor ?? [0, -300];
    if (move[event.key]) {
      event.preventDefault();
      const [dx, dy] = move[event.key]!;
      const next = clampToDisc(at[0] + dx, at[1] + dy);
      if (keyLine.current) keyLine.current.push(next);
      setCursor(next);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (brush.tool === 'line') {
        if (!keyLine.current) {
          keyLine.current = [at];
          onAnnounce('Line started. Move with the arrow keys, then press Enter to finish.');
        } else {
          const points = keyLine.current;
          keyLine.current = null;
          finish(points);
          onAnnounce('Line drawn.');
        }
        repaintOverlay();
        return;
      }
      finish([at]);
      onAnnounce(
        `${brush.tool === 'dot' ? 'Dot' : brush.tool === 'ring' ? 'Ring' : 'Petal'} drawn.`,
      );
      return;
    }
    if (event.key === 'Escape' && keyLine.current) {
      keyLine.current = null;
      onAnnounce('Line cancelled.');
      repaintOverlay();
    }
  }

  const spokes = Array.from({ length: folds * 2 }, (_, k) => (Math.PI * k) / folds);
  const rings = [1, 2, 3, 4, 5, 6, 7].map((i) => ({ r: i * 125, dots: folds * i }));

  return (
    <div className={styles.floor}>
      <svg className={styles.band} viewBox="0 0 1000 1000" aria-hidden>
        <rect width="1000" height="1000" fill={PALETTE.mitti700} />
        <rect
          x="22"
          y="22"
          width="956"
          height="956"
          fill="none"
          stroke={PALETTE.marigold200}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`0 ${956 / 30}`}
        />
        <rect x="44" y="44" width="912" height="912" fill={PALETTE.brass500} />
      </svg>
      <div ref={field} className={styles.field}>
        {guides ? (
          <svg className={styles.guides} viewBox="-1000 -1000 2000 2000" aria-hidden>
            <g stroke={PALETTE.mitti500} strokeWidth="2.5" strokeDasharray="6 14" opacity="0.7">
              {spokes.map((angle) => (
                <line
                  key={angle}
                  x1="0"
                  y1="0"
                  x2={r1(Math.cos(angle) * RADIUS)}
                  y2={r1(Math.sin(angle) * RADIUS)}
                />
              ))}
            </g>
            <g fill={PALETTE.mitti500}>
              {rings.flatMap(({ r, dots }) =>
                Array.from({ length: dots }, (_, i) => {
                  const angle = (2 * Math.PI * i) / dots;
                  return (
                    <circle
                      key={`${r}-${i}`}
                      cx={r1(Math.cos(angle) * r)}
                      cy={r1(Math.sin(angle) * r)}
                      r="6"
                    />
                  );
                }),
              )}
            </g>
            <circle
              r={RADIUS - 4}
              fill="none"
              stroke={PALETTE.mitti300}
              strokeWidth="5"
              strokeDasharray="2 22"
              strokeLinecap="round"
            />
          </svg>
        ) : null}
        <canvas ref={base} className={styles.canvas} aria-hidden />
        <canvas
          ref={overlay}
          className={styles.canvas}
          data-drawing
          tabIndex={disabled ? -1 : 0}
          role="application"
          aria-roledescription="rangoli floor"
          aria-label={`The rangoli floor: ${strokes.length} stroke${strokes.length === 1 ? '' : 's'}, in ${folds}-fold symmetry.`}
          aria-describedby={help}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onKeyDown={onKeyDown}
          onFocus={() => setCursor((c) => c ?? [0, -300])}
          onBlur={() => {
            keyLine.current = null;
            setCursor(null);
          }}
        />
        {emptyHint ? (
          <p className={`type-story ${styles.hint}`} aria-hidden>
            {emptyHint}
          </p>
        ) : null}
        <p id={help} className="visually-hidden">
          Draw with a finger or a mouse. With a keyboard, move the brush with the arrow keys (hold
          Shift for bigger steps) and press Enter to draw; with the line tool, Enter starts and
          finishes a line.
        </p>
      </div>
    </div>
  );
}
