// 实验：c01 vs c08，把 c08 换成不同皮肤，看胜率差异来源（kit / stats / 种子）
import { createAI } from '../src/engine/ai.js';
import { runMatch } from '../src/engine/match.js';
import theme from '../src/theme/index.js';

const R = theme.roster;
const clone = (o) => JSON.parse(JSON.stringify(o));

function runPair(a, b, label) {
  // 复现测试里 pair (0,7) 的 4 场：seed 25..28
  let seed = 1;
  for (let i = 0; i < 8; i++) {
    for (let j = i + 1; j < 8; j++) {
      for (let k = 0; k < 4; k++) seed++;
      if (i === 0 && j === 7) {
        const order = [[a, b], [b, a], [a, b], [b, a]];
        let w = 0;
        for (const [x, y] of order) {
          const r = runMatch({ seed, characters: [x, y], controllers: [createAI('hard', seed * 7, x), createAI('hard', seed * 7 + 3, y)], maxFrames: 60000 });
          if (r.error) { console.log(label, 'ERR', r.error); return; }
          if (r.winner === 0 && x === a) w++;
          if (r.winner === 1 && y === a) w++;
        }
        console.log(`${label}: a 胜 ${w}/4`);
      }
    }
  }
}

const c01 = R[0], c08 = R[7];
runPair(c01, c08, '原样 c08            ');
// 实验1：c08 用 c01 的必杀/超必杀/投技，保留自己的 stats
const c08k = clone(c08);
c08k.specials = clone(c01.specials); c08k.supers = clone(c01.supers); c08k.throw = clone(c01.throw);
runPair(c01, c08k, 'c08 换 c01 的招式   ');
// 实验2：c08 用 c01 的 stats，保留自己的招式
const c08s = clone(c08);
c08s.stats = clone(c01.stats);
runPair(c01, c08s, 'c08 换 c01 的数值   ');
// 实验3：c08 完全等于 c01（只改 id）
const c08x = clone(c01); c08x.id = 'c08';
runPair(c01, c08x, 'c08 完全=c01       ');
