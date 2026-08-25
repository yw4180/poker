import { test } from '@playwright/test';
import { register } from './helpers';

/** 只截图：登录页、大厅、房间大厅（不打牌） */
test('页面截图', async ({ page }) => {
  await page.goto('/login');
  await page.screenshot({ path: 'test-results/shot-login.png' });
  await register(page, '截图员');
  await page.screenshot({ path: 'test-results/shot-home.png' });
  await page.getByRole('button', { name: '房间选项' }).click();
  await page.screenshot({ path: 'test-results/shot-home-options.png' });
  await page.getByRole('button', { name: '创建房间' }).click();
  await page.getByRole('button', { name: '入座' }).first().click();
  await page.getByRole('button', { name: '+机器人' }).first().click();
  await page.screenshot({ path: 'test-results/shot-lobby.png' });
});
