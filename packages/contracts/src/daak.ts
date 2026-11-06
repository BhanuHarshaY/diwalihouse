import { z } from 'zod';
import { emblemSchema, INDIC, isDisplayable, memberRoleSchema } from './party.ts';

/**
 * Diwali Daak: the party's guestbook of postcards (docs/diwali-daak.md).
 * A postcard is a short message, an optional "To" line, and a stamp.
 */

export const STAMPS = ['diya', 'kandil', 'genda', 'rangoli', 'phuljhadi', 'mithai'] as const;
export type StampId = (typeof STAMPS)[number];
export const stampSchema = z.enum(STAMPS, { error: 'Choose a stamp.' });

export const POSTCARD_MESSAGE_MAX = 280;
export const POSTCARD_LINES_MAX = 8;
export const POSTCARD_TO_MAX = 40;

export const DAAK_LIMITS = {
  /** Postcards one person can have on the wall. */
  perMember: 20,
  /** Postcards in one party's letterbox. */
  perParty: 500,
  /** Seconds between one person's postcards. */
  secondsBetween: 5,
} as const;

/**
 * Messages may hold emoji (🪔 is half of most Diwali greetings), so the
 * joiners inside emoji sequences are allowed, as are Indic shaping joiners.
 * Everything else that can disguise text is refused: control characters
 * other than line breaks, bidi overrides and other format characters,
 * private-use and unassigned code points, blank look-alikes, mark stacks.
 */
const JOINER_IN_EMOJI =
  /(?<=[\p{Extended_Pictographic}\p{Emoji_Modifier}️])‍(?=\p{Extended_Pictographic})/gu;
const SHAPING_JOINER = new RegExp(`(?<=[${INDIC}])[\\u200C\\u200D](?=[${INDIC}])`, 'gu');
const CONTROL = /\p{Cc}/u;
const HIDDEN = /[\p{Cf}\p{Co}\p{Cs}\p{Cn}\u115F\u1160\u2800\u3164\uFFA0]/u;
const MARK_STACK = /\p{M}{4,}/u;
const SOMETHING_TO_READ = /[\p{L}\p{N}\p{Extended_Pictographic}]/u;

export function isWritable(text: string): boolean {
  if (CONTROL.test(text.replaceAll('\n', '')) || MARK_STACK.test(text)) return false;
  if (HIDDEN.test(text.replace(JOINER_IN_EMOJI, '').replace(SHAPING_JOINER, ''))) return false;
  return SOMETHING_TO_READ.test(text);
}

/** Tidies a message: one kind of line break, single spaces, at most one blank line. */
export function tidyMessage(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/gu, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const postcardMessageSchema = z
  .string({ error: 'Write a message.' })
  .transform(tidyMessage)
  .pipe(
    z
      .string()
      .min(1, 'Write a message.')
      .max(POSTCARD_MESSAGE_MAX, `Keep it to ${POSTCARD_MESSAGE_MAX} characters.`)
      .refine((text) => text.split('\n').length <= POSTCARD_LINES_MAX, {
        message: `Keep it to ${POSTCARD_LINES_MAX} lines.`,
      })
      .refine(isWritable, { message: 'The message contains characters we can’t display.' }),
  );

/** Who the card is to, in the writer's words ("Nani and Nanu"). Blank means everyone. */
export const postcardToSchema = z
  .string()
  .optional()
  .transform((value) => value?.normalize('NFC').replace(/\s+/gu, ' ').trim() || null)
  .pipe(
    z
      .string()
      .max(POSTCARD_TO_MAX, `Keep the “To” line to ${POSTCARD_TO_MAX} characters.`)
      .refine(isDisplayable, { message: 'The “To” line contains characters we can’t display.' })
      .nullable(),
  );

export const postcardInputSchema = z.object({
  to: postcardToSchema,
  message: postcardMessageSchema,
  stamp: stampSchema,
});

export const postcardViewSchema = z.object({
  id: z.uuid(),
  from: z.object({
    memberId: z.uuid(),
    displayName: z.string(),
    emblem: emblemSchema,
    /** False once they have left the party; their postcards stay. */
    here: z.boolean(),
  }),
  to: z.string().nullable(),
  message: z.string(),
  stamp: stampSchema,
  postedAt: z.iso.datetime({ offset: true }),
  /** Hidden by the host. Only the host and the writer ever receive a hidden card. */
  hidden: z.boolean(),
});

export const daakSnapshotSchema = z.object({
  partyName: z.string(),
  me: z.object({
    memberId: z.uuid(),
    role: memberRoleSchema,
    /** How many of my postcards are on the wall. */
    sent: z.number().int(),
  }),
  postcards: z.array(postcardViewSchema),
});

export type PostcardInput = z.infer<typeof postcardInputSchema>;
export type PostcardView = z.infer<typeof postcardViewSchema>;
export type DaakSnapshot = z.infer<typeof daakSnapshotSchema>;
