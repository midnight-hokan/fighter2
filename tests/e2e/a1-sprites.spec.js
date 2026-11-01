import { test, expect } from '@playwright/test';
import { trackErrors, openTestMode, canvasStats } from './_util.js';
import theme from '../../src/theme/index.js';

const ready = (page) => page.evaluate(() => window.__game.assetsReady());
const warnings = (page) => { const w = []; page.on('console', (m) => { if (m.type() === 'warning') w.push(m.text()); }); return w; };

test('A1 精灵图：8 人全部加载成功，画出来互不相同', async ({ page }) => {
  const errors = trackErrors(page);
  const warns = warnings(page);
  await openTestMode(page);
  await ready(page);
  const loaded = await page.evaluate(() => window.__game.renderInfo().atlases);
  expect([...loaded].sort()).toEqual(theme.roster.map(c => c.id).sort());
  const means = [];
  for (const c of theme.roster) {
    await page.evaluate((id) => { const g = window.__game; g.reset({ p1: id, p2: id === 'c01' ? 'c02' : 'c01', p1x: 250, p2x: 520 }); g.step(2); }, c.id);
    const cam = await page.evaluate(() => window.__game.renderInfo().camera.x);
    const st = await canvasStats(page, { x: Math.max(0, Math.round(250 - cam - 40)), y: 90, w: 80, h: 110 });
    expect(st.variance, `${c.id} 角色区域几乎没内容`).toBeGreaterThan(25);
    means.push(st.mean.map(v => Math.round(v / 6)).join(','));
  }
  expect(new Set(means).size, '有角色画出来一模一样').toBe(8);
  expect(warns.filter(w => /精灵图/.test(w))).toEqual([]);
  expect(errors).toEqual([]);
});
