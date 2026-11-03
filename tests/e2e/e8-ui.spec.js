import { test, expect } from '@playwright/test';
import { trackErrors, openTestMode, startFromMenu, canvasStats, solidPng } from './_util.js';
import { requiredAnims } from '../../src/render/atlas.js';
import theme from '../../src/theme/index.js';

test('测试模式加载无报错，画布为逻辑 384×224（高清倍数绘制）且不是黑屏', async ({ page }) => {
  const errors = trackErrors(page);
  await openTestMode(page);
  await page.evaluate(() => window.__game.step(10));
  const st = await canvasStats(page);
  expect(Number.isInteger(st.k) && st.k >= 1).toBe(true);
  expect(st.width).toBe(384 * st.k);
  expect(st.height).toBe(224 * st.k);
  expect(st.variance).toBeGreaterThan(30);
  expect(errors).toEqual([]);
});

test('标题页显示主题标题和版本号', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toContainText(theme.title);
  await expect(page.getByTestId('version')).toBeVisible();
});

test('标题 → 选人（8 个角色、故事/对战/训练模式）→ 开打，全程无报错', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await page.keyboard.press('Enter');
  for (const c of theme.roster) await expect(page.getByTestId(`char-${c.id}`)).toBeVisible();
  for (const m of ['arcade', 'cpu-easy', 'cpu-normal', 'cpu-hard', '2p', 'training']) await expect(page.getByTestId(`mode-${m}`)).toBeVisible();
  // 模式顺序：故事模式排第一（默认选中），对战居中，训练最后
  expect(await page.locator('.mode').first().getAttribute('data-testid')).toBe('mode-arcade');
  expect(await page.locator('.mode').last().getAttribute('data-testid')).toBe('mode-training');
  await page.getByTestId('mode-cpu-normal').click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.isRunning());
  await expect(page.getByTestId('hud')).toBeVisible();
  await page.waitForTimeout(2500);
  expect(errors).toEqual([]);
});

test('键盘：P1 移动和 4 个攻击键（拳皇式 A B C D）', async ({ page }) => {
  await startFromMenu(page, { modeSteps: 5 }); // 训练模式，对手不动
  const x0 = await page.evaluate(() => window.__game.getState().fighters[0].x);
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyA');
  expect(await page.evaluate(() => window.__game.getState().fighters[0].x)).toBeLessThan(x0 - 10);
  for (const [key, id] of [['KeyJ', 'st.lp'], ['KeyK', 'st.lk'], ['KeyU', /^(st|cl)\.hp$/], ['KeyI', /^(st|cl)\.hk$/]]) {
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__seen = [];
      const t = setInterval(() => window.__seen.push(window.__game.getState().fighters[0].move?.id), 8);
      setTimeout(() => clearInterval(t), 500);
    });
    await page.keyboard.down(key);
    await page.waitForTimeout(150);
    await page.keyboard.up(key);
    await page.waitForTimeout(400);
    const seen = await page.evaluate(() => window.__seen);
    if (id instanceof RegExp) expect(seen.some(x => id.test(x ?? '')), key).toBe(true); else expect(seen, key).toContain(id);
  }
});

test('训练模式：计时显示 ∞，有训练信息', async ({ page }) => {
  await startFromMenu(page, { modeSteps: 5 });
  expect(await page.evaluate(() => window.__game.mode())).toBe('training');
  await expect(page.getByTestId('timer')).toHaveText('∞');
  await expect(page.getByTestId('training-info')).toContainText('训练');
});

test('Esc 打开出招表（含必杀技名和通用系统），再按关闭', async ({ page }) => {
  await startFromMenu(page, { modeSteps: 5 });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('movelist')).toBeVisible();
  await expect(page.getByTestId('movelist')).toContainText(theme.roster[0].specials[0].name);
  await expect(page.getByTestId('movelist')).toContainText('爆气');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('movelist')).toBeHidden();
});

test('F1 显示判定框', async ({ page }) => {
  await openTestMode(page);
  const before = await page.evaluate(() => window.__game.renderInfo().showBoxes);
  await page.keyboard.press('F1');
  expect(await page.evaluate(() => window.__game.renderInfo().showBoxes)).toBe(!before);
});

