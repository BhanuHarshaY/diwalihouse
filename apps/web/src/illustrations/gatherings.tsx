import type { ReactNode } from 'react';
import { cuspedArch } from '@/design-system/geometry/arch';
import { PALETTE as C } from '@/design-system/palette';
import type { WindowColours } from './ArchWindow';
import styles from './illustrations.module.css';
import { Placed, type PersonSpec } from './people';
import { dotted, SmallDiya } from './primitives';

const f = (n: number) => Math.round(n * 10) / 10;
import { Lantern } from './traditions';

/**
 * Group portraits: people standing together inside a wide arch window, with
 * string lights above and lamps along the floor (design/asset-manifest.md,
 * PPL-*). The cast is deliberately varied in age, skin tone and dress.
 */

// --- The cast -----------------------------------------------------------------

const grandfather: PersonSpec = {
  size: 'adult',
  skin: C.mitti500,
  hair: { style: 'balding', color: C.ivory200 },
  outfit: {
    kind: 'kurta',
    color: C.ivory100,
    trim: C.brass500,
    legs: C.ivory200,
    shawl: C.peacock600,
  },
  arms: { left: 'cane', right: 'down', sleeves: 'long' },
  holding: 'cane',
  face: { mustache: true, glasses: true },
};

const grandmother: PersonSpec = {
  size: 'adult',
  skin: C.mitti300,
  hair: { style: 'bun', color: C.ivory200 },
  outfit: {
    kind: 'saree',
    blouse: C.vermilion600,
    saree: C.peacock600,
    shade: C.peacock700,
    border: C.marigold500,
  },
  arms: { left: 'hold', right: 'hold', sleeves: 'short' },
  holding: 'thali',
  face: { bindi: true, glasses: true, earrings: true },
};

const daughter: PersonSpec = {
  size: 'child',
  skin: C.mitti300,
  hair: { style: 'pigtails', color: C.night950 },
  outfit: { kind: 'frock', color: C.rani500, trim: C.marigold200 },
  arms: { left: 'down', right: 'raise', sleeves: 'short' },
  holding: 'sparkler',
};

const mother: PersonSpec = {
  size: 'adult',
  skin: C.mitti500,
  hair: { style: 'long', color: C.night950 },
  outfit: {
    kind: 'saree',
    blouse: C.jamun700,
    saree: C.vermilion500,
    shade: C.vermilion700,
    border: C.marigold400,
  },
  arms: { left: 'hold', right: 'hold', sleeves: 'short' },
  holding: 'sweets',
  face: { bindi: true, earrings: true },
};

const father: PersonSpec = {
  size: 'adult',
  skin: C.mitti700,
  hair: { style: 'short', color: C.night950 },
  outfit: {
    kind: 'kurta',
    color: C.marigold500,
    trim: C.vermilion700,
    legs: C.ivory100,
    jacket: C.peacock700,
  },
  arms: { left: 'down', right: 'hold', sleeves: 'long' },
  holding: 'diya',
  face: { mustache: true },
};

const friendInDastar: PersonSpec = {
  size: 'adult',
  skin: C.mitti700,
  hair: { style: 'dastar', color: C.marigold600, accent: C.marigold700 },
  outfit: { kind: 'kurta', color: C.peacock500, trim: C.marigold200, legs: C.ivory100 },
  arms: { left: 'hold', right: 'hold', sleeves: 'long' },
  holding: 'gift',
  face: { beard: true, whiskers: C.night950 },
};

const friendInLehenga: PersonSpec = {
  size: 'adult',
  skin: C.mitti300,
  hair: { style: 'braid', color: C.night950, accent: C.rani500 },
  outfit: {
    kind: 'lehenga',
    choli: C.marigold500,
    skirt: C.rani500,
    band: C.marigold400,
    dupatta: C.gulab400,
  },
  arms: { left: 'down', right: 'raise', sleeves: 'short' },
  holding: 'sparkler',
  face: { bindi: true, earrings: true },
};

const friendWithPhone: PersonSpec = {
  size: 'adult',
  skin: C.mitti900,
  hair: { style: 'curly', color: C.night950 },
  outfit: { kind: 'kurti', color: C.ivory100, trim: C.vermilion600, legs: C.night700 },
  arms: { left: 'down', right: 'selfie', sleeves: 'long' },
  holding: 'phone',
  face: { earrings: true },
};

const friendInHijab: PersonSpec = {
  size: 'adult',
  skin: C.mitti300,
  hair: { style: 'hijab', color: C.jamun700 },
  outfit: { kind: 'kurta', color: C.marigold200, trim: C.jamun700, legs: C.jamun900 },
  arms: { left: 'down', right: 'hold', sleeves: 'long' },
  holding: 'diya',
};

const friendWaving: PersonSpec = {
  size: 'adult',
  skin: C.mitti100,
  hair: { style: 'short', color: C.maroon900 },
  outfit: { kind: 'kurta', color: C.vermilion600, trim: C.marigold200, legs: C.night700 },
  arms: { left: 'down', right: 'wave', sleeves: 'long' },
};

