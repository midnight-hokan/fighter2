// 程序化像素场景（不依赖图片）。图层类型：mountains（山影）、beams（矿井支架）、lamps（灯）、
// buildings（楼群）、pillars（立柱）、stars（星点）、crowd（人群剪影）。R2 可以新增类型。
import { SCREEN, STAGE } from '../engine/constants.js';
import { createRng } from '../engine/rng.js';

const GROUND = SCREEN.groundY;
const cache = new Map();

function heights(seed, n, h) {
  const key = `${seed}-${n}-${h}`;
  if (cache.has(key)) return cache.get(key);
  const r = createRng(seed);
  const out = [];
  let v = h * 0.6;
  for (let i = 0; i < n; i++) { v = Math.max(h * 0.2, Math.min(h, v + (r.next() - 0.5) * h * 0.3)); out.push(Math.round(v)); }
  cache.set(key, out);
  return out;
}

export const LAYER_KINDS = {
  mountains(ctx, l, cam) {
    const hs = heights(l.seed ?? 1, 200, l.height ?? 60);
    const off = Math.round(cam * l.parallax);
    ctx.fillStyle = l.color;
    for (let x = 0; x < SCREEN.w; x += 4) {
      const h = hs[Math.floor((x + off) / 4) % hs.length];
      ctx.fillRect(x, GROUND - 40 - h, 4, h + 40);
    }
  },
  beams(ctx, l, cam) {
    const sp = l.spacing ?? 90;
    const off = Math.round(cam * l.parallax);
    ctx.fillStyle = l.color;
    for (let x = -((off) % sp); x < SCREEN.w; x += sp) {
      ctx.fillRect(x, 30, 8, GROUND - 30);
      ctx.fillRect(x - 20, 30, 48, 6);
    }
  },
  lamps(ctx, l, cam, t) {
    const sp = l.spacing ?? 120;
    const off = Math.round(cam * l.parallax);
    for (let x = -((off) % sp) + 30; x < SCREEN.w; x += sp) {
      ctx.fillStyle = 'rgba(242,193,78,0.15)';
      ctx.fillRect(x - 10, 40, 22, 24);
      ctx.fillStyle = (t >> 3) % 7 === 0 ? '#a07a2a' : l.color;
      ctx.fillRect(x - 2, 48, 5, 6);
    }
  },
  buildings(ctx, l, cam) {
    const hs = heights(l.seed ?? 2, 120, l.height ?? 100);
    const off = Math.round(cam * l.parallax);
    for (let i = -1; i < SCREEN.w / 24 + 1; i++) {
      const idx = Math.floor(off / 24) + i;
      const h = hs[((idx % hs.length) + hs.length) % hs.length];
      const x = i * 24 - (off % 24);
      ctx.fillStyle = l.color;
      ctx.fillRect(x, GROUND - h, 22, h);
      ctx.fillStyle = l.window ?? '#e8c060';
      for (let wy = GROUND - h + 6; wy < GROUND - 10; wy += 10) if ((idx * 7 + wy) % 3 === 0) ctx.fillRect(x + 6, wy, 3, 4);
    }
  },
  pillars(ctx, l, cam) {
    const sp = l.spacing ?? 140;
    const off = Math.round(cam * l.parallax);
    ctx.fillStyle = l.color;
    for (let x = -((off) % sp); x < SCREEN.w; x += sp) ctx.fillRect(x, 20, 18, GROUND - 20);
  },
  stars(ctx, l, cam, t) {
    const r = createRng(l.seed ?? 5);
    ctx.fillStyle = l.color ?? '#fff';
    for (let i = 0; i < 60; i++) {
      const x = Math.floor(r.next() * SCREEN.w * 2 - cam * l.parallax) % SCREEN.w;
      const y = Math.floor(r.next() * 100);
      if ((i + (t >> 4)) % 9) ctx.fillRect((x + SCREEN.w) % SCREEN.w, y, 1, 1);
    }
  },
  crowd(ctx, l, cam, t) {
    const off = Math.round(cam * l.parallax);
    ctx.fillStyle = l.color;
    for (let x = -(off % 10); x < SCREEN.w; x += 10) {
      const bob = ((x + off) / 10 + (t >> 3)) % 2;
      ctx.fillRect(x, GROUND - 30 - bob, 8, 30);
      ctx.fillRect(x + 2, GROUND - 36 - bob, 4, 5);
    }
  },
};

export function drawStage(ctx, stage, cam, t) {
  const [top, bottom] = stage.sky;
  const bands = 8;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = mix(top, bottom, i / (bands - 1));
    ctx.fillRect(0, Math.floor((GROUND * i) / bands), SCREEN.w, Math.ceil(GROUND / bands) + 1);
  }
  for (const l of stage.layers ?? []) LAYER_KINDS[l.kind]?.(ctx, l, cam, t);
  ctx.fillStyle = stage.floor.color;
  ctx.fillRect(0, GROUND, SCREEN.w, SCREEN.h - GROUND);
  ctx.fillStyle = stage.floor.line;
  const off = Math.round(cam) % 32;
  for (let x = -off; x < SCREEN.w; x += 32) ctx.fillRect(x, GROUND + 6, 16, 2);
  ctx.fillRect(0, GROUND, SCREEN.w, 1);
  // 场地两端的边界提示
  for (const wx of [STAGE.left, STAGE.right]) {
    const x = Math.round(wx - cam);
    if (x > -4 && x < SCREEN.w + 4) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x - 2, 0, 4, GROUND); }
  }
}

function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
