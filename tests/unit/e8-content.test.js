import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import theme from '../../src/theme/index.js';
import { validateCharacter } from '../../src/engine/validate.js';
import { prepareCharacter } from '../../src/engine/character.js';
import { validateAtlas, requiredAnims } from '../../src/render/atlas.js';
import { POSES } from '../../src/render/poses.js';
import { SOUNDS, composeBgm } from '../../src/render/audio.js';
import { prettyInput, MODES } from '../../src/ui/menus.js';
import { FX } from './_fixtures.js';

describe('E8 数据格式、主题包与渲染支撑', () => {
  it('引擎层不依赖 DOM、不使用 Math 自带随机数', () => {
    for (const f of readdirSync('src/engine')) {
      const src = readFileSync(`src/engine/${f}`, 'utf8');
      expect(src, f).not.toMatch(/\b(window|document)\./);
      expect(src, f).not.toMatch(/Math\.random/);
    }
  });

  it('示例角色 c01 数据合格', () => {
    expect(validateCharacter(theme.roster[0])).toEqual([]);
  });

  it('校验器能发现问题', () => {
    const bad = JSON.parse(JSON.stringify(FX));
    delete bad.normals['st.lp'];
    bad.specials[0].input = '23X';
    bad.stats.health = 5000;
    const errs = validateCharacter(bad);
    expect(errs.some(e => e.includes('st.lp'))).toBe(true);
    expect(errs.some(e => e.includes('23X') || e.includes('无法解析'))).toBe(true);
    expect(errs.some(e => e.includes('health'))).toBe(true);
  });

  it('主题包结构完整：标题、8 人名单、至少 1 个场景', () => {
    expect(theme.title).toBeTruthy();
    expect(theme.roster).toHaveLength(8);
    expect(new Set(theme.roster.map(c => c.id)).size).toBe(8);
    expect(theme.stages.length).toBeGreaterThanOrEqual(1);
    for (const c of theme.roster) expect(() => prepareCharacter(c)).not.toThrow();
  });

  it('精灵图校验：合格的通过，缺动画和越界的报错', () => {
    const anims = Object.fromEntries(requiredAnims(FX).map((k, i) => [k, { frames: [i % 40], fps: 10, loop: true }]));
    const good = { image: 'atlas.png', frameW: 128, frameH: 128, columns: 8, anchor: { x: 64, y: 124 }, animations: anims };
    expect(validateAtlas(good, FX, { width: 1024, height: 640 })).toEqual([]);
    const missing = { ...good, animations: { ...anims } };
    delete missing.animations['st.lp'];
    expect(validateAtlas(missing, FX, { width: 1024, height: 640 }).some(e => e.includes('st.lp'))).toBe(true);
    const oob = { ...good, animations: { ...anims, idle: { frames: [999] } } };
    expect(validateAtlas(oob, FX, { width: 1024, height: 640 }).some(e => e.includes('越界'))).toBe(true);
    expect(validateAtlas(good, FX, { width: 1000, height: 640 }).length).toBeGreaterThan(0);
  });

  it('占位小人的姿态覆盖所有状态', () => {
    for (const k of ['idle', 'walkf', 'walkb', 'crouch', 'prejump', 'jump', 'blockstun', 'crblock', 'hitstun', 'airhit', 'knockdown', 'dizzy', 'roll', 'maxstart', 'ko', 'win']) {
      expect(POSES, k).toHaveProperty(k);
    }
  });

  it('音效齐全，背景音乐能生成', () => {
    for (const k of ['hit', 'block', 'throw', 'projectile', 'super', 'max', 'stock', 'ko', 'round', 'roll', 'gc']) expect(typeof SOUNDS[k], k).toBe('function');
    const song = composeBgm({ tempo: 140, key: 'D', scale: 'minor', seed: 3 });
    expect(song.bass.length).toBe(32);
    expect(song.lead.some(Boolean)).toBe(true);
  });

  it('出招表把指令转成箭头', () => {
    expect(prettyInput('236P')).toBe('↓↘→ + 拳');
    expect(prettyInput('[4]6K')).toBe('←蓄 → + 脚');
    expect(prettyInput('360P')).toContain('转一圈');
  });

  it('模式齐全：对电脑三档、双人、训练', () => {
    const ids = MODES.map(m => m.id);
    for (const m of ['cpu-easy', 'cpu-normal', 'cpu-hard', '2p', 'training']) expect(ids).toContain(m);
  });
});
