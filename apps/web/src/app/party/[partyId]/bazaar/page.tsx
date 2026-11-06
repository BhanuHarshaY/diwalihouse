import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { BazaarLobby } from '@/games/BazaarLobby';
import { MemberGate } from '@/party/MemberGate';

export const metadata: Metadata = { title: 'Game Bazaar', robots: { index: false } };

export default async function BazaarPage({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  return (
    <MemberGate partyId={partyId}>
      <PageShell width="wide" back={{ href: `/party/${partyId}`, label: 'Back to the party' }}>
        <header className="mb-10 grid gap-2">
          <p className="type-eyebrow text-marigold-400">Party games</p>
          <h1 className="type-masthead-lg">Game Bazaar</h1>
          <p lang="hi" className="type-story-lg text-marigold-200">
            खेल बाज़ार
          </p>
        </header>
        <BazaarLobby partyId={partyId} />
      </PageShell>
    </MemberGate>
  );
}
