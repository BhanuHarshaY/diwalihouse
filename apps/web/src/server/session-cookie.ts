import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { db } from './db';
import { serverEnv } from './env';
import { authenticate, SESSION_TTL_DAYS, type MemberContext } from './parties/service';

/**
 * One cookie per party. A browser can belong to several parties at once and
 * each credential only ever opens its own party. In production the
 * `__Host-` prefix pins the cookie to our exact origin over HTTPS.
 */
function secureCookies(): boolean {
  return new URL(serverEnv().PUBLIC_APP_URL).protocol === 'https:';
}

export function sessionCookieName(partyId: string): string {
  const base = `dh_s_${partyId.replaceAll('-', '')}`;
  return secureCookies() ? `__Host-${base}` : base;
}

export async function setSessionCookie(partyId: string, token: string): Promise<void> {
  const jar = await cookies();
  jar.set(sessionCookieName(partyId), token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(partyId: string): Promise<void> {
  const jar = await cookies();
  jar.delete({ name: sessionCookieName(partyId), path: '/' });
}

/** The caller's membership in `partyId`, or `null`. Memoised per request. */
export const getMemberContext = cache(async (partyId: string): Promise<MemberContext | null> => {
  const jar = await cookies();
  return authenticate(db(), partyId, jar.get(sessionCookieName(partyId))?.value);
});
