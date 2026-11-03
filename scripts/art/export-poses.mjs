#!/usr/bin/env node
// 导出每个角色每个动画的骨架（OpenPose COCO-18 关键点），给 Wan2.2-Animate 当驱动视频、给打包脚本当取帧表。
// 用法：node scripts/art/export-poses.mjs [输出目录=art-work/poses] [--scale 8] [--only c04]
//
// v3（2026-11-04，动画清单冻结版，见 src/theme/meilong/anims-v2.js）：
// - 动画清单 = 现有招式（去掉 4 键后不用的中拳中脚）+ 近身 C/D、吹飞 + v2 新招式 + 开场/胜利 2/挑衅
// - 每个动画输出两套：
//   dense.frames：驱动视频，1 帧 = 1 个游戏帧，从架势到收招铺满整段（长度取 4k+1，最多 81，超过就隔帧）
//   frames：要画进图集的帧，约每 3 个游戏帧一张（普通技 4–8 张、必杀 8–16 张、超必杀 16–24 张），
//           每张都取自驱动视频的第 dense.pick[k] 帧，所以生成视频后按 pick 抽帧就行
// - alias：不画的动画指向哪个动画（中拳→轻拳等），打包时写进 atlas.json
//
// 输出 <目录>/<角色id>.json：
//   { id, name, style, colors, frameW, frameH, anchor, scale, alias,
//     anims: { <动画名>: { fps, loop, kind, frames: [{keypoints, active}], dense: { frames: [{keypoints}], pick: [] } } } }
// 坐标是放大 scale 倍后的像素（默认 8 倍 = 1024×1024），缩回 1 倍就是 128×128 单帧坐标。
import { mkdirSync, writeFileSync } from 'node:fs';
import theme from '../../src/theme/index.js';
import { BASE_ANIMS } from '../../src/render/atlas.js';
import { POSES, guessAnim, attackPose, guardFor, skeleton } from '../../src/render/poses.js';
import { V2_STATES, KOF_NORMALS, V2_MOVES, V2_OVERRIDES, UNUSED_NORMALS } from '../../src/theme/meilong/anims-v2.js';

const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'art-work/poses';
const opt = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const scale = Number(opt('--scale', 8));
const only = opt('--only', null);
const FRAME = { w: 128, h: 128, anchor: { x: 64, y: 112 } };
const MAX_DENSE = 81;
const PER_DRAWING = 4;  // 约每 4 个游戏帧画一张（约 15 张/秒，手绘格斗游戏的常见密度）

// 状态动画：[图集帧数, fps, 循环]
const STATE = {
  idle: [10, 10, true], walkf: [10, 14, true], walkb: [10, 14, true], crouch: [3, 8, true], prejump: [2, 20, false],
  jump: [8, 12, false], blockstun: [3, 14, false], crblock: [3, 14, false], hitstun: [4, 14, false], airhit: [3, 10, false],
  knockdown: [6, 10, false], dizzy: [6, 8, true], roll: [8, 16, false], maxstart: [6, 12, false], ko: [6, 8, false],
  win: [8, 8, true], throw: [8, 14, false], gc: [6, 14, false],
  ...V2_STATES,
};

// 双手长柄武器：出拳类动作双手握持前推
const POLE = /长柄|拖把|扫帚|长棍/;
const POLE_ANIMS = new Set(['punch', 'heavy', 'upper', 'uppercut', 'fireball', 'super', 'rush', 'overhead', 'spin']);
const twoHand = (pose) => ({ ...pose, armB: [pose.armF[0] - 0.12, pose.armF[1] + 0.3] });

function keypoints(pose) {
  const k = skeleton(pose);
  const P = ([x, y], dx = 0) => [Math.round(FRAME.anchor.x * scale + (x + dx) * scale), Math.round(FRAME.anchor.y * scale - y * scale), 1];
  const [shF, elF, wrF] = k.armF, [, elB, wrB] = k.armB, [hip, knF, anF] = k.legF, [, knB, anB] = k.legB;
  return [
    P(k.head, 4), P(k.neck), P(shF, 2), P(elF), P(wrF), P(shF, -2), P(elB), P(wrB),
    P(hip, 2), P(knF), P(anF), P(hip, -2), P(knB), P(anB),
    P(k.head, 3), P(k.head, 2), P(k.head, 0), P(k.head, -1),
  ];
}

const denseLen = (span) => { let L = 4 * Math.ceil(span / 4) + 1; return Math.min(MAX_DENSE, Math.max(17, L)); };

