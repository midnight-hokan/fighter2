// 格斗引擎内核：纯逻辑，不依赖 DOM / 渲染，可在 Node 中运行。
// 固定 60Hz：每调用一次 step() 推进一帧。同种子 + 同输入序列 → 完全相同的结果。
import {
  STAGE, MAX_SEPARATION, PHYS, INPUT, METER, STUN, HITSTOP, SUPER_FREEZE,
  KNOCKDOWN_FRAMES, ROLL, MAX_START_FRAMES, THROW_PROTECT, ATTACKS, ROUND, STRENGTH, COMBO,
} from './constants.js';
import { normalizeInput, InputHistory, matchCommand, strengthOf } from './input.js';
import { prepareCharacter, resolveStrength, totalFrames } from './character.js';
import { worldBox, overlap, hurtbox } from './boxes.js';
import { createRng } from './rng.js';
import { updateRound } from './round.js';

const START_GAP = 70;
const CONTROLLABLE = new Set(['idle', 'walkf', 'walkb', 'crouch', 'prejump']);
const HIT_STATES = new Set(['hitstun', 'airhit', 'dizzy']);
const NOT_THROWABLE = new Set(['hitstun', 'blockstun', 'airhit', 'knockdown', 'roll', 'maxstart', 'ko', 'prejump']);
const BLOCKABLE_STATES = new Set(['idle', 'walkf', 'walkb', 'crouch', 'blockstun']);

function makeFighter(index, ch, x) {
  return {
    index, charId: ch.id, x, y: 0, vx: 0, vy: 0,
    facing: index === 0 ? 1 : -1,
    hp: ch.stats.health, maxHp: ch.stats.health,
    action: 'idle', actionFrame: 0, grounded: true,
    move: null, hitstun: 0, blockstun: 0, blockLow: false, knockdown: 0, dizzy: 0,
    invuln: 0, throwProtect: 0, slide: null,
    stun: 0, stunIdle: 0, dizzyPending: false,
    meter: { gauge: 0, stocks: 0, max: 0 },
    combo: 0, lastHitFrame: -999, jumpDir: 0, airAttackUsed: false,
    queued: null,
  };
}

export class Game {
  constructor(opts = {}) { this.reset(opts.seed ?? 1, opts); }

  reset(seed = 1, opts = {}) {
    this.opts = { ...this.opts, ...opts };
    const defs = this.opts.characters;
    if (!defs || defs.length !== 2) throw new Error('Game 需要 characters: [角色数据A, 角色数据B]');
    this.seed = seed;
    this.rng = createRng(seed);
    this.training = !!this.opts.training;
    this.chars = defs.map(prepareCharacter);
    this.frame = 0;
    this.hitstop = 0;
    this.freeze = 0;
    const mid = (STAGE.left + STAGE.right) / 2;
    this.fighters = [
      makeFighter(0, this.chars[0], this.opts.p1x ?? mid - START_GAP),
      makeFighter(1, this.chars[1], this.opts.p2x ?? mid + START_GAP),
    ];
    this.histories = [new InputHistory(), new InputHistory()];
    this.projectiles = [];
    this.round = {
      number: 1, timerFrames: ROUND.seconds * 60, timer: ROUND.seconds,
      wins: [0, 0], over: false, winner: null, endDelay: 0, matchOver: false, matchWinner: null,
    };
    this.events = [];
    if (this.training) this.fighters.forEach(f => { f.meter.stocks = METER.maxStocks; });
    this._updateFacing(true);
    return this;
  }

  // 回合之间：位置、血量、状态复位；气槽保留（拳皇97）
  resetPositions() {
    const mid = (STAGE.left + STAGE.right) / 2;
    this.fighters = this.fighters.map((f, i) => {
      const n = makeFighter(i, this.chars[i], i === 0 ? mid - START_GAP : mid + START_GAP);
      n.meter = { gauge: f.meter.gauge, stocks: f.meter.stocks, max: 0 };
      return n;
    });
    this.projectiles = [];
    this.histories.forEach(h => h.clear());
    this.hitstop = 0;
    this.freeze = 0;
    this._updateFacing(true);
  }

  ch(f) { return this.chars[f.index]; }
  opp(f) { return this.fighters[1 - f.index]; }
  emit(type, data = {}) { this.events.push({ type, frame: this.frame, ...data }); }

