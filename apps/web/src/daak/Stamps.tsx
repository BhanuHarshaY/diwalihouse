import type { StampId } from '@diwali/contracts';
import { useId, type ReactNode } from 'react';
import { PALETTE as C } from '@/design-system/palette';
import { dotted, Marigold, SmallDiya, Sparkle } from '@/illustrations/primitives';
import { Lantern } from '@/illustrations/traditions';
import styles from './daak.module.css';

/**
 * The Daak's stamps: six original designs, one flat motif each on a
 * saturated ground, drawn from the house's own illustration pieces. Printed
 * stamps hold still: these never animate.
 */

interface StampArt {
  name: string;
  ground: string;
  rule: string;
  motif: ReactNode;
}

export const STAMP_ART: Record<StampId, StampArt> = {
  diya: {
    name: 'Diya',
    ground: C.vermilion700,
    rule: C.marigold200,
    motif: (
      <>
        <circle cx="30" cy="36" r="19" fill={C.vermilion600} />
        <circle cx="30" cy="36" r="19" {...dotted(24, C.marigold400, 1.8)} />
        <SmallDiya x={30} y={44} scale={1.7} clay={C.marigold600} />
      </>
    ),
  },
  kandil: {
    name: 'Kandil',
    ground: C.jamun700,
    rule: C.gulab400,
    motif: (
      <g transform="translate(30 7) scale(0.5) translate(-60 -22)">
        <Lantern />
      </g>
    ),
  },
  genda: {
    name: 'Genda',
    ground: C.peacock700,
    rule: C.marigold200,
    motif: (
      <>
        <path d="M30 40C22 44 14 52 12 62C20 58 26 52 30 40Z" fill={C.peacock300} />
        <path d="M30 40C38 44 46 52 48 62C40 58 34 52 30 40Z" fill={C.peacock500} />
        <Marigold x={30} y={30} r={13} />
        <Marigold x={15} y={52} r={6.5} />
        <Marigold x={45} y={52} r={6.5} />
      </>
    ),
  },
  rangoli: {
    name: 'Rangoli',
    ground: C.night800,
    rule: C.brass400,
    motif: (
      <g transform="translate(30 36)">
        <circle r="22" fill="none" stroke={C.brass500} strokeWidth="1.2" />
        <circle r="19" {...dotted(32, C.ivory100, 1.8)} />
        {Array.from({ length: 8 }, (_, i) => (
          <g key={i} transform={`rotate(${i * 45})`}>
            <path d="M0 -4C5 -7 5 -13 0 -16C-5 -13 -5 -7 0 -4Z" fill={C.vermilion500} />
            <path d="M0 -6C2.5 -8 2.5 -11 0 -13C-2.5 -11 -2.5 -8 0 -6Z" fill={C.marigold400} />
          </g>
        ))}
        <circle r="4" fill={C.marigold500} />
        <circle r="1.6" fill={C.ivory50} />
      </g>
    ),
  },
  phuljhadi: {
    name: 'Phuljhadi',
    ground: C.night900,
    rule: C.marigold200,
    motif: (
      <>
        <path d="M16 62L37 27" stroke={C.brass500} strokeWidth="2" strokeLinecap="round" />
        <path d="M16 62L22 52" stroke={C.mitti300} strokeWidth="3.4" strokeLinecap="round" />
        <g
          transform="translate(38 25)"
          stroke={C.marigold400}
          strokeWidth="1.3"
          strokeLinecap="round"
        >
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const inner = 4;
            const outer = i % 2 ? 11 : 15;
            return (
              <path
                key={i}
                d={`M${(Math.cos(a) * inner).toFixed(1)} ${(Math.sin(a) * inner).toFixed(1)}L${(Math.cos(a) * outer).toFixed(1)} ${(Math.sin(a) * outer).toFixed(1)}`}
              />
            );
          })}
        </g>
        <circle cx="38" cy="25" r="3.2" fill={C.ivory50} />
        <Sparkle x={20} y={20} r={4} fill={C.marigold200} />
        <Sparkle x={50} y={44} r={3.4} fill={C.ivory50} />
      </>
    ),
  },
  mithai: {
    name: 'Mithai',
    ground: C.maroon800,
    rule: C.marigold200,
    motif: (
      <>
        <ellipse cx="30" cy="56" rx="22" ry="5" fill={C.brass700} />
        <ellipse cx="30" cy="54.5" rx="20" ry="4" fill={C.brass500} />
        {[
          [18, 46],
          [30, 46],
          [42, 46],
          [24, 35],
          [36, 35],
          [30, 24],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r="6.4" fill={C.marigold500} />
            <circle cx={x! - 1.6} cy={y! - 1.8} r="1" fill={C.marigold200} />
            <circle cx={x! + 2} cy={y! + 0.6} r="0.9" fill={C.marigold700} />
            <circle cx={x! - 0.4} cy={y! + 2.6} r="0.8" fill={C.marigold200} />
          </g>
        ))}
        <path d="M27 17.5L30 14L33 17.5" fill="none" stroke={C.ivory100} strokeWidth="1.2" />
      </>
    ),
  },
};

/** A perforated stamp with one design. */
export function Stamp({ id, className }: { id: StampId; className?: string | undefined }) {
  const art = STAMP_ART[id];
  const clip = useId();
  return (
    <span className={[styles.stamp, className].filter(Boolean).join(' ')} aria-hidden>
      <svg viewBox="0 0 60 72" className={styles.stampArt}>
        <clipPath id={clip}>
          <rect width="60" height="72" />
        </clipPath>
        <g clipPath={`url(#${clip})`}>
          <rect width="60" height="72" fill={art.ground} />
          {art.motif}
          <rect
            x="3.5"
            y="3.5"
            width="53"
            height="65"
            fill="none"
            stroke={art.rule}
            strokeWidth="0.9"
          />
        </g>
      </svg>
    </span>
  );
}

/** The cancellation over a stamp: a ring with the day and time, and wavy lines. */
export function Postmark({ when }: { when: string | null }) {
  return (
    <svg viewBox="0 0 120 64" className={styles.postmark} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="32" cy="32" r="27" />
        <circle cx="32" cy="32" r="21" strokeWidth="0.9" />
        {[22, 30, 38].map((y) => (
          <path key={y} d={`M62 ${y}c6 -4 10 4 16 0s10 4 16 0s10 4 16 0`} />
        ))}
      </g>
      <text x="32" y="28" textAnchor="middle" className={styles.postmarkText}>
        DIWALI
      </text>
      <text x="32" y="40" textAnchor="middle" className={styles.postmarkText}>
        {when ?? 'DAAK'}
      </text>
    </svg>
  );
}
