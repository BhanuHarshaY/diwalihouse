'use client';

import type { PostcardView } from '@diwali/contracts';
import { useSyncExternalStore, type ReactNode } from 'react';
import { Emblem } from '@/design-system/emblems/Emblem';
import { Postmark, Stamp } from './Stamps';
import styles from './daak.module.css';

/**
 * The script a guest wrote in, as an "undetermined language" tag: we can't
 * know whether Devanagari is Hindi, Marathi or Nepali, but we can say it is
 * Devanagari (so it's never letter-spaced and gets the right face).
 */
export function scriptTag(text: string): string | undefined {
  if (/\p{Script=Devanagari}/u.test(text)) return 'und-Deva';
  if (/\p{Script=Gurmukhi}/u.test(text)) return 'und-Guru';
  if (/\p{Script=Bengali}/u.test(text)) return 'und-Beng';
  return undefined;
}

const noop = () => () => {};

/** The posting time, in the reader's own clock. Rendered after hydration only. */
function usePostedAt(iso: string): string | null {
  const client = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!client) return null;
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' })
    .format(new Date(iso))
    .toUpperCase();
}

export function Postcard({
  card,
  partyName,
  fresh,
  footer,
}: {
  card: PostcardView;
  partyName: string;
  /** Arrived since the page loaded: it drops onto the wall. */
  fresh: boolean;
  footer: ReactNode;
}) {
  const when = usePostedAt(card.postedAt);
  return (
    <article
      className={styles.cardWrap}
      data-fresh={fresh || undefined}
      data-hidden={card.hidden || undefined}
      aria-label={`Postcard from ${card.from.displayName}`}
    >
      <div className={`surface-paper ${styles.card}`}>
        <div className={styles.stampCorner}>
          <Stamp id={card.stamp} />
          <Postmark when={when} />
        </div>
        <p className={`type-story ${styles.message}`} dir="auto" lang={scriptTag(card.message)}>
          {card.message}
        </p>
        <div className={styles.address}>
          <p className={`type-eyebrow ${styles.addressLabel}`}>To</p>
          <p
            className={styles.addressLine}
            dir="auto"
            lang={card.to ? scriptTag(card.to) : undefined}
          >
            {card.to ?? `Everyone at ${partyName}`}
          </p>
          <p className={`type-eyebrow ${styles.addressLabel}`}>From</p>
          <p className={styles.addressLine}>
            <Emblem id={card.from.emblem} size={26} />
            <span dir="auto">{card.from.displayName}</span>
            {card.from.here ? null : <span className={styles.left}> (has left)</span>}
          </p>
        </div>
      </div>
      {footer}
    </article>
  );
}
