import { defineConfig, devices } from '@playwright/test';

/**
 * Docker 部署专用 Playwright 配置
 * - 不启动 webServer（需先通过 docker compose -f docker/playground/docker-compose.yml up -d 启动服务）
 * - 直接连接 docker compose 暴露的端口（默认 3006）
 * - 独立于本地开发测试，可单独运行：npx playwright test --config=playwright.docker.config.ts
 */
export default defineConfig({
  testDir: 'tests/playwright',
  testMatch: ['tests/playwright/docker-deploy.spec.ts'],
  timeout: 180_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${process.env.SERVER_PORT ?? '3006'}`,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'docker-deploy',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
