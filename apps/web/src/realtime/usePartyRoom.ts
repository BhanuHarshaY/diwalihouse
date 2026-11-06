'use client';

import type { GameSummary, PresenceMember, ServerMessage } from '@diwali/realtime-protocol';
import { useCallback, useState } from 'react';
import { useRealtime } from './useRealtime';

/** Live presence and the game directory for a party. */
export function usePartyRoom(partyId: string) {
  const [members, setMembers] = useState<PresenceMember[] | null>(null);
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const onMessage = useCallback((message: ServerMessage) => {
    if (message.t === 'presence') setMembers(message.members);
    if (message.t === 'games') setGames(message.games);
  }, []);
  const { status, request } = useRealtime(partyId, null, onMessage);
  return { status, members, games, request };
}
