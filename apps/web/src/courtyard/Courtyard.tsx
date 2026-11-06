'use client';

import { EMBLEM_IDS, type EmblemId } from '@diwali/contracts';
import {
  COLOURS,
  FOLDS,
  LIMITS,
  SIZES,
  strokesByMember,
  TOOLS,
  type Colour,
  type Folds,
  type Size,
  type StrokeInput,
  type Tool,
} from '@diwali/rangoli';
import { useState, type ReactNode } from 'react';
import { ClosedDoor } from '@/components/ClosedDoor';
import { Button } from '@/design-system/Button';
import { ConfirmDialog, DialogClose } from '@/design-system/Dialog';
import { Emblem } from '@/design-system/emblems/Emblem';
import { INK, INK_NAME, renderImage } from './draw';
import { RangoliFloor, type Brush } from './RangoliFloor';
import { useCourtyard } from './useCourtyard';
import styles from './courtyard.module.css';

const TOOL_NAME: Record<Tool, string> = { line: 'Line', petal: 'Petal', dot: 'Dot', ring: 'Ring' };
const SIZE_NAME: Record<Size, string> = { fine: 'Fine', medium: 'Medium', bold: 'Bold' };
const FOLD_NAME: Record<Folds, string> = { 6: 'six', 8: 'eight', 12: 'twelve' };

const ERRORS: Record<string, string> = {
  'slow-down': 'Slow down a little: the courtyard takes a few strokes a second from each person.',
  'share-used': `You’ve drawn ${LIMITS.perMember} strokes, the most one person can. Leave some floor for everyone else!`,
  full: `The courtyard is full at ${LIMITS.strokes.toLocaleString('en-IN')} strokes. The host can save it and start a fresh one.`,
  'bad-stroke': 'That stroke couldn’t be drawn. Try again a little inside the edge.',
  'nothing-to-undo': 'You haven’t drawn anything to undo.',
  'nothing-to-erase': 'They have no strokes left to remove.',
  'not-host': 'Only the host can do that.',
  timeout: 'The courtyard didn’t answer. Check your connection and try again.',
};

