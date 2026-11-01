// 入口：把引擎、渲染、HUD、菜单、输入连起来，并暴露测试接口 window.__game。
import './style.css';
import theme, { getCharacter } from './theme/index.js';
import { Game } from './engine/game.js';
import { createAI } from './engine/ai.js';
import { Renderer } from './render/renderer.js';
import { loadStageImages } from './render/stage.js';
import { Audio, SOUNDS } from './render/audio.js';
import { Hud } from './ui/hud.js';
import { Controls } from './ui/controls.js';
import { Menus, Pause } from './ui/menus.js';
import { createArcade } from './ui/arcade.js';
import { ROUND } from './engine/constants.js';

// eslint-disable-next-line no-undef
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const params = new URLSearchParams(location.search);
const TEST_MODE = params.has('test');

document.title = theme.title;
const canvas = document.getElementById('scene');
const renderer = new Renderer(canvas, theme);
const hud = new Hud(document.getElementById('hud-root'), theme);
const audio = new Audio();
const controls = new Controls();
const pause = new Pause(document.getElementById('pause-root'));

let game = new Game({ seed: 1, characters: [theme.roster[0], theme.roster[Math.min(1, theme.roster.length - 1)]] });
let chars = game.chars.map(c => c.def);
let controllers = [() => ({}), () => ({})];
let running = false;
let mode = 'test';
// 街机模式状态：arcade 为 createArcade 实例（非街机模式为 null）；arcadeScreen 是当前覆盖画面（接关/结局）
let arcade = null;
let arcadePlayer = null;
let arcadeScreen = null;
const LEVEL_LABEL = { easy: '简单', normal: '普通', hard: '困难' };
const DUMMY = ['站立', '蹲下', '全防', '跳跃', '电脑'];
let dummy = 0;
const queued = [[], []];

// 美术与音频资源：全部异步加载，缺什么就用程序化兜底（火柴人 / 色块背景 / 合成音）
const assetsReady = Promise.all([renderer.atlases.load(theme.roster), loadStageImages(theme.stages), audio.preload(theme)]);

function dummyController(state, me) {
  const self = state.fighters[me];
  const opp = state.fighters[1 - me];
  const back = self.facing > 0 ? 'left' : 'right';
  switch (DUMMY[dummy]) {
    case '蹲下': return { down: true };
    case '全防': return { [back]: true, down: !!opp.move?.id?.startsWith('cr.') || opp.move?.id === 'cr' };
    case '跳跃': return self.grounded && self.action === 'idle' ? { up: true } : {};
    case '电脑': return dummyAI(state, me);
    default: return {};
  }
}
let dummyAI = () => ({});

function newGame({ characters, seed = 1, training = false, p1x, p2x }) {
  const defs = characters.map(id => (typeof id === 'string' ? getCharacter(id) : id));
  game = new Game({ seed, characters: defs, training, p1x, p2x });
  chars = defs;
  queued[0].length = 0;
  queued[1].length = 0;
  // 场景：对手角色的主场（角色数据里的 stage 字段），没写就按名单顺序轮换
  const home = theme.stages.findIndex(st => st.id === defs[1].stage);
  renderer.setStage(home >= 0 ? home : Math.max(0, theme.roster.findIndex(c => c.id === defs[1].id)) % theme.stages.length);
}

function frameInputs(state) {
  return [0, 1].map(i => (queued[i].length ? queued[i].shift() : TEST_MODE ? {} : controllers[i](state, i)));
}

function tick() {
  const s = game.getState();
  game.step(frameInputs(s));
  const after = game.getState();
  audio.handle(after.events);
  return after;
}

const moveName = (id) => {
  const c = chars[0];
  return c.normals?.[id]?.name ?? [...(c.specials ?? []), ...(c.supers ?? [])].find(m => m.id === id)?.name ?? id;
};

function draw(state) {
  renderer.render(state, chars, renderer.showBoxes ? game.boxes() : null);
  hud.update(state, chars.map(c => c.name), { dummy: DUMMY[dummy], moveName });
}

