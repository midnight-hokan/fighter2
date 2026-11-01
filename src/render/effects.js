// 打击火花、防御火花、道具对消、爆气光圈。全部是像素小方块，几帧后消失。
import { SCREEN } from '../engine/constants.js';

const GROUND = SCREEN.groundY;

export class Effects {
  constructor() { this.items = []; }

  ingest(state) {
    for (const e of state.events) {
      if (e.type === 'hit') {
        const big = e.kind === 'super' || e.damage >= 90;
        this.star(e.x, e.y, e.kind === 'super' ? '#fff27a' : '#ffd34d', big ? 16 : 10, big ? 12 : 9);
        this.impact(e.x, e.y, big ? '#ffffff' : '#fff1b0', big ? 22 : 14);
        this.burst(e.x, e.y, e.kind === 'super' ? '#fff27a' : '#ffb347', big ? 12 : 6, 16);
      } else if (e.type === 'block') { this.shield(e.x, e.y); this.burst(e.x, e.y, '#7ad7ff', 5, 10); }
      else if (e.type === 'clash') this.burst(e.x, e.y, '#ffffff', 10, 16);
      else if (e.type === 'throw') { const d = state.fighters[e.defender]; this.burst(d.x, d.y + 50, '#ffb347', 8, 16); }
      else if (e.type === 'max') { const f = state.fighters[e.player]; this.ring(f.x, f.y + 50, '#ff6a2b'); }
    }
    this.items = this.items.filter(it => --it.life > 0);
  }

  burst(x, y, color, n, life) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.items.push({ x, y, vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 2.2, color, life, max: life, size: 3 });
    }
  }

  // 放射状光芒（打击感的主体）：几条向外伸长又缩回的光线
  star(x, y, color, len, life) {
    const n = 8;
    const rot = (x * 7 + y * 13) % 10 / 10;
    for (let i = 0; i < n; i++) {
      const a = ((i + rot) / n) * Math.PI * 2;
      this.items.push({ kind: 'ray', x, y, a, len: i % 2 ? len : len * 0.6, color, life, max: life });
    }
  }

  // 冲击圈：一个快速扩大的空心圆
  impact(x, y, color, r) { this.items.push({ kind: 'circle', x, y, r, color, life: 8, max: 8 }); }

  // 防御：竖向的半圆护盾
  shield(x, y) { this.items.push({ kind: 'shield', x, y, color: '#9fe3ff', life: 10, max: 10 }); }

  ring(x, y, color) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      this.items.push({ x, y, vx: Math.cos(a) * 3.5, vy: Math.sin(a) * 3.5, color, life: 20, max: 20, size: 2 });
    }
  }

  draw(ctx, cam) {
    for (const it of this.items) {
      const age = it.max - it.life;
      const t = age / it.max;
      if (it.kind) {
        const cx = it.x - cam, cy = GROUND - it.y;
        ctx.save();
        ctx.globalAlpha = 1 - t * 0.8;
        ctx.strokeStyle = t > 0.6 ? '#ffffff' : it.color;
        if (it.kind === 'ray') {
          const r0 = 3 + t * 6, r1 = r0 + it.len * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5) * (1 - t * 0.5);
          ctx.lineWidth = Math.max(1, 3 - t * 3);
          ctx.beginPath();
          ctx.moveTo(Math.round(cx + Math.cos(it.a) * r0), Math.round(cy + Math.sin(it.a) * r0));
          ctx.lineTo(Math.round(cx + Math.cos(it.a) * r1), Math.round(cy + Math.sin(it.a) * r1));
          ctx.stroke();
        } else if (it.kind === 'circle') {
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(Math.round(cx), Math.round(cy), 2 + it.r * t, 0, Math.PI * 2);
          ctx.stroke();
        } else if (it.kind === 'shield') {
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(Math.round(cx), Math.round(cy), 12 + t * 6, -Math.PI / 2.2, Math.PI / 2.2);
          ctx.arc(Math.round(cx), Math.round(cy), 12 + t * 6, Math.PI - Math.PI / 2.2, Math.PI + Math.PI / 2.2);
          ctx.stroke();
        }
        ctx.restore();
        continue;
      }
      const x = Math.round(it.x + it.vx * age - cam);
      const y = Math.round(GROUND - (it.y + it.vy * age));
      ctx.fillStyle = it.life < it.max / 3 ? '#ffffff' : it.color;
      ctx.fillRect(x, y, it.size, it.size);
    }
  }

  count() { return this.items.length; }
}
