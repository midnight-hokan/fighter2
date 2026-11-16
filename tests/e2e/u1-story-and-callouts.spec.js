import { test, expect } from '@playwright/test';
import { openTestMode, trackErrors } from './_util.js';

test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

test('触屏继续仅推进一次，跳过直接关闭当前过场', async ({ page }) => {
  const errors = trackErrors(page);
  await openTestMode(page);
  const initial = await page.evaluate(() => {
    window.__game.playStory('opening');
    return window.__game.cutscene();
  });
  await page.getByTestId('cutscene-next').tap();
  await expect(page.locator('.cs-text')).toHaveText(initial.text);
  await page.getByTestId('cutscene-next').tap();
  const advanced = await page.evaluate(() => window.__game.cutscene());
  expect(advanced.scene + advanced.line).toBe(initial.scene + initial.line + 1);
  await page.getByTestId('cutscene-skip').tap();
  await expect(page.getByTestId('cutscene')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('不同必杀显示各自招式名称，招牌语音按招式独立加载', async ({ page }) => {
  const errors = trackErrors(page);
  await openTestMode(page);
  await page.evaluate(() => window.__game.assetsReady());
  const loaded = await page.evaluate(() => window.__game.audioFiles().loaded);
  expect(loaded).toContain('assets/meilong/voice/c02_baokong.ogg');
  expect(loaded).toContain('assets/meilong/voice/c02_longxuantan.ogg');
  for (const [id, name] of [['baokong', '抛救生绳'], ['tanshui', '照明信号弹']]) {
    await page.evaluate((move) => {
      window.__game.reset({ p1: 'c02', p2: 'c01', training: true });
      window.__game.input(0, { special: move });
      window.__game.step();
    }, id);
    await expect(page.getByTestId('move-call-p1')).toHaveText(name);
    await expect(page.getByTestId('move-call-p1')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
