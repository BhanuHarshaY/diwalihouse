'use client';

import { EMBLEM_IDS, type EmblemId } from '@diwali/contracts';
import { useActionState, useState, type FormEvent } from 'react';
import { Button } from '@/design-system/Button';
import { Emblem } from '@/design-system/emblems/Emblem';
import { EmblemPicker } from '@/design-system/emblems/EmblemPicker';
import { Frame } from '@/design-system/Frame';
import { TextField } from '@/design-system/TextField';
import { createPartyAction, joinPartyAction, type GuestFormState } from '@/server/actions';
import styles from './GuestCardForm.module.css';

type Props = { mode: 'host' } | { mode: 'join'; code: string; partyName: string };

const IDLE: GuestFormState = { status: 'idle' };

function asEmblem(value: string | undefined): EmblemId | undefined {
  return EMBLEM_IDS.find((id) => id === value);
}

/**
 * The guest card: a name, an emblem, and (for hosts) a party name. Native
 * form + server action, so it submits before hydration too. A live place
 * card previews what other guests will see.
 */
export function GuestCardForm(props: Props) {
  const action = props.mode === 'host' ? createPartyAction : joinPartyAction.bind(null, props.code);
  const [state, formAction, pending] = useActionState(action, IDLE);
  const failed = state.status === 'error' ? state : undefined;
  const values = failed?.values ?? {};

  const [preview, setPreview] = useState<{ name: string; emblem: EmblemId | undefined }>({
    name: values.displayName ?? '',
    emblem: asEmblem(values.emblem),
  });

  function onInput(event: FormEvent<HTMLFormElement>) {
    const target = event.target as HTMLInputElement;
    if (target.name === 'displayName') setPreview((p) => ({ ...p, name: target.value }));
  }

  const partyLabel = props.mode === 'join' ? props.partyName : undefined;

  return (
    <Frame variant="paper">
      <form action={formAction} onInput={onInput} className={styles.form} noValidate>
        <div className={styles.placeCard} aria-hidden>
          <div className={styles.placeEmblem}>
            {preview.emblem ? (
              <Emblem id={preview.emblem} size={72} />
            ) : (
              <span className={styles.emptyEmblem} />
            )}
          </div>
          <div className={styles.placeText}>
            <p className="type-eyebrow">
              {partyLabel ? `Guest at ${partyLabel}` : 'Your place card'}
            </p>
            <p
              className={`type-masthead-md ${styles.placeName}`}
              data-empty={!preview.name || undefined}
            >
              {preview.name.trim() || 'Your name'}
            </p>
          </div>
        </div>

        {failed ? (
          <p role="alert" className={styles.alert}>
            {failed.message}
          </p>
        ) : null}

        {props.mode === 'host' ? (
          <TextField
            label="Party name"
            name="partyName"
            placeholder="The Rao family Diwali"
            hint="Guests see this on their invitation."
            defaultValue={values.partyName}
            errors={failed?.fields.partyName}
            maxLength={64}
            required
            autoComplete="off"
          />
        ) : null}

        <TextField
          label="Your name"
          name="displayName"
          placeholder={props.mode === 'host' ? 'Asha' : 'What should everyone call you?'}
          defaultValue={values.displayName}
          errors={failed?.fields.displayName}
          maxLength={32}
          required
          autoComplete="nickname"
        />

        <EmblemPicker
          name="emblem"
          defaultValue={asEmblem(values.emblem)}
          errors={failed?.fields.emblem}
          onChange={(emblem) => setPreview((p) => ({ ...p, emblem }))}
        />

        <Button
          type="submit"
          tone="vermilion"
          size="lg"
          block
          pending={pending}
          pendingLabel={props.mode === 'host' ? 'Opening the house' : 'Coming in'}
        >
          {props.mode === 'host' ? 'Open the house' : 'Enter the party'}
        </Button>

        <p className={styles.note}>
          No account needed. This browser remembers your place for 30 days; clearing its cookies
          means joining again.
        </p>
      </form>
    </Frame>
  );
}
