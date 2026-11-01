import { describe, it, expect } from 'vitest';
import theme from '../../src/theme/index.js';
import { validateCharacter, ARCHETYPES } from '../../src/engine/validate.js';
import { parseCommand } from '../../src/engine/input.js';
import { createAI } from '../../src/engine/ai.js';
import { runMatch } from '../../src/engine/match.js';

const R = theme.roster;

// 不得使用街霸 / 拳皇的角色名、招式名、作品名
const BANNED_WORDS = ['ryu', 'ken', 'chun-li', 'chun li', 'guile', 'blanka', 'zangief', 'dhalsim', 'e.honda', 'balrog', 'vega', 'sagat', 'bison', 'cammy',
  'fei long', 'dee jay', 't.hawk', 'akuma', 'gouki', 'kyo', 'iori', 'terry', 'andy bogard', 'joe higashi', 'mai shiranui', 'ryo sakazaki', 'robert garcia',
  'takuma', 'athena', 'kensou', 'leona', 'ralf', 'clark', 'goro daimon', 'chang koehan', 'choi bounge', 'kim kaphwan', 'shermie', 'yashiro', 'orochi',
  'goenitz', 'rugal', 'geese', 'street fighter', 'king of fighters', 'capcom', 'snk', 'hadouken', 'shoryuken', 'tatsumaki'];
const BANNED_ZH = ['春丽', '古烈', '布兰卡', '桑吉尔夫', '达尔锡', '本田', '维加', '沙加特', '拜森', '嘉米', '飞龙', '迪杰', '雷鹰', '豪鬼', '草薙', '八神',
  '特瑞', '安迪', '东丈', '不知火', '坂崎', '罗伯特', '雅典娜', '莉安娜', '拉尔夫', '克拉克', '大门五郎', '金家藩', '七枷社', '夏尔米', '大蛇', '卢卡尔', '吉斯',
  '街霸', '街头霸王', '拳皇', '卡普空', '波动拳', '升龙拳', '旋风腿', '八稚女', '鬼烧', '大蛇薙', '琴月', '葵花', '百式'];

function textsOf(c) {
  return [c.name, c.title, c.style, ...(c.specials ?? []).map(s => s.name), ...(c.supers ?? []).map(s => s.name), c.throw?.name ?? ''].join(' ');
}

