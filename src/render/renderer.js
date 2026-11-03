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
    this.jitter = [0, 0];          // 受击抖动剩余帧数
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
        if (e.counter) { this.stats.counters = (this.stats.counters ?? 0) + 1; this.flash = Math.max(this.flash, 2); this.shake = Math.max(this.shake, 4); }
        this.jitter[e.defender] = sup ? 14 : big ? 10 : 6;
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
      if (atlas) atlas.draw(ctx, animKeyFor(g), g, g.x - cam, GROUND - g.y, mirrorSame, false); // 不用 ctx.filter 着色：软件渲染下滤镜极慢，靠 lighter 叠加提亮
      else this.drawPlaceholder(g, ch, Math.round(g.x - cam), Math.round(GROUND - g.y), mirrorSame);
      ctx.restore();
      this.stats.afterimages++;
    });
  }

  drawFighter(f, ch, cam, state) {
    const ctx = this.ctx;
    // 受击抖动：顿帧期间被打的一方左右小幅震动
    let jx = 0;
    if (this.jitter[f.index] > 0) { jx = (this.jitter[f.index] % 2 ? 1.6 : -1.6); this.jitter[f.index]--; }
    const x = f.x - cam + jx;
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

  // 暗角：预先画到离屏画布，每帧只贴图（软件渲染下全屏径向渐变很慢）
  drawVignette() {
    const W = SCREEN.w, H = SCREEN.h;
    if (!this.vignette) {
      const c = document.createElement('canvas');
      c.width = W * this.rs; c.height = H * this.rs;
      const v = c.getContext('2d');
      v.scale(this.rs, this.rs);
      const g = v.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.62);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.45)');
      v.fillStyle = g;
      v.fillRect(0, 0, W, H);
      this.vignette = c;
    }
    this.ctx.drawImage(this.vignette, 0, 0, W, H);
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

  // 飞行道具：按 theme.projectiles 用角色随身物品（有图片用图片，否则程序化画法），没配置的用通用光团
  drawProjectile(p, ch, cam) {
    const look = this.theme.projectiles?.[`${ch.id}:${p.id}`];
    const x = p.x - cam, y = GROUND - p.y;
    const dir = Math.sign(p.vx) || 1;
    if (look) {
      this.stats.itemProjectiles = (this.stats.itemProjectiles ?? 0) + 1;
      const im = look.sprite && sprite(look.sprite.src);
      if (im) return this.drawSpriteProjectile(im, look.sprite, x, y, dir, p);
      const fx = PROJ_FX[look.fx];
      if (fx) return fx(this.ctx, x, y, dir, p, this.frameCount);
    }
    this.drawGlowProjectile(p, ch, x, y, dir);
  }

  drawSpriteProjectile(im, sp, x, y, dir, p) {
    const ctx = this.ctx;
    const w = sp.size ?? 28, h = w * im.height / im.width;
    trail(ctx, x, y, dir, '#ffe2a0', w * 0.5);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.rotate(((p.x * (sp.spin ?? 0)) / 20) * Math.PI / 180 * dir);
    ctx.drawImage(im, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  drawGlowProjectile(p, ch, x, y, dir) {
    const ctx = this.ctx;
    const c1 = ch.colors?.secondary ?? '#ffd34d';
    const c2 = ch.colors?.primary ?? '#ff6a2b';
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

// —— 飞行道具：图片缓存与程序化画法（逻辑坐标，x/y 为中心，dir 为飞行方向） ——
const SPRITES = new Map();
function sprite(src) {
  if (!SPRITES.has(src)) {
    const rec = { im: new Image(), ok: false };
    rec.im.onload = () => { rec.ok = true; };
    rec.im.onerror = () => { rec.ok = false; };
    rec.im.src = src;
    SPRITES.set(src, rec);
  }
  const r = SPRITES.get(src);
  return r.ok ? r.im : null;
}

function trail(ctx, x, y, dir, color, r) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 1; i <= 4; i++) {
    ctx.globalAlpha = 0.16 * (5 - i) / 4;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x - dir * i * 8, y, r * (1 - i * 0.15), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function glowDot(ctx, x, y, r, color, a = 0.9) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${a})`);
  g.addColorStop(0.35, hexA(color, a * 0.7));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

const PROJ_FX = {
  // 林啸：旋转飞出的矿灯安全帽，灯头朝前打出光束
  helmet(ctx, x, y, dir, p, t) {
    trail(ctx, x, y, dir, '#ffd34d', 9);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((p.x * 0.18) * dir);
    ctx.fillStyle = '#e8b51e';
    ctx.strokeStyle = '#6b4a08'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(0, 1, 11, 9, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9960f'; ctx.fillRect(-13, 0, 26, 3);          // 帽檐
    ctx.fillStyle = '#fff6c8'; ctx.fillRect(-1.2, -9.5, 2.4, 9);      // 顶部加强筋
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(9, -3, 3, 0, Math.PI * 2); ctx.fill();   // 灯头
    ctx.restore();
    glowDot(ctx, x + dir * 8, y - 2, 12, '#fff3b0');
    ctx.save();                                                        // 光束
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(x, y, x + dir * 46, y);
    g.addColorStop(0, 'rgba(255,248,200,0.55)'); g.addColorStop(1, 'rgba(255,248,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x + dir * 8, y - 3); ctx.lineTo(x + dir * 46, y - 12); ctx.lineTo(x + dir * 46, y + 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  // 罗铮：甩出去旋转的救生绳圈，前端带救援钩
  rope(ctx, x, y, dir, p) {
    trail(ctx, x, y, dir, '#ff9a40', 8);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.x * 0.2 * dir);
    ctx.lineWidth = 2.2;
    ['#f07a1e', '#ffb04a', '#d95e10'].forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, 12 - i * 3, 9 - i * 2.4, i * 0.6, 0, Math.PI * 2); ctx.stroke(); });
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = '#d8dde2'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x + dir * 15, y + 2, 4.5, dir > 0 ? -Math.PI / 2 : Math.PI / 2, dir > 0 ? Math.PI : 0, dir < 0); ctx.stroke();
    ctx.restore();
  },
  // 罗铮：贴地滑行的照明信号弹，尾部喷火冒烟
  flare(ctx, x, y, dir, p, t) {
    ctx.save();
    for (let i = 1; i <= 6; i++) {
      ctx.globalAlpha = 0.18 * (7 - i) / 6;
      ctx.fillStyle = '#9a8f88';
      ctx.beginPath(); ctx.arc(x - dir * (6 + i * 6), y - i * 1.5 - Math.sin(t * 0.3 + i) * 1.5, 3 + i * 1.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#c0281e'; ctx.fillRect(x - 9, y - 3, 18, 6);
    ctx.fillStyle = '#ffd8c0'; ctx.fillRect(x - 9, y - 1, 18, 1.2);
    glowDot(ctx, x - dir * 10, y, 10 + (t % 4), '#ff5a2a');
    glowDot(ctx, x + dir * 10, y, 6, '#fff0d0', 0.7);
  },
  // 苏红：铁皮喇叭喊出的声波（三道弧）
  sound(ctx, x, y, dir, p, t) { soundWaves(ctx, x, y, dir, t, 1); },
  megasound(ctx, x, y, dir, p, t) {
    soundWaves(ctx, x, y, dir, t, 1.8);
    ctx.save();
    ctx.font = '900 13px "Noto Sans SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = '#7a0a06'; ctx.fillStyle = '#fff2b0';
    ctx.strokeText('安全第一', x, y - 1); ctx.fillText('安全第一', x, y - 1);
    ctx.restore();
  },
  // 苏红：卷着飞出去的红横幅
  banner(ctx, x, y, dir, p, t) {
    trail(ctx, x, y, dir, '#ff5a3a', 9);
    const w = 30, h = 11, wave = Math.sin(t * 0.4) * 2;
    ctx.save();
    ctx.fillStyle = '#c8241a';
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - h / 2 + wave); ctx.quadraticCurveTo(x, y - h / 2 - wave, x + w / 2, y - h / 2 + wave);
    ctx.lineTo(x + w / 2, y + h / 2 + wave); ctx.quadraticCurveTo(x, y + h / 2 - wave, x - w / 2, y + h / 2 + wave);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd24a';
    ctx.font = '900 8px "Noto Sans SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('安全生产', x, y + 0.5);
    ctx.fillStyle = '#7a4a1a'; ctx.fillRect(x + dir * w / 2 - 1.5, y - h / 2 - 2 + wave, 3, h + 4);
    ctx.restore();
  },
  // 方萤：两盏旋转着飞出去的矿灯
  lamps(ctx, x, y, dir, p) {
    for (const [dy, ph] of [[-6, 0], [7, 1.6]]) {
      const lx = x - dir * (dy > 0 ? 6 : 0), ly = y + dy;
      trail(ctx, lx, ly, dir, '#bfe9ff', 5);
      ctx.save();
      ctx.translate(lx, ly); ctx.rotate(p.x * 0.25 * dir + ph);
      ctx.fillStyle = '#3a4a5a'; ctx.fillRect(-4, -5, 8, 10);
      ctx.fillStyle = '#ffe9a0'; ctx.fillRect(-3, -4, 6, 4);
      ctx.restore();
      glowDot(ctx, lx, ly - 1, 9, '#ffe9a0');
    }
  },
  // 沈清：一排银针
  needles(ctx, x, y, dir, p, t) {
    ctx.save();
    for (let i = -2; i <= 2; i++) {
      const ny = y + i * 3.2, nx = x - Math.abs(i) * dir * 3;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(200,230,255,0.35)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(nx - dir * 16, ny); ctx.lineTo(nx, ny); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#e8eef5'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(nx - dir * 9, ny); ctx.lineTo(nx + dir * 2, ny); ctx.stroke();
      if ((t + i) % 6 === 0) glowDot(ctx, nx + dir * 2, ny, 3, '#ffffff');
    }
    ctx.restore();
  },
};

function soundWaves(ctx, x, y, dir, t, k) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const r = (6 + i * 7 + (t % 6)) * k;
    ctx.globalAlpha = 0.85 - i * 0.22;
    ctx.strokeStyle = i === 0 ? '#ffffff' : '#ffd24a';
    ctx.lineWidth = (2.6 - i * 0.6) * k;
    ctx.beginPath();
    const a0 = dir > 0 ? -0.9 : Math.PI - 0.9, a1 = dir > 0 ? 0.9 : Math.PI + 0.9;
    ctx.arc(x - dir * 10 * k, y, r, a0, a1);
    ctx.stroke();
  }
  ctx.restore();
}

export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}
