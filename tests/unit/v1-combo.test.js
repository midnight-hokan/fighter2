import { describe, it, expect } from 'vitest';
import { Game } from '../../src/engine/game.js';
import theme, { getCharacter } from '../../src/theme/index.js';

// V1 华丽演出·连段手感：轻→中→重逐级取消、轻→轻最多 2 次、第 3 击起伤害递减、反击

const ids = theme.roster.map(c => c.id);
function setup(p1 = 'c01', p2 = 'c01') {
  return new Game({ seed: 1, characters: [getCharacter(p1), getCharacter(p2)], p1x: 364, p2x: 404 });
}
function run(g, script, n = 80) {
  const hits = [];
  for (let f = 0; f < n; f++) {
    g.step([script[f] ?? {}, {}]);
    hits.push(...g.getState().events.filter(e => e.type === 'hit'));
  }
  return hits;
}
// 每隔 k 帧按一个键，其余帧空输入（按住会被当成持续，不是新按下）
function presses(list, gap) { const s = []; list.forEach((b, i) => { s[2 + i * gap] = { [b]: true }; }); return s; }

describe('V1 连段', () => {
  it('轻 → 中 → 重：三下都能连上（同一套连段，连击数 1、2、3）', () => {
    for (const id of ids) {
      const g = setup(id, 'c01');
      let best = 0;
      for (const gap of [7, 8, 9, 10, 11, 12, 13, 14]) {
        const g2 = setup(id, 'c01');
        const hits = run(g2, presses(['lp', 'mp', 'hp'], gap), 90);
        best = Math.max(best, Math.max(0, ...hits.map(h => h.combo)));
      }
      expect(best, `${id} 轻中重连不上`).toBeGreaterThanOrEqual(3);
      expect(g).toBeTruthy();
    }
  });

  it('重 → 轻 不能取消（只能往重的方向连）', () => {
    const g = setup('c01', 'c01');
    const s = []; s[2] = { hp: true }; for (let f = 6; f < 30; f += 2) s[f] = { lp: true };
    const hits = run(g, s, 60);
    expect(Math.max(0, ...hits.map(h => h.combo))).toBe(1);
  });

  it('第 3 击起伤害递减', () => {
    const g = setup('c01', 'c01');
    let hits = [];
    for (const gap of [7, 8, 9, 10, 11, 12]) { const g2 = setup('c01', 'c01'); const h = run(g2, presses(['lp', 'mp', 'hp'], gap), 90); if (Math.max(0, ...h.map(x => x.combo)) >= 3) { hits = h; break; } }
    const third = hits.find(h => h.combo === 3);
    const raw = getCharacter('c01').normals['st.hp'].damage;
    expect(third.damage).toBeLessThan(raw);
    expect(g).toBeTruthy();
  });

  it('反击：在对手出招时打中，命中事件带 counter，硬直更长', () => {
    const g = setup('c01', 'c01');
    // P2 先出重拳（发生慢），P1 后出轻拳在 P2 发生帧里打中
    const s1 = []; s1[5] = { lp: true };
    const s2 = []; s2[2] = { hp: true };
    let ev = null;
    for (let f = 0; f < 40 && !ev; f++) {
      g.step([s1[f] ?? {}, s2[f] ?? {}]);
      ev = g.getState().events.find(e => e.type === 'hit' && e.attacker === 0);
    }
    expect(ev?.counter).toBe(true);
  });
});
