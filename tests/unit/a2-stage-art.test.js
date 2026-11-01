import { describe, it, expect } from 'vitest';
import theme from '../../src/theme/index.js';
import { exists, sha, pngSize } from './_assets.js';

const imageLayers = (s) => (s.layers ?? []).filter(l => l.kind === 'image');

describe('A2 场景美术', () => {
  it('每个场景至少 2 层图片背景，文件存在', () => {
    for (const s of theme.stages) {
      const ls = imageLayers(s);
      expect(ls.length, s.id).toBeGreaterThanOrEqual(2);
      for (const l of ls) expect(exists(l.src), l.src).toBe(true);
    }
  });

  it('背景图尺寸适配 384×224 画面（宽 ≥ 384，高 60–224）', () => {
    for (const s of theme.stages) {
      for (const l of imageLayers(s)) {
        const { width, height } = pngSize(l.src);
        expect(width, l.src).toBeGreaterThanOrEqual(384);
        expect(height, l.src).toBeGreaterThanOrEqual(60);
        expect(height, l.src).toBeLessThanOrEqual(224);
      }
    }
  });

  it('不同场景用不同的图（每个场景至少一张独有的图）', () => {
    const all = theme.stages.map(s => imageLayers(s).map(l => sha(l.src)));
    all.forEach((hs, i) => {
      const others = new Set(all.filter((_, j) => j !== i).flat());
      expect(hs.some(h => !others.has(h)), theme.stages[i].id).toBe(true);
    });
  });
});
