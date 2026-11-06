import type { CSSProperties } from 'react';
import { PALETTE as C } from '@/design-system/palette';
import styles from './illustrations.module.css';
import { dotted, Marigold, SmallDiya } from './primitives';

/**
 * People, built from a spec rather than drawn one by one, so every figure
 * shares the same proportions, line weights and face.
 *
 * Construction (design/illustration-spec.md § People):
 *  - A 100-unit-wide box, feet on `footY`. Adults are ~6 heads tall,
 *    children ~4, after the chunky proportions of the poster references.
 *  - Flat garments with one trim colour; pattern lives at hems and borders.
 *  - One face for everyone: closed, smiling eyes and a small smile, as in
 *    miniature painting, so no one is caricatured. Identity comes from
 *    hair, dress, skin tone and what they carry.
 */

type Pt = readonly [number, number];

interface Body {
  headY: number;
  r: number;
  neckTop: number;
  shoulderY: number;
  half: number;
  waistY: number;
  kneeY: number;
  footY: number;
  arm: number;
}

const ADULT: Body = {
  headY: 40,
  r: 15,
  neckTop: 50,
  shoulderY: 68,
  half: 19,
  waistY: 126,
  kneeY: 186,
  footY: 246,
  arm: 1,
};

const CHILD: Body = {
  headY: 40,
  r: 14,
  neckTop: 49,
  shoulderY: 63,
  half: 14,
  waistY: 102,
  kneeY: 134,
  footY: 170,
  arm: 0.72,
};

export type Pose = 'down' | 'hold' | 'raise' | 'wave' | 'cane' | 'selfie';

export type Hair =
  'bun' | 'long' | 'braid' | 'short' | 'curly' | 'balding' | 'pigtails' | 'dastar' | 'hijab';

export type Outfit =
  | { kind: 'kurta'; color: string; trim: string; legs: string; jacket?: string; shawl?: string }
  | { kind: 'saree'; blouse: string; saree: string; shade: string; border: string }
  | { kind: 'lehenga'; choli: string; skirt: string; band: string; dupatta: string }
  | { kind: 'kurti'; color: string; trim: string; legs: string }
  | { kind: 'frock'; color: string; trim: string };

export type Holding = 'sparkler' | 'diya' | 'thali' | 'sweets' | 'gift' | 'phone' | 'cane';

export interface PersonSpec {
  size: 'adult' | 'child';
  skin: string;
  hair: { style: Hair; color: string; accent?: string };
  outfit: Outfit;
  arms: { left: Pose; right: Pose; sleeves: 'long' | 'short' };
  holding?: Holding;
  face?: {
    bindi?: boolean;
    mustache?: boolean;
    beard?: boolean;
    glasses?: boolean;
    earrings?: boolean;
    /** Beard and moustache colour when it differs from the hair (e.g. under a dastar). */
    whiskers?: string;
  };
}

const f = (n: number) => Math.round(n * 10) / 10;
const pt = ([x, y]: Pt) => `${f(x)} ${f(y)}`;

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

function armPoints(b: Body, side: -1 | 1, pose: Pose): [Pt, Pt, Pt] {
  const s: Pt = [50 + side * (b.half - 1.5), b.shoulderY + 3];
  const a = b.arm;
  const at = (dx: number, dy: number): Pt => [s[0] + side * dx * a, s[1] + dy * a];
  switch (pose) {
    case 'down':
      return [s, at(5, 40), at(3, 77)];
    case 'hold':
      return [s, at(5, 37), [50 + side * 8, s[1] + 44 * a]];
    case 'raise':
      return [s, at(13, 21), at(16, -10)];
    case 'wave':
      return [s, at(18, 12), at(20, -20)];
    case 'cane':
      return [s, at(7, 38), at(13, 72)];
    case 'selfie':
      return [s, at(18, 18), at(10, -14)];
  }
}

