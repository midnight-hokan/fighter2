import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import theme from '../../src/theme/index.js';
import { validateAtlas } from '../../src/render/atlas.js';
import { pub, exists, size, sha, imageSize } from './_assets.js';

const manifest = () => JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));

describe('A1 角色精灵图', () => {
  it('manifest 为 8 名角色全部登记了精灵图', () => {
    const m = manifest()[theme.id] ?? {};
    for (const c of theme.roster) expect(m, c.id).toHaveProperty(c.id);
  });

  it('每张图集都通过校验（动画齐全、帧号不越界、尺寸匹配）', () => {
    const m = manifest()[theme.id];
    for (const c of theme.roster) {
      const path = m[c.id];
      expect(existsSync(pub(path)), path).toBe(true);
      const json = JSON.parse(readFileSync(pub(path), 'utf8'));
      const img = path.slice(0, path.lastIndexOf('/') + 1) + json.image;
      expect(exists(img), img).toBe(true);
      expect(validateAtlas(json, c, imageSize(img)), c.id).toEqual([]);  // V2 起图集可以是 WebP
      expect(json.frameH, `${c.id} 单帧太小`).toBeGreaterThanOrEqual(96);
      expect(size(img), `${c.id} 图集超过 8MB`).toBeLessThan(8 * 1024 * 1024);
    }
  });

  it('8 张图集互不相同（不能复制同一张图换色凑数）', () => {
    const m = manifest()[theme.id];
    const hashes = theme.roster.map(c => {
      const path = m[c.id];
      const json = JSON.parse(readFileSync(pub(path), 'utf8'));
      return sha(path.slice(0, path.lastIndexOf('/') + 1) + json.image);
    });
    expect(new Set(hashes).size).toBe(8);
  });

  it('攻击动画至少 2 帧，待机和走路至少 4 帧', () => {
    const m = manifest()[theme.id];
    for (const c of theme.roster) {
      const json = JSON.parse(readFileSync(pub(m[c.id]), 'utf8'));
      for (const k of ['idle', 'walkf', 'walkb']) expect(json.animations[k].frames.length, `${c.id} ${k}`).toBeGreaterThanOrEqual(4);
      for (const k of [...Object.keys(c.normals), ...c.specials.map(s => s.id), ...c.supers.map(s => s.id)]) {
        expect(json.animations[k].frames.length, `${c.id} ${k}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
