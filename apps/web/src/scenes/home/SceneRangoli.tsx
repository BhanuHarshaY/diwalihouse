'use client';

import { useRef, useState } from 'react';
import { RANGOLI_RINGS, RANGOLI_VIEWBOX } from '@/illustrations/rangoli';
import { gsap, useGSAP } from '@/lib/gsap';
import styles from './SceneRangoli.module.css';

/** Rings that keep turning, slowly, once the pattern is complete. */
const IDLE: Record<string, 'cw' | 'ccw'> = { beads: 'cw', scallops: 'ccw', lotus: 'ccw' };

/**
 * Scene 3, "The Rangoli": a pattern assembles ring by ring as the visitor
 * scrolls, as it would be laid at the threshold before guests arrive. Each
 * ring is its own layer, so assembly is composited, never repainted.
 */
export function SceneRangoli() {
  const sectionRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<'camera' | 'static' | undefined>(undefined);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setMode('static');
        return;
      }
      setMode('camera');
      section.setAttribute('data-mode', 'camera');

      const layers = section.querySelectorAll<HTMLElement>('[data-ring]');
      const copy = section.querySelector('[data-copy]');
      const timeline = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.5,
          onToggle: (self) => section.toggleAttribute('data-playing', self.isActive),
          onUpdate: (self) => section.toggleAttribute('data-assembled', self.progress > 0.8),
        },
      });
      timeline.fromTo(copy, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.12 }, 0);
      layers.forEach((layer, i) => {
        timeline.fromTo(
          layer,
          { autoAlpha: 0, scale: 0.35 + i * 0.05, rotation: (i % 2 ? -1 : 1) * (48 - i * 4) },
          { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.15, ease: 'power2.out' },
          0.06 + i * 0.085,
        );
      });
      timeline.to({}, { duration: 0.12 });
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      className={styles.scene}
      data-mode={mode}
      aria-labelledby="rangoli-title"
    >
      <div className={styles.stage}>
        <div className={styles.copy} data-copy>
          <p className={`type-eyebrow ${styles.eyebrow}`}>At the threshold</p>
          <h2 id="rangoli-title" className="type-masthead-lg">
            Rangoli
          </h2>
          <p lang="hi" className={`type-story-lg ${styles.hi}`}>
            रंगोली
          </p>
          <p className={`type-story ${styles.body}`}>
            Before the guests arrive, a pattern is laid at the door in coloured powder, rice flour
            or petals: an invitation drawn on the ground.
          </p>
          <p className={`type-story ${styles.names}`}>
            It goes by many names. Kolam in Tamil Nadu, muggu in Andhra Pradesh and Telangana,
            rangavalli in Karnataka, alpana in Bengal, mandana in Rajasthan, chowk purana in Uttar
            Pradesh.
          </p>
        </div>
        <div className={styles.rangoli} aria-hidden>
          {RANGOLI_RINGS.map((ring) => (
            <div key={ring.id} className={styles.layer} data-ring={ring.id}>
              <div className={styles.idle} data-idle={IDLE[ring.id]}>
                <svg viewBox={RANGOLI_VIEWBOX} focusable="false">
                  {ring.node}
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
