import type { EmblemId } from '@diwali/contracts';
import type { ReactNode } from 'react';
import { PALETTE } from '../palette';

/**
 * Emblem artwork, drawn on a 64-unit grid.
 *
 * Construction rules (see design/illustration-spec.md § Emblems):
 *  - Every motif sits inside a 20-unit radius of the centre.
 *  - Flat fills only, at most three inks plus ivory per motif.
 *  - Detail lines are 1–1.6 units; nothing thinner survives at 32px.
 */

const C = PALETTE;

export interface EmblemArt {
  field: string;
  /** Dotted inner ring colour; must read against the field. */
  ring: string;
  motif: (uid: string) => ReactNode;
}

function polar(cx: number, cy: number, r: number, degrees: number): [number, number] {
  const a = ((degrees - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function sparkle(x: number, y: number, r: number): string {
  const k = r * 0.28;
  return `M${x} ${y - r}L${x + k} ${y - k}L${x + r} ${y}L${x + k} ${y + k}L${x} ${y + r}L${x - k} ${y + k}L${x - r} ${y}L${x - k} ${y - k}Z`;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export const EMBLEM_ART: Record<EmblemId, EmblemArt> = {
  diya: {
    field: C.night800,
    ring: C.brass500,
    motif: () => (
      <>
        <path
          d="M13 37c6 1.6 14 2.6 19 5.4 5-2.8 13-3.8 19-5.4-1.8 7.6-9 12.6-19 12.6S14.8 44.6 13 37Z"
          fill={C.vermilion500}
        />
        <path
          d="M13 37c7-3.2 31-3.2 38 0-6 1.6-14 2.6-19 5.4-5-2.8-13-3.8-19-5.4Z"
          fill={C.maroon900}
        />
        <path
          d="M32 14.5c3.2 6 7.4 10.2 7.4 15.6 0 4.6-3.2 8-7.4 8s-7.4-3.4-7.4-8c0-5.4 4.2-9.6 7.4-15.6Z"
          fill={C.marigold500}
        />
        <path
          d="M32 24.5c2 3 3.6 5 3.6 7.6 0 2.4-1.6 4.3-3.6 4.3s-3.6-1.9-3.6-4.3c0-2.6 1.6-4.6 3.6-7.6Z"
          fill={C.ivory50}
        />
        {[
          [21, 43.4],
          [26.4, 45.6],
          [32, 46.4],
          [37.6, 45.6],
          [43, 43.4],
        ].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r={1.15} fill={C.marigold200} />
        ))}
      </>
    ),
  },

  kamal: {
    field: C.peacock600,
    ring: C.ivory200,
    motif: () => {
      const petal = (top: number) =>
        `M32 ${top}C${37.4} ${top + 7} 38 ${top + 17} 32 45C26 ${top + 17} 26.6 ${top + 7} 32 ${top}Z`;
      return (
        <>
          {[-64, 64].map((r) => (
            <path key={r} d={petal(23)} fill={C.rani500} transform={`rotate(${r} 32 45)`} />
          ))}
          {[-33, 33].map((r) => (
            <path key={r} d={petal(19)} fill={C.ivory200} transform={`rotate(${r} 32 45)`} />
          ))}
          <path d={petal(14.5)} fill={C.ivory50} />
          <path d="M32 21v19" stroke={C.rani500} strokeWidth={1.3} strokeLinecap="round" />
          <path
            d="M17 47.5q15 4 30 0"
            fill="none"
            stroke={C.ivory50}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </>
      );
    },
  },

  genda: {
    field: C.night700,
    ring: C.brass500,
    motif: () => (
      <>
        {range(14).map((i) => {
          const [x, y] = polar(32, 32, 13.2, (360 / 14) * i);
          return <circle key={`o${i}`} cx={round(x)} cy={round(y)} r={4.9} fill={C.marigold500} />;
        })}
        {range(14).map((i) => {
          const [x, y] = polar(32, 32, 13.2, (360 / 14) * i);
          return <circle key={`s${i}`} cx={round(x)} cy={round(y)} r={1.3} fill={C.marigold700} />;
        })}
        {range(10).map((i) => {
          const [x, y] = polar(32, 32, 7.8, (360 / 10) * i + 18);
          return <circle key={`m${i}`} cx={round(x)} cy={round(y)} r={4.1} fill={C.marigold400} />;
        })}
        <circle cx={32} cy={32} r={5.2} fill={C.marigold600} />
        {range(5).map((i) => {
          const [x, y] = polar(32, 32, 2.4, 72 * i);
          return <circle key={`c${i}`} cx={round(x)} cy={round(y)} r={0.95} fill={C.marigold200} />;
        })}
      </>
    ),
  },

  ambi: {
    field: C.vermilion600,
    ring: C.marigold200,
    motif: () => (
      <>
        <path
          d="M41.5 12.5c3.6 5.4 6 12.6 5 20.4C45.4 42 38.6 48.5 30 48.5c-7.6 0-13-5.6-13-13 0-7.8 5.8-13 13-13 5.6 0 9.8-3.6 11.5-10Z"
          fill={C.ivory50}
        />
        <path
          d="M37.6 22.4c1.4 3.4 2 7.6 1.2 11.4-1 5.2-4.8 8.8-9.6 8.8-4.2 0-7.2-3-7.2-7.2 0-4.2 3.2-7.2 7.4-7.2 3.6 0 6.6-2 8.2-5.8Z"
          fill={C.marigold500}
        />
        <circle cx={29.8} cy={35.2} r={3.2} fill={C.vermilion600} />
        <circle cx={29.8} cy={35.2} r={1.2} fill={C.ivory50} />
        {[
          [44.2, 22],
          [45.2, 29.4],
          [44.2, 36.6],
          [40.6, 42.8],
          [34.6, 46.4],
          [27.4, 46.6],
          [21.4, 43.2],
          [18.6, 37],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={0.95} fill={C.vermilion600} />
        ))}
      </>
    ),
  },

  patang: {
    field: C.marigold500,
    ring: C.vermilion700,
    motif: () => (
      <>
        <path d="M32 11.5 16.5 29 32 46.5Z" fill={C.vermilion600} />
        <path d="M32 11.5 47.5 29 32 46.5Z" fill={C.night800} />
        <path d="M32 11.5v35" stroke={C.ivory50} strokeWidth={1.3} />
        <path d="M16.5 29Q32 21.5 47.5 29" fill="none" stroke={C.ivory50} strokeWidth={1.3} />
        <circle cx={32} cy={27.4} r={2.4} fill={C.ivory50} />
        <path d="M32 46.5 27.6 53h8.8Z" fill={C.vermilion600} />
      </>
    ),
  },

  anaar: {
    field: C.night900,
    ring: C.brass500,
    motif: () => {
      const rays = [
        [-62, 12],
        [-38, 15.5],
        [-16, 17.5],
        [0, 18.5],
        [16, 17.5],
        [38, 15.5],
        [62, 12],
      ] as const;
      return (
        <>
          {rays.map(([deg, len]) => {
            const [x, y] = polar(32, 34, len, deg);
            return (
              <g key={deg}>
                <path
                  d={`M32 34L${round(x)} ${round(y)}`}
                  stroke={C.marigold400}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
                <circle cx={round(x)} cy={round(y)} r={1.45} fill={C.ivory50} />
              </g>
            );
          })}
          <path d={sparkle(21, 20, 2.6)} fill={C.marigold200} />
          <path d={sparkle(44, 22, 2.2)} fill={C.marigold200} />
          <path d="M23.5 49h17l-3.6-12.4c-2.6-2.4-7.2-2.4-9.8 0Z" fill={C.vermilion600} />
          <path d="M25.4 42.4h13.2l1 3.3H24.4Z" fill={C.marigold500} />
          <path
            d="M27 36.6c2.6-2.4 7.4-2.4 10 0"
            fill="none"
            stroke={C.ivory50}
            strokeWidth={1.2}
          />
        </>
      );
    },
  },

  chakri: {
    field: C.peacock700,
    ring: C.ivory200,
    motif: () => (
      <>
        {range(8).map((i) => {
          const start = 45 * i;
          const [x1, y1] = polar(32, 32, 17.5, start);
          const [x2, y2] = polar(32, 32, 17.5, start + 24);
          return (
            <path
              key={i}
              d={`M${round(x1)} ${round(y1)}A17.5 17.5 0 0 1 ${round(x2)} ${round(y2)}`}
              fill="none"
              stroke={C.marigold200}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx={32} cy={32} r={11.2} fill="none" stroke={C.marigold500} strokeWidth={3.4} />
        <circle cx={32} cy={32} r={6.4} fill="none" stroke={C.vermilion500} strokeWidth={2.6} />
        <circle cx={32} cy={32} r={2.6} fill={C.ivory50} />
      </>
    ),
  },

  lattu: {
    field: C.ivory100,
    ring: C.brass700,
    motif: (uid) => {
      const body =
        'M17.5 27c0-7.4 29-7.4 29 0 0 7.6-8.6 15.4-14.5 23.5C26.1 42.4 17.5 34.6 17.5 27Z';
      return (
        <>
          <defs>
            <clipPath id={`${uid}-lattu`}>
              <path d={body} />
            </clipPath>
          </defs>
          <path d={body} fill={C.vermilion600} />
          <g clipPath={`url(#${uid}-lattu)`}>
            <rect x={14} y={27.4} width={36} height={3.6} fill={C.marigold500} />
            <rect x={14} y={34.2} width={36} height={2.6} fill={C.peacock600} />
            <rect x={14} y={39.6} width={36} height={1.8} fill={C.marigold500} />
          </g>
          <rect x={29.4} y={13} width={5.2} height={8} rx={1.4} fill={C.night800} />
          <path d="M32 50.5v3" stroke={C.night800} strokeWidth={1.8} strokeLinecap="round" />
        </>
      );
    },
  },

  machhli: {
    field: C.peacock600,
    ring: C.ivory200,
    motif: () => (
      <>
        <path d="M44 32 52.5 23.5 50 32l2.5 8.5Z" fill={C.vermilion600} />
        <path d="M27.6 23.6 33 17.4l2.6 6.4Z" fill={C.vermilion600} />
        <path d="M13 32c5.6-10.4 23.4-12.4 31.6 0-8.2 12.4-26 10.4-31.6 0Z" fill={C.marigold500} />
        <path
          d="M24.6 25.6q-3.4 6.4 0 12.8"
          fill="none"
          stroke={C.vermilion700}
          strokeWidth={1.3}
        />
        {[
          [30, 28.4],
          [35.4, 28.4],
          [32.7, 34],
          [38, 34],
          [27.4, 34],
        ].map(([x, y]) => (
          <path
            key={`${x}-${y}`}
            d={`M${x! - 2.4} ${y}q2.4 3.2 4.8 0`}
            fill="none"
            stroke={C.vermilion700}
            strokeWidth={1.1}
            strokeLinecap="round"
          />
        ))}
        <circle cx={19.4} cy={30.4} r={2.5} fill={C.ivory50} />
        <circle cx={19.4} cy={30.4} r={1.3} fill={C.night900} />
      </>
    ),
  },

  mor: {
    field: C.night800,
    ring: C.brass500,
    motif: () => (
      <>
        {range(9).map((i) => {
          const deg = -100 + i * 25;
          const [x1, y1] = polar(32, 35, 12.4, deg);
          const [x2, y2] = polar(32, 35, 18.6, deg);
          return (
            <path
              key={i}
              d={`M${round(x1)} ${round(y1)}L${round(x2)} ${round(y2)}`}
              stroke={C.peacock300}
              strokeWidth={0.9}
              strokeLinecap="round"
            />
          );
        })}
        <path d="M32 46v8.5" stroke={C.brass500} strokeWidth={1.4} strokeLinecap="round" />
        <path
          d="M32 12.5c8.2 8 11.4 16 11.4 22.4 0 7-5 11.6-11.4 11.6s-11.4-4.6-11.4-11.6c0-6.4 3.2-14.4 11.4-22.4Z"
          fill={C.peacock500}
        />
        <path
          d="M32 21.4c5.6 5.6 7.8 10.6 7.8 14.6 0 4.6-3.4 7.6-7.8 7.6s-7.8-3-7.8-7.6c0-4 2.2-9 7.8-14.6Z"
          fill={C.marigold400}
        />
        <ellipse cx={32} cy={37.4} rx={4.6} ry={5.4} fill={C.night600} />
        <ellipse cx={32} cy={38.4} rx={2} ry={2.4} fill={C.peacock300} />
      </>
    ),
  },

  suraj: {
    field: C.vermilion500,
    ring: C.marigold200,
    motif: () => (
      <>
        {range(16).map((i) => {
          const deg = 22.5 * i;
          const long = i % 2 === 0;
          const [tx, ty] = polar(32, 32, long ? 20.5 : 16.5, deg);
          const [ax, ay] = polar(32, 32, 10.5, deg - (long ? 9 : 7));
          const [bx, by] = polar(32, 32, 10.5, deg + (long ? 9 : 7));
          return (
            <path
              key={i}
              d={`M${round(ax)} ${round(ay)}L${round(tx)} ${round(ty)}L${round(bx)} ${round(by)}Z`}
              fill={long ? C.marigold400 : C.marigold200}
            />
          );
        })}
        <circle cx={32} cy={32} r={10.8} fill={C.marigold500} />
        <circle
          cx={32}
          cy={32}
          r={6.8}
          fill="none"
          stroke={C.ivory50}
          strokeWidth={1.4}
          strokeLinecap="round"
          pathLength={16}
          strokeDasharray="0 1"
        />
        <circle cx={32} cy={32} r={3} fill={C.ivory50} />
      </>
    ),
  },

  chanda: {
    field: C.night900,
    ring: C.brass500,
    motif: () => (
      <>
        <circle cx={29.5} cy={32.5} r={15} fill={C.ivory100} />
        <circle cx={36.4} cy={28.2} r={12.6} fill={C.night900} />
        <path d={sparkle(43.6, 39.4, 3.2)} fill={C.marigold400} />
        <path d={sparkle(47.6, 27.6, 2.1)} fill={C.marigold200} />
        <path d={sparkle(38.4, 47.2, 1.8)} fill={C.marigold200} />
      </>
    ),
  },
};
