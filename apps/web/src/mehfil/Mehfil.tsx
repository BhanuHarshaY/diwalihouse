'use client';

import { EMBLEM_IDS, type EmblemId } from '@diwali/contracts';
import { LIMITS, type Song } from '@diwali/mehfil';
import { useState, type FormEvent } from 'react';
import { ClosedDoor } from '@/components/ClosedDoor';
import { Button } from '@/design-system/Button';
import { Emblem } from '@/design-system/emblems/Emblem';
import { Frame } from '@/design-system/Frame';
import { TextField } from '@/design-system/TextField';
import { Record } from './Record';
import { SpeakerPlayer } from './SpeakerPlayer';
import { useMehfil } from './useMehfil';
import styles from './mehfil.module.css';

const ERRORS: Record<string, string> = {
  'not-youtube':
    'That doesn’t look like a YouTube link. On YouTube, tap Share and copy the link from there.',
  'not-embeddable':
    'Whoever uploaded that video doesn’t allow it to play outside YouTube. Try another upload of the same song.',
  'not-found': 'YouTube couldn’t find that video. It may be private or removed.',
  'lookup-failed': 'Couldn’t reach YouTube to check that link. Try again in a moment.',
  'already-queued': 'That song is already in the queue. Vote for it instead!',
  'your-limit': `You have ${LIMITS.perMember} songs waiting. Request another once one has played.`,
  'queue-full': `The queue is full at ${LIMITS.queue} songs. Wait for a few to play.`,
  'own-song': 'You can’t vote for your own request.',
  'not-yours': 'You can only withdraw your own requests.',
  'not-host': 'Only the host can do that.',
  'not-speaker': 'This device isn’t the speaker any more.',
  'no-such-song': 'That song has already played or been withdrawn.',
  'not-playing': 'That song has already finished.',
  timeout: 'The Mehfil didn’t answer. Check your connection and try again.',
};

const emblemOf = (emblem: string | undefined): EmblemId =>
  EMBLEM_IDS.find((e) => e === emblem) ?? 'diya';

function UpArrow() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path d="M8 3l5 6H9.6v4H6.4V9H3z" fill="currentColor" />
    </svg>
  );
}

