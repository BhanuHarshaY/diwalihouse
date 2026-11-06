import type { Metadata } from 'next';
import { CardRoomLobby } from '@/cards/CardRoomLobby';
import { PageShell } from '@/components/PageShell';
import { MemberGate } from '@/party/MemberGate';

export const metadata: Metadata = { title: 'The Card Room', robots: { index: false } };

export default async function CardRoomPage({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  return (
    <MemberGate partyId={partyId}>
      <PageShell width="wide" back={{ href: `/party/${partyId}`, label: 'Back to the party' }}>
        <header className="mb-10 grid gap-2">
          <p className="type-eyebrow text-marigold-400">Teen Patti</p>
          <h1 className="type-masthead-lg">The Card Room</h1>
          <p lang="hi" className="type-story-lg text-marigold-200">
            ताश घर
          </p>
        </header>
        <CardRoomLobby partyId={partyId} />
      </PageShell>
    </MemberGate>
  );
}
