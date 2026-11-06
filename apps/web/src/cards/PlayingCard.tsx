import type { Card } from '@diwali/teen-patti';
import { cuspedArch } from '@/design-system/geometry/arch';
import { PALETTE as C } from '@/design-system/palette';
import { dotted } from '@/illustrations/primitives';
import styles from './cards.module.css';

/**
 * Playing cards, drawn in code (design/asset-manifest.md, CARD-01). Faces
 * are ivory with a brass inset rule; court cards stand in a small arch
 * window; the back is a vermilion door with a lamp. 60 × 84 grid.
 */

const PIPS = {
  h: 'M0 6C-9 -2 -9 -10 -3.8 -10C-1.6 -10 0 -8.6 0 -6.8C0 -8.6 1.6 -10 3.8 -10C9 -10 9 -2 0 6Z',
  d: 'M0 -10L7 0L0 10L-7 0Z',
  s: 'M0 -10C9 -2 9 6 3.6 6C1.8 6 0.6 5 0 3.6C-0.6 5 -1.8 6 -3.6 6C-9 6 -9 -2 0 -10ZM0 2L3.4 10H-3.4Z',
  c: 'M0 -10.5A4.4 4.4 0 1 1 0 -1.7A4.4 4.4 0 1 1 0 -1.7ZM-4.6 -2.2A4.4 4.4 0 1 1 -4.59 -2.2ZM4.6 -2.2A4.4 4.4 0 1 1 4.61 -2.2ZM0 1L3.2 10H-3.2Z',
} as const;

const SUIT_NAME = { h: 'hearts', d: 'diamonds', s: 'spades', c: 'clubs' } as const;
const RANK_NAME: Record<string, string> = {
  A: 'Ace',
  K: 'King',
  Q: 'Queen',
  J: 'Jack',
  T: '10',
};

function Pip({
  suit,
  x,
  y,
  scale,
}: {
  suit: keyof typeof PIPS;
  x: number;
  y: number;
  scale: number;
}) {
  const ink = suit === 'h' || suit === 'd' ? C.vermilion600 : C.night900;
  if (suit === 'c') {
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`} fill={ink}>
        <circle cx={0} cy={-5.6} r={4.3} />
        <circle cx={-4.8} cy={1.4} r={4.3} />
        <circle cx={4.8} cy={1.4} r={4.3} />
        <path d="M0 0L3.2 10H-3.2Z" />
      </g>
    );
  }
  return <path d={PIPS[suit]} transform={`translate(${x} ${y}) scale(${scale})`} fill={ink} />;
}

const COURT_ARCH = cuspedArch({
  cx: 30,
  baseY: 66,
  springY: 36,
  apexY: 18,
  halfWidth: 15,
  lobes: 3,
});

function Face({ card }: { card: Card }) {
  const rank = card[0]!;
  const suit = card[1] as keyof typeof PIPS;
  const red = suit === 'h' || suit === 'd';
  const ink = red ? C.vermilion600 : C.night900;
  const label = rank === 'T' ? '10' : rank;
  const court = rank === 'K' || rank === 'Q' || rank === 'J';
  return (
    <>
      <rect width={60} height={84} rx={5} fill={C.ivory50} />
      <rect
        x={3}
        y={3}
        width={54}
        height={78}
        rx={3}
        fill="none"
        stroke={C.brass500}
        strokeWidth={0.8}
      />
      <text x={7} y={15} fontSize={11} fill={ink} style={{ fontFamily: 'var(--font-masthead)' }}>
        {label}
      </text>
      <Pip suit={suit} x={9.5} y={22.5} scale={0.42} />
      <g transform="rotate(180 30 42)">
        <text x={7} y={15} fontSize={11} fill={ink} style={{ fontFamily: 'var(--font-masthead)' }}>
          {label}
        </text>
        <Pip suit={suit} x={9.5} y={22.5} scale={0.42} />
      </g>
      {court ? (
        <>
          <path d={`${COURT_ARCH.d}Z`} fill={red ? C.gulab400 : C.peacock300} opacity={0.35} />
          <path d={COURT_ARCH.d} {...dotted(26, C.brass500, 1)} />
          <path d="M23 38L25 31L28 35L30 29L32 35L35 31L37 38Z" fill={C.marigold500} />
          <text
            x={30}
            y={56}
            textAnchor="middle"
            fontSize={17}
            fill={ink}
            style={{ fontFamily: 'var(--font-masthead)' }}
          >
            {label}
          </text>
        </>
      ) : rank === 'A' ? (
        <>
          <circle cx={30} cy={42} r={14} {...dotted(28, C.brass500, 1.4)} />
          <Pip suit={suit} x={30} y={42} scale={1.25} />
        </>
      ) : (
        <Pip suit={suit} x={30} y={42} scale={1.05} />
      )}
    </>
  );
}

const BACK_ARCH = cuspedArch({
  cx: 30,
  baseY: 70,
  springY: 36,
  apexY: 14,
  halfWidth: 17,
  lobes: 3,
});

function Back() {
  return (
    <>
      <rect width={60} height={84} rx={5} fill={C.vermilion600} />
      <rect x={3.5} y={3.5} width={53} height={77} rx={3} {...dotted(70, C.marigold200, 1.4)} />
      <path d={`${BACK_ARCH.d}Z`} fill={C.jamun900} />
      <path d={BACK_ARCH.d} fill="none" stroke={C.brass400} strokeWidth={1} />
      <path d="M21 58C24 63 36 63 39 58Z" fill={C.vermilion500} />
      <path
        d="M30 42C32.4 46 34 48.6 34 51.4C34 54.2 32.2 56 30 56C27.8 56 26 54.2 26 51.4C26 48.6 27.6 46 30 42Z"
        fill={C.marigold500}
      />
      <path
        d="M30 48C31 50 31.6 51.2 31.6 52.4C31.6 53.6 30.9 54.4 30 54.4C29.1 54.4 28.4 53.6 28.4 52.4C28.4 51.2 29 50 30 48Z"
        fill={C.ivory50}
      />
    </>
  );
}

export function cardName(card: Card): string {
  const rank = card[0]!;
  return `${RANK_NAME[rank] ?? rank} of ${SUIT_NAME[card[1] as keyof typeof SUIT_NAME]}`;
}

/** A card that can flip from its back to its face. */
export function PlayingCard({
  card,
  size = 'md',
  dealtIndex = 0,
}: {
  /** null shows the back. */
  card: Card | null;
  size?: 'sm' | 'md' | 'lg';
  dealtIndex?: number;
}) {
  return (
    <div
      className={styles.card}
      data-size={size}
      data-face={card ? '' : undefined}
      style={{ ['--deal-i' as string]: dealtIndex }}
      role="img"
      aria-label={card ? cardName(card) : 'Face-down card'}
    >
      <div className={styles.cardInner}>
        <svg viewBox="0 0 60 84" className={styles.cardBack} aria-hidden focusable="false">
          <Back />
        </svg>
        <svg viewBox="0 0 60 84" className={styles.cardFace} aria-hidden focusable="false">
          {card ? <Face card={card} /> : null}
        </svg>
      </div>
    </div>
  );
}
