// 输入：规范化、小键盘记法、输入历史（含蓄力计数）、指令解析与匹配。
import { BUTTONS, PUNCHES, KICKS, INPUT, STRENGTH } from './constants.js';

export function normalizeInput(raw = {}) {
  const out = {};
  for (const b of BUTTONS) out[b] = !!raw[b];
  // 简易出招（触屏一键必杀）：special = 必杀技/超必杀的 id，只在按下的那一帧传入
  if (typeof raw.special === 'string') out.special = raw.special;
  if (out.left && out.right) { out.left = false; out.right = false; }
  if (out.up && out.down) { out.up = false; out.down = false; }
  return out;
}

// 相对朝向的小键盘记法：6 = 前，4 = 后，2 = 下，8 = 上
export function toNumpad(input, facing) {
  const fwd = facing >= 0 ? input.right : input.left;
  const back = facing >= 0 ? input.left : input.right;
  const h = fwd ? 1 : back ? -1 : 0;
  const v = input.up ? 1 : input.down ? -1 : 0;
  return 5 + h + v * 3;
}

const isBack = (d) => d === 1 || d === 4 || d === 7;
const isDown = (d) => d === 1 || d === 2 || d === 3;

export class InputHistory {
  constructor() { this.clear(); }
  clear() {
    this.frames = [];
    this.prev = normalizeInput();
    this.backCharge = 0;
    this.downCharge = 0;
  }
  push(input, facing) {
    const pressed = {};
    for (const b of BUTTONS) pressed[b] = input[b] && !this.prev[b];
    const dir = toNumpad(input, facing);
    this.backCharge = isBack(dir) ? this.backCharge + 1 : 0;
    this.downCharge = isDown(dir) ? this.downCharge + 1 : 0;
    this.frames.push({ input, pressed, dir, backCharge: this.backCharge, downCharge: this.downCharge });
    if (this.frames.length > INPUT.history) this.frames.shift();
    this.prev = input;
  }
  latest() { return this.frames[this.frames.length - 1]; }
  recent(n) { return this.frames.slice(-n); }

  // 最近 window 帧内是否按下过某个键
  pressedWithin(button, window) {
    return this.recent(window).some(f => f.pressed[button]);
  }

  // 双击方向（拳皇的跑步 66 / 后撤步 44）：本帧刚推到 dir，且 window 帧内此前已推到过一次 dir 再松开
  doubleTap(match, window = 14) {
    const fr = this.recent(window + 1);
    const n = fr.length;
    if (n < 3 || !match(fr[n - 1].dir) || match(fr[n - 2].dir)) return false;
    // 第一下必须是"点"（按住不超过 8 帧），避免把长按（如防御按住后）误判成双击
    // 两下之间必须回中（拳皇 6 5 6 / 4 5 4），搓招里经过的斜方向、下方向不算，避免 214214 之类的指令误触后撤步
    let i = n - 2;
    while (i >= 0 && !match(fr[i].dir)) { if (fr[i].dir !== 5) return false; i--; }
    if (i < 0) return false;
    let len = 0;
    while (i >= 0 && match(fr[i].dir)) { len++; i--; }
    return len <= 8 && i >= -1 && (i >= 0 || fr.length <= window + 1);
  }

  // 大跳（拳皇 2→8）：本帧刚推到上方向，且 window 帧内按过下
  superJump(window = 10) {
    const fr = this.recent(window + 1);
    const n = fr.length;
    const up = (d) => d >= 7;
    if (n < 2 || !up(fr[n - 1].dir) || up(fr[n - 2].dir)) return false;
    return fr.slice(0, -1).some(f => f.dir >= 1 && f.dir <= 3);
  }

  // 同时按键：buttons 全部在 window 帧内按下过，且至少一个是本帧按下
  simul(buttons, window = INPUT.simulWindow) {
    const last = this.latest();
    if (!last || !buttons.some(b => last.pressed[b])) return false;
    return buttons.every(b => this.pressedWithin(b, window));
  }
}

