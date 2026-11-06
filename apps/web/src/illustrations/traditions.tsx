import type { ReactNode } from 'react';
import { PALETTE as C } from '@/design-system/palette';
import type { WindowColours } from './ArchWindow';
import styles from './illustrations.module.css';
import { dotted, Flame, Marigold, SmallDiya, Sparkle } from './primitives';

/**
 * One motif per Scene 2 tradition (design/asset-manifest.md, SCN2-01…08).
 * Told with objects, architecture and light. Deities and gurus are never drawn
 * (design/illustration-spec.md § 2). Each motif is drawn for its own window
 * colours, so the two travel together.
 */

export interface WindowArt {
  colours: WindowColours;
  motif: ReactNode;
}

// SCN2-01 · Ayodhya: a riverside city wall and gate, lamps along every step.
const STEP_LAMPS: Array<[number, number[]]> = [
  [84, [10, 28, 92, 110]],
  [99, [6, 22, 38, 54, 70, 86, 102, 118]],
  [114, [14, 30, 46, 62, 78, 94, 110]],
];

const ghats: WindowArt = {
  colours: { wall: C.vermilion600, ground: C.jamun900, dots: C.marigold200 },
  motif: (
    <>
      <Sparkle x={22} y={2} r={3.2} wait={0.2} />
      <Sparkle x={98} y={-6} r={2.6} wait={1.1} />
      <Sparkle x={104} y={24} r={2} wait={0.6} />
      <rect x={0} y={60} width={120} height={24} fill={C.brass700} />
      <path d="M0 60H120" {...dotted(20, C.marigold400, 2)} />
      {[16, 104].map((x) => (
        <g key={x}>
          <rect x={x - 9} y={42} width={18} height={42} fill={C.brass500} />
          <path d={`M${x - 11} 44Q${x} 26 ${x + 11} 44Z`} fill={C.marigold500} />
          <path
            d={`M${x - 3} 60V54C${x - 3} 50 ${x + 3} 50 ${x + 3} 54V60Z`}
            fill={C.marigold200}
          />
        </g>
      ))}
      <path
        d="M40 84V46C40 34 51 27 55 21C58 16 59 11 60 4C61 11 62 16 65 21C69 27 80 34 80 46V84Z"
        fill={C.brass500}
      />
      <path d="M48 84V50C48 43 54 38 60 33C66 38 72 43 72 50V84Z" fill={C.jamun900} />
      <SmallDiya x={60} y={78} scale={0.8} wait={0.4} />
      <rect x={0} y={84} width={120} height={15} fill={C.ivory300} />
      <rect x={0} y={99} width={120} height={15} fill={C.brass400} />
      <rect x={0} y={114} width={120} height={12} fill={C.brass500} />
      {[84, 99, 114].map((y) => (
        <rect
          key={y}
          x={0}
          y={y + (y === 114 ? 10 : 13)}
          width={120}
          height={2}
          fill={C.brass700}
        />
      ))}
      {STEP_LAMPS.flatMap(([y, xs], row) =>
        xs.map((x, i) => (
          <SmallDiya
            key={`${y}-${x}`}
            x={x}
            y={y}
            scale={0.66}
            wait={(row * 0.37 + i * 0.29) % 1.7}
          />
        )),
      )}
      <rect x={0} y={126} width={120} height={24} fill={C.peacock700} />
      {[10, 30, 50, 70, 90, 110].map((x, i) => (
        <rect
          key={x}
          className={styles.shimmer}
          style={{ animationDelay: `${i * 0.31}s` }}
          x={x - 5}
          y={132 + (i % 2) * 5}
          width={10}
          height={1.8}
          rx={0.9}
          fill={C.marigold400}
        />
      ))}
    </>
  ),
};

// SCN2-02 · Lakshmi Puja: footprints drawn at the threshold, walking in.
const SOLE =
  'M6 22C2 34 3 50 7 62C10 72 9 80 9 86C10 93 20 94 22 86C23 78 22 70 24 60C27 48 28 34 24 22C21 12 10 12 6 22Z';
const TOES: Array<[number, number, number]> = [
  [9, 8, 5.2],
  [17.6, 4.4, 3.7],
  [23.8, 7.4, 3.1],
  [28, 12.2, 2.7],
  [30.6, 18.4, 2.3],
];

