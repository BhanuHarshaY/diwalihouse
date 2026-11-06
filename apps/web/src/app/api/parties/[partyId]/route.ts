import { db } from '@/server/db';
import { DomainError, isDomainError } from '@/server/errors';
import { errorFields, log } from '@/server/log';
import { getPartySnapshot } from '@/server/parties/service';
import { getMemberContext } from '@/server/session-cookie';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * The caller's view of a party. Non-members, unknown parties, and revoked
 * sessions all receive the same 401, so the endpoint cannot be used to probe
 * which party ids exist.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  try {
    const ctx = await getMemberContext(partyId);
    if (!ctx) throw new DomainError('not_authenticated');
    return Response.json(await getPartySnapshot(db(), ctx), { headers: NO_STORE });
  } catch (error) {
    if (isDomainError(error)) {
      return Response.json(error.toJSON(), { status: error.status, headers: NO_STORE });
    }
    log('error', 'party.snapshot_failed', { partyId, ...errorFields(error) });
    return Response.json(new DomainError('internal').toJSON(), { status: 500, headers: NO_STORE });
  }
}
