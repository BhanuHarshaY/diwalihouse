'use client';

import {
  DAAK_LIMITS,
  POSTCARD_MESSAGE_MAX,
  POSTCARD_TO_MAX,
  STAMPS,
  type DaakSnapshot,
  type PostcardView,
  type StampId,
} from '@diwali/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useTransition, type FormEvent } from 'react';
import { ClosedDoor } from '@/components/ClosedDoor';
import { Button } from '@/design-system/Button';
import { ConfirmDialog, DialogClose } from '@/design-system/Dialog';
import { Frame } from '@/design-system/Frame';
import { TextArea, TextField } from '@/design-system/TextField';
import { ArchWindow } from '@/illustrations/ArchWindow';
import { Playable } from '@/illustrations/Playable';
import { ROOM_ART } from '@/illustrations/rooms';
import { SnapshotError } from '@/party/usePartySnapshot';
import {
  sendPostcardAction,
  setPostcardHiddenAction,
  withdrawPostcardAction,
} from '@/server/actions';
import { Postcard } from './Postcard';
import { STAMP_ART, Stamp } from './Stamps';
import { daakQueryKey, useDaak } from './useDaak';
import styles from './daak.module.css';

type Fields = Partial<Record<'to' | 'message' | 'stamp', string[] | undefined>>;

