import { test, expect } from '@playwright/test';
import { trackErrors, openTestMode } from './_util.js';

const info = (page) => page.evaluate(() => window.__game.cutscene());

async function advanceAll(page, max = 80) {
  for (let i = 0; i < max && (await info(page)).active; i++) await page.keyboard.press('Enter');
}

test('过场播放：逐句推进、Enter 先补完整句、播完自动关闭，无报错', async ({ page }) => {
  const errors = trackErrors(page);
  await openTestMode(page);
  const n = await page.evaluate(() => window.__game.playStory('prologue', 'c01'));
  expect(n).toBeGreaterThan(0);
  await expect(page.getByTestId('cutscene')).toBeVisible();
  const a = await info(page);
  expect(a.active).toBe(true);
  expect(a.text.length).toBeGreaterThan(0);
  await page.waitForTimeout(2500);
  await expect(page.getByTestId('cutscene')).toContainText(a.text);
  await page.keyboard.press('Enter');
  const b = await info(page);
  expect(b.line + b.scene).toBeGreaterThan(a.line + a.scene);
  await advanceAll(page);
  expect((await info(page)).active).toBe(false);
  await expect(page.getByTestId('cutscene')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Esc 跳过整段过场；没有美术素材时用占位画面', async ({ page }) => {
  const errors = trackErrors(page);
  await openTestMode(page);
  await page.evaluate(() => window.__game.playStory('ending', 'c05'));
  await expect(page.getByTestId('cutscene')).toBeVisible();
  await expect(page.locator('.cs-fallback, .cs-img.ok').first()).toBeVisible();
  await page.keyboard.press('Escape');
  expect((await info(page)).active).toBe(false);
  expect(errors).toEqual([]);
});

test('首次打开播放开场动画，播完回到标题页', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?cutscenes=1');
  await expect(page.getByTestId('cutscene')).toBeVisible();
  await expect(page.getByTestId('cutscene')).toContainText('黑岭');
  await page.keyboard.press('Enter'); // 过场中按 Enter 不应进入选人页
  await expect(page.getByTestId('select-screen')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  expect(errors).toEqual([]);
});

test('街机模式：序章 → 每战对战前对话 → 第七战体检关 → 结局过场 → 结局画面', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?cutscenes=1');
  await page.keyboard.press('Escape'); // 跳过开场
  await page.keyboard.press('Enter');
  await page.getByTestId('mode-arcade').click();
  for (let i = 0; i < 3 && !(await info(page)).active; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
  expect((await info(page)).active, '选人后应进入序章过场').toBe(true);
  expect(await page.evaluate(() => window.__game.isRunning())).toBe(false);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__game.isRunning());
  for (let k = 1; k < 7; k++) {
    await page.evaluate(() => window.__game.arcadeWin());
    await page.waitForFunction(() => window.__game.cutscene().active);
    if (k === 6) { // 第七战前是体检关：往下翻几句，应出现"体检"
      let hit = false;
      for (let j = 0; j < 8 && !hit; j++) {
        await page.keyboard.press('Enter'); // 补完整句
        hit = /体检/.test((await info(page)).text);
        if (!hit) await page.keyboard.press('Enter');
      }
      expect(hit, '第七战前应进入体检关').toBe(true);
    }
    if ((await info(page)).active) await page.keyboard.press('Escape');
    await page.waitForFunction((n) => window.__game.arcade()?.index === n && window.__game.isRunning(), k);
  }
  await page.evaluate(() => window.__game.arcadeWin());
  await page.waitForFunction(() => window.__game.cutscene().active);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('ending')).toBeVisible();
  expect(errors).toEqual([]);
});
