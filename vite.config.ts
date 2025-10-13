import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.DATASHAPE_BASE ?? '/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
