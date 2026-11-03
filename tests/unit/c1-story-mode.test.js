import { describe, it, expect } from 'vitest';
import theme from '../../src/theme/index.js';
import { finalOpponent, preFightScenes, midpointScenes, storyOrder } from '../../src/ui/storyflow.js';
import { createArcade } from '../../src/ui/arcade.js';

// 故事模式：每个角色一条独立的故事线（固定挑战顺序 + 每一战专门的对战前对话 + 中段剧情）
const S = theme.story;
const ids = theme.roster.map(c => c.id);

describe('C1 故事模式', () => {
  it('每个角色都有固定挑战顺序：6 个不同对手，不含自己和最后一关', () => {
    for (const me of ids) {
      const order = storyOrder(S, me);
      expect(order, me).toBeTruthy();
      expect(new Set(order).size, me).toBe(6);
      expect(order, me).not.toContain(me);
      expect(order, me).not.toContain(finalOpponent(me));
      for (const o of order) expect(ids, `${me} 顺序里有未知角色 ${o}`).toContain(o);
    }
  });

  it('顺序里的每一战都有专门对话（宿敌或 DUELS），不再落回通用挑衅', () => {
    for (const me of ids) {
      for (const opp of storyOrder(S, me)) {
        const lines = S.RIVALS?.[`${me}>${opp}`] ?? S.DUELS?.[`${me}>${opp}`];
        expect(lines, `${me}>${opp} 缺少对战前对话`).toBeTruthy();
        expect(lines.length, `${me}>${opp}`).toBeGreaterThanOrEqual(2);
        for (const l of lines) {
          expect(l.text, `${me}>${opp}`).toBeTruthy();
          expect(['me', 'opp'].includes(l.who) || l.who === null || String(l.who).startsWith('npc:'), `${me}>${opp} who`).toBe(true);
          if (l.expr) expect(S.EXPRS, `${me}>${opp} expr`).toContain(l.expr);
        }
        const scenes = preFightScenes(S, me, opp, { stage: 2 });
        expect(scenes[0].lines.map(l => l.text)).toEqual(lines.map(l => l.text));
      }
    }
  });

  it('每个角色都有中段剧情，引用的场景图已登记', () => {
    for (const me of ids) {
      const sc = midpointScenes(S, me);
      expect(sc.length, me).toBeGreaterThan(0);
      for (const s of sc) {
        expect(S.IMAGES, `${me} 中段剧情图 ${s.img}`).toHaveProperty(s.img);
        expect(s.lines.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('createArcade 按剧本顺序排对手，最后一关不变', () => {
    for (const me of ids) {
      const a = createArcade({ roster: theme.roster, player: me, seed: 1, finalBoss: finalOpponent(me), order: storyOrder(S, me) });
      expect(a.opponents).toEqual([...storyOrder(S, me), finalOpponent(me)]);
    }
  });
});
