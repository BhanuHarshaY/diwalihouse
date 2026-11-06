import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['./src/test/global-setup.ts'],
    // Integration tests share one database; each test creates its own parties.
    fileParallelism: false,
  },
});
