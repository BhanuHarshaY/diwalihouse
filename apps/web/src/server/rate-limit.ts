import type { Sql } from '@diwali/db';

export interface RateLimitRule {
  /** Namespaced bucket key, e.g. `join:<peppered client key>`. */
  key: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter in Postgres. Good enough for abuse resistance on
 * invite lookups and party creation at our scale; it costs one upsert per
 * guarded request. Swap for a dedicated store if it ever shows up in traces.
 */
export async function consumeRateLimit(sql: Sql, rule: RateLimitRule): Promise<RateLimitResult> {
  const window = rule.windowSeconds;
  const [row] = await sql<{ hits: number; reset_in: number }[]>`
    insert into diwali.rate_limit_buckets as b (key, window_start, hits)
    values (
      ${rule.key},
      to_timestamp(floor(extract(epoch from now()) / ${window}::int) * ${window}::int),
      1
    )
    on conflict (key, window_start) do update set hits = b.hits + 1
    returning
      hits,
      ceil(extract(epoch from (window_start + make_interval(secs => ${window}::int) - now())))::int
        as reset_in`;

  if (Math.random() < 0.01) {
    sql`delete from diwali.rate_limit_buckets where window_start < now() - interval '1 day'`.catch(
      () => {},
    );
  }

  return {
    allowed: (row?.hits ?? 0) <= rule.limit,
    retryAfterSeconds: Math.max(1, row?.reset_in ?? window),
  };
}

/** Whether `rule` is already exhausted in the current window, without counting a hit. */
export async function isRateLimited(sql: Sql, rule: RateLimitRule): Promise<boolean> {
  const window = rule.windowSeconds;
  const [row] = await sql<{ hits: number }[]>`
    select hits from diwali.rate_limit_buckets
    where key = ${rule.key}
      and window_start = to_timestamp(floor(extract(epoch from now()) / ${window}::int) * ${window}::int)`;
  return (row?.hits ?? 0) >= rule.limit;
}
