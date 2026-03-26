import { test as baseTest, expect, Page, APIRequestContext } from '@playwright/test';

export async function waitForCondition(
  condition: () => Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 30000, interval = 1000 } = options;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}

export async function waitForContainerRunning(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 120000 } = options;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const runningVisible = await page.getByText('运行中').first().isVisible();
      const terminalVisible = await page.locator('[aria-label="Shell 终端"]').isVisible();
      if (runningVisible || terminalVisible) return;
    } catch { /* ignore */ }
    await page.waitForTimeout(500);
  }
  throw new Error(`Container not running within ${timeout}ms`);
}

export async function waitForAPI(
  request: APIRequestContext,
  url: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 60000 } = options;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await request.get(url);
      if (response.ok()) return;
    } catch { /* ignore */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`API ${url} not ready within ${timeout}ms`);
}

// ============================================
// 扩展 test 对象
// ============================================

// 扩展 test 对象，添加禁用引导的功能
export const test = baseTest.extend<{ page: Page }>({
  // 自动在每个测试前禁用引导模式
  page: async ({ page }, runFixture) => {
    // 在页面加载前设置 localStorage 禁用引导
    await page.addInitScript(() => {
      localStorage.setItem('TOUR_DISABLED_FOR_E2E', 'true');
    });
    
    await runFixture(page);
  },
});

export { expect };

