// HUD（DOM 叠加层，保证中文清晰）：血条、计时、胜局、气槽（豆）、爆气计时、连击数、回合提示、训练信息。
import { METER } from '../engine/constants.js';

export class Hud {
  constructor(root, theme) {
    this.theme = theme;
    root.innerHTML = `
      <div class="hud" data-testid="hud">
        <div class="side p1">
          <div class="face-wrap"><img class="face" data-face="p1" alt=""></div>
          <div class="info">
            <div class="bar"><div class="red" data-testid="hpred-p1"></div><div class="fill" data-testid="hp-p1"></div></div>
            <div class="row"><div class="name" data-testid="name-p1"></div><div class="wins" data-testid="wins-p1"></div></div>
          </div>
        </div>
        <div class="timer" data-testid="timer">99</div>
        <div class="side p2">
          <div class="face-wrap"><img class="face" data-face="p2" alt=""></div>
          <div class="info">
            <div class="bar"><div class="red" data-testid="hpred-p2"></div><div class="fill" data-testid="hp-p2"></div></div>
            <div class="row"><div class="name" data-testid="name-p2"></div><div class="wins" data-testid="wins-p2"></div></div>
          </div>
        </div>
      </div>
      <div class="combo p1" data-testid="combo-p1"></div>
      <div class="combo p2" data-testid="combo-p2"></div>
      <div class="counter-pop p1" data-testid="counter-p1"></div>
      <div class="counter-pop p2" data-testid="counter-p2"></div>
      <div class="power p1"><span class="stocks" data-testid="stocks-p1">0</span><div class="gauge"><div class="gfill" data-testid="gauge-p1"></div></div><div class="maxbar" data-testid="max-p1"></div></div>
      <div class="power p2"><span class="stocks" data-testid="stocks-p2">0</span><div class="gauge"><div class="gfill" data-testid="gauge-p2"></div></div><div class="maxbar" data-testid="max-p2"></div></div>
      <div class="banner" data-testid="banner"></div>
      <div class="training" data-testid="training-info"></div>`;
    this.q = (id) => root.querySelector(`[data-testid="${id}"]`);
    this.root = root;
    this.faceId = ['', ''];
    this.queue = [];      // 横幅队列：回合 → 开打
    this.shownBanner = '';
    this.shownCombo = ['', ''];
    this.red = [1, 1];
    this.comboShow = [0, 0];
    this.counterShow = [0, 0];
    this.shownCounter = ['', ''];
    this.comboText = ['', ''];
    this.bannerTimer = 0;
    this.bannerText = '';
    this.lastMove = null;
  }

  flashBanner(text, frames = 60) { this.bannerText = text; this.bannerTimer = frames; this.queue = []; }

  // 重新触发弹出动画
  pop(el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }

  update(state, names, extra = {}) {
    const T = this.theme.text;
    for (const e of state.events) {
      if (e.type === 'hit' && e.combo >= 2) { this.comboText[e.attacker] = `${e.combo} 连击`; this.comboShow[e.attacker] = 70; }
      if (e.type === 'hit' && e.counter) this.counterShow[e.attacker] = 50;
      if (e.type === 'round') { this.flashBanner(T.round(e.number), 60); this.queue = [[T.fight, 40]]; }
      // 超必杀的提示改由画布上的切入演出负责（renderer.drawCutin）
    }
    state.fighters.forEach((f, i) => {
      const k = i === 0 ? 'p1' : 'p2';
      const ratio = Math.max(0, f.hp / f.maxHp);
      this.red[i] = Math.max(ratio, this.red[i] - 0.006);
      if (this.red[i] < ratio) this.red[i] = ratio;
      this.q(`hp-${k}`).style.width = `${ratio * 100}%`;
      this.q(`hpred-${k}`).style.width = `${this.red[i] * 100}%`;
      this.q(`name-${k}`).textContent = names[i];
      this.q(`hp-${k}`).parentElement.classList.toggle('danger', ratio > 0 && ratio < 0.3);
      if (this.faceId[i] !== f.charId) {
        this.faceId[i] = f.charId;
        const img = this.root.querySelector(`[data-face="${k}"]`);
        img.style.visibility = 'hidden';
        img.onload = () => { img.style.visibility = 'visible'; };
        img.onerror = () => {
          // 慢网偶发失败：最多重试 3 次
          const n = +(img.dataset.retry || 0);
          if (n < 3) { img.dataset.retry = n + 1; setTimeout(() => { img.src = img.src.split('?')[0] + '?r=' + (n + 1); }, 800 * (n + 1)); } else img.style.visibility = 'hidden';
        };
        img.dataset.retry = 0;
        img.src = `assets/${this.theme.id}/select/${f.charId}.jpg`;
      }
      this.q(`wins-${k}`).textContent = '◆'.repeat(state.round.wins[i]);
      this.q(`stocks-${k}`).textContent = String(f.meter.stocks);
      this.q(`gauge-${k}`).style.width = `${(f.meter.gauge / METER.perStock) * 100}%`;
      this.q(`max-${k}`).style.width = `${(f.meter.max / METER.maxModeFrames) * 100}%`;
      const c = this.q(`combo-${k}`);
      const ct = this.comboShow[i]-- > 0 ? this.comboText[i] : '';
      if (ct !== this.shownCombo[i]) { this.shownCombo[i] = ct; c.textContent = ct; this.pop(c); }
      const cnt = this.q(`counter-${k}`);
      const txt = this.counterShow[i]-- > 0 ? '反击！COUNTER' : '';
      if (txt !== this.shownCounter[i]) { this.shownCounter[i] = txt; cnt.textContent = txt; if (txt) this.pop(cnt); }
    });
    this.q('timer').textContent = state.training ? '∞' : String(state.round.timer);
    const r = state.round;
    let banner = '';
    if (r.matchOver) banner = r.matchWinner === 'draw' ? T.draw : T.win(names[r.matchWinner]);
    else if (r.over) banner = r.winner === 'draw' ? T.draw : state.round.timerFrames === 0 ? T.timeUp : T.ko;
    else if (this.bannerTimer > 0) {
      banner = this.bannerText;
      if (--this.bannerTimer === 0 && this.queue.length) { const [t, n] = this.queue.shift(); this.bannerText = t; this.bannerTimer = n; }
    }
    const b = this.q('banner');
    if (banner !== this.shownBanner) {
      this.shownBanner = banner;
      b.textContent = banner;
      b.classList.toggle('ko', banner === T.ko || banner === T.timeUp);
      if (banner) this.pop(b);
    }

    const info = this.q('training-info');
    if (state.training) {
      for (const f of state.fighters) if (f.index === 0 && f.move && f.move.frame === 1) this.lastMove = f.move;
      const m = this.lastMove;
      info.textContent = `训练模式　对手：${extra.dummy ?? ''}　${m ? `｜上一招 ${extra.moveName?.(m.id) ?? m.id}：发生 ${m.startup} 持续 ${m.active} 总 ${m.total} 帧` : ''}　｜F1 判定框　F2 对手行为　Esc 出招表`;
    } else {
      info.textContent = '';
    }
  }
}
