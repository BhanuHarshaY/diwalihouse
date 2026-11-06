'use server';

import {
  createPartyInputSchema,
  inviteCodeSchema,
  joinPartyInputSchema,
  postcardInputSchema,
  type ApiErrorCode,
  type JoinPartyInput,
} from '@diwali/contracts';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from './db';
import { DomainError, isDomainError } from './errors';
import { errorFields, log } from './log';
import {
  createParty,
  joinParty,
  leaveParty,
  previewInvite,
  removeMember,
  rotateInvite,
  sendPostcard,
  setPostcardHidden,
  withdrawPostcard,
  type MemberContext,
} from './parties/service';
import { revokeRealtimeAccess } from './realtime';
import { assertNotRateLimited, enforceRateLimit, recordInviteMiss } from './request';
import { clearSessionCookie, getMemberContext, setSessionCookie } from './session-cookie';

/**
 * Server actions. Next.js rejects cross-origin action calls by comparing the
 * Origin and Host headers, and session cookies are SameSite=Lax, so these are
 * not reachable by CSRF. Every party-scoped action re-authenticates from the
 * cookie for the party it names; nothing trusts ids from the client alone.
 * Action arguments arrive as untrusted JSON, so they are parsed, not typed.
 */

const idSchema = z.uuid();

/** Authenticates the caller for `rawPartyId`, which may be anything the client sent. */
async function memberOf(rawPartyId: unknown): Promise<MemberContext> {
  const partyId = idSchema.safeParse(rawPartyId);
  const ctx = partyId.success ? await getMemberContext(partyId.data) : null;
  if (!ctx) throw new DomainError('not_authenticated');
  return ctx;
}

export interface GuestFormValues {
  partyName?: string;
  displayName?: string;
  emblem?: string;
}

export type GuestFormState =
  | { status: 'idle' }
  | {
      status: 'error';
      code: ApiErrorCode;
      message: string;
      fields: Record<string, string[] | undefined>;
      values: GuestFormValues;
    };

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ApiErrorCode;
      message: string;
      fields?: Record<string, string[] | undefined> | undefined;
    };

function readValues(formData: FormData): GuestFormValues {
  const values: GuestFormValues = {};
  for (const key of ['partyName', 'displayName', 'emblem'] as const) {
    const value = formData.get(key);
    if (typeof value === 'string') values[key] = value;
  }
  return values;
}

function failure(error: unknown, values: GuestFormValues, event: string): GuestFormState {
  if (error instanceof z.ZodError) {
    return {
      status: 'error',
      code: 'validation_failed',
      message: 'Some details need another look.',
      fields: z.flattenError(error).fieldErrors,
      values,
    };
  }
  if (isDomainError(error)) {
    return {
      status: 'error',
      code: error.code,
      message: error.message,
      fields: error.fields ?? {},
      values,
    };
  }
  log('error', event, errorFields(error));
  return {
    status: 'error',
    code: 'internal',
    message: 'Something went wrong on our side. Please try again.',
    fields: {},
    values,
  };
}

function actionFailure(error: unknown, event: string): ActionResult<never> {
  if (isDomainError(error)) return { ok: false, code: error.code, message: error.message };
  log('error', event, errorFields(error));
  return { ok: false, code: 'internal', message: 'Something went wrong on our side.' };
}

export async function createPartyAction(
  _previous: GuestFormState,
  formData: FormData,
): Promise<GuestFormState> {
  const values = readValues(formData);
  let partyId: string;
  try {
    const input = createPartyInputSchema.parse(values);
    await enforceRateLimit('createParty');
    const created = await createParty(db(), input);
    await setSessionCookie(created.partyId, created.token);
    log('info', 'party.created', { partyId: created.partyId });
    partyId = created.partyId;
  } catch (error) {
    return failure(error, values, 'party.create_failed');
  }
  redirect(`/party/${partyId}`);
}

