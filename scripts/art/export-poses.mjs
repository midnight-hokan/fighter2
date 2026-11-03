#!/usr/bin/env node
// 导出每个角色每个动画的骨架关键点（OpenPose COCO-18 格式），给 ControlNet 生成精灵帧用。
// 用法：node scripts/art/export-poses.mjs [输出目录=art-work/poses] [--scale 8] [--lite]
// --lite：精简关键帧版（约 85 帧/人，完整版约 200 帧/人），先上线后补帧时用
// --dense N：额外输出连续驱动骨架（见下）
// 输出：<目录>/<角色id>.json
//   { id, frameW, frameH, anchor, scale, anims: { <动画名>: { fps, loop, frames: [ { keypoints: [[x,y,置信度]×18] } ] } } }
// 坐标是放大 scale 倍后的像素（默认 8 倍 = 1024×1024，适合扩散模型），缩回 1 倍就是 atlas 的单帧坐标。
// 帧数和 fps 已按游戏节奏定好，生成的图片按这里的顺序排进 atlas 即可。
import { mkdirSync, writeFileSync } from 'node:fs';
import theme from '../../src/theme/index.js';
import { requiredAnims } from '../../src/render/atlas.js';
import { POSES, guessAnim, attackPose, guardFor, skeleton } from '../../src/render/poses.js';

const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'art-work/poses';
const si = process.argv.indexOf('--scale');
const scale = si > 0 ? Number(process.argv[si + 1]) : 8;
const LITE = process.argv.includes('--lite');
// --dense N：每个动画额外输出 N 帧连续驱动骨架（给 Wan2.2-Animate 当驱动视频，动作铺满整段，不再"出招 9 帧 + 定格 40 帧"），
// 以及 pick：atlas 第 k 帧取驱动视频第 pick[k] 帧。N 建议 4k+1（17/33/49）。
const di = process.argv.indexOf('--dense');
const DENSE = di > 0 ? Number(process.argv[di + 1]) : 0;
const FRAME = { w: 128, h: 128, anchor: { x: 64, y: 112 } }; // 脚底以下留 16px：下蹲、扫腿时脚会略低于地面

// 状态动画：帧数、fps、是否循环、用哪个姿态函数采样
const STATE_LITE = {
  idle: [4, 6, true], walkf: [4, 8, true], walkb: [4, 8, true], crouch: [1, 8, true], prejump: [1, 8, false],
  jump: [2, 6, false], blockstun: [1, 10, false], crblock: [1, 10, false], hitstun: [2, 12, false], airhit: [1, 8, false],
  knockdown: [2, 6, false], dizzy: [2, 4, true], roll: [2, 8, false], maxstart: [2, 8, false], ko: [2, 4, false],
  win: [2, 4, true], throw: [2, 8, false], gc: [2, 10, false],
};
const STATE = LITE ? STATE_LITE : {
  idle: [6, 8, true], walkf: [8, 12, true], walkb: [8, 12, true], crouch: [2, 8, true], prejump: [1, 8, false],
  jump: [6, 10, false], blockstun: [2, 10, false], crblock: [2, 10, false], hitstun: [3, 12, false], airhit: [2, 8, false],
  knockdown: [3, 8, false], dizzy: [6, 8, true], roll: [6, 14, false], maxstart: [4, 10, false], ko: [3, 6, false],
  win: [6, 8, true], throw: [5, 12, false], gc: [4, 12, false],
};

// 双手长柄武器（拖把、扫帚、长棍）：出拳类动作改成双手握持前推，后手跟着前手走，
// 否则驱动骨架是单手出拳，生成模型会把武器画成"竖着拿着站着"
const POLE = /长柄|拖把|扫帚|长棍/;
const POLE_ANIMS = new Set(['punch', 'heavy', 'upper', 'uppercut', 'fireball', 'super', 'rush']);
function twoHand(pose) { return { ...pose, armB: [pose.armF[0] - 0.12, pose.armF[1] + 0.3] }; }

function moveDef(ch, key) {
  if (ch.normals?.[key]) return { id: key, ...ch.normals[key] };
  const s = [...(ch.specials ?? []), ...(ch.supers ?? [])].find(m => m.id === key);
  return s ?? null;
}

function keypoints(pose) {
  const k = skeleton(pose);
  const P = ([x, y], dx = 0) => [Math.round(FRAME.anchor.x * scale + (x + dx) * scale), Math.round(FRAME.anchor.y * scale - y * scale), 1];
  const [shF, elF, wrF] = k.armF, [, elB, wrB] = k.armB, [hip, knF, anF] = k.legF, [, knB, anB] = k.legB;
  const nose = P(k.head, 4);
  return [
    nose, P(k.neck), P(shF, 2), P(elF), P(wrF), P(shF, -2), P(elB), P(wrB),
    P(hip, 2), P(knF), P(anF), P(hip, -2), P(knB), P(anB),
    P(k.head, 3), P(k.head, 2), P(k.head, 0), P(k.head, -1),
  ];
}

