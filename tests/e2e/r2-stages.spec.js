import { test, expect } from '@playwright/test';
import { trackErrors, openTestMode, canvasStats } from './_util.js';

test('每个场景都能正常绘制，画面互不相同，无报错', async ({ page }) => {
  const errors = trackErrors(page);
  await openTestMode(page);
  const n = await page.evaluate(() => window.__game.stageCount());
  expect(n).toBeGreaterThanOrEqual(4);
  const means = [];
  for (let i = 0; i < n; i++) {
    await page.evaluate((k) => { window.__game.reset({}); window.__game.setStage(k); window.__game.step(3); }, i);
    const st = await canvasStats(page, { x: 0, y: 0, w: 384, h: 140 });
    expect(st.variance, `场景 ${i} 太单调`).toBeGreaterThan(20);
    means.push(st.mean.map(v => Math.round(v / 8)).join(','));
  }
  expect(new Set(means).size).toBe(n);
  expect(errors).toEqual([]);
});

test('对手主场：对战场景由对手角色的 stage 决定', async ({ page }) => {
  await openTestMode(page);
  const pairs = await page.evaluate(async () => {
    const ids = window.__game.roster();
    return ids.map(id => { window.__game.reset({ p2: id }); return [id, window.__game.renderInfo().stage]; });
  });
  const { default: theme } = await import('../../src/theme/index.js');
  for (const [id, stage] of pairs) expect(stage, id).toBe(theme.roster.find(c => c.id === id).stage);
});
