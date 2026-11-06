import Link from 'next/link';
import type { ReactNode } from 'react';
import { Wordmark } from '@/design-system/Wordmark';
import styles from './PageShell.module.css';

/** Frame for the inner pages: wordmark bar, centred column, quiet footer. */
export function PageShell({
  children,
  width = 'narrow',
  back,
}: {
  children: ReactNode;
  width?: 'narrow' | 'wide';
  back?: { href: string; label: string };
}) {
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <Wordmark />
        {back ? (
          <Link href={back.href} className={`type-label ${styles.back}`}>
            {back.label}
          </Link>
        ) : null}
      </header>
      <main id="main" className={width === 'wide' ? styles.wide : styles.narrow}>
        {children}
      </main>
    </div>
  );
}
