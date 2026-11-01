import { describe, it, expect } from 'vitest';
import { NORMAL_IDS } from '../../src/engine/constants.js';
import { newGame, play, idle, events } from './_fixtures.js';

const CLOSE = { p1x: 364, p2x: 404 };
const btnOf = (id) => id.split('.')[1];

describe('E2 普通技与防御', () => {
  it('18 个普通技都能按出来（站/蹲/跳 × 6 键）', () => {
    for (const id of NORMAL_IDS) {
      const g = newGame({ p1x: 200, p2x: 500 });
      const [stance, b] = id.split('.');
      let s;
      if (stance === 'j') s = play(g, [[{ up: true }, {}, 8], [{ [b]: true }, {}, 1], [{}, {}, 3]]);
      else s = play(g, [[{ [b]: true, down: stance === 'cr' }, {}, 1], [{ down: stance === 'cr' }, {}, 3]]);
      expect(s.some(t => t.fighters[0].move?.id === id), id).toBe(true);
    }
  });

  it('贴身站立技命中：扣血、硬直、命中事件、顿帧', () => {
    const g = newGame(CLOSE);
    const s = play(g, [[{ mp: true }, {}, 1], [{}, {}, 40]]);
    expect(s.at(-1).fighters[1].hp).toBe(940);
    expect(s.some(t => t.fighters[1].action === 'hitstun')).toBe(true);
    expect(events(s, 'hit')[0]).toMatchObject({ attacker: 0, defender: 1, damage: 60 });
    expect(s.some(t => t.hitstop > 0)).toBe(true);
  });

  it('一次出招只命中一次', () => {
    const g = newGame(CLOSE);
    const s = play(g, [[{ hp: true }, {}, 1], [{}, {}, 60]]);
    expect(events(s, 'hit')).toHaveLength(1);
  });

  it('站防挡住中段，普通技不削血', () => {
    const g = newGame(CLOSE);
    const s = play(g, [[{ hp: true }, { right: true }, 1], [{}, { right: true }, 40]]);
    expect(s.at(-1).fighters[1].hp).toBe(1000);
    expect(events(s, 'block')).toHaveLength(1);
    expect(s.some(t => t.fighters[1].action === 'blockstun')).toBe(true);
  });

  it('下段攻击站防挡不住，蹲防可以', () => {
    const stand = newGame(CLOSE);
    const s1 = play(stand, [[{ down: true, mk: true }, { right: true }, 1], [{ down: true }, { right: true }, 40]]);
    expect(s1.at(-1).fighters[1].hp).toBeLessThan(1000);
    const crouch = newGame(CLOSE);
    const s2 = play(crouch, [[{ down: true, mk: true }, { right: true, down: true }, 1], [{ down: true }, { right: true, down: true }, 40]]);
    expect(s2.at(-1).fighters[1].hp).toBe(1000);
    expect(events(s2, 'block')).toHaveLength(1);
  });

  it('跳攻（上段）蹲防挡不住，站防可以', () => {
    const run = (p2) => {
      const g = newGame({ p1x: 280, p2x: 380 });
      const s = play(g, [[{ up: true, right: true }, p2, 4], [{ right: true }, p2, 28], [{ hk: true }, p2, 1], [{}, p2, 40]]);
      return { hp: s.at(-1).fighters[1].hp, blocks: events(s, 'block').length, hits: events(s, 'hit').length };
    };
    const crouch = run({ right: true, down: true });
    const stand = run({ right: true });
    expect(crouch.hits).toBeGreaterThan(0);
    expect(stand.blocks).toBeGreaterThan(0);
    expect(stand.hp).toBe(1000);
  });

  it('不按后不能防御', () => {
    const g = newGame(CLOSE);
    const s = play(g, [[{ hp: true }, { left: true }, 1], [{}, {}, 40]]);
    expect(s.at(-1).fighters[1].hp).toBeLessThan(1000);
  });

  it('重攻击伤害 > 中 > 轻', () => {
    const dmg = (b) => { const g = newGame(CLOSE); return 1000 - play(g, [[{ [b]: true }, {}, 1], [{}, {}, 40]]).at(-1).fighters[1].hp; };
    expect(dmg('hp')).toBeGreaterThan(dmg('mp'));
    expect(dmg('mp')).toBeGreaterThan(dmg('lp'));
  });

  it('命中后对手被推开', () => {
    const g = newGame(CLOSE);
    const d0 = 40;
    const s = play(g, [[{ hp: true }, {}, 1], [{}, {}, 40]]);
    expect(Math.abs(s.at(-1).fighters[1].x - s.at(-1).fighters[0].x)).toBeGreaterThan(d0 + 5);
  });

  it('硬直中不能出招，硬直结束回到 idle', () => {
    const g = newGame(CLOSE);
    play(g, [[{ hp: true }, {}, 1]]);
    let guard = 0;
    while (g.getState().fighters[1].action !== 'hitstun' && guard++ < 40) idle(g, 1);
    const s = play(g, [[{}, { lp: true }, 1]]);
    expect(s[0].fighters[1].action).toBe('hitstun');
    expect(idle(g, 60).at(-1).fighters[1].action).toBe('idle');
  });

  it('出招中不能走动，收招后回到 idle', () => {
    const g = newGame({ p1x: 200, p2x: 500 });
    const s = play(g, [[{ hp: true }, {}, 1], [{ right: true }, {}, 6]]);
    expect(s.at(-1).fighters[0].x).toBe(200);
    expect(idle(g, 40).at(-1).fighters[0].action).toBe('idle');
  });

  it('地面上不能穿过对手，不能走出场地', () => {
    const g = newGame();
    const s = play(g, [[{ right: true }, { left: true }, 300]]);
    for (const t of s) expect(t.fighters[0].x).toBeLessThan(t.fighters[1].x);
    const g2 = newGame();
    const s2 = play(g2, [[{ left: true }, { right: true }, 1200]]);
    expect(s2.at(-1).fighters[0].x).toBeGreaterThanOrEqual(0);
    expect(s2.at(-1).fighters[1].x).toBeLessThanOrEqual(768);
  });

  it('双方距离不超过一屏', () => {
    const g = newGame();
    const s = play(g, [[{ left: true }, { right: true }, 600]]);
    expect(Math.abs(s.at(-1).fighters[1].x - s.at(-1).fighters[0].x)).toBeLessThanOrEqual(384);
  });

  it('跳跃：起跳前有预备帧，之后离地并落回', () => {
    const g = newGame();
    const s = play(g, [[{ up: true }, {}, 1], [{}, {}, 80]]);
    expect(s[0].fighters[0].action).toBe('prejump');
    expect(Math.max(...s.map(t => t.fighters[0].y))).toBeGreaterThan(60);
    expect(s.at(-1).fighters[0].grounded).toBe(true);
  });

  it('越过对手后朝向翻转', () => {
    const g = newGame({ p1x: 370, p2x: 398 });
    const s = play(g, [[{ up: true, right: true }, {}, 2], [{ right: true }, {}, 80]]);
    const [a, b] = s.at(-1).fighters;
    expect(a.x).toBeGreaterThan(b.x);
    expect(a.facing).toBe(-1);
    expect(b.facing).toBe(1);
    void btnOf;
  });
});
