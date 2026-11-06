import { DurableObject } from 'cloudflare:workers';
import type { Stroke } from '@diwali/rangoli';
import {
  courtyardClientMessageSchema,
  gameClientMessageSchema,
  mehfilClientMessageSchema,
  partyClientMessageSchema,
  type GameKind,
  type GameOptions,
  type GameSummary,
  type ServerMessage,
} from '@diwali/realtime-protocol';
import { cryptoRng } from '@diwali/game-kit';
import { CourtyardCore, type SavedCourtyard, type StrokeChange } from './courtyard-core.ts';
import { GameCore, type Connection, type SavedGame } from './game-core.ts';
import { MehfilCore, type MehfilConnection, type SavedMehfil } from './mehfil-core.ts';
import { youtubeLookup, type Lookup } from './oembed.ts';
import { MAX_GAMES, newGameId, presence, ReplayGuard, upsertGame } from './party-core.ts';

/**
 * The Durable Objects. All use the WebSocket Hibernation API, so an idle
 * party, game or courtyard costs nothing while its sockets stay open, and
 * all persist to their own SQLite-backed storage after every change.
 *
 * Identity arrives in the `x-diwali-identity` header, set by the Worker
 * after it has verified the ticket. Rooms are not reachable any other way.
 */

export interface Env {
  PARTY_ROOM: DurableObjectNamespace<PartyRoom>;
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  COURTYARD_ROOM: DurableObjectNamespace<CourtyardRoom>;
  MEHFIL_ROOM: DurableObjectNamespace<MehfilRoom>;
  REALTIME_PUBLIC_KEY: string;
  ALLOWED_ORIGINS: string;
  /** Where to ask YouTube about videos; overridden only in tests. */
  OEMBED_BASE?: string;
}

interface Identity extends Connection {
  jti: string;
  exp: number;
}

function identityOf(request: Request): Identity | null {
  const header = request.headers.get('x-diwali-identity');
  if (!header) return null;
  try {
    return JSON.parse(header) as Identity;
  } catch {
    return null;
  }
}

function send(ws: WebSocket, message: ServerMessage) {
  try {
    ws.send(JSON.stringify(message));
  } catch {
    // The socket closed between broadcast and send; its close handler cleans up.
  }
}

function accept(
  ctx: DurableObjectState,
  identity: Identity,
  extra: Record<string, string> = {},
): { client: WebSocket; server: WebSocket } {
  const pair = new WebSocketPair();
  const [client, server] = [pair[0], pair[1]];
  ctx.acceptWebSocket(server);
  const connection: Connection = {
    member: identity.member,
    role: identity.role,
    name: identity.name,
    emblem: identity.emblem,
    ...extra,
  };
  server.serializeAttachment(connection);
  return { client, server };
}

const open = (sockets: WebSocket[], except?: WebSocket) =>
  sockets.filter((ws) => ws !== except && ws.readyState === WebSocket.OPEN);

