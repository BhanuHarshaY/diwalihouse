import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TEST_DATABASE_URL } from '@diwali/db/testing';

const rootEnv = fileURLToPath(new URL('../../.env.local', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export const TEST_DATABASE_URL = process.env.DATABASE_URL_TEST ?? DEFAULT_TEST_DATABASE_URL;
