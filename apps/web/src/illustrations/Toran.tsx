import { PALETTE as C } from '@/design-system/palette';
import styles from './illustrations.module.css';
import { Marigold } from './primitives';
import { Lantern } from './traditions';

/**
 * A toran: marigold garlands swagged across a doorway, with strands hanging
 * from each hook. 1200 × 150 grid; sliced (not squashed) on narrow screens.
 */

const HOOKS = Array.from({ length: 9 }, (_, i) => i * 150);
const LEAF = 'M0 0C5 4 6 12 0 20C-6 12 -5 4 0 0Z';

function swagPoints(x0: number, x1: number): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let t = 0.07; t < 0.95; t += 0.108) {
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * ((x0 + x1) / 2) + t * t * x1;
    const y = (1 - t) * (1 - t) * 10 + 2 * (1 - t) * t * 60 + t * t * 10;
    points.push([x, y]);
  }
  return points;
}

export function Toran({ className }: { className?: string | undefined }) {
  return (
    <svg
      viewBox="0 0 1200 150"
      preserveAspectRatio="xMidYMin slice"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path d="M0 4H1200" stroke={C.brass500} strokeWidth={2} />
      {HOOKS.slice(0, -1).map((x0, i) =>
        swagPoints(x0, HOOKS[i + 1]!).map(([x, y], j) => (
          <Marigold key={`${i}-${j}`} x={x} y={y} r={j % 2 ? 7.2 : 8.2} />
        )),
      )}
      {HOOKS.map((x, i) => (
        <g key={x}>
          <g className={i % 2 ? styles.swayLate : styles.sway}>
            <path
              d={`M${x} 6V${18 + (i % 2 ? 4 : 5) * 15}`}
              stroke={C.peacock300}
              strokeWidth={1.2}
            />
            {Array.from({ length: i % 2 ? 4 : 5 }, (_, j) => (
              <Marigold key={j} x={x} y={18 + j * 15} r={7} />
            ))}
            <path
              d={LEAF}
              transform={`translate(${x} ${12 + (i % 2 ? 4 : 5) * 15})`}
              fill={C.peacock500}
            />
          </g>
          <path d={LEAF} transform={`translate(${x} 4) rotate(-120)`} fill={C.peacock600} />
          <path d={LEAF} transform={`translate(${x} 4) rotate(120)`} fill={C.peacock600} />
        </g>
      ))}
    </svg>
  );
}

/** A single hanging sky-lantern, for flanking doorways. */
export function HangingLantern({ className }: { className?: string | undefined }) {
  return (
    <svg viewBox="28 -64 64 204" className={className} aria-hidden focusable="false">
      <Lantern />
    </svg>
  );
}
