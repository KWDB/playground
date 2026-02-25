import { test, expect } from '@playwright/test';

test.describe('Quick Start', () => {
  test.beforeEach(async ({ request, page }) => {
    try { await request.post('/api/courses/quick-start/stop'); } catch (error) { void error; }
    try { await request.delete('/api/containers'); } catch (error) { void error; }
    try { await request.post('/api/progress/quick-start/reset'); } catch (error) { void error; }
    await page.addInitScript(() => {
      localStorage.removeItem('imageSourceId');
      localStorage.removeItem('selectedImageFullName');
      localStorage.removeItem('customImageName');
      localStorage.removeItem('hasSeenTour');
    });
  });

  test('测试课程全流程', async ({ page, request }) => {
    try { await request.post('/api/courses/quick-start/stop'); } catch (error) { void error; }

    await page.addInitScript(() => {
      localStorage.removeItem('imageSourceId')
      localStorage.removeItem('selectedImageFullName')
      localStorage.removeItem('customImageName')
    })

    const health = await request.get('/health');
    expect(health.ok()).toBeTruthy();

    await page.goto('/learn/quick-start');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const tourTooltip = page.locator('[data-testid="tour-tooltip"]');
    if (await tourTooltip.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(tourTooltip).not.toBeVisible({ timeout: 3000 });
    }
    await page.waitForTimeout(1000);

    const imageSourceBtn = page.locator('button[title^="镜像源："]')
    await expect(imageSourceBtn).toBeVisible()
    await imageSourceBtn.click({ force: true })

    await expect(page.getByRole('heading', { name: '容器镜像源' })).toBeVisible()
    await page.getByText('GitHub Container Registry').click()
    await page.getByRole('button', { name: '应用' }).click()

    await expect(imageSourceBtn).toHaveAttribute('title', /镜像源：ghcr\.io/)
    await expect(imageSourceBtn.getByText('ghcr.io')).toBeVisible()

    const startBtn = page.getByRole('button', { name: '启动容器' });
    await expect(startBtn).toBeVisible();
    await startBtn.click({ force: true });

    await expect(page.getByText('运行中')).toBeVisible({ timeout: 120000 });
    await expect(page.locator('[aria-label="Shell 终端"]')).toBeVisible({ timeout: 120000 });
    console.log('✅ 容器已启动');

    const nextStepBtn = page.getByRole('button', { name: '下一步' });
    await expect(nextStepBtn).toBeVisible();
    await nextStepBtn.click();
    console.log('✅ 进入第一步');

    const prevStepBtn = page.getByRole('button', { name: '上一步' });
    await expect(prevStepBtn).toBeVisible();
    await prevStepBtn.click();
    console.log('✅ 返回上一步');

    const exitBtn = page.getByRole('button', { name: '返回' });
    await expect(exitBtn).toBeVisible();
    await exitBtn.click();
    console.log('✅ 返回课程列表');

    await expect(page.locator('h1')).toContainText('课程列表');
  });

  test('进度恢复功能', async ({ page, request }) => {
    try { await request.post('/api/courses/quick-start/stop'); } catch (error) { void error; }
    
    await page.addInitScript(() => {
      localStorage.removeItem('imageSourceId')
      localStorage.removeItem('selectedImageFullName')
      localStorage.removeItem('customImageName')
    })

    const health = await request.get('/health');
    expect(health.ok()).toBeTruthy();

    await page.goto('/learn/quick-start');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const tourTooltip = page.locator('[data-testid="tour-tooltip"]');
    if (await tourTooltip.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(tourTooltip).not.toBeVisible({ timeout: 3000 });
    }
    await page.waitForTimeout(1000);

    console.log('✅ 进入课程页');

    const startBtn = page.getByRole('button', { name: '启动容器' });
    await expect(startBtn).toBeVisible();
    await startBtn.click({ force: true });

    await expect(page.getByText('运行中')).toBeVisible({ timeout: 120000 });
    await expect(page.locator('[aria-label="Shell 终端"]')).toBeVisible({ timeout: 120000 });
    console.log('✅ 容器已启动');

    const nextStepBtn = page.getByRole('button', { name: '下一步' });
    await expect(nextStepBtn).toBeVisible();
    await nextStepBtn.click();
    console.log('✅ 进入第一步');

    const exitBtn = page.getByRole('button', { name: '返回' });
    await expect(exitBtn).toBeVisible();
    await exitBtn.click();

    await expect(page.locator('h1')).toContainText('课程列表');
    console.log('✅ 返回课程列表');

    const courseListTourTooltip = page.locator('[data-testid="tour-tooltip"]');
    if (await courseListTourTooltip.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(courseListTourTooltip).not.toBeVisible({ timeout: 3000 });
    }

    await page.locator('a[href="/learn/quick-start"]').click();
    console.log('✅ 再次进入课程');

    await expect(page.getByText('运行中')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[aria-label="Shell 终端"]')).toBeVisible({ timeout: 5000 });
  });
});
