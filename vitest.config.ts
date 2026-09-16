import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'shared',
          root: './shared',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: './app/vite.config.ts',
        test: {
          name: 'app',
          root: './app',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        test: {
          name: 'server',
          root: './server',
          include: ['test/**/*.test.ts'],
          environment: 'node',
          // Test files share one database, so they run one at a time.
          fileParallelism: false,
          globalSetup: ['./test/global-setup.ts'],
        },
      },
    ],
  },
});
