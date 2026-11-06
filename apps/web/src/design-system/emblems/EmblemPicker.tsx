import { EMBLEMS, type EmblemId } from '@diwali/contracts';
import { useId } from 'react';
import { Emblem } from './Emblem';
import styles from './EmblemPicker.module.css';

export interface EmblemPickerProps {
  name: string;
  defaultValue?: EmblemId | undefined;
  errors?: string[] | undefined;
  onChange?: (id: EmblemId) => void;
}

/**
 * Native radio group, so it works before hydration and keyboard behaviour
 * (arrow keys within the group) comes from the browser.
 */
export function EmblemPicker({ name, defaultValue, errors, onChange }: EmblemPickerProps) {
  const errorId = useId();
  return (
    <fieldset
      className={styles.picker}
      aria-describedby={errors?.length ? errorId : undefined}
      aria-invalid={errors?.length ? true : undefined}
    >
      <legend className={styles.legend}>Choose your emblem</legend>
      <div className={styles.grid}>
        {EMBLEMS.map((emblem) => (
          <label key={emblem.id} className={styles.option}>
            <input
              type="radio"
              name={name}
              value={emblem.id}
              defaultChecked={emblem.id === defaultValue}
              required
              onChange={() => onChange?.(emblem.id)}
            />
            <Emblem id={emblem.id} size={52} className={styles.medallion} />
            <span className={styles.name}>
              {emblem.en}
              <br />
              <span lang="hi">{emblem.hi}</span>
            </span>
          </label>
        ))}
      </div>
      {errors?.length ? (
        <p id={errorId} className={styles.error}>
          {errors[0]}
        </p>
      ) : null}
    </fieldset>
  );
}
