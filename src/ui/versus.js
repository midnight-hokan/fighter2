// 对战前的 VS 画面：双方立绘从两侧冲进来，中间砸下"VS"，约 1.8 秒后自动开打（Enter / 点击可跳过）。
export class Versus {
  constructor(parent, theme) {
    this.theme = theme;
    this.root = document.createElement('div');
    this.root.id = 'versus-root';
    parent.appendChild(this.root);
    this.active = false;
    this.root.addEventListener('pointerdown', (e) => { if (this.active) { e.preventDefault(); this.input(); } });
  }

  card(c, side) {
    const img = `assets/${this.theme.id}/select/${c.id}.jpg`;
    return `<div class="vs-side vs-${side}" style="--c:${c.colors?.primary ?? '#888'}">
      <img src="${img}" alt="" onerror="this.remove()">
      <div class="vs-name"><b>${c.name}</b><span>${c.title ?? ''}</span></div></div>`;
  }

  play(p1, p2, { caption = '', duration = 1800 } = {}) {
    if (this.active) this.skip();
    this.active = true;
    this.startedAt = performance.now();
    this.root.innerHTML = `<div class="versus" data-testid="versus">${this.card(p1, 'l')}${this.card(p2, 'r')}
      <div class="vs-mark">VS</div>${caption ? `<div class="vs-cap">${caption}</div>` : ''}</div>`;
    return new Promise((res) => { this.done = res; this.timer = setTimeout(() => this.skip(), duration); });
  }

  // 玩家按键跳过：刚出现的 0.4 秒内不响应（避免确认开打的那一下按键把它直接跳过）
  input() { if (this.active && performance.now() - this.startedAt > 400) this.skip(); }

  skip() {
    if (!this.active) return;
    clearTimeout(this.timer);
    this.active = false;
    this.root.innerHTML = '';
    const d = this.done; this.done = null; d?.();
  }
}
