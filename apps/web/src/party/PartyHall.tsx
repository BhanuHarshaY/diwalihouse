'use client';

import { formatInviteCode, type MemberView, type PartySnapshot } from '@diwali/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState, useSyncExternalStore, useTransition, type ReactNode } from 'react';
import { ClosedDoor } from '@/components/ClosedDoor';
import { Button } from '@/design-system/Button';
import { ConfirmDialog } from '@/design-system/Dialog';
import { Emblem } from '@/design-system/emblems/Emblem';
import { Frame } from '@/design-system/Frame';
import { FriendsArriving } from '@/illustrations/gatherings';
import { Playable } from '@/illustrations/Playable';
import { leavePartyAction, removeMemberAction, rotateInviteAction } from '@/server/actions';
import { usePartyRoom } from '@/realtime/usePartyRoom';
import { InviteQr } from './InviteQr';
import styles from './party.module.css';
import { RoomsOfHouse } from './RoomsOfHouse';
import { partyQueryKey, SnapshotError, usePartySnapshot } from './usePartySnapshot';

export function PartyHall({ initial, origin }: { initial: PartySnapshot; origin: string }) {
  const query = usePartySnapshot(initial);
  const snapshot = query.data;
  const presence = usePartyRoom(initial.party.id);
  const online = presence.members ? new Set(presence.members.map((m) => m.member)) : null;

  if (query.error instanceof SnapshotError && query.error.status === 401) {
    return (
      <ClosedDoor
        title="You are no longer in this party"
        message="The host may have removed you, or you left from another tab. If that was a mistake, ask the host for the invitation again."
      />
    );
  }

  const isHost = snapshot.me.role === 'host';
  const host = snapshot.members.find((member) => member.role === 'host');
  const inviteUrl = snapshot.invite ? `${origin}/join/${snapshot.invite.code}` : null;

  return (
    <div className={styles.hall}>
      <header className={styles.masthead}>
        <p className={`type-eyebrow ${styles.live}`}>
          <span className={styles.liveDot} aria-hidden />
          The house is open
        </p>
        <h1 className="type-masthead-lg">{snapshot.party.name}</h1>
        <p className="type-story-lg text-[color:var(--ink-on-night-muted)]">
          {host ? `Hosted by ${host.displayName}` : null}
          {' · '}
          {snapshot.members.length === 1 ? 'one person' : `${snapshot.members.length} people`} in
          the house
        </p>
      </header>

      <div className={styles.columns}>
        <div className={styles.primary}>
          <GuestList snapshot={snapshot} isHost={isHost} online={online} />
          <RoomsOfHouse partyId={snapshot.party.id} />
        </div>
        <aside
          className={styles.secondary}
          aria-label="Invitation"
          data-has-invite={snapshot.invite ? '' : undefined}
        >
          {inviteUrl && snapshot.invite ? (
            <InviteStamp
              partyId={snapshot.party.id}
              code={snapshot.invite.code}
              url={inviteUrl}
              isHost={isHost}
            />
          ) : (
            <Frame variant="night" className={styles.askHost}>
              <p className={`type-eyebrow ${styles.askHostEyebrow}`}>Invitations</p>
              <p className="type-story">
                Invitations come from {host?.displayName ?? 'the host'}. Ask them if you would like
                to bring someone.
              </p>
            </Frame>
          )}
        </aside>
      </div>
      <SelfControls partyId={snapshot.party.id} isHost={isHost} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function GuestList({
  snapshot,
  isHost,
  online,
}: {
  snapshot: PartySnapshot;
  isHost: boolean;
  /** Members connected right now; null until realtime has answered (or if it's off). */
  online: Set<string> | null;
}) {
  const reduceMotion = useReducedMotion();
  const [removing, setRemoving] = useState<MemberView | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [alsoRotate, setAlsoRotate] = useState(false);
  const queryClient = useQueryClient();

  function confirmRemove() {
    if (!removing) return;
    const target = removing;
    startTransition(async () => {
      const result = await removeMemberAction(snapshot.party.id, target.id, alsoRotate);
      if (result.ok) {
        setRemoving(null);
        setError(null);
        setAlsoRotate(false);
        await queryClient.invalidateQueries({ queryKey: partyQueryKey(snapshot.party.id) });
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <section aria-labelledby="guests-title">
      <div className={styles.sectionHead}>
        <h2 id="guests-title" className="type-title">
          In the house
        </h2>
        <p className="type-small text-[color:var(--ink-on-night-muted)]">
          Updates every few seconds
        </p>
      </div>
      <ul className={styles.guests}>
        <AnimatePresence initial={false}>
          {snapshot.members.map((member) => {
            const isMe = member.id === snapshot.me.memberId;
            return (
              <motion.li
                key={member.id}
                className={styles.guest}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -16 }}
                transition={{ duration: 0.35, ease: [0.2, 0.7, 0.1, 1] }}
              >
                <Emblem id={member.emblem} size={48} />
                <div className={styles.guestText}>
                  <p className={styles.guestName}>
                    <span>{member.displayName}</span>
                    {isMe ? <span className={styles.you}> (you)</span> : null}
                    {online?.has(member.id) ? <span className={styles.here}>Here now</span> : null}
                  </p>
                  {member.role === 'host' ? (
                    <p className={`type-eyebrow ${styles.role}`}>
                      Host · <span lang="hi">मेज़बान</span>
                    </p>
                  ) : null}
                </div>
                {isHost && member.role === 'guest' ? (
                  <Button tone="outline" size="sm" onClick={() => setRemoving(member)}>
                    Remove
                  </Button>
                ) : null}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {snapshot.members.length === 1 && isHost ? (
        <div className={styles.waiting}>
          <Playable className={styles.waitingArt}>
            <FriendsArriving />
          </Playable>
          <div>
            <p className="type-title">You&apos;re the first one here</p>
            <p className="type-small text-[color:var(--ink-on-night-muted)]">
              Share the invitation and the house fills up as people arrive. They appear here a few
              seconds after they join.
            </p>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
            setError(null);
          }
        }}
        title={`Remove ${removing?.displayName ?? 'this guest'}?`}
        description={
          <>
            They leave the party straight away on every device. With the current invitation they
            could come back in.
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={alsoRotate}
                onChange={(event) => setAlsoRotate(event.target.checked)}
              />
              <span>Also make a new invitation code, so they can&apos;t rejoin</span>
            </label>
            {error ? <span className={styles.dialogError}>{error}</span> : null}
          </>
        }
        actions={
          <>
            <Button tone="ink" onClick={() => setRemoving(null)}>
              Keep them
            </Button>
            <Button tone="vermilion" pending={pending} onClick={confirmRemove}>
              Remove
            </Button>
          </>
        }
      />
    </section>
  );
}

// ---------------------------------------------------------------------------

function InviteStamp({
  partyId,
  code,
  url,
  isHost,
}: {
  partyId: string;
  code: string;
  url: string;
  isHost: boolean;
}) {
  const [status, setStatus] = useState('');
  const canShare = useSyncExternalStore(noSubscription, hasWebShare, () => false);
  const [rotating, setRotating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Invitation link copied.');
    } catch {
      setStatus('Copying is blocked here. Select the code and copy it instead.');
    }
  }

  async function share() {
    try {
      await navigator.share({ title: 'Diwali House invitation', url });
    } catch {
      // Dismissing the share sheet is not an error worth reporting.
    }
  }

  function rotate() {
    startTransition(async () => {
      const result = await rotateInviteAction(partyId);
      if (result.ok) {
        setRotating(false);
        setError(null);
        setStatus(
          `New invitation code ${formatInviteCode(result.data.code)}. The old code no longer works.`,
        );
        await queryClient.invalidateQueries({ queryKey: partyQueryKey(partyId) });
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <Frame variant="stamp" className={styles.stamp}>
      <p className={`type-eyebrow ${styles.stampEyebrow}`}>Invitation</p>
      <InviteQr url={url} className={styles.qr} />
      <p className={styles.codeLabel}>Code</p>
      <p className={`type-numeral ${styles.code}`} data-testid="invite-code">
        {formatInviteCode(code)}
      </p>
      <div className={styles.stampActions}>
        <Button tone="vermilion" block onClick={copy}>
          Copy link
        </Button>
        {canShare ? (
          <Button tone="ink" block onClick={share}>
            Share
          </Button>
        ) : null}
        {isHost ? (
          <Button tone="ink" size="sm" block onClick={() => setRotating(true)}>
            Make a new code
          </Button>
        ) : null}
      </div>
      <p className={styles.stampStatus} aria-live="polite">
        {status}
      </p>
      <ConfirmDialog
        open={rotating}
        onOpenChange={(open) => {
          setRotating(open);
          if (!open) setError(null);
        }}
        title="Make a new invitation code?"
        description={
          <>
            The current code, link and QR stop working immediately. Everyone already inside stays.
            {error ? <span className={styles.dialogError}>{error}</span> : null}
          </>
        }
        actions={
          <>
            <Button tone="ink" onClick={() => setRotating(false)}>
              Cancel
            </Button>
            <Button tone="vermilion" pending={pending} onClick={rotate}>
              Make new code
            </Button>
          </>
        }
      />
    </Frame>
  );
}

// ---------------------------------------------------------------------------

function SelfControls({ partyId, isHost }: { partyId: string; isHost: boolean }) {
  const [leaving, setLeaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isHost) {
    return (
      <Note>
        You are the host. Hosts can&apos;t leave their own party yet. Handing over to a co-host
        arrives in a later update.
      </Note>
    );
  }

  return (
    <div className={styles.self}>
      <Button tone="outline" size="sm" onClick={() => setLeaving(true)}>
        Leave the party
      </Button>
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title="Leave the party?"
        description={
          <>
            You will need the invitation again to come back.
            {error ? <span className={styles.dialogError}>{error}</span> : null}
          </>
        }
        actions={
          <>
            <Button tone="ink" onClick={() => setLeaving(false)}>
              Stay
            </Button>
            <Button
              tone="vermilion"
              pending={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await leavePartyAction(partyId);
                  // On success the action redirects; we only get here on failure.
                  if (result && !result.ok) setError(result.message);
                })
              }
            >
              Leave
            </Button>
          </>
        }
      />
    </div>
  );
}

const noSubscription = () => () => {};
const hasWebShare = () => typeof navigator.share === 'function';

function Note({ children }: { children: ReactNode }) {
  return <p className={`type-small ${styles.note}`}>{children}</p>;
}
