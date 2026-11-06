import { normalizeInviteCode } from '@diwali/contracts';
import { redirect } from 'next/navigation';
import { ClosedDoor } from '@/components/ClosedDoor';
import { PageShell } from '@/components/PageShell';

/** Target of the homepage code form when JavaScript is unavailable. */
export default async function JoinByQuery({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const { code } = await searchParams;
  const normalized = typeof code === 'string' ? normalizeInviteCode(code) : null;
  if (normalized) redirect(`/join/${normalized}`);
  return (
    <PageShell back={{ href: '/#enter', label: 'Back' }}>
      <ClosedDoor
        title="That code doesn't look right"
        message="Invitation codes have eight letters and numbers, like ABCD-1234. Check your invitation and try again."
      />
    </PageShell>
  );
}