  setAction(f, action) {
    f.action = action;
    f.actionFrame = 0;
    if (action !== 'attack') f.move = null;
  }

  // ============================================================ 主循环
  step(inputs = [{}, {}]) {
    this.events = [];
    if (this.round.matchOver) return this;
    const ins = [normalizeInput(inputs[0]), normalizeInput(inputs[1])];
    this.fighters.forEach((f, i) => this.histories[i].push(ins[i], f.facing));
    this.inputs = ins;

    if (this.freeze > 0) { this.freeze--; this.frame++; return this; }
    if (this.hitstop > 0) {
      this.hitstop--;
      this.fighters.forEach(f => this._bufferCancel(f));
      this.frame++;
      return this;
    }

    this._updateFacing(false);
    for (const f of this.fighters) this._timers(f);
    for (const f of this.fighters) this._update(f, ins[f.index]);
    for (const f of this.fighters) this._physics(f);
    this._pushApart();
    this.fighters.forEach(f => this._clamp(f));
    this._separation();
    this._resolveHits();
    updateRound(this);
    if (this.training) this._trainingRefill();
    this.frame++;
    return this;
  }

  // ============================================================ 计时
  _timers(f) {
    if (f.invuln > 0) f.invuln--;
    if (f.throwProtect > 0) f.throwProtect--;
    if (f.meter.max > 0) {
      f.meter.max--;
      if (f.meter.max === 0) this.emit('maxend', { player: f.index });
    }
    if (f.stun > 0 && !HIT_STATES.has(f.action)) {
      f.stunIdle++;
      if (f.stunIdle > STUN.decayDelay) f.stun = Math.max(0, f.stun - STUN.decayPerFrame);
    }
  }

  // ============================================================ 状态机
  _update(f, input) {
    f.actionFrame++;
    if (this.round.over) return;
    switch (f.action) {
      case 'hitstun':
        if (--f.hitstun <= 0) this._recover(f);
        return;
      case 'blockstun':
        if (this._tryGuardCancel(f)) return;
        if (--f.blockstun <= 0) this._recover(f);
        return;
      case 'knockdown':
        if (--f.knockdown <= 0) { f.invuln = Math.max(f.invuln, 6); this._recover(f); }
        return;
      case 'dizzy':
        if (--f.dizzy <= 0) { f.stun = 0; this.setAction(f, 'idle'); }
        return;
      case 'airhit':
        return;
      case 'roll': {
        const back = f.rollDir < 0;
        f.x += f.facing * (back ? -1 : 1) * ROLL.speed;
        if (f.actionFrame >= ROLL.frames) this.setAction(f, 'idle');
        return;
      }
      case 'maxstart':
        if (f.actionFrame >= MAX_START_FRAMES) this.setAction(f, 'idle');
        return;
      case 'attack':
        this._updateAttack(f, input);
        return;
      case 'jump':
        if (!f.airAttackUsed) this._tryAirNormal(f);
        return;
      case 'ko': case 'win':
        return;
      default:
        this._control(f, input);
    }
  }

  _recover(f) {
    f.combo = 0;
    f.throwProtect = THROW_PROTECT;
    if (f.dizzyPending) {
      f.dizzyPending = false;
      this.setAction(f, 'dizzy');
      f.dizzy = STUN.dizzyFrames;
      this.emit('dizzy', { player: f.index });
      return;
    }
    this.setAction(f, 'idle');
  }

  // 可自由操作的状态
  _control(f, input) {
    const opp = this.opp(f);
    if (this._tryGroundActions(f, opp)) return;

    if (f.action === 'prejump') {
      if (f.actionFrame >= PHYS.prejump) {
        const st = this.ch(f).stats;
        const dir = input.right ? 1 : input.left ? -1 : 0;
        f.grounded = false;
        f.vy = st.jumpV;
        f.vx = dir * st.jumpH;
        f.jumpDir = dir;
        f.airAttackUsed = false;
        this.setAction(f, 'jump');
      }
      return;
    }
    if (input.up) { this.setAction(f, 'prejump'); return; }
    if (input.down) {
      if (f.action !== 'crouch') this.setAction(f, 'crouch');
      return;
    }
    const st = this.ch(f).stats;
    const fwd = f.facing > 0 ? input.right : input.left;
    const back = f.facing > 0 ? input.left : input.right;
    if (fwd) {
      f.x += f.facing * st.walkF;
      if (f.action !== 'walkf') this.setAction(f, 'walkf');
    } else if (back) {
      f.x -= f.facing * st.walkB;
      if (f.action !== 'walkb') this.setAction(f, 'walkb');
    } else if (f.action !== 'idle') {
      this.setAction(f, 'idle');
    }
  }

