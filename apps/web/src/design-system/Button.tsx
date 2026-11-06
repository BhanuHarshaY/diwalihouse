import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import styles from './Button.module.css';

type Tone = 'marigold' | 'vermilion' | 'outline' | 'ink';
type Size = 'sm' | 'md' | 'lg';

interface StyleProps {
  tone?: Tone | undefined;
  size?: Size | undefined;
  block?: boolean | undefined;
}

function classes({ tone = 'marigold', size = 'md', block }: StyleProps, extra?: string) {
  return [styles.button, styles[tone], size !== 'md' && styles[size], block && styles.block, extra]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps extends StyleProps, ComponentPropsWithoutRef<'button'> {
  /** Shows progress and blocks repeat presses without removing focus. */
  pending?: boolean;
  pendingLabel?: ReactNode;
}

export function Button({
  tone,
  size,
  block,
  pending = false,
  pendingLabel,
  disabled,
  className,
  children,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  const inert = disabled || pending;
  return (
    <button
      type={type}
      className={classes({ tone, size, block }, className)}
      aria-disabled={inert || undefined}
      aria-busy={pending || undefined}
      data-pending={pending || undefined}
      onClick={(event) => {
        if (inert) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...rest}
    >
      {pending ? (
        <>
          {pendingLabel ?? children}
          <span className={styles.pending} aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export interface ButtonLinkProps extends StyleProps, ComponentPropsWithoutRef<typeof Link> {}

export function ButtonLink({ tone, size, block, className, ...rest }: ButtonLinkProps) {
  return <Link className={classes({ tone, size, block }, className)} {...rest} />;
}
