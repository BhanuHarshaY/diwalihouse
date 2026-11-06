import 'server-only';
import { signRevocation, TICKET_TTL_MS } from '@diwali/realtime-protocol';
import { serverEnv } from './env';
import { errorFields, log } from './log';

let privateKey: JsonWebKey | null = null;

/**
 * Tells the realtime service that a member has left or been removed, so it
 * closes their open sockets in every room of the party and refuses them from
 * then on (docs/architecture.md § 6). Tickets are only checked when a socket
 * opens; without this, a removed guest's open sockets would keep working.
 *
 * Called after the database change has committed. It never throws: the
 * member is already out of the party, and a failure here is logged.
 */
export async function revokeRealtimeAccess(partyId: string, memberId: string): Promise<void> {
  const env = serverEnv();
  if (!env.REALTIME_PRIVATE_KEY || !env.REALTIME_URL) return;
  try {
    privateKey ??= JSON.parse(env.REALTIME_PRIVATE_KEY) as JsonWebKey;
    const notice = await signRevocation(privateKey, {
      v: 1,
      party: partyId,
      member: memberId,
      exp: Date.now() + TICKET_TTL_MS,
      jti: crypto.randomUUID(),
    });
    const base = env.REALTIME_URL.replace(/^ws/, 'http');
    const response = await fetch(`${base}/parties/${partyId}/revoke`, {
      method: 'POST',
      body: notice,
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      log('warn', 'realtime.revoke_failed', { partyId, memberId, status: response.status });
    }
  } catch (error) {
    log('warn', 'realtime.revoke_failed', { partyId, memberId, ...errorFields(error) });
  }
}
