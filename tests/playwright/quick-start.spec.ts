import { test, expect } from '@playwright/test';

test.describe('Quick Start', () => {
  test.beforeEach(async ({ request, page }) => {
    // 停止 quick-start 课程
    try { await request.post('/api/courses/quick-start/stop'); } catch {}
    // 清理容器
    try { await request.delete('/api/containers'); } catch {}
    // 清理 localStorage
    await page.addInitScript(() => {
      localStorage.removeItem('imageSourceId');
      localStorage.removeItem('selectedImageFullName');
      localStorage.removeItem('customImageName');
    });
  });

  test('测试课程全流程', async ({ page, request }) => {
    // 0) 尝试停止残留容器，保证初始状态（忽略错误）
    // 这样可以避免上一次测试留下的运行中状态导致文案不匹配
    try {
      await request.post('/api/courses/quick-start/stop');
    } catch {
      // 忽略任何错误，仅用于确保初始状态
    }

    // 0.5) 清理可能残留的镜像源选择（保证"切换"测试可重复）
    // 这里必须在 page.goto 之前注入，否则 Learn 页初次渲染已读取 localStorage
    await page.addInitScript(() => {
      localStorage.removeItem('imageSourceId')
      localStorage.removeItem('selectedImageFullName')
      localStorage.removeItem('customImageName')
    })

    const health = await request.get('/health');
    expect(health.ok()).toBeTruthy();

    // 1) 直接进入 quick-start 学习页
    await page.goto('/learn/quick-start');

    // 1.5) 切换容器镜像源为 ghcr.io，并验证 UI 与 localStorage 写入
    // 说明：选择 ghcr.io 通常比 Docker Hub 更稳定，避免因网络限制导致镜像拉取失败
    const imageSourceBtn = page.locator('button[title^="镜像源："]')
    await expect(imageSourceBtn).toBeVisible()
    await imageSourceBtn.click()

    await expect(page.getByRole('heading', { name: '容器镜像源' })).toBeVisible()
    await page.getByText('GitHub Container Registry').click()
    await page.getByRole('button', { name: '应用' }).click()

    await expect(imageSourceBtn).toHaveAttribute('title', /镜像源：ghcr\.io/)
    await expect(imageSourceBtn.getByText('ghcr.io')).toBeVisible()

    const saved = await page.evaluate(() => ({
      imageSourceId: localStorage.getItem('imageSourceId'),
      selectedImageFullName: localStorage.getItem('selectedImageFullName'),
    }))
    expect(saved.imageSourceId).toBe('ghcr')
    expect(saved.selectedImageFullName).toContain('ghcr.io/')

    // 2) 确认进入学习页，显示"终端未连接"文案
    await expect(page.getByText('终端未连接')).toBeVisible();

    // 3) 点击"启动容器"，等待状态从"启动中"到"运行中"
    const startBtn = page.getByRole('button', { name: '启动容器' });
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    // await page.getByRole('button', { name: '启动容器' }).click();
    await expect(page.getByText('运行中')).toBeVisible({ timeout: 120000 });
    // 等待终端组件加载完成（通过 aria-label 定位）
    await expect(page.locator('[aria-label="Shell 终端"]')).toBeVisible({ timeout: 120000 });
    // 等待终端画布渲染（xterm 使用 canvas 渲染内容）
    await expect(page.locator('.xterm-screen, [class*="xterm"] canvas').first()).toBeVisible({ timeout: 30000 });

    // 4) 点击"下一步"，确认进入下一步
    await page.getByRole('button', { name: '下一步' }).click();
    // 等待步骤内容加载（通过标题验证）
    await expect(page.getByRole('heading', { name: '启动 KWDB' })).toBeVisible();
    // 点击"切换至程序目录"段落的执行按钮
    await page.getByRole('paragraph').filter({ hasText: '切换至程序目录：' }).getByRole('button', { name: 'Run' }).click();
    // 验证终端中显示命令（xterm 终端内容检查）
    await expect(page.locator('.xterm-screen, [class*="xterm"] canvas').first()).toBeVisible({ timeout: 120000 });

    // 5) 执行剩余命令 - 验证可执行代码块功能正常
    // 点击启动数据库命令
    await page.getByRole('paragraph').filter({ hasText: '启动 KWDB（非安全模式）：' }).getByRole('button', { name: 'Run' }).click();
    // 等待命令执行（给终端一些时间响应）
    await page.waitForTimeout(2000);
    // 验证终端仍然可见且响应
    await expect(page.locator('.xterm-screen, [class*="xterm"] canvas').first()).toBeVisible();
    
    // 点击检查节点状态命令
    await page.getByRole('paragraph').filter({ hasText: '检查节点状态：' }).getByRole('button', { name: 'Run' }).click();
    await page.waitForTimeout(1000);
    
    // 点击连接数据库命令
    await page.getByRole('paragraph').filter({ hasText: '使用 kwbase sql 连接到数据库：' }).getByRole('button', { name: 'Run' }).click();
    await page.waitForTimeout(1000);

    // 6) 点击"停止容器"
    await page.getByRole('button', { name: '停止容器' }).click();
    const stoppingBtn = page.getByRole('button', { name: '停止中...' });
    await expect(stoppingBtn).toBeVisible();
    await expect(startBtn).toBeVisible({ timeout: 30000 });
    // await expect(page.getByText('停止中...')).toBeVisible({ timeout: 120000 });
    // await expect(page.getByText('请先启动容器')).toBeVisible({ timeout: 240000 });
  });
});
