import type { ReactNode } from 'react';
import { ClosedDoor } from '@/components/ClosedDoor';
import { PageShell } from '@/components/PageShell';
import { getMemberContext } from '@/server/session-cookie';

/** Renders children only for an authenticated member of the party. */
export async function MemberGate({ partyId, children }: { partyId: string; children: ReactNode }) {
  const ctx = await getMemberContext(partyId);
  if (!ctx) {
    return (
      <PageShell>
        <ClosedDoor />
      </PageShell>
    );
  }
  return <>{children}</>;
}
