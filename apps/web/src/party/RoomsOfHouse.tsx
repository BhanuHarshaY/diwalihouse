import Link from 'next/link';
import { ArchWindow } from '@/illustrations/ArchWindow';
import { Playable } from '@/illustrations/Playable';
import { ROOM_ART } from '@/illustrations/rooms';
import styles from './party.module.css';

/**
 * The house's rooms, each an illustrated window. A room that isn't built
 * yet says so plainly instead of pretending; when one ships, it is marked
 * open and given a path (design/asset-manifest.md, ROOM-*).
 */
const ROOMS = [
  {
    id: 'card-room',
    open: true,
    name: 'The Card Room',
    hi: 'ताश घर',
    line: 'Teen Patti at private tables, with virtual chips.',
  },
  {
    id: 'bazaar',
    open: true,
    name: 'Game Bazaar',
    hi: 'खेल बाज़ार',
    line: 'Tambola, dumb charades and other party games.',
  },
  {
    id: 'mehfil',
    open: true,
    name: 'Music Mehfil',
    hi: 'संगीत महफ़िल',
    line: 'A shared jukebox. Add songs, vote on requests.',
  },
  {
    id: 'courtyard',
    open: true,
    name: 'Rangoli Courtyard',
    hi: 'रंगोली आँगन',
    line: 'One rangoli, drawn by everyone.',
  },
  {
    id: 'daak',
    open: true,
    name: 'Diwali Daak',
    hi: 'दिवाली डाक',
    line: 'Messages and greetings for the guestbook.',
  },
] as const;

const ROOM_PATH: Record<string, string> = {
  'card-room': 'cards',
  bazaar: 'bazaar',
  courtyard: 'courtyard',
  mehfil: 'mehfil',
  daak: 'daak',
};

export function RoomsOfHouse({ partyId }: { partyId: string }) {
  return (
    <section aria-labelledby="rooms-title" className={styles.rooms}>
      <div className={styles.sectionHead}>
        <h2 id="rooms-title" className="type-title">
          Rooms of the house
        </h2>
        <p className="type-small text-[color:var(--ink-on-night-muted)]">
          Every room is open tonight.
        </p>
      </div>
      <ul className={styles.roomList}>
        {ROOMS.map((room) => {
          const open = 'open' in room && room.open;
          const body = (
            <>
              <Playable className={styles.roomWindow}>
                <ArchWindow id={`room-${room.id}`} colours={ROOM_ART[room.id]!.colours}>
                  {ROOM_ART[room.id]!.motif}
                </ArchWindow>
              </Playable>
              <div className={styles.roomText}>
                <p className={styles.roomName}>{room.name}</p>
                <p lang="hi" className={styles.roomHi}>
                  {room.hi}
                </p>
                <p className={styles.roomLine}>{room.line}</p>
                {open ? (
                  <p className={`type-eyebrow ${styles.roomOpen}`}>
                    <span className={styles.liveDot} aria-hidden /> Open now
                  </p>
                ) : (
                  <p className={`type-eyebrow ${styles.roomStatus}`}>Not open yet</p>
                )}
              </div>
            </>
          );
          return (
            <li key={room.id} className={styles.room} data-open={open || undefined}>
              {open ? (
                <Link
                  href={`/party/${partyId}/${ROOM_PATH[room.id] ?? ''}`}
                  className={styles.roomLink}
                >
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
