import { resetTestDatabase } from '@diwali/db/testing';
import { TEST_DATABASE_URL } from './env';

export default async function setup(): Promise<void> {
  await resetTestDatabase(TEST_DATABASE_URL);
}
