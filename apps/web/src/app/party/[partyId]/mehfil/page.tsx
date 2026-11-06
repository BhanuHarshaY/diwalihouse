import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { Mehfil } from '@/mehfil/Mehfil';
import { MemberGate } from '@/party/MemberGate';

export const metadata: Metadata = { title: 'Music Mehfil', robots: { index: false } };

export default async function MehfilPage({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  return (
    <MemberGate partyId={partyId}>
      <PageShell width="wide" back={{ href: `/party/${partyId}`, label: 'Back to the party' }}>
        <header className="mb-8 grid gap-2">
          <p className="type-eyebrow text-marigold-400">Requests welcome</p>
          <h1 className="type-masthead-lg">Music Mehfil</h1>
          <p lang="hi" className="type-story-lg text-marigold-200">
            संगीत महफ़िल
          </p>
        </header>
        <Mehfil partyId={partyId} />
      </PageShell>
    </MemberGate>
  );
}
