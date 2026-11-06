import { PALETTE as C } from '@/design-system/palette';
import { dotted } from '@/illustrations/primitives';
import styles from './mehfil.module.css';

/**
 * The Mehfil's turntable, seen from above: a shellac record on a carved
 * plinth with a brass tonearm. The record turns at 33⅓ while music plays;
 * at rest, and with reduced motion, it is a finished still.
 */
export function Record({ spinning }: { spinning: boolean }) {
  const grooves = [72, 65, 58, 51, 44, 37];
  return (
    <svg viewBox="0 0 200 200" className={styles.record} aria-hidden>
      <rect x="6" y="6" width="188" height="188" rx="10" fill={C.maroon800} />
      <rect
        x="13"
        y="13"
        width="174"
        height="174"
        rx="6"
        fill="none"
        stroke={C.brass500}
        strokeWidth="1.5"
      />
      <circle cx="96" cy="100" r="84" fill={C.maroon900} />
      <circle cx="96" cy="100" r="84" {...dotted(48, C.brass400, 2.2)} />
      <g className={styles.disc} data-spinning={spinning || undefined}>
        <circle cx="96" cy="100" r="78" fill={C.night950} />
        {grooves.map((r) => (
          <circle
            key={r}
            cx="96"
            cy="100"
            r={r}
            fill="none"
            stroke={C.night800}
            strokeWidth="1.3"
          />
        ))}
        <circle cx="96" cy="100" r="25" fill={C.vermilion600} />
        <circle cx="96" cy="100" r="25" fill="none" stroke={C.marigold400} strokeWidth="2" />
        <circle cx="96" cy="100" r="18" {...dotted(14, C.marigold200, 2.4)} />
        {/* One petal on the label, so the turning shows. */}
        <path d="M96 79c5 4 5 9 0 13c-5-4-5-9 0-13Z" fill={C.marigold400} />
        <circle cx="96" cy="100" r="3" fill={C.ivory50} />
      </g>
      <circle cx="166" cy="38" r="12" fill={C.brass700} />
      <circle cx="166" cy="38" r="5.5" fill={C.brass400} />
      <path
        d="M166 38L152 112L134 130"
        fill="none"
        stroke={C.brass400}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="124"
        y="124"
        width="16"
        height="10"
        rx="2"
        fill={C.brass500}
        transform="rotate(-45 132 129)"
      />
    </svg>
  );
}
