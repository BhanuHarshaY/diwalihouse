import { PALETTE as C } from '@/design-system/palette';
import styles from './illustrations.module.css';
import { dotted, Sparkle } from './primitives';
import { RangoliAll } from './rangoli';
import type { WindowArt } from './traditions';

/** One window per room of the house (design/asset-manifest.md, ROOM-*). */

const HEART =
  'M0 6C-9 -2 -9 -10 -3.8 -10C-1.6 -10 0 -8.6 0 -6.8C0 -8.6 1.6 -10 3.8 -10C9 -10 9 -2 0 6Z';
const SPADE =
  'M0 -10C9 -2 9 6 3.6 6C1.8 6 0.6 5 0 3.6C-0.6 5 -1.8 6 -3.6 6C-9 6 -9 -2 0 -10ZM0 2L3.4 10H-3.4Z';
const DIAMOND = 'M0 -10L7 0L0 10L-7 0Z';

function Card({ angle, pip, ink }: { angle: number; pip: string; ink: string }) {
  return (
    <g transform={`rotate(${angle} 60 136)`}>
      <rect x={38} y={52} width={44} height={64} rx={5} fill={C.ivory50} />
      <rect
        x={42}
        y={56}
        width={36}
        height={56}
        rx={3}
        fill="none"
        stroke={C.brass500}
        strokeWidth={1.2}
      />
      <path d={pip} transform="translate(60 84) scale(1.3)" fill={ink} />
      <path d={pip} transform="translate(47 63) scale(0.45)" fill={ink} />
    </g>
  );
}

function Chip({ x, y, face }: { x: number; y: number; face: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cy={3} rx={15} ry={5} fill={C.night950} opacity={0.35} />
      <circle r={13} fill={face} />
      <circle r={10} {...dotted(16, C.ivory50, 2.6)} />
      <circle r={4} fill={C.marigold400} />
    </g>
  );
}

const cardRoom: WindowArt = {
  colours: { wall: C.peacock700, ground: C.vermilion600, dots: C.marigold200 },
  motif: (
    <>
      <g className={styles.breathe}>
        <Card angle={-22} pip={HEART} ink={C.vermilion600} />
        <Card angle={22} pip={DIAMOND} ink={C.vermilion600} />
        <Card angle={0} pip={SPADE} ink={C.night900} />
      </g>
      <Chip x={30} y={134} face={C.jamun700} />
      <Chip x={88} y={138} face={C.peacock600} />
      <Chip x={88} y={131} face={C.night700} />
    </>
  ),
};

const MARKED = new Set([1, 5, 10, 12, 16, 20, 24]);

const bazaar: WindowArt = {
  colours: { wall: C.marigold500, ground: C.jamun700, dots: C.marigold200 },
  motif: (
    <>
      <g className={styles.bob}>
        <circle cx={60} cy={26} r={20} fill={C.marigold500} />
        <circle cx={60} cy={26} r={13} fill={C.ivory50} />
        <text
          x={60}
          y={32}
          textAnchor="middle"
          fontSize={17}
          fill={C.vermilion700}
          style={{ fontFamily: 'var(--font-story)' }}
        >
          २७
        </text>
      </g>
      <rect x={6} y={68} width={108} height={60} rx={3} fill={C.ivory50} />
      {Array.from({ length: 27 }, (_, i) => {
        const col = i % 9;
        const row = Math.floor(i / 9);
        const x = 10 + col * 11.2;
        const y = 72 + row * 17.6;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={10}
              height={16}
              fill="none"
              stroke={C.brass500}
              strokeWidth={0.8}
            />
            {MARKED.has(i) ? (
              <circle cx={x + 5} cy={y + 8} r={4.2} fill={C.vermilion500} />
            ) : (i * 7) % 3 === 0 ? (
              <rect x={x + 3} y={y + 6} width={4} height={4} fill={C.night700} />
            ) : null}
          </g>
        );
      })}
      <Sparkle x={18} y={146} r={3} fill={C.marigold400} wait={0.4} />
      <Sparkle x={102} y={144} r={2.4} fill={C.marigold400} wait={1.2} />
    </>
  ),
};

