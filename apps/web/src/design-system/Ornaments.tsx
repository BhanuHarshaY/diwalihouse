import styles from './Ornaments.module.css';

export function DotRule({
  vertical = false,
  className,
}: {
  vertical?: boolean;
  className?: string | undefined;
}) {
  return (
    <div
      aria-hidden
      className={[vertical ? styles.dotRuleVertical : styles.dotRule, className]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
