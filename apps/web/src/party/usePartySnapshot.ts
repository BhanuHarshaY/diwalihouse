'use client';

import { apiErrorSchema, partySnapshotSchema, type PartySnapshot } from '@diwali/contracts';
import { useQuery } from '@tanstack/react-query';

export class SnapshotError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export const partyQueryKey = (partyId: string) => ['party', partyId] as const;

/**
 * Polls the party snapshot every few seconds. This is an honest stopgap
 * until the realtime service (docs/architecture.md § Realtime) pushes
 * presence; the UI says "updates every few seconds" rather than "live".
 */
export function usePartySnapshot(initial: PartySnapshot) {
  return useQuery({
    queryKey: partyQueryKey(initial.party.id),
    initialData: initial,
    refetchInterval: 5_000,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/parties/${initial.party.id}`, {
        signal,
        cache: 'no-store',
        headers: { accept: 'application/json' },
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const parsed = apiErrorSchema.safeParse(body);
        throw new SnapshotError(
          response.status,
          parsed.success ? parsed.data.error.code : 'internal',
        );
      }
      return partySnapshotSchema.parse(body);
    },
  });
}
