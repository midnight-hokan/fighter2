// 音效与背景音乐。优先播放音频文件（主题 audio 字段 + 场景 bgm.file），没有文件或加载失败时用 WebAudio 现场合成兜底。
// 浏览器要求用户交互后才能出声：首次按键 / 点击时调用 ensure()。M 键静音。
// 主题 audio 字段：{ title: 'assets/<主题>/audio/title.ogg', sfx: { hit: '...ogg', block: ..., ko: ... } }
// 场景 bgm 字段：{ file: 'assets/<主题>/audio/s01.ogg', tempo, key, scale, seed }（file 缺省时按后四项合成）
import { createRng } from '../engine/rng.js';

function tone(ctx, out, f0, f1, dur, type = 'square', vol = 0.15, delay = 0) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// 低频闷响：重击/反击/超必杀命中时叠加
function thump(ctx, out, k = 1) {
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  g.gain.setValueAtTime(0.5 * k, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + 0.26);
}

const VOL_KEY = 'fighter2-volume';
const VOL_DEFAULT = { bgm: 0.8, sfx: 1, voice: 0.8 };
function loadVolume() {
  try {
    const v = JSON.parse(localStorage.getItem(VOL_KEY) ?? 'null');
    if (v && typeof v === 'object') return { ...VOL_DEFAULT, ...v };
  } catch { /* 读不到用默认 */ }
  return { ...VOL_DEFAULT };
}

function noise(ctx, out, dur, vol = 0.2) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (((i * 7919) % 2003) / 1001 - 1) * (1 - i / len);
  const s = ctx.createBufferSource();
  const g = ctx.createGain();
  g.gain.value = vol;
  s.buffer = buf;
  s.connect(g).connect(out);
  s.start();
}

// 事件类型 → 合成函数
export const SOUNDS = {
  hit: (c, o, e) => { noise(c, o, 0.08, 0.25); tone(c, o, e?.damage > 80 ? 160 : 240, 60, 0.12, 'square', 0.18); },
  block: (c, o) => tone(c, o, 900, 500, 0.06, 'triangle', 0.15),
  throw: (c, o) => { noise(c, o, 0.15, 0.25); tone(c, o, 120, 50, 0.25, 'sawtooth', 0.15); },
  projectile: (c, o) => tone(c, o, 220, 880, 0.25, 'sawtooth', 0.12),
  super: (c, o) => { tone(c, o, 300, 1200, 0.5, 'sawtooth', 0.15); tone(c, o, 600, 2400, 0.5, 'square', 0.06, 0.05); },
  max: (c, o) => tone(c, o, 200, 800, 0.4, 'square', 0.15),
  stock: (c, o) => { tone(c, o, 880, 880, 0.06, 'square', 0.1); tone(c, o, 1320, 1320, 0.08, 'square', 0.1, 0.07); },
  ko: (c, o) => { noise(c, o, 0.4, 0.3); tone(c, o, 300, 40, 0.9, 'sawtooth', 0.2); },
  round: (c, o) => tone(c, o, 523, 523, 0.15, 'square', 0.12),
  roll: (c, o) => noise(c, o, 0.12, 0.12),
  gc: (c, o) => tone(c, o, 700, 200, 0.2, 'square', 0.15),
  knockdown: (c, o) => noise(c, o, 0.2, 0.2),
};

