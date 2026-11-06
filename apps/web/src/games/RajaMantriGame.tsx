'use client';

import type { RajaMantriClientAction } from '@diwali/realtime-protocol';
import {
  ROLE_LABEL,
  ROLE_POINTS,
  type RajaMantriEvent,
  type RajaMantriView,
  type Role,
} from '@diwali/raja-mantri';
import { useState } from 'react';
import { Button } from '@/design-system/Button';
import { Emblem } from '@/design-system/emblems/Emblem';
import styles from './games.module.css';
import { emblemOf, nameOf, type GameProps } from './shared';

const ERRORS: Record<string, string> = {
  'need-four': 'Raja Mantri needs exactly four players.',
  'not-host': 'Only the host can do that.',
  'game-full': 'All four seats are taken.',
};

function describe(event: RajaMantriEvent, name: (id: string) => string): string {
  switch (event.type) {
    case 'joined':
      return `${name(event.player)} drew up a seat.`;
    case 'left':
      return `${name(event.player)} left.`;
    case 'dealt':
      return `Round ${event.round}: ${name(event.raja)} is the Raja. “Mantri, find the Chor!” ${name(event.mantri)} must choose.`;
    case 'accused':
      return event.correct
        ? `${name(event.mantri)} caught the Chor: ${name(event.accused)}.`
        : `${name(event.mantri)} accused ${name(event.accused)}, the Sipahi. The Chor escaped with 800!`;
    case 'finished':
      return `Game over. ${event.winners.map(name).join(' and ')} won.`;
  }
}

function Chit({
  name,
  emblem,
  role,
  mine,
}: {
  name: string;
  emblem: ReturnType<typeof emblemOf>;
  role: Role | null;
  mine: boolean;
}) {
  return (
    <div className={styles.chit} data-hidden={role ? undefined : ''} data-mine={mine || undefined}>
      <Emblem id={emblem} size={40} />
      <p className={styles.chitName}>
        {name}
        {mine ? ' (you)' : ''}
      </p>
      {role ? (
        <>
          <p className={styles.chitRole} data-role={role}>
            {ROLE_LABEL[role].en}
          </p>
          <p lang="hi" className={styles.chitHi}>
            {ROLE_LABEL[role].hi}
          </p>
          <p className="text-sm">{ROLE_POINTS[role]} points</p>
        </>
      ) : (
        <p className={styles.chitRole} aria-label="Hidden chit">
          ?
        </p>
      )}
    </div>
  );
}

export function RajaMantriGame({
  view,
  profiles,
  events,
  status,
  request,
}: GameProps<RajaMantriView>) {
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const me = view.me;
  const name = (id: string) => nameOf(profiles, id);
  const log = (events as RajaMantriEvent[]).map((e) => describe(e, name)).slice(0, 10);
  const mantri = Object.entries(view.known).find(([, r]) => r === 'mantri')?.[0];
  const ranked = [...view.players].sort((a, b) => b.score - a.score);

  async function act(action: RajaMantriClientAction) {
    setBusy(true);
    setNotice(null);
    const result = await request({ t: 'action', action });
    setBusy(false);
    if (!result.ok) setNotice(ERRORS[result.error] ?? 'That isn’t possible right now.');
  }

  return (
    <div className={styles.screen}>
      <div className={styles.main}>
        <header className={styles.header}>
          <p className="type-eyebrow">Game Bazaar</p>
          <h2 className="type-masthead-lg">Raja Mantri Chor Sipahi</h2>
          <p lang="hi" className={styles.hi}>
            राजा मंत्री चोर सिपाही
          </p>
        </header>

        {view.phase === 'lobby' ? (
          <section className={styles.panel} aria-label="Players">
            <p className={styles.panelTitle}>{view.players.length} of 4 seated</p>
            <p className={styles.muted}>
              Four chits, four players, {view.config.rounds} rounds. The Mantri must find the Chor.
              Get it right and keep 800; get it wrong and the Chor takes them.
            </p>
            <ul className={styles.people}>
              {view.players.map((p) => (
                <li key={p.id} className={styles.person}>
                  <Emblem id={emblemOf(profiles, p.id)} size={28} /> {p.name}
                </li>
              ))}
            </ul>
            <div className={styles.actions}>
              {me.can.join ? (
                <Button tone="marigold" disabled={busy} onClick={() => act({ type: 'join' })}>
                  Take a seat
                </Button>
              ) : null}
              {me.can.leave ? (
                <Button
                  tone="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => act({ type: 'leave' })}
                >
                  Leave
                </Button>
              ) : null}
              {me.can.start ? (
                <Button tone="vermilion" disabled={busy} onClick={() => act({ type: 'start' })}>
                  Shuffle the chits
                </Button>
              ) : null}
            </div>
          </section>
        ) : (
          <section className={styles.panel} aria-label={`Round ${view.round}`}>
            <p className={styles.panelTitle}>
              Round {view.round} of {view.config.rounds}
            </p>
            <div className={styles.chits}>
              {view.players.map((p) => {
                const mine = p.id === me.id;
                const role = view.known[p.id] ?? (mine ? me.role : null);
                return (
                  <Chit
                    key={p.id}
                    name={p.name}
                    emblem={emblemOf(profiles, p.id)}
                    role={role}
                    mine={mine}
                  />
                );
              })}
            </div>

            {view.phase === 'guessing' ? (
              me.can.accuse.length ? (
                <div className="grid gap-3">
                  <p className={styles.good}>You’re the Mantri. Which of these two is the Chor?</p>
                  <div className={styles.actions}>
                    {me.can.accuse.map((id) => (
                      <Button
                        key={id}
                        tone="marigold"
                        disabled={busy}
                        onClick={() => act({ type: 'accuse', accused: id })}
                      >
                        {name(id)} is the Chor
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className={styles.muted}>
                  {mantri
                    ? `${name(mantri)} is deciding who the Chor is…`
                    : 'Waiting for the Mantri…'}
                  {me.role === 'chor' ? ' Keep a straight face.' : ''}
                </p>
              )
            ) : null}

            {view.last && view.phase !== 'guessing' ? (
              <div className="grid gap-2">
                <p className={styles.winnerLine}>
                  {view.last.correct ? 'The Chor is caught!' : 'The Chor got away!'}
                </p>
                <p className={styles.muted}>
                  This round:{' '}
                  {view.players
                    .map((p) => `${p.name} +${view.last!.points[p.id] ?? 0}`)
                    .join(' · ')}
                </p>
              </div>
            ) : null}

            {view.phase === 'finished' ? (
              <p className={styles.good}>Final scores are in: {ranked[0]?.name} leads the court.</p>
            ) : null}

            <div className={styles.actions}>
              {me.can.next ? (
                <Button tone="vermilion" disabled={busy} onClick={() => act({ type: 'next' })}>
                  {view.round >= view.config.rounds ? 'See the final scores' : 'Next round'}
                </Button>
              ) : null}
            </div>
          </section>
        )}
        <p className={styles.notice} aria-live="polite">
          {notice ?? (status !== 'open' ? 'Reconnecting…' : '')}
        </p>
      </div>

      <aside className={styles.side}>
        <section className={styles.panel} aria-label="Scores">
          <p className={styles.panelTitle}>Scores</p>
          <ol className={styles.scores}>
            {ranked.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <span className={styles.points}>{p.score}</span>
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
