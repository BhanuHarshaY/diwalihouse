import { z } from 'zod';
import { EMBLEM_IDS } from './emblems.ts';
import { isCanonicalInviteCode, normalizeInviteCode } from './invite-code.ts';

/**
 * What we refuse in human-entered names, and why:
 *  - control, private-use, surrogate and unassigned code points;
 *  - every format character (category Cf: zero-width spaces, bidi marks and
 *    overrides, word joiners, soft hyphens, tag characters), which can make
 *    one guest's name look like another's. The exception is ZWJ/ZWNJ placed
 *    between letters of an Indic script, where they control conjunct shaping;
 *  - characters that render as blank space (Hangul fillers, Braille blank);
 *  - stacks of four or more combining marks ("Zalgo" text).
 * A name must also contain at least one letter or digit.
 */
export const INDIC = String.raw`\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}`;
const UNPRINTABLE = /[\p{Cc}\p{Co}\p{Cs}\p{Cn}ᅟᅠ⠀ㅤﾠ]/u;
const SHAPING_JOINER = new RegExp(`(?<=[${INDIC}])[\\u200C\\u200D](?=[${INDIC}])`, 'gu');
const FORMAT_CHARACTER = /\p{Cf}/u;
const MARK_STACK = /\p{M}{4,}/u;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export function isDisplayable(value: string): boolean {
  if (UNPRINTABLE.test(value) || MARK_STACK.test(value)) return false;
  if (FORMAT_CHARACTER.test(value.replace(SHAPING_JOINER, ''))) return false;
  return LETTER_OR_DIGIT.test(value);
}

/**
 * The key two names are compared by: compatibility-normalised (so fullwidth
 * "Ａｓｈａ" equals "Asha"), lower-cased, shaping joiners removed. Stored as
 * `members.name_key` under a unique index. Cross-script look-alikes (Cyrillic
 * "А" for Latin "A") are not folded yet: docs/architecture.md § 11.
 */
export function nameKey(displayName: string): string {
  return displayName
    .normalize('NFKC')
    .replace(/[‌‍]/g, '')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

function humanText(label: string, max: number) {
  return z
    .string({ error: `${label} is required.` })
    .transform((value) => value.normalize('NFC').replace(/\s+/gu, ' ').trim())
    .pipe(
      z
        .string()
        .min(1, `${label} is required.`)
        .max(max, `${label} must be ${max} characters or fewer.`)
        .refine(isDisplayable, {
          message: `${label} contains characters we can't display.`,
        }),
    );
}

export const DISPLAY_NAME_MAX = 32;
export const PARTY_NAME_MAX = 64;

export const displayNameSchema = humanText('Your name', DISPLAY_NAME_MAX);
export const partyNameSchema = humanText('Party name', PARTY_NAME_MAX);
export const emblemSchema = z.enum(EMBLEM_IDS, { error: 'Choose an emblem.' });
export const memberRoleSchema = z.enum(['host', 'guest']);
export const partyStatusSchema = z.enum(['open', 'closed']);

export const inviteCodeSchema = z
  .string()
  .transform((value, ctx) => {
    const code = normalizeInviteCode(value);
    if (code === null) {
      ctx.addIssue({ code: 'custom', message: 'Invite codes look like ABCD-1234.' });
      return z.NEVER;
    }
    return code;
  })
  .refine(isCanonicalInviteCode);

export const createPartyInputSchema = z.object({
  partyName: partyNameSchema,
  displayName: displayNameSchema,
  emblem: emblemSchema,
});

export const joinPartyInputSchema = z.object({
  displayName: displayNameSchema,
  emblem: emblemSchema,
});

export const memberViewSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  emblem: emblemSchema,
  role: memberRoleSchema,
  joinedAt: z.iso.datetime({ offset: true }),
});

export const partySnapshotSchema = z.object({
  party: z.object({
    id: z.uuid(),
    name: z.string(),
    status: partyStatusSchema,
    maxMembers: z.number().int(),
    createdAt: z.iso.datetime({ offset: true }),
  }),
  invite: z.object({ code: z.string() }).nullable(),
  me: z.object({ memberId: z.uuid(), role: memberRoleSchema }),
  members: z.array(memberViewSchema),
});

export const invitePreviewSchema = z.object({
  partyName: z.string(),
  hostName: z.string(),
  memberCount: z.number().int(),
  joinable: z.boolean(),
});

export type CreatePartyInput = z.infer<typeof createPartyInputSchema>;
export type JoinPartyInput = z.infer<typeof joinPartyInputSchema>;
export type MemberRole = z.infer<typeof memberRoleSchema>;
export type MemberView = z.infer<typeof memberViewSchema>;
export type PartySnapshot = z.infer<typeof partySnapshotSchema>;
export type InvitePreview = z.infer<typeof invitePreviewSchema>;
