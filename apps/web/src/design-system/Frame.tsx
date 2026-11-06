import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import styles from './Frame.module.css';

type FrameVariant = 'paper' | 'night' | 'stamp';

type FrameProps<T extends ElementType> = {
  as?: T;
  variant?: FrameVariant | undefined;
  className?: string | undefined;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

/** The printed border every surface in the house sits inside. */
export function Frame<T extends ElementType = 'div'>({
  as,
  variant = 'paper',
  className,
  children,
  ...rest
}: FrameProps<T>) {
  const Tag: ElementType = as ?? 'div';
  if (variant === 'stamp') {
    return (
      <Tag className={[styles.stamp, className].filter(Boolean).join(' ')} {...rest}>
        <div className={styles.stampInner}>{children}</div>
      </Tag>
    );
  }
  return (
    <Tag
      className={[
        styles.frame,
        styles[variant],
        variant === 'paper' ? 'surface-paper' : undefined,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
        <span key={corner} className={styles.stud} data-corner={corner} aria-hidden />
      ))}
      {children}
    </Tag>
  );
}
