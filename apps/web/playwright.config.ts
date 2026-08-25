import { defineConfig } from '@playwright/test';

/**
 * 端到端测试：需要本地 Postgres（deploy/docker-compose.dev.yml）。
 * 若 3000/4000 已在运行（pnpm dev），直接复用；否则自动拉起。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @poker/server dev',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: true,
      cwd: '../..',
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @poker/web dev',
      url: 'http://localhost:3000/login',
      reuseExistingServer: true,
      cwd: '../..',
      timeout: 120_000,
    },
  ],
});
