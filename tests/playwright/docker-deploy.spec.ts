import { test, expect } from '@playwright/test';

test.describe('Docker 部署验证', () => {
  test('健康检查 API 可访问', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.ok()).toBeTruthy();
  });

  test('课程列表 API 正常返回', async ({ request }) => {
    const res = await request.get('/api/courses');
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    const courses = body.courses;
    expect(Array.isArray(courses)).toBeTruthy();
    expect(courses.length).toBeGreaterThan(0);

    const ids = courses.map((c: { id: string }) => c.id);
    expect(ids).toContain('quick-start');
    expect(ids).toContain('sql');
  });

  test('课程列表页面正常渲染', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: '课程列表' })).toBeVisible();
    await expect(page.locator('a[href="/learn/quick-start"]')).toBeVisible();
    await expect(page.locator('a[href="/learn/sql"]')).toBeVisible();
  });

  test('Shell 课程启动与终端连接', async ({ page, request }) => {
    try {
      await request.post('/api/courses/quick-start/stop');
    } catch { /* ignore */ }

    await page.addInitScript(() => {
      localStorage.removeItem('imageSourceId');
      localStorage.removeItem('selectedImageFullName');
      localStorage.removeItem('customImageName');
    });

    await page.goto('/learn/quick-start');
    await expect(page.getByText('终端未连接')).toBeVisible();

    const startBtn = page.getByRole('button', { name: '启动容器' });
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    await expect(page.getByText('运行中')).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('[aria-label="Shell 终端"]')).toBeVisible({ timeout: 120_000 });
    await expect(
      page.locator('.xterm-screen, [class*="xterm"] canvas').first(),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: '停止容器' }).click();
    await expect(startBtn).toBeVisible({ timeout: 30_000 });
  });

  test('SQL 课程启动与查询执行', async ({ page, request }) => {
    try {
      await request.post('/api/courses/sql/stop');
    } catch { /* ignore */ }

    await page.addInitScript(() => {
      localStorage.removeItem('imageSourceId');
      localStorage.removeItem('selectedImageFullName');
      localStorage.removeItem('customImageName');
    });

    await page.goto('/learn/sql');
    await expect(page.getByText('终端未连接')).toBeVisible();

    await page.getByRole('button', { name: '启动容器' }).click();

    // 通过 API 轮询等待 KWDB 真正就绪，避免前端状态闪烁导致误判
    await expect(async () => {
      const res = await request.get('/api/sql/info?courseId=sql');
      const body = await res.json();
      expect(body.connected).toBe(true);
    }).toPass({ timeout: 240_000, intervals: [3000] });

    // KWDB 已就绪，刷新页面以获得干净的 UI 状态
    await page.reload();
    await expect(page.getByText('KWDB 版本')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('WS 已连接')).toBeVisible({ timeout: 30_000 });

    await page.locator('.cm-content').click();
    await page.keyboard.type('SELECT 1');
    // Enter 触发 onEnterExecute（直接读 CodeMirror 内部状态），比按钮更可靠
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await expect(
      page.getByText(/查询完成/),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: '停止容器' }).click();
    await expect(page.getByRole('button', { name: '启动容器' })).toBeVisible({ timeout: 30_000 });
  });

  test('带文件挂载的课程启动验证', async ({ request }) => {
    try {
      await request.post('/api/courses/smart-meter/stop');
    } catch { /* ignore */ }

    const startRes = await request.post('/api/courses/smart-meter/start');
    expect(startRes.ok()).toBeTruthy();

    const body = await startRes.json();
    expect(body.containerID || body.containerId).toBeTruthy();

    const stopRes = await request.post('/api/courses/smart-meter/stop');
    expect(stopRes.ok()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    const courses = ['quick-start', 'sql', 'smart-meter'];
    for (const id of courses) {
      try {
        await request.post(`/api/courses/${id}/stop`);
      } catch { /* ignore */ }
    }
  });
});
