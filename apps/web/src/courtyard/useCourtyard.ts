'use client';

import type { Folds, Stroke } from '@diwali/rangoli';
import type { PresenceMember, Profile, ServerMessage } from '@diwali/realtime-protocol';
import { useCallback, useRef, useState } from 'react';
import { useRealtime } from '@/realtime/useRealtime';

export interface CourtyardState {
  /** False until the whole rangoli has arrived. */
  ready: boolean;
  folds: Folds;
  edition: number;
  strokes: Stroke[];
  profiles: Record<string, Profile>;
  here: PresenceMember[];
  you: { member: string; role: 'host' | 'guest' } | null;
}

const EMPTY: CourtyardState = {
  ready: false,
  folds: 8,
  edition: 0,
  strokes: [],
  profiles: {},
  here: [],
  you: null,
};

type Snapshot = Extract<ServerMessage, { t: 'courtyard' }>;

/**
 * The courtyard socket. The rangoli arrives in parts on every (re)connect,
 * then changes follow in order; a change already counted in the snapshot
 * (its seq is not newer) is skipped.
 */
export function useCourtyard(partyId: string) {
  const [state, setState] = useState<CourtyardState>(EMPTY);
  const incoming = useRef<{ first: Snapshot; strokes: Stroke[] } | null>(null);
  const seq = useRef(0);

  const onMessage = useCallback((message: ServerMessage) => {
    switch (message.t) {
      case 'courtyard': {
        if (message.part === 0) incoming.current = { first: message, strokes: [] };
        const buffer = incoming.current;
        if (!buffer) return;
        buffer.strokes.push(...message.strokes);
        if (!message.done) return;
        incoming.current = null;
        seq.current = buffer.first.seq;
        const { folds, edition, profiles, you } = buffer.first;
        setState((s) => ({
          ...s,
          ready: true,
          folds,
          edition,
          profiles,
          you,
          strokes: buffer.strokes,
        }));
        return;
      }
      case 'drawn':
      case 'erased':
      case 'fresh': {
        if (message.seq <= seq.current) return;
        seq.current = message.seq;
        setState((s) => {
          if (message.t === 'drawn') return { ...s, strokes: [...s.strokes, message.stroke] };
          if (message.t === 'fresh') {
            return { ...s, strokes: [], folds: message.folds, edition: message.edition };
          }
          const gone = new Set(message.ids);
          return { ...s, strokes: s.strokes.filter((stroke) => !gone.has(stroke.id)) };
        });
        return;
      }
      case 'artists':
        setState((s) => ({ ...s, here: message.here, profiles: message.profiles }));
        return;
    }
  }, []);

  const { status, request } = useRealtime(partyId, 'courtyard', onMessage);
  return { ...state, status, request };
}

export type CourtyardRequest = ReturnType<typeof useCourtyard>['request'];