/** Small original glyphs for the tools. */
const TOOL_GLYPH: Record<Tool, ReactNode> = {
  line: (
    <path
      d="M3 15c3-7 5-7 7 0s4 7 7 0 3-5 4-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  ),
  petal: <path d="M12 21C6 15 6 8 12 3c6 5 6 12 0 18Z" fill="currentColor" />,
  dot: <circle cx="12" cy="12" r="5" fill="currentColor" />,
  ring: <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="2.2" />,
};

const emblemOf = (emblem: string | undefined): EmblemId =>
  EMBLEM_IDS.find((e) => e === emblem) ?? 'diya';

export function Courtyard({ partyId }: { partyId: string }) {
  const yard = useCourtyard(partyId);
  const [brush, setBrush] = useState<Brush>({ tool: 'line', colour: 'white', size: 'medium' });
  const [guides, setGuides] = useState(true);
  const [pending, setPending] = useState<StrokeInput[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erasing, setErasing] = useState<string | null>(null);
  const [freshFolds, setFreshFolds] = useState<Folds>(8);
  const [confirmFresh, setConfirmFresh] = useState(false);

  if (yard.status === 'denied') {
    return (
      <ClosedDoor
        title="You are no longer in this party"
        message="You left, or the host removed you, so the courtyard is closed to you now."
      />
    );
  }
  if (yard.status === 'unavailable') {
    return (
      <p className={`type-story ${styles.status}`}>
        The courtyard isn’t open on this server yet: realtime isn’t configured.
      </p>
    );
  }

  const me = yard.you;
  const isHost = me?.role === 'host';
  const counts = strokesByMember(yard);
  const mine = me ? (counts.get(me.member) ?? 0) : 0;
  const nameOf = (member: string) => yard.profiles[member]?.name ?? 'Someone';
  const artists = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const open = yard.ready && yard.status === 'open';

  function draw(strokes: StrokeInput[]) {
    setNotice(null);
    setPending((p) => [...p, ...strokes]);
    for (const stroke of strokes) {
      void yard.request({ t: 'draw', stroke }).then((result) => {
        setPending((p) => p.filter((s) => s !== stroke));
        if (!result.ok)
          setNotice(ERRORS[result.error] ?? 'That stroke didn’t reach the courtyard.');
      });
    }
  }

  async function act(message: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);
    const result = await yard.request(message);
    setBusy(false);
    if (!result.ok) setNotice(ERRORS[result.error] ?? 'That isn’t possible right now.');
    return result.ok;
  }

  async function save() {
    setSaving(true);
    try {
      const blob = await renderImage(yard.strokes, yard.folds);
      if (!blob) throw new Error('no image');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'diwali-house-rangoli.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setAnnouncement('Saved the rangoli as an image.');
    } catch {
      setNotice('This device couldn’t make the image. Try again on another browser.');
    } finally {
      setSaving(false);
    }
  }

  const people = counts.size;
  const caption = yard.ready
    ? yard.strokes.length === 0
      ? `An empty floor in ${yard.folds}-fold symmetry`
      : `${yard.strokes.length.toLocaleString('en-IN')} stroke${yard.strokes.length === 1 ? '' : 's'} by ${people} ${people === 1 ? 'person' : 'people'} · ${yard.folds}-fold`
    : 'Sweeping the courtyard…';

  return (
    <div className={styles.layout}>
      <div className={styles.stage}>
        <RangoliFloor
          strokes={yard.strokes}
          folds={yard.folds}
          brush={brush}
          pending={pending}
          guides={guides}
          disabled={!open}
          emptyHint={
            !yard.ready
              ? 'Sweeping the courtyard…'
              : yard.strokes.length === 0 && pending.length === 0
                ? `Drag to draw. Every stroke repeats ${FOLD_NAME[yard.folds]} ways around the centre, mirrored.`
                : null
          }
          onDraw={draw}
          onAnnounce={setAnnouncement}
        />
        <p className={`type-small ${styles.caption}`} data-testid="courtyard-count">
          {caption}
        </p>
      </div>

      <div className={styles.controls}>
        <fieldset className={styles.group}>
          <legend className="type-label">Tool</legend>
          <div className={styles.chips}>
            {TOOLS.map((tool) => (
              <label key={tool} className={styles.choice}>
                <input
                  type="radio"
                  name="tool"
                  className="visually-hidden"
                  checked={brush.tool === tool}
                  onChange={() => setBrush((b) => ({ ...b, tool }))}
                />
                <span className={`type-small ${styles.chip}`}>
                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                    {TOOL_GLYPH[tool]}
                  </svg>
                  {TOOL_NAME[tool]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className="type-label">Colour</legend>
          <div className={styles.swatches}>
            {COLOURS.map((colour: Colour) => (
              <label key={colour} className={styles.choice} title={INK_NAME[colour]}>
                <input
                  type="radio"
                  name="colour"
                  className="visually-hidden"
                  checked={brush.colour === colour}
                  onChange={() => setBrush((b) => ({ ...b, colour }))}
                />
                <span className={styles.swatch} style={{ background: INK[colour] }}>
                  <span className="visually-hidden">{INK_NAME[colour]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className="type-label">Size</legend>
          <div className={styles.chips}>
            {SIZES.map((size) => (
              <label key={size} className={styles.choice}>
                <input
                  type="radio"
                  name="size"
                  className="visually-hidden"
                  checked={brush.size === size}
                  onChange={() => setBrush((b) => ({ ...b, size }))}
                />
                <span className={`type-small ${styles.chip}`}>
                  <span className={styles.sizeDot} data-size={size} aria-hidden />
                  {SIZE_NAME[size]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className={styles.actions}>
          <Button
            tone="outline"
            size="sm"
            disabled={!open || busy || mine === 0}
            onClick={() => act({ t: 'undo' })}
          >
            Undo my last stroke
          </Button>
          <label className={`type-small ${styles.toggle}`}>
            <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} />
            Show guides
          </label>
          <Button
            tone="marigold"
            size="sm"
            disabled={!yard.ready || yard.strokes.length === 0}
            pending={saving}
            onClick={save}
          >
            Save as image
          </Button>
        </div>
        <p className={`type-small ${styles.notice}`} aria-live="polite">
          {notice ?? (yard.status === 'reconnecting' ? 'Reconnecting…' : '')}
        </p>
        <p className="visually-hidden" aria-live="polite">
          {announcement}
        </p>

        <section className={styles.panel} aria-label="In the courtyard now">
          <p className="type-label">
            <span className={styles.liveDot} aria-hidden /> In the courtyard now
          </p>
          <ul className={styles.people}>
            {yard.here.map((person) => (
              <li key={person.member} className={styles.person}>
                <Emblem id={emblemOf(person.emblem)} size={26} />
                <span>{person.name}</span>
              </li>
            ))}
          </ul>
        </section>

        {isHost ? (
          <section className={styles.panel} aria-label="Host tools">
            <p className="type-title">Host tools</p>
            {artists.length ? (
              <ul className={styles.artists}>
                {artists.map(([member, count]) => (
                  <li key={member}>
                    <span>
                      {nameOf(member)}
                      {member === me?.member ? ' (you)' : ''}
                      <span className={styles.muted}> · {count}</span>
                    </span>
                    <Button
                      tone="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => setErasing(member)}
                      aria-label={`Remove ${nameOf(member)}’s strokes`}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`type-small ${styles.muted}`}>No one has drawn yet.</p>
            )}
            <fieldset className={styles.group}>
              <legend className="type-small">A fresh rangoli, with</legend>
              <div className={styles.chips}>
                {FOLDS.map((folds) => (
                  <label key={folds} className={styles.choice}>
                    <input
                      type="radio"
                      name="fresh-folds"
                      className="visually-hidden"
                      checked={freshFolds === folds}
                      onChange={() => setFreshFolds(folds)}
                    />
                    <span className={`type-small ${styles.chip}`}>{folds}-fold</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Button
              tone="vermilion"
              size="sm"
              disabled={!open || busy}
              onClick={() => setConfirmFresh(true)}
            >
              Sweep and start afresh
            </Button>
          </section>
        ) : null}
      </div>

      <ConfirmDialog
        open={erasing !== null}
        onOpenChange={(o) => !o && setErasing(null)}
        title={`Remove ${erasing ? nameOf(erasing) : ''}’s strokes?`}
        description={`All ${erasing ? (counts.get(erasing) ?? 0) : 0} of them disappear for everyone. This can’t be undone.`}
        actions={
          <>
            <Button
              tone="vermilion"
              pending={busy}
              onClick={async () => {
                if (erasing && (await act({ t: 'erase', member: erasing }))) setErasing(null);
              }}
            >
              Remove strokes
            </Button>
            <DialogClose asChild>
              <Button tone="outline">Keep them</Button>
            </DialogClose>
          </>
        }
      />
      <ConfirmDialog
        open={confirmFresh}
        onOpenChange={setConfirmFresh}
        title={`Start a fresh ${freshFolds}-fold rangoli?`}
        description="This sweeps the floor for everyone. Save the current rangoli as an image first if you want to keep it."
        actions={
          <>
            <Button
              tone="vermilion"
              pending={busy}
              onClick={async () => {
                if (await act({ t: 'fresh', folds: freshFolds })) setConfirmFresh(false);
              }}
            >
              Sweep the floor
            </Button>
            <DialogClose asChild>
              <Button tone="outline">Cancel</Button>
            </DialogClose>
          </>
        }
      />
    </div>
  );
}
