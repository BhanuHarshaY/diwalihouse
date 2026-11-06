import type { ReactNode } from 'react';
import { PALETTE as C } from '@/design-system/palette';
import { dotted, SmallDiya } from './primitives';

/**
 * A rangoli built from concentric rings, centred on the origin, radius ~300.
 * Rings are separate so Scene 3 can lay each on its own compositing layer and
 * assemble them one by one; the Courtyard tile draws them all at once.
 */

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A petal pointing outwards, base at radius `from`, rounded tip at `to`. */
function roundPetal(from: number, to: number, width: number): string {
  const l = to - from;
  return `M0 ${-from}C${width} ${r1(-from - l * 0.2)} ${width} ${-to} 0 ${-to}C${-width} ${-to} ${-width} ${r1(-from - l * 0.2)} 0 ${-from}Z`;
}

/** A pointed petal (lens), base at `from`, tip at `to`. */
function pointedPetal(from: number, to: number, width: number): string {
  const l = to - from;
  return `M0 ${-from}C${width} ${r1(-from - l * 0.25)} ${r1(width * 0.8)} ${r1(-from - l * 0.75)} 0 ${-to}C${r1(-width * 0.8)} ${r1(-from - l * 0.75)} ${-width} ${r1(-from - l * 0.25)} 0 ${-from}Z`;
}

function around(count: number, offset: number, draw: (i: number) => ReactNode) {
  return Array.from({ length: count }, (_, i) => (
    <g key={i} transform={`rotate(${r1(offset + (360 / count) * i)})`}>
      {draw(i)}
    </g>
  ));
}

export interface RangoliRing {
  id: string;
  node: ReactNode;
}

export const RANGOLI_RINGS: RangoliRing[] = [
  {
    // The base wash of colour, laid first, that holds the pattern together.
    id: 'wash',
    node: (
      <>
        <circle r={252} fill={C.vermilion800} />
        <circle r={244} {...dotted(72, C.marigold600, 3)} />
        <circle r={178} fill={C.peacock800} />
        <circle r={166} fill={C.night900} opacity={0.45} />
        <circle r={104} fill={C.jamun900} />
      </>
    ),
  },
  {
    id: 'heart',
    node: (
      <>
        <circle r={30} fill={C.marigold600} />
        <circle r={24} fill={C.marigold500} />
        <circle r={17} {...dotted(12, C.marigold200, 5)} />
        <circle r={9} fill={C.vermilion600} />
        <circle r={3.5} fill={C.ivory50} />
      </>
    ),
  },
  {
    id: 'petals',
    node: around(8, 0, () => (
      <>
        <path d={roundPetal(30, 84, 23)} fill={C.vermilion500} />
        <path d={roundPetal(40, 74, 12)} fill={C.marigold400} />
        <circle cy={-62} r={3.2} fill={C.ivory50} />
      </>
    )),
  },
  {
    id: 'dots',
    node: (
      <>
        <circle r={93} fill="none" stroke={C.brass500} strokeWidth={1.6} />
        <circle r={101} {...dotted(48, C.ivory100, 4.6)} />
      </>
    ),
  },
  {
    id: 'lotus',
    node: around(16, 11.25, () => (
      <>
        <path d={pointedPetal(104, 164, 20)} fill={C.peacock500} />
        <path d={pointedPetal(114, 152, 9)} fill={C.peacock300} />
      </>
    )),
  },
  {
    id: 'beads',
    node: around(24, 0, (i) =>
      i % 2 === 0 ? (
        <circle cy={-171} r={6.2} fill={C.marigold500} />
      ) : (
        <path d="M0 -178L6 -171L0 -164L-6 -171Z" fill={C.rani500} />
      ),
    ),
  },
  {
    id: 'blooms',
    node: (
      <>
        {around(8, 22.5, () => (
          <path d={pointedPetal(182, 234, 14)} fill={C.peacock700} />
        ))}
        {around(8, 0, () => (
          <>
            <path d={roundPetal(180, 248, 34)} fill={C.vermilion600} />
            <path d={roundPetal(190, 238, 22)} fill={C.marigold500} />
            <path d={roundPetal(202, 228, 10)} fill={C.ivory50} />
          </>
        ))}
      </>
    ),
  },
  {
    id: 'scallops',
    node: (
      <>
        {around(32, 5.6, () => (
          <circle cy={-258} r={9.6} fill={C.marigold400} />
        ))}
        <circle r={273} {...dotted(64, C.ivory100, 4)} />
      </>
    ),
  },
  {
    id: 'lamps',
    node: (
      <>
        {around(4, 0, (i) => (
          <g transform="translate(0 -296)">
            <SmallDiya x={0} y={0} scale={2.3} wait={i * 0.4} />
          </g>
        ))}
        {around(4, 45, () => (
          <>
            <circle cy={-292} r={5} fill={C.rani500} />
            <circle cx={-11} cy={-280} r={3.6} fill={C.marigold400} />
            <circle cx={11} cy={-280} r={3.6} fill={C.marigold400} />
          </>
        ))}
      </>
    ),
  },
];

/** The whole rangoli as one SVG group (for small, static uses). */
export function RangoliAll() {
  return (
    <>
      {RANGOLI_RINGS.map((ring) => (
        <g key={ring.id}>{ring.node}</g>
      ))}
    </>
  );
}

export const RANGOLI_VIEWBOX = '-320 -320 640 640';
