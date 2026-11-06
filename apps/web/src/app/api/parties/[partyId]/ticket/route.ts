import { signTicket, TICKET_TTL_MS } from '@diwali/realtime-protocol';
import { db } from '@/server/db';
import { serverEnv } from '@/server/env';
import { DomainError, isDomainError } from '@/server/errors';
import { errorFields, log } from '@/server/log';
import { getMemberProfile } from '@/server/parties/service';
import { getMemberContext } from '@/server/session-cookie';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

let privateKey: JsonWebKey | null = null;

/**
 * Issues a 60-second, single-use realtime ticket for the caller's membership
 * in this party (docs/architecture.md § 6). The realtime Worker trusts the
 * ticket's claims, so they come from the database, never from the request.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ partyId: string }> },
) {
  const { partyId } = await params;
  const env = serverEnv();
  if (!env.REALTIME_PRIVATE_KEY || !env.REALTIME_URL) {
    return Response.json(
      { error: { code: 'not_found', message: 'Realtime is not configured on this server.' } },
      { status: 503, headers: NO_STORE },
    );
  }
  try {
    const ctx = await getMemberContext(partyId);
    if (!ctx) throw new DomainError('not_authenticated');
    const profile = await getMemberProfile(db(), ctx);
    privateKey ??= JSON.parse(env.REALTIME_PRIVATE_KEY) as JsonWebKey;
    const ticket = await signTicket(privateKey, {
      v: 1,
      party: ctx.partyId,
      member: ctx.memberId,
      role: profile.role,
      name: profile.displayName,
      emblem: profile.emblem,
      exp: Date.now() + TICKET_TTL_MS,
      jti: crypto.randomUUID(),
    });
    return Response.json({ ticket, url: env.REALTIME_URL }, { headers: NO_STORE });
  } catch (error) {
    if (isDomainError(error)) {
      return Response.json(error.toJSON(), { status: error.status, headers: NO_STORE });
    }
    log('error', 'realtime.ticket_failed', { partyId, ...errorFields(error) });
    return Response.json(new DomainError('internal').toJSON(), { status: 500, headers: NO_STORE });
  }
}