function Note({ x, y, wait }: { x: number; y: number; wait: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={styles.rise} style={{ animationDelay: `${wait}s` }}>
        <ellipse cx={0} cy={0} rx={4} ry={3} transform="rotate(-20)" fill={C.ivory50} />
        <path d="M3.4 -1V-14L9 -11" stroke={C.ivory50} strokeWidth={1.6} fill="none" />
      </g>
    </g>
  );
}

const mehfil: WindowArt = {
  colours: { wall: C.jamun700, ground: C.gulab400, dots: C.ivory50 },
  motif: (
    <>
      <Note x={30} y={40} wait={0} />
      <Note x={48} y={28} wait={1.2} />
      <Note x={20} y={58} wait={2.3} />
      <rect x={24} y={112} width={76} height={30} fill={C.vermilion800} />
      <rect x={24} y={112} width={76} height={4} fill={C.brass500} />
      <rect
        x={30}
        y={122}
        width={64}
        height={14}
        fill="none"
        stroke={C.brass500}
        strokeWidth={1.2}
      />
      <ellipse cx={62} cy={110} rx={34} ry={7} fill={C.night950} />
      <ellipse cx={62} cy={110} rx={22} ry={4.4} fill="none" stroke={C.night700} strokeWidth={1} />
      <ellipse cx={62} cy={110} rx={6} ry={1.6} fill={C.marigold500} />
      <path d="M88 104L72 108" stroke={C.brass400} strokeWidth={2.2} strokeLinecap="round" />
      <path
        d="M90 104C92 86 82 66 62 52C50 44 32 38 22 42C16 54 24 74 42 84C58 92 76 98 84 106Z"
        fill={C.brass500}
      />
      <path d="M22 42C16 54 24 74 42 84C34 70 28 54 22 42Z" fill={C.brass700} />
      <ellipse
        cx={28}
        cy={60}
        rx={8}
        ry={20}
        transform="rotate(-30 28 60)"
        fill={C.marigold200}
        opacity={0.35}
      />
      <rect x={20} y={142} width={84} height={4} fill={C.vermilion800} />
    </>
  ),
};

const courtyard: WindowArt = {
  colours: { wall: C.vermilion700, ground: C.ivory100, dots: C.vermilion600 },
  motif: (
    <g transform="translate(60 72) scale(0.2)">
      <g className={styles.spin}>
        <RangoliAll />
      </g>
    </g>
  ),
};

const daak: WindowArt = {
  colours: { wall: C.night700, ground: C.marigold200, dots: C.vermilion600 },
  motif: (
    <>
      <g className={styles.bob}>
        <g transform="rotate(14 88 28)">
          <rect x={70} y={16} width={38} height={26} rx={2} fill={C.ivory50} />
          <path d="M70 16L89 31L108 16" stroke={C.brass500} strokeWidth={1.4} fill="none" />
          <rect x={96} y={20} width={8} height={9} fill={C.vermilion500} />
          <rect x={97.5} y={21.5} width={5} height={6} {...dotted(10, C.ivory50, 1)} />
        </g>
      </g>
      <path d="M36 62C36 44 84 44 84 62Z" fill={C.vermilion600} />
      <rect x={36} y={62} width={48} height={78} fill={C.vermilion600} />
      <rect x={34} y={60} width={52} height={5} fill={C.vermilion800} />
      <rect x={46} y={74} width={28} height={4} rx={2} fill={C.night950} />
      <rect x={44} y={88} width={32} height={20} fill={C.ivory100} />
      <path d="M48 94H72M48 98H68M48 102H70" stroke={C.vermilion700} strokeWidth={1.2} />
      <rect x={32} y={138} width={56} height={8} fill={C.vermilion800} />
      <circle cx={60} cy={45} r={3} fill={C.vermilion800} />
    </>
  ),
};

export const ROOM_ART: Record<string, WindowArt> = {
  'card-room': cardRoom,
  bazaar,
  mehfil,
  courtyard,
  daak,
};
