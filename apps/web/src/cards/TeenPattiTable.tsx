'use client';

import type { Profile, TableAction } from '@diwali/realtime-protocol';
import type { Card, TableEvent, TableView } from '@diwali/teen-patti';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/design-system/Button';
import { Emblem } from '@/design-system/emblems/Emblem';
import { emblemOf, nameOf, useCountdown, type GameProps } from '@/games/shared';
import styles from './cards.module.css';
import { PlayingCard } from './PlayingCard';

const ERRORS: Record<string, string> = {
  'not-your-turn': 'It’s not your turn yet.',
  'bet-out-of-range': 'That bet is outside the table’s limits.',
  'insufficient-chips': 'You don’t have enough chips for that.',
  'show-not-allowed': 'A show isn’t allowed right now.',
  'sideshow-not-allowed': 'A sideshow isn’t allowed right now.',
  'not-enough-players': 'Two seated players with chips are needed to deal.',
  'not-host': 'Only the host can do that.',
  'table-full': 'This table is full.',
  'hand-in-progress': 'Wait for this hand to finish.',
  'awaiting-sideshow': 'Waiting for the sideshow answer.',
  timeout: 'No answer from the table. Check your connection.',
};

function describe(event: TableEvent, profiles: Record<string, Profile>): string | null {
  const n = (id: string) => nameOf(profiles, id);
  switch (event.type) {
    case 'sat':
      return `${n(event.player)} sat down.`;
    case 'left':
      return `${n(event.player)} left the table.`;
    case 'topped-up':
      return `${n(event.player)} was topped up by ${event.amount}.`;
    case 'dealt':
      return `Hand ${event.hand} dealt. Everyone put in the boot of ${event.boot}.`;
    case 'saw':
      return `${n(event.player)} looked at their cards.`;
    case 'bet':
      return `${n(event.player)} ${event.blind ? 'played blind' : 'played chaal'}: ${event.amount}.`;
    case 'packed':
      return `${n(event.player)} packed${
        event.reason === 'timeout'
          ? ' (out of time)'
          : event.reason === 'sideshow'
            ? ' after the sideshow'
            : ''
      }.`;
    case 'show':
      return `${n(event.player)} asked ${n(event.against)} for a show.`;
    case 'sideshow-requested':
      return `${n(event.from)} asked ${n(event.to)} for a sideshow.`;
    case 'sideshow-declined':
      return `${n(event.to)} ${event.reason === 'timeout' ? 'didn’t answer' : 'declined'} the sideshow.`;
    case 'sideshow-accepted':
      return `${n(event.to)} accepted the sideshow.`;
    case 'won': {
      const who = event.winners.map(n).join(' and ');
      const how =
        event.reason === 'show'
          ? ' at the show'
          : event.reason === 'pot-limit'
            ? ' when the pot limit forced a show'
            : '';
      return `${who} won ${event.pot}${how}.`;
    }
  }
}

