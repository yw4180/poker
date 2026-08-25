import { expect, type Page } from '@playwright/test';

/** 收集页面 console error / pageerror，测试结束时断言为空 */
export function watchErrors(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
  return { errors };
}

export async function register(page: Page, name = '测试员'): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.com`;
  await page.goto('/register');
  await page.getByPlaceholder('昵称').fill(name);
  await page.getByPlaceholder('邮箱').fill(email);
  await page.getByPlaceholder('密码（至少 6 位）').fill('secret123');
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByRole('button', { name: '创建房间' })).toBeVisible();
  return email;
}

export async function createRoomWithBots(page: Page): Promise<string> {
  await page.getByRole('button', { name: '创建房间' }).click();
  await expect(page).toHaveURL(/\/room\/[A-Z0-9]+$/);
  const roomId = page.url().split('/').pop()!;
  await page.getByRole('button', { name: '入座' }).first().click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '+机器人' }).first().click();
  }
  await expect(page.getByRole('button', { name: '+机器人' })).toHaveCount(0);
  return roomId;
}
