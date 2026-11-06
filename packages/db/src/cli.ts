import { createSql } from './client.ts';
import { migrate } from './migrate.ts';

const [command] = process.argv.slice(2);

if (command !== 'migrate') {
  console.error('Usage: cli.ts migrate');
  process.exit(64);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    'DATABASE_URL is not set. Copy apps/web/.env.example to apps/web/.env.local, or export it.',
  );
  process.exit(78);
}

const sql = createSql({ url, max: 1 });
try {
  const { applied, skipped } = await migrate(sql);
  for (const version of skipped) console.log(`  already applied  ${version}`);
  for (const version of applied) console.log(`  applied          ${version}`);
  console.log(
    applied.length ? `Applied ${applied.length} migration(s).` : 'Database is up to date.',
  );
} finally {
  await sql.end();
}
