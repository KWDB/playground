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
    // 1. Quick Start - 基础流程测试
    {
      name: 'quick-start',
      testMatch: ['tests/playwright/quick-start.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    // 2. Course List Status - 课程列表状态测试
    {
      name: 'course-list-status',
      testMatch: ['tests/playwright/course-list-status.spec.ts'],
      workers: 1,
      fullyParallel: false,
      dependencies: ['quick-start'],
      use: { ...devices['Desktop Chrome'] },
    },
    // 3. SQL Terminal - SQL 终端测试
    {
      name: 'sql-terminal',
      testMatch: ['tests/playwright/sql-terminal.spec.ts'],
      workers: 1,
      fullyParallel: false,
      dependencies: ['course-list-status'],
      // 为该项目单独设置更长的超时与重试策略
      timeout: 180_000,
      retries: 0,
      use: { ...devices['Desktop Chrome'] },
    },
    // 4. Port Conflict - 端口冲突测试
    {
      name: 'port-conflict-serial',
      testMatch: ['tests/playwright/port-conflict.spec.ts'],
      workers: 1,
      fullyParallel: false,
      dependencies: ['sql-terminal'],
      use: { ...devices['Desktop Chrome'] },
    },
    // 5. Course Pause - 课程暂停功能测试
    {
      name: 'course-pause',
      testMatch: ['tests/playwright/course-pause.spec.ts'],
      workers: 1,
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