function Foot() {
  return (
    <>
      <path d={SOLE} fill={C.vermilion600} />
      {TOES.map(([x, y, r]) => (
        <circle key={x} cx={x} cy={y} r={r} fill={C.vermilion600} />
      ))}
      <path
        d={SOLE}
        transform="translate(15 54) scale(0.74) translate(-15 -54)"
        {...dotted(26, C.ivory50, 1.7)}
      />
    </>
  );
}

const footprints: WindowArt = {
  colours: { wall: C.gulab400, ground: C.ivory100, dots: C.vermilion600 },
  motif: (
    <>
      <g transform="translate(54 40) scale(-1 1)">
        <g className={styles.stepA}>
          <Foot />
        </g>
      </g>
      <g transform="translate(66 12)">
        <g className={styles.stepB}>
          <Foot />
        </g>
      </g>
      {[-16, -8, 0, 8, 16].map((dx) => (
        <circle key={dx} cx={60 + dx} cy={144 - Math.abs(dx) * 0.35} r={2.2} fill={C.marigold600} />
      ))}
    </>
  ),
};

// SCN2-03 · Naraka Chaturdashi: the sun rises over the oil pot of the dawn bath.
const dawn: WindowArt = {
  colours: { wall: C.peacock700, ground: C.marigold200, dots: C.peacock700 },
  motif: (
    <>
      <g className={styles.radiate}>
        {Array.from({ length: 11 }, (_, i) => {
          const a = (Math.PI * (i + 0.5)) / 11;
          const x1 = 60 - Math.cos(a) * 36;
          const y1 = 96 - Math.sin(a) * 36;
          const x2 = 60 - Math.cos(a) * 56;
          const y2 = 96 - Math.sin(a) * 56;
          return (
            <path
              key={i}
              d={`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`}
              stroke={C.vermilion500}
              strokeWidth={3.2}
              strokeLinecap="round"
            />
          );
        })}
      </g>
      <path d="M28 96A32 32 0 0 1 92 96Z" fill={C.vermilion500} />
      <rect x={0} y={96} width={120} height={54} fill={C.vermilion700} />
      <path d="M0 102H120" {...dotted(30, C.marigold200, 2)} />
      <ellipse cx={60} cy={137} rx={14} ry={3.2} fill={C.brass700} />
      <circle cx={60} cy={117} r={20} fill={C.brass500} />
      <path
        d="M41.5 112C52 118 68 118 78.5 112"
        stroke={C.marigold600}
        strokeWidth={3}
        fill="none"
      />
      <path d="M43 122C53 127 67 127 77 122" {...dotted(12, C.brass700, 2)} />
      <rect x={53} y={88} width={14} height={12} fill={C.brass500} />
      <ellipse cx={60} cy={88} rx={12} ry={3.6} fill={C.brass400} />
      <ellipse cx={60} cy={88} rx={7} ry={1.8} fill={C.brass700} />
      <Sparkle x={18} y={54} r={3} fill={C.vermilion500} wait={0.5} />
      <Sparkle x={102} y={44} r={2.4} fill={C.vermilion500} wait={1.4} />
    </>
  ),
};

// SCN2-04 · Kali Puja: fourteen lamps around a red hibiscus.
const HIBISCUS_PETAL = 'M0 0C-12 -6 -16 -21 -9 -29C-5 -33.5 5 -33.5 9 -29C16 -21 12 -6 0 0Z';

const fourteen: WindowArt = {
  colours: { wall: C.jamun700, ground: C.night900, dots: C.marigold400 },
  motif: (
    <>
      {Array.from({ length: 14 }, (_, i) => {
        const a = (2 * Math.PI * i) / 14 - Math.PI / 2;
        return (
          <SmallDiya
            key={i}
            x={60 + Math.cos(a) * 50}
            y={78 + Math.sin(a) * 58}
            scale={0.6}
            wait={(i * 0.23) % 1.7}
          />
        );
      })}
      <g transform="translate(60 80)">
        <g className={styles.breathe}>
          {[0, 72, 144, 216, 288].map((r) => (
            <g key={r} transform={`rotate(${r})`}>
              <path d={HIBISCUS_PETAL} fill={C.vermilion500} />
              <path
                d="M0 -4L0 -24"
                stroke={C.vermilion700}
                strokeWidth={1.4}
                strokeLinecap="round"
              />
            </g>
          ))}
          <circle r={5} fill={C.vermilion800} />
          <path d="M0 0C4 -8 10 -16 15 -26" stroke={C.marigold400} strokeWidth={2} fill="none" />
          {[
            [15, -26],
            [12, -28],
            [17.6, -23],
            [13.6, -22.6],
          ].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r={1.6} fill={C.marigold200} />
          ))}
        </g>
      </g>
    </>
  ),
};

