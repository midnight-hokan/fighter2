import { describe, it, expect } from 'vitest';
import theme from '../../src/theme/index.js';
import { exists, sha, pngSize } from './_assets.js';

const S = theme.story;
const scene = (id) => `assets/${theme.id}/scenes/${id}.png`;
const portrait = (c, e) => `assets/${theme.id}/portraits/${c}/${e}.png`;

describe('C2 过场美术', () => {
  it('剧本用到的场景图全部存在（横幅 16:9 左右，宽 ≥ 960）', () => {
    for (const id of Object.keys(S.IMAGES)) {
      expect(exists(scene(id)), scene(id)).toBe(true);
      const { width, height } = pngSize(scene(id));
      expect(width, id).toBeGreaterThanOrEqual(960);
      expect(width / height, `${id} 比例`).toBeGreaterThan(1.5);
      expect(width / height, `${id} 比例`).toBeLessThan(2.0);
    }
  });

  it('场景图互不相同', () => {
    const hs = Object.keys(S.IMAGES).map(id => sha(scene(id)));
    expect(new Set(hs).size).toBe(hs.length);
  });

  it('8 人 × 4 种表情立绘齐全（竖幅，高 ≥ 512），同一人的表情互不相同', () => {
    for (const c of theme.roster) {
      const hs = [];
      for (const e of S.EXPRS) {
        const p = portrait(c.id, e);
        expect(exists(p), p).toBe(true);
        const { width, height } = pngSize(p);
        expect(height, p).toBeGreaterThanOrEqual(512);
        expect(height, `${p} 应为竖幅`).toBeGreaterThan(width);
        hs.push(sha(p));
      }
      expect(new Set(hs).size, `${c.id} 表情重复`).toBe(S.EXPRS.length);
    }
  });
});
