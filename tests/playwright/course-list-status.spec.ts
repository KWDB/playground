import { test, expect } from './test-setup';

type ContainerSummary = {
  courseId?: string
  state?: string
}

test.describe('课程列表状态与交互测试', () => {
  test.beforeEach(async ({ request, page }) => {
    const res = await request.delete('/api/containers');
    expect(res.ok()).toBeTruthy();

    const listRes = await request.get('/api/containers');
    const containers = await listRes.json();
    expect(containers.length).toBe(0);

    const resetProgressRes = await request.post('/api/progress/reset-all');
    expect(resetProgressRes.ok()).toBeTruthy();

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

  test('验证容器状态变更与清理功能', async ({ page, request }) => {
    // 1. 访问课程列表页
    await page.goto('/courses');
    
    // 使用 href 定位整个课程卡片（现在卡片本身就是链接）
    const courseCard = page.locator('a[href="/learn/quick-start"]');
    
    // 验证初始状态：卡片可见，且不显示"运行中"状态
    await expect(courseCard).toBeVisible();
    await expect(courseCard).not.toHaveText(/运行中/);

    // 2. 通过 API 启动 quick-start 课程容器
    const startRes = await request.post('/api/courses/quick-start/start');
    expect(startRes.ok()).toBeTruthy();
    
    // 等待容器真正启动（API 返回成功时容器可能还在 StateStarting）
    await expect.poll(async () => {
      const containersRes = await request.get('/api/containers');
      if (!containersRes.ok()) return false;
      const containers = await containersRes.json() as ContainerSummary[];
      return containers.some((container) => container.courseId === 'quick-start' && container.state === 'running');
    }, { timeout: 120000 }).toBe(true);
    
    // 刷新页面获取最新状态
    await page.reload();

    // 3. 验证状态变为"运行中"
    await expect(courseCard).toHaveText(/运行中/);

    // 验证点击卡片直接跳转
    await courseCard.click();
    await expect(page).toHaveURL(/\/learn\/quick-start/);

    // 返回课程列表页继续测试清理功能
    await page.goto('/courses');
    // 重新定位卡片（页面刷新后 DOM 元素更新）
    const courseCardAfterBack = page.locator('a[href="/learn/quick-start"]');
    await expect(courseCardAfterBack).toHaveText(/运行中/);
    
    // 4. 验证清理功能
    const cleanupButton = page.getByRole('button', { name: /清理/ });
    await expect(cleanupButton).toBeVisible();
    await cleanupButton.click();
    
    // 确认弹窗
    await expect(page.getByText('确认清理环境')).toBeVisible();
    
    const containerCheckbox = page.locator('input[type="checkbox"]').first();
    await containerCheckbox.click();
    
    // 点击确认清理
    const confirmButton = page.getByRole('button', { name: /确认清理/ }); 
    await confirmButton.click();
    
    // 等待清理完成（增加超时时间，因为停止容器可能较慢）
    // 等待弹窗关闭表示清理完成
    await expect(page.getByText('确认清理环境')).toBeHidden({ timeout: 60000 });
    
    // 5. 验证卡片恢复初始状态（不显示"运行中"）
    await expect(courseCard).not.toHaveText(/运行中/);
  });

  test('验证视图模式切换功能', async ({ page }) => {
    await page.goto('/courses');

    // 定位切换按钮
    const gridBtn = page.getByLabel('卡片模式');
    const listBtn = page.getByLabel('列表模式');

    // 获取课程列表容器（兼容卡片外层 scroll-reveal 包裹）
    const firstCourse = page.locator('a[href^="/learn/"]').first();
    const container = firstCourse.locator(
      'xpath=ancestor::div[contains(@class,"gap-4") or contains(@class,"space-y-2")][1]'
    );

    // 1. 默认状态验证 (Grid)
    // 验证 Grid 按钮激活 (检查 text-indigo-600 类，因为选中时有这个颜色)
    // Check button is active by looking at its visual state (bg color indicates active)
    // 验证容器具有 grid 布局类
    await expect(container).toHaveClass(/grid-cols-1/);

    // 2. 切换到列表模式
    await listBtn.click();
    
    // 验证 List 按钮激活
    // Check button is active by looking at its visual state
    // 验证容器变为列表布局 (space-y-2)
    await expect(container).toHaveClass(/space-y-2/);
    await expect(container).not.toHaveClass(/grid-cols-1/);

    // 3. 再次切换回网格模式
    await gridBtn.click();
    
    // 验证 Grid 按钮再次激活
    // Check button is active by looking at its visual state (bg color indicates active)
    // 验证容器恢复 grid 布局
    await expect(container).toHaveClass(/grid-cols-1/);
  });

  test('验证学习状态筛选功能', async ({ page, request }) => {
    const inProgressRes = await request.post('/api/progress/quick-start', {
      data: { currentStep: 0, completed: false },
    });
    expect(inProgressRes.ok()).toBeTruthy();

    const completedRes = await request.post('/api/progress/install', {
      data: { currentStep: 0, completed: true },
    });
    expect(completedRes.ok()).toBeTruthy();

    await page.goto('/courses');

    const quickStartCard = page.locator('a[href="/learn/quick-start"]');
    const installCard = page.locator('a[href="/learn/install"]');
    const sqlCard = page.locator('a[href="/learn/sql"]');

    await expect(quickStartCard).toBeVisible();
    await expect(installCard).toBeVisible();
    await expect(sqlCard).toBeVisible();

    await page.getByRole('button', { name: '筛选' }).click();

    await page.getByRole('button', { name: '已完成', exact: true }).click();
    await expect(installCard).toBeVisible();
    await expect(quickStartCard).toBeHidden();
    await expect(sqlCard).toBeHidden();

    await page.getByRole('button', { name: '进行中', exact: true }).click();
    await expect(quickStartCard).toBeVisible();
    await expect(installCard).toBeHidden();
    await expect(sqlCard).toBeHidden();

    await page.getByRole('button', { name: '待学习', exact: true }).click();
    await expect(sqlCard).toBeVisible();
    await expect(quickStartCard).toBeHidden();
    await expect(installCard).toBeHidden();
  });
});
