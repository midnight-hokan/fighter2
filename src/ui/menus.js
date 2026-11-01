// 标题页、选人页、暂停出招表。
// 流程：标题（Enter）→ 选人：P1 用 WASD 移光标、Enter 确认 → P2/电脑 用方向键、Enter 确认 → 开打
// 模式在选人页用 Q / E 切换（也可以鼠标点）。连按 3 次 Enter 用默认选项直接开打。
// 【R3 由大炮实现】加入 { id: 'arcade', label: '街机模式' }（追加在最后，不要改动已有模式的顺序，测试依赖默认模式），街机模式下 P2 由电脑按顺序安排。
export const MODES = [
  { id: 'cpu-normal', label: '对电脑·普通' },
  { id: 'cpu-hard', label: '对电脑·困难' },
  { id: 'cpu-easy', label: '对电脑·简单' },
  { id: '2p', label: '本地双人' },
  { id: 'training', label: '训练模式' },
];

const ARROWS = { 1: '↙', 2: '↓', 3: '↘', 4: '←', 6: '→', 7: '↖', 8: '↑', 9: '↗' };
const BTN = { P: '拳', K: '脚', LP: '轻拳', MP: '中拳', HP: '重拳', LK: '轻脚', MK: '中脚', HK: '重脚' };

export function prettyInput(cmd) {
  const m = /^(\[([1-9])\])?([1-9]*|360)([PK]|LP|MP|HP|LK|MK|HK)$/.exec(cmd);
  if (!m) return cmd;
  const [, , charge, motion, b] = m;
  if (motion === '360') return `转一圈 + ${BTN[b]}`;
  if (charge) return `${ARROWS[charge]}蓄 ${ARROWS[motion]} + ${BTN[b]}`;
  return `${motion.split('').map(d => ARROWS[d]).join('')} + ${BTN[b]}`;
}

export function moveListHtml(ch) {
  const row = (name, input, desc = '') => `<tr><td>${name}</td><td class="cmd">${input}</td><td class="desc">${desc}</td></tr>`;
  return `<h3>${ch.name}<small>${ch.title}</small></h3><table>
    ${(ch.specials ?? []).map(s => row(s.name, prettyInput(s.input), s.desc ?? '')).join('')}
    ${(ch.supers ?? []).map(s => row(`<b>${s.name}</b>`, prettyInput(s.input), `超必杀，消耗 1 豆。${s.desc ?? ''}`)).join('')}
    ${row('投技', '近身 → 或 ← + 重拳/重脚')}
    </table>`;
}

export const SYSTEM_MOVES = [
  ['紧急回避', '轻拳 + 轻脚（加 ← 向后滚）', '翻滚，前半段无敌'],
  ['爆气（MAX）', '轻拳 + 中拳 + 重拳', '消耗 1 豆，8 秒内攻击力提升'],
  ['MAX 超必杀', '爆气中输入超必杀指令', '再消耗 1 豆，威力大增'],
  ['防御反击', '防御中 重拳 + 重脚', '消耗 1 豆，弹开对手'],
  ['防御回避', '防御中 轻拳 + 轻脚', '消耗 1 豆，从防御中翻滚脱身'],
  ['防御', '按住 ←（蹲防 ↙）', '下段攻击要蹲防，跳攻要站防'],
];

export function systemHtml() {
  return `<h3>通用系统</h3><table>${SYSTEM_MOVES.map(([a, b, c]) => `<tr><td>${a}</td><td class="cmd">${b}</td><td class="desc">${c}</td></tr>`).join('')}</table>`;
}

export class Menus {
  constructor(root, theme, controls, { onStart, version }) {
    this.root = root;
    this.theme = theme;
    this.onStart = onStart;
    this.version = version;
    this.stage = 'title';
    this.cursor = [0, Math.min(1, theme.roster.length - 1)];
    this.modeIndex = 0;
    this.picking = 0;
    controls.onKey((code) => this.key(code));
    this.render();
  }

  show() { this.stage = 'title'; this.picking = 0; this.render(); }