function parseJson<T>(
  data: string | ArrayBuffer,
  schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } },
): T | null {
  if (typeof data !== 'string' || data.length > 4096) return null;
  try {
    const result = schema.safeParse(JSON.parse(data));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

const REVOKED_LIMIT = 1000;

/**
 * Members a room must refuse because they left or were removed from the
 * party (a revocation notice from the web app, relayed by PartyRoom). A
 * ticket is checked only when a socket opens, so without this a removed
 * guest's open sockets would keep working.
 */
class Revoked {
  private members = new Set<string>();
  private ctx: DurableObjectState;

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
  }

  async load() {
    this.members = new Set((await this.ctx.storage.get<string[]>('revoked')) ?? []);
  }

  has(member: string) {
    return this.members.has(member);
  }

  list() {
    return [...this.members];
  }

  /**
   * Records the members and closes every socket they have open here. The
   * explicit message comes first: a close the room starts doesn't always
   * complete its handshake, and the person should hear at once either way.
   */
  async add(members: Iterable<string>) {
    for (const member of members) this.members.add(member);
    while (this.members.size > REVOKED_LIMIT) {
      this.members.delete(this.members.values().next().value!);
    }
    await this.ctx.storage.put('revoked', [...this.members]);
    for (const ws of this.ctx.getWebSockets()) {
      const connection = ws.deserializeAttachment() as Connection;
      if (!this.members.has(connection.member)) continue;
      send(ws, { t: 'revoked' });
      ws.close(4003, 'no longer a member');
    }
  }
}

const revokedResponse = () => new Response('not a member', { status: 403 });

// ---------------------------------------------------------------------------
// PartyRoom: presence and the game directory for one party.
// ---------------------------------------------------------------------------

export class PartyRoom extends DurableObject<Env> {
  private games: GameSummary[] = [];
  private party = '';
  private guard = new ReplayGuard();
  private revoked: Revoked;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.revoked = new Revoked(ctx);
    ctx.blockConcurrencyWhile(async () => {
      this.games = (await ctx.storage.get<GameSummary[]>('games')) ?? [];
      this.party = (await ctx.storage.get<string>('party')) ?? '';
      await this.revoked.load();
    });
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/revoke' && request.method === 'POST') {
      return this.revoke(request);
    }
    if (url.pathname === '/connect') {
      const identity = identityOf(request);
      const party = url.searchParams.get('party');
      if (!identity || !party) return new Response('forbidden', { status: 403 });
      if (this.revoked.has(identity.member)) return revokedResponse();
      if (!this.guard.accept(identity.jti, identity.exp, Date.now())) {
        return new Response('ticket already used', { status: 403 });
      }
      if (!this.party) {
        this.party = party;
        await this.ctx.storage.put('party', party);
      }
      const { client, server } = accept(this.ctx, identity);
      send(server, { t: 'games', games: this.games });
      this.broadcastPresence();
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === '/game-status' && request.method === 'POST') {
      this.games = upsertGame(this.games, (await request.json()) as GameSummary);
      await this.ctx.storage.put('games', this.games);
      this.broadcast({ t: 'games', games: this.games });
      return new Response(null, { status: 204 });
    }
    return new Response('not found', { status: 404 });
  }

  /**
   * A member left or was removed: refuse them here, then in every game the
   * party has opened and in its courtyard.
   */
  private async revoke(request: Request): Promise<Response> {
    const { party, member } = (await request.json()) as { party: string; member: string };
    if (!this.party) {
      this.party = party;
      await this.ctx.storage.put('party', party);
    }
    if (this.party !== party) return new Response('wrong party', { status: 403 });
    await this.revoked.add([member]);
    this.broadcastPresence();
    const body = JSON.stringify({ member });
    const rooms = [
      ...this.games.map((g) =>
        this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(`${party}:${g.game}`)),
      ),
      this.env.COURTYARD_ROOM.get(this.env.COURTYARD_ROOM.idFromName(party)),
      this.env.MEHFIL_ROOM.get(this.env.MEHFIL_ROOM.idFromName(party)),
    ];
    const results = await Promise.allSettled(
      rooms.map((room) => room.fetch('https://room/revoke', { method: 'POST', body })),
    );
    const failed = results.filter((r) => r.status === 'rejected' || !r.value.ok).length;
    if (failed) {
      console.error(JSON.stringify({ level: 'error', event: 'realtime.revoke_partial', failed }));
      return new Response('some rooms did not confirm', { status: 502 });
    }
    return new Response(null, { status: 204 });
  }

  override async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const connection = ws.deserializeAttachment() as Connection;
    if (this.revoked.has(connection.member)) return ws.close(4003, 'no longer a member');
    const parsed = parseJson(data, partyClientMessageSchema);
    if (!parsed) return send(ws, { t: 'error', error: 'bad-message' });
    if (parsed.t === 'ping') return send(ws, { t: 'pong' });

    // Finished games don't count against the limit.
    if (this.games.filter((g) => g.status !== 'finished').length >= MAX_GAMES) {
      return send(ws, { t: 'result', id: parsed.id, ok: false, error: 'too-many-games' });
    }
    const game = newGameId();
    const stub = this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(`${this.party}:${game}`));
    const created = await stub.fetch('https://game/init', {
      method: 'POST',
      body: JSON.stringify({
        meta: {
          party: this.party,
          game,
          kind: parsed.kind,
          createdBy: connection.name,
          createdAt: Date.now(),
        },
        options: parsed.options ?? {},
        revoked: this.revoked.list(),
      }),
    });
    if (!created.ok)
      return send(ws, { t: 'result', id: parsed.id, ok: false, error: 'create-failed' });
    this.games = upsertGame(this.games, (await created.json()) as GameSummary);
    await this.ctx.storage.put('games', this.games);
    send(ws, { t: 'result', id: parsed.id, ok: true, data: { game, kind: parsed.kind } });
    this.broadcast({ t: 'games', games: this.games });
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    this.broadcastPresence(ws);
  }

  private broadcastPresence(closing?: WebSocket) {
    const sockets = open(this.ctx.getWebSockets(), closing);
    const members = presence(sockets.map((ws) => ws.deserializeAttachment() as Connection));
    for (const ws of sockets) send(ws, { t: 'presence', members });
  }

  private broadcast(message: ServerMessage) {
    for (const ws of open(this.ctx.getWebSockets())) send(ws, message);
  }
}

// ---------------------------------------------------------------------------
// GameRoom: one game of any kind, authoritative.
// ---------------------------------------------------------------------------

