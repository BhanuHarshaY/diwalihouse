'use client';

import type { GameKind, Profile, ServerMessage } from '@diwali/realtime-protocol';
import { useCallback, useRef, useState } from 'react';
import { useRealtime } from './useRealtime';

export interface GameRoomState {
  kind: GameKind | null;
  view: unknown;
  profiles: Record<string, Profile>;
  /** Recent events, newest first. */
  events: unknown[];
}

const EVENT_LIMIT = 30;

/** One game's socket: the latest private view, the cast, and what just happened. */
export function useGameRoom(partyId: string, game: string) {
  const [room, setRoom] = useState<GameRoomState>({
    kind: null,
    view: null,
    profiles: {},
    events: [],
  });
  const lastSeq = useRef(-1);
  const onMessage = useCallback((message: ServerMessage) => {
    if (message.t !== 'view') return;
    const fresh = message.seq > lastSeq.current ? [...message.events].reverse() : [];
    lastSeq.current = Math.max(lastSeq.current, message.seq);
    setRoom((current) => ({
      kind: message.kind,
      view: message.view,
      profiles: message.profiles,
      events: [...fresh, ...current.events].slice(0, EVENT_LIMIT),
    }));
  }, []);
  const { status, request } = useRealtime(partyId, `games/${game}`, onMessage);
  return { ...room, status, request };
}

export type GameRequest = ReturnType<typeof useGameRoom>['request'];