/** Shoulders-to-hem garment shape with rounded shoulders. */
function tunic(b: Body, hemY: number, hemHalf: number): string {
  const y = b.shoulderY;
  const h = b.half;
  return (
    `M${50 - h} ${y + 4}C${50 - h} ${y - 2} ${f(50 - h * 0.45)} ${y - 5} 50 ${y - 5}` +
    `C${f(50 + h * 0.45)} ${y - 5} ${50 + h} ${y - 2} ${50 + h} ${y + 4}` +
    `L${50 + hemHalf} ${hemY}C${f(50 + hemHalf * 0.4)} ${hemY + 3} ${f(50 - hemHalf * 0.4)} ${hemY + 3} ${50 - hemHalf} ${hemY}Z`
  );
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

function Arm({
  points,
  sleeve,
  skin,
  sleeves,
  className,
}: {
  points: [Pt, Pt, Pt];
  sleeve: string;
  skin: string;
  sleeves: 'long' | 'short';
  className?: string | undefined;
}) {
  const [s, e, h] = points;
  const d = `M${pt(s)}L${pt(e)}L${pt(h)}`;
  const stub: Pt = [s[0] + (e[0] - s[0]) * 0.38, s[1] + (e[1] - s[1]) * 0.38];
  return (
    <g className={className}>
      {sleeves === 'long' ? (
        <path
          d={d}
          fill="none"
          stroke={sleeve}
          strokeWidth={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <path
            d={d}
            fill="none"
            stroke={skin}
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={`M${pt(s)}L${pt(stub)}`}
            stroke={sleeve}
            strokeWidth={11}
            strokeLinecap="round"
          />
        </>
      )}
      <circle cx={f(h[0])} cy={f(h[1])} r={5} fill={skin} />
    </g>
  );
}

function Garment({ b, outfit, skin }: { b: Body; outfit: Outfit; skin: string }) {
  switch (outfit.kind) {
    case 'kurta': {
      const hemHalf = b.half + 4;
      return (
        <>
          <rect
            x={39}
            y={b.kneeY - 6}
            width={9.5}
            height={b.footY - b.kneeY + 2}
            fill={outfit.legs}
          />
          <rect
            x={51.5}
            y={b.kneeY - 6}
            width={9.5}
            height={b.footY - b.kneeY + 2}
            fill={outfit.legs}
          />
          <ellipse cx={43.5} cy={b.footY} rx={6.5} ry={3} fill={C.maroon800} />
          <ellipse cx={56.5} cy={b.footY} rx={6.5} ry={3} fill={C.maroon800} />
          <path d={tunic(b, b.kneeY, hemHalf)} fill={outfit.color} />
          <path
            d={`M${50 - hemHalf + 3} ${b.kneeY - 3}H${50 + hemHalf - 3}`}
            {...dotted(14, outfit.trim, 2)}
          />
          <path
            d={`M45 ${b.shoulderY - 4}L50 ${b.shoulderY + 4}L55 ${b.shoulderY - 4}`}
            fill="none"
            stroke={outfit.trim}
            strokeWidth={1.6}
          />
          <path
            d={`M50 ${b.shoulderY + 4}V${b.shoulderY + 34}`}
            stroke={outfit.trim}
            strokeWidth={1.4}
          />
          {outfit.jacket ? (
            <path
              d={`M${50 - b.half} ${b.shoulderY + 3}L45 ${b.shoulderY - 4}L50 ${b.shoulderY + 20}L55 ${b.shoulderY - 4}L${50 + b.half} ${b.shoulderY + 3}L${50 + b.half + 2} ${b.waistY + 16}L${50 - b.half - 2} ${b.waistY + 16}Z`}
              fill={outfit.jacket}
            />
          ) : null}
          {outfit.jacket
            ? [12, 22, 32].map((dy) => (
                <circle key={dy} cx={53.5} cy={b.shoulderY + 14 + dy} r={1.4} fill={C.brass400} />
              ))
            : null}
          {outfit.shawl ? (
            <>
              <path
                d={`M${50 - b.half + 1} ${b.shoulderY - 2}H${50 - b.half + 10}V${b.shoulderY + 74}H${50 - b.half + 1}Z`}
                fill={outfit.shawl}
              />
              <path
                d={`M${50 + b.half - 10} ${b.shoulderY - 2}H${50 + b.half - 1}V${b.shoulderY + 74}H${50 + b.half - 10}Z`}
                fill={outfit.shawl}
              />
              <path
                d={`M${50 - b.half - 2} ${b.shoulderY + 1}C${50 - b.half} ${b.shoulderY - 6} ${50 + b.half} ${b.shoulderY - 6} ${50 + b.half + 2} ${b.shoulderY + 1}`}
                fill="none"
                stroke={outfit.shawl}
                strokeWidth={7}
                strokeLinecap="round"
              />
            </>
          ) : null}
        </>
      );
    }
    case 'kurti': {
      const hemY = b.waistY + 36;
      return (
        <>
          <rect x={39} y={hemY - 6} width={9.5} height={b.footY - hemY + 3} fill={outfit.legs} />
          <rect x={51.5} y={hemY - 6} width={9.5} height={b.footY - hemY + 3} fill={outfit.legs} />
          <ellipse cx={43} cy={b.footY} rx={7} ry={3.4} fill={C.ivory50} />
          <ellipse cx={57} cy={b.footY} rx={7} ry={3.4} fill={C.ivory50} />
          <path d={tunic(b, hemY, b.half + 6)} fill={outfit.color} />
          <path
            d={`M${50 - b.half - 3} ${hemY - 3}H${50 + b.half + 3}`}
            {...dotted(14, outfit.trim, 2.2)}
          />
          <path
            d={`M44 ${b.shoulderY - 4}Q50 ${b.shoulderY + 6} 56 ${b.shoulderY - 4}`}
            fill="none"
            stroke={outfit.trim}
            strokeWidth={2}
          />
        </>
      );
    }
    case 'frock': {
      const hemY = b.waistY + 28;
      return (
        <>
          <rect x={42} y={hemY - 4} width={6} height={b.footY - hemY + 1} fill={skin} />
          <rect x={52} y={hemY - 4} width={6} height={b.footY - hemY + 1} fill={skin} />
          <ellipse cx={44.5} cy={b.footY} rx={5.5} ry={2.8} fill={C.maroon800} />
          <ellipse cx={55.5} cy={b.footY} rx={5.5} ry={2.8} fill={C.maroon800} />
          <path d={tunic(b, hemY, b.half + 13)} fill={outfit.color} />
          <path
            d={`M${50 - b.half - 10} ${hemY - 3}H${50 + b.half + 10}`}
            {...dotted(16, outfit.trim, 2.4)}
          />
          <path
            d={`M${50 - b.half + 2} ${b.waistY - 6}H${50 + b.half - 2}`}
            stroke={outfit.trim}
            strokeWidth={3}
          />
        </>
      );
    }
    case 'lehenga': {
      const top = b.waistY - 12;
      const h = b.half;
      const skirt =
        `M${50 - (h - 2)} ${top}C${50 - (h + 2)} ${f(top + (b.footY - top) * 0.5)} ${50 - (h + 16)} ${b.footY - 14} ${50 - (h + 21)} ${b.footY}` +
        `L${50 + (h + 21)} ${b.footY}C${50 + (h + 16)} ${b.footY - 14} ${50 + (h + 2)} ${f(top + (b.footY - top) * 0.5)} ${50 + (h - 2)} ${top}Z`;
      return (
        <>
          <rect x={50 - h + 2} y={b.waistY - 26} width={(h - 2) * 2} height={16} fill={skin} />
          <path d={skirt} fill={outfit.skirt} />
          <path
            d={`M${50 - h - 19} ${b.footY - 7}H${50 + h + 19}`}
            stroke={outfit.band}
            strokeWidth={5}
          />
          <path
            d={`M${50 - h - 13} ${b.footY - 24}H${50 + h + 13}`}
            {...dotted(18, outfit.band, 2.6)}
          />
          <path
            d={`M${50 - h - 6} ${b.footY - 54}H${50 + h + 6}`}
            {...dotted(14, outfit.band, 2.2)}
          />
          <path d={tunic(b, b.waistY - 24, h - 1)} fill={outfit.choli} />
          <path
            d={`M${50 + h - 7} ${b.shoulderY - 3}L${50 + h + 1} ${b.shoulderY + 2}L${50 - h + 4} ${b.waistY + 22}L${50 - h - 3} ${b.waistY + 13}Z`}
            fill={outfit.dupatta}
            opacity={0.92}
          />
          <path
            d={`M${50 + h + 1} ${b.shoulderY + 2}L${50 - h + 4} ${b.waistY + 22}`}
            {...dotted(16, C.ivory50, 1.8)}
          />
        </>
      );
    }
    case 'saree':
      return (
        <>
          <path d="M60 62L72 68L80 172L68 175Z" fill={outfit.shade} />
          <path d="M32 120L26 246H74L68 120Z" fill={outfit.saree} />
          {[46.5, 50, 53.5].map((x) => (
            <path
              key={x}
              d={`M${x} 136L${x + (x - 50) * 0.4} 236`}
              stroke={outfit.shade}
              strokeWidth={1.3}
            />
          ))}
          <rect x={26} y={236} width={48} height={10} fill={outfit.border} />
          <path d="M28 241H72" {...dotted(14, C.ivory50, 1.8)} />
          <rect x={33} y={100} width={34} height={22} fill={skin} />
          <path d={tunic(ADULT, 104, 17)} fill={outfit.blouse} />
          <path d="M54 61L68 66L70 96L35 129L31 125L33 110Z" fill={outfit.saree} />
          <path d="M70 96L35 129" stroke={outfit.border} strokeWidth={3.4} />
        </>
      );
  }
}

/** Hair and head coverings, drawn about the head centre for a radius-15 head. */
function HairBehind({ style, color }: { style: Hair; color: string }) {
  switch (style) {
    case 'bun':
      return <circle cx={0} cy={-17} r={7.5} fill={color} />;
    case 'long':
      return <path d="M-15 -4C-17 14 -19 34 -17 52H17C19 34 17 14 15 -4Z" fill={color} />;
    case 'pigtails':
      return (
        <>
          <circle cx={-17} cy={4} r={5.5} fill={color} />
          <circle cx={17} cy={4} r={5.5} fill={color} />
        </>
      );
    case 'curly':
      return (
        <>
          {[
            [-15, 2, 5],
            [15, 2, 5],
          ].map(([x, y, r]) => (
            <circle key={x} cx={x} cy={y} r={r} fill={color} />
          ))}
        </>
      );
    default:
      return null;
  }
}

function HairFront({
  style,
  color,
  accent,
}: {
  style: Hair;
  color: string;
  accent?: string | undefined;
}) {
  const parted =
    'M-15 0C-16 -13 -8 -18 0 -18C8 -18 16 -13 15 0C13 -7 7 -11 1 -12L0 -9L-1 -12C-7 -11 -13 -7 -15 0Z';
  switch (style) {
    case 'bun':
    case 'long':
    case 'pigtails':
      return <path d={parted} fill={color} />;
    case 'braid':
      return (
        <>
          <path d={parted} fill={color} />
          {[14, 22, 30, 38, 46, 54].map((y, i) => (
            <ellipse key={y} cx={-13.5 - i * 0.3} cy={y} rx={4.4} ry={4.6} fill={color} />
          ))}
          <path d="M-15 58L-19 66H-11Z" fill={accent ?? C.vermilion500} />
        </>
      );
    case 'short':
      return (
        <path
          d="M-15 -1C-16 -14 -6 -19 3 -18C11 -17 16 -11 15 -1C14 -6 12 -9 9 -10C3 -11 -4 -9 -8 -12C-11 -9 -14 -5 -15 -1Z"
          fill={color}
        />
      );
    case 'curly':
      return (
        <>
          {[
            [-12, -6, 6],
            [-7, -13, 6.5],
            [1, -16, 7],
            [8.5, -12.5, 6.5],
            [13, -5, 5.6],
          ].map(([x, y, r]) => (
            <circle key={x} cx={x} cy={y} r={r} fill={color} />
          ))}
        </>
      );
    case 'balding':
      return (
        <>
          <path d="M-15 3C-16 -5 -14 -9 -11 -10L-10 3Z" fill={color} />
          <path d="M15 3C16 -5 14 -9 11 -10L10 3Z" fill={color} />
        </>
      );
    case 'dastar':
      return (
        <>
          <path
            d="M-16 -1C-18 -16 -9 -26 0 -26C9 -26 18 -16 16 -1C12 -6 7 -9 0 -9C-7 -9 -12 -6 -16 -1Z"
            fill={color}
          />
          <path d="M0 -9L-9 -24M0 -9L9 -24" stroke={accent ?? C.marigold700} strokeWidth={1.4} />
          <path
            d="M-14 -7C-8 -14 8 -14 14 -7"
            fill="none"
            stroke={accent ?? C.marigold700}
            strokeWidth={1.2}
          />
        </>
      );
    case 'hijab':
      return (
        <path
          fillRule="evenodd"
          d="M-18 0C-20 -18 -10 -25 0 -25C10 -25 20 -18 18 0C19 14 22 24 30 32H-30C-22 24 -19 14 -18 0Z M0 -12C-7 -12 -11.5 -5 -11.5 2C-11.5 9 -6.5 14.5 0 14.5C6.5 14.5 11.5 9 11.5 2C11.5 -5 7 -12 0 -12Z"
          fill={color}
        />
      );
  }
}

function Face({ face, hair, skin }: { face: PersonSpec['face']; hair: string; skin: string }) {
  const covered = face?.beard;
  return (
    <>
      <path
        d="M-6 1Q-4 3.4 -1.8 1"
        fill="none"
        stroke={C.night950}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <path
        d="M1.8 1Q4 3.4 6 1"
        fill="none"
        stroke={C.night950}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <circle
        cx={-8.5}
        cy={5.5}
        r={2.6}
        fill={C.gulab400}
        opacity={skin === C.mitti900 ? 0.3 : 0.45}
      />
      <circle
        cx={8.5}
        cy={5.5}
        r={2.6}
        fill={C.gulab400}
        opacity={skin === C.mitti900 ? 0.3 : 0.45}
      />
      {covered ? null : (
        <path
          d="M-3.6 8Q0 10.8 3.6 8"
          fill="none"
          stroke={C.maroon800}
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      )}
      {face?.beard ? (
        <path
          d="M-14 3C-14 19 -6 26 0 26C6 26 14 19 14 3C11 11 6 14 0 14C-6 14 -11 11 -14 3Z"
          fill={hair}
        />
      ) : null}
      {face?.mustache || face?.beard ? (
        <path d="M-6 8.2Q0 5 6 8.2Q0 9.8 -6 8.2Z" fill={hair} />
      ) : null}
      {face?.bindi ? <circle cx={0} cy={-6} r={1.4} fill={C.vermilion600} /> : null}
      {face?.glasses ? (
        <>
          <circle cx={-4.6} cy={1} r={4} fill="none" stroke={C.night900} strokeWidth={1.2} />
          <circle cx={4.6} cy={1} r={4} fill="none" stroke={C.night900} strokeWidth={1.2} />
          <path d="M-0.6 0.6H0.6" stroke={C.night900} strokeWidth={1.2} />
        </>
      ) : null}
    </>
  );
}

function Sparks() {
  return (
    <g className={styles.twinkle}>
      <circle r={7} fill={C.marigold400} opacity={0.3} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 8;
        return (
          <path
            key={i}
            d={`M${f(Math.cos(a) * 2.5)} ${f(Math.sin(a) * 2.5)}L${f(Math.cos(a) * 8)} ${f(Math.sin(a) * 8)}`}
            stroke={i % 2 ? C.marigold200 : C.ivory50}
            strokeWidth={1.3}
            strokeLinecap="round"
          />
        );
      })}
      <circle r={2} fill={C.ivory50} />
    </g>
  );
}

