import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['apps/nx-angular-mf-e2e/src/**/*.spec.ts'],
    reporters: ['default'],
    globalSetup: ['apps/nx-angular-mf-e2e/tools/global-setup.ts'],
    coverage: {
      enabled: true,
      reporter: ['json'],
      reportsDirectory: '../../coverage/json-api-server-e2e',
      provider: 'v8' as const,
    },
  },
});
