import { test, expect } from '@playwright/test';
import { trackErrors } from './_util.js';
import theme from '../../src/theme/index.js';

// 街机模式需要的测试接口：
//   __game.arcade() → { index, opponent, level } 或 null（不在街机模式）
//   __game.arcadeWin() → 判当前这一战玩家获胜，并进入下一战（或结局）
test('街机模式：从选人页进入，打通 7 战看到结局，Enter 回标题', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await page.keyboard.press('Enter');
  await page.getByTestId('mode-arcade').click();
  // 街机模式下 P2 由电脑决定，选完 P1 后可能直接开打，也可能再确认一次
  for (let i = 0; i < 3 && !(await page.evaluate(() => window.__game.isRunning())); i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
  await page.waitForFunction(() => window.__game.isRunning());
  const a0 = await page.evaluate(() => window.__game.arcade());
  expect(a0.index).toBe(0);
  expect(await page.evaluate(() => window.__game.getState().fighters[1].charId)).toBe(a0.opponent);
  const seen = new Set([a0.opponent]);
  for (let i = 1; i < 7; i++) {
    await page.evaluate(() => window.__game.arcadeWin());
    await page.waitForFunction((k) => window.__game.arcade()?.index === k && window.__game.isRunning(), i);
    const a = await page.evaluate(() => window.__game.arcade());
    seen.add(a.opponent);
    expect(await page.evaluate(() => window.__game.getState().fighters[1].charId)).toBe(a.opponent);
  }
  expect(seen.size).toBe(7);
  await page.evaluate(() => window.__game.arcadeWin());
  await expect(page.getByTestId('ending')).toBeVisible();
  await expect(page.getByTestId('ending')).toContainText(theme.roster[0].ending.slice(0, 10));
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  expect(errors).toEqual([]);
});
