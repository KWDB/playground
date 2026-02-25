import { test, expect } from '@playwright/test';

test.describe('Onboarding Tour', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('tourStorageCleared')) {
        localStorage.removeItem('hasSeenTour');
        sessionStorage.setItem('tourStorageCleared', 'true');
      }
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
