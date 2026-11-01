import { test, expect } from '@playwright/test';
import { trackErrors, openTestMode } from './_util.js';
import theme from '../../src/theme/index.js';

test('8 名角色两两快速对打（电脑托管）无报错，且都能正常显示', async ({ page }) => {
  const errors = trackErrors(page);
  await openTestMode(page);
  const ids = theme.roster.map(c => c.id);
  for (let i = 0; i < ids.length; i++) {
    const p2 = ids[(i + 3) % ids.length];
    const n = await page.evaluate(([a, b]) => {
      const g = window.__game;
      g.reset({ p1: a, p2: b, seed: 7 });
      let k = 0;
      const keys = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk'];
      for (let f = 0; f < 900; f++) {
        if (f % 7 === 0) g.input(0, { right: true, [keys[k++ % 6]]: true }, 1);
        if (f % 11 === 0) g.input(1, { left: true, [keys[(k + 2) % 6]]: true }, 1);
        g.step(1);
      }
      return g.getState().frame;
    }, [ids[i], p2]);
    expect(n).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});

test('出招表列出双方所有必杀技和超必杀', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Enter');
  await page.keyboard.press('KeyD');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.isRunning());
  await page.keyboard.press('Escape');
  const ids = await page.evaluate(() => window.__game.getState().fighters.map(f => f.charId));
  for (const id of ids) {
    const c = theme.roster.find(x => x.id === id);
    for (const s of [...c.specials, ...c.supers]) await expect(page.getByTestId('movelist')).toContainText(s.name);
  }
});

test('性能：任意角色组合每帧中位数 < 8ms', async ({ page }) => {
  await openTestMode(page);
  const ids = theme.roster.map(c => c.id);
  const ms = await page.evaluate(([a, b]) => { const g = window.__game; g.reset({ p1: a, p2: b, p1x: 364, p2x: 404 }); g.bench(60); return g.bench(300); }, [ids[3], ids[6]]);
  expect(ms).toBeLessThan(8);
});
