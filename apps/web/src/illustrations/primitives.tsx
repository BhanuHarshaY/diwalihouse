import type { CSSProperties } from 'react';
import { PALETTE as C } from '@/design-system/palette';
import styles from './illustrations.module.css';

/**
 * Small, reusable pieces every motif is built from. Each is drawn about its
 * own origin and placed with a translate, so the CSS animations (which set
 * `transform`) live on an inner group and never fight the placement.
 */

const delay = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` });

/** A flame whose base sits at the origin; 14 units tall at scale 1. */
export function Flame({
  x,
  y,
  scale = 1,
  wait = 0,
}: {
  x: number;
  y: number;
  scale?: number;
  wait?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g className={styles.flicker} style={delay(wait)}>
        <path
          d="M0 -14C3.4 -9.4 5 -6.2 5 -3.6C5 -1.1 2.8 0.6 0 0.6C-2.8 0.6 -5 -1.1 -5 -3.6C-5 -6.2 -3.4 -9.4 0 -14Z"
          fill={C.marigold500}
        />
        <path
          d="M0 -7.6C1.6 -5.6 2.5 -4.1 2.5 -2.9C2.5 -1.5 1.4 -0.6 0 -0.6C-1.4 -0.6 -2.5 -1.5 -2.5 -2.9C-2.5 -4.1 -1.6 -5.6 0 -7.6Z"
          fill={C.ivory50}
        />
      </g>
    </g>
  );
}

/** A clay lamp 20 units wide, bowl rim at the origin. */
export function SmallDiya({
  x,
  y,
  scale = 1,
  wait = 0,
  clay = C.vermilion500,
}: {
  x: number;
  y: number;
  scale?: number;
  wait?: number;
  clay?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M-10 -1C-8 5.6 8 5.6 10 -1Z" fill={clay} />
      <path d="M-10 -1C-6 -2.8 6 -2.8 10 -1C6 0.3 -6 0.3 -10 -1Z" fill={C.maroon900} />
      <Flame x={0} y={-1.4} scale={0.92} wait={wait} />
    </g>
  );
}

/** Four-point sparkle, radius r. */
export function Sparkle({
  x,
  y,
  r,
  fill = C.ivory50,
  wait = 0,
}: {
  x: number;
  y: number;
  r: number;
  fill?: string;
  wait?: number;
}) {
  const k = r * 0.26;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        className={styles.twinkle}
        style={delay(wait)}
        d={`M0 ${-r}L${k} ${-k}L${r} 0L${k} ${k}L0 ${r}L${-k} ${k}L${-r} 0L${-k} ${-k}Z`}
        fill={fill}
      />
    </g>
  );
}

/** A marigold head seen from the side, radius r. */
export function Marigold({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={C.marigold600} />
      <circle r={r * 0.78} fill={C.marigold500} />
      <circle
        r={r * 0.55}
        fill="none"
        stroke={C.marigold400}
        strokeWidth={r * 0.32}
        strokeLinecap="round"
        pathLength={10}
        strokeDasharray="0 1"
      />
      <circle r={r * 0.2} fill={C.marigold700} />
    </g>
  );
}

/** A dotted line along any path: n evenly spaced round dots. */
export function dotted(n: number, color: string, width: number) {
  return {
    fill: 'none',
    stroke: color,
    strokeWidth: width,
    strokeLinecap: 'round' as const,
    pathLength: n,
    strokeDasharray: '0 1',
  };
}