describe('R1 角色阵容（8 名原创角色）', () => {
  it('8 名角色全部不是占位角色', () => {
    expect(R).toHaveLength(8);
    for (const c of R) expect(c.placeholder, `${c.id} 仍是占位角色`).toBeFalsy();
  });

  it('每名角色数据都通过校验', () => {
    for (const c of R) expect(validateCharacter(c), c.id).toEqual([]);
  });

  it('id、名字、主色互不相同', () => {
    expect(new Set(R.map(c => c.id)).size).toBe(8);
    expect(new Set(R.map(c => c.name)).size).toBe(8);
    expect(new Set(R.map(c => c.colors.primary.toLowerCase())).size).toBe(8);
  });

  it('流派多样：至少 6 种，必须包含蓄力型和投技型', () => {
    const types = new Set(R.map(c => c.archetype));
    expect(types.size).toBeGreaterThanOrEqual(6);
    for (const t of types) expect(ARCHETYPES).toContain(t);
    expect(types.has('charge')).toBe(true);
    expect(types.has('grappler')).toBe(true);
  });

  it('蓄力型角色至少 2 个蓄力必杀；投技型角色有 360 指令投', () => {
    for (const c of R.filter(x => x.archetype === 'charge')) {
      expect(c.specials.filter(s => parseCommand(s.input).type === 'charge').length, c.id).toBeGreaterThanOrEqual(2);
    }
    for (const c of R.filter(x => x.archetype === 'grappler')) {
      expect(c.specials.some(s => parseCommand(s.input).type === '360' && s.throw), c.id).toBe(true);
    }
  });

  it('每名角色的必杀技组合不雷同（指令集合两两不同，招式名不重复）', () => {
    const sets = R.map(c => c.specials.map(s => s.input).sort().join('|'));
    expect(new Set(sets).size).toBe(8);
    const names = R.flatMap(c => [...c.specials, ...c.supers].map(s => s.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it('至少 3 名角色有飞行道具', () => {
    expect(R.filter(c => c.specials.some(s => s.projectile)).length).toBeGreaterThanOrEqual(3);
  });

  it('基本手感：每人轻拳发生 ≤ 5 帧，且都有对空手段（无敌必杀或上段判定的蹲重拳）', () => {
    for (const c of R) {
      expect(c.normals['st.lp'].startup, c.id).toBeLessThanOrEqual(5);
      const aa = c.specials.some(s => s.invuln) || (c.normals['cr.hp'].hitbox.y + c.normals['cr.hp'].hitbox.h >= 90);
      expect(aa, `${c.id} 缺少对空手段`).toBe(true);
    }
  });

  it('原创：名字、称号、描述、招式名不使用街霸 / 拳皇的名称', () => {
    for (const c of R) {
      const t = textsOf(c).toLowerCase();
      for (const w of BANNED_WORDS) expect(new RegExp(`\\b${w.replace('.', '\\.')}\\b`).test(t), `${c.id} 含有 "${w}"`).toBe(false);
      for (const w of BANNED_ZH) expect(t.includes(w), `${c.id} 含有 "${w}"`).toBe(false);
    }
  });

  it('每人都有结局文字（至少 30 字，非占位）', () => {
    for (const c of R) {
      expect(c.ending.length, c.id).toBeGreaterThanOrEqual(30);
      expect(c.ending).not.toContain('占位');
    }
  });

  it('平衡：困难 AI 循环赛，每人总胜率 20%–80%，每人都打出过必杀和超必杀', () => {
    const wins = Object.fromEntries(R.map(c => [c.id, 0]));
    const games = Object.fromEntries(R.map(c => [c.id, 0]));
    const used = Object.fromEntries(R.map(c => [c.id, { specials: 0, supers: 0 }]));
    let seed = 1;
    for (let i = 0; i < R.length; i++) {
      for (let j = i + 1; j < R.length; j++) {
        for (const [a, b] of [[R[i], R[j]], [R[j], R[i]], [R[i], R[j]], [R[j], R[i]]]) {
          seed++;
          const r = runMatch({ seed, characters: [a, b], controllers: [createAI('hard', seed * 7, a), createAI('hard', seed * 7 + 3, b)], maxFrames: 60000 });
          expect(r.error, `${a.id} vs ${b.id}`).toBe(null);
          expect(r.finished, `${a.id} vs ${b.id} 没打完`).toBe(true);
          games[a.id]++; games[b.id]++;
          if (r.winner === 0) wins[a.id]++;
          if (r.winner === 1) wins[b.id]++;
          used[a.id].specials += r.stats[0].specials; used[a.id].supers += r.stats[0].supers;
          used[b.id].specials += r.stats[1].specials; used[b.id].supers += r.stats[1].supers;
        }
      }
    }
    const report = R.map(c => `${c.name} ${(wins[c.id] / games[c.id] * 100).toFixed(0)}%`).join('，');
    console.log(`胜率：${report}`);
    for (const c of R) {
      const rate = wins[c.id] / games[c.id];
      expect(rate, `${c.id} 胜率 ${rate.toFixed(2)}（${report}）`).toBeGreaterThanOrEqual(0.2);
      expect(rate, `${c.id} 胜率 ${rate.toFixed(2)}（${report}）`).toBeLessThanOrEqual(0.8);
      expect(used[c.id].specials, `${c.id} 没打中过必杀`).toBeGreaterThan(0);
      expect(used[c.id].supers, `${c.id} 没打中过超必杀`).toBeGreaterThan(0);
    }
  });
});