export class GameRoom extends DurableObject<Env> {
  private core: GameCore | null = null;
  private guard = new ReplayGuard();
  private revoked: Revoked;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.revoked = new Revoked(ctx);
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<SavedGame>('game');
      this.core = saved ? new GameCore(saved) : null;
      await this.revoked.load();
    });
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/init' && request.method === 'POST') {
      if (this.core) return new Response('exists', { status: 409 });
      const body = (await request.json()) as {
        meta: GameCore['meta'] & { kind: GameKind };
        options: GameOptions;
        revoked: string[];
      };
      this.core = GameCore.create(body.meta, body.options);
      await this.revoked.add(body.revoked);
      await this.persist();
      return Response.json(this.core.summary());
    }
    if (url.pathname === '/revoke' && request.method === 'POST') {
      const { member } = (await request.json()) as { member: string };
      await this.revoked.add([member]);
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/connect') {
      const identity = identityOf(request);
      const party = url.searchParams.get('party');
      if (!identity || !this.core || this.core.meta.party !== party) {
        return new Response('not found', { status: 404 });
      }
      if (this.revoked.has(identity.member)) return revokedResponse();
      if (!this.guard.accept(identity.jti, identity.exp, Date.now())) {
        return new Response('ticket already used', { status: 403 });
      }
      const { client, server } = accept(this.ctx, identity);
      this.core.greet(identity);
      await this.persist();
      send(server, this.core.viewMessage(identity));
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('not found', { status: 404 });
  }

  override async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    if (!this.core) return;
    const connection = ws.deserializeAttachment() as Connection;
    if (this.revoked.has(connection.member)) return ws.close(4003, 'no longer a member');
    const parsed = parseJson(data, gameClientMessageSchema);
    if (!parsed) return send(ws, { t: 'error', error: 'bad-message' });
    const { reply, changed } = this.core.handle(connection, parsed, Date.now(), cryptoRng);
    if (changed) await this.afterChange();
    send(ws, reply);
  }

  override async alarm(): Promise<void> {
    if (!this.core) return;
    if (this.core.tick(Date.now(), cryptoRng)) await this.afterChange();
    else await this.schedule();
  }

  private async afterChange() {
    await this.persist();
    for (const ws of open(this.ctx.getWebSockets())) {
      send(ws, this.core!.viewMessage(ws.deserializeAttachment() as Connection));
    }
    await this.schedule();
    const party = this.env.PARTY_ROOM.get(this.env.PARTY_ROOM.idFromName(this.core!.meta.party));
    await party.fetch('https://party/game-status', {
      method: 'POST',
      body: JSON.stringify(this.core!.summary()),
    });
  }

  private async schedule() {
    const deadline = this.core?.deadline();
    if (deadline) await this.ctx.storage.setAlarm(deadline);
    else await this.ctx.storage.deleteAlarm();
  }

  private async persist() {
    if (this.core) await this.ctx.storage.put('game', this.core.save());
  }
}

// ---------------------------------------------------------------------------
// CourtyardRoom: the party's one shared rangoli.
// ---------------------------------------------------------------------------