// SCN2-05 · Mahavira's nirvana: one lamp on a lotus, its light radiating.
const LOTUS_PETAL = (top: number) =>
  `M0 ${top}C6 ${top + 7} 7 ${top + 16} 0 ${top + 26}C-7 ${top + 16} -6 ${top + 7} 0 ${top}Z`;

const lotusLamp: WindowArt = {
  colours: { wall: C.marigold500, ground: C.ivory50, dots: C.marigold600 },
  motif: (
    <>
      <g className={styles.radiate}>
        {Array.from({ length: 17 }, (_, i) => {
          const a = Math.PI + (Math.PI * i) / 16;
          const long = i % 2 === 0;
          const r1 = 24;
          const r2 = long ? 64 : 48;
          return (
            <path
              key={i}
              d={`M${(60 + Math.cos(a) * r1).toFixed(1)} ${(86 + Math.sin(a) * r1).toFixed(1)}L${(60 + Math.cos(a) * r2).toFixed(1)} ${(86 + Math.sin(a) * r2).toFixed(1)}`}
              stroke={C.marigold500}
              strokeWidth={long ? 2.2 : 1.4}
              strokeLinecap="round"
            />
          );
        })}
      </g>
      <g transform="translate(60 136)">
        {[-70, 70].map((r) => (
          <path key={r} d={LOTUS_PETAL(-30)} transform={`rotate(${r})`} fill={C.rani500} />
        ))}
        {[-36, 36].map((r) => (
          <path key={r} d={LOTUS_PETAL(-34)} transform={`rotate(${r})`} fill={C.gulab400} />
        ))}
        <path d={LOTUS_PETAL(-38)} fill={C.vermilion500} />
      </g>
      <rect x={20} y={134} width={80} height={4} rx={2} fill={C.peacock600} />
      <g transform="translate(60 100) scale(1.9)">
        <path d="M-10 -1C-8 5.6 8 5.6 10 -1Z" fill={C.vermilion600} />
        <path d="M-10 -1C-6 -2.8 6 -2.8 10 -1C6 0.3 -6 0.3 -10 -1Z" fill={C.maroon900} />
        <Flame x={0} y={-1.4} scale={1} />
      </g>
    </>
  ),
};

// SCN2-06 · Bandi Chhor Divas: Gwalior Fort's walls lit with lamps.
const fort: WindowArt = {
  colours: { wall: C.peacock600, ground: C.night900, dots: C.brass400 },
  motif: (
    <>
      <Sparkle x={26} y={10} r={2.8} wait={0.3} />
      <Sparkle x={94} y={2} r={3.2} wait={1.2} />
      <Sparkle x={60} y={26} r={2} wait={0.8} />
      <rect x={0} y={86} width={120} height={64} fill={C.brass500} />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={2 + i * 12} y={79} width={7} height={8} fill={C.brass500} />
      ))}
      {[6, 86].map((x) => (
        <g key={x}>
          <rect x={x} y={58} width={28} height={92} fill={C.marigold600} />
          <path d={`M${x - 2} 60Q${x + 14} 36 ${x + 30} 60Z`} fill={C.marigold500} />
          <path d={`M${x + 14} 41V34`} stroke={C.marigold500} strokeWidth={2} />
          <path
            d={`M${x + 8} 92V82C${x + 8} 76 ${x + 20} 76 ${x + 20} 82V92Z`}
            fill={C.marigold200}
          />
          <rect x={x - 2} y={60} width={32} height={3} fill={C.brass700} />
        </g>
      ))}
      <path d="M46 150V116C46 106 53 100 60 95C67 100 74 106 74 116V150Z" fill={C.night950} />
      <path
        d="M46 150V116C46 106 53 100 60 95C67 100 74 106 74 116V150"
        {...dotted(18, C.marigold200, 1.8)}
      />
      {[42, 52, 62, 72, 82].map((x, i) => (
        <SmallDiya key={x} x={x - 2} y={79} scale={0.56} wait={i * 0.33} />
      ))}
      <SmallDiya x={20} y={58} scale={0.56} wait={0.6} />
      <SmallDiya x={100} y={58} scale={0.56} wait={1.1} />
    </>
  ),
};

