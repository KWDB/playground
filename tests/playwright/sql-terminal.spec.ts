import { test, expect } from '@playwright/test';

test('SQL 终端测试', async ({ page }) => {
  // 1) 直接进入首页
  await page.goto('/');
  await page.getByRole('link', { name: '开始学习' }).click();
  await page.locator('a[href="/learn/sql"]').click();
  console.log('✅ 首页点击了 SQL 课程链接');

  // 2) 确认进入学习页，显示“请先启动容器”文案
  await expect(page.getByText('请启动容器以连接终端')).toBeVisible({ timeout: 10000 });
  
  // 3) 点击“启动容器”
  await page.getByRole('button', { name: '启动容器' }).click();
  await expect(page.getByText('KWDB 版本')).toBeVisible({ timeout: 10000 });
  console.log('✅ 启动容器');

  // 4) 测试 Enter 执行
  await page.getByRole('textbox').fill('SELECT 1');
  await page.getByRole('textbox').press('Enter');
  await expect(page.getByRole('cell', { name: '?column?' })).toBeVisible({ timeout: 10000 });
  console.log('✅ Enter 执行');
  // 5) 测试清理按钮
  await page.getByRole('button', { name: '清除输入' }).click();
  await expect(page.getByText('已清除输入')).toBeVisible({ timeout: 10000 });
  console.log('✅ 清除输入');

  // 6) 点击“下一步”，执行第一页的命令
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('paragraph').filter({ hasText: '创建一个名为 sensor_data 的时序数据库：' }).getByRole('button').click();
  await expect(page.getByText('操作成功')).toBeVisible({ timeout: 10000 });
  await page.getByRole('paragraph').filter({ hasText: '创建一个名为 device_management' }).getByRole('button').click();
  await expect(page.getByText('操作成功')).toBeVisible({ timeout: 10000 });
  await page.locator('pre').filter({ hasText: 'sql可执行代码Run-- 在时序数据库中创建传感器读数表 CREATE TABLE sensor_data.readings ( ts' }).getByLabel('执行当前代码块命令').click();
  await expect(page.getByText('操作成功')).toBeVisible({ timeout: 10000 });
  await page.locator('pre').filter({ hasText: 'sql可执行代码Run-- 在关系数据库中创建设备信息表' }).getByLabel('执行当前代码块命令').click();
  await expect(page.getByText('操作成功')).toBeVisible({ timeout: 10000 });
  console.log('✅ 执行第一页的命令');

  // 7) 点击“下一步”，执行第二页的命令
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByText('向关系表插入设备信息')).toBeVisible({ timeout: 10000 });
  await page.locator('pre').filter({ hasText: 'sql可执行代码RunINSERT INTO device_management.devices VALUES (101, \'温度传感器-101' }).getByLabel('执行当前代码块命令').click();
  await expect(page.getByText('影响 3 行数据')).toBeVisible({ timeout: 10000 });
  await page.locator('pre').filter({ hasText: 'sql可执行代码RunINSERT INTO sensor_data.readings VALUES (\'2025-08-15 13:00:00\', 23.5' }).getByLabel('执行当前代码块命令').click();
  await expect(page.getByText('影响 8 行数据')).toBeVisible({ timeout: 10000 });
  await page.locator('pre').filter({ hasText: 'sql可执行代码RunSELECT r.ts AS' }).getByLabel('执行当前代码块命令').click();
  console.log('✅ 执行第二页的命令');

  // 操作页面右侧滚动条滚动到底部（滚动主文档）
  await page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    el.scrollTo(0, el.scrollHeight);
  });

  // 8) 查看最终结果，确认数据插入成功
  await expect(page.getByRole('cell', { name: 'timestamp' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('cell', { name: '25.8' })).toBeVisible({ timeout: 10000 });
  console.log('✅ 查看最终结果');

  // 9) 退出课程
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '退出课程' }).click();
  await page.getByRole('button', { name: '确定' }).click();
  await expect(page.getByRole('heading', { name: '课程列表' })).toBeVisible({ timeout: 10000 });
  console.log('✅ 退出课程');
});