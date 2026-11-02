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
import { Cutscene } from './ui/cutscene.js';
import { Versus } from './ui/versus.js';
import { TouchPad, isTouchDevice, simpleSpecialFor } from './ui/touch.js';
import { openingScenes, prologueScenes, preFightScenes, endingScenes } from './ui/storyflow.js';
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
// 触屏：摇杆和按键并入 P1 输入；"必杀"键按方向直接发动必杀技（简易出招）
let pendingSpecial = null;
const touch = isTouchDevice() ? new TouchPad(document.body, {
  onKey: (code) => controls.listeners.forEach(fn => fn(code, {})),
  onSpecial: (d) => {
    if (!running) return;
    const me = game.getState().fighters[0];
    const fwd = d.x !== 0 && Math.sign(d.x) === Math.sign(me.facing);
    const id = simpleSpecialFor(chars[0], { forward: fwd, back: d.x !== 0 && !fwd, down: d.y > 0 });
    if (id) pendingSpecial = id;
  },
}) : null;
if (touch) controls.extra = [() => touch.read(), null];
const pause = new Pause(document.getElementById('pause-root'));
// 过场：自动化测试（navigator.webdriver）和 ?test=1 下默认关闭，?cutscenes=1 或 __game.cutscenes(true) 强制打开
const cutscene = new Cutscene(document.body, theme);
let cutscenesOn = params.has('cutscenes') || (!navigator.webdriver && !TEST_MODE);
const playStory = (scenes) => (cutscenesOn ? cutscene.play(scenes) : Promise.resolve());
const versus = new Versus(document.body, theme);
// 开打：过场开启时先播 VS 画面，再显示回合横幅、开始计时
function startFight(bannerText) {
  const go = () => { running = true; hud.flashBanner(bannerText, 60); hud.queue = [[theme.text.fight, 40]]; draw(game.getState()); };
  if (!cutscenesOn) return go();
  running = false;
  const stage = theme.stages[renderer.stageIndex];
  versus.play(chars[0], chars[1], { caption: stage?.name ?? '' }).then(go);
}

let game = new Game({ seed: 1, characters: [theme.roster[0], theme.roster[Math.min(1, theme.roster.length - 1)]] });
let chars = game.chars.map(c => c.def);
let prevMove = [null, null]; // 双方上一帧招式 id（用于检出必杀招式开始 → 播喊招语音）
let controllers = [() => ({}), () => ({})];
let running = false;
let mode = 'test';
// 街机模式状态：arcade 为 createArcade 实例（非街机模式为 null）；arcadeScreen 是当前覆盖画面（接关/结局）
let arcade = null;
let arcadePlayer = null;
let arcadeScreen = null;
let arcadeIntroFrames = 0; // 第 1 战开场白倒计时（rAF 帧），>0 时游戏冻结

// 擂台最后一关（docs/故事设定.md）：永远沈清；玩家选沈清时最后一关为林啸
function finalBossId(player) {
  const fb = theme.finalBoss;
  if (!fb) return undefined;
  return player === fb.boss ? fb.ifBoss : fb.boss;
}
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
  audio.setFighters(defs); // 角色语音：告诉音频系统当前对局双方
  prevMove = Array(2).fill(null);
  queued[0].length = 0;
  queued[1].length = 0;
  // 场景：对手角色的主场（角色数据里的 stage 字段），没写就按名单顺序轮换
  const home = theme.stages.findIndex(st => st.id === defs[1].stage);
  renderer.setStage(home >= 0 ? home : Math.max(0, theme.roster.findIndex(c => c.id === defs[1].id)) % theme.stages.length);
}

function frameInputs(state) {
  const ins = [0, 1].map(i => (queued[i].length ? queued[i].shift() : TEST_MODE ? {} : controllers[i](state, i)));
  if (pendingSpecial) { ins[0] = { ...ins[0], special: pendingSpecial }; pendingSpecial = null; }
  return ins;
}

function tick() {
  const s = game.getState();
  game.step(frameInputs(s));
  const after = game.getState();
  // 角色语音：检出必杀招式开始 → 播喊招（开场白/超必杀/KO 台词由 audio.handle 按引擎事件处理）
  for (let i = 0; i < 2; i++) {
    const f = after.fighters[i];
    const mv = f && f.move;
    const id = mv && mv.id ? mv.id : null;
    if (id && id !== prevMove[i] && mv.kind === 'special' && chars[i] && chars[i].id) audio.playVoice(chars[i].id, 'special');
    prevMove[i] = id;
  }
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
  blocked: () => cutscene.active || versus.active,
  onStart: ({ characters, mode: m }) => {
    mode = m;
    const training = m === 'training';
    if (m === 'arcade') {
      // 街机模式：P2 由电脑按 createArcade 的顺序安排，选人页上的 P2 光标忽略
      arcadePlayer = characters[0];
      arcade = createArcade({ roster: theme.roster, player: arcadePlayer, seed: Date.now() % 100000, finalBoss: finalBossId(arcadePlayer) });
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
    audio.ensure();
    audio.playBgm(theme.stages[renderer.stageIndex].bgm);
    if (m === 'arcade' && cutscenesOn) {
      // 过场：角色序章 + 第 1 战对战前对话，播完开打
      const cur = arcade.current();
      playStory([...prologueScenes(theme.story, arcadePlayer), ...preFightScenes(theme.story, arcadePlayer, cur.opponent, { stage: 1 })]).then(beginArcadeMatch);
    } else if (m === 'arcade') {
      // 第 1 战开场白（docs/故事设定.md）：显示所选角色开场白 + 参赛缘由，倒计时结束或 Enter 开打
      const me = getCharacter(arcadePlayer);
      showArcadeOverlay(`<div class="screen ending" data-arcade-overlay>
        <h2>${me.name} · ${me.title}</h2>
        <p class="ending-text">“${me.intro}”</p>
        <p>${me.story}</p>
        <div class="blink">Enter 开始战斗</div></div>`);
      arcadeIntroFrames = 300;
    } else {
      startFight(theme.text.round(1));
    }
    draw(game.getState());
  },
});

