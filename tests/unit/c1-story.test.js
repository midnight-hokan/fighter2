import { describe, it, expect } from 'vitest';
import theme from '../../src/theme/index.js';
import { openingScenes, prologueScenes, preFightScenes, endingScenes, referencedImages, finalOpponent } from '../../src/ui/storyflow.js';

const S = theme.story;
const ids = theme.roster.map(c => c.id);
const allLines = (scenes) => scenes.flatMap(s => s.lines);

function checkScenes(scenes, where, { allowMeOpp = false } = {}) {
  for (const s of scenes) {
    if (s.img) expect(S.IMAGES, `${where} 场景图 ${s.img}`).toHaveProperty(s.img);
    expect(s.lines.length, `${where} 空场景`).toBeGreaterThan(0);
    for (const l of s.lines) {
      expect(typeof l.text, where).toBe('string');
      expect(l.text.length, `${where}：${l.text}`).toBeGreaterThan(0);
      expect(l.text.length, `${where} 台词太长（>40 字）：${l.text}`).toBeLessThanOrEqual(40);
      if (l.who === null || l.who === undefined) continue;
      const ok = ids.includes(l.who) || l.who.startsWith('npc:') || (allowMeOpp && (l.who === 'me' || l.who === 'opp'));
      expect(ok, `${where} 说话人 ${l.who}`).toBe(true);
      if (l.expr) expect(S.EXPRS, `${where} 表情 ${l.expr}`).toContain(l.expr);
    }
  }
}

describe('C1 剧本', () => {
  it('开场至少 5 个场景', () => {
    expect(openingScenes(S).length).toBeGreaterThanOrEqual(5);
    checkScenes(openingScenes(S), '开场');
  });

  it('每个角色都有序章（≥2 场景、≥4 句）和结局（≥1 场景），并接上真相', () => {
    for (const id of ids) {
      const p = prologueScenes(S, id);
      expect(p.length, `${id} 序章`).toBeGreaterThanOrEqual(2);
      expect(allLines(p).length, `${id} 序章台词`).toBeGreaterThanOrEqual(4);
      checkScenes(p, `${id} 序章`);
      const e = endingScenes(S, id);
      expect(e.length, `${id} 结局`).toBeGreaterThanOrEqual(2);
      checkScenes(e, `${id} 结局`);
      expect(allLines(p).some(l => l.who === id), `${id} 序章里自己要说话`).toBe(true);
    }
  });

  it('任意两人对战前都有对话，双方都开口', () => {
    for (const a of ids) for (const b of ids) {
      if (a === b) continue;
      const sc = preFightScenes(S, a, b, { stage: 2 });
      checkScenes(sc, `${a}>${b}`);
      const who = new Set(allLines(sc).map(l => l.who));
      expect(who.has(a) && who.has(b), `${a}>${b} 双方都要说话`).toBe(true);
    }
    for (const k of Object.keys(S.RIVALS)) {
      const [a, b] = k.split('>');
      expect(ids.includes(a) && ids.includes(b), k).toBe(true);
      checkScenes([{ lines: S.RIVALS[k] }], k, { allowMeOpp: true });
    }
    expect(Object.keys(S.RIVALS).length, '专门写的恩怨对话').toBeGreaterThanOrEqual(12);
  });

  it('第七战体检关：守关人登场，守关人自己打到第七战时换对手', () => {
    for (const id of ids) {
      const opp = finalOpponent(id);
      expect(opp).not.toBe(id);
      const sc = preFightScenes(S, id, opp, { stage: 7, final: true });
      expect(sc.length, id).toBeGreaterThan(0);
      checkScenes(sc, `${id} 第七战`);
      expect(allLines(sc).some(l => l.who === opp), `${id} 第七战对手要露面`).toBe(true);
    }
  });

  it('场景图清单里的每张图都被用到', () => {
    const used = referencedImages(S, theme.roster);
    for (const k of Object.keys(S.IMAGES)) expect(used.has(k), `没用到的场景图 ${k}`).toBe(true);
  });
});
