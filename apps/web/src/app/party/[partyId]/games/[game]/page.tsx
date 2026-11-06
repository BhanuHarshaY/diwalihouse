import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/PageShell';
import { GameScreen } from '@/games/GameScreen';
import { MemberGate } from '@/party/MemberGate';

export const metadata: Metadata = { title: 'Game', robots: { index: false } };

export default async function GamePage({
  params,
}: {
  params: Promise<{ partyId: string; game: string }>;
}) {
  const { partyId, game } = await params;
  if (!/^[a-z0-9]{4,16}$/.test(game)) notFound();
  return (
    <MemberGate partyId={partyId}>
      <PageShell width="wide" back={{ href: `/party/${partyId}`, label: 'Back to the party' }}>
        <GameScreen partyId={partyId} game={game} />
      </PageShell>
    </MemberGate>
  );
}
