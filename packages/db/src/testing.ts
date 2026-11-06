import postgres from 'postgres';
import { createSql } from './client.ts';
import { migrate } from './migrate.ts';

export const DEFAULT_TEST_DATABASE_URL = 'postgres://localhost:5432/diwali_house_test';

/**
 * Drops and recreates the database named in `url`, then applies every
 * migration. Intended for test global setup only.
 */
export async function resetTestDatabase(url: string = DEFAULT_TEST_DATABASE_URL): Promise<void> {
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  if (!/test/i.test(name)) {
    throw new Error(`Refusing to reset "${name}": test database names must contain "test".`);
  }

  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';
  const admin = postgres(maintenance.toString(), { max: 1, onnotice: () => {} });
  try {
    await admin`drop database if exists ${admin(name)} with (force)`;
    await admin`create database ${admin(name)}`;
  } finally {
    await admin.end();
  }

  const sql = createSql({ url, max: 1 });
  try {
    await migrate(sql);
  } finally {
    await sql.end();
  }
}