export function Mehfil({ partyId }: { partyId: string }) {
  const { latest, status, request } = useMehfil(partyId);
  const [armed, setArmed] = useState(false);
  const [url, setUrl] = useState('');
  const [dedication, setDedication] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  if (status === 'denied') {
    return (
      <ClosedDoor
        title="You are no longer in this party"
        message="You left, or the host removed you, so the Mehfil is closed to you now."
      />
    );
  }
  if (status === 'unavailable') {
    return (
      <p className={`type-story ${styles.status}`}>
        The Mehfil isn’t open on this server yet: realtime isn’t configured.
      </p>
    );
  }
  if (!latest) return <p className={`type-story ${styles.status}`}>Tuning the strings…</p>;

  const { view, here, profiles, you } = latest;
  const isHost = you.role === 'host';
  const canSpeak = isHost || view.delegate === you.member;
  const nameOf = (member: string) => profiles[member]?.name ?? 'Someone';
  const mine = view.upNext.filter((song) => song.by === you.member).length;
  const playing = view.playing;
  const live = !!playing && !!view.speaker?.online;
  const full = view.upNext.length >= LIMITS.queue;
  // Who the host can hand the music to: whoever is here, and the current
  // choice even if they've stepped away.
  const candidates = here
    .filter((person) => person.member !== you.member)
    .map((person) => ({ member: person.member, name: person.name }));
  if (view.delegate && !candidates.some((c) => c.member === view.delegate)) {
    candidates.push({ member: view.delegate, name: nameOf(view.delegate) });
  }

  async function act(message: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);
    const result = await request(message);
    setBusy(false);
    if (!result.ok) setNotice(ERRORS[result.error] ?? 'That isn’t possible right now.');
    return result.ok;
  }

  async function requestSong(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    setAdded(null);
    setAdding(true);
    const result = await request({ t: 'add', url, ...(dedication.trim() ? { dedication } : {}) });
    setAdding(false);
    if (!result.ok) return setNotice(ERRORS[result.error] ?? 'That request didn’t go through.');
    const title = (result.data as { title?: string } | undefined)?.title;
    setAdded(title ? `Requested “${title}”.` : 'Requested.');
    setUrl('');
    setDedication('');
  }

  function startHere() {
    // This tap is what lets the browser play sound on this tab.
    setArmed(true);
    if (!you.speaker) void act({ t: 'claim' });
  }

  const credit = (song: Song) => (
    <span className={styles.credit}>
      <Emblem id={emblemOf(profiles[song.by]?.emblem)} size={22} />
      <span>
        {nameOf(song.by)}
        {song.by === you.member ? ' (you)' : ''}
        {song.dedication ? <span className={styles.dedication}> · {song.dedication}</span> : null}
      </span>
    </span>
  );

  const speakerLine = view.speaker
    ? view.speaker.online
      ? `Playing on ${view.speaker.member === you.member ? 'your' : `${nameOf(view.speaker.member)}’s`} device`
      : `${view.speaker.member === you.member ? 'Your' : `${nameOf(view.speaker.member)}’s`} speaker is offline`
    : 'No speaker yet';

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <section className={styles.stage} aria-label="Now playing">
          {you.speaker && armed ? (
            <SpeakerPlayer
              song={playing}
              onEnded={(song) => void request({ t: 'ended', song })}
              onFailed={(song) => {
                setNotice(
                  `Skipped “${playing?.title ?? 'that song'}”: YouTube won’t play it here.`,
                );
                void request({ t: 'failed', song });
              }}
            />
          ) : (
            <Record spinning={live} />
          )}
          <div className={styles.nowText}>
            <p className={`type-eyebrow ${styles.onAir}`}>
              {live ? <span className={styles.liveDot} aria-hidden /> : null}
              {live ? 'Now playing' : speakerLine}
            </p>
            {playing ? (
              <>
                <p className={`type-title ${styles.title}`} data-testid="now-playing">
                  {playing.title}
                </p>
                <p className={`type-small ${styles.muted}`}>{playing.channel}</p>
                {credit(playing)}
                {live ? <p className={`type-small ${styles.muted}`}>{speakerLine}</p> : null}
              </>
            ) : (
              <p className={`type-story ${styles.idle}`}>
                {!view.speaker
                  ? 'Requests wait here until the host plays the music on a device by the speakers.'
                  : !view.speaker.online
                    ? 'The music will start again when the speaker’s device is back.'
                    : 'The queue is empty. Request a song below.'}
              </p>
            )}
          </div>
        </section>

        <div className={styles.controls}>
          <div className={styles.actions}>
            {you.speaker ? (
              armed ? (
                <Button
                  tone="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => act({ t: 'release' })}
                >
                  Stop playing here
                </Button>
              ) : (
                <Button tone="marigold" onClick={startHere}>
                  Resume the music here
                </Button>
              )
            ) : canSpeak ? (
              <Button tone="marigold" disabled={busy} onClick={startHere}>
                Play the music on this device
              </Button>
            ) : null}
            {(isHost || you.speaker) && playing ? (
              <Button
                tone="outline"
                size="sm"
                disabled={busy}
                onClick={() => act({ t: 'skip', song: playing.id })}
              >
                Skip this song
              </Button>
            ) : null}
          </div>
          {canSpeak && !you.speaker ? (
            <p className={`type-small ${styles.muted}`}>
              Music plays from one device: the TV, or a laptop by the speakers. Everyone else’s
              phone shows the queue and stays quiet.
            </p>
          ) : null}
          <p className={`type-small ${styles.notice}`} aria-live="polite">
            {notice ?? (status === 'reconnecting' ? 'Reconnecting…' : '')}
          </p>
        </div>

        <Frame variant="paper" as="form" className={styles.slip} onSubmit={requestSong}>
          <p className="type-eyebrow text-vermilion-700">Request slip</p>
          <TextField
            label="YouTube link"
            hint={`From YouTube or YouTube Music. You can have ${LIMITS.perMember} songs waiting; you have ${mine}.`}
            type="url"
            inputMode="url"
            required
            maxLength={400}
            placeholder="https://youtu.be/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <TextField
            label="Dedication (optional)"
            maxLength={LIMITS.dedication}
            placeholder="For Nani, from Meera"
            value={dedication}
            onChange={(e) => setDedication(e.target.value)}
          />
          <div className={styles.slipFoot}>
            <Button
              type="submit"
              tone="vermilion"
              pending={adding}
              pendingLabel="Checking with YouTube…"
              disabled={mine >= LIMITS.perMember || full || status !== 'open'}
            >
              Request it
            </Button>
            <p className="type-small" aria-live="polite">
              {added}
            </p>
          </div>
        </Frame>

        <section aria-labelledby="up-next" className={styles.queue}>
          <h2 id="up-next" className="type-title">
            Up next
          </h2>
          {view.upNext.length ? (
            <ol className={styles.songs}>
              {view.upNext.map((song, i) => {
                const voted = song.votes.includes(you.member);
                const own = song.by === you.member;
                return (
                  <li key={song.id} className={styles.song}>
                    <span className={`type-title ${styles.position}`}>{i + 1}</span>
                    <div className={styles.songText}>
                      <p className={styles.songTitle}>{song.title}</p>
                      <p className={`type-small ${styles.muted}`}>{song.channel}</p>
                      {credit(song)}
                    </div>
                    <div className={styles.songActions}>
                      {own ? (
                        <span className={`type-small ${styles.votes}`}>
                          {song.votes.length} vote{song.votes.length === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={styles.vote}
                          aria-pressed={voted}
                          aria-label={`${voted ? 'Remove your vote for' : 'Vote for'} ${song.title}`}
                          disabled={busy}
                          onClick={() => act({ t: 'vote', song: song.id, up: !voted })}
                        >
                          <UpArrow />
                          <span className="type-numeral">{song.votes.length}</span>
                        </button>
                      )}
                      {own || isHost ? (
                        <Button
                          tone="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => act({ t: 'remove', song: song.id })}
                          aria-label={`${own ? 'Withdraw' : 'Remove'} ${song.title}`}
                        >
                          {own ? 'Withdraw' : 'Remove'}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className={`type-small ${styles.muted}`}>
              Nothing waiting. Be the first to request a song.
            </p>
          )}
        </section>
      </div>

      <aside className={styles.side}>
        <section className={styles.panel} aria-label="In the Mehfil now">
          <p className={`type-label ${styles.panelLabel}`}>
            <span className={styles.liveDot} aria-hidden /> In the Mehfil now
          </p>
          <ul className={styles.people}>
            {here.map((person) => (
              <li key={person.member} className={styles.person}>
                <Emblem id={emblemOf(person.emblem)} size={26} />
                <span>{person.name}</span>
              </li>
            ))}
          </ul>
        </section>

        {isHost ? (
          <section className={styles.panel} aria-label="Host tools">
            <p className="type-title">Who plays the music</p>
            <p className={`type-small ${styles.muted}`}>
              The music plays on your device, or on one other device you choose. For the TV, open
              the invitation on the TV, join as a guest such as “Living room TV”, then choose it
              here.
            </p>
            <fieldset className={styles.delegates}>
              <legend className={`type-label ${styles.panelLabel}`}>Who else may play it</legend>
              <label className={`type-small ${styles.delegate}`}>
                <input
                  type="radio"
                  name="delegate"
                  checked={view.delegate === null}
                  disabled={busy}
                  onChange={() => act({ t: 'delegate', member: null })}
                />
                No one else
              </label>
              {candidates.map((person) => (
                <label key={person.member} className={`type-small ${styles.delegate}`}>
                  <input
                    type="radio"
                    name="delegate"
                    checked={view.delegate === person.member}
                    disabled={busy}
                    onChange={() => act({ t: 'delegate', member: person.member })}
                  />
                  {person.name}
                </label>
              ))}
            </fieldset>
          </section>
        ) : null}

        <section className={styles.panel} aria-label="Recently played">
          <p className={`type-label ${styles.panelLabel}`}>Recently played</p>
          {view.played.length ? (
            <ol className={`type-small ${styles.played}`}>
              {view.played.slice(0, 6).map((song) => (
                <li key={song.id}>
                  <span>{song.title}</span>
                  <span className={styles.muted}> · {nameOf(song.by)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={`type-small ${styles.muted}`}>Nothing yet tonight.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