  key(code) {
    if (this.stage === 'hidden') return;
    const n = this.theme.roster.length;
    const cols = 4;
    if (code === 'Enter') {
      if (this.stage === 'title') { this.stage = 'select'; this.picking = 0; }
      else if (this.stage === 'select') {
        if (this.picking === 0) this.picking = 1;
        else { this.start(); return; }
      }
      this.render();
      return;
    }
    if (this.stage !== 'select') return;
    const move = (p, dx, dy) => {
      let i = this.cursor[p] + dx + dy * cols;
      i = ((i % n) + n) % n;
      this.cursor[p] = i;
    };
    const p = this.picking;
    if (p === 0) {
      if (code === 'KeyA') move(0, -1, 0);
      if (code === 'KeyD') move(0, 1, 0);
      if (code === 'KeyW') move(0, 0, -1);
      if (code === 'KeyS') move(0, 0, 1);
    } else {
      if (code === 'ArrowLeft' || code === 'KeyA') move(1, -1, 0);
      if (code === 'ArrowRight' || code === 'KeyD') move(1, 1, 0);
      if (code === 'ArrowUp' || code === 'KeyW') move(1, 0, -1);
      if (code === 'ArrowDown' || code === 'KeyS') move(1, 0, 1);
    }
    if (code === 'KeyQ') this.modeIndex = (this.modeIndex + MODES.length - 1) % MODES.length;
    if (code === 'KeyE') this.modeIndex = (this.modeIndex + 1) % MODES.length;
    if (code === 'Escape' || code === 'Backspace') { if (this.picking === 1) this.picking = 0; else this.stage = 'title'; }
    this.render();
  }

  start() {
    this.stage = 'hidden';
    this.render();
    const ids = this.cursor.map(i => this.theme.roster[i].id);
    this.onStart({ characters: ids, mode: MODES[this.modeIndex].id });
  }

  render() {
    const T = this.theme;
    if (this.stage === 'hidden') { this.root.innerHTML = ''; return; }
    if (this.stage === 'title') {
      this.root.innerHTML = `<div class="screen title" data-testid="title-screen">
        <div class="logo">${T.title}</div><div class="sub">${T.subtitle}</div>
        <div class="blink">${T.text.pressStart}</div>
        <div class="version" data-testid="version">版本 ${this.version}</div></div>`;
      this.root.querySelector('.title').onclick = () => this.key('Enter');
      return;
    }
    const cards = T.roster.map((c, i) => {
      const tags = [this.cursor[0] === i ? '<span class="tag p1">1P</span>' : '', this.cursor[1] === i ? '<span class="tag p2">2P</span>' : ''].join('');
      return `<div class="card${this.cursor[this.picking] === i ? ' active' : ''}" data-testid="char-${c.id}" data-i="${i}">
        <div class="portrait" style="background:${c.colors?.primary ?? '#888'}"><div class="belt" style="background:${c.colors?.secondary ?? '#ddd'}"></div></div>
        <div class="cname">${c.name}</div><div class="ctitle">${c.title}</div>${tags}</div>`;
    }).join('');
    const modes = MODES.map((m, i) => `<div class="mode${i === this.modeIndex ? ' on' : ''}" data-testid="mode-${m.id}" data-m="${i}">${m.label}</div>`).join('');
    const who = this.picking === 0 ? '1P 选择角色（WASD 移动，Enter 确认）' : (MODES[this.modeIndex].id === '2p' ? '2P 选择角色（方向键移动，Enter 确认）' : '选择对手（方向键移动，Enter 确认）');
    this.root.innerHTML = `<div class="screen select" data-testid="select-screen">
      <h2>${T.text.select}</h2><div class="grid">${cards}</div>
      <div class="modes">${modes}</div><div class="hint">${who}　｜　Q / E 切换模式　｜　Esc 返回</div></div>`;
    this.root.querySelectorAll('.card').forEach(el => { el.onclick = () => { this.cursor[this.picking] = Number(el.dataset.i); this.render(); }; });
    this.root.querySelectorAll('.mode').forEach(el => { el.onclick = () => { this.modeIndex = Number(el.dataset.m); this.render(); }; });
  }
}

export class Pause {
  constructor(root) { this.root = root; this.open = false; }
  toggle(chars) {
    this.open = !this.open;
    this.root.innerHTML = this.open ? `<div class="screen pause" data-testid="movelist">
      <h2>出招表（Esc 继续，Backspace 回选人）</h2>
      <div class="lists">${chars.map(moveListHtml).join('')}${systemHtml()}</div></div>` : '';
    return this.open;
  }
  close() { this.open = false; this.root.innerHTML = ''; }
}