// 完整版采样：保证"蓄力→出招→收招"每段都有帧（均匀采样容易漏掉只有 2–4 帧的出招段，动画就像没出手）
function fullFrames(m, n, total) {
  const st = m.startup ?? 5, ac = m.active ?? 3;
  const nA = Math.min(2, Math.max(1, n - 2)), nS = Math.max(1, Math.round((n - nA) * 0.45)), nR = Math.max(0, n - nA - nS);
  const out = [];
  for (let i = 0; i < nS; i++) out.push(Math.max(1, Math.round(((i + 1) / (nS + 1)) * st + 0.5)));
  out.push(st + 1); if (nA > 1) out.push(st + Math.max(1, ac));
  for (let i = 0; i < nR; i++) out.push(Math.round(st + ac + ((i + 1) / (nR + 0.6)) * (total - st - ac)));
  return out.slice(0, n);
}

mkdirSync(out, { recursive: true });
for (const ch of theme.roster) {
  const anims = {};
  for (const key of requiredAnims(ch)) {
    if (STATE[key]) {
      const [n, fps, loop] = STATE[key];
      const fn = key === 'throw' ? (t) => POSES.throw(t, t / 30) : key === 'gc' ? (t) => POSES.heavy(t, t / 24, t > 8) : POSES[key];
      const frames = Array.from({ length: n }, (_, i) => ({ keypoints: keypoints(fn(Math.round((i * 60) / fps), i / Math.max(1, n - 1), false)) }));
      anims[key] = { fps, loop, frames };
      if (DENSE) {
        const span = Math.max(1, (n * 60) / fps); // 一个循环（或整段）的游戏帧数
        const tAt = (j) => (loop ? (j * span) / DENSE : (j * span) / Math.max(1, DENSE - 1));
        anims[key].dense = {
          frames: Array.from({ length: DENSE }, (_, j) => ({ keypoints: keypoints(fn(tAt(j), j / Math.max(1, DENSE - 1), false)) })),
          pick: Array.from({ length: n }, (_, i) => Math.min(DENSE - 1, Math.round(((i * 60) / fps / span) * (loop ? DENSE : DENSE - 1)))),
        };
      }
      continue;
    }
    const m = moveDef(ch, key);
    const total = (m.startup ?? 5) + (m.active ?? 3) + (m.recovery ?? 10);
    const isNormal = !!ch.normals?.[key];
    const n = LITE ? (isNormal ? 2 : 3) : Math.max(3, Math.min(8, Math.ceil(total / 5)));
    const fn = POSES[m.anim] ?? POSES[guessAnim(key)];
    const animName = POSES[m.anim] ? m.anim : guessAnim(key);
    const pole = POLE.test(ch.style ?? '') && POLE_ANIMS.has(animName);
    const poseAt = (frame) => {
      const active = frame > m.startup && frame <= m.startup + m.active + 2;
      // 关键帧插值：架势 → 蓄力 → 出招 → 收招（旋风腿、投技仍按时间函数）
      const p = ['spin', 'throw', 'grab'].includes(animName)
        ? fn(frame, frame / total, active)
        : attackPose(animName, frame, m.startup ?? 5, m.active ?? 3, m.recovery ?? 10, frame, guardFor(key));
      return pole ? twoHand(p) : p;
    };
    const picks = [];
    const frames = Array.from({ length: n }, (_, i) => {
      // 精简版：普通技取"蓄力、出招"两帧，必杀技取"蓄力、出招、收招"三帧；完整版均匀采样
      const frame = LITE
        ? (n === 2 ? [Math.max(1, Math.round(m.startup / 2)), m.startup + 1][i] : [Math.max(1, Math.round(m.startup / 2)), m.startup + 1, m.startup + m.active + Math.round((m.recovery ?? 10) / 2)][i])
        : fullFrames(m, n, total)[i];
      const active = frame > m.startup && frame <= m.startup + m.active + 2;
      picks.push(frame);
      return { keypoints: keypoints(poseAt(frame)), active };
    });
    anims[key] = { fps: Math.round((n * 60) / total), loop: false, frames };
    if (DENSE) {
      // 驱动视频从第 0 帧（架势）铺到最后一帧（收招回架势），动作占满整段
      anims[key].dense = {
        frames: Array.from({ length: DENSE }, (_, j) => ({ keypoints: keypoints(poseAt((j * total) / (DENSE - 1))) })),
        pick: picks.map(f => Math.min(DENSE - 1, Math.round((f * (DENSE - 1)) / total))),
      };
    }
  }
  const file = `${out}/${ch.id}.json`;
  writeFileSync(file, JSON.stringify({ id: ch.id, name: ch.name, style: ch.style, colors: ch.colors, frameW: FRAME.w, frameH: FRAME.h, anchor: FRAME.anchor, scale, anims }));
  const nFrames = Object.values(anims).reduce((a, x) => a + x.frames.length, 0);
  console.log(`${ch.id} ${ch.name}：${Object.keys(anims).length} 个动画，${nFrames} 帧 → ${file}`);
}
