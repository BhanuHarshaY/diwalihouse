import type { GameSummary, PresenceMember } from '@diwali/realtime-protocol';
import type { Connection } from './game-core.ts';

/** Who is connected right now, one entry per member however many tabs they have. */
export function presence(connections: Connection[]): PresenceMember[] {
  const byMember = new Map<string, PresenceMember>();
  for (const c of connections) {
    const existing = byMember.get(c.member);
    if (existing) existing.connections += 1;
    else
      byMember.set(c.member, {
        member: c.member,
        name: c.name,
        emblem: c.emblem,
        role: c.role,
        connections: 1,
      });
  }
  return [...byMember.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const MAX_GAMES = 12;

/** Merge a game's latest status into the directory. */
export function upsertGame(games: GameSummary[], summary: GameSummary): GameSummary[] {
  const rest = games.filter((g) => g.game !== summary.game);
  return [...rest, summary].sort((a, b) => a.createdAt - b.createdAt);
}

/** Readable, unguessable-enough game ids (they are not credentials). */
export function newGameId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
}

/** Remembers ticket ids for their lifetime so a captured ticket can't be replayed. */
export class ReplayGuard {
  private seen = new Map<string, number>();

  accept(jti: string, exp: number, now: number): boolean {
    for (const [id, expiry] of this.seen) if (expiry <= now) this.seen.delete(id);
    if (this.seen.has(jti)) return false;
    this.seen.set(jti, exp);
    return true;
  }
}