  // ============================================================ 出招判定（地面）
  _tryGroundActions(f, opp) {
    const h = this.histories[f.index];
    const last = h.latest();
    const ch = this.ch(f);

    // 爆气：轻中重拳同时按
    if (f.meter.stocks >= 1 && f.meter.max === 0 && h.simul(['lp', 'mp', 'hp'])) {
      this._startMax(f);
      return true;
    }
    // 简易出招：直接按 id 发动（触屏用；条件与搓招相同，超必杀要有豆）
    if (last.input.special && this._trySimple(f, last.input.special)) return true;
    // 超必杀 / MAX 超必杀
    if (this._trySuper(f)) return true;
    // 必杀技
    if (this._trySpecial(f)) return true;
    // 紧急回避：轻拳 + 轻脚
    if (h.simul(['lp', 'lk'])) { this._startRoll(f); return true; }
    // 投技：前/后 + 重拳或重脚，近身
    const fwd = last.dir === 6, back = last.dir === 4;
    if ((last.pressed.hp || last.pressed.hk) && (fwd || back)) {
      if (Math.abs(opp.x - f.x) <= ch.stats.throwRange && this._throwable(opp)) {
        this._doThrow(f, opp, ch.throwMove, back);
        return true;
      }
    }
    // 普通技（同时按多个键时取最重的）
    const pick = ['hp', 'hk', 'mp', 'mk', 'lp', 'lk'].find(b => last.pressed[b]);
    if (pick) {
      const m = ch.normals[`${last.input.down ? 'cr' : 'st'}.${pick}`];
      if (m) { this._startMove(f, m); return true; }
    }
    return false;
  }

  _trySimple(f, id) {
    const ch = this.ch(f);
    const sp = ch.specials.find(m => m.id === id);
    if (sp) { this._startMove(f, resolveStrength(sp, 'm')); return true; }
    const su = ch.supers.find(m => m.id === id);
    if (su && f.meter.stocks >= 1) { this._startMove(f, resolveStrength(su, 'm'), { sdm: f.meter.max > 0 }); return true; }
    return false;
  }

  _trySuper(f) {
    const h = this.histories[f.index];
    if (f.meter.stocks < 1) return false;
    for (const s of this.ch(f).supers) {
      const btn = matchCommand(h, s.parsed);
      if (!btn) continue;
      const sdm = f.meter.max > 0;
      this._startMove(f, resolveStrength(s, strengthOf(btn)), { sdm });
      return true;
    }
    return false;
  }

  _trySpecial(f) {
    const h = this.histories[f.index];
    for (const s of this.ch(f).specials) {
      if (!f.grounded && !s.air) continue;
      const btn = matchCommand(h, s.parsed);
      if (!btn) continue;
      const m = resolveStrength(s, strengthOf(btn));
      if (m.projectile && this.projectiles.some(p => p.owner === f.index)) continue;
      this._startMove(f, m);
      return true;
    }
    return false;
  }

  _tryAirNormal(f) {
    const last = this.histories[f.index].latest();
    if (this._trySpecial(f)) return;
    const order = ['hp', 'hk', 'mp', 'mk', 'lp', 'lk'];
    const pick = order.find(b => last.pressed[b]);
    if (!pick) return;
    const m = this.ch(f).normals[`j.${pick}`];
    if (m) { f.airAttackUsed = true; this._startMove(f, m); }
  }