export function TeenPattiTable({
  partyId,
  view,
  profiles,
  events,
  status,
  request,
}: GameProps<TableView>) {
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const log = (events as TableEvent[])
    .map((e) => describe(e, profiles))
    .filter((line): line is string => !!line)
    .slice(0, 12);

  async function act(action: TableAction) {
    setBusy(true);
    setNotice(null);
    const result = await request({ t: 'action', action });
    setBusy(false);
    if (!result.ok) setNotice(ERRORS[result.error] ?? 'That move isn’t allowed right now.');
  }

  const seconds = useCountdown(view?.hand?.result ? null : (view?.hand?.deadline ?? null));

  const me = view.me;
  const hand = view.hand;
  const result = hand?.result ?? null;
  const others = view.seats.filter((s) => s.id !== me.id);
  const mySeat = view.seats.find((s) => s.id === me.id);
  const turnName = hand?.turn ? nameOf(profiles, hand.turn) : null;
  const myTurn = hand?.turn === me.id && !result;
  const can = me.can;
  const blind = mySeat?.status === 'blind';

  return (
    <div className={styles.room}>
      <div className={styles.felt}>
        <p className={`type-eyebrow ${styles.tableMeta}`}>
          Boot {view.config.boot} · Chaal limit {view.config.chaalLimit}
          {hand ? ` · Hand ${hand.number}` : ''}
        </p>

        <ul className={styles.opponents} aria-label="Players">
          {others.map((seat) => {
            const turn = hand?.turn === seat.id && !result;
            const revealed = result?.revealed[seat.id];
            const inHand = hand?.order.includes(seat.id);
            return (
              <li
                key={seat.id}
                className={styles.seat}
                data-turn={turn || undefined}
                data-status={seat.status}
              >
                <div className={styles.seatTop}>
                  <Emblem id={emblemOf(profiles, seat.id)} size={40} />
                  {hand?.dealer === seat.id ? (
                    <span className={styles.dealer} title="Dealer">
                      D
                    </span>
                  ) : null}
                </div>
                <p className={styles.seatName}>{seat.name}</p>
                <p className={`type-numeral ${styles.seatStack}`}>{seat.stack}</p>
                <p className={`type-eyebrow ${styles.seatStatus}`}>
                  {turn && seconds !== null ? `${seconds}s` : statusLabel(seat.status)}
                </p>
                {inHand ? (
                  <div className={styles.seatCards}>
                    {[0, 1, 2].map((i) => (
                      <PlayingCard
                        key={i}
                        size="sm"
                        card={(revealed?.[i] as Card | undefined) ?? null}
                        dealtIndex={i}
                      />
                    ))}
                  </div>
                ) : null}
                {revealed && result?.labels[seat.id] ? (
                  <p className={styles.handLabel}>{result.labels[seat.id]}</p>
                ) : null}
              </li>
            );
          })}
          {others.length === 0 ? (
            <li className={styles.empty}>Waiting for players to sit down.</li>
          ) : null}
        </ul>

        <div className={styles.pot} aria-live="polite">
          {result ? (
            <p className={styles.winner}>
              {result.winners.map((id) => nameOf(profiles, id)).join(' and ')} won {hand!.pot}
            </p>
          ) : hand ? (
            <>
              <p className="type-eyebrow">Pot</p>
              <p className={`type-numeral ${styles.potValue}`}>{hand.pot}</p>
              <p className={styles.stake}>Stake {hand.stake}</p>
            </>
          ) : (
            <p className={styles.stake}>
              {view.seats.length < 2 ? 'Two players needed to deal.' : 'Ready to deal.'}
            </p>
          )}
        </div>
      </div>

      <section className={styles.mine} aria-label="Your seat" data-turn={myTurn || undefined}>
        {mySeat ? (
          <>
            <div className={styles.mineHeader}>
              <Emblem id={emblemOf(profiles, me.id)} size={44} />
              <div>
                <p className={styles.seatName}>You{hand?.dealer === me.id ? ' · dealer' : ''}</p>
                <p className={`type-numeral ${styles.seatStack}`}>{mySeat.stack} chips</p>
              </div>
              <p className={`type-eyebrow ${styles.mineStatus}`}>
                {myTurn
                  ? `Your turn · ${seconds ?? ''}s`
                  : turnName && !result
                    ? `${turnName}’s turn`
                    : statusLabel(mySeat.status)}
              </p>
            </div>
            {me.inHand ? (
              <div className={styles.myCards}>
                {[0, 1, 2].map((i) => (
                  <PlayingCard
                    key={i}
                    size="lg"
                    card={(me.cards?.[i] as Card | undefined) ?? null}
                    dealtIndex={i}
                  />
                ))}
              </div>
            ) : null}
            {me.label ? <p className={styles.handLabel}>{me.label}</p> : null}
            {me.sideshowReveal ? (
              <p className={styles.sideshowNote}>
                Sideshow: {nameOf(profiles, me.sideshowReveal.loser)} had the lower hand and packed.
              </p>
            ) : null}
          </>
        ) : (
          <p className={styles.watching}>You’re watching. Take a seat to play.</p>
        )}

        {can.replySideshow && hand?.sideshow ? (
          <div className={styles.prompt} role="alert">
            <p>
              {nameOf(profiles, hand.sideshow.from)} asks you for a sideshow: compare hands
              privately, lower hand packs.
            </p>
            <div className={styles.actions}>
              <Button
                tone="marigold"
                disabled={busy}
                onClick={() => act({ type: 'sideshow-reply', accept: true })}
              >
                Accept
              </Button>
              <Button
                tone="outline"
                disabled={busy}
                onClick={() => act({ type: 'sideshow-reply', accept: false })}
              >
                Decline
              </Button>
            </div>
          </div>
        ) : null}

        <div className={styles.actions}>
          {can.sit ? (
            <Button tone="marigold" disabled={busy} onClick={() => act({ type: 'sit' })}>
              Take a seat ({view.config.buyIn} chips)
            </Button>
          ) : null}
          {can.deal ? (
            <Button tone="marigold" disabled={busy} onClick={() => act({ type: 'deal' })}>
              {result ? 'Deal the next hand' : 'Deal'}
            </Button>
          ) : null}
          {can.see ? (
            <Button tone="outline" disabled={busy} onClick={() => act({ type: 'see' })}>
              See cards
            </Button>
          ) : null}
          {can.bet ? (
            <Button
              tone="marigold"
              disabled={busy}
              onClick={() => act({ type: 'bet', amount: can.bet!.min })}
            >
              {blind ? 'Blind' : 'Chaal'} {can.bet.min}
            </Button>
          ) : null}
          {can.bet && can.bet.max > can.bet.min ? (
            <Button
              tone="marigold"
              disabled={busy}
              onClick={() => act({ type: 'bet', amount: can.bet!.max })}
            >
              Raise {can.bet.max}
            </Button>
          ) : null}
          {can.show !== null ? (
            <Button tone="outline" disabled={busy} onClick={() => act({ type: 'show' })}>
              Show ({can.show})
            </Button>
          ) : null}
          {can.sideshow ? (
            <Button tone="outline" disabled={busy} onClick={() => act({ type: 'sideshow' })}>
              Sideshow with {nameOf(profiles, can.sideshow)}
            </Button>
          ) : null}
          {can.pack && myTurn ? (
            <Button tone="outline" disabled={busy} onClick={() => act({ type: 'pack' })}>
              Pack
            </Button>
          ) : null}
        </div>
        <p className={styles.notice} aria-live="polite">
          {notice ?? (status !== 'open' ? 'Reconnecting to the table…' : '')}
        </p>
      </section>

      <aside className={styles.log} aria-label="What happened">
        <p className="type-eyebrow">At the table</p>
        <ol>
          {log.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ol>
        <div className={styles.footer}>
          {can.leave && !(me.inHand && hand && !result && mySeat?.status !== 'packed') ? (
            <Button tone="outline" size="sm" onClick={() => act({ type: 'leave' })}>
              Leave table
            </Button>
          ) : null}
          <Link href={`/party/${partyId}/cards`} className={`type-label ${styles.back}`}>
            All tables
          </Link>
        </div>
        <p className={styles.virtual}>Virtual chips only. They have no cash value.</p>
      </aside>
    </div>
  );
}

function statusLabel(status: string) {
  return status === 'sitting-out'
    ? 'Waiting'
    : status === 'blind'
      ? 'Blind'
      : status === 'seen'
        ? 'Seen'
        : 'Packed';
}
