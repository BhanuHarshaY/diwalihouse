'use client';

import { EMBLEM_IDS, type EmblemId } from '@diwali/contracts';
import type { Profile } from '@diwali/realtime-protocol';
import { useEffect, useState } from 'react';
import type { GameRequest } from '@/realtime/useGameRoom';
import type { SocketStatus } from '@/realtime/useRealtime';
import styles from './games.module.css';

/** What every game screen receives from GameScreen. */
export interface GameProps<V> {
  partyId: string;
  view: V;
  profiles: Record<string, Profile>;
  /** Recent events, newest first. */
  events: unknown[];
  status: SocketStatus;
  request: GameRequest;
}

export function nameOf(profiles: Record<string, Profile>, id: string) {
  return profiles[id]?.name ?? 'Someone';
}

export function emblemOf(profiles: Record<string, Profile>, id: string): EmblemId {
  const emblem = profiles[id]?.emblem;
  return EMBLEM_IDS.find((e) => e === emblem) ?? 'diya';
}

/** Whole seconds until `deadline`, ticking; null when there is no clock. */
export function useCountdown(deadline: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline]);
  return deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
}

export function Connecting({ status }: { status: SocketStatus }) {
  const message =
    status === 'unavailable'
      ? 'The Card Room isn’t available on this server yet: realtime isn’t configured.'
      : status === 'denied'
        ? 'You’re not a member of this party.'
        : 'Pulling up a chair…';
  return <p className={styles.status}>{message}</p>;
}
