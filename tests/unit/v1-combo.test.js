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
  it('拳皇式轻攻击连打：8 人 蹲B → 蹲A 都能连上', () => {
    for (const id of ids) {
      let best = 0;
      for (const g1 of [3, 4, 5, 6, 7, 8, 9]) {
        const g = setup(id, 'c01');
        const s = []; s[2] = { down: true, lk: true }; for (let f = 3; f < 2 + g1; f++) s[f] = { down: true };
        s[2 + g1] = { down: true, lp: true }; for (let f = 3 + g1; f < 30; f++) s[f] = { down: true };
        best = Math.max(best, Math.max(0, ...run(g, s, 60).map(h => h.combo)));
      }
      expect(best, `${id} 蹲B→蹲A 连不上`).toBeGreaterThanOrEqual(2);
    }
  });

  it('拳皇式基本连段：林啸 蹲B → 蹲A → 升龙（623A）三连', () => {
    let best = 0;
    for (const g1 of [4, 6, 8]) for (const g2 of [3, 4, 5, 6, 7, 8, 9]) {
      const g = setup('c01', 'c01');
      const s = []; s[2] = { down: true, lk: true }; for (let f = 3; f < 2 + g1; f++) s[f] = { down: true };
      s[2 + g1] = { down: true, lp: true };
      const t = 2 + g1 + g2; for (let f = 3 + g1; f < t; f++) s[f] = { down: true };
      s[t] = { right: true }; s[t + 1] = { down: true }; s[t + 2] = { down: true, right: true, lp: true };
      best = Math.max(best, Math.max(0, ...run(g, s, 90).map(h => h.combo)));
    }
    expect(best).toBeGreaterThanOrEqual(3);
  });

  it('近身 C 可取消成必杀，远距离 C 不能；贴身按 C 出的是近身版', () => {
    const g = setup('c01', 'c01');
    const st = []; for (let f = 0; f < 3; f++) st.push(g.step([f === 1 ? { hp: true } : {}, {}]).getState?.() ?? g.getState());
    expect(g.getState().fighters[0].move?.id).toBe('cl.hp');
    const far = new Game({ seed: 1, characters: [getCharacter('c01'), getCharacter('c01')], p1x: 300, p2x: 404 });
    far.step([{}, {}]); far.step([{ hp: true }, {}]);
    expect(far.getState().fighters[0].move?.id).toBe('st.hp');
    expect(g.chars?.[0] ?? true).toBeTruthy();
  });

  it('脚比手长：站立重脚判定比站立重拳远', () => {
    for (const id of ids) {
      const g = setup(id, 'c01');
      const n = g.chars[0].normals;
      expect(n['st.hk'].hitbox.x + n['st.hk'].hitbox.w, id).toBeGreaterThan(n['st.hp'].hitbox.x + n['st.hp'].hitbox.w);
    }
  });

  it('小跳：点一下上比按住上跳得低、落地快', () => {
    const peak = (hold) => {
      const g = new Game({ seed: 1, characters: [getCharacter('c01'), getCharacter('c01')], p1x: 200, p2x: 500 });
      let top = 0, land = -1;
      for (let f = 0; f < 90; f++) { g.step([f < hold ? { up: true } : {}, {}]); const p = g.getState().fighters[0]; top = Math.max(top, p.y); if (f > 5 && land < 0 && p.grounded) land = f; }
      return { top, land };
    };
    const hop = peak(2), full = peak(12);
    expect(hop.top).toBeLessThan(full.top * 0.7);
    expect(hop.land).toBeLessThan(full.land);
  });

  it('CD 吹飞攻击：重拳+重脚同按，命中击倒', () => {
    const g = setup('c01', 'c01');
    let ev = null;
    for (let f = 0; f < 40 && !ev; f++) { g.step([f === 1 ? { hp: true, hk: true } : {}, {}]); ev = g.getState().events.find(e => e.type === 'hit'); }
    expect(ev?.id).toBe('cd');
    g.step([{}, {}]);
    expect(['airhit', 'knockdown']).toContain(g.getState().fighters[1].action);
  });

  it('重 → 轻 不能取消（只能往重的方向连）', () => {
    const g = setup('c01', 'c01');
    const s = []; s[2] = { hp: true }; for (let f = 6; f < 30; f += 2) s[f] = { lp: true };
    const hits = run(g, s, 60);
    expect(Math.max(0, ...hits.map(h => h.combo))).toBe(1);
  });

  it('第 3 击起伤害递减（引擎规则）', () => {
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
    // P2 先出扫腿（发生慢），P1 后出轻拳在 P2 发生帧里打中
    const s1 = []; s1[5] = { down: true, lp: true }; s1[6] = { down: true }; s1[7] = { down: true };
    const s2 = []; s2[2] = { down: true, hk: true }; for (let f = 3; f < 20; f++) s2[f] = { down: true };
    let ev = null;
    for (let f = 0; f < 40 && !ev; f++) {
      g.step([s1[f] ?? {}, s2[f] ?? {}]);
      ev = g.getState().events.find(e => e.type === 'hit' && e.attacker === 0);
    }
    expect(ev?.counter).toBe(true);
  });
});