// --- The frame ----------------------------------------------------------------

function GroupWindow({
  id,
  width,
  height,
  colours,
  floor,
  label,
  children,
}: {
  id: string;
  width: number;
  height: number;
  colours: WindowColours & { floor: string };
  floor: number;
  label: string;
  children: ReactNode;
}) {
  const cx = width / 2;
  const halfWidth = width / 2 - 30;
  const arch = cuspedArch({
    cx,
    baseY: height,
    springY: height * 0.42,
    apexY: 16,
    halfWidth,
    lobes: 5,
  });
  const border = cuspedArch({
    cx,
    baseY: height - 6,
    springY: height * 0.43,
    apexY: 28,
    halfWidth: halfWidth - 10,
    lobes: 5,
  });
  const lightsY = height * 0.27;
  const lanternScale = width / 800;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={styles.window} role="img" aria-label={label}>
      <defs>
        <clipPath id={`group-${id}`}>
          <path d={`${arch.d}Z`} />
        </clipPath>
      </defs>
      <rect width={width} height={height} fill={colours.wall} />
      <path d={`${arch.d}Z`} fill={colours.ground} />
      <path d={border.d} {...dotted(110, colours.dots, 2.4)} opacity={0.7} />
      <g clipPath={`url(#group-${id})`}>
        <path
          d={`M${f(width * 0.1)} ${lightsY}Q${cx} ${lightsY + 34} ${f(width * 0.9)} ${lightsY}`}
          {...dotted(34, C.marigold200, 4)}
        />
        <g
          transform={`translate(${f(cx - 60 * lanternScale)} ${f(height * 0.075)}) scale(${lanternScale})`}
        >
          <Lantern />
        </g>
        <rect x={0} y={floor} width={width} height={height - floor} fill={colours.floor} />
        <path
          d={`M0 ${floor + 6}H${width}`}
          {...dotted(Math.round(width / 9), C.marigold400, 2.4)}
        />
        {children}
        {Array.from({ length: 6 }, (_, i) => (
          <SmallDiya
            key={i}
            x={cx - halfWidth + ((i + 0.5) * halfWidth * 2) / 6}
            y={height - 6}
            scale={0.9}
            wait={i * 0.31}
          />
        ))}
      </g>
    </svg>
  );
}

// --- The portraits ------------------------------------------------------------

const FLOOR = 360;
const SCALE = 1.12;

export function FamilyPortrait() {
  return (
    <GroupWindow
      id="family"
      width={560}
      height={400}
      floor={FLOOR}
      colours={{
        wall: C.vermilion700,
        ground: C.jamun900,
        dots: C.marigold200,
        floor: C.vermilion800,
      }}
      label="A family gathered for Diwali: grandparents, parents and a little girl with a sparkler."
    >
      <Placed spec={grandfather} x={86} floor={FLOOR} scale={SCALE} index={0} />
      <Placed spec={grandmother} x={180} floor={FLOOR} scale={SCALE} index={1} />
      <Placed spec={mother} x={372} floor={FLOOR} scale={SCALE} index={3} />
      <Placed spec={father} x={470} floor={FLOOR} scale={SCALE} index={4} />
      <Placed spec={daughter} x={274} floor={FLOOR} scale={SCALE} index={2} />
    </GroupWindow>
  );
}

export function FriendsPortrait() {
  return (
    <GroupWindow
      id="friends"
      width={560}
      height={400}
      floor={FLOOR}
      colours={{ wall: C.peacock700, ground: C.night900, dots: C.marigold200, floor: C.peacock800 }}
      label="Friends arriving for Diwali with a gift, sparklers, a lamp and a phone for a photo."
    >
      <Placed spec={friendInDastar} x={86} floor={FLOOR} scale={SCALE} index={0} />
      <Placed spec={friendWithPhone} x={280} floor={FLOOR} scale={SCALE} index={2} />
      <Placed spec={friendInHijab} x={376} floor={FLOOR} scale={SCALE} index={3} />
      <Placed spec={friendWaving} x={474} floor={FLOOR} scale={SCALE} index={4} />
      <Placed spec={friendInLehenga} x={182} floor={FLOOR} scale={SCALE} index={1} />
    </GroupWindow>
  );
}

/** Three friends on their way, for an empty party. */
export function FriendsArriving() {
  const floor = 262;
  return (
    <GroupWindow
      id="arriving"
      width={360}
      height={300}
      floor={floor}
      colours={{ wall: C.jamun700, ground: C.night900, dots: C.marigold200, floor: C.jamun900 }}
      label="Three friends on their way to the party."
    >
      <Placed spec={friendWaving} x={92} floor={floor} scale={0.9} index={0} />
      <Placed spec={friendInDastar} x={268} floor={floor} scale={0.9} index={2} />
      <Placed spec={friendInLehenga} x={180} floor={floor} scale={0.9} index={1} />
    </GroupWindow>
  );
}
