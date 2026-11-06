import { EMBLEMS, type EmblemId } from '@diwali/contracts';
import { useId } from 'react';
import { EMBLEM_ART } from './art';

export interface EmblemProps {
  id: EmblemId;
  size?: number | undefined;
  /** Accessible name. Omit when a visible label already names the emblem. */
  label?: string | undefined;
  className?: string | undefined;
}

/** A guest's medallion: brass rim, dotted inner ring, flat field, motif. */
export function Emblem({ id, size = 48, label, className }: EmblemProps) {
  const art = EMBLEM_ART[id];
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={label ? 'img' : undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {label ? <title>{label}</title> : null}
      <circle cx={32} cy={32} r={32} fill="#c29a48" />
      <circle cx={32} cy={32} r={29.6} fill={art.field} />
      <circle
        cx={32}
        cy={32}
        r={27.2}
        fill="none"
        stroke={art.ring}
        strokeOpacity={0.7}
        strokeWidth={1.3}
        strokeLinecap="round"
        pathLength={56}
        strokeDasharray="0 1"
      />
      {art.motif(uid)}
    </svg>
  );
}

export function emblemName(id: EmblemId): { en: string; hi: string } {
  const emblem = EMBLEMS.find((entry) => entry.id === id);
  return emblem ? { en: emblem.en, hi: emblem.hi } : { en: id, hi: id };
}
