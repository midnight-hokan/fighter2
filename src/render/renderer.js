// 渲染器：逻辑坐标仍是 384×224（引擎、判定、测试都用这套），画布按 renderScale 倍高清绘制。
// 只读 game 的状态，绝不修改。V1 华丽演出：震屏、镜头推近、超必杀切入、残影、扬尘、KO 演出、暗角。
import { SCREEN, STAGE } from '../engine/constants.js';
import { poseFor, skeleton } from './poses.js';
import { drawStage, drawStageFront, stageImagesLoaded } from './stage.js';
import { Effects, hexA } from './effects.js';
import { AtlasStore, animKeyFor } from './atlas.js';

const GROUND = SCREEN.groundY;
const AFTER_N = 5;          // 残影数量
const CUTIN_FRAMES = 34;    // 超必杀切入演出时长（略长于引擎的超必杀定格 30 帧）
const KO_FRAMES = 100;

export function defaultRenderScale() {
  try {
    const q = new URLSearchParams(location.search).get('hd');
    if (q) return Math.max(1, Math.min(4, Number(q) || 3));
    if (matchMedia('(pointer: coarse)').matches) return 2;
  } catch { /* 非浏览器环境 */ }
  return 3;
}

// 立绘缓存（超必杀切入用），没有就跳过立绘只画色带和招式名
const PORTRAITS = new Map();
function portrait(themeId, charId) {
  const src = `assets/${themeId}/portraits/${charId}/angry.png`;
  if (!PORTRAITS.has(src)) {
    const im = new Image();
    const rec = { im, ok: false };
    im.onload = () => { rec.ok = true; };
    im.src = src;
    PORTRAITS.set(src, rec);
  }
  const r = PORTRAITS.get(src);
  return r.ok ? r.im : null;
}

export class Renderer {
  constructor(canvas, theme, { renderScale = defaultRenderScale() } = {}) {
    this.canvas = canvas;
    this.rs = renderScale;
    canvas.width = SCREEN.w * this.rs;
    canvas.height = SCREEN.h * this.rs;
    this.ctx = canvas.getContext('2d');
    this.theme = theme;
    this.effects = new Effects();
    this.atlases = new AtlasStore(theme.id);
    this.cameraX = (STAGE.left + STAGE.right) / 2 - SCREEN.w / 2;
    this.shake = 0;
    this.zoom = 1;
    this.zoomFocus = { x: SCREEN.w / 2, y: SCREEN.h / 2 };
    this.showBoxes = false;
    this.stageIndex = 0;
    this.flash = 0;
    this.darken = 0;
    this.frameCount = 0;
    this.hitFlash = [0, 0];
    this.trails = [[], []];     // 残影：最近几帧的位置与动作
    this.wasGrounded = [true, true];
    this.cutin = null;          // { player, charId, name, sdm, t }
    this.ko = null;             // { t }
    this.stats = { cutins: 0, afterimages: 0, kos: 0, maxZoom: 1, maxShake: 0 };
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    // 高清画布按比例铺满窗口（不再要求整数倍）
    const fit = Math.min(window.innerWidth / SCREEN.w, window.innerHeight / SCREEN.h);
    const scale = Math.max(0.5, fit);
    this.scale = scale;
    this.canvas.style.width = `${Math.floor(SCREEN.w * scale)}px`;
    this.canvas.style.height = `${Math.floor(SCREEN.h * scale)}px`;
  }

  setStage(i) { this.stageIndex = i % this.theme.stages.length; }

