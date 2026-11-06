import type { ReactNode } from 'react';
import { cuspedArch } from '@/design-system/geometry/arch';
import styles from './illustrations.module.css';
import { dotted } from './primitives';

/**
 * An arch window: a coloured wall, a cusped arch opening in a second colour,
 * a dotted inner border, and one motif standing on the sill. 200 × 250 grid;
 * motifs are drawn in a 120 × 150 box that this frame places at (40, 92).
 */

const ARCH = cuspedArch({ cx: 100, baseY: 250, springY: 108, apexY: 16, halfWidth: 74, lobes: 3 });
const BORDER = cuspedArch({
  cx: 100,
  baseY: 244,
  springY: 110,
  apexY: 28,
  halfWidth: 65,
  lobes: 3,
});

export interface WindowColours {
  wall: string;
  ground: string;
  dots: string;
}

export function ArchWindow({
  id,
  colours,
  label,
  children,
}: {
  /** Unique on the page; names the clip path that keeps the motif inside the arch. */
  id: string;
  colours: WindowColours;
  /** Accessible name; omit when nearby text already describes the window. */
  label?: string | undefined;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 200 250"
      className={styles.window}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <clipPath id={`arch-${id}`}>
          <path d={`${ARCH.d}Z`} />
        </clipPath>
      </defs>
      <rect width={200} height={250} fill={colours.wall} />
      <path d={`${ARCH.d}Z`} fill={colours.ground} />
      <path d={BORDER.d} {...dotted(64, colours.dots, 2.2)} opacity={0.75} />
      <g clipPath={`url(#arch-${id})`}>
        <g transform="translate(40 92)">
          <g data-motif>{children}</g>
        </g>
      </g>
    </svg>
  );
}
