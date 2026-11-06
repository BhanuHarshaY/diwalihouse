'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import styles from './illustrations.module.css';

/**
 * Wraps illustrations whose idle motion should run only while they are on
 * screen. Sets `data-seen` once (for the entrance) and `data-playing` while
 * visible (for the loops). Without JavaScript neither is set, and the art
 * renders in its resting pose.
 */
export function Playable({
  className,
  children,
}: {
  className?: string | undefined;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          node.setAttribute('data-seen', '');
          node.setAttribute('data-playing', '');
        } else {
          node.removeAttribute('data-playing');
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={[styles.reveal, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
