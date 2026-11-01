// 诊断：c01 vs c08 按招式 id 聚合命中，看 c08 靠什么赢
import { Game } from '../src/engine/game.js';
import { createAI } from '../src/engine/ai.js';
import { ROSTER } from '../src/theme/index.js';

const byId = Object.fromEntries(ROSTER.map(c => [c.id, c]));

function runOne(seed, aId, bId) {
  const a = byId[aId], b = byId[bId];
  const game = new Game({ seed, characters: [a, b] });
  const c0 = createAI('hard', seed * 7, a);
  const c1 = createAI('hard', seed * 7 + 3, b);
  const counts = [{}, {}];
  const dmg = [0, 0];
  while (!game.round.matchOver && game.frame < 60000) {
    const state = game.getState();
    game.step([c0(state, 0), c1(state, 1)]);
    for (const e of game.events) {
      if (e.type === 'hit') {
        counts[e.attacker][e.id] = (counts[e.attacker][e.id] ?? 0) + 1;
        dmg[e.attacker] += e.damage;
      } else if (e.type === 'throw') {
        counts[e.attacker].throw = (counts[e.attacker].throw ?? 0) + 1;
        dmg[e.attacker] += e.damage;
      }
    }
  }
  return { winner: game.round.matchWinner, frames: game.frame, counts, dmg };
}

const N = 12;
const aggA = {}, aggB = {};
let aWins = 0;
console.log('seed: 胜者 (dmg a / b)');
for (let seed = 101; seed < 101 + N; seed++) {
  const r = runOne(seed, 'c01', 'c08');
  if (r.winner === 0) aWins++;
  console.log(`${seed}: ${r.winner === 0 ? 'c01' : 'c08'}  ${r.frames}f  dmg ${r.dmg[0]} / ${r.dmg[1]}`);
  for (const p of [0, 1]) for (const [id, n] of Object.entries(r.counts[p])) {
    const agg = p === 0 ? aggA : aggB;
    agg[id] = (agg[id] ?? 0) + n;
  }
}
console.log(`\nc01 胜 ${aWins}/${N}`);
console.log('\nc01 命中分布:', JSON.stringify(aggA));
console.log('c08 命中分布:', JSON.stringify(aggB));
