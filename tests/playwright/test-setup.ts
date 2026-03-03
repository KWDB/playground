import { test as baseTest, expect, Page } from '@playwright/test';

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
