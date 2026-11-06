'use client';

import type { ServerMessage } from '@diwali/realtime-protocol';
import { useCallback, useState } from 'react';
import { useRealtime } from '@/realtime/useRealtime';

export type MehfilMessage = Extract<ServerMessage, { t: 'mehfil' }>;

let device = '';

/**
 * This page load's id, which tells the room which tab is the speaker. It is
 * not kept across reloads on purpose: a reloaded tab needs a fresh tap to
 * play sound anyway, and a duplicated tab must not become a second speaker.
 */
function tabDevice(): string {
  if (typeof window === 'undefined') return '';
  device ||= `tab_${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`;
  return device;
}

/** The Mehfil socket: the queue, who is here, and whether this tab is the speaker. */
export function useMehfil(partyId: string) {
  const [tab] = useState(tabDevice);
  const [latest, setLatest] = useState<MehfilMessage | null>(null);
  const onMessage = useCallback((message: ServerMessage) => {
    // Presence changes repeat the same seq; only an older state is stale.
    if (message.t === 'mehfil') setLatest((now) => (now && now.seq > message.seq ? now : message));
  }, []);
  const { status, request } = useRealtime(
    partyId,
    'mehfil',
    onMessage,
    tab ? { device: tab } : undefined,
  );
  return { latest, status, request };
}

export type MehfilRequest = ReturnType<typeof useMehfil>['request'];
