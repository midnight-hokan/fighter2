// 触屏操作：左侧虚拟摇杆（8 方向），右侧 6 个攻击键 + "必杀"键（简易出招）+ 右上角菜单键。
// 只在触屏设备上显示（pointer: coarse），?touch=1 可在电脑上强制显示。
// "必杀"键：不用搓招，按住方向再按必杀 —— 不推 = 第 1 招，前 = 第 2 招，后 = 第 3 招，下 = 超必杀（要有豆）。
export const isTouchDevice = () => new URLSearchParams(location.search).has('touch')
  || (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);

const BTNS = [['lp', 'A'], ['lk', 'B'], ['hp', 'C'], ['hk', 'D']];

export class TouchPad {
  constructor(parent, { onKey, onSpecial }) {
    this.state = {};
    this.onKey = onKey;
    this.onSpecial = onSpecial;
    this.root = document.createElement('div');
    this.root.id = 'touch-root';
    this.root.innerHTML = `
      <div class="tp-stick" data-testid="touch-stick"><div class="tp-knob"></div></div>
      <div class="tp-btns">
        ${BTNS.map(([b, t]) => `<div class="tp-btn tp-${b}" data-b="${b}" data-testid="touch-${b}">${t}</div>`).join('')}
        <div class="tp-btn tp-sp" data-testid="touch-sp">必杀</div>
      </div>
      <div class="tp-menu" data-testid="touch-menu">☰</div>
      <div class="tp-rotate">请把手机横过来玩</div>`;
    parent.appendChild(this.root);
    document.body.classList.add('touch');
    this.bindStick();
    this.root.querySelectorAll('.tp-btn[data-b]').forEach((el) => this.bindButton(el, el.dataset.b));
    this.bindButton(this.root.querySelector('.tp-sp'), null, () => this.onSpecial?.(this.dir()));
    this.root.querySelector('.tp-menu').addEventListener('pointerdown', (e) => { e.preventDefault(); this.onKey?.('Escape'); });
  }

  // 当前摇杆方向（屏幕方向）：{ x: -1|0|1, y: -1|0|1 }，y = 1 为下
  dir() { return { x: this.state.right ? 1 : this.state.left ? -1 : 0, y: this.state.down ? 1 : this.state.up ? -1 : 0 }; }

  read() { return { ...this.state }; }

  setVisible(v) { this.root.style.display = v ? '' : 'none'; }

  bindButton(el, key, onPress) {
    const down = (e) => {
      e.preventDefault();
      try { el.setPointerCapture?.(e.pointerId); } catch { /* 合成事件无法捕获 */ }
      el.classList.add('on');
      if (key) this.state[key] = true;
      onPress?.();
    };
    const up = (e) => { e.preventDefault(); el.classList.remove('on'); if (key) this.state[key] = false; };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  bindStick() {
    const base = this.root.querySelector('.tp-stick');
    const knob = this.root.querySelector('.tp-knob');
    let id = null;
    const set = (e) => {
      const r = base.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const max = r.width / 2;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const dead = max * 0.3;
      const ang = Math.atan2(dy, dx);
      const on = len > dead;
      // 8 方向：每个方向 45°，斜方向更容易按出
      this.state.right = on && Math.cos(ang) > 0.38;
      this.state.left = on && Math.cos(ang) < -0.38;
      this.state.down = on && Math.sin(ang) > 0.38;
      this.state.up = on && Math.sin(ang) < -0.38;
    };
    const reset = () => { id = null; knob.style.transform = ''; this.state.left = this.state.right = this.state.up = this.state.down = false; };
    base.addEventListener('pointerdown', (e) => { e.preventDefault(); id = e.pointerId; try { base.setPointerCapture?.(e.pointerId); } catch { /* 合成事件 */ } set(e); });
    base.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
    base.addEventListener('pointerup', (e) => { if (e.pointerId === id) reset(); });
    base.addEventListener('pointercancel', reset);
  }
}

// 简易出招映射：方向（相对朝向）→ 招式 id
export function simpleSpecialFor(character, { forward, back, down }) {
  const sp = character.specials ?? [];
  const su = character.supers ?? [];
  if (down) return su[0]?.id ?? null;
  if (forward) return sp[1]?.id ?? sp[0]?.id ?? null;
  if (back) return sp[2]?.id ?? sp[0]?.id ?? null;
  return sp[0]?.id ?? null;
}
