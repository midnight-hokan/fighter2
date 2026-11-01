// 2D 像素渲染：原生 384×224，整数倍放大。只读 game 的状态，绝不修改。
// 有精灵图（public/assets/manifest.json 里登记过）的角色用精灵图，否则画占位小人。
import { SCREEN, STAGE } from '../engine/constants.js';
import { poseFor, skeleton } from './poses.js';
import { drawStage, stageImagesLoaded } from './stage.js';
import { Effects } from './effects.js';
import { AtlasStore, animKeyFor } from './atlas.js';

const GROUND = SCREEN.groundY;

export class Renderer {
  constructor(canvas, theme) {
    this.canvas = canvas;
    canvas.width = SCREEN.w;
    canvas.height = SCREEN.h;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.theme = theme;
    this.effects = new Effects();
    this.atlases = new AtlasStore(theme.id);
    this.cameraX = (STAGE.left + STAGE.right) / 2 - SCREEN.w / 2;
    this.shake = 0;
    this.showBoxes = false;
    this.stageIndex = 0;
    this.flash = 0;
    this.darken = 0;
    this.frameCount = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    // 大屏用整数倍放大（像素锐利）；手机等小屏整数倍放不下时，按比例铺满
    const fit = Math.min(window.innerWidth / SCREEN.w, window.innerHeight / SCREEN.h);
    const scale = fit >= 2 ? Math.floor(fit) : Math.max(0.5, fit);
    this.scale = scale;
    this.canvas.style.width = `${SCREEN.w * scale}px`;
    this.canvas.style.height = `${SCREEN.h * scale}px`;
  }

  setStage(i) { this.stageIndex = i % this.theme.stages.length; }

  render(state, chars, boxes) {
    const ctx = this.ctx;
    this.frameCount++;
    this.effects.ingest(state, chars);
    for (const e of state.events) {
      if (e.type === 'hit' && (e.kind === 'super' || e.damage >= 90)) this.shake = Math.max(this.shake, e.kind === 'super' ? 8 : 4);
      if (e.type === 'super') { this.flash = 6; this.darken = 30; }
      if (e.type === 'max') this.flash = 4;
      if (e.type === 'ko') this.shake = 10;
    }

    const [a, b] = state.fighters;
    const mid = (a.x + b.x) / 2;
    const target = Math.max(STAGE.left, Math.min(STAGE.right - SCREEN.w, mid - SCREEN.w / 2));
    this.cameraX += (target - this.cameraX) * 0.25;
    const sx = this.shake > 0 ? Math.round((this.frameCount % 2 ? 1 : -1) * this.shake / 2) : 0;
    if (this.shake > 0) this.shake--;
    const cam = Math.round(this.cameraX) + sx;

    ctx.save();
    drawStage(ctx, this.theme.stages[this.stageIndex], cam, this.frameCount);
    if (this.darken > 0) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.6, this.darken / 40)})`;
      ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
      this.darken--;
    }
    // 先画背对镜头的一方：被打的一方在后
    const order = [...state.fighters].sort((p, q) => (p.action === 'attack') - (q.action === 'attack'));
    for (const f of order) this.drawFighter(f, chars[f.index], cam, state);
    for (const p of state.projectiles) this.drawProjectile(p, chars[p.owner], cam);
    this.effects.draw(ctx, cam);
    if (this.showBoxes && boxes) this.drawBoxes(boxes, state, cam);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash / 8})`;
      ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
      this.flash--;
    }
    ctx.restore();
  }

  drawFighter(f, ch, cam, state) {
    const ctx = this.ctx;
    const x = Math.round(f.x - cam);
    const y = Math.round(GROUND - f.y);
    const atlas = this.atlases.get(ch.id);
    const mirrorSame = state.fighters[0].charId === state.fighters[1].charId && f.index === 1;
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - 16, GROUND + 1, 32, 3);
    if (f.meter?.max > 0 && this.frameCount % 4 < 2) {
      ctx.fillStyle = 'rgba(255,90,40,0.35)';
      ctx.fillRect(x - 22, y - 104, 44, 106);
    }
    if (atlas) {
      atlas.draw(ctx, animKeyFor(f), f, x, y, mirrorSame);
    } else {
      this.drawPlaceholder(f, ch, x, y, mirrorSame);
    }
    if (f.action === 'dizzy') {
      ctx.fillStyle = '#ffe14d';
      for (let i = 0; i < 3; i++) {
        const ang = this.frameCount * 0.15 + i * 2.1;
        ctx.fillRect(Math.round(x + Math.cos(ang) * 12) - 1, Math.round(y - 100 + Math.sin(ang) * 3) - 1, 3, 3);
      }
    }
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
    line([[s.hip[0], s.hip[1] + 2], [s.hip[0], s.hip[1] + 5]], 13, second); // 腰带
    line(s.legF, 7, main);
    const [hx, hy] = P(s.head);
    ctx.fillStyle = skin;
    ctx.fillRect(hx - 6, hy - 7, 12, 13);
    ctx.fillStyle = second;
    ctx.fillRect(hx - 6, hy - 7, 12, 3);                       // 头带
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(hx + (dir > 0 ? 2 : -4), hy - 2, 2, 2);        // 眼睛
    line(s.armF, 5, skin);
    const [fx, fy] = P(s.armF[2]);
    ctx.fillStyle = second;
    ctx.fillRect(fx - 3, fy - 3, 6, 6);                         // 拳套
  }

  drawProjectile(p, ch, cam) {
    const ctx = this.ctx;
    const x = Math.round(p.x - cam);
    const y = Math.round(GROUND - p.y);
    const c1 = ch.colors?.secondary ?? '#ffd34d';
    const c2 = ch.colors?.primary ?? '#ff6a2b';
    const flick = this.frameCount % 4 < 2;
    ctx.fillStyle = c2;
    ctx.fillRect(x - p.w / 2, y - p.h / 2, p.w, p.h);
    ctx.fillStyle = c1;
    ctx.fillRect(x - p.w / 2 + 4, y - p.h / 2 + 3, p.w - 8, p.h - 6);
    ctx.fillStyle = flick ? '#ffffff' : c1;
    ctx.fillRect(x - 3 + Math.sign(p.vx) * 4, y - 3, 6, 6);
    ctx.fillStyle = 'rgba(255,200,80,0.4)';
    ctx.fillRect(x - p.w / 2 - Math.sign(p.vx) * 10, y - 4, 10, 8);
  }

  drawBoxes(boxes, state, cam) {
    const ctx = this.ctx;
    const rect = (b, c) => {
      if (!b) return;
      ctx.strokeStyle = c;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(b.x1 - cam) + 0.5, Math.round(GROUND - b.y2) + 0.5, Math.round(b.x2 - b.x1), Math.round(b.y2 - b.y1));
    };
    boxes.forEach((b) => { rect(b.hurt, '#3cf'); rect(b.hit, '#f33'); });
    for (const p of state.projectiles) rect({ x1: p.x - p.w / 2, x2: p.x + p.w / 2, y1: p.y - p.h / 2, y2: p.y + p.h / 2 }, '#f33');
    ctx.fillStyle = '#fff';
    for (const f of state.fighters) ctx.fillRect(Math.round(f.x - cam), GROUND - 1, 1, 3);
  }

  info() {
    return { camera: { x: this.cameraX }, effects: this.effects.count(), scale: this.scale, atlases: this.atlases.loadedIds(), showBoxes: this.showBoxes, stage: this.theme.stages[this.stageIndex]?.id, stageImages: stageImagesLoaded() };
  }
}

export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}
