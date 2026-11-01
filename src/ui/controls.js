// 键盘与手柄。键位改动时 README 和出招表说明要同步。
export const KEYMAP = [
  // P1：WASD 移动；U I O = 轻/中/重拳；J K L = 轻/中/重脚
  { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', KeyU: 'lp', KeyI: 'mp', KeyO: 'hp', KeyJ: 'lk', KeyK: 'mk', KeyL: 'hk' },
  // P2：方向键移动；小键盘 7 8 9 = 轻/中/重拳；4 5 6 = 轻/中/重脚
  { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Numpad7: 'lp', Numpad8: 'mp', Numpad9: 'hp', Numpad4: 'lk', Numpad5: 'mk', Numpad6: 'hk' },
];

// 标准手柄布局：X=轻拳 Y=中拳 RB=重拳 A=轻脚 B=中脚 RT=重脚，十字键/左摇杆移动
const PAD = { 2: 'lp', 3: 'mp', 5: 'hp', 0: 'lk', 1: 'mk', 7: 'hk', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };

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
