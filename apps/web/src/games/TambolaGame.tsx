'use client';

import type { TambolaClientAction } from '@diwali/realtime-protocol';
import {
  PRIZE_LABEL,
  PRIZE_POINTS,
  PRIZES,
  type PrizeId,
  type TambolaEvent,
  type TambolaView,
} from '@diwali/tambola';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/design-system/Button';
import { Emblem } from '@/design-system/emblems/Emblem';
import styles from './games.module.css';
import { emblemOf, nameOf, type GameProps } from './shared';

const DEVANAGARI = '०१२३४५६७८९';
const toDevanagari = (n: number) => String(n).replace(/\d/g, (d) => DEVANAGARI[Number(d)]!);

const ERRORS: Record<string, string> = {
  'not-called': 'That number hasn’t been called yet.',
  'already-won': 'Someone has already claimed that prize.',
  'not-host': 'Only the host can do that.',
  'no-players': 'At least one player needs to join first.',
  'not-in-lobby': 'The game has already started.',
};

function describe(event: TambolaEvent, name: (id: string) => string): string {
  switch (event.type) {
    case 'joined':
      return `${name(event.player)} took a ticket.`;
    case 'left':
      return `${name(event.player)} left.`;
    case 'started':
      return `Tickets are out. ${event.players} playing.`;
    case 'called':
      return `Number ${event.number}.`;
    case 'auto':
      return event.seconds
        ? `Calling automatically every ${event.seconds} seconds.`
        : 'Calling by hand.';
    case 'won':
      return `${name(event.player)} won ${PRIZE_LABEL[event.prize]} (+${event.points}).`;
    case 'bogey':
      return `${name(event.player)} claimed ${PRIZE_LABEL[event.prize]} too soon. Bogey!`;
    case 'finished':
      return event.reason === 'full-house'
        ? 'Full house! The game is over.'
        : 'All 90 numbers called.';
  }
}

