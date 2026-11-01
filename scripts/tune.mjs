// 平衡调参脚本：与 r1-roster 测试同源的 AI 循环赛，输出对局胜负 + 每人命中统计
import { createAI } from '../src/engine/ai.js';
import { runMatch } from '../src/engine/match.js';
import theme from '../src/theme/index.js';

const R = theme.roster;
const raw = {}; // 'a>b' → a 赢的场数（共 4 场）
const agg = Object.fromEntries(R.map(c => [c.id, { hits: 0, sp: 0, sup: 0, thr: 0 }]));
let seed = 1;
for (let i = 0; i < R.length; i++) {
  for (let j = i + 1; j < R.length; j++) {
    for (const [a, b] of [[R[i], R[j]], [R[j], R[i]], [R[i], R[j]], [R[j], R[i]]]) {
      seed++;
      const r = runMatch({ seed, characters: [a, b], controllers: [createAI('hard', seed * 7, a), createAI('hard', seed * 7 + 3, b)], maxFrames: 60000 });
      if (r.error || !r.finished) { console.log(`ERR ${a.id} vs ${b.id}: ${r.error} finished=${r.finished}`); continue; }
      const key = a.id + '>' + b.id;
      raw[key] = (raw[key] || 0) + (r.winner === 0 ? 1 : 0);
      agg[a.id].hits += r.stats[0].hits; agg[a.id].sp += r.stats[0].specials; agg[a.id].sup += r.stats[0].supers; agg[a.id].thr += r.stats[0].throws;
      agg[b.id].hits += r.stats[1].hits; agg[b.id].sp += r.stats[1].specials; agg[b.id].sup += r.stats[1].supers; agg[b.id].thr += r.stats[1].throws;
    }
  }
}
console.log('对局胜负（各 4 场）:');
for (let i = 0; i < 8; i++) {
  for (let j = i + 1; j < 8; j++) {
    const w1 = raw[R[i].id + '>' + R[j].id] || 0;
    console.log(`${R[i].id} ${R[i].name} ${w1} - ${4 - w1} ${R[j].name} ${R[j].id}`);
  }
}
console.log('\n总胜率（每人 28 场）/ 命中统计:');
for (const c of R) {
  let w = 0;
  for (const [k, v] of Object.entries(raw)) {
    const [a, b] = k.split('>');
    if (a === c.id) w += v;
    if (b === c.id) w += 2 - v; // 该 key 共 2 场，b 赢 = a 没赢的（无平局）
  }
  const g = agg[c.id];
  console.log(`${c.id} ${c.name}: ${w}/28 ${(w / 28 * 100).toFixed(0)}%   命中${g.hits} 必杀${g.sp} 超必杀${g.sup} 投${g.thr}`);
}
