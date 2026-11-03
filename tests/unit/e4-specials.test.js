import { describe, it, expect } from 'vitest';
import { newGame, play, idle, motion, events } from './_fixtures.js';

const FAR = { p1x: 250, p2x: 520 };

describe('E4 必杀技与取消', () => {
  it('飞行道具向前飞、命中扣血后消失', () => {
    const g = newGame(FAR);
    const s = play(g, [...motion(236, 'mp'), [{}, {}, 200]]);
    const xs = s.filter(t => t.projectiles.length).map(t => t.projectiles[0].x);
    expect(xs.at(-1)).toBeGreaterThan(xs[0]);
    expect(s.at(-1).fighters[1].hp).toBe(930);
    expect(s.at(-1).projectiles).toHaveLength(0);
  });

  it('必杀技被防住会削血', () => {
    const g = newGame(FAR);
    const s = play(g, [...motion(236, 'mp').map(([a, , n]) => [a, { right: true }, n]), [{}, { right: true }, 200]]);
    expect(events(s, 'block')).toHaveLength(1);
    expect(s.at(-1).fighters[1].hp).toBe(988);
  });

  it('自己的飞行道具还在场上时不能再发第二个', () => {
    const g = newGame({ p1x: 100, p2x: 440 });
    const s = play(g, [...motion(236, 'lp'), [{}, {}, 50], ...motion(236, 'lp'), [{}, {}, 5]]);
    expect(events(s, 'projectile')).toHaveLength(1);
  });

  it('双方飞行道具相撞会抵消', () => {
    const g = newGame(FAR);
    const p1 = motion(236, 'mp');
    const p2 = motion(236, 'mp', { player: 1, facing: -1 });
    const both = p1.map(([a], i) => [a, p2[i][1], p1[i][2]]);
    const s = play(g, [...both, [{}, {}, 120]]);
    expect(events(s, 'clash')).toHaveLength(1);
    expect(s.at(-1).fighters[0].hp).toBe(1000);
    expect(s.at(-1).fighters[1].hp).toBe(1000);
  });

  it('升龙起手无敌：能穿过对手的攻击打中对手', () => {
    const g = newGame({ p1x: 364, p2x: 404 });
    const s = play(g, [[{ right: true }, { hp: true }, 1], [{ down: true }, {}, 1], [{ down: true, right: true, hp: true }, {}, 1], [{}, {}, 60]]);
    expect(s.some(t => t.fighters[0].move?.id === 'rise')).toBe(true);
    expect(s.at(-1).fighters[0].hp).toBe(1000);
    expect(s.at(-1).fighters[1].hp).toBeLessThan(1000);
  });

  it('上升类必杀会离地，落地后恢复', () => {
    const g = newGame(FAR);
    const s = play(g, [...motion(623, 'hp'), [{}, {}, 80]]);
    expect(Math.max(...s.map(t => t.fighters[0].y))).toBeGreaterThan(20);
    expect(s.at(-1).fighters[0].action).toBe('idle');
  });

  it('取消：可取消的普通技命中后接必杀，必杀立刻出现', () => {
    const g = newGame({ p1x: 364, p2x: 404 });
    const s = play(g, [[{ down: true, mp: true }, {}, 1], [{ down: true }, {}, 4], ...motion(236, 'hp'), [{}, {}, 60]]);
    expect(s.some(t => t.fighters[0].move?.id === 'ball')).toBe(true);
    const hits = events(s, 'hit');
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits[1].combo).toBe(2);
  });

  it('顿帧期间输入的取消也有效（输入缓冲）', () => {
    const g = newGame({ p1x: 364, p2x: 404 });
    const s0 = play(g, [[{ down: true, mp: true }, {}, 1]]);
    let guard = 0;
    while (g.getState().hitstop === 0 && guard++ < 20) s0.push(...idle(g, 1));
    expect(g.getState().hitstop).toBeGreaterThan(0);
    const s = play(g, [[{ down: true }, {}, 1], [{ down: true, right: true }, {}, 1], [{ right: true, hp: true }, {}, 1], [{}, {}, 40]]);
    expect(s.some(t => t.fighters[0].move?.id === 'ball')).toBe(true);
  });

  it('不可取消的普通技（远距离站立重拳）不能取消', () => {
    const g = newGame({ p1x: 340, p2x: 404 });
    const s = play(g, [[{ hp: true }, {}, 1], [{}, {}, 9], ...motion(236, 'hp'), [{}, {}, 3]]);
    const ballFrame = s.findIndex(t => t.fighters[0].move?.id === 'ball');
    expect(ballFrame).toBe(-1);
  });

  it('打空的普通技不能取消（要等收招）', () => {
    const g = newGame({ p1x: 200, p2x: 500 });
    const s = play(g, [[{ down: true, mp: true }, {}, 1], [{ down: true }, {}, 4], ...motion(236, 'hp'), [{}, {}, 3]]);
    expect(s.some(t => t.fighters[0].move?.id === 'ball')).toBe(false);
  });

  it('连段计数：硬直中再次命中算连击', () => {
    const g = newGame({ p1x: 364, p2x: 404 });
    const s = play(g, [[{ down: true, mp: true }, {}, 1], [{ down: true }, {}, 4], ...motion(623, 'hp'), [{}, {}, 60]]);
    expect(s.some(t => t.fighters[0].move?.id === 'rise')).toBe(true);
    expect(Math.max(...events(s, 'hit').map(e => e.combo))).toBeGreaterThanOrEqual(2);
  });
});
