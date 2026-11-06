'use client';

import { apiErrorSchema, daakSnapshotSchema, type DaakSnapshot } from '@diwali/contracts';
import { useQuery } from '@tanstack/react-query';
import { SnapshotError } from '@/party/usePartySnapshot';

export const daakQueryKey = (partyId: string) => ['daak', partyId] as const;

/**
 * The guestbook is asynchronous by design, so it is fetched, not pushed: a
 * new postcard appears on everyone's wall within a few seconds.
 */
export function useDaak(initial: DaakSnapshot, partyId: string) {
  return useQuery({
    queryKey: daakQueryKey(partyId),
    initialData: initial,
    refetchInterval: 8_000,
    retry: (count, error) => !(error instanceof SnapshotError && error.status === 401) && count < 3,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/parties/${partyId}/daak`, {
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
      return daakSnapshotSchema.parse(body);
    },
  });
}
