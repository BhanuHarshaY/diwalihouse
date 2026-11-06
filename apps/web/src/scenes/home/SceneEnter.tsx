'use client';

import { normalizeInviteCode } from '@diwali/contracts';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Button, ButtonLink } from '@/design-system/Button';
import { TextField } from '@/design-system/TextField';
import { showerPetals } from '@/illustrations/petals';
import { Playable } from '@/illustrations/Playable';
import { HangingLantern, Toran } from '@/illustrations/Toran';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { DOORWAY, DoorLeafArt, DoorwayArt } from './art/DoorwayArt';
import { rememberIntroSeen } from './intro-memory';
import styles from './SceneEnter.module.css';

const pct = (value: number, of: number) => `${(value / of) * 100}%`;

/** Scene 4, "Enter the Mehfil": the doors open onto hosting or joining a party. */
export function SceneEnter() {
  const doorwayRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();

  useGSAP(
    () => {
      const doorway = doorwayRef.current;
      if (!doorway) return;
      const leaves = doorway.querySelectorAll<HTMLElement>('[data-leaf]');
      const spill = doorway.querySelector('[data-spill]');
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let opened = false;

      const open = (fast: boolean) => {
        if (opened) return;
        opened = true;
        rememberIntroSeen();
        const duration = reduce || fast ? 0 : 1.9;
        gsap.to(leaves, {
          rotateY: (i: number) => (i === 0 ? -80 : 80),
          duration,
          ease: 'power3.inOut',
          onComplete: () => {
            doorway.removeAttribute('data-closed');
            doorway.setAttribute('data-open', '');
          },
        });
        gsap.to(spill, { autoAlpha: 1, duration: duration * 1.2, ease: 'power2.out' });
        const petals = doorway.querySelector<HTMLElement>('[data-petals]');
        if (petals && !reduce && !fast) gsap.delayedCall(0.7, () => showerPetals(petals));
      };

      doorway.setAttribute('data-closed', '');
      const trigger = ScrollTrigger.create({
        trigger: doorway,
        start: 'top 62%',
        once: true,
        onEnter: () => open(false),
      });
      const onFocus = () => open(true);
      doorway.addEventListener('focusin', onFocus);
      return () => {
        trigger.kill();
        doorway.removeEventListener('focusin', onFocus);
      };
    },
    { scope: doorwayRef },
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeInviteCode(code);
    if (!normalized) {
      setError('Codes look like ABCD-1234.');
      return;
    }
    setError(undefined);
    router.push(`/join/${normalized}`);
  }

  const { opening } = DOORWAY;
  const box = {
    left: pct(opening.x, DOORWAY.width),
    top: pct(opening.y, DOORWAY.height),
    width: pct(opening.width, DOORWAY.width),
    height: pct(opening.height, DOORWAY.height),
  };

  return (
    <section id="enter" className={styles.scene} aria-labelledby="enter-title">
      <Playable className={styles.toran}>
        <Toran className={styles.toranArt} />
      </Playable>
      <header className={styles.header}>
        <p className={`type-eyebrow ${styles.eyebrow}`}>The house is open</p>
        <h2 id="enter-title" className="type-masthead-lg">
          Enter the mehfil
        </h2>
        <p lang="hi" className={`type-story-lg ${styles.hi}`}>
          महफ़िल में आइए
        </p>
        <p className={`type-story ${styles.lede}`}>
          Host a private Diwali party for your people, or join one with the code on your invitation.
        </p>
      </header>

      <div ref={doorwayRef} className={styles.doorway}>
        <div className={styles.spill} data-spill aria-hidden />
        <Playable className={styles.lanterns}>
          <HangingLantern className={styles.lanternLeft} />
          <HangingLantern className={styles.lanternRight} />
        </Playable>
        <div className={`surface-paper ${styles.interior}`} style={box}>
          <div className={styles.interiorInner}>
            <ButtonLink href="/host" tone="vermilion" size="lg" block>
              Host a party
            </ButtonLink>
            <p className={`type-eyebrow ${styles.or}`}>
              <span>or join one</span>
            </p>
            <form
              action="/join"
              method="get"
              onSubmit={onSubmit}
              noValidate
              className={styles.form}
            >
              <TextField
                label="Invitation code"
                name="code"
                variant="code"
                placeholder="ABCD-1234"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={12}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                errors={error ? [error] : undefined}
              />
              <Button type="submit" tone="ink" block>
                Find my invitation
              </Button>
            </form>
          </div>
        </div>
        <div className={styles.leaves} style={box} aria-hidden>
          <div className={`${styles.leaf} ${styles.leafLeft}`} data-leaf>
            <DoorLeafArt className={styles.leafArt} />
          </div>
          <div className={`${styles.leaf} ${styles.leafRight}`} data-leaf>
            <DoorLeafArt className={`${styles.leafArt} ${styles.mirrored}`} />
          </div>
        </div>
        <DoorwayArt className={styles.frame} />
        <div className={styles.petals} data-petals aria-hidden />
      </div>
    </section>
  );
}
