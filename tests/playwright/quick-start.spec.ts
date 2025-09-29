import { test, expect } from '@playwright/test';

test.describe('Quick Start', () => {
  test('测试课程全流程', async ({ page, request }) => {
    // 0) 尝试停止残留容器，保证初始状态（忽略错误）
    // 这样可以避免上一次测试留下的运行中状态导致文案不匹配
    try {
      await request.post('/api/courses/quick-start/stop');
    } catch {
      // 忽略任何错误，仅用于确保初始状态
    }

    const health = await request.get('/health');
    expect(health.ok()).toBeTruthy();

    // 1) 直接进入 quick-start 学习页
    await page.goto('/learn/quick-start');

    // 2) 确认进入学习页，显示“请先启动容器”文案
    await expect(page.getByText('请先启动容器')).toBeVisible();

    // 3) 点击“启动容器”，等待状态从“启动中”到“运行中”
    await page.getByRole('button', { name: '启动容器' }).click();
    await expect(page.getByText('运行中')).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(':/kaiwudb/')).toBeVisible({ timeout: 120_000 });

    // 4) 点击“下一步”，确认进入下一步
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByRole('paragraph').filter({ hasText: '切换至程序目录： cd /kaiwudb/binRun' }).getByRole('button').click();
    await expect(page.locator('span').filter({ hasText: 'cd /kaiwudb/bin' })).toBeVisible({ timeout: 120_000 });

    // 5) 点击 Run
    await page.getByRole('paragraph').filter({ hasText: '启动 KWDB（非安全模式）：./kwbase start' }).getByRole('button').click();
    await expect(page.getByText('increase the replication')).toBeVisible({ timeout: 120_000 });
    await page.getByRole('paragraph').filter({ hasText: '使用 kwbase sql 连接到数据库：./kwbase' }).getByRole('button').click();
    await expect(page.getByText('root@127.0.0.1:26257/')).toBeVisible({ timeout: 120_000 });

    // 6) 点击“停止容器”
    await page.getByRole('button', { name: '停止容器' }).click();
    await expect(page.getByText('请先启动容器')).toBeVisible({ timeout: 60_000 });
  });
});