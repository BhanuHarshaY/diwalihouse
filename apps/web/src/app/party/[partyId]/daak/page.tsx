import type { Metadata } from 'next';
import { ClosedDoor } from '@/components/ClosedDoor';
import { PageShell } from '@/components/PageShell';
import { Daak } from '@/daak/Daak';
import { PartyProviders } from '@/party/PartyProviders';
import { db } from '@/server/db';
import { isDomainError } from '@/server/errors';
import { getDaak } from '@/server/parties/service';
import { getMemberContext } from '@/server/session-cookie';

export const metadata: Metadata = { title: 'Diwali Daak', robots: { index: false } };

export default async function DaakPage({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const ctx = await getMemberContext(partyId);
  const daak = ctx
    ? await getDaak(db(), ctx).catch((error: unknown) => {
        if (isDomainError(error) && error.code === 'not_authenticated') return null;
        throw error;
      })
    : null;

  if (!daak) {
    return (
      <PageShell>
        <ClosedDoor />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide" back={{ href: `/party/${partyId}`, label: 'Back to the party' }}>
      <header className="mb-8 grid gap-2">
        <p className="type-eyebrow text-marigold-400">The guestbook</p>
        <h1 className="type-masthead-lg">Diwali Daak</h1>
        <p lang="hi" className="type-story-lg text-marigold-200">
          दिवाली डाक
        </p>
      </header>
      <PartyProviders>
        <Daak initial={daak} partyId={partyId} />
      </PartyProviders>
    </PageShell>
  );
}
