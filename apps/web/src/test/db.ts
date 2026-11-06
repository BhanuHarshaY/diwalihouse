import { createSql, type Sql } from '@diwali/db';
import { afterAll } from 'vitest';
import { TEST_DATABASE_URL } from './env';

/** One pool per test file, closed when the file finishes. */
export function connectTestSql(): Sql {
  const sql = createSql({ url: TEST_DATABASE_URL, max: 12 });
  afterAll(() => sql.end());
  return sql;
}
