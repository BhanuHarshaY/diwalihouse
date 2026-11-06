import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Sql } from './client.ts';

/** `supabase/migrations` at the repository root. */
export const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../../supabase/migrations', import.meta.url),
);

/** Arbitrary constant; serialises concurrent migrators against one database. */
const MIGRATION_LOCK_ID = 7_202_611;

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/**
 * Applies pending `*.sql` files in lexical order, each in its own
 * transaction, recording them in `diwali_meta.schema_migrations`.
 *
 * Files use the Supabase CLI naming scheme, so hosted environments can use
 * `supabase db push` instead. Pick one migrator per database: the two keep
 * separate history tables.
 */
export async function migrate(sql: Sql, dir: string = MIGRATIONS_DIR): Promise<MigrationResult> {
  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
  const result: MigrationResult = { applied: [], skipped: [] };

  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${MIGRATION_LOCK_ID})`;
    await tx`create schema if not exists diwali_meta`;
    await tx`
      create table if not exists diwali_meta.schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )`;

    const rows = await tx<{ version: string }[]>`select version from diwali_meta.schema_migrations`;
    const done = new Set(rows.map((row) => row.version));

    for (const file of files) {
      const version = path.basename(file, '.sql');
      if (done.has(version)) {
        result.skipped.push(version);
        continue;
      }
      const body = await readFile(path.join(dir, file), 'utf8');
      await tx.savepoint(async (sp) => {
        await sp.unsafe(body);
        await sp`insert into diwali_meta.schema_migrations (version) values (${version})`;
      });
      result.applied.push(version);
    }
  });

  return result;
}
