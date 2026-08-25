import { test } from '@playwright/test';
test('牌面画廊截图', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto('/cards');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/shot-cards.png', fullPage: true });
});
