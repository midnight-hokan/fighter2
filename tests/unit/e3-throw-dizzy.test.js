import { describe, it, expect } from 'vitest';
import { FXG, FX, newGame, play, idle, events } from './_fixtures.js';

const CLOSE = { p1x: 364, p2x: 400 };

describe('E3 投技、晕眩、倒地', () => {
  it('近身 → + 重拳 = 投技：扣血、对手倒地', () => {
    const g = newGame(CLOSE);
    const s = play(g, [[{ right: true, hp: true }, {}, 1], [{}, {}, 80]]);
    const t = events(s, 'throw');
    expect(t).toHaveLength(1);
    expect(t[0].damage).toBe(120);
    expect(s.at(-1).fighters[1].hp).toBe(880);
    expect(s.some(x => x.fighters[1].action === 'knockdown')).toBe(true);
  });

  it('← + 重脚 = 后投：把对手扔到身后', () => {
    const g = newGame(CLOSE);
    const s = play(g, [[{ left: true, hk: true }, {}, 1], [{}, {}, 80]]);
    expect(events(s, 'throw')[0].back).toBe(true);
    expect(s.at(-1).fighters[1].x).toBeLessThan(s.at(-1).fighters[0].x);
  });

  it('距离太远时 → + 重拳 出的是站立重拳', () => {
    const g = newGame({ p1x: 300, p2x: 420 });
    const s = play(g, [[{ right: true, hp: true }, {}, 1], [{}, {}, 5]]);
    expect(events(s, 'throw')).toHaveLength(0);
    expect(s.some(x => x.fighters[0].move?.id === 'st.hp')).toBe(true);
  });

  it('硬直中、跳起中的对手不能被投', () => {
    const g = newGame(CLOSE);
    play(g, [[{ lp: true }, {}, 1]]);
    let guard = 0;
    while (g.getState().fighters[1].action !== 'hitstun' && guard++ < 30) idle(g, 1);
    const s = play(g, [[{}, {}, 10], [{ right: true, hp: true }, {}, 1], [{}, {}, 5]]);
    expect(events(s, 'throw')).toHaveLength(0);
    const g2 = newGame(CLOSE);
    const s2 = play(g2, [[{}, { up: true }, 6], [{ right: true, hp: true }, {}, 1], [{}, {}, 5]]);
    expect(events(s2, 'throw')).toHaveLength(0);
  });

  it('倒地期间无敌，起身后才能再被打到', () => {
    const g = newGame(CLOSE);
    play(g, [[{ right: true, hp: true }, {}, 1]]);
    let guard = 0;
    while (g.getState().fighters[1].action !== 'knockdown' && guard++ < 80) idle(g, 1);
    expect(g.getState().fighters[1].invulnerable).toBe(true);
    g.debug.setX(0, g.getState().fighters[1].x - 30);
    const s = play(g, [[{ down: true, lk: true }, {}, 1], [{}, {}, 10]]);
    expect(events(s, 'hit')).toHaveLength(0);
  });

  it('扫堂腿（cr.hk）命中会击倒', () => {
    const g = newGame(CLOSE);
    const s = play(g, [[{ down: true, hk: true }, {}, 1], [{}, {}, 60]]);
    expect(events(s, 'knockdown').length).toBeGreaterThan(0);
  });

  it('空中被打中会被打落并倒地', () => {
    const g = newGame({ p1x: 360, p2x: 420 });
    const s = play(g, [[{ hp: true }, { up: true }, 1], [{}, { up: true }, 7], [{}, {}, 80]]);
    expect(events(s, 'hit').length).toBeGreaterThan(0);
    expect(s.some(x => x.fighters[1].action === 'airhit')).toBe(true);
    expect(events(s, 'knockdown').length).toBeGreaterThan(0);
  });

  it('晕眩：晕眩值超过上限，硬直结束后进入晕眩', () => {
    const g = newGame(CLOSE);
    g.debug.setStun(1, 95);
    const s = play(g, [[{ mp: true }, {}, 1], [{}, {}, 60]]);
    expect(s.some(x => x.fighters[1].action === 'dizzy')).toBe(true);
    expect(events(s, 'dizzy')).toHaveLength(1);
  });

  it('晕眩中被打中立刻解除，晕眩值清零', () => {
    const g = newGame(CLOSE);
    g.debug.setStun(1, 95);
    play(g, [[{ mp: true }, {}, 1]]);
    let guard = 0;
    while (g.getState().fighters[1].action !== 'dizzy' && guard++ < 60) idle(g, 1);
    g.debug.setX(0, g.getState().fighters[1].x - 40);
    play(g, [[{ lp: true }, {}, 1], [{}, {}, 40]]);
    const f = g.getState().fighters[1];
    expect(f.action).not.toBe('dizzy');
    expect(f.stun).toBeLessThan(10);
  });

  it('晕眩值会随时间自然下降', () => {
    const g = newGame({ p1x: 200, p2x: 500 });
    g.debug.setStun(1, 60);
    idle(g, 300);
    expect(g.getState().fighters[1].stun).toBeLessThan(60);
  });

  it('360 指令投：范围内抓住，范围外落空', () => {
    const near = newGame({ characters: [FXG, FX], p1x: 370, p2x: 410 });
    const s1 = play(near, [[{ right: true }, {}, 1], [{ down: true }, {}, 1], [{ left: true }, {}, 1], [{ up: true, hp: true }, {}, 1], [{}, {}, 60]]);
    expect(events(s1, 'throw').some(e => e.command && e.damage === 200)).toBe(true);
    const far = newGame({ characters: [FXG, FX], p1x: 300, p2x: 420 });
    const s2 = play(far, [[{ right: true }, {}, 1], [{ down: true }, {}, 1], [{ left: true }, {}, 1], [{ up: true, hp: true }, {}, 1], [{}, {}, 60]]);
    expect(events(s2, 'throw')).toHaveLength(0);
    expect(s2.some(x => x.fighters[0].move?.id === 'pile')).toBe(true);
  });
});
