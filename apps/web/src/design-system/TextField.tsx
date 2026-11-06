import { useId, type ComponentPropsWithoutRef } from 'react';
import styles from './TextField.module.css';

export interface TextFieldProps extends Omit<ComponentPropsWithoutRef<'input'>, 'id'> {
  label: string;
  hint?: string;
  errors?: string[] | undefined;
  /** Monospaced, spaced caps for invitation codes. */
  variant?: 'text' | 'code';
}

export function TextField({
  label,
  hint,
  errors,
  variant = 'text',
  className,
  ...input
}: TextFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      <input
        id={id}
        className={[styles.input, variant === 'code' && styles.code].filter(Boolean).join(' ')}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        {...input}
      />
      {errorId ? (
        <p id={errorId} className={styles.error}>
          {errors?.[0]}
        </p>
      ) : null}
    </div>
  );
}

export interface TextAreaProps extends Omit<ComponentPropsWithoutRef<'textarea'>, 'id'> {
  label: string;
  hint?: string | undefined;
  errors?: string[] | undefined;
}

/** A multi-line TextField: same label, hint and error treatment. */
export function TextArea({ label, hint, errors, className, ...textarea }: TextAreaProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      <textarea
        id={id}
        className={[styles.input, styles.multiline].join(' ')}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        {...textarea}
      />
      {errorId ? (
        <p id={errorId} className={styles.error}>
          {errors?.[0]}
        </p>
      ) : null}
    </div>
  );
}

export { styles as textFieldStyles };
