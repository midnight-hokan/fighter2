import { test, expect } from '@playwright/test';
import { trackErrors, openTestMode, canvasStats } from './_util.js';
import theme from '../../src/theme/index.js';

const ready = (page) => page.evaluate(() => window.__game.assetsReady());
const warnings = (page) => { const w = []; page.on('console', (m) => { if (m.type() === 'warning') w.push(m.text()); }); return w; };

test('A3 音频文件全部能解码', async ({ page }) => {
  await openTestMode(page);
  await ready(page);
  const info = await page.evaluate(() => window.__game.audioFiles());
  expect(info.failed).toEqual({});
  const want = [theme.audio?.title, ...Object.values(theme.audio?.sfx ?? {}), ...theme.stages.map(s => s.bgm?.file)].filter(Boolean);
  expect(want.length).toBeGreaterThan(0);
  for (const f of want) expect(info.loaded, f).toContain(f);
});
