// 过场播放器（动态漫画式）：场景图 + 镜头推拉 + 立绘表情 + 逐字对话框。Enter / 空格 / 点击 继续，Esc 跳过整段。
// 美术缺失时：场景图用渐变色块 + 画面描述顶替，立绘用角色主色剪影顶替，不会报错。
import { speakerOf } from './storyflow.js';

const CAM = { push: 'cs-push', pull: 'cs-pull', panL: 'cs-panL', panR: 'cs-panR', still: 'cs-still' };

export class Cutscene {
  constructor(parent, theme) {
    this.theme = theme;
    this.root = document.createElement('div');
    this.root.id = 'cutscene-root';
    parent.appendChild(this.root);
    this.active = false;
    this.root.addEventListener('pointerdown', (e) => { if (this.active) { e.preventDefault(); this.next(); } });
  }

  get roster() { return this.theme.roster; }

  // 播放一组场景，播完（或被跳过）后 resolve
  play(scenes) {
    if (!scenes || !scenes.length) return Promise.resolve();
    if (this.active) this.finish();
    this.scenes = scenes;
    this.si = 0;
    this.li = -1;
    this.active = true;
    this.preload(scenes);
    return new Promise((res) => { this.done = res; this.showScene(); this.next(); });
  }

  info() { return { active: this.active, scene: this.active ? this.si : -1, line: this.active ? this.li : -1, text: this.active ? this.fullText : '' }; }

  // 优先 .webp（小得多），加载失败回退 .png
  imgPath(id, ext = 'webp') { return `assets/${this.theme.id}/scenes/${id}.${ext}`; }
  portraitPath(id, expr, ext = 'webp') { return `assets/${this.theme.id}/portraits/${id}/${expr || 'normal'}.${ext}`; }

  // 提前把这段过场要用的场景图和立绘拉进浏览器缓存，避免慢网下边播边等
  preload(scenes) {
    const urls = new Set();
    for (const s of scenes) {
      if (s.img) urls.add(this.imgPath(s.img));
      for (const l of s.lines ?? []) if (l.who && !String(l.who).startsWith('npc:')) urls.add(this.portraitPath(l.who, l.expr));
      if (s.vs) { urls.add(this.portraitPath(s.vs.me, 'normal')); urls.add(this.portraitPath(s.vs.opp, 'normal')); }
    }
    this.preloaded = [...urls].map(u => { const im = new Image(); im.src = u; return im; });
  }

  showScene() {
    const s = this.scenes[this.si];
    const desc = this.theme.story?.IMAGES?.[s.img] ?? '';
    this.root.innerHTML = `<div class="cutscene" data-testid="cutscene">
      <div class="cs-bg ${CAM[s.cam] ?? CAM.still}">
        ${s.img ? `<img class="cs-img" alt="">` : ''}
        <div class="cs-fallback">${desc}</div>
      </div>
      <div class="cs-portrait cs-left"></div><div class="cs-portrait cs-right"></div>
      <div class="cs-box"><div class="cs-name"></div><div class="cs-text"></div></div>
      <div class="cs-hint">Enter 继续 · Esc 跳过</div>
    </div>`;
    const img = this.root.querySelector('.cs-img');
    if (img) {
      img.onload = () => { img.classList.add('ok'); this.root.querySelector('.cs-fallback')?.remove(); };
      img.onerror = () => { if (img.src.endsWith('.webp')) img.src = this.imgPath(s.img, 'png'); else img.remove(); };
      img.src = this.imgPath(s.img);
    }
    if (s.vs) { this.setPortrait('left', s.vs.me, 'normal'); this.setPortrait('right', s.vs.opp, 'normal'); }
  }

  setPortrait(side, id, expr) {
    const el = this.root.querySelector(`.cs-${side}`);
    if (!el) return;
    if (!id) { el.innerHTML = ''; el.dataset.id = ''; return; }
    if (el.dataset.id === id && el.dataset.expr === expr) return;
    el.dataset.id = id; el.dataset.expr = expr;
    const c = this.roster.find(x => x.id === id);
    const color = c?.colors?.primary ?? '#888';
    el.innerHTML = `<div class="cs-silhouette" style="--c:${color}"><span>${c?.name ?? ''}</span></div>`;
    const tryLoad = (e, fallback) => {
      const im = new Image();
      im.onload = () => { if (el.dataset.id === id) el.innerHTML = ''; el.appendChild(im); };
      im.onerror = () => {
        if (im.src.endsWith('.webp')) { im.src = this.portraitPath(id, e, 'png'); return; }
        if (fallback) tryLoad(fallback, null);
      };
      im.src = this.portraitPath(id, e);
    };
    tryLoad(expr, expr !== 'normal' ? 'normal' : null);
  }

  showLine() {
    const s = this.scenes[this.si];
    const line = s.lines[this.li];
    const sp = speakerOf(line.who, this.roster);
    this.root.querySelector('.cs-name').textContent = sp.name;
    this.root.querySelector('.cs-name').style.visibility = sp.name ? 'visible' : 'hidden';
    this.root.querySelector('.cs-box').classList.toggle('narration', !line.who);
    if (sp.id) {
      const side = s.vs ? (sp.id === s.vs.opp ? 'right' : 'left') : 'left';
      this.setPortrait(side, sp.id, line.expr);
      this.root.querySelector('.cs-left').classList.toggle('dim', side !== 'left');
      this.root.querySelector('.cs-right').classList.toggle('dim', side !== 'right');
    } else if (!s.vs) {
      this.setPortrait('left', null);
    }
    this.fullText = line.text;
    this.shown = 0;
    clearInterval(this.timer);
    const t = this.root.querySelector('.cs-text');
    t.textContent = '';
    this.timer = setInterval(() => {
      this.shown++;
      t.textContent = this.fullText.slice(0, this.shown);
      if (this.shown >= this.fullText.length) clearInterval(this.timer);
    }, 35);
  }

  next() {
    if (!this.active) return;
    if (this.li >= 0 && this.shown < this.fullText.length) { // 正在逐字显示：先显示完整
      clearInterval(this.timer);
      this.shown = this.fullText.length;
      this.root.querySelector('.cs-text').textContent = this.fullText;
      return;
    }
    this.li++;
    if (this.li >= this.scenes[this.si].lines.length) {
      this.si++;
      this.li = 0;
      if (this.si >= this.scenes.length) return this.finish();
      this.showScene();
    }
    this.showLine();
  }

  skip() { if (this.active) this.finish(); }

  finish() {
    clearInterval(this.timer);
    this.active = false;
    this.root.innerHTML = '';
    const d = this.done;
    this.done = null;
    d?.();
  }
}
