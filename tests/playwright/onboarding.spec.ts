import { test, expect } from './test-setup';
import type { Page } from '@playwright/test';

const gotoWithRetry = async (page: Page) => {
  const maxAttempts = 5;
  let lastError: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await page.goto('/');
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1000);
    }
  }
  throw lastError;
};

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

  test('升级流程展示说明动画并在恢复后提示成功', async ({ page }) => {
    let upgraded = false;
    let healthCheckCount = 0;

    await page.route('**/api/version', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: upgraded ? '0.4.3' : '0.4.2',
        }),
      });
    });

    await page.route('**/api/upgrade/check', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          currentVersion: upgraded ? '0.4.3' : '0.4.2',
          latestVersion: '0.4.3',
          hasUpdate: !upgraded,
          canUpgrade: !upgraded,
          message: upgraded ? '当前已是最新版本' : '发现新版本 v0.4.3，可执行升级',
          dockerDeploy: false,
        }),
      });
    });

    await page.route('**/api/upgrade', async (route) => {
      upgraded = true;
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          message: '升级已开始，服务即将重启',
        }),
      });
    });

    await page.route('**/health', async (route) => {
      healthCheckCount += 1;
      const status = healthCheckCount < 3 ? 503 : 200;
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ status: status === 200 ? 'ok' : 'restarting' }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const tooltip = page.locator('[data-testid="tour-tooltip"]');
    if (await tooltip.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(tooltip).not.toBeVisible({ timeout: 3000 });
    }

    const upgradeButton = page.locator('[data-tour-id="home-upgrade"]');
    await expect(upgradeButton).toBeVisible({ timeout: 5000 });
    await upgradeButton.click();

    await expect(page.locator('text=版本与升级')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=当前版本 v0.4.2')).toBeVisible({ timeout: 5000 });

    const startUpgradeButton = page.getByRole('button', { name: '立即升级' });
    await expect(startUpgradeButton).toBeVisible({ timeout: 5000 });
    await expect(startUpgradeButton).toBeEnabled({ timeout: 5000 });
    await startUpgradeButton.click();

    await page.getByRole('button', { name: '开始升级' }).click();

    await expect(page.locator('text=正在升级，服务即将自动重启')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=页面可能短暂不可用')).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: '升级中' })).toBeVisible({ timeout: 8000 });

    await expect(page.getByText('升级成功，服务已恢复').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('升级成功，当前版本 v0.4.3').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/当前版本 v0\.4\.3/).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/已是最新/).first()).toBeVisible({ timeout: 8000 });
  });

  test('键盘导航', async ({ page }) => {
    await gotoWithRetry(page);
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

  test('学习页弹窗位置在课程类型间保持一致', async ({ page, request }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('hasSeenTour');
      localStorage.removeItem('TOUR_DISABLED_FOR_E2E');
    });

    const tooltipRoot = page.locator('[data-testid="tour-tooltip"]').last();
    const tooltipPanel = tooltipRoot.locator('div.w-80');
    const target = page.locator('[data-tour-id="learn-start-container"]');
    const cleanupCourse = async (courseId: string) => {
      await request.post(`/api/courses/${courseId}/cleanup-containers`);
      await request.post(`/api/courses/${courseId}/stop`).catch(() => undefined);
      await request.post(`/api/courses/${courseId}/cleanup-containers`);
    };
    const openTourAndMeasure = async (courseId: string) => {
      await cleanupCourse(courseId);
      await page.goto(`/learn/${courseId}`);
      await page.waitForLoadState('networkidle');
      await expect(tooltipRoot).toBeVisible({ timeout: 8000 });
      await expect(tooltipPanel).toBeVisible({ timeout: 8000 });
      await expect(target).toBeVisible({ timeout: 8000 });

      const tooltipBox = await tooltipPanel.boundingBox();
      const targetBox = await target.boundingBox();
      expect(tooltipBox).not.toBeNull();
      expect(targetBox).not.toBeNull();

      const tooltip = tooltipBox!;
      const anchor = targetBox!;
      const tooltipCenterX = tooltip.x + tooltip.width / 2;
      const tooltipCenterY = tooltip.y + tooltip.height / 2;
      const targetCenterX = anchor.x + anchor.width / 2;
      const targetCenterY = anchor.y + anchor.height / 2;
      const dx = tooltipCenterX - targetCenterX;
      const dy = tooltipCenterY - targetCenterY;

      let side: 'left' | 'right' | 'top' | 'bottom';
      if (Math.abs(dx) >= Math.abs(dy)) {
        side = dx >= 0 ? 'right' : 'left';
      } else {
        side = dy >= 0 ? 'bottom' : 'top';
      }

      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();

      expect(tooltip.x).toBeGreaterThanOrEqual(0);
      expect(tooltip.y).toBeGreaterThanOrEqual(0);
      expect(tooltip.x + tooltip.width).toBeLessThanOrEqual(viewport!.width);
      expect(tooltip.y + tooltip.height).toBeLessThanOrEqual(viewport!.height);

      return { side, dx, dy };
    };

    const sql = await openTourAndMeasure('sql');
    const shell = await openTourAndMeasure('quick-start');
    const codeFirst = await openTourAndMeasure('python-kwdb');
    const codeSecond = await openTourAndMeasure('python-kwdb');

    expect(codeFirst.side).toBe(shell.side);
    expect(Math.abs(codeFirst.dx - shell.dx)).toBeLessThan(60);
    expect(Math.abs(codeFirst.dy - shell.dy)).toBeLessThan(60);
    expect(Math.abs(codeSecond.dx - codeFirst.dx)).toBeLessThan(24);
    expect(Math.abs(codeSecond.dy - codeFirst.dy)).toBeLessThan(24);

    expect(sql.side).toBeTruthy();
    expect(shell.side).toBeTruthy();
  });
});
