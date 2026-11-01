// 无头对局：两个输入源打完整场，用于 AI 测试与平衡统计。
import { Game } from './game.js';

export function runMatch({ seed = 1, characters, controllers, maxFrames = 60000 } = {}) {
  const game = new Game({ seed, characters });
  const stats = [{ hits: 0, specials: 0, supers: 0, throws: 0 }, { hits: 0, specials: 0, supers: 0, throws: 0 }];
  let error = null;
  try {
    while (!game.round.matchOver && game.frame < maxFrames) {
      const state = game.getState();
      game.step([controllers[0](state, 0), controllers[1](state, 1)]);
      for (const e of game.events) {
        if (e.type === 'hit') {
          stats[e.attacker].hits++;
          if (e.kind === 'special') stats[e.attacker].specials++;
          if (e.kind === 'super') stats[e.attacker].supers++;
        }
        if (e.type === 'throw') stats[e.attacker].throws++;
      }
    }
  } catch (e) {
    error = e;
  }
  return { finished: game.round.matchOver, winner: game.round.matchWinner, frames: game.frame, wins: [...game.round.wins], stats, error };
}
