import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import theme from '../../src/theme/index.js';
import { MODES } from '../../src/ui/menus.js';

// 街机模式接口（由 src/ui/arcade.js 实现）：
//   createArcade({ roster: 角色数据数组, player: 玩家角色 id, seed })
//   → { opponents: string[7], index: number, continues: number,
//       current(): { opponent, level, stage: 第几战(1–7) },
//       level(i): 'easy' | 'normal' | 'hard',
//       report(result: 'win' | 'lose'): 'next' | 'continue' | 'ending',
//       ending(): string }
const load = async () => (await import('../../src/ui/arcade.js')).createArcade;

describe('R3 街机模式', () => {
  it('src/ui/arcade.js 存在，选人页有街机模式', () => {
    expect(existsSync('src/ui/arcade.js')).toBe(true);
    expect(MODES.map(m => m.id)).toContain('arcade');
  });

  it('对手是其余 7 人各一次，同种子顺序相同', async () => {
    const createArcade = await load();
    const a = createArcade({ roster: theme.roster, player: theme.roster[0].id, seed: 5 });
    expect(a.opponents).toHaveLength(7);
    expect(new Set(a.opponents).size).toBe(7);
    expect(a.opponents).not.toContain(theme.roster[0].id);
    expect(createArcade({ roster: theme.roster, player: theme.roster[0].id, seed: 5 }).opponents).toEqual(a.opponents);
  });

  it('难度逐渐上升：第 1 战简单，第 7 战困难', async () => {
    const createArcade = await load();
    const a = createArcade({ roster: theme.roster, player: theme.roster[2].id, seed: 1 });
    const order = { easy: 0, normal: 1, hard: 2 };
    const lv = Array.from({ length: 7 }, (_, i) => a.level(i));
    expect(lv[0]).toBe('easy');
    expect(lv[6]).toBe('hard');
    for (let i = 1; i < 7; i++) expect(order[lv[i]]).toBeGreaterThanOrEqual(order[lv[i - 1]]);
  });

  it('输了可以接关（对手不变），赢 7 场进入结局', async () => {
    const createArcade = await load();
    const p = theme.roster[1];
    const a = createArcade({ roster: theme.roster, player: p.id, seed: 2 });
    const first = a.current().opponent;
    expect(a.report('lose')).toBe('continue');
    expect(a.current().opponent).toBe(first);
    expect(a.continues).toBe(1);
    const results = [];
    for (let i = 0; i < 7; i++) results.push(a.report('win'));
    expect(results.slice(0, 6).every(r => r === 'next')).toBe(true);
    expect(results[6]).toBe('ending');
    expect(a.ending()).toBe(p.ending);
  });
});
