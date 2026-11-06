'use client';

import type { CharadesClientAction } from '@diwali/realtime-protocol';
import type { CharadesEvent, CharadesView, Team } from '@diwali/charades';
import { useState, type FormEvent } from 'react';
import { Button } from '@/design-system/Button';
import { Emblem } from '@/design-system/emblems/Emblem';
import styles from './games.module.css';
import { emblemOf, nameOf, useCountdown, type GameProps } from './shared';

export const TEAM_NAMES: Record<Team, string> = { 0: 'Team Marigold', 1: 'Team Peacock' };

const ERRORS: Record<string, string> = {
  'teams-too-small': 'Each team needs at least two people: one to act and one to guess.',
  'not-host': 'Only the host can do that.',
  'not-your-team': 'Only the acting team can guess this turn.',
};

function describe(event: CharadesEvent, name: (id: string) => string): string | null {
  switch (event.type) {
    case 'joined':
      return `${name(event.player)} joined ${TEAM_NAMES[event.team]}.`;
    case 'switched':
      return `${name(event.player)} moved to ${TEAM_NAMES[event.team]}.`;
    case 'left':
      return `${name(event.player)} left.`;
    case 'started':
      return 'Lights, camera… no talking!';
    case 'turn-ready':
      return `${name(event.actor)} is up for ${TEAM_NAMES[event.team]}.`;
    case 'turn-began':
      return `${name(event.actor)} is acting: ${event.words} word${event.words === 1 ? '' : 's'}.`;
    case 'wrong-guess':
      return null;
    case 'turn-ended': {
      const r = event.result;
      if (r.outcome === 'guessed') return `${r.by ? name(r.by) : 'The team'} got it: ${r.film}.`;
      return `${r.outcome === 'passed' ? 'Passed' : 'Time’s up'}. It was ${r.film}.`;
    }
    case 'finished':
      return event.winner === null ? 'It’s a tie!' : `${TEAM_NAMES[event.winner]} wins!`;
  }
}