  _bufferCancel(f) {
    // 顿帧期间也读取输入：防御反击 / 防御回避、命中确认后的取消都可以在顿帧里输入
    if (f.action === 'blockstun' && f.meter.stocks >= 1 && !f.queued) {
      const h = this.histories[f.index];
      if (h.simul(['lp', 'lk'])) f.queued = { kind: 'gc', type: 'roll' };
      else if (h.simul(['hp', 'hk'])) f.queued = { kind: 'gc', type: 'blowback' };
      return;
    }
    if (f.action !== 'attack' || !f.move.connected || f.move.cancelUsed || f.queued) return;
    const h = this.histories[f.index];
    if (f.move.def.cancel) {
      if (f.meter.stocks >= 1) {
        for (const s of this.ch(f).supers) {
          const btn = matchCommand(h, s.parsed);
          if (btn) { f.queued = { kind: 'super', move: resolveStrength(s, strengthOf(btn)), sdm: f.meter.max > 0 }; return; }
        }
      }
      for (const s of this.ch(f).specials) {
        const btn = matchCommand(h, s.parsed);
        if (!btn) continue;
        const m = resolveStrength(s, strengthOf(btn));
        if (m.projectile && this.projectiles.some(p => p.owner === f.index)) continue;
        f.queued = { kind: 'special', move: m };
        return;
      }
    }
    const chain = this._chainTarget(f);
    if (chain) f.queued = { kind: 'chain', move: chain };
  }

  // 连段（chain）：地面普通技命中或被防后，按更重一级的键可直接取消：轻→轻（最多 2 次）/中，中→重，重→不能。
  _chainTarget(f) {
    const mv = f.move;
    if (!mv || mv.def.kind !== 'normal' || !mv.connected || !f.grounded || mv.def.id.startsWith('j.')) return null;
    const rank = { l: 1, m: 2, h: 3 };
    const cur = rank[STRENGTH[mv.def.id.split('.')[1]]];
    const last = this.histories[f.index].latest();
    const btn = ['hp', 'hk', 'mp', 'mk', 'lp', 'lk'].find(b => last.pressed[b]);
    if (!btn || !cur) return null;
    const r = rank[STRENGTH[btn]];
    const ok = r === cur + 1 || (r === 1 && cur === 1 && (mv.chain ?? 0) < COMBO.lightChains);
    if (!ok) return null;
    return this.ch(f).normals[`${last.input.down ? 'cr' : 'st'}.${btn}`] ?? null;
  }

  // ============================================================ 招式进行
  _startMove(f, m, extra = {}) {
    const sdm = !!extra.sdm;
    let def = m;
    if (m.kind === 'super' && sdm) {
      def = { ...m, ...(m.sdm ?? {}), damage: m.sdm?.damage ?? Math.round(m.damage * METER.sdmDamageMul) };
    }
    if (m.kind === 'super') {
      f.meter.stocks -= m.cost;
      if (sdm) { f.meter.max = 0; }
      this.freeze = SUPER_FREEZE;
      this.emit('super', { player: f.index, id: m.id, sdm });
    }
    if (m.kind === 'special') this._gain(f, METER.gain.specialStart);
    const mul = (f.meter.max > 0 ? METER.maxDamageMul : 1);
    f.action = 'attack';
    f.actionFrame = 0;
    f.move = { def, frame: 1, hit: false, connected: false, cancelUsed: false, spawned: false, sdm, mul };
    f.queued = null;
    if (def.kind !== 'normal' || !def.id.startsWith('j.')) f.slide = null;
    this._applyMoveMotion(f);
  }

  _applyMoveMotion(f) {
    const m = f.move.def;
    if (!m.move || f.move.frame !== (m.move.at ?? 1)) return;
    if (m.move.vy) {
      f.grounded = false;
      f.vy = m.move.vy;
      f.vx = (m.move.vx ?? 0) * f.facing;
    } else if (m.move.vx) {
      f.slide = { vx: m.move.vx * f.facing, frames: m.move.frames ?? m.active };
    }
  }

