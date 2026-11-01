import { describe, it, expect } from 'vitest';
import theme from '../../src/theme/index.js';
import { exists, size, sha } from './_assets.js';

const AUDIO = /\.(ogg|mp3)$/;
const SFX = ['hit', 'block', 'throw', 'projectile', 'super', 'ko', 'round', 'knockdown'];

describe('A3 音乐音效', () => {
  it('每个场景有自己的背景音乐文件（ogg/mp3，200KB–8MB，互不相同）', () => {
    const hashes = [];
    for (const s of theme.stages) {
      const f = s.bgm?.file;
      expect(f, s.id).toMatch(AUDIO);
      expect(exists(f), f).toBe(true);
      expect(size(f), f).toBeGreaterThan(200 * 1024);
      expect(size(f), f).toBeLessThan(8 * 1024 * 1024);
      hashes.push(sha(f));
    }
    expect(new Set(hashes).size).toBe(theme.stages.length);
  });

  it('有标题音乐', () => {
    const f = theme.audio?.title;
    expect(f).toMatch(AUDIO);
    expect(exists(f), f).toBe(true);
    expect(size(f)).toBeGreaterThan(100 * 1024);
  });

  it('主要音效都有文件（每个 ≤ 600KB）', () => {
    for (const k of SFX) {
      const f = theme.audio?.sfx?.[k];
      expect(f, k).toMatch(AUDIO);
      expect(exists(f), f).toBe(true);
      expect(size(f), f).toBeLessThan(600 * 1024);
    }
  });
});
