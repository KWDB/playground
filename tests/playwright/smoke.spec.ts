import { test, expect } from '@playwright/test';

/**
 * 冒烟测试：验证应用健康与基础路由
 */

// 健康检查 API
test('健康检查 API 返回 200 且包含预期字段', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data).toEqual(expect.objectContaining({ status: 'ok' }));
});

// 首页可访问
test('首页加载并展示核心文案', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('本地离线交互式课程学习平台')).toBeVisible();
  await expect(page.getByRole('link', { name: '课程列表' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '环境检测' })).toBeVisible();
  await expect(page.locator('div').filter({ hasText: /^3\/3$/ }).locator('svg')).toBeVisible();
});