export class CourtyardRoom extends DurableObject<Env> {
  private core: CourtyardCore | null = null;
  private guard = new ReplayGuard();
  private revoked: Revoked;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.revoked = new Revoked(ctx);
    ctx.blockConcurrencyWhile(async () => {
      // One row per stroke, so drawing one doesn't rewrite the whole rangoli.
      ctx.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS strokes (id INTEGER PRIMARY KEY, body TEXT NOT NULL)',
      );
      await this.revoked.load();
      const saved = await ctx.storage.get<SavedCourtyard>('courtyard');
      if (saved) {
        const rows = ctx.storage.sql
          .exec<{ body: string }>('SELECT body FROM strokes ORDER BY id')
          .toArray();
        this.core = new CourtyardCore(
          saved,
          rows.map((row) => JSON.parse(row.body) as Stroke),
        );
      }
    });
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/revoke' && request.method === 'POST') {
      const { member } = (await request.json()) as { member: string };
      await this.revoked.add([member]);
      this.broadcastArtists();
      return new Response(null, { status: 204 });
    }
    if (url.pathname !== '/connect') return new Response('not found', { status: 404 });

    const identity = identityOf(request);
    const party = url.searchParams.get('party');
    if (!identity || !party || (this.core && this.core.party !== party)) {
      return new Response('not found', { status: 404 });
    }
    if (this.revoked.has(identity.member)) return revokedResponse();
    if (!this.guard.accept(identity.jti, identity.exp, Date.now())) {
      return new Response('ticket already used', { status: 403 });
    }
    // The Worker names this object after the party it verified, so the
    // first visitor's party is the courtyard's party.
    this.core ??= CourtyardCore.create(party);
    const { client, server } = accept(this.ctx, identity);
    this.core.greet(identity);
    await this.persist();
    for (const part of this.core.snapshot(identity)) send(server, part);
    this.broadcastArtists();
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    if (!this.core) return;
    const connection = ws.deserializeAttachment() as Connection;
    if (this.revoked.has(connection.member)) return ws.close(4003, 'no longer a member');
    const parsed = parseJson(data, courtyardClientMessageSchema);
    if (!parsed) return send(ws, { t: 'error', error: 'bad-message' });
    const { reply, broadcast, changes } = this.core.handle(connection, parsed, Date.now());
    if (broadcast) {
      this.store(changes);
      await this.persist();
      for (const socket of open(this.ctx.getWebSockets())) send(socket, broadcast);
    }
    send(ws, reply);
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    this.broadcastArtists(ws);
  }

  private broadcastArtists(closing?: WebSocket) {
    if (!this.core) return;
    const sockets = open(this.ctx.getWebSockets(), closing);
    const message = this.core.artists(
      sockets.map((ws) => ws.deserializeAttachment() as Connection),
    );
    for (const ws of sockets) send(ws, message);
  }

  private store(changes: StrokeChange[]) {
    const sql = this.ctx.storage.sql;
    this.ctx.storage.transactionSync(() => {
      for (const change of changes) {
        if ('insert' in change) {
          sql.exec(
            'INSERT INTO strokes (id, body) VALUES (?, ?)',
            change.insert.id,
            JSON.stringify(change.insert),
          );
        } else if ('remove' in change) {
          for (const id of change.remove) sql.exec('DELETE FROM strokes WHERE id = ?', id);
        } else {
          sql.exec('DELETE FROM strokes');
        }
      }
    });
  }

  private async persist() {
    if (this.core) await this.ctx.storage.put('courtyard', this.core.save());
  }
}

// ---------------------------------------------------------------------------
// MehfilRoom: the party's shared music queue.
// ---------------------------------------------------------------------------

export class MehfilRoom extends DurableObject<Env> {
  private core: MehfilCore | null = null;
  private guard = new ReplayGuard();
  private revoked: Revoked;
  private lookup: Lookup;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.revoked = new Revoked(ctx);
    this.lookup = youtubeLookup(env.OEMBED_BASE ?? 'https://www.youtube.com');
    ctx.blockConcurrencyWhile(async () => {
      await this.revoked.load();
      const saved = await ctx.storage.get<SavedMehfil>('mehfil');
      this.core = saved ? new MehfilCore(saved) : null;
    });
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/revoke' && request.method === 'POST') {
      const { member } = (await request.json()) as { member: string };
      await this.revoked.add([member]);
      if (this.core?.forget(member)) await this.persist();
      this.broadcast();
      return new Response(null, { status: 204 });
    }
    if (url.pathname !== '/connect') return new Response('not found', { status: 404 });

    const identity = identityOf(request);
    const party = url.searchParams.get('party');
    const device = url.searchParams.get('device');
    if (!identity || !party || !device || (this.core && this.core.party !== party)) {
      return new Response('not found', { status: 404 });
    }
    if (this.revoked.has(identity.member)) return revokedResponse();
    if (!this.guard.accept(identity.jti, identity.exp, Date.now())) {
      return new Response('ticket already used', { status: 403 });
    }
    // Named after the party the Worker verified, like the courtyard.
    this.core ??= MehfilCore.create(party);
    const { client } = accept(this.ctx, identity, { device });
    this.core.greet(identity);
    await this.persist();
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    if (!this.core) return;
    const connection = ws.deserializeAttachment() as MehfilConnection;
    if (this.revoked.has(connection.member)) return ws.close(4003, 'no longer a member');
    const parsed = parseJson(data, mehfilClientMessageSchema);
    if (!parsed) return send(ws, { t: 'error', error: 'bad-message' });
    const { reply, changed } = await this.core.handle(connection, parsed, this.lookup);
    if (changed) {
      await this.persist();
      this.broadcast();
    }
    send(ws, reply);
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    // The speaker may have just gone offline.
    this.broadcast(ws);
  }

  /** Everyone gets the same queue; each tab learns whether it is the speaker. */
  private broadcast(closing?: WebSocket) {
    if (!this.core) return;
    const sockets = open(this.ctx.getWebSockets(), closing);
    const connections = sockets.map((ws) => ws.deserializeAttachment() as MehfilConnection);
    sockets.forEach((ws, i) => send(ws, this.core!.view(connections[i]!, connections)));
  }

  private async persist() {
    if (this.core) await this.ctx.storage.put('mehfil', this.core.save());
  }
}