const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], pentatonic: [0, 3, 5, 7, 10] };
const KEYS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// 根据 bgm 描述生成一段 16 拍循环：{ tempo, key, scale, seed }
export function composeBgm(bgm) {
  const r = createRng(bgm.seed ?? 1);
  const scale = SCALES[bgm.scale] ?? SCALES.minor;
  const root = 45 + (KEYS[bgm.key] ?? 9);
  const bass = [];
  const lead = [];
  const prog = [0, 0, 5, 3].map(d => d % scale.length);
  for (let bar = 0; bar < 4; bar++) {
    for (let s = 0; s < 8; s++) {
      bass.push(root + scale[prog[bar]] - 12 + (s % 2 ? 12 : 0));
      lead.push(r.next() < 0.7 ? root + 12 + scale[Math.floor(r.next() * scale.length)] + (r.next() < 0.2 ? 12 : 0) : null);
    }
  }
  return { tempo: bgm.tempo ?? 132, bass, lead };
}

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export class Audio {
  constructor() {
    this.ctx = null;
    this.out = null;
    this.bus = null;            // 分轨音量：{ bgm, sfx, voice }，各自接到 out
    this.volume = loadVolume();
    this.muted = false;
    this.log = [];
    this.bgmTimer = null;
    this.bgmNode = null;
    this.bgmToken = 0;
    this.buffers = new Map();   // 路径 → AudioBuffer
    this.failed = new Map();    // 路径 → 错误
    this.sfx = {};
    this.announcer = {};
    this.announcerLog = [];
    this.voice = {};            // 角色语音：{ c01: { intro, special, super, ko } }
    this.fighters = [];         // 当前对局双方角色定义（含 id），由 main 在对局开始时设置
    this.now = null;            // 当前背景音乐 { mode: 'file' | 'synth', src }
    this.decoder = null;
  }

  // 预加载音频文件（不需要用户交互：用离线上下文解码）
  async preload(theme) {
    this.sfx = theme.audio?.sfx ?? {};
    this.voice = theme.audio?.voice ?? {};
    this.announcer = theme.audio?.announcer ?? {};
    const voicePaths = [...Object.values(this.voice).flatMap(v => Object.values(v)), ...Object.values(this.announcer)];
    const paths = [theme.audio?.title, ...Object.values(this.sfx), ...voicePaths, ...(theme.stages ?? []).map(s => s.bgm?.file)].filter(Boolean);
    await Promise.all([...new Set(paths)].map(p => this.loadFile(p)));
  }

  // 对局开始时由 main 注入双方角色定义（用于按角色播语音）
  setFighters(defs) { this.fighters = defs ?? []; }

  async loadFile(path) {
    if (this.buffers.has(path)) return this.buffers.get(path);
    if (typeof OfflineAudioContext === 'undefined') return null;
    try {
      const r = await fetch(path);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.arrayBuffer();
      this.decoder ??= new OfflineAudioContext(2, 44100, 44100);
      const buf = await this.decoder.decodeAudioData(data);
      this.buffers.set(path, buf);
      return buf;
    } catch (e) {
      this.failed.set(path, String(e));
      console.warn(`音频 ${path} 加载失败，改用合成音：`, e);
      return null;
    }
  }

  info() {
    return { loaded: [...this.buffers.keys()], failed: Object.fromEntries(this.failed), now: this.now, volume: { ...this.volume } };
  }

  playBuffer(buf, { loop = false, vol = 1, delay = 0, bus = 'sfx' } = {}) {
    const s = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.buffer = buf;
    s.loop = loop;
    s.connect(g).connect(this.bus?.[bus] ?? this.out);
    s.start(this.ctx.currentTime + delay);
    return s;
  }

  // 角色语音：按角色 id + 台词名（intro/special/super/ko）播放对应文件
  playVoice(charId, line, { delay = 0 } = {}) {
    const path = this.voice?.[charId]?.[line];
    const buf = path && this.buffers.get(path);
    if (!buf || this.ctx?.state !== 'running') return;
    // 喊招压低到音效之下（光哥试玩反馈：喊招太响）；开场白和 KO 台词稍响一点
    this.playBuffer(buf, { vol: line === 'special' ? 0.38 : line === 'super' ? 0.5 : 0.6, delay, bus: 'voice' });
  }

  // 播报员：round1/round2/round3/final/fight/ko/timeup/perfect/win（theme.audio.announcer，缺文件就不播）
  playAnnouncer(key, { delay = 0 } = {}) {
    this.announcerLog.push(key);
    if (this.announcerLog.length > 50) this.announcerLog.shift();
    const path = this.announcer?.[key];
    const buf = path && this.buffers.get(path);
    if (!buf || this.ctx?.state !== 'running') return;
    this.playBuffer(buf, { vol: 0.85, delay, bus: 'voice' });
  }

  handleAnnouncer(e) {
    if (e.type === 'round') {
      this.playAnnouncer(e.number >= 4 ? 'final' : `round${e.number}`);
      this.playAnnouncer('fight', { delay: 1.1 });
    } else if (e.type === 'ko') this.playAnnouncer('ko', { delay: 0.05 });
    else if (e.type === 'timeup') this.playAnnouncer('timeup');
    else if (e.type === 'matchover' && e.winner !== 'draw') this.playAnnouncer('win', { delay: 1.2 });
  }

  // 角色语音与引擎事件挂钩：round 1 开场白、超必杀喊招、KO 台词（必杀喊招由 main 检出招式开始时调 playVoice）
  handleVoice(e) {
    if (e.type === 'round' && e.number === 1) {
      const [a, b] = this.fighters;
      if (a?.id) this.playVoice(a.id, 'intro');
      if (b?.id) this.playVoice(b.id, 'intro', { delay: 0.8 });
    } else if (e.type === 'super') {
      if (this.fighters[e.player]?.id) this.playVoice(this.fighters[e.player].id, 'super', { delay: 0.15 });
    } else if (e.type === 'ko' && e.loser && e.loser !== 'both') {
      if (this.fighters[e.loser]?.id) this.playVoice(this.fighters[e.loser].id, 'ko', { delay: 0.7 });
    }
  }

  ensure() {
    if (this.ctx || typeof AudioContext === 'undefined') return this.ctx;
    this.ctx = new AudioContext();
    this.out = this.ctx.createGain();
    this.out.gain.value = this.muted ? 0 : 0.6;
    this.out.connect(this.ctx.destination);
    this.bus = {};
    for (const k of ['bgm', 'sfx', 'voice']) {
      this.bus[k] = this.ctx.createGain();
      this.bus[k].gain.value = this.volume[k];
      this.bus[k].connect(this.out);
    }
    return this.ctx;
  }

  // 分轨音量（0–1），自动记住
  setVolume(kind, v) {
    if (!(kind in this.volume)) return;
    this.volume[kind] = Math.max(0, Math.min(1, Number(v)));
    if (this.bus?.[kind]) this.bus[kind].gain.value = this.volume[kind];
    try { localStorage.setItem(VOL_KEY, JSON.stringify(this.volume)); } catch { /* 隐私模式等存不了就算了 */ }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.out) this.out.gain.value = this.muted ? 0 : 0.6;
    return this.muted;
  }

  handle(events) {
    for (const e of events) {
      this.handleVoice(e);
      this.handleAnnouncer(e);
      if (!SOUNDS[e.type]) continue;
      this.log.push(e.type);
      if (this.log.length > 300) this.log.shift();
      if (this.ctx?.state !== 'running') continue;
      // 命中音按伤害分轻/中/重（阈值 50/90，普通技伤害 25–120，超必杀 300/460 归重击）
      let key = e.type;
      if (key === 'hit') key = e.damage < 50 ? 'hit_light' : e.damage < 90 ? 'hit_med' : 'hit_heavy';
      const path = this.sfx[key] ?? this.sfx[e.type];
      const buf = path && this.buffers.get(path);
      if (buf) this.playBuffer(buf, { vol: 0.9 });
      else SOUNDS[e.type](this.ctx, this.bus?.sfx ?? this.out, e);
      // 重击和反击：叠一记低频闷响，打击更"沉"
      if (e.type === 'hit' && (e.damage >= 90 || e.counter || e.kind === 'super')) thump(this.ctx, this.bus?.sfx ?? this.out, e.kind === 'super' ? 1 : 0.7);
    }
  }

  // bgm：场景的 bgm 字段，或 { file } 形式（标题音乐）
  playBgm(bgm) {
    this.stopBgm();
    if (!bgm) return;
    const token = ++this.bgmToken;
    if (bgm.file) {
      this.now = { mode: 'file', src: bgm.file };
      this.loadFile(bgm.file).then((buf) => {
        if (token !== this.bgmToken) return;
        if (buf && this.ensure()) this.bgmNode = this.playBuffer(buf, { loop: true, vol: 0.5, bus: 'bgm' });
        else if (bgm.tempo) this.playSynth(bgm);
      });
      return;
    }
    this.playSynth(bgm);
  }

  playSynth(bgm) {
    this.now = { mode: 'synth', src: null };
    const song = composeBgm(bgm);
    let step = 0;
    const tick = () => {
      if (this.ctx?.state === 'running' && !this.muted) {
        const b = song.bass[step % song.bass.length];
        const l = song.lead[step % song.lead.length];
        tone(this.ctx, this.bus?.bgm ?? this.out, midi(b), midi(b), 0.12, 'triangle', 0.08);
        if (l) tone(this.ctx, this.bus?.bgm ?? this.out, midi(l), midi(l), 0.1, 'square', 0.035);
      }
      step++;
    };
    this.bgmTimer = setInterval(tick, 60000 / song.tempo / 2);
  }

  stopBgm() {
    this.bgmToken++;
    if (this.bgmTimer) clearInterval(this.bgmTimer);
    this.bgmTimer = null;
    try { this.bgmNode?.stop(); } catch { /* 已停止 */ }
    this.bgmNode = null;
    this.now = null;
  }
}
