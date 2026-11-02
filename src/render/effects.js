// 特效层（V1 华丽演出）：命中光爆、火花、冲击波、防御护盾、扬尘、爆气光圈、超必杀聚气。
// 坐标是逻辑坐标（384×224 空间，y 向上为正、以地面为 0），由渲染器在高清画布上统一缩放绘制。
// 只读引擎事件，不影响对战结果。
import { SCREEN } from '../engine/constants.js';

const GROUND = SCREEN.groundY;

// 确定性的伪随机（同一事件每次播放都一样，便于测试复现）
function prng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; };
}

export class Effects {
  constructor() { this.items = []; this.seq = 1; }

  ingest(state) {
    for (const e of state.events) {
      if (e.type === 'hit') {
        const sup = e.kind === 'super';
        const big = sup || e.damage >= 90;
        const col = sup ? '#fff27a' : big ? '#ffd34d' : '#ffe9a8';
        this.glow(e.x, e.y, sup ? 46 : big ? 30 : 18, sup ? '#fff4b0' : '#ffe2a0', sup ? 12 : 8);
        this.star(e.x, e.y, col, sup ? 26 : big ? 18 : 11, big ? 12 : 9);
        this.impact(e.x, e.y, '#ffffff', sup ? 40 : big ? 24 : 14);
        this.sparks(e.x, e.y, sup ? '#fff27a' : '#ffb347', sup ? 22 : big ? 14 : 7, sup ? 4.2 : big ? 3.2 : 2.4, e.attacker);
        if (sup) this.wave(e.x, e.y, '#ffe680', 70, 18);
      } else if (e.type === 'block') {
        this.shield(e.x, e.y);
        this.glow(e.x, e.y, 14, '#9fe3ff', 6);
        this.sparks(e.x, e.y, '#7ad7ff', 6, 2.2, e.defender);
      } else if (e.type === 'clash') {
        this.glow(e.x, e.y, 30, '#ffffff', 10);
        this.sparks(e.x, e.y, '#ffffff', 14, 3.5, 0);
        this.wave(e.x, e.y, '#ffffff', 40, 12);
      } else if (e.type === 'throw') {
        const d = state.fighters[e.defender];
        this.glow(d.x, d.y + 50, 22, '#ffd8a0', 8);
        this.sparks(d.x, d.y + 50, '#ffb347', 10, 3, e.attacker);
      } else if (e.type === 'max') {
        const f = state.fighters[e.player];
        this.ring(f.x, f.y + 50, '#ff6a2b');
        this.wave(f.x, f.y + 50, '#ff8a3a', 60, 20);
        this.glow(f.x, f.y + 50, 40, '#ffb070', 14);
      } else if (e.type === 'super') {
        const f = state.fighters[e.player];
        this.charge(f.x, f.y + 55, e.sdm ? '#ff6a2b' : '#fff27a');
        this.glow(f.x, f.y + 55, 50, e.sdm ? '#ff9a50' : '#fff4b0', 30);
      } else if (e.type === 'knockdown') {
        const f = state.fighters[e.player];
        this.dust(f.x, 0, 10, 1.6);
      } else if (e.type === 'roll') {
        const f = state.fighters[e.player];
        this.dust(f.x, 0, 5, 1);
      } else if (e.type === 'ko') {
        for (const f of state.fighters) if (e.loser === 'both' || e.loser === f.index) {
          this.glow(f.x, f.y + 50, 60, '#ffffff', 16);
          this.wave(f.x, f.y + 50, '#ffffff', 90, 24);
          this.sparks(f.x, f.y + 50, '#fff27a', 26, 4.5, f.index + 7);
        }
      }
    }
    this.items = this.items.filter(it => --it.life > 0);
  }

