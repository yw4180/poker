import { expect, test } from '@playwright/test';
import { createRoomWithBots, register, watchErrors } from './helpers';

test('注册 → 大厅 → 建房 → 加机器人 → 开局，且无浏览器报错', async ({ page }) => {
  const { errors } = watchErrors(page);
  await register(page);
  await createRoomWithBots(page);
  await page.getByRole('button', { name: '开始游戏' }).click();
  // 发牌中：桌面出现
  await expect(page.getByText(/发牌中|亮主倒计时/).first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  expect(errors, errors.join('\n')).toEqual([]);
});