const menus = TEST_MODE ? null : new Menus(document.getElementById('menu-root'), theme, controls, {
  version: VERSION,
  onStart: ({ characters, mode: m }) => {
    mode = m;
    const training = m === 'training';
    if (m === 'arcade') {
      // 街机模式：P2 由电脑按 createArcade 的顺序安排，选人页上的 P2 光标忽略
      arcadePlayer = characters[0];
      arcade = createArcade({ roster: theme.roster, player: arcadePlayer, seed: Date.now() % 100000 });
      characters = [arcadePlayer, arcade.current().opponent];
    } else {
      arcade = null;
    }
    newGame({ characters, seed: Date.now() % 100000, training });
    const level = m === 'arcade' ? arcade.current().level : (m.startsWith('cpu-') ? m.slice(4) : 'normal');
    dummyAI = createAI('normal', 99, chars[1]);
    controllers = [
      () => controls.read(0),
      m === '2p' ? () => controls.read(1) : training ? dummyController : createAI(level, Date.now() % 1000, chars[1]),
    ];
    document.getElementById('hud-root').style.display = '';
    running = true;
    audio.ensure();
    audio.playBgm(theme.stages[renderer.stageIndex].bgm);
    hud.flashBanner(theme.text.round(1), 70);
    draw(game.getState());
  },
});

controls.onKey((code) => {
  audio.ensure();
  if (code === 'KeyM') audio.toggleMute();
  // 菜单界面放标题音乐（有文件才放）
  if (!running && !audio.now && theme.audio?.title && !TEST_MODE) audio.playBgm({ file: theme.audio.title });
  if (code === 'F1') renderer.showBoxes = !renderer.showBoxes;
  if (arcadeScreen) {
    if (code === 'Enter') { if (arcadeScreen === 'continue') startArcadeRound(); else quitArcade(); }
    else if (code === 'KeyQ' || code === 'Escape') quitArcade();
    return;
  }
  if (!running || TEST_MODE) return;
  if (code === 'F2' && game.training) dummy = (dummy + 1) % DUMMY.length;
  if (code === 'Escape') pause.toggle(chars);
  if (code === 'Backspace' && pause.open) backToMenu();
});
window.addEventListener('pointerdown', () => audio.ensure());

function backToMenu() {
  pause.close();
  running = false;
  arcade = null;
  arcadeScreen = null;
  audio.stopBgm();
  if (theme.audio?.title) audio.playBgm({ file: theme.audio.title });
  document.getElementById('hud-root').style.display = 'none';
  menus?.show();
}

// —— 街机模式 ——

function hideArcadeOverlay() {
  document.querySelectorAll('#menu-root [data-arcade-overlay]').forEach(el => el.remove());
}

function showArcadeOverlay(html) {
  hideArcadeOverlay();
  const el = document.createElement('div');
  el.innerHTML = html;
  document.getElementById('menu-root').appendChild(el.firstElementChild);
}

// 开下一战 / 接关再战：newGame 会按对手 stage 切场景
function startArcadeRound() {
  const cur = arcade.current();
  const opp = getCharacter(cur.opponent);
  newGame({ characters: [arcadePlayer, cur.opponent], seed: Date.now() % 100000 });
  controllers[1] = createAI(cur.level, Date.now() % 1000, chars[1]);
  document.getElementById('hud-root').style.display = '';
  running = true;
  arcadeScreen = null;
  hideArcadeOverlay();
  audio.ensure();
  audio.playBgm(theme.stages[renderer.stageIndex].bgm);
  hud.flashBanner(`第 ${cur.stage} 战 · ${opp.name}（${LEVEL_LABEL[cur.level]}）`, 70);
  draw(game.getState());
}

// 输了：接关画面（Enter 再战同一对手，Q 回标题）
function showContinueScreen() {
  const cur = arcade.current();
  const opp = getCharacter(cur.opponent);
  running = false;
  arcadeScreen = 'continue';
  audio.stopBgm();
  showArcadeOverlay(`<div class="screen ending" data-testid="continue" data-arcade-overlay>
    <h2>第 ${cur.stage} 战 · 败</h2>
    <p>对手 ${opp.name}（${LEVEL_LABEL[cur.level]}）—— 接关后对手不变</p>
    <div class="blink">Enter 接关再战　｜　Q 返回标题</div></div>`);
}

