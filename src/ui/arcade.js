// 街机模式核心逻辑：7 个对手各一场、难度递增、输了接关、全胜进结局。
// 纯逻辑模块（不碰 DOM），同一 roster + player + seed 顺序确定，方便测试。
// 实际对战由 main.js 用本模块驱动：current() 取当前对手与难度，report() 结算。
import { createRng } from '../engine/rng.js';

// 7 战难度曲线：第 1 战简单、第 7 战困难，单调不减
export const LEVELS = ['easy', 'easy', 'normal', 'normal', 'hard', 'hard', 'hard'];

export function createArcade({ roster, player, seed }) {
  const rng = createRng(seed);
  const opponents = roster.filter(c => c.id !== player).map(c => c.id);
  // Fisher–Yates 洗牌（走确定性 rng）
  for (let i = opponents.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [opponents[i], opponents[j]] = [opponents[j], opponents[i]];
  }
  const byId = new Map(roster.map(c => [c.id, c]));
  let index = 0;
  let continues = 0;
  return {
    opponents,
    get index() { return index; },
    get continues() { return continues; },
    // 当前这一战：opponent 角色 id、level 难度、stage 第几战（1–7）
    current() {
      return { opponent: opponents[index], level: LEVELS[index], stage: index + 1 };
    },
    level(i) { return LEVELS[i]; },
    // result: 'win' | 'lose' → 'next'（下一战）| 'continue'（可接关，对手不变）| 'ending'（7 战全胜）
    report(result) {
      if (result === 'lose') { continues++; return 'continue'; }
      if (index >= opponents.length - 1) return 'ending';
      index++;
      return 'next';
    },
    // 玩家角色的结局文本
    ending() { return byId.get(player).ending; },
  };
}
