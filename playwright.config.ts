import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 配置文件
 * - 使用 make playwright 启动本地服务（端口 3006）
 * - 设置 baseURL，便于测试中使用 page.goto('/') 等相对路径
 * - 测试目录：tests/playwright
 */
export default defineConfig({
  testDir: 'tests/playwright',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3006',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'make playwright',
    url: 'http://localhost:3006',
    timeout: 180_000,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: [
        'tests/playwright/port-conflict.spec.ts',
        'tests/playwright/sql-terminal.spec.ts',
        'tests/playwright/course-list-status.spec.ts'
      ],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: [
        'tests/playwright/port-conflict.spec.ts',
        'tests/playwright/sql-terminal.spec.ts',
        'tests/playwright/course-list-status.spec.ts'
      ],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: [
        'tests/playwright/port-conflict.spec.ts',
        'tests/playwright/sql-terminal.spec.ts',
        'tests/playwright/course-list-status.spec.ts'
      ],
      use: { ...devices['Desktop Safari'] },
    },
    // 为端口冲突测试文件专门创建单独项目，并限制为 1 个 worker
    {
      name: 'port-conflict-serial',
      testMatch: ['tests/playwright/port-conflict.spec.ts'],
      workers: 1,
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'course-list-status',
      testMatch: ['tests/playwright/course-list-status.spec.ts'],
      workers: 1,
      fullyParallel: false,
      dependencies: ['chromium', 'firefox', 'webkit', 'port-conflict-serial'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'sql-terminal',
      testMatch: ['tests/playwright/sql-terminal.spec.ts'],
      workers: 1,
      fullyParallel: false,
      // 依赖所有其他项目，确保执行顺序与独占运行
      dependencies: ['chromium', 'firefox', 'webkit', 'port-conflict-serial', 'course-list-status'],
      // 为该项目单独设置更长的超时与重试策略
      timeout: 180_000,
      retries: 0,
      use: { ...devices['Desktop Chrome'] },
    },
    
  ],
});