  _updateAttack(f) {
    const mv = f.move;
    // 卡拉取消：普通技出手 3 帧内补齐同时按键 → 爆气 / 回避
    if (mv.def.kind === 'normal' && f.actionFrame <= INPUT.simulWindow && f.grounded) {
      const h = this.histories[f.index];
      if (f.meter.stocks >= 1 && f.meter.max === 0 && h.simul(['lp', 'mp', 'hp'])) { this._startMax(f); return; }
      if (h.simul(['lp', 'lk'])) { this._startRoll(f); return; }
    }
    // 取消：命中/被防后，可取消成必杀或超必杀
    if (f.queued) {
      const q = f.queued;
      f.queued = null;
      if (q.kind === 'super' && f.meter.stocks >= 1) { this._startMove(f, q.move, { sdm: f.meter.max > 0 }); f.move.cancelUsed = true; return; }
      if (q.kind === 'special') { this._startMove(f, q.move); f.move.cancelUsed = true; return; }
      if (q.kind === 'chain') { const c = (mv.chain ?? 0) + 1; this._startMove(f, q.move); f.move.chain = c; return; }
    }
    if (mv.connected && mv.def.cancel && !mv.cancelUsed && f.grounded) {
      if (this._trySuper(f) || this._trySpecial(f)) { f.move.cancelUsed = true; return; }
    }
    if (mv.connected && !mv.cancelUsed) {
      const nxt = this._chainTarget(f);
      if (nxt) { const c = (mv.chain ?? 0) + 1; this._startMove(f, nxt); f.move.chain = c; return; }
    }
    mv.frame++;
    this._applyMoveMotion(f);
    const m = mv.def;
    // 飞行道具
    if (m.projectile && !mv.spawned && mv.frame === m.startup + 1) {
      mv.spawned = true;
      const p = m.projectile;
      this.projectiles.push({
        owner: f.index, id: m.id, x: f.x + f.facing * (p.x ?? 30), y: f.y + (p.y ?? 58),
        vx: f.facing * (p.speed ?? 4), w: p.w ?? 24, h: p.h ?? 20, life: p.life ?? 200, mul: mv.mul, def: m,
      });
      this.emit('projectile', { player: f.index, id: m.id });
    }
    // 指令投
    if (m.throw && m.kind !== 'throw' && !mv.hit && mv.frame === m.startup + 1) {
      const opp = this.opp(f);
      mv.hit = true;
      if (Math.abs(opp.x - f.x) <= (m.range ?? 60) && this._throwable(opp)) {
        this._doThrow(f, opp, m, false, true);
        return;
      }
    }
    if (mv.frame > totalFrames(m)) {
      if (!f.grounded) return; // 空中招式持续到落地
      this.setAction(f, this.inputs?.[f.index]?.down ? 'crouch' : 'idle');
    }
  }

  _startMax(f) {
    f.meter.stocks -= 1;
    f.meter.max = METER.maxModeFrames;
    this.setAction(f, 'maxstart');
    f.invuln = Math.max(f.invuln, MAX_START_FRAMES);
    this.emit('max', { player: f.index });
  }

  _startRoll(f) {
    const last = this.histories[f.index].latest();
    f.rollDir = (last.dir === 4 || last.dir === 1 || last.dir === 7) ? -1 : 1;
    this.setAction(f, 'roll');
    this.emit('roll', { player: f.index });
  }

  _tryGuardCancel(f) {
    if (f.meter.stocks < 1) return false;
    const h = this.histories[f.index];
    const q = f.queued?.kind === 'gc' ? f.queued.type : null;
    f.queued = null;
    if (q === 'roll' || h.simul(['lp', 'lk'])) {
      f.meter.stocks -= 1;
      this._startRoll(f);
      f.blockstun = 0;
      this.emit('gc', { player: f.index, gcType: 'roll' });
      return true;
    }
    if (q === 'blowback' || h.simul(['hp', 'hk'])) {
      f.meter.stocks -= 1;
      f.blockstun = 0;
      this._startMove(f, this.ch(f).gc);
      this.emit('gc', { player: f.index, gcType: 'blowback' });
      return true;
    }
    return false;
  }

  // ============================================================ 投技
  _throwable(t) {
    return t.grounded && !NOT_THROWABLE.has(t.action) && t.throwProtect === 0 && !this._invulnerable(t)
      && !(t.action === 'attack' && t.move?.def.throw);
  }

  _doThrow(f, t, m, back, isCommand = false) {
    const dmg = Math.round(m.damage * (f.meter.max > 0 ? METER.maxDamageMul : 1));
    t.hp = Math.max(0, t.hp - dmg);
    t.stun += m.stun ?? 0;
    if (back) {
      t.x = f.x - f.facing * 40;
    }
    t.slide = null;
    t.combo = 1;
    t.grounded = false;
    t.vy = 3.5;
    t.vx = (back ? -f.facing : f.facing) * 2.5;
    this.setAction(t, 'airhit');
    t.lastHitFrame = this.frame;
    if (!isCommand) {
      f.action = 'attack';
      f.actionFrame = 0;
      f.move = { def: m, frame: 1, hit: true, connected: true, cancelUsed: true, spawned: true, sdm: false, mul: 1 };
    } else {
      f.move.connected = true;
    }
    this._gain(f, m.meterGain ?? METER.gain.throw);
    this._gain(t, dmg * METER.gain.damagedPerPoint);
    this.emit('throw', { attacker: f.index, defender: t.index, damage: dmg, back, command: isCommand });
  }

