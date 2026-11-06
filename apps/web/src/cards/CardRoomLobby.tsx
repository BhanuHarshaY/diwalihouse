'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/design-system/Button';
import { usePartyRoom } from '@/realtime/usePartyRoom';
import styles from './cards.module.css';

const BOOTS = [5, 10, 25, 50] as const;

/** The Card Room: open a Teen Patti table, or join one already running. */
export function CardRoomLobby({ partyId }: { partyId: string }) {
  const { status, games, members, request } = usePartyRoom(partyId);
  const tables = games
    ? games.filter((g) => g.kind === 'teen-patti' && g.status !== 'finished')
    : null;
  const [boot, setBoot] = useState<(typeof BOOTS)[number]>(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function openTable() {
    setBusy(true);
    setError(null);
    const result = await request({ t: 'create-game', kind: 'teen-patti', options: { boot } });
    setBusy(false);
    if (result.ok) {
      const { game } = result.data as { game: string };
      router.push(`/party/${partyId}/games/${game}`);
    } else {
      setError(
        result.error === 'too-many-games'
          ? 'This party already has a dozen games going.'
          : 'Couldn’t open a table. Try again.',
      );
    }
  }

  if (status === 'unavailable') {
    return (
      <p className={styles.connecting}>
        The Card Room isn’t available on this server yet: realtime isn’t configured.
      </p>
    );
  }

  return (
    <div className={styles.lobby}>
      <section aria-labelledby="open-title" className="grid gap-3">
        <h2 id="open-title" className="type-title">
          Open a table
        </h2>
        <p className="type-small text-[color:var(--ink-on-night-muted)]">
          Everyone who sits down starts with 100 boots’ worth of chips. Choose the boot:
        </p>
        <div className={styles.boots} role="radiogroup" aria-label="Boot">
          {BOOTS.map((value) => (
            <Button
              key={value}
              size="sm"
              tone={value === boot ? 'marigold' : 'outline'}
              role="radio"
              aria-checked={value === boot}
              onClick={() => setBoot(value)}
            >
              Boot {value}
            </Button>
          ))}
          <Button tone="vermilion" pending={busy} disabled={status !== 'open'} onClick={openTable}>
            Open a table
          </Button>
        </div>
        {error ? <p className={styles.notice}>{error}</p> : null}
      </section>

      <section aria-labelledby="tables-title" className="grid gap-3">
        <h2 id="tables-title" className="type-title">
          Tables
        </h2>
        {tables === null ? (
          <p className={styles.connecting}>{status === 'open' ? 'Loading…' : 'Connecting…'}</p>
        ) : tables.length === 0 ? (
          <p className="type-small text-[color:var(--ink-on-night-muted)]">
            No tables yet. Open the first one.
          </p>
        ) : (
          <ul className={styles.tables}>
            {tables.map((t) => (
              <li key={t.game}>
                <Link href={`/party/${partyId}/games/${t.game}`} className={styles.tableCard}>
                  <span className={styles.tableName}>Table {t.game.slice(0, 4).toUpperCase()}</span>
                  <span className="type-small">
                    {t.detail} · {t.players} seated ·{' '}
                    {t.status === 'playing' ? 'Hand in play' : 'Between hands'}
                  </span>
                  <span className="type-small text-[color:var(--color-ivory-200)]">
                    Opened by {t.createdBy}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {members ? (
        <p className="type-small text-[color:var(--ink-on-night-muted)]">
          Here now: {members.map((m) => m.name).join(', ')}
        </p>
      ) : null}
      <p className={styles.virtual}>
        Virtual chips only. They can’t be bought, sold or cashed out.
      </p>
    </div>
  );
}