// ---------- 指令解析 ----------
// 支持：'236P' '623K' '214P' '41236K' '63214P' '236236P' '214214K' '[4]6P' '[2]8K' '360P'
// 按键部分：P = 任意拳，K = 任意脚，也可写具体键 LP/MP/HP/LK/MK/HK
export function parseCommand(cmd) {
  const m = /^(\[([1-9])\])?([1-9]*|360)([PK]|LP|MP|HP|LK|MK|HK)$/.exec(cmd);
  if (!m) throw new Error(`无法解析的指令：${cmd}`);
  const [, , charge, motion, button] = m;
  if (motion === '360') return { type: '360', button, cmd };
  if (charge) {
    if (motion.length !== 1) throw new Error(`蓄力指令格式应为 [4]6P：${cmd}`);
    return { type: 'charge', from: Number(charge), to: Number(motion), button, cmd };
  }
  if (!motion.length) throw new Error(`缺少方向：${cmd}`);
  return { type: 'motion', dirs: motion.split('').map(Number), button, cmd };
}

export function commandLength(parsed) {
  if (parsed.type === 'motion') return parsed.dirs.length;
  if (parsed.type === '360') return 4;
  return 2;
}

// 本帧按下的、满足按键要求的键（最强的那个）；没有返回 null
export function pressedButton(frame, spec) {
  const pool = spec === 'P' ? PUNCHES : spec === 'K' ? KICKS : [spec.toLowerCase()];
  for (const b of [...pool].reverse()) if (frame.pressed[b]) return b;
  return null;
}

const near = (want, got) => {
  // 方向宽容：6 也接受 3/9 以外的严格匹配；这里采用严格匹配，但 6/4 接受同列斜向作为蓄力释放
  return want === got;
};

function matchMotion(frames, dirs, window) {
  // 从最后一帧往回找：最后一个方向必须在最近 stepWindow 帧内出现
  let idx = frames.length - 1;
  const end = idx;
  let first = idx;
  for (let k = dirs.length - 1; k >= 0; k--) {
    let found = -1;
    const limit = k === dirs.length - 1 ? INPUT.stepWindow : INPUT.stepWindow;
    for (let j = idx; j >= 0 && idx - j <= limit; j--) {
      if (near(dirs[k], frames[j].dir)) { found = j; break; }
    }
    if (found < 0) return false;
    first = found;
    idx = found - (k > 0 && dirs[k - 1] === dirs[k] ? 1 : 0);
  }
  return end - first <= window;
}

const col = { 6: [3, 6, 9], 4: [1, 4, 7], 8: [7, 8, 9], 2: [1, 2, 3] };

function matchCharge(frames, from, to) {
  // 最近 chargeWindow 帧内某一帧方向为 to（同列斜向也算），且它前一帧的蓄力足够
  const n = frames.length;
  for (let j = n - 1; j >= Math.max(1, n - 1 - INPUT.chargeWindow); j--) {
    if (!col[to].includes(frames[j].dir)) continue;
    const prev = frames[j - 1];
    const charge = from === 4 ? prev.backCharge : prev.downCharge;
    if (charge >= INPUT.chargeFrames) return true;
  }
  return false;
}

function match360(frames) {
  const recent = frames.slice(-INPUT.motionWindow);
  return [6, 2, 4, 8].every(d => recent.some(f => col[d].includes(f.dir)));
}

// 判断历史是否满足某条指令；满足则返回本帧按下的键（用于判断强度），否则 null
export function matchCommand(history, parsed) {
  const frames = history.frames;
  const last = frames[frames.length - 1];
  if (!last) return null;
  const button = pressedButton(last, parsed.button);
  if (!button) return null;
  let ok = false;
  if (parsed.type === 'motion') {
    const window = parsed.dirs.length >= 6 ? INPUT.superWindow : INPUT.motionWindow;
    ok = matchMotion(frames, parsed.dirs, window);
  } else if (parsed.type === 'charge') {
    ok = matchCharge(frames, parsed.from, parsed.to);
  } else {
    ok = match360(frames);
  }
  return ok ? button : null;
}

export const strengthOf = (button) => STRENGTH[button] ?? 'm';
