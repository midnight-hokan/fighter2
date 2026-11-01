import { describe, it, expect } from 'vitest';
import theme from '../../src/theme/index.js';
import { LAYER_KINDS } from '../../src/render/stage.js';
import { composeBgm } from '../../src/render/audio.js';

const HEX = /^#[0-9a-f]{6}$/i;

describe('R2 场景与音乐', () => {
  it('至少 4 个场景，id 和名字不重复', () => {
    expect(theme.stages.length).toBeGreaterThanOrEqual(4);
    expect(new Set(theme.stages.map(s => s.id)).size).toBe(theme.stages.length);
    expect(new Set(theme.stages.map(s => s.name)).size).toBe(theme.stages.length);
  });

  it('每个场景：天空两色、地面配色、至少 3 个图层且图层类型都存在', () => {
    for (const s of theme.stages) {
      expect(s.sky, s.id).toHaveLength(2);
      for (const c of s.sky) expect(c, s.id).toMatch(HEX);
      expect(s.floor.color).toMatch(HEX);
      expect(s.floor.line).toMatch(HEX);
      expect(s.layers.length, s.id).toBeGreaterThanOrEqual(3);
      for (const l of s.layers) expect(LAYER_KINDS, `${s.id} 图层 ${l.kind}`).toHaveProperty(l.kind);
    }
  });

  it('场景之间配色有明显区别', () => {
    const keys = theme.stages.map(s => `${s.sky.join()}|${s.floor.color}`);
    expect(new Set(keys).size).toBe(theme.stages.length);
  });

  it('每个场景都有自己的背景音乐（速度 90–180，参数互不相同）', () => {
    const sigs = new Set();
    for (const s of theme.stages) {
      expect(s.bgm, s.id).toBeTruthy();
      expect(s.bgm.tempo).toBeGreaterThanOrEqual(90);
      expect(s.bgm.tempo).toBeLessThanOrEqual(180);
      const song = composeBgm(s.bgm);
      expect(song.bass.length).toBeGreaterThan(0);
      sigs.add(JSON.stringify(s.bgm));
    }
    expect(sigs.size).toBe(theme.stages.length);
  });

  it('每名角色都有主场（stage 字段指向存在的场景），至少用到 4 个不同场景', () => {
    const ids = new Set(theme.stages.map(s => s.id));
    for (const c of theme.roster) expect(ids.has(c.stage), `${c.id} 的 stage`).toBe(true);
    expect(new Set(theme.roster.map(c => c.stage)).size).toBeGreaterThanOrEqual(4);
  });
});
