import { useId } from 'react';
import { cuspedArch } from '@/design-system/geometry/arch';
import { PALETTE as C } from '@/design-system/palette';

/**
 * The doorway of the house: a cusped arch in a brass-ruled frame, a fixed
 * sunburst panel above the doors, and a stepped threshold. 360 × 620 grid.
 * The door leaves are separate (DoorLeafArt) so they can swing open.
 */

export const DOORWAY = {
  width: 360,
  height: 620,
  /** The rectangle the door leaves fill, and the interior shows through. */
  opening: { x: 50, y: 214, width: 260, height: 386 },
} as const;

const cx = 180;
const opening = cuspedArch({ cx, baseY: 600, springY: 214, apexY: 46, halfWidth: 130, lobes: 4 });
const frame = cuspedArch({ cx, baseY: 608, springY: 214, apexY: 16, halfWidth: 160, lobes: 4 });
const frameInner = cuspedArch({
  cx,
  baseY: 608,
  springY: 214,
  apexY: 34,
  halfWidth: 144,
  lobes: 4,
});

export function DoorwayArt({ className }: { className?: string | undefined }) {
  const clip = `tympanum-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const rays = Array.from({ length: 13 }, (_, i) => (Math.PI * i) / 12);
  return (
    <svg viewBox="0 0 360 620" className={className} aria-hidden focusable="false">
      <defs>
        <clipPath id={clip}>
          <path d={`${opening.d}Z`} />
        </clipPath>
      </defs>

      {/* Frame: the band between the outer arch and the opening. */}
      <path d={`${frame.d}Z ${opening.d}Z`} fill={C.night800} fillRule="evenodd" />
      <path d={frame.d} fill="none" stroke={C.brass500} strokeWidth={2} />
      <path d={frameInner.d} fill="none" stroke={C.brass500} strokeOpacity={0.45} strokeWidth={1} />
      <path d={opening.d} fill="none" stroke={C.brass500} strokeWidth={2} />
      {frameInner.cusps.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={3} fill={C.marigold200} />
      ))}
      {Array.from({ length: 12 }, (_, i) => 240 + i * 31).map((y) => (
        <g key={y}>
          <circle cx={cx - 152} cy={y} r={3} fill={C.marigold200} />
          <circle cx={cx + 152} cy={y} r={3} fill={C.marigold200} />
        </g>
      ))}

      {/* Fixed sunburst panel above the doors. */}
      <g clipPath={`url(#${clip})`}>
        <rect x={40} y={30} width={280} height={190} fill={C.night700} />
        {rays.map((angle) => (
          <path
            key={angle}
            d={`M${cx} 214L${cx - Math.cos(angle) * 190} ${214 - Math.sin(angle) * 190}`}
            stroke={C.brass500}
            strokeOpacity={0.7}
            strokeWidth={1.4}
          />
        ))}
        <circle cx={cx} cy={214} r={44} fill={C.vermilion600} />
        <circle
          cx={cx}
          cy={214}
          r={36}
          fill="none"
          stroke={C.marigold200}
          strokeWidth={2.2}
          strokeLinecap="round"
          pathLength={36}
          strokeDasharray="0 1"
        />
        <circle cx={cx} cy={214} r={24} fill={C.marigold500} />
        <rect x={40} y={206} width={280} height={8} fill={C.brass500} />
      </g>

      {/* Threshold. */}
      <rect x={28} y={600} width={304} height={10} fill={C.brass500} />
      <rect x={14} y={610} width={332} height={10} fill={C.vermilion700} />
    </svg>
  );
}

/** One carved door leaf: vermilion stiles, peacock panels, brass studs. 130 × 386 grid. */
export function DoorLeafArt({ className }: { className?: string | undefined }) {
  const panels = [
    { y: 16, h: 108 },
    { y: 142, h: 108 },
    { y: 268, h: 100 },
  ];
  return (
    <svg
      viewBox="0 0 130 386"
      className={className}
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
    >
      <rect width={130} height={386} fill={C.vermilion600} />
      <rect
        x={3}
        y={3}
        width={124}
        height={380}
        fill="none"
        stroke={C.brass500}
        strokeWidth={1.5}
      />
      {panels.map(({ y, h }) => (
        <g key={y}>
          <rect x={16} y={y} width={98} height={h} fill={C.peacock600} />
          <rect
            x={21}
            y={y + 5}
            width={88}
            height={h - 10}
            fill="none"
            stroke={C.brass400}
            strokeWidth={1.2}
          />
          <path
            d={`M65 ${y + h / 2 - 20}L83 ${y + h / 2}L65 ${y + h / 2 + 20}L47 ${y + h / 2}Z`}
            fill={C.brass500}
          />
          <circle cx={65} cy={y + h / 2} r={4} fill={C.vermilion600} />
        </g>
      ))}
      {[133, 259].map((y) =>
        Array.from({ length: 7 }, (_, i) => (
          <circle key={`${y}-${i}`} cx={20 + i * 15} cy={y} r={2.6} fill={C.brass400} />
        )),
      )}
      {Array.from({ length: 15 }, (_, i) => 18 + i * 25).map((y) => (
        <circle key={y} cx={8.5} cy={y} r={2} fill={C.brass400} />
      ))}
      <path d="M127 0V386" stroke={C.vermilion800} strokeWidth={4} />
      <circle cx={112} cy={205} r={8} fill="none" stroke={C.brass400} strokeWidth={2.6} />
      <circle cx={112} cy={197} r={3.4} fill={C.brass500} />
    </svg>
  );
}
