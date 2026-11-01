// 打击火花、防御火花、道具对消、爆气光圈。全部是像素小方块，几帧后消失。
import { SCREEN } from '../engine/constants.js';

const GROUND = SCREEN.groundY;

export class Effects {
  constructor() { this.items = []; }

  ingest(state) {
    for (const e of state.events) {
      if (e.type === 'hit') this.burst(e.x, e.y, e.kind === 'super' ? '#fff27a' : '#ffd34d', e.kind === 'super' ? 14 : 8, 18);
      else if (e.type === 'block') this.burst(e.x, e.y, '#7ad7ff', 6, 12);
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

  ring(x, y, color) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      this.items.push({ x, y, vx: Math.cos(a) * 3.5, vy: Math.sin(a) * 3.5, color, life: 20, max: 20, size: 2 });
    }
  }

  draw(ctx, cam) {
    for (const it of this.items) {
      const age = it.max - it.life;
      const x = Math.round(it.x + it.vx * age - cam);
      const y = Math.round(GROUND - (it.y + it.vy * age));
      ctx.fillStyle = it.life < it.max / 3 ? '#ffffff' : it.color;
      ctx.fillRect(x, y, it.size, it.size);
    }
  }

  count() { return this.items.length; }
}
