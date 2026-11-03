// 街机模式核心逻辑：7 个对手各一场、难度递增、输了接关、全胜进结局。
// 纯逻辑模块（不碰 DOM），同一 roster + player + seed 顺序确定，方便测试。
// 实际对战由 main.js 用本模块驱动：current() 取当前对手与难度，report() 结算。
import { createRng } from '../engine/rng.js';

// 7 战难度曲线：第 1 战简单、第 7 战困难，单调不减
export const LEVELS = ['easy', 'easy', 'normal', 'normal', 'hard', 'hard', 'hard'];

// order（可选）：故事模式的固定挑战顺序（不含最后一关），必须是除玩家和 finalBoss 外的全部对手
export function createArcade({ roster, player, seed, finalBoss, order = null }) {
  const rng = createRng(seed);
  const others = roster.filter(c => c.id !== player).map(c => c.id);
  // finalBoss：最后一关固定（docs/故事设定.md：第七战永远沈清，玩家是沈清时第七战林啸）。
  // 其余 6 个对手照常洗牌，finalBoss 放最后。
  let opponents;
  const rest0 = others.filter(id => id !== finalBoss);
  const orderOk = order && order.length === rest0.length && rest0.every(id => order.includes(id));
  if (orderOk && finalBoss && others.includes(finalBoss)) {
    opponents = [...order, finalBoss];
  } else if (finalBoss && others.includes(finalBoss)) {
    const rest = others.filter(id => id !== finalBoss);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    opponents = [...rest, finalBoss];
  } else {
    opponents = others;
    // Fisher–Yates 洗牌（走确定性 rng）
    for (let i = opponents.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [opponents[i], opponents[j]] = [opponents[j], opponents[i]];
    }
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
