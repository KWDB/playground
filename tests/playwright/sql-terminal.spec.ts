import { test, expect } from '@playwright/test';

test('SQL 终端测试', async ({ page }) => {
  // 1) 直接进入首页
  await page.goto('/');
  await page.getByRole('link', { name: '开始学习' }).click();
  await page.getByRole('link', { name: '开始学习' }).nth(1).click();

  // 2) 确认进入学习页，显示“请先启动容器”文案
  await expect(page.getByText('请启动容器以连接终端')).toBeVisible({ timeout: 120_000 });

  // 3) 点击“启动容器”
  await page.getByRole('button', { name: '启动容器' }).click();
  await expect(page.getByText('KWDB 版本')).toBeVisible({ timeout: 120_000 });

  // 4) 点击“下一步”，执行第一页的命令
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('paragraph').filter({ hasText: '创建一个名为 sensor_data 的时序数据库：' }).getByRole('button').click();
  await page.getByRole('paragraph').filter({ hasText: '创建一个名为 device_management' }).getByRole('button').click();
  await page.locator('pre').filter({ hasText: 'sql可执行代码Run-- 在时序数据库中创建传感器读数表 CREATE TABLE sensor_data.readings ( ts' }).getByLabel('执行当前代码块命令').click();
  await page.locator('pre').filter({ hasText: 'sql可执行代码Run-- 在关系数据库中创建设备信息表' }).getByLabel('执行当前代码块命令').click();

  // 5) 点击“下一步”，执行第二页的命令
  await page.getByRole('button', { name: '下一步' }).click();
  await page.locator('pre').filter({ hasText: 'sql可执行代码RunINSERT INTO device_management.devices VALUES (101, \'温度传感器-101' }).getByLabel('执行当前代码块命令').click();
  await page.locator('pre').filter({ hasText: 'sql可执行代码RunINSERT INTO sensor_data.readings VALUES (\'2025-08-15 13:00:00\', 23.5' }).getByLabel('执行当前代码块命令').click();
  await page.locator('pre').filter({ hasText: 'sql可执行代码RunSELECT r.ts AS' }).getByLabel('执行当前代码块命令').click();

  // 6) 查看最终结果，确认数据插入成功
  await expect(page.getByRole('cell', { name: '-08-16T00:30:00+08:00' })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole('cell', { name: '25.8' })).toBeVisible({ timeout: 120_000 });

  // 7) 退出课程
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '退出课程' }).click();
  await page.getByRole('button', { name: '确定' }).click();
  await expect(page.getByRole('heading', { name: '课程列表' })).toBeVisible({ timeout: 120_000 });
});