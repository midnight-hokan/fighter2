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

test('A1 抠图质量：每帧身体不透明（没有被抠成半透明/只剩安全帽）', async ({ page }) => {
  await openTestMode(page);
  await page.evaluate(() => window.__game.assetsReady());
  const stats = await page.evaluate(async () => {
    const man = await (await fetch('assets/manifest.json')).json();
    const out = {};
    for (const [id, path] of Object.entries(Object.values(man)[0] ?? {})) {
      const j = await (await fetch(path)).json();
      const img = new Image();
      img.src = path.slice(0, path.lastIndexOf('/') + 1) + j.image;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const counts = [];
      const all = new Set(Object.values(j.animations).flatMap(a => a.frames));
      for (const f of all) {
        const x = (f % j.columns) * j.frameW, y = Math.floor(f / j.columns) * j.frameH;
        const d = g.getImageData(x, y, j.frameW, j.frameH).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 200) n++;
        counts.push(n / (j.frameW * j.frameH));
      }
      counts.sort((a, b) => a - b);
      out[id] = { median: counts[Math.floor(counts.length / 2)], p10: counts[Math.floor(counts.length / 10)] };
    }
    return out;
  });
  // 128×128 帧里一个身高约 90px 的完整人物，实心像素一般占 12% 以上；只剩安全帽和手套时不到 2%
  for (const [id, s] of Object.entries(stats)) {
    expect(s.median, `${id} 帧的中位不透明面积太小：身体被抠掉了`).toBeGreaterThan(0.07);
    expect(s.p10, `${id} 有一成以上的帧几乎是空的`).toBeGreaterThan(0.035);
  }
});