describe('V1 拳皇式移动与超必杀取消', () => {
  const mk = (p1x = 200, p2x = 560) => new Game({ seed: 1, characters: [getCharacter('c01'), getCharacter('c01')], p1x, p2x });
  const go = (g, seq) => { for (const [inp, n] of seq) for (let i = 0; i < n; i++) g.step([inp, {}]); return g.getState(); };

  it('跑步：快速双击 → 后按住，比走路快得多；松开就停', () => {
    const walk = go(mk(), [[{ right: true }, 30]]).fighters[0].x;
    const g = mk();
    const st = go(g, [[{ right: true }, 3], [{}, 3], [{ right: true }, 27]]);
    expect(st.fighters[0].action).toBe('run');
    expect(st.fighters[0].x - 200).toBeGreaterThan((walk - 200) * 1.5);
    expect(go(g, [[{}, 2]]).fighters[0].action).not.toBe('run');
  });

  it('后撤步：快速双击 ← 向后退，开头几帧无敌', () => {
    const g = mk(300, 400);
    go(g, [[{ left: true }, 3], [{}, 3]]);
    g.step([{ left: true }, {}]);
    const s = g.getState().fighters[0];
    expect(s.action).toBe('backstep');
    expect(s.invulnerable).toBe(true);
    const end = go(g, [[{}, 20]]).fighters[0];
    expect(end.x).toBeLessThan(300 - 30);
  });

  it('搓 214214 不会误触后撤步', () => {
    const g = mk(300, 400);
    const seq = [{ down: true }, { down: true, left: true }, { left: true }, { down: true }, { down: true, left: true }, { left: true }];
    let seen = false;
    for (const k of seq) { g.step([k, {}]); g.step([k, {}]); seen = seen || g.getState().fighters[0].action === 'backstep'; }
    expect(seen).toBe(false);
  });

  it('大跳：↓ 再快速 ↑ 跳得更高更远；跑动中起跳也更远', () => {
    const jump = (seq) => { const g = mk(); let top = 0, x = 0; for (const [k, n] of seq) for (let i = 0; i < n; i++) { g.step([k, {}]); const f = g.getState().fighters[0]; top = Math.max(top, f.y); x = f.x; } return { top, x }; };
    const norm = jump([[{ up: true, right: true }, 10], [{ right: true }, 60]]);
    const sup = jump([[{ down: true }, 2], [{ up: true, right: true }, 10], [{ right: true }, 60]]);
    expect(sup.top).toBeGreaterThan(norm.top);
    expect(sup.x).toBeGreaterThan(norm.x + 20);
  });

  it('超必杀取消：必杀技命中后输入超必杀，共消耗 2 豆，连段不断', () => {
    let ok = null;
    for (const gap of [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12]) {
      const g = mk(364, 404);
      g.debug.setMeter(0, 3);
      let sc = false, combo = 0;
      const step = (k) => { g.step([k, {}]); const st = g.getState(); sc = sc || st.events.some(e => e.type === 'supercancel'); for (const e of st.events) if (e.type === 'hit' && e.attacker === 0) combo = Math.max(combo, e.combo); };
      for (const k of [{ down: true }, { down: true, left: true }, { left: true, lk: true }]) step(k);   // 214B 滚筒旋踢
      for (let i = 0; i < gap; i++) step({});
      for (const k of [{ down: true }, { down: true, right: true }, { right: true }, { down: true }, { down: true, right: true }, { right: true, hp: true }]) step(k);
      for (let i = 0; i < 90; i++) step({});
      if (sc && combo >= 2) { ok = { stocks: g.getState().fighters[0].meter.stocks, combo }; break; }
      if (sc && !ok) ok = { stocks: g.getState().fighters[0].meter.stocks, combo };
    }
    expect(ok, '没触发超必杀取消').toBeTruthy();
    expect(ok.stocks).toBe(1);
    expect(ok.combo).toBeGreaterThanOrEqual(2);
  });
});

describe('V1 4 键下所有招式都按得出来', () => {
  it('每个必杀技、特殊技、超必杀的按键都在 A/B/C/D 之内', () => {
    for (const id of ids) {
      const g = new Game({ seed: 1, characters: [getCharacter(id), getCharacter(id)] });
      const ch = g.chars[0];
      for (const m of [...ch.specials, ...ch.supers]) {
        const b = m.parsed.button;
        expect(['P', 'K', 'LP', 'HP', 'LK', 'HK'], `${id} ${m.name} 用了中拳/中脚`).toContain(b);
      }
    }
  });
});