export function TambolaGame({ view, profiles, events, status, request }: GameProps<TambolaView>) {
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoMark, setAutoMark] = useState(false);
  const me = view.me;
  const called = new Set(view.called);
  const name = (id: string) => nameOf(profiles, id);
  const log = (events as TambolaEvent[]).map((e) => describe(e, name)).slice(0, 12);
  const myLatest = (events as TambolaEvent[]).find(
    (e) => (e.type === 'won' || e.type === 'bogey') && e.player === me.id,
  );

  async function act(action: TambolaClientAction) {
    setBusy(true);
    setNotice(null);
    const result = await request({ t: 'action', action });
    setBusy(false);
    if (!result.ok) setNotice(ERRORS[result.error] ?? 'That isn’t possible right now.');
  }

  // Auto-mark: mark newly called numbers on my tickets, once each.
  const sent = useRef(new Set<string>());
  useEffect(() => {
    if (!autoMark || view.phase !== 'calling') return;
    me.tickets.forEach((ticket, t) => {
      for (const n of ticket.flat()) {
        if (n === null || !called.has(n) || me.marks[t]?.includes(n)) continue;
        const key = `${t}:${n}`;
        if (sent.current.has(key)) continue;
        sent.current.add(key);
        void request({ t: 'action', action: { type: 'mark', ticket: t, number: n } });
      }
    });
  });

  return (
    <div className={styles.screen}>
      <div className={styles.main}>
        <header className={styles.header}>
          <p className="type-eyebrow">Game Bazaar</p>
          <h2 className="type-masthead-lg">Tambola</h2>
          <p lang="hi" className={styles.hi}>
            तम्बोला
          </p>
        </header>

        {view.phase === 'lobby' ? (
          <section className={styles.panel} aria-label="Players">
            <p className={styles.panelTitle}>Waiting for the caller</p>
            <p className={styles.muted}>
              Each player gets {view.config.ticketsPerPlayer} ticket
              {view.config.ticketsPerPlayer === 1 ? '' : 's'}. Prizes: early five, each line, four
              corners and full house.
            </p>
            <ul className={styles.people}>
              {view.players.map((p) => (
                <li key={p.id} className={styles.person}>
                  <Emblem id={emblemOf(profiles, p.id)} size={28} /> {p.name}
                </li>
              ))}
              {view.players.length === 0 ? (
                <li className={styles.muted}>No one has a ticket yet.</li>
              ) : null}
            </ul>
            <div className={styles.actions}>
              {me.can.join ? (
                <Button tone="marigold" disabled={busy} onClick={() => act({ type: 'join' })}>
                  Take a ticket
                </Button>
              ) : null}
              {me.can.leave ? (
                <Button
                  tone="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => act({ type: 'leave' })}
                >
                  Give back my ticket
                </Button>
              ) : null}
              {me.can.start ? (
                <Button tone="vermilion" disabled={busy} onClick={() => act({ type: 'start' })}>
                  Hand out tickets and start
                </Button>
              ) : null}
            </div>
          </section>
        ) : (
          <section className={styles.panel} aria-label="Numbers called">
            <div className={styles.caller}>
              <div
                className={styles.ball}
                aria-live="polite"
                aria-label={view.last ? `Last number ${view.last}` : 'No number yet'}
              >
                <div className="grid justify-items-center">
                  <span className={styles.ballNumber}>{view.last ?? '–'}</span>
                  {view.last ? (
                    <span lang="hi" className={styles.ballHi}>
                      {toDevanagari(view.last)}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-2">
                <p className={styles.panelTitle}>
                  {view.phase === 'finished' ? 'Game over' : `${view.called.length} of 90 called`}
                </p>
                <div className={styles.actions}>
                  {me.can.call ? (
                    <Button tone="marigold" disabled={busy} onClick={() => act({ type: 'call' })}>
                      Call the next number
                    </Button>
                  ) : null}
                  {me.can.auto && view.phase === 'calling' ? (
                    <>
                      {[null, 8, 12].map((seconds) => (
                        <Button
                          key={String(seconds)}
                          tone={view.config.autoCallSeconds === seconds ? 'marigold' : 'outline'}
                          size="sm"
                          disabled={busy}
                          onClick={() => act({ type: 'auto', seconds })}
                        >
                          {seconds ? `Auto ${seconds}s` : 'By hand'}
                        </Button>
                      ))}
                    </>
                  ) : null}
                </div>
              </div>
            </div>
            <div className={styles.board} aria-label="Called numbers">
              {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => (
                <span
                  key={n}
                  className={styles.boardCell}
                  data-called={called.has(n) || undefined}
                  data-last={view.last === n || undefined}
                >
                  {n}
                </span>
              ))}
            </div>
          </section>
        )}

        {me.joined && view.phase !== 'lobby' ? (
          <section className={styles.panel} aria-label="Your tickets">
            <div className={styles.actions}>
              <p className={styles.panelTitle}>Your ticket{me.tickets.length > 1 ? 's' : ''}</p>
              <label className="ml-auto flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoMark}
                  onChange={(e) => setAutoMark(e.target.checked)}
                />
                Mark for me
              </label>
            </div>
            {me.tickets.map((ticket, t) => (
              <div key={t} className="grid gap-3">
                <div className={styles.ticket} role="grid" aria-label={`Ticket ${t + 1}`}>
                  {[0, 1, 2].flatMap((row) =>
                    ticket[row]!.map((n, col) => {
                      const marked = n !== null && me.marks[t]?.includes(n);
                      return (
                        <button
                          key={`${row}-${col}`}
                          type="button"
                          className={styles.slot}
                          disabled={n === null || view.phase !== 'calling'}
                          data-called={(n !== null && called.has(n)) || undefined}
                          data-marked={marked || undefined}
                          aria-pressed={n === null ? undefined : marked}
                          aria-label={n === null ? 'Blank' : `${n}${marked ? ', marked' : ''}`}
                          onClick={() => {
                            if (n === null) return;
                            if (marked) void act({ type: 'unmark', ticket: t, number: n });
                            else if (!called.has(n)) setNotice(`${n} hasn’t been called yet.`);
                            else void act({ type: 'mark', ticket: t, number: n });
                          }}
                        >
                          {n ?? ''}
                        </button>
                      );
                    }),
                  )}
                </div>
                {me.can.claim.length ? (
                  <div className={styles.actions}>
                    <span className={styles.muted}>Claim:</span>
                    {me.can.claim.map((prize) => (
                      <Button
                        key={prize}
                        tone="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => act({ type: 'claim', ticket: t, prize })}
                      >
                        {PRIZE_LABEL[prize]}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            <p className={styles.notice} aria-live="polite">
              {notice ??
                (myLatest?.type === 'won'
                  ? ''
                  : myLatest?.type === 'bogey'
                    ? `Not complete yet: your ${PRIZE_LABEL[myLatest.prize]} claim was a bogey.`
                    : status !== 'open'
                      ? 'Reconnecting…'
                      : '')}
            </p>
            {myLatest?.type === 'won' ? (
              <p className={styles.good}>
                You won {PRIZE_LABEL[myLatest.prize]}! +{myLatest.points}
              </p>
            ) : null}
          </section>
        ) : (
          <p className={styles.notice}>{notice}</p>
        )}
      </div>

      <aside className={styles.side}>
        <section className={styles.panel} aria-label="Prizes">
          <p className={styles.panelTitle}>Prizes</p>
          <ul className={styles.prizes}>
            {PRIZES.map((prize: PrizeId) => {
              const win = view.prizes[prize];
              return (
                <li key={prize} className={styles.prize}>
                  <span className={styles.prizeName}>
                    {PRIZE_LABEL[prize]}{' '}
                    <span className={styles.muted}>· {PRIZE_POINTS[prize]}</span>
                  </span>
                  <span className={win ? styles.good : styles.muted}>
                    {win ? win.name : 'Open'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
        <section className={styles.panel} aria-label="Points">
          <p className={styles.panelTitle}>Points</p>
          <ol className={styles.scores}>
            {view.players.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <span className={styles.points}>{p.points}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className={styles.panel} aria-label="What happened">
          <ol className={styles.log}>
            {log.map((line, i) => (
              <li key={`${i}-${line}`}>{line}</li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}
