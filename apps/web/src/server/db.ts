import 'server-only';
import { createSql, type Sql } from '@diwali/db';
import { serverEnv } from './env';

const globalForDb = globalThis as typeof globalThis & { __diwaliSql?: Sql };

/** Process-wide connection pool (survives dev hot reloads). */
export function db(): Sql {
  if (!globalForDb.__diwaliSql) {
    const env = serverEnv();
    globalForDb.__diwaliSql = createSql({
      url: env.DATABASE_URL,
      pooled: env.DATABASE_POOLED,
      // Behind a transaction pooler each serverless instance needs very few.
      max: env.DATABASE_POOLED ? 3 : 10,
    });
  }
  return globalForDb.__diwaliSql;
}
