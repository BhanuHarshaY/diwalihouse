import { formatInviteCode, normalizeInviteCode } from '@diwali/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ClosedDoor } from '@/components/ClosedDoor';
import { GuestCardForm } from '@/components/GuestCardForm';
import { PageShell } from '@/components/PageShell';
import { db } from '@/server/db';
import { isDomainError } from '@/server/errors';
import { previewInvite } from '@/server/parties/service';
import { assertNotRateLimited, recordInviteMiss } from '@/server/request';
import { getMemberContext } from '@/server/session-cookie';

// Kept generic on purpose: link unfurlers should not learn party names.
export const metadata: Metadata = { title: "You're invited", robots: { index: false } };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeInviteCode(safeDecode(raw));
  if (!code) return <NotFound />;
  if (code !== raw) redirect(`/join/${code}`);

  try {
    // Only failed lookups count, so a household arriving together is never
    // locked out, while guessing codes runs out of budget quickly.
    await assertNotRateLimited('inviteMiss');
  } catch (error) {
    if (isDomainError(error) && error.code === 'rate_limited') {
      return (
        <PageShell back={{ href: '/', label: 'Home' }}>
          <ClosedDoor title="Slow down a little" message={error.message} />
        </PageShell>
      );
    }
    throw error;
  }

  const invite = await previewInvite(db(), code);
  if (!invite) {
    await recordInviteMiss();
    return <NotFound />;
  }

  // Already a guest from this browser: go straight back in.
  if (await getMemberContext(invite.partyId)) redirect(`/party/${invite.partyId}`);

  return (
    <PageShell back={{ href: '/', label: 'Home' }}>
      <div className="mb-8 text-center">
        <p className="type-eyebrow text-marigold-400">
          Invitation <span className="type-numeral">{formatInviteCode(code)}</span>
        </p>
        <h1 className="type-masthead-lg mt-3">{invite.partyName}</h1>
        <p className="type-story-lg mt-3 text-[color:var(--ink-on-night-muted)]">
          {invite.hostName} invites you in.{' '}
          {invite.memberCount === 1
            ? 'You will be the first guest.'
            : `${invite.memberCount} people are already in the house.`}
        </p>
      </div>
      {invite.joinable ? (
        <GuestCardForm mode="join" code={code} partyName={invite.partyName} />
      ) : (
        <ClosedDoor
          title="The doors are shut for now"
          message="This party is not taking more guests at the moment. Let your host know."
        />
      )}
    </PageShell>
  );
}

function NotFound() {
  return (
    <PageShell back={{ href: '/', label: 'Home' }}>
      <ClosedDoor
        title="This invitation has expired"
        message="The code may have been replaced by the host, or mistyped. Ask your host for a fresh invitation link."
      />
    </PageShell>
  );
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
