import { deviceIdSchema, verifyRevocation, verifyTicket } from '@diwali/realtime-protocol';
import type { Env } from './rooms.ts';

export { CourtyardRoom, GameRoom, MehfilRoom, PartyRoom } from './rooms.ts';

/**
 * The realtime Worker: verifies tickets and hands sockets to the right room.
 *
 *   GET  /parties/:party/connect?ticket=…                 → PartyRoom(party)
 *   GET  /parties/:party/games/:game/connect?ticket=…     → GameRoom(party:game)
 *   GET  /parties/:party/courtyard/connect?ticket=…       → CourtyardRoom(party)
 *   GET  /parties/:party/mehfil/connect?ticket=…&device=… → MehfilRoom(party)
 *   POST /parties/:party/revoke   (body: revocation notice) → PartyRoom(party), every room
 *
 * A ticket is honoured only for the party it names, only before it
 * expires, only from an allowed browser origin, and only once. A
 * revocation notice is signed by the web app with the same key and names
 * its party; it closes that member's sockets everywhere in the party.
 */

const ID = '[A-Za-z0-9-]{1,64}';
const PARTY_ROUTE = new RegExp(`^/parties/(${ID})/connect$`);
const GAME_ROUTE = new RegExp(`^/parties/(${ID})/games/([a-z0-9]{4,16})/connect$`);
const COURTYARD_ROUTE = new RegExp(`^/parties/(${ID})/courtyard/connect$`);
const MEHFIL_ROUTE = new RegExp(`^/parties/(${ID})/mehfil/connect$`);
const REVOKE_ROUTE = new RegExp(`^/parties/(${ID})/revoke$`);

let publicKey: JsonWebKey | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error) {
      console.error(
        JSON.stringify({ level: 'error', event: 'realtime.route_failed', error: String(error) }),
      );
      return new Response('internal error', { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/') return new Response('Diwali House realtime\n');
  publicKey ??= JSON.parse(env.REALTIME_PUBLIC_KEY) as JsonWebKey;

  const revokeMatch = REVOKE_ROUTE.exec(url.pathname);
  if (revokeMatch) {
    if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
    const party = revokeMatch[1]!;
    const token = await request.text();
    if (token.length > 2048) return new Response('too large', { status: 413 });
    const verified = await verifyRevocation(publicKey, token, { now: Date.now(), party });
    if (!verified.ok) return new Response(`notice ${verified.reason}`, { status: 401 });
    const stub = env.PARTY_ROOM.get(env.PARTY_ROOM.idFromName(party));
    return stub.fetch('https://party/revoke', {
      method: 'POST',
      body: JSON.stringify({ party, member: verified.claims.member }),
    });
  }

  const partyMatch = PARTY_ROUTE.exec(url.pathname);
  const gameMatch = GAME_ROUTE.exec(url.pathname);
  const courtyardMatch = COURTYARD_ROUTE.exec(url.pathname);
  const mehfilMatch = MEHFIL_ROUTE.exec(url.pathname);
  const match = partyMatch ?? gameMatch ?? courtyardMatch ?? mehfilMatch;
  if (!match) return new Response('not found', { status: 404 });
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('expected a websocket', { status: 426 });
  }

  const origin = request.headers.get('origin');
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  if (origin && !allowed.includes(origin))
    return new Response('origin not allowed', { status: 403 });

  const party = match[1]!;
  const verified = await verifyTicket(publicKey, url.searchParams.get('ticket') ?? '', {
    now: Date.now(),
    party,
  });
  if (!verified.ok) return new Response(`ticket ${verified.reason}`, { status: 401 });

  const { member, role, name, emblem, jti, exp } = verified.claims;
  const headers = new Headers(request.headers);
  headers.set('x-diwali-identity', JSON.stringify({ member, role, name, emblem, jti, exp }));

  if (gameMatch) {
    const game = gameMatch[2]!;
    const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(`${party}:${game}`));
    return stub.fetch(new Request(`https://game/connect?party=${party}`, { headers }));
  }
  if (mehfilMatch) {
    const device = deviceIdSchema.safeParse(url.searchParams.get('device'));
    if (!device.success) return new Response('bad device', { status: 400 });
    const stub = env.MEHFIL_ROOM.get(env.MEHFIL_ROOM.idFromName(party));
    return stub.fetch(
      new Request(`https://mehfil/connect?party=${party}&device=${device.data}`, { headers }),
    );
  }
  if (courtyardMatch) {
    const stub = env.COURTYARD_ROOM.get(env.COURTYARD_ROOM.idFromName(party));
    return stub.fetch(new Request(`https://courtyard/connect?party=${party}`, { headers }));
  }
  const stub = env.PARTY_ROOM.get(env.PARTY_ROOM.idFromName(party));
  return stub.fetch(new Request(`https://party/connect?party=${party}`, { headers }));
}
