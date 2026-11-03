import { test, expect } from '@playwright/test';
import { trackErrors } from './_util.js';

test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

const press = (page, testid, ms = 120) => page.evaluate(async ([id, ms]) => {
  const el = document.querySelector(`[data-testid="${id}"]`);
  const r = el.getBoundingClientRect();
  const o = { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  el.dispatchEvent(new PointerEvent('pointerdown', o));
  await new Promise(res => setTimeout(res, ms));
  el.dispatchEvent(new PointerEvent('pointerup', o));
}, [testid, ms]);

const stick = (page, dx, dy, ms) => page.evaluate(async ([dx, dy, ms]) => {
  const el = document.querySelector('[data-testid="touch-stick"]');
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const o = (x, y) => ({ bubbles: true, pointerId: 3, pointerType: 'touch', clientX: x, clientY: y });
  el.dispatchEvent(new PointerEvent('pointerdown', o(cx + dx, cy + dy)));
  el.dispatchEvent(new PointerEvent('pointermove', o(cx + dx, cy + dy)));
  await new Promise(res => setTimeout(res, ms));
  el.dispatchEvent(new PointerEvent('pointerup', o(cx, cy)));
}, [dx, dy, ms]);

async function startTraining(page) {
  await page.goto('/');
  await page.getByTestId('title-screen').click();
  await page.getByTestId('mode-training').click();
  await page.getByTestId('select-ok').click();
  await page.getByTestId('select-ok').click();
  await page.waitForFunction(() => window.__game.isRunning());
}

test('手机横屏：点按就能从标题进入对战，画面完整显示，触屏按键出现', async ({ page }) => {
  const errors = trackErrors(page);
  await startTraining(page);
  expect(await page.evaluate(() => window.__game.touch())).toBe(true);
  await expect(page.getByTestId('touch-stick')).toBeVisible();
  await expect(page.getByTestId('touch-sp')).toBeVisible();
  const box = await page.locator('#scene').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(845);
  expect(box.height).toBeLessThanOrEqual(391);
  expect(box.width).toBeGreaterThan(600);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(844);
  expect(errors).toEqual([]);
});

test('摇杆移动、攻击键出招、必杀键一键发动必杀技', async ({ page }) => {
  const errors = trackErrors(page);
  await startTraining(page);
  const x0 = await page.evaluate(() => window.__game.getState().fighters[0].x);
  await stick(page, 60, 0, 600);
  const x1 = await page.evaluate(() => window.__game.getState().fighters[0].x);
  expect(x1, '推摇杆向右应前进').toBeGreaterThan(x0 + 10);
  await page.waitForTimeout(300);
  await press(page, 'touch-hp');
  // 走近后按 C：贴身是近身版 cl.hp，离远是 st.hp
  await page.waitForFunction(() => /^(st|cl)\.hp$/.test(window.__game.getState().fighters[0].move?.id ?? ''), null, { timeout: 2000 });
  await page.waitForFunction(() => !window.__game.getState().fighters[0].move, null, { timeout: 3000 });
  const sp = await page.evaluate(() => window.__game.getState().fighters[0].charId);
  await press(page, 'touch-sp');
  const first = await page.evaluate(async () => {
    for (let i = 0; i < 30; i++) {
      const m = window.__game.getState().fighters[0].move;
      if (m) return m.id;
      await new Promise(r => setTimeout(r, 16));
    }
    return null;
  });
  expect(first, `${sp} 必杀键应发动第一个必杀技`).toBeTruthy();
  expect(first).not.toMatch(/^(st|cr|j)\./);
  expect(errors).toEqual([]);
});