// 7 战全胜：结局画面（Enter 回标题）
function showEndingScreen() {
  running = false;
  arcadeScreen = 'ending';
  audio.stopBgm();
  showArcadeOverlay(`<div class="screen ending" data-testid="ending" data-arcade-overlay>
    <h2>通关 · ${getCharacter(arcadePlayer).name}</h2>
    <p class="ending-text">${arcade.ending()}</p>
    <div class="blink">按 Enter 返回标题</div></div>`);
}

function quitArcade() {
  arcade = null;
  arcadeScreen = null;
  hideArcadeOverlay();
  backToMenu();
}

// 比赛结束（matchOver）后按胜负推进街机流程
function handleArcadeResult() {
  const r = arcade.report(game.round.matchWinner === 0 ? 'win' : 'lose');
  if (r === 'next') startArcadeRound();
  else if (r === 'continue') showContinueScreen();
  else showEndingScreen();
}

window.__game = {
  version: VERSION,
  roster: () => theme.roster.map(c => c.id),
  getState: () => game.getState(),
  step: (n = 1) => { for (let k = 0; k < n; k++) draw(tick()); return game.getState(); },
  input: (player, keys, frames = 1) => { for (let k = 0; k < frames; k++) queued[player].push({ ...keys }); },
  reset: (opts = {}) => {
    newGame({ characters: [opts.p1 ?? theme.roster[0].id, opts.p2 ?? theme.roster[0].id], seed: opts.seed ?? 1, training: !!opts.training, p1x: opts.p1x, p2x: opts.p2x });
    draw(game.getState());
    return game.getState();
  },
  setHp: (i, hp) => { game.debug.setHp(i, hp); draw(game.getState()); },
  setX: (i, x) => { game.debug.setX(i, x); draw(game.getState()); },
  setTimer: (s) => { game.debug.setTimer(s); draw(game.getState()); },
  setMeter: (i, stocks, gauge) => { game.debug.setMeter(i, stocks, gauge); draw(game.getState()); },
  setStage: (i) => { renderer.setStage(i); draw(game.getState()); return renderer.stageIndex; },
  stageCount: () => theme.stages.length,
  toggleBoxes: () => { renderer.showBoxes = !renderer.showBoxes; draw(game.getState()); return renderer.showBoxes; },
  renderInfo: () => renderer.info(),
  assetsReady: () => assetsReady.then(() => true),
  audioFiles: () => audio.info(),
  audioInfo: () => ({ log: [...audio.log], sounds: Object.fromEntries(Object.entries(SOUNDS).map(([k, v]) => [k, typeof v === 'function'])) }),
  isRunning: () => running,
  mode: () => mode,
  pauseOpen: () => pause.open,
  // 街机模式测试接口：当前战况（非街机模式返回 null）；arcadeWin 强制玩家赢下当前这一战
  arcade: () => (arcade ? { index: arcade.index, opponent: arcade.current().opponent, level: arcade.current().level } : null),
  arcadeWin: () => {
    if (!arcade || !running || game.round.over || game.round.matchOver) return;
    game.round.wins[0] = Math.max(game.round.wins[0], ROUND.winsToMatch - 1);
    game.debug.setHp(1, 0);
  },
  bench: (frames = 300) => {
    const times = [];
    for (let k = 0; k < frames; k++) { const t0 = performance.now(); draw(tick()); times.push(performance.now() - t0); }
    times.sort((x, y) => x - y);
    return times[Math.floor(times.length / 2)];
  },
};

if (TEST_MODE) {
  running = true;
  draw(game.getState());
} else {
  document.getElementById('hud-root').style.display = 'none';
  let last = performance.now();
  let acc = 0;
  let overTimer = 0;
  const loop = (now) => {
    acc += Math.min(now - last, 250);
    last = now;
    let state = null;
    while (acc >= 1000 / 60) {
      if (running && !pause.open) state = tick();
      acc -= 1000 / 60;
    }
    if (running) draw(state ?? game.getState());
    // 街机模式：比赛结束后按胜负推进——赢了进下一战、输了接关、7 战全胜进结局（留 90 帧给 KO 动画）
    if (running && game.round.matchOver && !pause.open) {
      if (++overTimer > (arcade ? 90 : 240)) { overTimer = 0; if (arcade) handleArcadeResult(); else backToMenu(); }
    } else overTimer = 0;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
