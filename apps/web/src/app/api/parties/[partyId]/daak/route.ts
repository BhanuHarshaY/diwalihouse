import { db } from '@/server/db';
import { DomainError, isDomainError } from '@/server/errors';
import { errorFields, log } from '@/server/log';
import { getDaak } from '@/server/parties/service';
import { getMemberContext } from '@/server/session-cookie';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * The postcards the caller may see. Hidden cards are filtered by the party
 * service, never by the page. Same uniform 401 as every party endpoint.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  try {
    const ctx = await getMemberContext(partyId);
    if (!ctx) throw new DomainError('not_authenticated');
    return Response.json(await getDaak(db(), ctx), { headers: NO_STORE });
  } catch (error) {
    if (isDomainError(error)) {
      return Response.json(error.toJSON(), { status: error.status, headers: NO_STORE });
    }
    log('error', 'daak.read_failed', { partyId, ...errorFields(error) });
    return Response.json(new DomainError('internal').toJSON(), { status: 500, headers: NO_STORE });
  }
}
