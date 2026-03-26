import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/playwright',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3006',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'quick-start',
      testMatch: ['tests/playwright/quick-start.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'course-list-status',
      testMatch: ['tests/playwright/course-list-status.spec.ts'],
      dependencies: ['quick-start'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'sql-terminal',
      testMatch: ['tests/playwright/sql-terminal.spec.ts'],
      dependencies: ['course-list-status'],
      timeout: 180_000,
      retries: 2,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'port-conflict',
      testMatch: ['tests/playwright/port-conflict.spec.ts'],
      dependencies: ['sql-terminal'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'course-pause',
      testMatch: ['tests/playwright/course-pause.spec.ts'],
      dependencies: ['port-conflict'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'code-terminal',
      testMatch: ['tests/playwright/code-terminal.spec.ts'],
      dependencies: ['course-pause'],
      timeout: 180_000,
      retries: 2,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'onboarding',
      testMatch: ['tests/playwright/onboarding.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
