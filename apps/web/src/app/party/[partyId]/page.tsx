import type { Metadata } from 'next';
import { ClosedDoor } from '@/components/ClosedDoor';
import { PageShell } from '@/components/PageShell';
import { PartyHall } from '@/party/PartyHall';
import { PartyProviders } from '@/party/PartyProviders';
import { db } from '@/server/db';
import { serverEnv } from '@/server/env';
import { isDomainError } from '@/server/errors';
import { getPartySnapshot } from '@/server/parties/service';
import { getMemberContext } from '@/server/session-cookie';

export const metadata: Metadata = { title: 'The party', robots: { index: false } };

export default async function PartyPage({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const ctx = await getMemberContext(partyId);
  const snapshot = ctx
    ? await getPartySnapshot(db(), ctx).catch((error: unknown) => {
        if (isDomainError(error) && error.code === 'not_authenticated') return null;
        throw error;
      })
    : null;

  if (!snapshot) {
    return (
      <PageShell>
        <ClosedDoor />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PartyProviders>
        <PartyHall initial={snapshot} origin={serverEnv().PUBLIC_APP_URL} />
      </PartyProviders>
    </PageShell>
  );
}
