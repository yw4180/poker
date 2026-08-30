import { expect, test, type Page } from '@playwright/test';
import type { Action, GameState } from '@poker/engine';
import type { PlayerView } from '@poker/protocol';
import { createRoomWithBots, register, watchErrors } from './helpers';

type Win = Window & {
  __store?: { getState(): { game: PlayerView | null } };
  __engine?: {
    createGame(players: PlayerView['players']): GameState;
    botAction(state: GameState, seat: number): Action | null;
  };
};

async function readView(page: Page): Promise<PlayerView | null> {
  return page.evaluate(() => (window as Win).__store?.getState().game ?? null);
}

/** 在页面里用引擎的 botAction 替人类决定出什么（其他人手牌未知，置空） */
async function decide(page: Page): Promise<Action | null> {
  return page.evaluate(() => {
    const w = window as Win;
    const v = w.__store?.getState().game;
    if (!v || !w.__engine) return null;
    const base = w.__engine.createGame(v.players);
    const hands: GameState['hands'] = [[], [], [], []];
    hands[v.seat] = v.hand;
    const {
      hand: _h,
      handCounts: _c,
      kittyCount: _k,
      deckCount: _d,
      actor: _a,
      seat: _s,
      kitty: _kk,
      ...rest
    } = v;
    return w.__engine.botAction({ ...base, ...rest, hands, kitty: [], deck: [] }, v.seat);
  });
}

const vp = process.env.E2E_VIEWPORT?.split('x').map(Number);
if (vp && vp.length === 2)
  test.use({ viewport: { width: vp[0]!, height: vp[1]! }, hasTouch: true });

test('一人 + 三机器人打完一局', async ({ page }) => {
  const { errors } = watchErrors(page);
  await register(page, '人类');
  await createRoomWithBots(page);
  await page.getByRole('button', { name: '开始游戏' }).click();

  const shots = new Set<string>();
  const shot = async (name: string) => {
    if (shots.has(name)) return;
    shots.add(name);
    await page.screenshot({
      path: `test-results/shot-${process.env.E2E_VIEWPORT ?? 'desktop'}-${name}.png`,
      fullPage: true,
    });
  };
  const deadline = Date.now() + 100_000;
  let lastHandSize = -1;
  while (Date.now() < deadline) {
    const v = await readView(page);
    if (!v) {
      await page.waitForTimeout(200);
      continue;
    }
    if (v.phase === 'declaring') await shot('declaring');
    if (v.phase === 'kitty' && v.actor === v.seat) await shot('kitty');
    if (v.phase === 'playing' && v.tricks.length >= 3 && v.actor === v.seat) await shot('playing');
    if (v.phase === 'roundEnd' || v.phase === 'finished') break;
    if (v.phase === 'declaring' && v.actor === v.seat) {
      await page
        .getByRole('button', { name: '过', exact: true })
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(150);
      continue;
    }
    if (v.actor === v.seat && (v.phase === 'kitty' || v.phase === 'playing')) {
      const a = await decide(page);
      if (a && (a.type === 'BURY' || a.type === 'PLAY')) {
        // 点选牌，再点按钮
        const clear = page.getByRole('button', { name: '清空' });
        if (await clear.isEnabled().catch(() => false)) await clear.click();
        // 手牌相互重叠，点每张牌左侧可见的 12px 区域
        for (const id of a.cardIds) {
          await page
            .locator(`[data-card-id="${id}"]`)
            .last()
            .click({ position: { x: 12, y: 40 } });
        }
        await page.getByRole('button', { name: a.type === 'BURY' ? '扣底' : '出牌' }).click();
        // 等待手牌变化
        await expect
          .poll(async () => (await readView(page))?.hand.length ?? -1, { timeout: 5000 })
          .not.toBe(v.hand.length);
        lastHandSize = v.hand.length - a.cardIds.length;
      }
    }
    await page.waitForTimeout(150);
  }
  const final = await readView(page);
  expect(final?.phase === 'roundEnd' || final?.phase === 'finished').toBe(true);
  expect(final?.handCounts).toEqual([0, 0, 0, 0]);
  expect(lastHandSize).toBe(0);
  await expect(page.getByText('底牌：')).toBeVisible();
  await shot('roundEnd');
  await expect(page.getByRole('button', { name: '下一局' })).toBeVisible();
  expect(errors, errors.join('\n')).toEqual([]);
});
