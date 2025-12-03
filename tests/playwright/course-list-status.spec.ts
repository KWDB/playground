import { test, expect } from '@playwright/test';

test.describe('课程列表状态与交互测试', () => {
  // 测试前清理所有容器，确保环境干净
  test.beforeEach(async ({ request }) => {
    const res = await request.delete('/api/containers');
    expect(res.ok()).toBeTruthy();
    
    // 再次确认容器已清空
    const listRes = await request.get('/api/containers');
    const containers = await listRes.json();
    expect(containers.length).toBe(0);
  });

  test('验证容器状态变更与清理功能', async ({ page, request }) => {
    // 1. 访问课程列表页
    await page.goto('/courses');
    
    // 使用 href 定位整个课程卡片（现在卡片本身就是链接）
    const courseCard = page.locator('a[href="/learn/quick-start"]');
    
    // 验证初始状态：卡片可见，且不显示“正在运行”状态
    await expect(courseCard).toBeVisible();
    await expect(courseCard).not.toHaveText(/正在运行/);

    // 2. 通过 API 启动 quick-start 课程容器
    const startRes = await request.post('/api/courses/quick-start/start');
    expect(startRes.ok()).toBeTruthy();
    
    // 刷新页面获取最新状态
    await page.reload();

    // 3. 验证状态变为“正在运行”
    await expect(courseCard).toHaveText(/正在运行/);

    // 验证点击卡片直接跳转
    await courseCard.click();
    await expect(page).toHaveURL(/\/learn\/quick-start/);

    // 返回课程列表页继续测试清理功能
    await page.goto('/courses');
    // 重新定位卡片（页面刷新后 DOM 元素更新）
    const courseCardAfterBack = page.locator('a[href="/learn/quick-start"]');
    await expect(courseCardAfterBack).toHaveText(/正在运行/);
    
    // 4. 验证清理功能
    const cleanupButton = page.getByRole('button', { name: /清理所有运行中容器/ });
    await expect(cleanupButton).toBeVisible();
    await cleanupButton.click();
    
    // 确认弹窗
    await expect(page.getByText('清理确认')).toBeVisible();
    
    // 点击确认清理
    const confirmButton = page.getByRole('button', { name: /确认/ }); 
    await confirmButton.click();
    
    // 等待清理完成（增加超时时间，因为停止容器可能较慢）
    await expect(page.getByText('清理完成')).toBeVisible({ timeout: 60000 });
    
    // 让我们先尝试等待弹窗消失
    await expect(page.getByText('清理确认')).toBeHidden({ timeout: 5000 });
    
    // 5. 验证卡片恢复初始状态（不显示“正在运行”）
    await expect(courseCard).not.toHaveText(/正在运行/);
  });
});
