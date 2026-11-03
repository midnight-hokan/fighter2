// 键盘与手柄。键位改动时 README 和出招表说明要同步。
export const KEYMAP = [
  // 拳皇式 4 键：A 轻拳 / B 轻脚 / C 重拳 / D 重脚
  // P1：WASD 移动；J = A　K = B　U = C　I = D
  { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', KeyJ: 'lp', KeyK: 'lk', KeyU: 'hp', KeyI: 'hk' },
  // P2：方向键移动；小键盘 1 = A　2 = B　4 = C　5 = D
  { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Numpad1: 'lp', Numpad2: 'lk', Numpad4: 'hp', Numpad5: 'hk' },
];

// 标准手柄（拳皇布局）：X=A 轻拳 A=B 轻脚 Y=C 重拳 B=D 重脚，十字键/左摇杆移动
const PAD = { 2: 'lp', 0: 'lk', 3: 'hp', 1: 'hk', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };

export class Controls {
  constructor() {
    this.down = new Set();
    this.listeners = [];
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.listeners.forEach(fn => fn(e.code, e));
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    this.padPrev = [{}, {}];
    this.extra = [null, null]; // 额外输入源（触屏），返回 { left, lp, ... }
  }

  onKey(fn) { this.listeners.push(fn); }

  pad(i) {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const p = pads[i];
    const out = {};
    if (!p) return out;
    for (const [idx, btn] of Object.entries(PAD)) if (p.buttons[idx]?.pressed) out[btn] = true;
    const [ax, ay] = p.axes;
    if (ax < -0.5) out.left = true;
    if (ax > 0.5) out.right = true;
    if (ay < -0.5) out.up = true;
    if (ay > 0.5) out.down = true;
    // 手柄 Start / A 也能用于菜单确认
    const startNow = !!p.buttons[9]?.pressed;
    if (startNow && !this.padPrev[i].start) this.listeners.forEach(fn => fn('Enter', { pad: i }));
    this.padPrev[i] = { start: startNow };
    return out;
  }

  read(player) {
    const out = {};
    for (const [code, btn] of Object.entries(KEYMAP[player])) if (this.down.has(code)) out[btn] = true;
    return { ...this.pad(player), ...(this.extra[player]?.() ?? {}), ...out };
  }
}