// 招式定义：现有招式 / 派生普通技 / v2 新招式，统一成 { id, anim, startup, active, recovery, guard, twoHand }
function moveList(ch) {
  const list = [];
  const norm = ch.normals ?? {};
  for (const [id, d] of Object.entries(norm)) if (!UNUSED_NORMALS[id]) list.push({ id, ...d, anim: d.anim ?? guessAnim(id) });
  for (const [id, d] of Object.entries(KOF_NORMALS)) {
    const src = norm[d.from];
    if (!src) continue;
    list.push({
      id, anim: d.anim, guard: d.guard,
      startup: d.startup ?? Math.max(3, src.startup + (d.dStartup ?? 0)),
      active: d.active ?? src.active, recovery: d.recovery ?? Math.max(8, src.recovery + (d.dRecovery ?? 0)),
    });
  }
  const ov = V2_OVERRIDES[ch.id] ?? {};
  for (const s of [...(ch.specials ?? []), ...(ch.supers ?? [])]) list.push({ ...s, ...(ov[s.id] ?? {}), anim: ov[s.id]?.anim ?? s.anim ?? guessAnim(s.id) });
  for (const s of V2_MOVES[ch.id] ?? []) list.push({ ...s });
  return list;
}

function attackAnim(ch, mv) {
  const st = mv.startup ?? 5, ac = mv.active ?? 3, rc = mv.recovery ?? 10, total = st + ac + rc;
  const anim = POSES[mv.anim] ? mv.anim : guessAnim(mv.id);
  const pole = mv.twoHand || (POLE.test(ch.style ?? '') && POLE_ANIMS.has(anim));
  const guard = mv.guard === 'cr' ? POSES.crouch() : mv.guard === 'j' ? POSES.jump(10) : guardFor(mv.id);
  const poseAt = (f) => {
    const active = f > st && f <= st + ac + 2;
    const p = ['spin', 'throw', 'grab'].includes(anim) ? POSES[anim](f, f / total, active) : attackPose(anim, f, st, ac, rc, f, guard);
    return pole ? twoHand(p) : p;
  };
  const L = denseLen(total + 1);
  const at = (j) => (j * total) / (L - 1);
  const dense = Array.from({ length: L }, (_, j) => ({ keypoints: keypoints(poseAt(at(j))) }));
  // 图集帧：均匀取，保证至少一张落在出招（持续）段
  const n = Math.max(4, Math.min(20, Math.round(total / PER_DRAWING)));
  let fr = Array.from({ length: n }, (_, k) => ((k + 0.5) * total) / n);
  if (!fr.some(f => f > st && f <= st + ac + 1)) {
    let best = 0;
    fr.forEach((f, k) => { if (Math.abs(f - (st + 1)) < Math.abs(fr[best] - (st + 1))) best = k; });
    fr[best] = st + 1;
  }
  const pick = fr.map(f => Math.min(L - 1, Math.round((f / total) * (L - 1))));
  const frames = pick.map(j => ({ keypoints: dense[j].keypoints, active: at(j) > st && at(j) <= st + ac + 2 }));
  return { fps: Math.round((n * 60) / total), loop: false, kind: 'attack', frames, dense: { frames: dense, pick } };
}

function stateAnim(key) {
  const [n, fps, loop] = STATE[key];
  const fn = key === 'throw' ? (t) => POSES.throw(t, t / 30) : key === 'gc' ? (t) => POSES.heavy(t, t / 24, t > 8) : POSES[key];
  const span = Math.max(1, (n * 60) / fps);
  const L = denseLen(span + 1);
  const at = (j) => (loop ? (j * span) / L : (j * span) / (L - 1));
  const dense = Array.from({ length: L }, (_, j) => ({ keypoints: keypoints(fn(at(j), at(j) / span, false)) }));
  const pick = Array.from({ length: n }, (_, i) => Math.min(L - 1, Math.round(((i * 60) / fps / span) * (loop ? L : L - 1))));
  return { fps, loop, kind: 'state', frames: pick.map(j => ({ keypoints: dense[j].keypoints, active: false })), dense: { frames: dense, pick } };
}

mkdirSync(out, { recursive: true });
let grand = 0;
for (const ch of theme.roster) {
  if (only && ch.id !== only) continue;
  const anims = {};
  for (const key of [...BASE_ANIMS, ...Object.keys(V2_STATES)]) if (STATE[key]) anims[key] = stateAnim(key);
  for (const mv of moveList(ch)) anims[mv.id] = attackAnim(ch, mv);
  const alias = { ...UNUSED_NORMALS };
  writeFileSync(`${out}/${ch.id}.json`, JSON.stringify({ id: ch.id, name: ch.name, style: ch.style, colors: ch.colors, frameW: FRAME.w, frameH: FRAME.h, anchor: FRAME.anchor, scale, alias, anims }));
  const nFrames = Object.values(anims).reduce((a, x) => a + x.frames.length, 0);
  const nDense = Object.values(anims).reduce((a, x) => a + x.dense.frames.length, 0);
  grand += nFrames;
  console.log(`${ch.id} ${ch.name}：${Object.keys(anims).length} 个动画，图集 ${nFrames} 帧，驱动视频共 ${nDense} 帧 → ${out}/${ch.id}.json`);
}
console.log(`合计图集 ${grand} 帧`);
