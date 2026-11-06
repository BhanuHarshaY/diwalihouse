import { useId, type ComponentPropsWithoutRef } from 'react';
import { PALETTE as C } from '@/design-system/palette';
import { DIYA, DIYA_BAND } from './diya-geometry';

/**
 * Terracotta diya with a printed lotus band. Flat inks only; the shading is
 * one darker ink clipped to the bowl, as a two-colour print would have it.
 */
export function DiyaArt(props: ComponentPropsWithoutRef<'svg'>) {
  const clip = `diya-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg viewBox="0 0 400 250" aria-hidden focusable="false" {...props}>
      <defs>
        <clipPath id={clip}>
          <path d={DIYA.body} />
        </clipPath>
      </defs>
      <path d={DIYA.foot} fill={C.vermilion700} />
      <path
        d={DIYA.footBand}
        fill="none"
        stroke={C.marigold600}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path d={DIYA.body} fill={C.vermilion600} />
      <g clipPath={`url(#${clip})`}>
        <ellipse cx={200} cy={262} rx={196} ry={58} fill={C.vermilion700} />
      </g>
      <path
        d={DIYA_BAND.line}
        fill="none"
        stroke={C.marigold400}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      {DIYA_BAND.petals.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={C.marigold400}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      ))}
      {DIYA_BAND.dots.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={3.4} fill={C.marigold200} />
      ))}
      <path d={DIYA.rim} fill={C.vermilion500} />
      <path d={DIYA.oil} fill={C.maroon900} />
      <path d={DIYA.wick} fill={C.ivory200} />
    </svg>
  );
}

/** The same lamp, unlit: one dark ink with a faint brass edge where the rim catches the night. */
export function DiyaSilhouette(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 400 250" aria-hidden focusable="false" {...props}>
      <path d={DIYA.foot} fill={C.night900} />
      <path d={DIYA.body} fill={C.night900} />
      <path d={DIYA.rim} fill="#171c4c" />
      <path d={DIYA.oil} fill={C.night950} />
      <path
        d="M28 112C82 126 156 132 200 146C244 132 318 126 372 112"
        fill="none"
        stroke={C.brass500}
        strokeOpacity={0.28}
        strokeWidth={2}
      />
    </svg>
  );
}
