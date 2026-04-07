import { test, expect } from './test-setup';

type ContainerSummary = {
  courseId?: string
  state?: string
}

test.describe('代码终端', () => {
  test.beforeEach(async ({ request, page }) => {
    // 确保从干净状态开始
    try { await request.post('/api/courses/python-kwdb/stop'); } catch { /* ignore */ }
    // 等待容器真正停止
    await expect.poll(async () => {
      const res = await request.get('/api/containers');
      if (!res.ok()) return true;
      const containers = await res.json() as ContainerSummary[];
      return !containers.some((container) => container.courseId === 'python-kwdb');
    }, { timeout: 60000 }).toBe(true);
    await request.post('/api/progress/python-kwdb/reset');
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

  test('代码终端完整流程测试', async ({ page }) => {
    // 1) 进入首页，导航到 python-kwdb 课程
    await page.goto('/');
    await page.getByRole('link', { name: '开始学习' }).click();
    await page.locator('a[href="/learn/python-kwdb"]').click();
    console.log('✅ 进入 Python KWDB 课程');

    const terminalPanel = page.locator('[data-tour-id="learn-terminal"]');
    const codeOutputPanel = page.locator('[data-tour-id="learn-code-output"]');

    // 2) 确认进入学习页，代码终端显示“终端未连接”
    await expect(terminalPanel.getByText('终端未连接')).toBeVisible({ timeout: 10000 });

    // 3) 点击"启动容器"
    await page.getByRole('button', { name: '启动容器' }).click();
    // 等待容器运行中 + 代码终端连接成功
    await expect(terminalPanel.getByText('已连接', { exact: true })).toBeVisible({ timeout: 120000 });
    console.log('✅ 容器启动，代码终端已连接');

    // 4) 进入 Step1：连接数据库
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByText('pip install psycopg2-binary')).toBeVisible({ timeout: 10000 });
    console.log('✅ 进入 Step1');

    // 5) 执行 bash 代码块：安装依赖
    await page.locator('.markdown-code-block').filter({ hasText: 'pip install psycopg2-binary' }).locator('button.exec-btn').click();
    // 等待执行完成（退出码出现说明执行结束）
    await expect(codeOutputPanel.getByText('退出码:')).toBeVisible({ timeout: 30000 });
    console.log('✅ 安装 psycopg2-binary');

    // 6) 执行 python 代码块：连接测试
    await page.locator('.markdown-code-block').filter({ hasText: 'import psycopg2' }).first().locator('button.exec-btn').click();
    await expect(codeOutputPanel.getByText('连接测试结果')).toBeVisible({ timeout: 30000 });
    console.log('✅ 连接数据库成功');

    // 7) 进入 Step2：创建数据库和表
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByText('创建自己的数据库和表')).toBeVisible({ timeout: 10000 });
    console.log('✅ 进入 Step2');

    // 8) 执行创建数据库
    await page.locator('.markdown-code-block').filter({ hasText: 'CREATE DATABASE shop' }).locator('button.exec-btn').click();
    await expect(codeOutputPanel.getByText('数据库创建成功')).toBeVisible({ timeout: 30000 });
    console.log('✅ 创建数据库');

    // 9) 执行创建表
    await page.locator('.markdown-code-block').filter({ hasText: 'CREATE TABLE products' }).locator('button.exec-btn').click();
    await expect(codeOutputPanel.getByText('表创建成功')).toBeVisible({ timeout: 30000 });
    console.log('✅ 创建商品表');

    // 10) 执行创建时序表
    await page.locator('.markdown-code-block').filter({ hasText: 'CREATE TABLE sensor_data' }).locator('button.exec-btn').click();
    await expect(codeOutputPanel.getByText('时序表创建成功')).toBeVisible({ timeout: 30000 });
    console.log('✅ 创建时序表');

    // 11) 进入 Step3：插入和查询数据
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByText('向表中插入数据并查询')).toBeVisible({ timeout: 10000 });
    console.log('✅ 进入 Step3');

    // 12) 执行插入数据
    await page.locator('.markdown-code-block').filter({ hasText: 'INSERT INTO products' }).locator('button.exec-btn').click();
    await expect(codeOutputPanel.getByText('成功插入 4 条记录')).toBeVisible({ timeout: 30000 });
    console.log('✅ 插入商品数据');

    // 13) 执行查询数据
    await page.locator('.markdown-code-block').filter({ hasText: 'SELECT id, name, price, stock FROM products' }).locator('button.exec-btn').click();
    await expect(codeOutputPanel.getByText('商品列表')).toBeVisible({ timeout: 30000 });
    console.log('✅ 查询商品数据');

    // 14) 执行插入时序数据
    await page.locator('.markdown-code-block').filter({ hasText: 'INSERT INTO sensor_data' }).locator('button.exec-btn').click();
    await expect(codeOutputPanel.getByText('传感器数据插入成功')).toBeVisible({ timeout: 30000 });
    console.log('✅ 插入时序数据');

    // 15) 进入完成页 → 退出课程
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByText('恭喜你已完成')).toBeVisible({ timeout: 10000 });
    console.log('✅ 进入完成页');

    await page.getByRole('button', { name: '退出课程' }).click();
    await page.getByRole('button', { name: '确定' }).click();
    await expect(page.getByRole('heading', { name: '课程列表' })).toBeVisible({ timeout: 10000 });
    console.log('✅ 退出课程');
  });

  test('启动过程中停止容器不会残留活动容器', async ({ page, request }) => {
    await page.goto('/learn/python-kwdb');
    await expect(page.getByRole('button', { name: '启动容器' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: '启动容器' }).click();

    const stopResponse = await request.post('/api/courses/python-kwdb/stop');
    expect([200, 404]).toContain(stopResponse.status());

    const activeStates = new Set(['creating', 'starting', 'running', 'paused']);
    let leftovers: Array<{ courseId?: string; state?: string }> = [];
    for (let i = 0; i < 6; i += 1) {
      const cleanupResponse = await request.post('/api/courses/python-kwdb/cleanup-containers');
      expect(cleanupResponse.ok()).toBeTruthy();

      await page.waitForTimeout(1500);
      const response = await request.get('/api/containers');
      expect(response.ok()).toBeTruthy();
      const containers = await response.json() as Array<{ courseId?: string; state?: string }>;
      leftovers = containers.filter((container) => (
        container.courseId === 'python-kwdb' && activeStates.has(container.state ?? '')
      ));
      if (leftovers.length === 0) {
        break;
      }
    }

    expect(leftovers.length).toBe(0);
  });

  test('重置进度功能', async ({ page }) => {
    // 1) 进入 python-kwdb 课程
    await page.goto('/');
    await page.getByRole('link', { name: '开始学习' }).click();
    await page.locator('a[href="/learn/python-kwdb"]').click();
    console.log('✅ 进入 Python KWDB 课程');

    const terminalPanel = page.locator('[data-tour-id="learn-terminal"]');

    // 2) 启动容器
    await expect(terminalPanel.getByText('终端未连接')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: '启动容器' }).click();
    await expect(terminalPanel.getByText('已连接', { exact: true })).toBeVisible({ timeout: 120000 });
    console.log('✅ 容器启动成功');

    // 3) 进入第一步
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByText('pip install psycopg2-binary')).toBeVisible({ timeout: 10000 });
    console.log('✅ 进入第一步');

    // 4) 点击重置进度按钮
    await page.getByRole('button', { name: '重置进度' }).click();
    console.log('✅ 点击重置进度');

    // 5) 确认对话框
    await expect(page.getByText('确定要重置当前课程的学习进度吗？')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '确定重置' }).click();
    console.log('✅ 确认重置');

    // 6) 验证回到介绍页
    await expect(page.getByRole('heading', { name: '课程介绍' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('容器: 运行中')).toBeVisible({ timeout: 5000 });
    console.log('✅ 已返回介绍页');
  });
});
