'use client';

import { useCallback, useRef, useState } from 'react';
import { Button } from '@/design-system/Button';
import { useGSAP } from '@/lib/gsap';
import { DiyaArt, DiyaSilhouette } from './art/DiyaArt';
import { FlameArt } from './art/FlameArt';
import { createDiyaStage, LAMP_OFFSETS, type StageController } from './diya-stage';
import { hasSeenIntro } from './intro-memory';
import styles from './SceneDiya.module.css';

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

function announceLit(count: number, total: number): string {
  const word = (n: number) => NUMBER_WORDS[n] ?? String(n);
  return `${word(count)} of ${word(total).toLowerCase()} lamps lit.`;
}

/**
 * Scene 1, "One Diya": a single lamp lights in the dark; the visitor passes
 * its flame along a row of lamps, and the row becomes the word Deepavali.
 */
export function SceneDiya() {
  const sectionRef = useRef<HTMLElement>(null);
  const controller = useRef<StageController | null>(null);
  const [mode, setMode] = useState<'camera' | 'static' | undefined>(undefined);
  const [lit, setLit] = useState({ count: 0, total: 9 });

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        setMode('static');
        return;
      }
      setMode('camera');
      const q = <T extends Element>(selector: string) => {
        const node = section.querySelector<T>(selector);
        if (!node) throw new Error(`SceneDiya: missing ${selector}`);
        return node;
      };
      const lamps = new Map<number, HTMLElement>();
      for (const offset of LAMP_OFFSETS)
        lamps.set(offset, q<HTMLElement>(`[data-offset="${offset}"]`));

      // Mode change must reach the DOM before measuring the sticky stage.
      section.setAttribute('data-mode', 'camera');
      controller.current = createDiyaStage(
        {
          section,
          stage: q('[data-stage]'),
          lamps,
          ambient: q('[data-ambient]'),
          archGroup: q('[data-arch]'),
          archOuter: q('[data-arch-outer]'),
          archInner: q('[data-arch-inner]'),
          bulbs: q('[data-bulbs]'),
          ledge: q('[data-ledge]'),
          openingOut: q('[data-opening-out]'),
          openingIn: q('[data-opening-in]'),
          titleOut: q('[data-title-out]'),
        },
        {
          quickStart: hasSeenIntro(),
          onLitChange: (count, total) => setLit({ count, total }),
        },
      );
      return () => {
        controller.current?.destroy();
        controller.current = null;
      };
    },
    { scope: sectionRef },
  );

  const share = useCallback(() => controller.current?.share(), []);
  const allLit = lit.count >= lit.total;

  return (
    <section
      ref={sectionRef}
      className={styles.scene}
      data-mode={mode}
      aria-labelledby="scene-diya-title"
    >
      <div className={styles.stage} data-stage>
        <svg className={styles.architecture} data-arch aria-hidden focusable="false">
          <path className={styles.archOuter} data-arch-outer d="" />
          <path className={styles.archInner} data-arch-inner d="" />
          <g data-bulbs />
          <g className={styles.ledge} data-ledge>
            <line />
            <line />
          </g>
        </svg>
        <div className={styles.ambient} data-ambient aria-hidden />

        <div className={`${styles.copy} ${styles.opening}`} data-opening-out>
          <div data-opening-in>
            <p className={`type-eyebrow ${styles.eyebrow}`}>Amavasya · the new-moon night</p>
            <h1 className={`type-masthead-lg ${styles.headline}`}>
              On the darkest night, someone lights a lamp.
            </h1>
            <p lang="hi" className={`type-story-lg ${styles.devanagari}`}>
              अमावस की रात, एक दीया
            </p>
          </div>
        </div>

        {/* Pointer shortcut only: the visible "Pass the flame" button is the accessible control. */}
        <div className={styles.row} aria-hidden onClick={share}>
          {LAMP_OFFSETS.map((offset) => (
            <div
              key={offset}
              className={styles.lamp}
              data-offset={offset}
              style={{ order: offset, ['--flicker-delay' as string]: `${(offset * 0.37) % 1.1}s` }}
            >
              <div className={styles.halo} data-halo />
              <DiyaSilhouette className={styles.silhouette} />
              <DiyaArt className={styles.body} data-body />
              <div className={styles.flame} data-flame>
                <div className={styles.lean} data-lean>
                  <div className={styles.flickerA}>
                    <div className={styles.flickerB}>
                      <FlameArt />
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.spark} data-spark />
            </div>
          ))}
        </div>

        <div className={`${styles.copy} ${styles.title}`} data-title-out>
          <h2 id="scene-diya-title" className="type-masthead-xl">
            <span lang="hi" className={styles.word}>
              दीपावली
            </span>
            <span className="visually-hidden">Deepavali</span>
          </h2>
          <p className={`type-story-lg ${styles.gloss}`}>
            Diwali takes its name from a row of lamps.
          </p>
          <p className={`type-eyebrow ${styles.etymology}`}>
            <span>
              Dīpa <i>a lamp</i>
            </span>
            <span aria-hidden>·</span>
            <span>
              Āvali <i>a row</i>
            </span>
          </p>
        </div>

        <div className={styles.prompt}>
          {lit.count === 0 ? null : allLit ? (
            <>
              <p className={`type-label ${styles.promptHint}`}>The row is lit</p>
              <Button
                tone="outline"
                size="sm"
                onClick={() => {
                  const y = controller.current?.titleScrollY();
                  if (y !== undefined) window.scrollTo({ top: y, behavior: 'smooth' });
                }}
              >
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button tone="outline" size="sm" onClick={share}>
                Pass the flame
              </Button>
              <p className={`type-small ${styles.promptHint}`}>or keep scrolling</p>
            </>
          )}
        </div>

        <p className="visually-hidden" aria-live="polite">
          {lit.count > 0 ? announceLit(lit.count, lit.total) : ''}
        </p>
      </div>
    </section>
  );
}