function Held({ holding, b, left, right }: { holding: Holding; b: Body; left: Pt; right: Pt }) {
  switch (holding) {
    case 'sparkler':
      return (
        <>
          <path
            d={`M${pt(right)}L${f(right[0] + 4)} ${f(right[1] - 28)}`}
            stroke={C.brass700}
            strokeWidth={1.4}
          />
          <g transform={`translate(${f(right[0] + 4)} ${f(right[1] - 30)})`}>
            <Sparks />
          </g>
        </>
      );
    case 'diya':
      return <SmallDiya x={f(right[0])} y={f(right[1] - 5)} scale={0.95} wait={0.3} />;
    case 'thali': {
      const y = (left[1] + right[1]) / 2 - 2;
      return (
        <g>
          <ellipse cx={50} cy={y + 2} rx={23} ry={6.5} fill={C.brass700} />
          <ellipse cx={50} cy={y} rx={23} ry={6.5} fill={C.brass500} />
          <ellipse cx={50} cy={y} rx={17} ry={4.4} fill={C.brass400} />
          <ellipse cx={50} cy={y} rx={20} ry={5.4} {...dotted(20, C.marigold200, 1.4)} />
          <Marigold x={37} y={y - 1} r={3.4} />
          <Marigold x={63} y={y - 1} r={3.4} />
          <SmallDiya x={50} y={y - 1.5} scale={0.85} wait={0.7} />
        </g>
      );
    }
    case 'sweets':
    case 'gift': {
      const y = (left[1] + right[1]) / 2 - 9;
      // Sweets come in a marigold mithai box; gifts in rani pink. Both read
      // against any of the cast's clothes.
      const [box, ribbon] =
        holding === 'sweets' ? [C.marigold500, C.vermilion700] : [C.rani500, C.ivory50];
      return (
        <g>
          <rect x={35} y={y} width={30} height={18} rx={1.5} fill={box} />
          <rect x={48} y={y} width={4} height={18} fill={ribbon} />
          <rect x={35} y={y + 7} width={30} height={4} fill={ribbon} />
          <path
            d={`M50 ${y}C44 ${y - 7} 41 ${y - 1} 50 ${y}C59 ${y - 1} 56 ${y - 7} 50 ${y}Z`}
            fill={ribbon}
          />
        </g>
      );
    }
    case 'phone':
      return (
        <g transform={`translate(${f(right[0])} ${f(right[1] - 4)}) rotate(-14)`}>
          <rect x={-4.5} y={-8} width={9} height={15} rx={1.6} fill={C.night950} />
          <rect
            className={styles.shimmer}
            x={-3.2}
            y={-6.6}
            width={6.4}
            height={12}
            rx={0.8}
            fill={C.marigold200}
          />
        </g>
      );
    case 'cane':
      return (
        <path
          d={`M${pt(left)}L${f(left[0] - 3)} ${b.footY}`}
          stroke={C.brass700}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      );
  }
}

