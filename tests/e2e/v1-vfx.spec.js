import { test, expect } from '@playwright/test';
import { trackErrors, openTestMode, canvasStats } from './_util.js';
import theme from '../../src/theme/index.js';

// V1 华丽演出：高清画布、打击感（震屏/推镜/光爆火花）、超必杀切入、残影、扬尘、KO 演出、播报员

test('高清画布：至少 2 倍绘制，逻辑尺寸仍是 384×224，画面不是黑屏', async ({ page }) => {
  const errors = trackErrors(page);
  await openTestMode(page);
  const info = await page.evaluate(() => { window.__game.step(5); return window.__game.renderInfo(); });
  expect(info.renderScale).toBeGreaterThanOrEqual(2);
  expect(info.canvas).toEqual({ w: 384 * info.renderScale, h: 224 * info.renderScale });
  const st = await canvasStats(page);
  expect(st.variance).toBeGreaterThan(30);
  expect(errors).toEqual([]);
});

test('重击：震屏、镜头推近、光爆和火花', async ({ page }) => {
  const errors = trackErrors(page);
  await openTestMode(page);
  const r = await page.evaluate(() => {
    const g = window.__game;
    g.reset({ p1x: 364, p2x: 404 });
    g.input(0, { hp: true }, 1);
    let kinds = {};
    for (let i = 0; i < 20; i++) { g.step(1); const k = g.renderInfo().effectKinds; for (const [a, n] of Object.entries(k)) kinds[a] = Math.max(kinds[a] ?? 0, n); }
    return { kinds, stats: g.renderInfo().stats, hit: g.getState().fighters[1].hp < g.getState().fighters[1].maxHp };
  });
  expect(r.hit).toBe(true);
  expect(r.kinds.glow).toBeGreaterThan(0);
  expect(r.kinds.spark).toBeGreaterThan(0);
  expect(r.stats.maxShake).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('超必杀：切入演出显示本人立绘和招式名，命中时镜头推近，有残影', async ({ page }) => {
  const errors = trackErrors(page);
  await openTestMode(page);
  const id = theme.roster[0].id;
  const superName = theme.roster[0].supers[0].name;
  const r = await page.evaluate(([cid]) => {
    const g = window.__game;
    g.reset({ p1: cid, p2: cid, p1x: 364, p2x: 404 });
    g.setMeter(0, 1);
    for (const k of [{ down: true }, { down: true, right: true }, { right: true }, { down: true }, { down: true, right: true }, { right: true, hp: true }]) g.input(0, k, 1);
    let cutin = null;
    for (let i = 0; i < 20 && !cutin; i++) { g.step(1); cutin = g.renderInfo().cutin; }
    g.step(90);
    const after = g.renderInfo();
    return { cutin, stats: after.stats, cleared: after.cutin === null };
  }, [id]);
  expect(r.cutin).toEqual({ player: 0, charId: id, name: superName });
  expect(r.cleared).toBe(true);
  expect(r.stats.cutins).toBe(1);
  expect(r.stats.afterimages).toBeGreaterThan(0);
  expect(r.stats.maxZoom).toBeGreaterThan(1.05);
  expect(errors).toEqual([]);
});

test('落地扬尘：跳起落地后出现扬尘特效', async ({ page }) => {
  await openTestMode(page);
  const dust = await page.evaluate(() => {
    const g = window.__game;
    g.reset({ p1x: 200, p2x: 400 });
    g.input(0, { up: true }, 2);
    let n = 0;
    for (let i = 0; i < 80; i++) { g.step(1); n = Math.max(n, g.renderInfo().effectKinds.dust ?? 0); }
    return n;
  });
  expect(dust).toBeGreaterThan(0);
});

test('KO 演出与播报：KO 触发放射光和播报员 ko，下一回合播报 round2 + fight', async ({ page }) => {
  const errors = trackErrors(page);
  await openTestMode(page);
  const r = await page.evaluate(() => {
    const g = window.__game;
    g.reset({ p1x: 364, p2x: 404 });
    g.setHp(1, 1);
    g.input(0, { hp: true }, 1);
    let ko = false;
    for (let i = 0; i < 30; i++) { g.step(1); ko = ko || g.renderInfo().ko; }
    g.step(400);
    return { ko, kos: g.renderInfo().stats.kos, ann: g.audioInfo().announcer };
  });
  expect(r.ko).toBe(true);
  expect(r.kos).toBe(1);
  expect(r.ann).toContain('ko');
  expect(r.ann).toContain('round2');
  expect(r.ann).toContain('fight');
  expect(errors).toEqual([]);
});

test('飞行道具用角色随身物品：林啸的矿灯光弹画成矿灯帽，不是通用光团', async ({ page }) => {
  const errors = trackErrors(page);
  await openTestMode(page);
  const n = await page.evaluate(() => {
    const g = window.__game;
    g.reset({ p1: 'c01', p2: 'c02', p1x: 200, p2x: 500 });
    for (const k of [{ down: true }, { down: true, right: true }, { right: true, lp: true }]) g.input(0, k, 1);
    let seen = 0;
    for (let i = 0; i < 40; i++) { const st = g.step(1); seen = Math.max(seen, st.projectiles.length); }
    return { seen, item: g.renderInfo().stats.itemProjectiles ?? 0 };
  });
  expect(n.seen).toBeGreaterThan(0);
  expect(n.item).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('暂停页有 背景音乐/音效/语音 三个音量滑块，调整后生效并记住', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await page.keyboard.press('Enter');
  await page.getByTestId('mode-cpu-normal').click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.isRunning());
  await page.keyboard.press('Escape');
  for (const k of ['bgm', 'sfx', 'voice']) await expect(page.getByTestId(`vol-${k}`)).toBeVisible();
  await page.getByTestId('vol-voice').fill('20');
  expect((await page.evaluate(() => window.__game.audioFiles().volume)).voice).toBeCloseTo(0.2, 2);
  await page.reload();
  await page.waitForFunction(() => !!window.__game);
  expect((await page.evaluate(() => window.__game.audioFiles().volume)).voice).toBeCloseTo(0.2, 2);
  expect(errors).toEqual([]);
});