export function Daak({ initial, partyId }: { initial: DaakSnapshot; partyId: string }) {
  const query = useDaak(initial, partyId);
  const queryClient = useQueryClient();
  const daak = query.data;
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [stamp, setStamp] = useState<StampId>('diya');
  const [fields, setFields] = useState<Fields>({});
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [posting, startPosting] = useTransition();
  const [acting, startActing] = useTransition();
  const [withdrawing, setWithdrawing] = useState<PostcardView | null>(null);
  // Cards on the wall when the page opened; anything newer drops in.
  const [seen] = useState(() => new Set(initial.postcards.map((p) => p.id)));

  if (query.error instanceof SnapshotError && query.error.status === 401) {
    return (
      <ClosedDoor
        title="You are no longer in this party"
        message="You left, or the host removed you, so the Daak is closed to you now."
      />
    );
  }

  const isHost = daak.me.role === 'host';
  const full = daak.me.sent >= DAAK_LIMITS.perMember;
  const refresh = () => queryClient.invalidateQueries({ queryKey: daakQueryKey(partyId) });

  function post(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    startPosting(async () => {
      const result = await sendPostcardAction(partyId, { to, message, stamp });
      if (!result.ok) {
        setFields((result.fields as Fields | undefined) ?? {});
        setNotice({ tone: 'bad', text: result.message });
        return;
      }
      setFields({});
      setTo('');
      setMessage('');
      setNotice({ tone: 'good', text: 'Posted! It’s on the wall.' });
      await refresh();
    });
  }

  function moderate(card: PostcardView, action: 'withdraw' | 'hide' | 'show') {
    setNotice(null);
    startActing(async () => {
      const result =
        action === 'withdraw'
          ? await withdrawPostcardAction(partyId, card.id)
          : await setPostcardHiddenAction(partyId, card.id, action === 'hide');
      if (!result.ok) setNotice({ tone: 'bad', text: result.message });
      setWithdrawing(null);
      await refresh();
    });
  }

  return (
    <div className={styles.layout}>
      <Frame variant="paper" as="form" className={styles.compose} onSubmit={post}>
        <p className="type-eyebrow text-vermilion-700">Write a postcard</p>
        <TextField
          label="To (optional)"
          placeholder={`Everyone at ${daak.partyName}`}
          maxLength={POSTCARD_TO_MAX}
          value={to}
          errors={fields.to}
          onChange={(e) => setTo(e.target.value)}
        />
        <TextArea
          label="Message"
          hint="Any language, a few lines."
          required
          rows={5}
          maxLength={POSTCARD_MESSAGE_MAX}
          value={message}
          errors={fields.message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className={`type-small ${styles.counter}`} aria-live="off">
          {message.length} / {POSTCARD_MESSAGE_MAX}
        </p>
        <fieldset className={styles.stampPicker}>
          <legend className={`type-label ${styles.legend}`}>Choose a stamp</legend>
          <div className={styles.stamps}>
            {STAMPS.map((id) => (
              <label key={id} className={styles.stampChoice}>
                <input
                  type="radio"
                  name="stamp"
                  className="visually-hidden"
                  checked={stamp === id}
                  onChange={() => setStamp(id)}
                />
                <Stamp id={id} />
                <span className="type-small">{STAMP_ART[id].name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className={styles.composeFoot}>
          <Button
            type="submit"
            tone="vermilion"
            pending={posting}
            pendingLabel="Posting…"
            disabled={full}
          >
            Post it
          </Button>
          <p className={`type-small ${styles.muted}`}>
            {full
              ? `You have ${DAAK_LIMITS.perMember} postcards on the wall, the most one person can.`
              : `${daak.me.sent} of ${DAAK_LIMITS.perMember} sent. Everyone at the party can read them.`}
          </p>
        </div>
        <p
          className={`type-small ${notice?.tone === 'good' ? styles.good : styles.bad}`}
          aria-live="polite"
        >
          {notice?.text ?? ''}
        </p>
      </Frame>

      <section aria-labelledby="wall-title" className={styles.wall}>
        <p className={`type-masthead-md ${styles.printTitle}`}>Diwali Daak · {daak.partyName}</p>
        <div className={styles.wallHead}>
          <h2 id="wall-title" className="type-title">
            On the wall
          </h2>
          <p className={`type-small ${styles.muted}`}>
            {daak.postcards.length} postcard{daak.postcards.length === 1 ? '' : 's'} · new ones
            arrive every few seconds
          </p>
          {daak.postcards.length ? (
            <Button
              tone="outline"
              size="sm"
              className={styles.printButton}
              onClick={() => window.print()}
            >
              Print or save as PDF
            </Button>
          ) : null}
        </div>

        {daak.postcards.length === 0 ? (
          <div className={styles.empty}>
            <Playable className={styles.emptyWindow}>
              <ArchWindow id="daak-empty" colours={ROOM_ART.daak!.colours}>
                {ROOM_ART.daak!.motif}
              </ArchWindow>
            </Playable>
            <p className="type-story">
              The letterbox is empty. Write the first postcard of the night.
            </p>
          </div>
        ) : (
          <ul className={styles.cards}>
            {daak.postcards.map((card) => {
              const mine = card.from.memberId === daak.me.memberId;
              return (
                <li key={card.id}>
                  <Postcard
                    card={card}
                    partyName={daak.partyName}
                    fresh={!seen.has(card.id)}
                    footer={
                      mine || isHost ? (
                        <div className={styles.cardFoot}>
                          {card.hidden ? (
                            <p className={`type-small ${styles.hiddenNote}`}>
                              {isHost
                                ? 'Hidden from guests.'
                                : 'The host has hidden this card from the party.'}
                            </p>
                          ) : null}
                          {isHost ? (
                            <Button
                              tone="outline"
                              size="sm"
                              disabled={acting}
                              onClick={() => moderate(card, card.hidden ? 'show' : 'hide')}
                              aria-label={`${card.hidden ? 'Show' : 'Hide'} ${card.from.displayName}’s postcard`}
                            >
                              {card.hidden ? 'Show to guests' : 'Hide'}
                            </Button>
                          ) : null}
                          {mine ? (
                            <Button
                              tone="outline"
                              size="sm"
                              disabled={acting}
                              onClick={() => setWithdrawing(card)}
                            >
                              Withdraw
                            </Button>
                          ) : null}
                        </div>
                      ) : null
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={withdrawing !== null}
        onOpenChange={(open) => !open && setWithdrawing(null)}
        title="Take your postcard down?"
        description="It disappears from everyone’s wall."
        actions={
          <>
            <Button
              tone="vermilion"
              pending={acting}
              onClick={() => withdrawing && moderate(withdrawing, 'withdraw')}
            >
              Take it down
            </Button>
            <DialogClose asChild>
              <Button tone="outline">Keep it</Button>
            </DialogClose>
          </>
        }
      />
    </div>
  );
}