// ---------------------------------------------------------------------------
// Person
// ---------------------------------------------------------------------------

export function Person({ spec }: { spec: PersonSpec }) {
  const b = spec.size === 'adult' ? ADULT : CHILD;
  const left = armPoints(b, -1, spec.arms.left);
  const right = armPoints(b, 1, spec.arms.right);
  const sleeve =
    spec.outfit.kind === 'saree'
      ? spec.outfit.blouse
      : spec.outfit.kind === 'lehenga'
        ? spec.outfit.choli
        : spec.outfit.color;
  const head = `translate(50 ${b.headY}) scale(${b.r / 15})`;
  const hair = spec.hair;
  const twoHanded =
    spec.holding === 'thali' || spec.holding === 'sweets' || spec.holding === 'gift';

  return (
    <>
      <g transform={head}>
        <HairBehind style={hair.style} color={hair.color} />
      </g>
      <rect x={45.5} y={b.neckTop} width={9} height={b.shoulderY - b.neckTop} fill={spec.skin} />
      <Garment b={b} outfit={spec.outfit} skin={spec.skin} />
      <Arm points={left} sleeve={sleeve} skin={spec.skin} sleeves={spec.arms.sleeves} />
      <Arm
        points={right}
        sleeve={sleeve}
        skin={spec.skin}
        sleeves={spec.arms.sleeves}
        className={spec.arms.right === 'wave' ? styles.wave : undefined}
      />
      {spec.holding ? <Held holding={spec.holding} b={b} left={left[2]} right={right[2]} /> : null}
      {twoHanded ? (
        <>
          <circle cx={f(left[2][0])} cy={f(left[2][1])} r={5} fill={spec.skin} />
          <circle cx={f(right[2][0])} cy={f(right[2][1])} r={5} fill={spec.skin} />
        </>
      ) : null}
      <g transform={head}>
        <circle cx={-14.5} cy={2} r={3.2} fill={spec.skin} />
        <circle cx={14.5} cy={2} r={3.2} fill={spec.skin} />
        {spec.face?.earrings ? (
          <>
            <path d="M-14.5 5L-16.6 10H-12.4Z" fill={C.marigold500} />
            <path d="M14.5 5L12.4 10H16.6Z" fill={C.marigold500} />
          </>
        ) : null}
        <circle r={15} fill={spec.skin} />
        <HairFront style={hair.style} color={hair.color} accent={hair.accent} />
        <Face face={spec.face} hair={spec.face?.whiskers ?? hair.color} skin={spec.skin} />
      </g>
    </>
  );
}

/** Places a person: x is the centre, `floor` the y their feet stand on. */
export function Placed({
  spec,
  x,
  floor,
  scale = 1,
  index,
  sway = true,
}: {
  spec: PersonSpec;
  x: number;
  floor: number;
  scale?: number;
  index: number;
  sway?: boolean;
}) {
  const b = spec.size === 'adult' ? ADULT : CHILD;
  const style = { '--i': index, animationDelay: `${(index * 0.7) % 3}s` } as CSSProperties;
  return (
    <g transform={`translate(${f(x - 50 * scale)} ${f(floor - b.footY * scale)}) scale(${scale})`}>
      <g className={styles.arrive} style={style}>
        <g
          className={sway ? (spec.size === 'child' ? styles.bob : styles.breathe) : undefined}
          style={style}
        >
          <Person spec={spec} />
        </g>
      </g>
    </g>
  );
}
