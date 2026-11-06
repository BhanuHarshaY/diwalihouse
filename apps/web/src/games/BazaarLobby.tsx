'use client';

import type { GameKind, GameOptions } from '@diwali/realtime-protocol';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/design-system/Button';
import { usePartyRoom } from '@/realtime/usePartyRoom';
import styles from './games.module.css';

type BazaarKind = Exclude<GameKind, 'teen-patti'>;

const GAMES: Array<{
  kind: BazaarKind;
  name: string;
  hi: string;
  line: string;
  players: string;
  choices: Array<{ label: string; options: GameOptions }>;
}> = [
  {
    kind: 'tambola',
    name: 'Tambola',
    hi: 'तम्बोला',
    line: 'The host calls the numbers; everyone marks their ticket and races to claim.',
    players: 'Any number of players',
    choices: [
      { label: '1 ticket each', options: { ticketsPerPlayer: 1 } },
      { label: '2 tickets each', options: { ticketsPerPlayer: 2 } },
    ],
  },
  {
    kind: 'raja-mantri',
    name: 'Raja Mantri Chor Sipahi',
    hi: 'राजा मंत्री चोर सिपाही',
    line: 'Four secret chits. The Mantri must catch the Chor.',
    players: 'Exactly four players',
    choices: [
      { label: '5 rounds', options: { rounds: 5 } },
      { label: '3 rounds', options: { rounds: 3 } },
    ],
  },
  {
    kind: 'charades',
    name: 'Dumb Charades',
    hi: 'मूक अभिनय',
    line: 'Act out a Hindi film without a word while your team guesses.',
    players: 'Two teams of two or more',
    choices: [
      { label: '3 turns a team', options: { turnsPerTeam: 3, turnSeconds: 90 } },
      { label: '5 turns a team', options: { turnsPerTeam: 5, turnSeconds: 90 } },
    ],
  },
];

const NAMES: Record<GameKind, string> = {
  'teen-patti': 'Teen Patti',
  tambola: 'Tambola',
  'raja-mantri': 'Raja Mantri Chor Sipahi',
  charades: 'Dumb Charades',
};

/** The Game Bazaar: start a party game, or join one already running. */
export function BazaarLobby({ partyId }: { partyId: string }) {
  const { status, games, request } = usePartyRoom(partyId);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function start(kind: BazaarKind, options: GameOptions, key: string) {
    setBusy(key);
    setError(null);
    const result = await request({ t: 'create-game', kind, options });
    setBusy(null);
    if (result.ok) {
      const { game } = result.data as { game: string };
      router.push(`/party/${partyId}/games/${game}`);
    } else {
      setError(
        result.error === 'too-many-games'
          ? 'This party already has a dozen games going.'
          : 'Couldn’t start the game. Try again.',
      );
    }
  }

  if (status === 'unavailable') {
    return (
      <p className={styles.status}>
        The Game Bazaar isn’t available on this server yet: realtime isn’t configured.
      </p>
    );
  }

  const running = (games ?? []).filter((g) => g.kind !== 'teen-patti' && g.status !== 'finished');

  return (
    <div className="grid gap-10">
      <div className="grid gap-4 md:grid-cols-3">
        {GAMES.map((game) => (
          <section key={game.kind} className={styles.panel} aria-labelledby={`start-${game.kind}`}>
            <div className={styles.header}>
              <h2 id={`start-${game.kind}`} className="type-title">
                {game.name}
              </h2>
              <p lang="hi" className={styles.hi}>
                {game.hi}
              </p>
            </div>
            <p className={styles.muted}>{game.line}</p>
            <p className="type-eyebrow text-marigold-400">{game.players}</p>
            <div className={styles.actions}>
              {game.choices.map((choice, i) => {
                const key = `${game.kind}-${i}`;
                return (
                  <Button
                    key={key}
                    tone={i === 0 ? 'vermilion' : 'outline'}
                    size={i === 0 ? 'md' : 'sm'}
                    pending={busy === key}
                    disabled={status !== 'open' || (busy !== null && busy !== key)}
                    onClick={() => start(game.kind, choice.options, key)}
                  >
                    {i === 0 ? `Start: ${choice.label}` : choice.label}
                  </Button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {error ? <p className={styles.notice}>{error}</p> : null}

      <section aria-labelledby="running-title" className="grid gap-3">
        <h2 id="running-title" className="type-title">
          Games in play
        </h2>
        {games === null ? (
          <p className={styles.status}>{status === 'open' ? 'Loading…' : 'Connecting…'}</p>
        ) : running.length === 0 ? (
          <p className={styles.muted}>Nothing running yet. Start one above.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {running.map((g) => (
              <li key={g.game}>
                <Link
                  href={`/party/${partyId}/games/${g.game}`}
                  className={`${styles.panel} no-underline`}
                >
                  <span className="type-title">{NAMES[g.kind]}</span>
                  <span className={styles.muted}>
                    {g.detail} · {g.players} {g.players === 1 ? 'player' : 'players'} ·{' '}
                    {g.status === 'lobby' ? 'Waiting to start' : 'In play'}
                  </span>
                  <span className="type-small text-[color:var(--color-ivory-200)]">
                    Started by {g.createdBy}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="type-small text-[color:var(--ink-on-night-muted)]">
        Points and chips are for fun only. Nothing here can be bought, sold or cashed out.
      </p>
    </div>
  );
}
