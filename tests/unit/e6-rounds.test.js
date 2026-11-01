import { describe, it, expect } from 'vitest';
import { ROUND } from '../../src/engine/constants.js';
import { newGame, play, idle, events } from './_fixtures.js';

const ko = (g, loser) => { g.debug.setHp(loser, 0); return idle(g, 1); };
const finish = (g) => idle(g, ROUND.endDelayFrames + 5);

describe('E6 回合', () => {
  it('计时每秒减 1', () => {
    const g = newGame();
    expect(idle(g, 60).at(-1).round.timer).toBe(ROUND.seconds - 1);
  });

  it('KO：另一方胜，胜局 +1，动作为 ko / win', () => {
    const g = newGame();
    const s = ko(g, 1);
    expect(s.at(-1).round).toMatchObject({ over: true, winner: 0, wins: [1, 0] });
    expect(s.at(-1).fighters[1].action).toBe('ko');
    expect(s.at(-1).fighters[0].action).toBe('win');
    expect(events(s, 'ko')).toHaveLength(1);
  });

  it('回合结束后不能操作、计时停止', () => {
    const g = newGame();
    ko(g, 1);
    const st = g.getState();
    const s = play(g, [[{ right: true, hp: true }, {}, 30]]);
    expect(s.at(-1).round.timerFrames).toBe(st.round.timerFrames);
    expect(s.at(-1).fighters[0].x).toBe(st.fighters[0].x);
  });

  it('下一回合：血量、位置、计时复位', () => {
    const g = newGame();
    play(g, [[{ right: true }, {}, 30]]);
    g.debug.setHp(0, 300);
    ko(g, 1);
    const st = finish(g).at(-1);
    expect(st.round.number).toBe(2);
    expect(st.round.over).toBe(false);
    expect(st.fighters[0].hp).toBe(st.fighters[0].maxHp);
    expect(st.fighters[0].action).toBe('idle');
    expect(events(finish(newGame()), 'round')).toHaveLength(0);
  });

  it('时间到：血多的一方胜；相同为平局', () => {
    const g = newGame();
    g.debug.setHp(0, 500);
    g.debug.setTimer(0.05);
    expect(idle(g, 10).at(-1).round).toMatchObject({ over: true, winner: 1 });
    const d = newGame();
    d.debug.setTimer(0.05);
    expect(idle(d, 10).at(-1).round).toMatchObject({ over: true, winner: 'draw', wins: [0, 0] });
  });

  it('三局两胜；比赛结束后状态冻结', () => {
    const g = newGame();
    ko(g, 1); finish(g);
    ko(g, 1);
    const st = g.getState();
    expect(st.round).toMatchObject({ matchOver: true, matchWinner: 0, wins: [2, 0] });
    idle(g, 300);
    expect(g.getState().frame).toBe(st.frame);
  });

  it('连续平局最多 5 回合', () => {
    const g = newGame();
    for (let i = 0; i < 6 && !g.getState().round.matchOver; i++) {
      g.debug.setTimer(0.05);
      idle(g, 10);
      if (!g.getState().round.matchOver) finish(g);
    }
    expect(g.getState().round).toMatchObject({ matchOver: true, matchWinner: 'draw' });
  });

  it('训练模式：不计时、血量自动回满、豆一直是满的、不会 KO', () => {
    const g = newGame({ training: true, p1x: 364, p2x: 404 });
    play(g, [[{ hp: true }, {}, 1], [{}, {}, 30]]);
    expect(g.getState().fighters[1].hp).toBeLessThan(1000);
    const s = idle(g, 200);
    expect(s.at(-1).fighters[1].hp).toBe(1000);
    expect(s.at(-1).round.timer).toBe(ROUND.seconds);
    expect(s.at(-1).fighters[0].meter.stocks).toBe(3);
    g.debug.setHp(1, 0);
    expect(idle(g, 5).at(-1).round.over).toBe(false);
  });
});
