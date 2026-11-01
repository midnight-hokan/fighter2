import { test, expect } from '@playwright/test';
import { trackErrors, openTestMode, canvasStats } from './_util.js';
import theme from '../../src/theme/index.js';

const ready = (page) => page.evaluate(() => window.__game.assetsReady());
const warnings = (page) => { const w = []; page.on('console', (m) => { if (m.type() === 'warning') w.push(m.text()); }); return w; };

test('A2 场景图片全部加载', async ({ page }) => {
  const warns = warnings(page);
  await openTestMode(page);
  await ready(page);
  const loaded = await page.evaluate(() => window.__game.renderInfo().stageImages);
  const srcs = [...new Set(theme.stages.flatMap(s => s.layers.filter(l => l.kind === 'image').map(l => l.src)))];
  expect(srcs.length).toBeGreaterThan(0);
  for (const s of srcs) expect(loaded, s).toContain(s);
  expect(warns.filter(w => /场景图片/.test(w))).toEqual([]);
});
