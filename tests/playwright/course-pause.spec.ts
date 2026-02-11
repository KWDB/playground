import { test, expect } from '@playwright/test';

test.describe('课程暂停与恢复功能', () => {
  // 每个测试前清理状态
  test.beforeEach(async ({ request, page }) => {
    // 1. 停止并删除 quick-start 容器，确保从干净状态开始
    try {
      await request.post('/api/courses/quick-start/stop');
      await request.delete('/api/containers');
    } catch {
      // 忽略清理错误
    }

    // 2. 清理 localStorage，使用默认镜像源
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('测试课程暂停与恢复流程', async ({ page }) => {
    // 1. 进入课程页面
    await page.goto('/learn/quick-start');

    // 2. 切换到 GHCR 镜像源（更稳定）
    const imageSourceBtn = page.locator('button[title^="镜像源："]');
    await expect(imageSourceBtn).toBeVisible();
    await imageSourceBtn.click();
    await page.getByText('GitHub Container Registry').click();
    await page.getByRole('button', { name: '应用' }).click();

    // 3. 启动容器
    const startBtn = page.getByRole('button', { name: '启动容器' });
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    
    // 等待容器启动完成
    await expect(page.getByText('运行中')).toBeVisible({ timeout: 120000 });
    
    // 4. 执行一些操作以产生状态（可选）
    // 这里我们直接测试暂停功能
    
    // 5. 点击暂停容器
    const pauseBtn = page.getByRole('button', { name: '暂停容器' });
    await expect(pauseBtn).toBeVisible();
    await pauseBtn.click();
    
    // 验证状态变为暂停
    await expect(page.getByText('恢复容器')).toBeVisible();
    
    // 验证状态指示器显示"已暂停"
    await expect(page.getByText('已暂停')).toBeVisible(); 
    
    // 6. 返回课程列表页，验证卡片状态
    const backBtn = page.locator('button[title="返回课程列表"]');
    await backBtn.click();
    
    // 验证回到了列表页
    await expect(page).toHaveURL(/\/courses$/);
    
    // 验证课程卡片显示“已暂停”状态
    // 在列表模式下
    const courseCard = page.locator('a[href="/learn/quick-start"]');
    await expect(courseCard).toBeVisible();
    // 检查是否有暂停标识 (根据之前的代码修改，会有 "已暂停" 的文本)
    await expect(courseCard.getByText('已暂停')).toBeVisible();
    
    // 7. 再次进入课程
    await courseCard.click();
    await expect(page).toHaveURL(/\/learn\/quick-start$/);
    
    // 8. 验证页面显示恢复按钮
    const resumeBtn = page.getByRole('button', { name: '恢复容器' });
    await expect(resumeBtn).toBeVisible();
    
    // 9. 点击恢复容器
    await resumeBtn.click();
    
    // 10. 验证状态变回运行中
    await expect(page.getByText('运行中')).toBeVisible({ timeout: 30000 });
    await expect(pauseBtn).toBeVisible();
    
    // 11. 最后停止容器清理环境
    const stopBtn = page.getByRole('button', { name: '停止容器' });
    await stopBtn.click();
    await expect(startBtn).toBeVisible({ timeout: 30000 });
  });
});