// 开场动画：每个浏览器首次打开时播放一次（标题页上按 O 可重看）
function playOpening() { cutscene.play(openingScenes(theme.story)); }
if (menus && cutscenesOn) {
  let seen = false;
  try { seen = localStorage.getItem('opening-seen') === '1'; localStorage.setItem('opening-seen', '1'); } catch { /* 无痕模式 */ }
  if (!seen || params.has('cutscenes')) playOpening();
}

controls.onKey((code) => {
  audio.ensure();
  if (versus.active) { if (code === 'Enter' || code === 'Space' || code === 'Escape') versus.input(); return; }
  if (cutscene.active) {
    if (code === 'Enter' || code === 'Space') cutscene.next();
    else if (code === 'Escape') cutscene.skip();
    return;
  }
  if (code === 'KeyO' && !running && menus?.stage === 'title') { playOpening(); return; }
  if (code === 'KeyM') audio.toggleMute();
  // 菜单界面放标题音乐（有文件才放）
  if (!running && !audio.now && theme.audio?.title && !TEST_MODE) audio.playBgm({ file: theme.audio.title });
  if (code === 'F1') renderer.showBoxes = !renderer.showBoxes;
  // 第 1 战开场白：Enter/空格 跳过
  if (arcadeIntroFrames > 0 && (code === 'Enter' || code === 'Space')) { arcadeIntroFrames = 1; return; }
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
// 触屏：街机模式的开场白 / 接关 / 结局画面，点一下 = Enter
document.getElementById('menu-root').addEventListener('pointerdown', (e) => {
  if (arcadeScreen || arcadeIntroFrames > 0) { e.preventDefault(); controls.listeners.forEach(fn => fn('Enter', {})); }
});

function backToMenu() {
  pause.close();
  running = false;
  arcade = null;
  arcadeScreen = null;
  arcadeIntroFrames = 0;
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
  arcadeScreen = null;
  arcadeIntroFrames = 0;
  hideArcadeOverlay();
  audio.ensure();
  audio.playBgm(theme.stages[renderer.stageIndex].bgm);
  startFight(`第 ${cur.stage} 战 · ${opp.name}（${opp.title} · ${LEVEL_LABEL[cur.level]}）`);
}

// 第 1 战开场白倒计时结束：正式开始战斗
function beginArcadeMatch() {
  hideArcadeOverlay();
  const cur = arcade.current();
  const opp = getCharacter(cur.opponent);
  startFight(`第 ${cur.stage} 战 · ${opp.name}（${opp.title} · ${LEVEL_LABEL[cur.level]}）`);
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
  if (r === 'continue') return showContinueScreen();
  if (!cutscenesOn) return r === 'next' ? startArcadeRound() : showEndingScreen();
  running = false;
  if (r === 'next') {
    const cur = arcade.current();
    playStory(preFightScenes(theme.story, arcadePlayer, cur.opponent, { stage: cur.stage, final: cur.stage === arcade.opponents.length })).then(startArcadeRound);
  } else {
    audio.stopBgm();
    playStory(endingScenes(theme.story, arcadePlayer)).then(showEndingScreen);
  }
}

window.__game = {
  version: VERSION,
  // 过场测试接口
  cutscenes: (on = true) => { cutscenesOn = !!on; return cutscenesOn; },
  cutscene: () => cutscene.info(),
  playStory: (kind, a, b, opts) => {
    const st = theme.story;
    const scenes = kind === 'opening' ? openingScenes(st) : kind === 'prologue' ? prologueScenes(st, a)
      : kind === 'prefight' ? preFightScenes(st, a, b, opts) : kind === 'ending' ? endingScenes(st, a) : [];
    cutscene.play(scenes);
    return scenes.length;
  },
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
  touch: () => !!touch,
  versus: () => versus.active,
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
    // 第 1 战开场白：按 rAF 帧倒计时（期间游戏冻结），结束开始战斗
    if (arcadeIntroFrames > 0) {
      arcadeIntroFrames--;
      if (arcadeIntroFrames === 0) beginArcadeMatch();
    }
    while (acc >= 1000 / 60) {
      if (running && !pause.open) state = tick();
      acc -= 1000 / 60;
    }
    if (running) draw(state ?? game.getState());
    touch?.setVisible(running && !cutscene.active && !versus.active);
    // 街机模式：比赛结束后按胜负推进——赢了进下一战、输了接关、7 战全胜进结局（留 90 帧给 KO 动画）
    if (running && game.round.matchOver && !pause.open) {
      if (++overTimer > (arcade ? 90 : 240)) { overTimer = 0; if (arcade) handleArcadeResult(); else backToMenu(); }
    } else overTimer = 0;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
