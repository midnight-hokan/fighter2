import { describe, it, expect } from 'vitest';
import { InputHistory, parseCommand, matchCommand, normalizeInput } from '../../src/engine/input.js';
import { FX, FXC, FXG, newGame, play, idle, motion, events } from './_fixtures.js';

const FAR = { p1x: 250, p2x: 520 };

function feed(seq, facing = 1) {
  const h = new InputHistory();
  for (const raw of seq) h.push(normalizeInput(raw), facing);
  return h;
}

describe('E1 输入与指令', () => {
  it('指令解析：搓招、蓄力、360、具体按键', () => {
    expect(parseCommand('236P')).toMatchObject({ type: 'motion', dirs: [2, 3, 6], button: 'P' });
    expect(parseCommand('[4]6K')).toMatchObject({ type: 'charge', from: 4, to: 6, button: 'K' });
    expect(parseCommand('360P').type).toBe('360');
    expect(parseCommand('236236HP')).toMatchObject({ dirs: [2, 3, 6, 2, 3, 6], button: 'HP' });
    expect(() => parseCommand('abc')).toThrow();
  });

  it('↓↘→+拳：在时限内匹配成功，返回按下的键', () => {
    const h = feed([{ down: true }, { down: true, right: true }, { right: true, mp: true }]);
    expect(matchCommand(h, parseCommand('236P'))).toBe('mp');
  });

  it('方向之间间隔太久不匹配', () => {
    const seq = [{ down: true }, ...Array(15).fill({}), { down: true, right: true }, { right: true, lp: true }];
    expect(matchCommand(feed(seq), parseCommand('236P'))).toBe(null);
  });

  it('朝左时方向镜像', () => {
    const h = feed([{ down: true }, { down: true, left: true }, { left: true, hp: true }], -1);
    expect(matchCommand(h, parseCommand('236P'))).toBe('hp');
  });

  it('蓄力：按后 40 帧以上再按前+拳才成立，蓄力不足不成立', () => {
    const ok = feed([...Array(45).fill({ left: true }), { right: true, lp: true }]);
    const short = feed([...Array(20).fill({ left: true }), { right: true, lp: true }]);
    expect(matchCommand(ok, parseCommand('[4]6P'))).toBe('lp');
    expect(matchCommand(short, parseCommand('[4]6P'))).toBe(null);
  });

  it('下蓄上：[2]8K', () => {
    const h = feed([...Array(45).fill({ down: true }), { up: true, hk: true }]);
    expect(matchCommand(h, parseCommand('[2]8K'))).toBe('hk');
  });

  it('360：一圈内四个方向都出现过', () => {
    const h = feed([{ right: true }, { down: true }, { left: true }, { up: true, hp: true }]);
    expect(matchCommand(h, parseCommand('360P'))).toBe('hp');
    expect(matchCommand(feed([{ right: true }, { down: true }, { up: true, hp: true }]), parseCommand('360P'))).toBe(null);
  });

  it('同时按键：3 帧内补齐算同时', () => {
    const h = feed([{ lp: true }, { lp: true, lk: true }]);
    expect(h.simul(['lp', 'lk'])).toBe(true);
    const late = feed([{ lp: true }, {}, {}, {}, {}, { lk: true }]);
    expect(late.simul(['lp', 'lk'])).toBe(false);
  });

  it('游戏内：P1 搓 236P 发出飞行道具', () => {
    const g = newGame(FAR);
    const s = play(g, [...motion(236, 'lp'), [{}, {}, 20]]);
    expect(s.some(t => t.fighters[0].move?.id === 'ball')).toBe(true);
    expect(events(s, 'projectile')).toHaveLength(1);
  });

  it('游戏内：P2（朝左）镜像搓招同样有效', () => {
    const g = newGame(FAR);
    const s = play(g, [...motion(236, 'lp', { player: 1, facing: -1 }), [{}, {}, 20]]);
    expect(s.some(t => t.fighters[1].move?.id === 'ball')).toBe(true);
    expect(s.find(t => t.projectiles.length).projectiles[0].vx).toBeLessThan(0);
  });

  it('优先级：623P 出升龙而不是波', () => {
    const g = newGame(FAR);
    const s = play(g, [...motion(623, 'hp'), [{}, {}, 5]]);
    expect(s.some(t => t.fighters[0].move?.id === 'rise')).toBe(true);
    expect(s.some(t => t.fighters[0].move?.id === 'ball')).toBe(false);
  });

  it('半圆 41236K', () => {
    const g = newGame(FAR);
    const s = play(g, [...motion(41236, 'mk'), [{}, {}, 5]]);
    expect(s.some(t => t.fighters[0].move?.id === 'half')).toBe(true);
  });

  it('按键强度影响招式：轻波比重波慢', () => {
    const speed = (b) => {
      const g = newGame(FAR);
      const s = play(g, [...motion(236, b), [{}, {}, 20]]);
      return Math.abs(s.find(t => t.projectiles.length).projectiles[0].vx);
    };
    expect(speed('lp')).toBeLessThan(speed('hp'));
  });

  it('蓄力角色：游戏内按后蓄力后放出', () => {
    const g = newGame({ characters: [FXC, FX], ...FAR });
    const s = play(g, [[{ left: true }, {}, 50], [{ right: true, lp: true }, {}, 1], [{}, {}, 20]]);
    expect(s.some(t => t.fighters[0].move?.id === 'boom')).toBe(true);
  });

  it('360 指令投在起跳预备帧内也能输入（不会先跳起来）', () => {
    const g = newGame({ characters: [FXG, FX], p1x: 370, p2x: 404 });
    const s = play(g, [[{ right: true }, {}, 1], [{ down: true }, {}, 1], [{ left: true }, {}, 1], [{ up: true, hp: true }, {}, 1], [{}, {}, 30]]);
    expect(events(s, 'throw').some(e => e.command)).toBe(true);
  });

  it('确定性：同样输入同样结果', () => {
    const run = () => { const g = newGame(); play(g, [...motion(236, 'hp'), [{ right: true }, {}, 60]]); idle(g, 200); return JSON.stringify(g.getState()); };
    expect(run()).toBe(run());
  });
});