  ingest(state, chars) {
    this.effects.ingest(state, chars);
    for (const e of state.events) {
      if (e.type === 'hit') {
        const sup = e.kind === 'super';
        const big = sup || e.damage >= 90;
        if (big) this.shake = Math.max(this.shake, sup ? 9 : 5);
        else this.shake = Math.max(this.shake, 2);
        this.hitFlash[e.defender] = sup ? 5 : 3;
        if (big) this.punchZoom(sup ? 1.14 : 1.05, e.x, e.y);
      }
      if (e.type === 'block') this.shake = Math.max(this.shake, 1.5);
      if (e.type === 'super') {
        this.flash = 5; this.darken = 44;
        const ch = chars[e.player];
        const mv = (ch?.supers ?? []).find(s => s.id === e.id);
        this.cutin = { player: e.player, charId: ch?.id, name: mv?.name ?? '', sdm: !!e.sdm, t: 0, color: ch?.colors?.primary ?? '#c0392b' };
        this.stats.cutins++;
      }
      if (e.type === 'max') { this.flash = 4; this.shake = Math.max(this.shake, 4); }
      if (e.type === 'knockdown') this.shake = Math.max(this.shake, 3);
      if (e.type === 'ko') {
        this.shake = 12; this.flash = 8; this.ko = { t: 0 }; this.stats.kos++;
        const f = state.fighters.find(x => e.loser === 'both' || x.index === e.loser) ?? state.fighters[0];
        this.punchZoom(1.12, f.x, f.y + 50, 40);
      }
    }
    // 落地扬尘
    for (const f of state.fighters) {
      if (f.grounded && !this.wasGrounded[f.index]) this.effects.dust(f.x, 0, 6, 1);
      this.wasGrounded[f.index] = f.grounded;
    }
    this.stats.maxShake = Math.max(this.stats.maxShake, this.shake);
  }

  punchZoom(z, x, y, hold = 0) {
    this.zoom = Math.max(this.zoom, z);
    this.zoomHold = Math.max(this.zoomHold ?? 0, hold);
    this.zoomFocus = { worldX: x, y: GROUND - y };
    this.stats.maxZoom = Math.max(this.stats.maxZoom, this.zoom);
  }

