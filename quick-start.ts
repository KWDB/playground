import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:3006/');
  await expect(page.getByRole('heading', { name: '环境检测' })).toBeVisible();
});