// SCN2-07 · Five days: an aarti thali with five lamps.
const thali: WindowArt = {
  colours: { wall: C.jamun900, ground: C.vermilion600, dots: C.marigold200 },
  motif: (
    <g transform="translate(60 92) scale(1.18) translate(-60 -100)">
      <ellipse cx={60} cy={112} rx={56} ry={22} fill={C.brass700} />
      <ellipse cx={60} cy={108} rx={56} ry={22} fill={C.brass500} />
      <ellipse cx={60} cy={108} rx={46} ry={16} fill={C.brass400} />
      <ellipse cx={60} cy={108} rx={51} ry={19} {...dotted(40, C.marigold200, 2)} />
      {[
        [24, 110],
        [96, 110],
        [60, 124],
      ].map(([x, y]) => (
        <Marigold key={`${x}`} x={x!} y={y!} r={5.4} />
      ))}
      <SmallDiya x={60} y={96} scale={1.15} wait={0.1} />
      <SmallDiya x={36} y={102} scale={1.15} wait={0.7} />
      <SmallDiya x={84} y={102} scale={1.15} wait={1.2} />
      <SmallDiya x={46} y={115} scale={1.15} wait={0.4} />
      <SmallDiya x={74} y={115} scale={1.15} wait={0.95} />
      <Sparkle x={16} y={56} r={3} fill={C.marigold200} wait={0.2} />
      <Sparkle x={104} y={48} r={2.4} fill={C.marigold200} wait={1} />
    </g>
  ),
};

// SCN2-08 · Tihar and the diaspora: a paper sky-lantern and marigold strings.
export function Lantern() {
  return (
    <g className={styles.sway}>
      <path d="M60 -64V22" stroke={C.ivory100} strokeWidth={1.2} />
      <path d="M52 30H68L65 22H55Z" fill={C.marigold600} />
      <path d="M60 30L88 54L80 88L60 100L40 88L32 54Z" fill={C.vermilion500} />
      <path d="M60 30L32 54L40 88L60 100Z" fill={C.vermilion700} />
      <path d="M60 40L76 58L60 88L44 58Z" fill={C.marigold400} />
      <path d="M60 50L68 61L60 78L52 61Z" fill={C.ivory50} />
      <path d="M32 54H88" stroke={C.marigold200} strokeWidth={1.4} />
      <path d="M40 88H80" stroke={C.marigold200} strokeWidth={1.4} />
      {[44, 50, 56, 62, 68, 74].map((x, i) => (
        <g key={x}>
          <path
            d={`M${x + 1} 94V${126 + (i % 2) * 6}`}
            stroke={i % 2 ? C.rani500 : C.marigold400}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <circle cx={x + 1} cy={128 + (i % 2) * 6} r={1.8} fill={C.marigold200} />
        </g>
      ))}
    </g>
  );
}

function MarigoldString({ x, length, late }: { x: number; length: number; late?: boolean }) {
  return (
    <g className={late ? styles.swayLate : styles.sway}>
      <path d={`M${x} -64V${-64 + length}`} stroke={C.peacock300} strokeWidth={1} />
      {Array.from({ length: Math.floor(length / 11) }, (_, i) => (
        <Marigold key={i} x={x} y={-58 + i * 11} r={4.6} />
      ))}
    </g>
  );
}

const lantern: WindowArt = {
  colours: { wall: C.marigold600, ground: C.peacock700, dots: C.marigold200 },
  motif: (
    <>
      <MarigoldString x={14} length={130} />
      <MarigoldString x={106} length={130} late />
      <Lantern />
    </>
  ),
};

export const TRADITION_ART: Record<string, WindowArt> = {
  ayodhya: ghats,
  lakshmi: footprints,
  narakasura: dawn,
  kali: fourteen,
  mahavira: lotusLamp,
  'bandi-chhor': fort,
  'five-days': thali,
  beyond: lantern,
};