test('命中出现火花并播放音效，特效会消失', async ({ page }) => {
  const errors = trackErrors(page);
  await openTestMode(page);
  const r = await page.evaluate(() => {
    const g = window.__game;
    g.reset({ p1x: 364, p2x: 404 });
    g.input(0, { hp: true }, 1);
    let spark = 0;
    for (let i = 0; i < 30; i++) { g.step(1); spark = Math.max(spark, g.renderInfo().effects); }
    g.step(200);
    return { spark, after: g.renderInfo().effects, log: g.audioInfo().log };
  });
  expect(r.spark).toBeGreaterThan(0);
  expect(r.after).toBe(0);
  expect(r.log).toContain('hit');
  expect(errors).toEqual([]);
});

test('HUD：豆数、血条随状态变化', async ({ page }) => {
  await openTestMode(page);
  await page.evaluate(() => { window.__game.reset({}); window.__game.setMeter(0, 2, 50); window.__game.setHp(1, 500); });
  await expect(page.getByTestId('stocks-p1')).toHaveText('2');
  expect(await page.getByTestId('gauge-p1').evaluate(el => el.style.width)).toBe('50%');
  expect(await page.getByTestId('hp-p2').evaluate(el => el.style.width)).toBe('50%');
});

test('超必杀有暗屏演出且不报错', async ({ page }) => {
  const errors = trackErrors(page);
  await openTestMode(page);
  const ev = await page.evaluate(() => {
    const g = window.__game;
    g.reset({ p1x: 364, p2x: 404 });
    g.setMeter(0, 1);
    for (const k of [{ down: true }, { down: true, right: true }, { right: true }, { down: true }, { down: true, right: true }, { right: true, hp: true }]) g.input(0, k, 1);
    const types = [];
    for (let i = 0; i < 120; i++) types.push(...g.step(1).events.map(e => e.type));
    return types;
  });
  expect(ev).toContain('super');
  expect(errors).toEqual([]);
});

test('精灵图：清单里登记的角色改用精灵图绘制', async ({ page }) => {
  const c = theme.roster[0];
  const anims = Object.fromEntries(requiredAnims(c).map(k => [k, { frames: [0], fps: 10, loop: true }]));
  const atlas = { image: 'atlas.png', frameW: 64, frameH: 96, columns: 1, anchor: { x: 32, y: 94 }, animations: anims };
  await page.route('**/assets/manifest.json', r => r.fulfill({ json: { [theme.id]: { [c.id]: `assets/${theme.id}/${c.id}/atlas.json` } } }));
  await page.route(`**/assets/${theme.id}/${c.id}/atlas.json`, r => r.fulfill({ json: atlas }));
  await page.route(`**/assets/${theme.id}/${c.id}/atlas.png`, r => r.fulfill({ body: solidPng(64, 96, [0, 255, 0]), contentType: 'image/png' }));
  // 运行时优先请求同名 .webp：这里让它 404，强制回退到上面伪造的 PNG
  await page.route(`**/assets/${theme.id}/${c.id}/atlas.webp`, r => r.fulfill({ status: 404, body: '' }));
  await openTestMode(page);
  await page.waitForFunction((id) => window.__game.renderInfo().atlases.includes(id), c.id);
  await page.evaluate((id) => { window.__game.reset({ p1: id, p1x: 300, p2x: 470 }); window.__game.step(5); }, c.id);
  const cam = await page.evaluate(() => window.__game.renderInfo().camera.x);
  const st = await canvasStats(page, { x: Math.round(300 - cam - 10), y: 200 - 60, w: 20, h: 40 });
  expect(st.mean[1]).toBeGreaterThan(200);
  expect(st.mean[0]).toBeLessThan(60);
});

test('性能：每帧逻辑 + 渲染中位数 < 8ms', async ({ page }) => {
  await openTestMode(page);
  const ms = await page.evaluate(() => { const g = window.__game; g.reset({ p1x: 364, p2x: 404 }); g.bench(60); return g.bench(300); });
  console.log(`每帧中位数 ${ms.toFixed(2)} ms`);
  expect(ms).toBeLessThan(8);
});