export function CharadesGame({ view, profiles, events, status, request }: GameProps<CharadesView>) {
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [guess, setGuess] = useState('');
  const me = view.me;
  const name = (id: string) => nameOf(profiles, id);
  const seconds = useCountdown(view.phase === 'acting' ? view.deadline : null);
  const log = (events as CharadesEvent[])
    .map((e) => describe(e, name))
    .filter((line): line is string => !!line)
    .slice(0, 10);
  const actorName = view.actor ? name(view.actor) : null;

  async function act(action: CharadesClientAction) {
    setBusy(true);
    setNotice(null);
    const result = await request({ t: 'action', action });
    setBusy(false);
    if (!result.ok) setNotice(ERRORS[result.error] ?? 'That isn’t possible right now.');
    return result.ok;
  }

  async function submitGuess(event: FormEvent) {
    event.preventDefault();
    const text = guess.trim();
    if (!text) return;
    setGuess('');
    await act({ type: 'guess', text });
  }

  return (
    <div className={styles.screen}>
      <div className={styles.main}>
        <header className={styles.header}>
          <p className="type-eyebrow">Game Bazaar</p>
          <h2 className="type-masthead-lg">Dumb Charades</h2>
          <p lang="hi" className={styles.hi}>
            मूक अभिनय
          </p>
        </header>

        <div className={styles.teams}>
          {([0, 1] as const).map((team) => (
            <section
              key={team}
              className={styles.team}
              data-team={team}
              data-active={(view.phase !== 'lobby' && view.team === team) || undefined}
              aria-label={TEAM_NAMES[team]}
            >
              <p className={styles.teamName}>
                <span>{TEAM_NAMES[team]}</span>
                <span className={styles.points}>{view.scores[team]}</span>
              </p>
              <ul className={styles.people}>
                {view.players
                  .filter((p) => p.team === team)
                  .map((p) => (
                    <li key={p.id} className={styles.person}>
                      <Emblem id={emblemOf(profiles, p.id)} size={28} /> {p.name}
                      {p.id === view.actor && view.phase !== 'lobby' ? ' · acting' : ''}
                    </li>
                  ))}
              </ul>
              {me.can.join ? (
                <Button
                  tone="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => act({ type: 'join', team })}
                >
                  Join {TEAM_NAMES[team]}
                </Button>
              ) : null}
            </section>
          ))}
        </div>

        <section className={styles.panel} aria-label="This turn">
          {view.phase === 'lobby' ? (
            <>
              <p className={styles.panelTitle}>Pick your teams</p>
              <p className={styles.muted}>
                {view.config.turnsPerTeam} turns per team, {view.config.turnSeconds} seconds each.
                The actor sees a Hindi film title and acts it out without speaking; teammates type
                their guesses or shout them out.
              </p>
              <div className={styles.actions}>
                {me.can.switchTeam ? (
                  <Button
                    tone="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => act({ type: 'switch-team' })}
                  >
                    Switch team
                  </Button>
                ) : null}
                {me.can.start ? (
                  <Button tone="vermilion" disabled={busy} onClick={() => act({ type: 'start' })}>
                    Start the game
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}

          {view.phase === 'ready' ? (
            <>
              <p className={styles.panelTitle}>
                Turn {view.turn + 1} of {view.totalTurns}: {actorName} acts for{' '}
                {TEAM_NAMES[view.team]}
              </p>
              {me.can.begin ? (
                <div className={styles.actions}>
                  <Button tone="marigold" disabled={busy} onClick={() => act({ type: 'begin' })}>
                    {me.acting ? 'I’m ready. Show me the film' : `Start ${actorName}’s turn`}
                  </Button>
                </div>
              ) : (
                <p className={styles.muted}>Waiting for {actorName} to step up…</p>
              )}
            </>
          ) : null}

          {view.phase === 'acting' ? (
            <>
              <div className={styles.actions}>
                <p className={styles.panelTitle}>
                  {me.acting ? 'Act this out. No talking!' : `${actorName} is acting`}
                </p>
                <span className={`ml-auto ${styles.timer}`} aria-live="off">
                  {seconds ?? ''}s
                </span>
              </div>
              {me.card ? (
                <div className={styles.filmCard}>
                  <p className="type-eyebrow">
                    Film · {view.words} word{view.words === 1 ? '' : 's'}
                  </p>
                  <p className={styles.filmTitle}>{me.card}</p>
                </div>
              ) : (
                <p className={styles.muted}>
                  Film · {view.words} word{view.words === 1 ? '' : 's'}
                </p>
              )}
              {me.can.guess ? (
                <form className={styles.guessForm} onSubmit={submitGuess}>
                  <label className="visually-hidden" htmlFor="guess">
                    Your guess
                  </label>
                  <input
                    id="guess"
                    value={guess}
                    maxLength={80}
                    autoComplete="off"
                    placeholder="Type the film"
                    onChange={(e) => setGuess(e.target.value)}
                  />
                  <Button type="submit" tone="marigold" disabled={busy}>
                    Guess
                  </Button>
                </form>
              ) : !me.acting ? (
                <p className={styles.muted}>
                  Watch closely. It’s {TEAM_NAMES[view.team]}’s turn to guess.
                </p>
              ) : null}
              {view.guesses.length ? (
                <ul className={styles.guesses} aria-label="Wrong guesses">
                  {view.guesses.map((g, i) => (
                    <li key={`${i}-${g.text}`}>{g.text}</li>
                  ))}
                </ul>
              ) : null}
              {me.can.gotIt || me.can.pass ? (
                <div className={styles.actions}>
                  {me.can.gotIt ? (
                    <Button tone="marigold" disabled={busy} onClick={() => act({ type: 'got-it' })}>
                      They got it!
                    </Button>
                  ) : null}
                  {me.can.pass ? (
                    <Button tone="outline" disabled={busy} onClick={() => act({ type: 'pass' })}>
                      Pass
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}

          {(view.phase === 'between' || view.phase === 'finished') && view.last ? (
            <>
              <p className={styles.winnerLine}>
                {view.last.outcome === 'guessed'
                  ? `${view.last.by ? name(view.last.by) : TEAM_NAMES[view.last.team]} got it!`
                  : view.last.outcome === 'passed'
                    ? 'Passed'
                    : 'Time’s up!'}
              </p>
              <p className={styles.muted}>The film was {view.last.film}.</p>
            </>
          ) : null}

          {view.phase === 'finished' ? (
            <p className={styles.good}>
              {view.scores[0] === view.scores[1]
                ? 'A tie!'
                : `${TEAM_NAMES[view.scores[0] > view.scores[1] ? 0 : 1]} wins, ${Math.max(...view.scores)} to ${Math.min(...view.scores)}.`}
            </p>
          ) : null}

          {me.can.next ? (
            <div className={styles.actions}>
              <Button tone="vermilion" disabled={busy} onClick={() => act({ type: 'next' })}>
                {view.turn + 1 >= view.totalTurns ? 'See who won' : 'Next turn'}
              </Button>
            </div>
          ) : null}
          <p className={styles.notice} aria-live="polite">
            {notice ?? (status !== 'open' ? 'Reconnecting…' : '')}
          </p>
        </section>
      </div>

      <aside className={styles.side}>
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
