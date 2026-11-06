import 'server-only';
import { headers } from 'next/headers';
import { clientNetwork, trustedIpHeader } from './client-ip';
import { db } from './db';
import { serverEnv } from './env';
import { DomainError } from './errors';
import { consumeRateLimit, isRateLimited, type RateLimitRule } from './rate-limit';
import { pepperedKey } from './tokens';

/** A stable, non-reversible key for the requesting network (see client-ip.ts). */
export async function clientKey(): Promise<string> {
  const env = serverEnv();
  const network = clientNetwork(await headers(), trustedIpHeader(env));
  return pepperedKey(env.APP_SECRET, network);
}

/**
 * Limits, chosen so a whole household on one Wi-Fi can join a party while
 * guessing codes stays impractical:
 *  - `inviteMiss` counts only *failed* code lookups per network. Once it is
 *    spent, that network can't look up any code until the window ends.
 *  - `join` and `joinPerCode` cap new identities per network and per
 *    invitation, above any real party's size.
 */
export const LIMITS = {
  createParty: { limit: 10, windowSeconds: 60 * 60 },
  inviteMiss: { limit: 20, windowSeconds: 10 * 60 },
  join: { limit: 40, windowSeconds: 10 * 60 },
  joinPerCode: { limit: 60, windowSeconds: 10 * 60 },
} as const satisfies Record<string, Omit<RateLimitRule, 'key'>>;

type Bucket = keyof typeof LIMITS;

async function rule(bucket: Bucket, subject?: string): Promise<RateLimitRule> {
  const key = subject ? pepperedKey(serverEnv().APP_SECRET, subject) : await clientKey();
  return { key: `${bucket}:${key}`, ...LIMITS[bucket] };
}

function limited(retryAfterSeconds: number): DomainError {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return new DomainError(
    'rate_limited',
    `Too many attempts from this network. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
  );
}

/** Spends one hit; throws `rate_limited` once the budget is gone. */
export async function enforceRateLimit(bucket: Bucket, subject?: string): Promise<void> {
  const result = await consumeRateLimit(db(), await rule(bucket, subject));
  if (!result.allowed) throw limited(result.retryAfterSeconds);
}

/** Throws `rate_limited` if the budget is already gone, without spending a hit. */
export async function assertNotRateLimited(bucket: Bucket): Promise<void> {
  const current = await rule(bucket);
  if (await isRateLimited(db(), current)) throw limited(current.windowSeconds);
}

/** Records a failed invitation lookup against this network. */
export async function recordInviteMiss(): Promise<void> {
  await consumeRateLimit(db(), await rule('inviteMiss'));
}

export function inviteUrl(code: string): string {
  return new URL(`/join/${code}`, serverEnv().PUBLIC_APP_URL).toString();
}