  // 落地扬尘（渲染器检测到落地时也会调用）
  dust(x, y, n = 6, power = 1) {
    const r = prng(Math.round(x * 31 + this.seq++));
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1;
      this.items.push({ kind: 'dust', x: x + dir * r() * 10, y: y + 2, vx: dir * (0.4 + r() * 1.2) * power, vy: 0.2 + r() * 0.5, r: 4 + r() * 4 * power, life: 26, max: 26 });
    }
  }

  burst(x, y, color, n, life) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.items.push({ x, y, vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 2.2, color, life, max: life, size: 3 });
    }
  }

  // 火花：带拖尾、受重力的亮点
  sparks(x, y, color, n, speed, seed) {
    const r = prng(Math.round(x * 13 + y * 7 + seed * 101 + this.seq++));
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const v = speed * (0.5 + r() * 0.8);
      const life = 12 + Math.floor(r() * 10);
      this.items.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 1, color, life, max: life });
    }
  }

  // 放射状光芒
  star(x, y, color, len, life) {
    const n = 8;
    const rot = (x * 7 + y * 13) % 10 / 10;
    for (let i = 0; i < n; i++) {
      const a = ((i + rot) / n) * Math.PI * 2;
      this.items.push({ kind: 'ray', x, y, a, len: i % 2 ? len : len * 0.6, color, life, max: life });
    }
  }

  // 冲击圈
  impact(x, y, color, r) { this.items.push({ kind: 'circle', x, y, r, color, life: 8, max: 8 }); }

  // 大冲击波（粗环，快速扩散变细）
  wave(x, y, color, r, life) { this.items.push({ kind: 'wave', x, y, r, color, life, max: life }); }

  // 光爆：径向渐变的加亮圆
  glow(x, y, r, color, life) { this.items.push({ kind: 'glow', x, y, r, color, life, max: life }); }

  // 防御护盾
  shield(x, y) { this.items.push({ kind: 'shield', x, y, color: '#9fe3ff', life: 10, max: 10 }); }

  ring(x, y, color) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      this.items.push({ x, y, vx: Math.cos(a) * 3.5, vy: Math.sin(a) * 3.5, color, life: 20, max: 20, size: 2 });
    }
  }

  // 超必杀聚气：光点从四周向角色收拢
  charge(x, y, color) {
    const r = prng(Math.round(x * 3 + this.seq++));
    for (let i = 0; i < 28; i++) {
      const a = r() * Math.PI * 2, d = 50 + r() * 40;
      this.items.push({ kind: 'charge', x, y, a, d, color, life: 28, max: 28 });
    }
  }

  kinds() {
    const out = {};
    for (const it of this.items) { const k = it.kind ?? 'dot'; out[k] = (out[k] ?? 0) + 1; }
    return out;
  }

  draw(ctx, cam) {
    for (const it of this.items) {
      const age = it.max - it.life;
      const t = age / it.max;
      const cx = it.x - cam, cy = GROUND - it.y;
      switch (it.kind) {
        case 'glow': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const r = it.r * (0.6 + t * 0.6);
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - t)})`);
          g.addColorStop(0.35, hexA(it.color, 0.7 * (1 - t)));
          g.addColorStop(1, hexA(it.color, 0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          break;
        }
        case 'spark': {
          const x = cx + it.vx * age, y = cy - (it.vy * age - 0.12 * age * age);
          const vx = it.vx, vy = -(it.vy - 0.24 * age);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 1 - t * 0.7;
          ctx.strokeStyle = t < 0.4 ? '#ffffff' : it.color;
          ctx.lineWidth = Math.max(0.6, 1.8 * (1 - t));
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - vx * 2.2, y - vy * 2.2); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'wave': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = (1 - t) * 0.9;
          ctx.strokeStyle = it.color;
          ctx.lineWidth = Math.max(0.5, 7 * (1 - t));
          ctx.beginPath(); ctx.ellipse(cx, cy, 4 + it.r * easeOut(t), (4 + it.r * easeOut(t)) * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'charge': {
          const k = 1 - easeOut(t);
          const x = cx + Math.cos(it.a) * it.d * k, y = cy + Math.sin(it.a) * it.d * k * 0.7;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = Math.min(1, t * 3) * (1 - t * 0.3);
          ctx.strokeStyle = it.color;
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(it.a) * 6 * k, y + Math.sin(it.a) * 4 * k); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'dust': {
          const x = cx + it.vx * age, y = cy - it.vy * age - age * 0.15;
          ctx.save();
          ctx.globalAlpha = 0.45 * (1 - t);
          ctx.fillStyle = '#b8a890';
          ctx.beginPath(); ctx.arc(x, y, it.r * (0.6 + t * 1.2), 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          break;
        }
        case 'ray': case 'circle': case 'shield': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 1 - t * 0.8;
          ctx.strokeStyle = t > 0.6 ? '#ffffff' : it.color;
          if (it.kind === 'ray') {
            const r0 = 3 + t * 6, r1 = r0 + it.len * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5) * (1 - t * 0.5);
            ctx.lineWidth = Math.max(0.8, 3 - t * 3);
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(it.a) * r0, cy + Math.sin(it.a) * r0);
            ctx.lineTo(cx + Math.cos(it.a) * r1, cy + Math.sin(it.a) * r1);
            ctx.stroke();
          } else if (it.kind === 'circle') {
            ctx.lineWidth = 2 * (1 - t) + 0.5;
            ctx.beginPath(); ctx.arc(cx, cy, 2 + it.r * easeOut(t), 0, Math.PI * 2); ctx.stroke();
          } else {
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy, 12 + t * 6, -Math.PI / 2.2, Math.PI / 2.2);
            ctx.arc(cx, cy, 12 + t * 6, Math.PI - Math.PI / 2.2, Math.PI + Math.PI / 2.2);
            ctx.stroke();
          }
          ctx.restore();
          break;
        }
        default: {
          const x = it.x + it.vx * age - cam;
          const y = GROUND - (it.y + it.vy * age);
          ctx.fillStyle = it.life < it.max / 3 ? '#ffffff' : it.color;
          ctx.fillRect(x, y, it.size, it.size);
        }
      }
    }
  }

  count() { return this.items.length; }
}

const easeOut = (t) => 1 - (1 - t) * (1 - t);

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}