  // ============================================================ 物理
  _physics(f) {
    if (f.slide) {
      f.x += f.slide.vx;
      if (--f.slide.frames <= 0) f.slide = null;
    }
    if (f.grounded) return;
    f.x += f.vx;
    f.y += f.vy;
    f.vy -= PHYS.gravity;
    if (f.y <= 0) {
      f.y = 0; f.vy = 0; f.vx = 0; f.grounded = true;
      f.airAttackUsed = false;
      if (f.action === 'airhit') {
        this.setAction(f, 'knockdown');
        f.knockdown = KNOCKDOWN_FRAMES;
        this.emit('knockdown', { player: f.index });
      } else if (f.action === 'jump') {
        this.setAction(f, 'idle');
      } else if (f.action === 'attack') {
        this.setAction(f, 'idle');
      }
    }
  }

  _updateFacing(force) {
    const [a, b] = this.fighters;
    for (const [f, o] of [[a, b], [b, a]]) {
      if (!force && !(f.grounded && CONTROLLABLE.has(f.action))) continue;
      if (o.x > f.x) f.facing = 1;
      else if (o.x < f.x) f.facing = -1;
    }
  }

  _solid(f) { return f.action !== 'roll' && f.action !== 'knockdown' && f.action !== 'ko'; }

  _pushApart() {
    const [a, b] = this.fighters;
    if (!this._solid(a) || !this._solid(b)) return;
    if (Math.abs(a.y - b.y) > 60) return;
    const half = PHYS.pushHalf;
    const dx = b.x - a.x;
    if (Math.abs(dx) >= half * 2) return;
    const sign = dx !== 0 ? Math.sign(dx) : a.facing;
    const push = (half * 2 - Math.abs(dx)) / 2;
    a.x -= sign * push;
    b.x += sign * push;
    const lo = STAGE.left + half, hi = STAGE.right - half;
    for (const [f, o] of [[a, b], [b, a]]) {
      if (f.x < lo) { o.x += lo - f.x; f.x = lo; }
      if (f.x > hi) { o.x -= f.x - hi; f.x = hi; }
    }
  }

  _clamp(f) {
    const lo = STAGE.left + PHYS.pushHalf, hi = STAGE.right - PHYS.pushHalf;
    if (f.x < lo) f.x = lo;
    if (f.x > hi) f.x = hi;
  }

  _separation() {
    const [a, b] = this.fighters;
    const d = Math.abs(a.x - b.x);
    if (d <= MAX_SEPARATION) return;
    const excess = d - MAX_SEPARATION;
    const center = (a.x + b.x) / 2;
    const dir = Math.sign(b.x - a.x) || 1;
    a.x = center - dir * MAX_SEPARATION / 2;
    b.x = center + dir * MAX_SEPARATION / 2;
    void excess;
    this.fighters.forEach(f => this._clamp(f));
  }

  // ============================================================ 判定
  _invulnerable(f) {
    if (f.invuln > 0) return true;
    if (['knockdown', 'maxstart', 'ko', 'airhit'].includes(f.action)) return true;
    if (f.action === 'roll') return f.actionFrame >= ROLL.invuln[0] && f.actionFrame <= ROLL.invuln[1];
    if (f.action === 'attack' && f.move.def.invuln) {
      const [a, b] = f.move.def.invuln;
      return f.move.frame >= a && f.move.frame <= b;
    }
    return false;
  }

  hurtboxOf(f) { return hurtbox(f, this.ch(f).hurt); }

  activeHitbox(f) {
    if (f.action !== 'attack') return null;
    const m = f.move.def;
    if (!m.hitbox || m.throw || f.move.hit) return null;
    const fr = f.move.frame;
    if (fr <= m.startup || fr > m.startup + m.active) return null;
    return worldBox(f, m.hitbox);
  }

