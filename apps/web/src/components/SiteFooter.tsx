import styles from './SiteFooter.module.css';

export const COPYRIGHT_HOLDER = 'BhanuHarshaY';
export const COPYRIGHT_YEAR = 2026;
const LICENSE_URL = 'https://github.com/BhanuHarshaY/diwalihouse/blob/main/LICENSE';

/** The quiet line at the end of every page. The code is MIT-licensed (see LICENSE). */
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <p className="type-small">
        © {COPYRIGHT_YEAR} {COPYRIGHT_HOLDER} ·{' '}
        <a href={LICENSE_URL} className={styles.link}>
          MIT License
        </a>
      </p>
    </footer>
  );
}
