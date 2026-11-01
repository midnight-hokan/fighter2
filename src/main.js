// 入口：把引擎、渲染、HUD、菜单、输入连起来，并暴露测试接口 window.__game。
import './style.css';
import theme, { getCharacter } from './theme/index.js';
import { Game } from './engine/game.js';
import { createAI } from './engine/ai.js';
import { Renderer } from './render/renderer.js';
import { Audio, SOUNDS } from './render/audio.js';
import { Hud } from './ui/hud.js';
import { Controls } from './ui/controls.js';
import { Menus, Pause } from './ui/menus.js';

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
const DUMMY = ['站立', '蹲下', '全防', '跳跃', '电脑'];
let dummy = 0;
const queued = [[], []];

renderer.atlases.load(theme.roster);

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
    newGame({ characters, seed: Date.now() % 100000, training });
    const level = m.startsWith('cpu-') ? m.slice(4) : 'normal';
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
  if (code === 'F1') renderer.showBoxes = !renderer.showBoxes;
  if (!running || TEST_MODE) return;
  if (code === 'F2' && game.training) dummy = (dummy + 1) % DUMMY.length;
  if (code === 'Escape') pause.toggle(chars);
  if (code === 'Backspace' && pause.open) backToMenu();
});
window.addEventListener('pointerdown', () => audio.ensure());

function backToMenu() {
  pause.close();
  running = false;
  audio.stopBgm();
  document.getElementById('hud-root').style.display = 'none';
  menus?.show();
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
  audioInfo: () => ({ log: [...audio.log], sounds: Object.fromEntries(Object.entries(SOUNDS).map(([k, v]) => [k, typeof v === 'function'])) }),
  isRunning: () => running,
  mode: () => mode,
  pauseOpen: () => pause.open,
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
    // 【R3 由大炮实现】街机模式：在这里接 createArcade（src/ui/arcade.js）——赢了进下一战，输了显示接关，
    // 7 战全胜显示结局画面（data-testid="ending"），Enter 回标题。并在 window.__game 上加 arcade() / arcadeWin()。
    if (running && game.round.matchOver && !pause.open) { if (++overTimer > 240) { overTimer = 0; backToMenu(); } } else overTimer = 0;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
