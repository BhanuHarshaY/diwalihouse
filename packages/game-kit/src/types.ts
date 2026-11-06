import type { Rng } from './rng.ts';

/**
 * The contract every game engine follows (docs/architecture.md § 6):
 *
 *   apply(state, action, actor, ctx) → { ok, state, events } | { ok: false, error }
 *
 * Pure: no I/O, no clock, no ambient randomness. A refused action leaves the
 * state untouched. Events are public; private information reaches a player
 * only through that engine's `viewFor`.
 */

export type Actor = { kind: 'player'; id: string; host: boolean } | { kind: 'system' };

export interface Context {
  now: number;
  rng: Rng;
}

export type Outcome<S, E, V extends string> =
  { ok: true; state: S; events: E[] } | { ok: false; error: V };

/** Runs a mutating reducer on a copy, so callers always get a fresh state or a refusal. */
export function applyWith<S, A, E, V extends string>(
  state: S,
  action: A,
  actor: Actor,
  ctx: Context,
  reduce: (draft: S, action: A, actor: Actor, ctx: Context, events: E[]) => V | null,
): Outcome<S, E, V> {
  const draft = structuredClone(state);
  const events: E[] = [];
  const error = reduce(draft, action, actor, ctx, events);
  return error ? { ok: false, error } : { ok: true, state: draft, events };
}
