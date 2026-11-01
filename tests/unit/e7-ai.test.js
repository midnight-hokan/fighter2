import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createAI, commandToInputs } from '../../src/engine/ai.js';
import { runMatch } from '../../src/engine/match.js';
import { BUTTONS } from '../../src/engine/constants.js';
import { Game } from '../../src/engine/game.js';
import { InputHistory, normalizeInput, matchCommand, parseCommand } from '../../src/engine/input.js';
import { FX, FXC, FXG } from './_fixtures.js';

const MAX = 60000;

describe('E7 电脑对手', () => {
  it('commandToInputs 生成的序列能被指令识别（两个朝向）', () => {
    for (const cmd of ['236P', '623P', '214K', '41236K', '236236P', '[4]6P', '[2]8K', '360P']) {
      for (const facing of [1, -1]) {
        const h = new InputHistory();
        let ok = false;
        for (const raw of commandToInputs(cmd, facing)) {
          h.push(normalizeInput(raw), facing);
          ok ||= !!matchCommand(h, parseCommand(cmd));
        }
        expect(ok, `${cmd} 朝向 ${facing}`).toBe(true);
      }
    }
  });

  it('AI 输出合法', () => {
    const g = new Game({ characters: [FX, FX] });
    for (const lv of ['easy', 'normal', 'hard']) {
      const ai = createAI(lv, 5, FX);
      for (let i = 0; i < 400; i++) {
        const input = ai(g.getState(), 1);
        for (const [k, v] of Object.entries(input)) { expect(BUTTONS).toContain(k); expect(typeof v).toBe('boolean'); }
        g.step([{}, input]);
      }
    }
  });

  it('对不动的对手：AI 能打赢，并用到必杀和超必杀', () => {
    const r = runMatch({ seed: 1, characters: [FX, FX], controllers: [() => ({}), createAI('normal', 3, FX)], maxFrames: MAX });
    expect(r.error).toBe(null);
    expect(r.winner).toBe(1);
    expect(r.stats[1].specials).toBeGreaterThan(0);
  });

  it('同种子结果完全一致', () => {
    const run = () => runMatch({ seed: 4, characters: [FX, FX], controllers: [createAI('normal', 11, FX), createAI('hard', 12, FX)], maxFrames: MAX });
    const a = run(), b = run();
    expect([a.frames, a.winner]).toEqual([b.frames, b.winner]);
  });

  it('镜像对打 20 场：全部打完、胜率均衡、有超必杀', () => {
    const rs = Array.from({ length: 20 }, (_, i) => runMatch({ seed: i + 1, characters: [FX, FX], controllers: [createAI('normal', i * 2 + 1, FX), createAI('normal', i * 2 + 2, FX)], maxFrames: MAX }));
    for (const r of rs) { expect(r.error).toBe(null); expect(r.finished).toBe(true); }
    const dec = rs.filter(r => r.winner === 0 || r.winner === 1);
    const p1 = dec.filter(r => r.winner === 0).length / dec.length;
    expect(p1).toBeGreaterThanOrEqual(0.2);
    expect(p1).toBeLessThanOrEqual(0.8);
    expect(rs.reduce((a, r) => a + r.stats[0].supers + r.stats[1].supers, 0)).toBeGreaterThan(0);
  });

  it('难度有区分：hard 对 easy 20 场至少赢 15 场', () => {
    let w = 0;
    for (let s = 1; s <= 20; s++) {
      const hf = s % 2 === 0;
      const c = hf ? [createAI('hard', s * 3, FX), createAI('easy', s * 3 + 1, FX)] : [createAI('easy', s * 3 + 1, FX), createAI('hard', s * 3, FX)];
      const r = runMatch({ seed: s, characters: [FX, FX], controllers: c, maxFrames: MAX });
      if (r.winner === (hf ? 0 : 1)) w++;
    }
    expect(w).toBeGreaterThanOrEqual(15);
  });

  it('蓄力角色与投技角色的 AI 也会用自己的招式', () => {
    let charge = 0, grabs = 0;
    for (let s = 1; s <= 6; s++) {
      const a = runMatch({ seed: s, characters: [FXC, FX], controllers: [createAI('hard', s, FXC), createAI('normal', s + 50, FX)], maxFrames: MAX });
      charge += a.stats[0].specials;
      const b = runMatch({ seed: s, characters: [FXG, FX], controllers: [createAI('hard', s, FXG), createAI('normal', s + 50, FX)], maxFrames: MAX });
      grabs += b.stats[0].throws;
    }
    expect(charge).toBeGreaterThan(0);
    expect(grabs).toBeGreaterThan(0);
  });

  it('AI 不使用 Math 自带随机数', () => {
    expect(readFileSync('src/engine/ai.js', 'utf8')).not.toMatch(/Math\.random/);
  });
});
