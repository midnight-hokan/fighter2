#!/usr/bin/env node
// 导出每个角色每个动画的骨架关键点（OpenPose COCO-18 格式），给 ControlNet 生成精灵帧用。
// 用法：node scripts/art/export-poses.mjs [输出目录=art-work/poses] [--scale 8] [--lite]
// --lite：精简关键帧版（约 85 帧/人，完整版约 200 帧/人），先上线后补帧时用
// 输出：<目录>/<角色id>.json
//   { id, frameW, frameH, anchor, scale, anims: { <动画名>: { fps, loop, frames: [ { keypoints: [[x,y,置信度]×18] } ] } } }
// 坐标是放大 scale 倍后的像素（默认 8 倍 = 1024×1024，适合扩散模型），缩回 1 倍就是 atlas 的单帧坐标。
// 帧数和 fps 已按游戏节奏定好，生成的图片按这里的顺序排进 atlas 即可。
import { mkdirSync, writeFileSync } from 'node:fs';
import theme from '../../src/theme/index.js';
import { requiredAnims } from '../../src/render/atlas.js';
import { POSES, guessAnim, skeleton } from '../../src/render/poses.js';

const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'art-work/poses';
const si = process.argv.indexOf('--scale');
const scale = si > 0 ? Number(process.argv[si + 1]) : 8;
const LITE = process.argv.includes('--lite');
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

mkdirSync(out, { recursive: true });
for (const ch of theme.roster) {
  const anims = {};
  for (const key of requiredAnims(ch)) {
    if (STATE[key]) {
      const [n, fps, loop] = STATE[key];
      const fn = key === 'throw' ? (t) => POSES.throw(t, t / 30) : key === 'gc' ? (t) => POSES.heavy(t, t / 24, t > 8) : POSES[key];
      const frames = Array.from({ length: n }, (_, i) => ({ keypoints: keypoints(fn(Math.round((i * 60) / fps), i / Math.max(1, n - 1), false)) }));
      anims[key] = { fps, loop, frames };
      continue;
    }
    const m = moveDef(ch, key);
    const total = (m.startup ?? 5) + (m.active ?? 3) + (m.recovery ?? 10);
    const isNormal = !!ch.normals?.[key];
    const n = LITE ? (isNormal ? 2 : 3) : Math.max(3, Math.min(8, Math.ceil(total / 5)));
    const fn = POSES[m.anim] ?? POSES[guessAnim(key)];
    const frames = Array.from({ length: n }, (_, i) => {
      // 精简版：普通技取"蓄力、出招"两帧，必杀技取"蓄力、出招、收招"三帧；完整版均匀采样
      const frame = LITE
        ? (n === 2 ? [Math.max(1, Math.round(m.startup / 2)), m.startup + 1][i] : [Math.max(1, Math.round(m.startup / 2)), m.startup + 1, m.startup + m.active + Math.round((m.recovery ?? 10) / 2)][i])
        : Math.max(1, Math.round(((i + 0.5) / n) * total));
      const active = frame > m.startup && frame <= m.startup + m.active + 2;
      return { keypoints: keypoints(fn(frame, frame / total, active)), active };
    });
    anims[key] = { fps: Math.round((n * 60) / total), loop: false, frames };
  }
  const file = `${out}/${ch.id}.json`;
  writeFileSync(file, JSON.stringify({ id: ch.id, name: ch.name, style: ch.style, colors: ch.colors, frameW: FRAME.w, frameH: FRAME.h, anchor: FRAME.anchor, scale, anims }));
  const nFrames = Object.values(anims).reduce((a, x) => a + x.frames.length, 0);
  console.log(`${ch.id} ${ch.name}：${Object.keys(anims).length} 个动画，${nFrames} 帧 → ${file}`);
}
