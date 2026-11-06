import Image from 'next/image';
import { ArchWindow } from '@/illustrations/ArchWindow';
import { Playable } from '@/illustrations/Playable';
import { TRADITION_ART } from '@/illustrations/traditions';
import styles from './SceneStories.module.css';
import { TRADITIONS } from './traditions';

/**
 * Scene 2, "The Festival of Lights": a wall of lit windows, one per
 * tradition. Server-rendered, so every word is in the document; Playable only
 * starts each window's idle motion while it is on screen.
 */
export function SceneStories() {
  return (
    <section className={styles.scene} aria-labelledby="stories-title">
      <header className={styles.header}>
        <p className={`type-eyebrow ${styles.eyebrow}`}>The festival of lights</p>
        <h2 id="stories-title" className={`type-masthead-lg ${styles.title}`}>
          One night, many stories
        </h2>
        <p lang="hi" className={`type-story-lg ${styles.titleHi}`}>
          एक रात, अनेक कथाएँ
        </p>
        <p className={`type-story ${styles.intro}`}>
          Diwali is celebrated by Hindus, Jains and Sikhs, and by some Buddhists, in India and far
          beyond it. The lamps are shared. The reasons for lighting them differ from region to
          region, faith to faith and family to family. These are some of them. This is not a
          complete list, and none of them is the only true meaning.
        </p>
      </header>

      <ol className={styles.grid}>
        {TRADITIONS.map((tradition) => {
          const art = TRADITION_ART[tradition.id];
          return (
            <li key={tradition.id} className={styles.entry} data-tradition={tradition.id}>
              <Playable className={styles.window}>
                {tradition.illustration ? (
                  <Image
                    src={tradition.illustration.src}
                    alt={tradition.illustration.alt}
                    width={tradition.illustration.width}
                    height={tradition.illustration.height}
                    sizes="(min-width: 72rem) 18rem, (min-width: 40rem) 45vw, 90vw"
                  />
                ) : art ? (
                  <ArchWindow id={tradition.id} colours={art.colours}>
                    {art.motif}
                  </ArchWindow>
                ) : null}
              </Playable>
              <div className={styles.text}>
                <p className={`type-eyebrow ${styles.who}`}>{tradition.who}</p>
                <h3 className={styles.entryTitle}>{tradition.title}</h3>
                <p lang={tradition.native.lang} className={styles.native}>
                  {tradition.native.text}
                </p>
                <p className={`type-story ${styles.body}`}>{tradition.body}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <p className={`type-story-lg ${styles.closing}`}>
        However your family tells it, the house is open tonight.
      </p>
    </section>
  );
}