  _resolveHits() {
    const pending = [];
    for (const f of this.fighters) {
      const box = this.activeHitbox(f);
      if (!box) continue;
      const d = this.opp(f);
      if (this._invulnerable(d)) continue;
      if (overlap(box, this.hurtboxOf(d))) {
        f.move.hit = true;
        pending.push({ att: f, d, m: f.move.def, mul: f.move.mul, fromX: f.x, kind: f.move.def.kind, src: 'move' });
      }
    }
    // 飞行道具
    const alive = [];
    for (const p of this.projectiles) {
      p.x += p.vx;
      p.life--;
      if (p.life <= 0 || p.x < STAGE.left - 40 || p.x > STAGE.right + 40) continue;
      alive.push(p);
    }
    // 道具对消
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        if (a.dead || b.dead || a.owner === b.owner) continue;
        if (Math.abs(a.x - b.x) < (a.w + b.w) / 2) {
          a.dead = b.dead = true;
          this.emit('clash', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        }
      }
    }
    this.projectiles = alive.filter(p => !p.dead).filter((p) => {
      const d = this.fighters[1 - p.owner];
      if (this._invulnerable(d)) return true;
      const box = { x1: p.x - p.w / 2, x2: p.x + p.w / 2, y1: p.y - p.h / 2, y2: p.y + p.h / 2 };
      if (!overlap(box, this.hurtboxOf(d))) return true;
      pending.push({ att: this.fighters[p.owner], d, m: p.def, mul: p.mul, fromX: p.x - p.vx * 4, kind: p.def.kind, src: 'projectile' });
      return false;
    });
    for (const h of pending) this._applyHit(h);
  }

  _canBlock(d, fromX, level) {
    if (!d.grounded || !BLOCKABLE_STATES.has(d.action)) return false;
    const input = this.inputs[d.index];
    const back = fromX < d.x ? input.right : input.left;
    if (!back) return false;
    if (level === 'low' && !input.down) return false;
    if (level === 'high' && input.down) return false;
    return true;
  }

  _push(d, att, amount, fromX) {
    const dir = Math.sign(d.x - fromX) || att.facing;
    const lo = STAGE.left + PHYS.pushHalf + 1, hi = STAGE.right - PHYS.pushHalf - 1;
    const cornered = d.x <= lo || d.x >= hi;
    const frames = 6;
    if (cornered && att.grounded) att.slide = { vx: -dir * amount / frames, frames };
    else d.slide = { vx: dir * amount / frames, frames };
  }

  _gain(f, amount) {
    const m = f.meter;
    if (m.max > 0 || amount <= 0) return;
    if (m.stocks >= METER.maxStocks) { m.gauge = 0; return; }
    m.gauge += amount;
    while (m.gauge >= METER.perStock && m.stocks < METER.maxStocks) {
      m.gauge -= METER.perStock;
      m.stocks++;
      this.emit('stock', { player: f.index, stocks: m.stocks });
    }
    if (m.stocks >= METER.maxStocks) m.gauge = 0;
  }

  _applyHit({ att, d, m, mul, fromX, kind, src }) {
    if (this.round.over) return;
    if (att.move && src === 'move') att.move.connected = true;
    const strength = { l: 'l', m: 'm', h: 'h' }[m.id?.split('.')[1]?.[0]] ?? 'm';
    const baseGain = m.meterGain ?? (kind === 'normal' ? METER.gain.normal : kind === 'special' ? METER.gain.special : 0);

    if (this._canBlock(d, fromX, m.level)) {
      const dmg = Math.round(m.chip * mul);
      d.hp = Math.max(0, d.hp - dmg);
      d.move = null;
      d.slide = null;
      d.action = 'blockstun';
      d.actionFrame = 0;
      d.blockstun = m.blockstun;
      d.blockLow = !!this.inputs[d.index].down;
      this._push(d, att, m.pushback, fromX);
      this.hitstop = Math.max(this.hitstop, HITSTOP.block);
      this._gain(att, baseGain * METER.gain.blockMul);
      this._gain(d, 1);
      this.emit('block', { attacker: att.index, defender: d.index, damage: dmg, id: m.id, x: d.x, y: d.y + 60 });
      return;
    }

    const comboing = HIT_STATES.has(d.action);
    d.combo = comboing ? d.combo + 1 : 1;
    // 反击（Counter）：对手出招的发生帧或持续帧中被打中 → 硬直和顿帧加长，便于追击
    const counter = !comboing && d.action === 'attack' && !!d.move && d.move.frame <= d.move.def.startup + d.move.def.active;
    // 连段伤害修正：第 3 击起每击 -10%，普通/必杀最低 50%，超必杀最低 60%
    const scale = d.combo >= 3 ? Math.max(kind === 'super' ? COMBO.superMinScale : COMBO.minScale, 1 - COMBO.scalePerHit * (d.combo - 2)) : 1;
    const dmg = Math.round(m.damage * mul * scale);
    d.hp = Math.max(0, d.hp - dmg);
    d.lastHitFrame = this.frame;
    if (d.action === 'dizzy') {
      d.stun = 0;
      d.dizzy = 0;
    } else {
      d.stun += m.stun;
      d.stunIdle = 0;
      if (d.stun >= this.ch(d).stats.stunMax) d.dizzyPending = true;
    }
    d.move = null;
    d.queued = null;
    const dir = Math.sign(d.x - fromX) || att.facing;
    if (!d.grounded || m.knockdown) {
      d.grounded = false;
      d.vy = Math.max(d.vy, m.knockdown ? 4.5 : 3.5);
      d.vx = dir * 2.2;
      d.slide = null;
      d.action = 'airhit';
      d.actionFrame = 0;
    } else {
      d.action = 'hitstun';
      d.actionFrame = 0;
      d.hitstun = m.hitstun + (counter ? COMBO.counterHitstun : 0);
      this._push(d, att, m.pushback, fromX);
    }
    this.hitstop = Math.max(this.hitstop, (m.hitstop ?? (kind === 'super' ? HITSTOP.super : HITSTOP[strength] ?? HITSTOP.m)) + (counter ? COMBO.counterHitstop : 0));
    this._gain(att, baseGain);
    this._gain(d, dmg * METER.gain.damagedPerPoint);
    this.emit('hit', {
      attacker: att.index, defender: d.index, damage: dmg, combo: d.combo, id: m.id, kind,
      x: d.x, y: d.y + 60, sdm: !!att.move?.sdm && src === 'move', counter,
    });
  }

  _trainingRefill() {
    for (const f of this.fighters) {
      f.meter.stocks = METER.maxStocks;
      if (!HIT_STATES.has(f.action) && f.action !== 'knockdown' && this.frame - f.lastHitFrame > 90) f.hp = f.maxHp;
    }
    this.round.timerFrames = ROUND.seconds * 60;
    this.round.timer = ROUND.seconds;
  }

  // ============================================================ 对外
  getState() {
    const fighters = this.fighters.map(f => ({
      index: f.index, charId: f.charId, x: f.x, y: f.y, vx: f.vx, vy: f.vy, facing: f.facing,
      hp: f.hp, maxHp: f.maxHp, action: f.action, actionFrame: f.actionFrame, grounded: f.grounded,
      move: f.move ? {
        id: f.move.def.id, kind: f.move.def.kind, frame: f.move.frame, total: totalFrames(f.move.def),
        startup: f.move.def.startup, active: f.move.def.active, connected: f.move.connected, sdm: f.move.sdm,
        anim: f.move.def.anim,
      } : null,
      hitstun: f.hitstun, blockstun: f.blockstun, blockLow: f.blockLow, knockdown: f.knockdown, dizzy: f.dizzy,
      stun: f.stun, stunMax: this.ch(f).stats.stunMax, invulnerable: this._invulnerable(f),
      meter: { ...f.meter }, combo: f.combo,
    }));
    return JSON.parse(JSON.stringify({
      frame: this.frame, seed: this.seed, training: this.training,
      hitstop: this.hitstop, freeze: this.freeze,
      fighters,
      projectiles: this.projectiles.map(p => ({ owner: p.owner, id: p.id, x: p.x, y: p.y, vx: p.vx, w: p.w, h: p.h })),
      round: this.round,
      events: this.events,
    }));
  }

  // 判定框（给渲染层的调试显示用）
  boxes() {
    return this.fighters.map(f => ({ hurt: this.hurtboxOf(f), hit: this.activeHitbox(f) }));
  }

  get debug() {
    return {
      setHp: (i, hp) => { this.fighters[i].hp = hp; },
      setX: (i, x) => { this.fighters[i].x = x; this._updateFacing(true); },
      setTimer: (s) => { this.round.timerFrames = Math.round(s * 60); this.round.timer = Math.ceil(this.round.timerFrames / 60); },
      setMeter: (i, stocks, gauge = 0) => { Object.assign(this.fighters[i].meter, { stocks, gauge }); },
      setStun: (i, stun) => { this.fighters[i].stun = stun; },
    };
  }
}