  render(state, chars, boxes) {
    const ctx = this.ctx;
    this.frameCount++;
    this.ingest(state, chars);

    const [a, b] = state.fighters;
    const mid = (a.x + b.x) / 2;
    const target = Math.max(STAGE.left, Math.min(STAGE.right - SCREEN.w, mid - SCREEN.w / 2));
    this.cameraX += (target - this.cameraX) * 0.25;
    // 震屏：衰减的随机偏移（确定性）
    let sx = 0, sy = 0;
    if (this.shake > 0.2) {
      const n = this.frameCount;
      sx = Math.sin(n * 12.9898) * this.shake * 0.6;
      sy = Math.cos(n * 78.233) * this.shake * 0.45;
      this.shake *= 0.82;
    } else this.shake = 0;
    const cam = this.cameraX + sx;

    ctx.setTransform(this.rs, 0, 0, this.rs, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    // 镜头推近（以命中点为中心），之后缓慢回弹
    if (this.zoom > 1.001) {
      const fx = Math.max(60, Math.min(SCREEN.w - 60, (this.zoomFocus.worldX ?? mid) - cam));
      const fy = Math.max(60, Math.min(GROUND, this.zoomFocus.y ?? SCREEN.h / 2));
      ctx.translate(fx, fy); ctx.scale(this.zoom, this.zoom); ctx.translate(-fx, -fy);
      if (this.zoomHold > 0) this.zoomHold--; else this.zoom = 1 + (this.zoom - 1) * 0.86;
    } else this.zoom = 1;
    ctx.translate(0, sy);

    drawStage(ctx, this.theme.stages[this.stageIndex], cam, this.frameCount);
    if (this.darken > 0) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.7, this.darken / 40)})`;
      ctx.fillRect(-20, -20, SCREEN.w + 40, SCREEN.h + 40);
      this.darken--;
    }
    const order = [...state.fighters].sort((p, q) => (p.action === 'attack') - (q.action === 'attack'));
    for (const f of order) this.drawShadow(f, cam);
    for (const f of order) this.drawAfterimages(f, chars[f.index], cam, state);
    for (const f of order) this.drawFighter(f, chars[f.index], cam, state);
    for (const p of state.projectiles) this.drawProjectile(p, chars[p.owner], cam);
    this.effects.draw(ctx, cam);
    drawStageFront(ctx, this.theme.stages[this.stageIndex], cam, this.frameCount);
    if (this.showBoxes && boxes) this.drawBoxes(boxes, state, cam);
    ctx.restore();

    this.drawVignette();
    if (this.cutin) this.drawCutin();
    if (this.ko) this.drawKO();
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash / 9})`;
      ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
      this.flash--;
    }
  }

  drawShadow(f, cam) {
    const ctx = this.ctx;
    const x = f.x - cam;
    const k = Math.max(0.35, 1 - f.y / 160);
    const g = ctx.createRadialGradient(x, GROUND + 1, 0, x, GROUND + 1, 26 * k);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, GROUND + 1, 26 * k, 5 * k, 0, 0, Math.PI * 2); ctx.fill();
  }

  // 必杀、超必杀、爆气中：留下 5 个渐隐的彩色残影
  drawAfterimages(f, ch, cam, state) {
    const trail = this.trails[f.index];
    const active = (f.action === 'attack' && f.move && (f.move.kind === 'special' || f.move.kind === 'super')) || f.action === 'roll';
    if (!active) { trail.length = 0; return; }
    if (state.hitstop === 0 && state.freeze === 0 && this.frameCount % 2 === 0) {
      trail.push({ ...f, move: f.move ? { ...f.move } : null });
      if (trail.length > AFTER_N) trail.shift();
    }
    const atlas = this.atlases.get(ch.id);
    const ctx = this.ctx;
    const mirrorSame = state.fighters[0].charId === state.fighters[1].charId && f.index === 1;
    trail.forEach((g, i) => {
      ctx.save();
      ctx.globalAlpha = 0.12 + 0.1 * i;
      ctx.globalCompositeOperation = 'lighter';
      if (atlas) atlas.draw(ctx, animKeyFor(g), g, g.x - cam, GROUND - g.y, mirrorSame, false, f.move?.kind === 'super' ? 'super' : 'special');
      else this.drawPlaceholder(g, ch, Math.round(g.x - cam), Math.round(GROUND - g.y), mirrorSame);
      ctx.restore();
      this.stats.afterimages++;
    });
  }

  drawFighter(f, ch, cam, state) {
    const ctx = this.ctx;
    const x = f.x - cam;
    const y = GROUND - f.y;
    const atlas = this.atlases.get(ch.id);
    const mirrorSame = state.fighters[0].charId === state.fighters[1].charId && f.index === 1;
    // 爆气：角色周身的火焰光
    if (f.meter?.max > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.75 + 0.25 * Math.sin(this.frameCount * 0.35);
      const g = ctx.createRadialGradient(x, y - 50, 6, x, y - 50, 62 * pulse);
      g.addColorStop(0, 'rgba(255,140,60,0.45)');
      g.addColorStop(0.6, 'rgba(255,80,30,0.18)');
      g.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y - 50, 40 * pulse, 64 * pulse, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (this.frameCount % 3 === 0) this.effects.items.push({ kind: 'spark', x: f.x + ((this.frameCount * 37) % 40) - 20, y: f.y + 10, vx: 0, vy: 2.2, color: '#ff8a3a', life: 18, max: 18 });
    }
    const flash = this.hitFlash[f.index] > 0;
    if (flash) this.hitFlash[f.index]--;
    if (atlas) {
      atlas.draw(ctx, animKeyFor(f), f, x, y, mirrorSame, flash);
    } else {
      ctx.save();
      if (flash) ctx.filter = 'brightness(2.4)';
      this.drawPlaceholder(f, ch, Math.round(x), Math.round(y), mirrorSame);
      ctx.restore();
    }
    if (f.action === 'dizzy') {
      ctx.fillStyle = '#ffe14d';
      for (let i = 0; i < 3; i++) {
        const ang = this.frameCount * 0.15 + i * 2.1;
        ctx.beginPath(); ctx.arc(x + Math.cos(ang) * 12, y - 100 + Math.sin(ang) * 3, 1.8, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // 超必杀切入：斜向色带 + 立绘滑入 + 招式名大字 + 速度线
  drawCutin() {
    const ctx = this.ctx;
    const c = this.cutin;
    const t = c.t++ / CUTIN_FRAMES;
    if (t >= 1) { this.cutin = null; return; }
    const left = c.player === 0;
    const inK = Math.min(1, t / 0.18), outK = t > 0.8 ? (t - 0.8) / 0.2 : 0;
    const ease = 1 - (1 - inK) ** 3;
    const alpha = 1 - outK;
    const W = SCREEN.w, H = SCREEN.h;
    ctx.save();
    ctx.globalAlpha = alpha;
    // 色带
    const bandY = H * 0.30, bandH = H * 0.36;
    const slide = (1 - ease) * W * (left ? -1 : 1);
    ctx.translate(slide, 0);
    const grd = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
    grd.addColorStop(0, hexA(c.sdm ? '#ff6a2b' : c.color, 0.95));
    grd.addColorStop(1, hexA('#120808', 0.95));
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(-20, bandY + 14); ctx.lineTo(W + 20, bandY - 14); ctx.lineTo(W + 20, bandY + bandH - 14); ctx.lineTo(-20, bandY + bandH + 14);
    ctx.closePath(); ctx.fill();
    // 速度线
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      const yy = bandY + ((i * 37 + c.t * 9) % bandH);
      const xx = ((i * 97 + c.t * (left ? 22 : -22)) % (W + 120) + W + 120) % (W + 120) - 60;
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + (left ? 60 : -60), yy - 4); ctx.stroke();
    }
    // 立绘
    const im = portrait(this.theme.id, c.charId);
    if (im) {
      const ph = bandH * 1.9, pw = ph * im.width / im.height;
      const px = left ? 10 + (1 - ease) * -40 : W - pw - 10 + (1 - ease) * 40;
      ctx.save();
      if (!left) { ctx.translate(px + pw, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, bandY - ph * 0.12, pw, ph); }
      else ctx.drawImage(im, px, bandY - ph * 0.12, pw, ph);
      ctx.restore();
    }
    ctx.restore();
    // 招式名
    ctx.font = '900 26px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = left ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    const tx = left ? W - 18 : 18, ty = bandY + bandH * 0.52;
    ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(c.name, tx, ty);
    const tg = ctx.createLinearGradient(0, ty - 14, 0, ty + 14);
    tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.5, '#ffe680'); tg.addColorStop(1, '#ff9a2b');
    ctx.fillStyle = tg; ctx.fillText(c.name, tx, ty);
    ctx.font = '900 11px sans-serif';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(c.sdm ? 'MAX 超必杀' : '超必杀', tx, bandY + 16);
    ctx.restore();
  }

  // KO：中央放射光 + K.O. 大字由小到大砸下
  drawKO() {
    const ctx = this.ctx;
    const t = this.ko.t++ / KO_FRAMES;
    if (t >= 1) { this.ko = null; return; }
    const W = SCREEN.w, H = SCREEN.h;
    ctx.save();
    if (t < 0.5) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 * (1 - t * 2);
      ctx.fillStyle = '#fff3c0';
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + t;
        ctx.beginPath(); ctx.moveTo(W / 2, H * 0.42);
        ctx.lineTo(W / 2 + Math.cos(a) * 400, H * 0.42 + Math.sin(a) * 400);
        ctx.lineTo(W / 2 + Math.cos(a + 0.12) * 400, H * 0.42 + Math.sin(a + 0.12) * 400);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }

  drawVignette() {
    const ctx = this.ctx;
    const W = SCREEN.w, H = SCREEN.h;
    const g = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  drawPlaceholder(f, ch, x, y, alt) {
    const ctx = this.ctx;
    const s = skeleton(poseFor(f));
    const dir = f.facing >= 0 ? 1 : -1;
    const P = (pt) => [x + Math.round(pt[0]) * dir, y - Math.round(pt[1])];
    const colors = ch.colors ?? {};
    const main = alt ? shade(colors.primary ?? '#888', 0.55) : (colors.primary ?? '#888');
    const second = colors.secondary ?? '#ddd';
    const skin = colors.skin ?? '#e0ac7e';
    const line = (pts, w, c) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.lineCap = 'square';
      ctx.beginPath();
      pts.forEach((pt, i) => { const [px, py] = P(pt); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.stroke();
    };
    const back = shade(main, 0.7);
    line(s.legB, 7, back);
    line(s.armB, 5, shade(skin, 0.75));
    line([s.hip, s.neck], 12, main);
    line([[s.hip[0], s.hip[1] + 2], [s.hip[0], s.hip[1] + 5]], 13, second);
    line(s.legF, 7, main);
    const [hx, hy] = P(s.head);
    ctx.fillStyle = skin;
    ctx.fillRect(hx - 6, hy - 7, 12, 13);
    ctx.fillStyle = second;
    ctx.fillRect(hx - 6, hy - 7, 12, 3);
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(hx + (dir > 0 ? 2 : -4), hy - 2, 2, 2);
    line(s.armF, 5, skin);
    const [fx, fy] = P(s.armF[2]);
    ctx.fillStyle = second;
    ctx.fillRect(fx - 3, fy - 3, 6, 6);
  }

  // 飞行道具：发光核心 + 外焰 + 拖尾
  drawProjectile(p, ch, cam) {
    const ctx = this.ctx;
    const x = p.x - cam;
    const y = GROUND - p.y;
    const c1 = ch.colors?.secondary ?? '#ffd34d';
    const c2 = ch.colors?.primary ?? '#ff6a2b';
    const dir = Math.sign(p.vx) || 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 5; i >= 1; i--) {
      const tx = x - dir * i * 7;
      ctx.globalAlpha = 0.12 * (6 - i);
      ctx.fillStyle = c2;
      ctx.beginPath(); ctx.ellipse(tx, y, p.w / 2 * (1 - i * 0.12), p.h / 2 * (1 - i * 0.12), 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(p.w, p.h));
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.3, hexA(c1.startsWith('#') ? c1 : '#ffd34d', 0.95));
    g.addColorStop(0.7, hexA(c2.startsWith('#') ? c2 : '#ff6a2b', 0.5));
    g.addColorStop(1, hexA(c2.startsWith('#') ? c2 : '#ff6a2b', 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, p.w * 0.9, p.h * 0.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawBoxes(boxes, state, cam) {
    const ctx = this.ctx;
    const rect = (b, c) => {
      if (!b) return;
      ctx.strokeStyle = c;
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x1 - cam + 0.5, GROUND - b.y2 + 0.5, b.x2 - b.x1, b.y2 - b.y1);
    };
    boxes.forEach((b) => { rect(b.hurt, '#3cf'); rect(b.hit, '#f33'); });
    for (const p of state.projectiles) rect({ x1: p.x - p.w / 2, x2: p.x + p.w / 2, y1: p.y - p.h / 2, y2: p.y + p.h / 2 }, '#f33');
    ctx.fillStyle = '#fff';
    for (const f of state.fighters) ctx.fillRect(f.x - cam, GROUND - 1, 1, 3);
  }

  info() {
    return {
      camera: { x: this.cameraX }, effects: this.effects.count(), effectKinds: this.effects.kinds(), scale: this.scale,
      renderScale: this.rs, canvas: { w: this.canvas.width, h: this.canvas.height },
      atlases: this.atlases.loadedIds(), showBoxes: this.showBoxes, stage: this.theme.stages[this.stageIndex]?.id,
      stageImages: stageImagesLoaded(), zoom: this.zoom, shake: this.shake,
      cutin: this.cutin ? { player: this.cutin.player, charId: this.cutin.charId, name: this.cutin.name } : null,
      ko: !!this.ko, stats: { ...this.stats },
    };
  }
}

export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}
