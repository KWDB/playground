import { test, expect } from './test-setup';
import type { APIRequestContext } from '@playwright/test';

type PortConflictResponse = {
  isConflicted?: boolean
}

test.describe('SQL 终端', () => {
  const findAvailablePort = async (request: APIRequestContext, courseId: string) => {
    for (let candidate = 31000; candidate < 31030; candidate++) {
      const response = await request.get(`/api/courses/${courseId}/check-port-conflict?port=${candidate}`)
      if (!response.ok()) {
        continue
      }
      const result = await response.json() as PortConflictResponse
      if (!result.isConflicted) {
        return candidate
      }
    }
    throw new Error('未找到可用端口用于 SQL E2E 测试')
  }

  test.beforeEach(async ({ request, page }) => {
    // 确保从干净状态开始
    try { await request.post('/api/courses/sql/stop'); } catch { /* ignore */ }
    await request.post('/api/progress/sql/reset');
    await page.addInitScript(() => {
      localStorage.setItem('hasSeenTour', JSON.stringify({
        state: {
          seenPages: { home: true, courses: true, learn: true },
          currentPage: null,
          currentStep: 0,
          isActive: false,
          hasHydrated: true,
        },
        version: 0,
      }));
    });
  });

  test('SQL 终端测试', async ({ page }) => {
  // 1) 直接进入首页
  await page.goto('/');
  await page.getByRole('link', { name: '开始学习' }).click();
  await page.locator('a[href="/learn/sql"]').click();
  console.log('✅ 首页点击了 SQL 课程链接');

  // 2) 确认进入学习页，显示“终端未连接”文案
  await expect(page.getByText('终端未连接')).toBeVisible({ timeout: 10000 });
  
  // 3) 点击“启动容器”
  await page.getByRole('button', { name: '启动容器' }).click();
  await expect(page.getByText('KWDB 版本')).toBeVisible({ timeout: 10000 });
  console.log('✅ 启动容器');

  // 4) 测试 Enter 执行
  await page.getByRole('textbox').fill('SELECT 1');
  await page.getByRole('textbox').press('Enter');
  await expect(page.getByRole('columnheader', { name: '?column?' })).toBeVisible({ timeout: 10000 });
  console.log('✅ Enter 执行');
  // 5) 测试清理按钮
  await page.getByRole('button', { name: '清除输入' }).click();
  await expect(page.getByText('已清除输入')).toBeVisible({ timeout: 10000 });
  console.log('✅ 清除输入');

  // 6) 点击“下一步”，执行第一页的命令
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('paragraph').filter({ hasText: '创建一个名为 sensor_data 的时序数据库：' }).getByRole('button').click();
  await expect(page.getByText('操作成功')).toBeVisible({ timeout: 10000 });
  await page.getByRole('paragraph').filter({ hasText: '创建一个名为 device_management' }).getByRole('button').click();
  await expect(page.getByText('操作成功')).toBeVisible({ timeout: 10000 });
  await page.locator('.markdown-code-block').filter({ hasText: '在时序数据库中创建传感器读数表' }).locator('button.exec-btn').click();
  await expect(page.getByText('操作成功')).toBeVisible({ timeout: 10000 });
  await page.locator('.markdown-code-block').filter({ hasText: '在关系数据库中创建设备信息表' }).locator('button.exec-btn').click();
  await expect(page.getByText('操作成功')).toBeVisible({ timeout: 10000 });
  console.log('✅ 执行第一页的命令');

  // 7) 点击“下一步”，执行第二页的命令
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByText('向关系表插入设备信息')).toBeVisible({ timeout: 10000 });
  await page.locator('.markdown-code-block').filter({ hasText: 'INSERT INTO device_management.devices' }).locator('button.exec-btn').click();
  await expect(page.getByText('影响 3 行数据')).toBeVisible({ timeout: 10000 });
  await page.locator('.markdown-code-block').filter({ hasText: 'INSERT INTO sensor_data.readings' }).locator('button.exec-btn').click();
  await expect(page.getByText('影响 8 行数据')).toBeVisible({ timeout: 10000 });
  await page.locator('.markdown-code-block').filter({ hasText: 'SELECT r.ts AS' }).locator('button.exec-btn').click();
  console.log('✅ 执行第二页的命令');

  // 操作页面右侧滚动条滚动到底部（滚动主文档）
  await page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    el.scrollTo(0, el.scrollHeight);
  });

  // 8) 查看最终结果，确认数据插入成功
  await expect(page.getByRole('columnheader', { name: 'timestamp' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('cell', { name: '25.8' })).toBeVisible({ timeout: 10000 });
  console.log('✅ 查看最终结果');

  // 9) 退出课程
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '退出课程' }).click();
  await page.getByRole('button', { name: '确定' }).click();
  await expect(page.getByRole('heading', { name: '课程列表' })).toBeVisible({ timeout: 10000 });
  console.log('✅ 退出课程');
  });

  test('重置进度功能', async ({ page }) => {
    // 1) 进入 SQL 课程
    await page.goto('/');
    await page.getByRole('link', { name: '开始学习' }).click();
    await page.locator('a[href="/learn/sql"]').click();
    console.log('✅ 进入 SQL 课程');

    // 2) 启动容器并进入第一步
    await expect(page.getByText('终端未连接')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: '启动容器' }).click();
    await expect(page.getByText('KWDB 版本')).toBeVisible({ timeout: 10000 });
    console.log('✅ 容器启动成功');

    // 3) 进入第一步
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByText('创建一个名为 sensor_data 的时序数据库：')).toBeVisible({ timeout: 10000 });
    console.log('✅ 进入第一步');

    // 4) 点击重置进度按钮
    await page.getByRole('button', { name: '重置进度' }).click();
    console.log('✅ 点击重置进度');

    // 5) 确认对话框
    await expect(page.getByText('确定要重置当前课程的学习进度吗？')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '确定重置' }).click();
    console.log('✅ 确认重置');

    await expect(page.getByRole('heading', { name: '课程介绍' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('容器: 运行中')).toBeVisible({ timeout: 5000 });
    console.log('✅ 已返回介绍页');
  });

  test('修改主机端口后 SQL 终端连接到新端口', async ({ page, request }) => {
    await page.goto('/')
    await page.getByRole('link', { name: '开始学习' }).click()
    await page.locator('a[href="/learn/sql"]').click()
    await expect(page.getByText('终端未连接')).toBeVisible({ timeout: 10000 })

    const selectedPort = await findAvailablePort(request, 'sql')
    const portSelector = page.locator('[data-tour-id="learn-host-port-selector"]')
    await expect(portSelector).toBeVisible({ timeout: 10000 })
    await portSelector.locator('input[type="number"]').fill(String(selectedPort))

    await page.getByRole('button', { name: '启动容器' }).click()
    await expect(page.getByText('KWDB 版本')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(`端口: ${selectedPort}`)).toBeVisible({ timeout: 10000 })

    const input = page.getByRole('textbox')
    await input.fill('SELECT 1')
    await input.press('Enter')
    await expect(page.getByRole('columnheader', { name: '?column?' })).toBeVisible({ timeout: 10000 })
  })
});
