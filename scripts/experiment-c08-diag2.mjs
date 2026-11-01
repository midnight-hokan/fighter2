// 诊断2：huihe vs xuanfeng 出招次数 vs 命中次数（判断是"出得多"还是"命中率高"）
import { Game } from '../src/engine/game.js';
import { createAI } from '../src/engine/ai.js';
import { ROSTER } from '../src/theme/index.js';

const byId = Object.fromEntries(ROSTER.map(c => [c.id, c]));

function runOne(seed) {
  const [a, b] = [byId.c01, byId.c08];
  const game = new Game({ seed, characters: [a, b] });
  const c0 = createAI('hard', seed * 7, a);
  const c1 = createAI('hard', seed * 7 + 3, b);
  const fire = { huihe: 0, xuanfeng: 0 };      // 出招（进入 move 的第一帧）
  const hit = { huihe: 0, xuanfeng: 0 };
  const comboHit = { huihe: 0, xuanfeng: 0 };  // 连段中命中（combo>=2）
  const lastMove = [null, null];
  while (!game.round.matchOver && game.frame < 60000) {
    const state = game.getState();
    game.step([c0(state, 0), c1(state, 1)]);
    for (const p of [0, 1]) {
      const mv = game.fighters[p].move;
      const id = mv?.def?.id ?? null;
      if (id !== lastMove[p] && (id === 'huihe' || id === 'xuanfeng')) fire[id]++;
      lastMove[p] = id;
    }
    for (const e of game.events) {
      if (e.type === 'hit' && (e.id === 'huihe' || e.id === 'xuanfeng')) {
        hit[e.id]++;
        if (e.combo >= 2) comboHit[e.id]++;
      }
    }
  }
  return { winner: game.round.matchWinner, fire, hit, comboHit };
}

let wins8 = 0;
const tot = { fire: { huihe: 0, xuanfeng: 0 }, hit: { huihe: 0, xuanfeng: 0 }, comboHit: { huihe: 0, xuanfeng: 0 } };
for (let seed = 101; seed < 113; seed++) {
  const r = runOne(seed);
  if (r.winner === 1) wins8++;
  for (const k of ['fire', 'hit', 'comboHit']) for (const m of ['huihe', 'xuanfeng']) tot[k][m] += r[k][m];
}
console.log(`c08 胜 ${wins8}/12`);
for (const m of ['huihe', 'xuanfeng']) {
  console.log(`${m}: 出招 ${tot.fire[m]} 次, 命中 ${tot.hit[m]} 次 (命中率 ${(tot.hit[m] / Math.max(1, tot.fire[m]) * 100).toFixed(0)}%), 其中连段命中 ${tot.comboHit[m]}`);
}
