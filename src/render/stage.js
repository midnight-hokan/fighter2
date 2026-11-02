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

// 图片图层：{ kind: 'image', src: 'assets/<主题>/stages/<场景id>/far.png', parallax: 0.2, y: 0 }
// 图片横向无缝平铺；y 为图片顶边的屏幕坐标（缺省时底边贴地面）。图片没加载好时跳过这一层。
const IMAGES = new Map();
export function loadStageImages(stages) {
  const srcs = [...new Set(stages.flatMap(s => (s.layers ?? []).filter(l => l.kind === 'image').map(l => l.src)))];
  return Promise.all(srcs.map(src => new Promise((res) => {
    if (IMAGES.has(src)) return res();
    const im = new Image();
    im.onload = () => { IMAGES.set(src, im); res(); };
    im.onerror = () => { console.warn(`场景图片 ${src} 加载失败，跳过该图层`); res(); };
    im.src = src;
  })));
}
export const stageImagesLoaded = () => [...IMAGES.keys()];

// scale：图片像素 / 逻辑像素（高清全景图 2 或 3）。y 缺省时底边贴屏幕底（全景图连地面一起画）或贴地面（旧条带）。
LAYER_KINDS.image = (ctx, l, cam) => {
  const im = IMAGES.get(l.src);
  if (!im) return;
  const k = l.scale ?? 1;
  const w = im.width / k, h = im.height / k;
  const y = l.y ?? (l.ground ? SCREEN.h - h : GROUND - h);
  const off = (((cam * (l.parallax ?? 0.5)) % w) + w) % w;
  for (let x = -off; x < SCREEN.w; x += w) ctx.drawImage(im, x, y, w + 0.5, h);
};

// 动态粒子层：embers（火星上飘）、dust（浮尘）、steam（蒸汽团）、snow（落雪）、fireflies（萤火）、drips（滴水）
// { kind: 'particles', style: 'embers', count: 40, color: '#ffb060', parallax: 0.9, area: [y0, y1] }
const PSTYLE = {
  embers: { vy: -0.35, vx: 0.15, size: 1.2, wob: 0.6, glow: true },
  dust: { vy: -0.05, vx: 0.08, size: 0.9, wob: 0.4, glow: false },
  steam: { vy: -0.25, vx: 0.1, size: 9, wob: 0.8, glow: false, soft: true },
  snow: { vy: 0.35, vx: 0.1, size: 1.1, wob: 0.7, glow: false },
  fireflies: { vy: -0.05, vx: 0.05, size: 1.4, wob: 1.5, glow: true, blink: true },
  drips: { vy: 1.6, vx: 0, size: 0.9, wob: 0, glow: false, streak: true },
};
LAYER_KINDS.particles = (ctx, l, cam, t) => {
  const st = PSTYLE[l.style] ?? PSTYLE.dust;
  const n = l.count ?? 40;
  const [y0, y1] = l.area ?? [0, GROUND];
  const span = y1 - y0;
  const r = createRng(l.seed ?? 11);
  const W = SCREEN.w + 40;
  ctx.save();
  if (st.glow) ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const bx = r.next() * W * 3, by = r.next() * span, ph = r.next() * 6.28, sp = 0.6 + r.next() * 0.8;
    let x = bx + t * st.vx * sp - cam * (l.parallax ?? 0.8);
    let y = by + t * st.vy * sp;
    x = ((x % W) + W) % W - 20;
    y = y0 + (((y % span) + span) % span);
    x += Math.sin(t * 0.03 * sp + ph) * st.wob * 6;
    const blink = st.blink ? 0.5 + 0.5 * Math.sin(t * 0.08 + ph * 3) : 1;
    ctx.globalAlpha = (l.alpha ?? (st.soft ? 0.12 : 0.8)) * blink;
    ctx.fillStyle = l.color ?? '#ffffff';
    if (st.streak) { ctx.fillRect(x, y, 0.6, 4); continue; }
    ctx.beginPath(); ctx.arc(x, y, st.size * (st.soft ? sp : 1), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
};

// 光源呼吸：{ kind: 'glow', points: [[x, y, r], ...], color: '#ffb060', parallax: 0.6, flicker: 0.2 }
LAYER_KINDS.glow = (ctx, l, cam, t) => {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  (l.points ?? []).forEach(([px, py, pr], i) => {
    const W = l.wrap ?? 768;
    let x = px - cam * (l.parallax ?? 0.6);
    x = ((x % W) + W) % W;
    if (x > SCREEN.w + pr) x -= W;
    const fl = 1 - (l.flicker ?? 0.15) * (0.5 + 0.5 * Math.sin(t * 0.11 + i * 1.7) * Math.sin(t * 0.037 + i));
    const g = ctx.createRadialGradient(x, py, 0, x, py, pr * fl);
    g.addColorStop(0, hexToRgba(l.color ?? '#ffb060', 0.55 * fl));
    g.addColorStop(1, hexToRgba(l.color ?? '#ffb060', 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, py, pr * fl, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
};

// 场景：天空渐变 → 图层（远到近）→ 地面（floor.hidden 时不画，全景图自带地面）→ 前景层（stage.front）
export function drawStage(ctx, stage, cam, t) {
  const [top, bottom] = stage.sky;
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(-20, -20, SCREEN.w + 40, SCREEN.h + 40);
  for (const l of stage.layers ?? []) LAYER_KINDS[l.kind]?.(ctx, l, cam, t);
  if (!stage.floor?.hidden) {
    const fg = ctx.createLinearGradient(0, GROUND, 0, SCREEN.h);
    fg.addColorStop(0, stage.floor.color); fg.addColorStop(1, '#000000');
    ctx.fillStyle = fg;
    ctx.fillRect(-20, GROUND, SCREEN.w + 40, SCREEN.h - GROUND + 20);
    ctx.fillStyle = stage.floor.line;
    ctx.fillRect(-20, GROUND, SCREEN.w + 40, 1);
  }
}

export function drawStageFront(ctx, stage, cam, t) {
  for (const l of stage.front ?? []) LAYER_KINDS[l.kind]?.(ctx, l, cam, t);
}

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
}

function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
