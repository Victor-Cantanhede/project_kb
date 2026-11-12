import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? 'mysql://hero:hero@127.0.0.1:3307/hero_factory',
      DATABASE_URL_TEST:
        process.env.DATABASE_URL_TEST ??
        process.env.TEST_DATABASE_URL ??
        'mysql://hero:hero@127.0.0.1:3307/hero_factory_test',
    },
  },
});