export async function joinPartyAction(
  rawCode: string,
  _previous: GuestFormState,
  formData: FormData,
): Promise<GuestFormState> {
  const values = readValues(formData);
  let partyId: string;
  try {
    const code = inviteCodeSchema.parse(rawCode);
    const input = joinPartyInputSchema.parse(values);
    await assertNotRateLimited('inviteMiss');
    const invite = await previewInvite(db(), code);
    if (!invite) {
      await recordInviteMiss();
      throw new DomainError('invite_not_found');
    }
    // One browser, one seat: a returning guest goes back in rather than
    // minting a second identity from the same invitation.
    const existing = await getMemberContext(invite.partyId);
    if (existing) {
      partyId = existing.partyId;
    } else {
      await enforceRateLimit('join');
      await enforceRateLimit('joinPerCode', code);
      partyId = await completeJoin(code, input);
    }
  } catch (error) {
    return failure(error, values, 'party.join_failed');
  }
  redirect(`/party/${partyId}`);
}

async function completeJoin(code: string, input: JoinPartyInput): Promise<string> {
  const joined = await joinParty(db(), code, input);
  await setSessionCookie(joined.partyId, joined.token);
  log('info', 'party.joined', { partyId: joined.partyId, memberId: joined.memberId });
  return joined.partyId;
}

export async function rotateInviteAction(partyId: string): Promise<ActionResult<{ code: string }>> {
  try {
    const ctx = await memberOf(partyId);
    const data = await rotateInvite(db(), ctx);
    log('info', 'party.invite_rotated', { partyId: ctx.partyId });
    return { ok: true, data };
  } catch (error) {
    return actionFailure(error, 'party.rotate_failed');
  }
}

/**
 * Removes a guest. With `alsoRotate`, the invitation is replaced in the same
 * step, so the removed guest can't simply rejoin with the code they had.
 */
export async function removeMemberAction(
  partyId: string,
  memberId: string,
  alsoRotate: boolean,
): Promise<ActionResult<{ code: string | null }>> {
  try {
    const ctx = await memberOf(partyId);
    const target = idSchema.safeParse(memberId);
    if (!target.success) throw new DomainError('not_found');
    await removeMember(db(), ctx, target.data);
    log('info', 'party.member_removed', { partyId: ctx.partyId, memberId: target.data });
    await revokeRealtimeAccess(ctx.partyId, target.data);
    if (alsoRotate === true) {
      const { code } = await rotateInvite(db(), ctx);
      log('info', 'party.invite_rotated', { partyId: ctx.partyId });
      return { ok: true, data: { code } };
    }
    return { ok: true, data: { code: null } };
  } catch (error) {
    return actionFailure(error, 'party.remove_failed');
  }
}

export async function leavePartyAction(partyId: string): Promise<ActionResult> {
  try {
    const ctx = await memberOf(partyId);
    await leaveParty(db(), ctx);
    await clearSessionCookie(ctx.partyId);
    log('info', 'party.member_left', { partyId: ctx.partyId, memberId: ctx.memberId });
    await revokeRealtimeAccess(ctx.partyId, ctx.memberId);
  } catch (error) {
    return actionFailure(error, 'party.leave_failed');
  }
  redirect('/');
}

// ---------------------------------------------------------------------------
// Diwali Daak. Messages are private to the party, so they are never logged.
// ---------------------------------------------------------------------------

export async function sendPostcardAction(
  partyId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    // Membership first, so a non-member learns nothing from validation.
    const ctx = await memberOf(partyId);
    const parsed = postcardInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        code: 'validation_failed',
        message: 'Some details need another look.',
        fields: z.flattenError(parsed.error).fieldErrors,
      };
    }
    const card = await sendPostcard(db(), ctx, parsed.data);
    log('info', 'daak.posted', { partyId: ctx.partyId });
    return { ok: true, data: card };
  } catch (error) {
    return actionFailure(error, 'daak.post_failed');
  }
}

export async function withdrawPostcardAction(
  partyId: string,
  postcardId: string,
): Promise<ActionResult> {
  try {
    const ctx = await memberOf(partyId);
    const id = idSchema.safeParse(postcardId);
    if (!id.success) throw new DomainError('not_found');
    await withdrawPostcard(db(), ctx, id.data);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error, 'daak.withdraw_failed');
  }
}

export async function setPostcardHiddenAction(
  partyId: string,
  postcardId: string,
  hidden: boolean,
): Promise<ActionResult> {
  try {
    const ctx = await memberOf(partyId);
    const id = idSchema.safeParse(postcardId);
    if (!id.success) throw new DomainError('not_found');
    await setPostcardHidden(db(), ctx, id.data, hidden === true);
    log('info', hidden === true ? 'daak.hidden' : 'daak.shown', { partyId: ctx.partyId });
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error, 'daak.moderate_failed');
  }
}
