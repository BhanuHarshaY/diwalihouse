'use client';

import { Wordmark } from '@/design-system/Wordmark';
import { rememberIntroSeen } from './intro-memory';
import styles from './HomeHeader.module.css';

/** Wordmark and an always-visible way past the story. */
export function HomeHeader() {
  return (
    <header className={styles.header}>
      <Wordmark />
      <a href="#enter" className={`type-label ${styles.skip}`} onClick={rememberIntroSeen}>
        Skip to the party <span aria-hidden>→</span>
      </a>
    </header>
  );
}
