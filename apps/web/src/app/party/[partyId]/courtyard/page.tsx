import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { Courtyard } from '@/courtyard/Courtyard';
import { MemberGate } from '@/party/MemberGate';

export const metadata: Metadata = { title: 'Rangoli Courtyard', robots: { index: false } };

export default async function CourtyardPage({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  return (
    <MemberGate partyId={partyId}>
      <PageShell width="wide" back={{ href: `/party/${partyId}`, label: 'Back to the party' }}>
        <header className="mb-8 grid gap-2">
          <p className="type-eyebrow text-marigold-400">Draw together</p>
          <h1 className="type-masthead-lg">Rangoli Courtyard</h1>
          <p lang="hi" className="type-story-lg text-marigold-200">
            रंगोली आँगन
          </p>
        </header>
        <Courtyard partyId={partyId} />
      </PageShell>
    </MemberGate>
  );
}
