import { FamilyPortrait, FriendsPortrait } from '@/illustrations/gatherings';
import { Playable } from '@/illustrations/Playable';
import styles from './ScenePeople.module.css';

/**
 * "Bring your people": between the rangoli at the threshold and the doors,
 * the guests themselves. Family and friends, each group in its own window,
 * arriving one by one the first time they are seen.
 */
export function ScenePeople() {
  return (
    <section className={styles.scene} aria-labelledby="people-title">
      <header className={styles.header}>
        <p className={`type-eyebrow ${styles.eyebrow}`}>Everyone is invited</p>
        <h2 id="people-title" className="type-masthead-lg">
          Bring your people
        </h2>
        <p lang="hi" className={`type-story-lg ${styles.hi}`}>
          अपनों को बुलाइए
        </p>
        <p className={`type-story ${styles.lede}`}>
          Grandparents and cousins, neighbours, the friends who became family. Everyone comes in on
          their own phone, with a name and an emblem. No accounts, and no app to install.
        </p>
      </header>
      <div className={styles.groups}>
        <figure className={styles.group}>
          <Playable className={styles.window}>
            <FamilyPortrait />
          </Playable>
          <figcaption className={styles.caption}>
            <span className="type-label">Family</span>
            <span lang="hi">परिवार</span>
          </figcaption>
        </figure>
        <figure className={styles.group}>
          <Playable className={styles.window}>
            <FriendsPortrait />
          </Playable>
          <figcaption className={styles.caption}>
            <span className="type-label">Friends</span>
            <span lang="hi">दोस्त</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
