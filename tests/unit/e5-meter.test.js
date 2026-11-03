import { describe, it, expect } from 'vitest';
import { METER, ROUND } from '../../src/engine/constants.js';
import { newGame, play, idle, motion, events } from './_fixtures.js';

const CLOSE = { p1x: 364, p2x: 404 };
const superInput = (b = 'hp') => motion(236236, b, { hold: 1 });

describe('E5 气槽（拳皇97 进阶模式）', () => {
  it('命中比被防住攒的气多，挨打的一方也会攒气', () => {
    const hit = newGame(CLOSE);
    const sh = play(hit, [[{ mp: true }, {}, 1], [{}, {}, 30]]);
    const blk = newGame(CLOSE);
    const sb = play(blk, [[{ mp: true }, { right: true }, 1], [{}, { right: true }, 30]]);
    expect(sh.at(-1).fighters[0].meter.gauge).toBeGreaterThan(sb.at(-1).fighters[0].meter.gauge);
    expect(sb.at(-1).fighters[0].meter.gauge).toBeGreaterThan(0);
    expect(sh.at(-1).fighters[1].meter.gauge).toBeGreaterThan(0);
  });

  it('气槽攒满变成 1 颗豆，触发 stock 事件', () => {
    const g = newGame(CLOSE);
    g.debug.setMeter(0, 0, METER.perStock - 2);
    const s = play(g, [[{ mp: true }, {}, 1], [{}, {}, 20]]);
    expect(s.at(-1).fighters[0].meter.stocks).toBe(1);
    expect(events(s, 'stock')).toHaveLength(1);
  });

  it('最多存 3 颗豆，存满后气槽不再增长', () => {
    const g = newGame(CLOSE);
    g.debug.setMeter(0, METER.maxStocks, 0);
    const s = play(g, [[{ mp: true }, {}, 1], [{}, {}, 20]]);
    expect(s.at(-1).fighters[0].meter.stocks).toBe(3);
    expect(s.at(-1).fighters[0].meter.gauge).toBe(0);
  });

  it('没有豆时超必杀指令无效', () => {
    const g = newGame(CLOSE);
    const s = play(g, [...superInput(), [{}, {}, 40]]);
    expect(events(s, 'super')).toHaveLength(0);
  });

  it('超必杀：消耗 1 颗豆、有暗屏停顿、命中大伤害', () => {
    const g = newGame(CLOSE);
    g.debug.setMeter(0, 2);
    const s = play(g, [...superInput(), [{}, {}, 120]]);
    expect(events(s, 'super')).toHaveLength(1);
    expect(events(s, 'super')[0].sdm).toBe(false);
    expect(s.at(-1).fighters[0].meter.stocks).toBe(1);
    expect(s.some(t => t.freeze > 0)).toBe(true);
    expect(s.at(-1).fighters[1].hp).toBe(700);
  });

  it('爆气：A+B+C（轻拳+轻脚+重拳）同按，消耗 1 颗豆，进入 MAX 状态并计时', () => {
    const g = newGame({ p1x: 200, p2x: 500 });
    g.debug.setMeter(0, 2);
    const s = play(g, [[{ lp: true, lk: true, hp: true }, {}, 1], [{}, {}, 30]]);
    expect(events(s, 'max')).toHaveLength(1);
    expect(s.at(-1).fighters[0].meter.stocks).toBe(1);
    expect(s.at(-1).fighters[0].meter.max).toBeGreaterThan(0);
    const end = idle(g, METER.maxModeFrames);
    expect(end.at(-1).fighters[0].meter.max).toBe(0);
    expect(events(end, 'maxend')).toHaveLength(1);
  });

  it('爆气按键有 3 帧宽容（先按的轻拳会被取消）', () => {
    const g = newGame({ p1x: 200, p2x: 500 });
    g.debug.setMeter(0, 1);
    const s = play(g, [[{ lp: true }, {}, 1], [{ lp: true, hp: true }, {}, 1], [{ lp: true, lk: true, hp: true }, {}, 1], [{}, {}, 10]]);
    expect(events(s, 'max')).toHaveLength(1);
  });

  it('爆气期间伤害提升，且气槽不增长', () => {
    const normal = newGame(CLOSE);
    const n = play(normal, [[{ mp: true }, {}, 1], [{}, {}, 30]]).at(-1).fighters[1].hp;
    const g = newGame({ p1x: 364, p2x: 404 });
    g.debug.setMeter(0, 1);
    play(g, [[{ lp: true, lk: true, hp: true }, {}, 1], [{}, {}, 25]]);
    g.debug.setX(0, g.getState().fighters[1].x - 40);
    const before = g.getState().fighters[0].meter.gauge;
    const m = play(g, [[{ mp: true }, {}, 1], [{}, {}, 30]]).at(-1);
    expect(1000 - m.fighters[1].hp).toBeGreaterThan(1000 - n);
    expect(m.fighters[0].meter.gauge).toBe(before);
  });

  it('MAX 超必杀：爆气中输入超必杀，再消耗 1 豆，结束爆气，伤害更高', () => {
    const g = newGame(CLOSE);
    g.debug.setMeter(0, 2);
    play(g, [[{ lp: true, lk: true, hp: true }, {}, 1], [{}, {}, 25]]);
    g.debug.setX(0, g.getState().fighters[1].x - 40);
    const s = play(g, [...superInput(), [{}, {}, 120]]);
    const sup = events(s, 'super');
    expect(sup).toHaveLength(1);
    expect(sup[0].sdm).toBe(true);
    expect(s.at(-1).fighters[0].meter.stocks).toBe(0);
    expect(s.at(-1).fighters[0].meter.max).toBe(0);
    expect(1000 - s.at(-1).fighters[1].hp).toBeGreaterThan(300);
  });

  it('紧急回避：轻拳+轻脚，不耗豆，前半段无敌，可穿过对手', () => {
    const g = newGame({ p1x: 340, p2x: 400 });
    const s = play(g, [[{ lp: true, lk: true }, {}, 1], [{}, {}, 30]]);
    expect(events(s, 'roll')).toHaveLength(1);
    expect(s.some(t => t.fighters[0].invulnerable)).toBe(true);
    expect(s.at(-1).fighters[0].x).toBeGreaterThan(s.at(-1).fighters[1].x);
    expect(s.at(-1).fighters[0].meter.stocks).toBe(0);
  });

  it('防御反击：防御硬直中 重拳+重脚，耗 1 豆，打倒对手', () => {
    const g = newGame(CLOSE);
    g.debug.setMeter(1, 1);
    const s = play(g, [[{ hp: true }, { right: true }, 1], [{}, { right: true }, 12], [{}, { hp: true, hk: true }, 1], [{}, {}, 80]]);
    expect(events(s, 'gc').some(e => e.gcType === 'blowback' && e.player === 1)).toBe(true);
    expect(s.at(-1).fighters[1].meter.stocks).toBe(0);
    expect(events(s, 'hit').some(e => e.attacker === 1)).toBe(true);
    expect(events(s, 'knockdown').length).toBeGreaterThan(0);
  });

  it('防御回避：防御硬直中 轻拳+轻脚，耗 1 豆，翻滚脱身', () => {
    const g = newGame(CLOSE);
    g.debug.setMeter(1, 1);
    const s = play(g, [[{ hp: true }, { right: true }, 1], [{}, { right: true }, 12], [{}, { lp: true, lk: true }, 1], [{}, {}, 30]]);
    expect(events(s, 'gc').some(e => e.gcType === 'roll' && e.player === 1)).toBe(true);
    expect(s.some(t => t.fighters[1].action === 'roll')).toBe(true);
    expect(s.at(-1).fighters[1].meter.stocks).toBe(0);
  });

  it('没有豆时防御反击无效', () => {
    const g = newGame(CLOSE);
    const s = play(g, [[{ hp: true }, { right: true }, 1], [{}, { right: true }, 12], [{}, { hp: true, hk: true }, 1], [{}, {}, 30]]);
    expect(events(s, 'gc')).toHaveLength(0);
  });

  it('豆跨回合保留，爆气在回合结束时取消', () => {
    const g = newGame({ p1x: 200, p2x: 500 });
    g.debug.setMeter(0, 3);
    play(g, [[{ lp: true, lk: true, hp: true }, {}, 1], [{}, {}, 25]]);
    g.debug.setHp(1, 0);
    idle(g, 1);
    expect(g.getState().fighters[0].meter.max).toBe(0);
    idle(g, ROUND.endDelayFrames + 5);
    const st = g.getState();
    expect(st.round.number).toBe(2);
    expect(st.fighters[0].meter.stocks).toBe(2);
  });
});
