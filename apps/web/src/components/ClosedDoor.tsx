import { ButtonLink } from '@/design-system/Button';
import { Frame } from '@/design-system/Frame';

/**
 * Shown for any party a visitor can't enter, whatever the reason. The copy
 * never confirms whether a party exists, so ids cannot be probed.
 */
export function ClosedDoor({
  title = 'This door is closed',
  message = 'Either this party does not exist, or this browser is not on its guest list. If you were invited, open the invitation link from your host again.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <Frame variant="paper" className="text-center">
      <p className="type-eyebrow text-vermilion-700">Diwali House</p>
      <h1 className="type-masthead-md mt-3">{title}</h1>
      <p className="type-story mt-4 text-[color:var(--ink-on-paper-muted)]">{message}</p>
      <div className="mt-8 flex justify-center">
        <ButtonLink href="/" tone="ink">
          Back to the house
        </ButtonLink>
      </div>
    </Frame>
  );
}
