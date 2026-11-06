import { resetTestDatabase } from '@diwali/db/testing';
import { E2E_DATABASE_URL } from '../playwright.config';

export default async function globalSetup(): Promise<void> {
  await resetTestDatabase(E2E_DATABASE_URL);
}
