import { test, expect } from './test-setup';

test.describe('Onboarding Tour', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('tourStorageCleared')) {
        localStorage.removeItem('hasSeenTour');
        sessionStorage.setItem('tourStorageCleared', 'true');
      }
    });
    // Enable tours for onboarding tests
    await page.addInitScript(() => {
      localStorage.removeItem('TOUR_DISABLED_FOR_E2E');
    });
  });

  test('首次访问引导自动触发', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="tour-tooltip"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="tour-tooltip"]')).toContainText('开始学习');
  });

  test('引导完成流程', async ({ page }) => {
    await page.goto('/');
    const tooltip = page.locator('[data-testid="tour-tooltip"]');
    await expect(tooltip).toBeVisible({ timeout: 5000 });

    const nextButton = page.locator('[data-testid="tour-next-btn"]');
    let stepCount = 0;
    const maxSteps = 10;

    while (stepCount < maxSteps) {
      stepCount++;
      const finishButton = page.locator('[data-testid="tour-finish-btn"]');
      const isLastStep = await finishButton.isVisible().catch(() => false);
      
      if (isLastStep) {
        await finishButton.click();
        break;
      }

      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(500);
      } else {
        break;
      }
    }

    await expect(tooltip).not.toBeVisible({ timeout: 3000 });
  });

  test('再次访问不触发', async ({ page }) => {
    await page.goto('/');
    const tooltip = page.locator('[data-testid="tour-tooltip"]');
    await expect(tooltip).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');
    await expect(tooltip).not.toBeVisible({ timeout: 3000 });
    
    await page.waitForTimeout(2000);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await expect(tooltip).not.toBeVisible({ timeout: 2000 });
  });

  test('帮助按钮重新触发', async ({ page }) => {
    await page.goto('/');
    const tooltip = page.locator('[data-testid="tour-tooltip"]');
    await expect(tooltip).toBeVisible({ timeout: 5000 });

    const closeButton = page.locator('[data-testid="tour-close-btn"]');
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }

    await expect(tooltip).not.toBeVisible();

    const helpButton = page.locator('[data-testid="help-button"]');
    await expect(helpButton).toBeVisible({ timeout: 5000 });
    await helpButton.click();

    await expect(tooltip).toBeVisible({ timeout: 3000 });
    await expect(tooltip).toContainText('开始学习');
  });

  test('Esc 键关闭', async ({ page }) => {
    await page.goto('/');
    const tooltip = page.locator('[data-testid="tour-tooltip"]');
    await expect(tooltip).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');
    await expect(tooltip).not.toBeVisible({ timeout: 2000 });
  });

  test('版本环境按钮显示正确', async ({ page }) => {
    await page.goto('/');
    
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    
    // 先关闭引导弹窗（如果存在）
    const tooltip = page.locator('[data-testid="tour-tooltip"]');
    if (await tooltip.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(tooltip).not.toBeVisible({ timeout: 3000 });
    }
    
    // 查找升级按钮 (在导航栏中)
    const upgradeButton = page.locator('[data-tour-id="home-upgrade"]');
    await expect(upgradeButton).toBeVisible({ timeout: 5000 });

    // 验证版本号显示
    await expect(upgradeButton).toContainText(/v[0-9a-f]{7,}|v\d+\.\d+\.\d+|vdev/);

    // 点击打开升级面板
    await upgradeButton.click();

    // 验证升级面板出现
    const upgradePanel = page.locator('text=版本与升级');
    await expect(upgradePanel).toBeVisible({ timeout: 3000 });

    // 查找环境检测按钮 (在导航栏中)
    const envButton = page.locator('[data-tour-id="home-env-check"]');
    await expect(envButton).toBeVisible({ timeout: 5000 });

    // 点击打开环境检测面板
    await envButton.click();

    // 验证面板出现 - 检查 Docker 环境检测项
    const envPanel = page.locator('text=Docker 环境');
    await expect(envPanel).toBeVisible({ timeout: 3000 });
  });

  test('键盘导航', async ({ page }) => {
    await page.goto('/');
    const tooltip = page.locator('[data-testid="tour-tooltip"]');
    await expect(tooltip).toBeVisible({ timeout: 5000 });

    const firstStepContent = await tooltip.textContent();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);

    const secondStepContent = await tooltip.textContent();
    expect(secondStepContent).not.toBe(firstStepContent);

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(500);

    const backToFirstContent = await tooltip.textContent();
    expect(backToFirstContent).toBe(firstStepContent);
  });
});
