// 通用电脑对手：读取角色的招式数据来决策，适用于任何符合格式的角色。
// createAI(level, seed, character) → (state, me) => input
//   level：'easy' | 'normal' | 'hard'；character：角色数据（原始定义对象）
// 只能用 seed 生成随机数，保证同种子可复现。
import { createRng } from './rng.js';
import { parseCommand } from './input.js';

const LEVELS = {
  easy: { period: 20, block: 0.12, anti: 0.05, super: 0.0, max: 0, special: 0.15, combo: 0, throw: 0.03, jump: 0.04, gc: 0 },
  normal: { period: 10, block: 0.5, anti: 0.3, super: 0.2, max: 0.02, special: 0.35, combo: 0.3, throw: 0.12, jump: 0.04, gc: 0.02 },
  hard: { period: 4, block: 0.85, anti: 0.7, super: 0.45, max: 0.06, special: 0.5, combo: 0.75, throw: 0.2, jump: 0.02, gc: 0.06 },
};

function dirKeys(d, facing) {
  const out = {};
  const h = (d - 1) % 3 - 1; // -1 后 0 中 1 前
  const v = Math.floor((d - 1) / 3) - 1; // -1 下 0 中 1 上
  if (h !== 0) out[(h > 0) === (facing > 0) ? 'right' : 'left'] = true;
  if (v > 0) out.up = true;
  if (v < 0) out.down = true;
  return out;
}

const btnKey = (spec) => ({ P: 'hp', K: 'hk' }[spec] ?? spec.toLowerCase());

// 把一条指令转成逐帧输入序列
export function commandToInputs(cmd, facing, opts = {}) {
  const p = typeof cmd === 'string' ? parseCommand(cmd) : cmd;
  const button = opts.button ?? btnKey(p.button);
  const seq = [];
  if (p.type === 'motion') {
    p.dirs.forEach((d, i) => {
      const last = i === p.dirs.length - 1;
      seq.push(dirKeys(d, facing));
      seq.push(last ? { ...dirKeys(d, facing), [button]: true } : dirKeys(d, facing));
    });
  } else if (p.type === 'charge') {
    const hold = opts.charged ? 2 : 44;
    for (let i = 0; i < hold; i++) seq.push(dirKeys(p.from, facing));
    seq.push({ ...dirKeys(p.to, facing), [button]: true });
  } else {
    seq.push(dirKeys(6, facing), dirKeys(2, facing), dirKeys(4, facing), { ...dirKeys(8, facing), [button]: true });
  }
  seq.push({});
  return seq;
}

const reachOf = (m) => (m?.hitbox ? m.hitbox.x + m.hitbox.w + 14 : 0);

export function createAI(level = 'normal', seed = 1, character = null) {
  const cfg = LEVELS[level] ?? LEVELS.normal;
  const rng = createRng(seed);
  let plan = [];
  let wait = 0;
  let backHeld = 0;
  const ch = character ?? {};
  const normals = Object.entries(ch.normals ?? {}).map(([id, m]) => ({ id, ...m, reach: reachOf(m) }));
  // 拳皇式 4 键：电脑也只用 A/B/C/D（不用中拳中脚）
  const ground = normals.filter(n => !n.id.startsWith('j.') && !/m[pk]$/.test(n.id));
  const specials = (ch.specials ?? []).map(s => ({ ...s, parsed: parseCommand(s.input) }));
  const supers = (ch.supers ?? []).map(s => ({ ...s, parsed: parseCommand(s.input) }));
  const projectile = specials.find(s => s.projectile);
  const antiAir = specials.find(s => s.invuln && s.move?.vy) ?? null;
  const grab = specials.find(s => s.throw);
  const rush = specials.find(s => !s.projectile && !s.throw && s !== antiAir);
  const throwRange = ch.stats?.throwRange ?? 44;

  const out = (input, fwd, back) => {
    if (input[back]) backHeld++; else backHeld = 0;
    void fwd;
    return input;
  };

  return (state, me) => {
    const self = state.fighters[me];
    const opp = state.fighters[1 - me];
    const fwd = self.facing > 0 ? 'right' : 'left';
    const back = self.facing > 0 ? 'left' : 'right';
    const dist = Math.abs(opp.x - self.x);

    if (plan.length) return out(plan.shift(), fwd, back);

    // 不能动的时候：继续按后（保持防御姿态 / 蓄力）
    if (['hitstun', 'airhit', 'knockdown', 'dizzy'].includes(self.action)) return out({ [back]: true }, fwd, back);
    if (self.action === 'blockstun') {
      if (self.meter.stocks >= 1 && rng.next() < cfg.gc) { plan = [{ hp: true, hk: true }, {}]; return out(plan.shift(), fwd, back); }
      return out({ [back]: true, down: !!opp.move?.id?.startsWith('cr.') }, fwd, back);
    }
    if (self.action === 'attack' || self.action === 'roll' || self.action === 'maxstart' || !self.grounded) return out({}, fwd, back);

    if (wait-- > 0) return out(backHeld > 0 ? { [back]: true } : {}, fwd, back);
    wait = cfg.period;
    const r = () => rng.next();
    const queue = (seq) => { plan = seq.slice(); return out(plan.shift(), fwd, back); };
    const useCmd = (s, button) => queue(commandToInputs(s.parsed, self.facing, { button, charged: backHeld >= 42 }));

    // 威胁判断
    const oppAttacking = opp.move && opp.move.frame <= opp.move.startup + opp.move.active && dist < 110;
    const projIncoming = state.projectiles.some(p => p.owner !== me && Math.abs(p.x - self.x) < 140 && Math.sign(self.x - p.x) === Math.sign(p.vx));
    const jumpIn = !opp.grounded && opp.action !== 'airhit' && dist < 120;

    if (jumpIn && r() < cfg.anti) {
      if (antiAir && antiAir.parsed.type !== 'charge') return useCmd(antiAir, 'hp');
      const ccr = ch.normals?.['cr.hp'];
      if (ccr) return queue([{ down: true, hp: true }, { down: true }, {}]);
    }
    if ((oppAttacking || projIncoming || jumpIn) && r() < cfg.block) {
      const low = !!opp.move?.id?.startsWith('cr.');
      return queue(Array.from({ length: 12 }, () => ({ [back]: true, down: low })));
    }

    // 气槽
    if (self.meter.stocks >= 2 && self.meter.max === 0 && r() < cfg.max) return queue([{ lp: true, lk: true, hp: true }, {}]);
    if (self.meter.stocks >= 1 && supers.length && dist < 120 && r() < cfg.super) {
      const s = supers[Math.floor(r() * supers.length)];
      return useCmd(s, s.parsed.button === 'K' ? 'hk' : 'hp');
    }

    // 远距离
    if (dist > 150) {
      if (projectile && !state.projectiles.some(p => p.owner === me) && r() < cfg.special) {
        const strength = ['lp', 'hp'][Math.floor(r() * 2)];
        const s = projectile.parsed.button === 'K' ? strength.replace('p', 'k') : strength;
        if (projectile.parsed.type === 'charge' && backHeld < 42) return queue(Array.from({ length: 16 }, () => ({ [back]: true })));
        return useCmd(projectile, s);
      }
      if (r() < cfg.jump) return queue([{ up: true, [fwd]: true }, { [fwd]: true }, {}]);
      return queue(Array.from({ length: 6 + Math.floor(r() * 10) }, () => ({ [fwd]: true })));
    }

    // 近身
    if (dist <= throwRange && r() < cfg.throw) {
      if (grab && r() < 0.6) return useCmd(grab, 'hp');
      return queue([{ [fwd]: true, hp: true }, {}]);
    }
    const inReach = ground.filter(n => n.reach >= dist);
    if (inReach.length) {
      // 连招：可取消的普通技 → 必杀
      const cancelable = inReach.filter(n => n.cancel);
      const follow = rush ?? projectile ?? antiAir;
      if (cancelable.length && follow && follow.parsed.type === 'motion' && r() < cfg.combo) {
        const n = cancelable[Math.floor(r() * cancelable.length)];
        const [stance, b] = n.id.split('.');
        const first = { [b]: true, down: stance === 'cr' };
        const tail = commandToInputs(follow.parsed, self.facing, { button: follow.parsed.button === 'K' ? 'lk' : 'lp' });
        return queue([first, { down: stance === 'cr' }, { down: stance === 'cr' }, ...tail]);
      }
      if (rush && r() < cfg.special * 0.4 && rush.parsed.type !== 'charge') return useCmd(rush, rush.parsed.button === 'K' ? 'hk' : 'hp');
      const n = inReach[Math.floor(r() * inReach.length)];
      const [stance, b] = n.id.split('.');
      return queue([{ [b]: true, down: stance === 'cr' }, { down: stance === 'cr' }, {}]);
    }
    // 中距离：靠近
    if (r() < cfg.jump) return queue([{ up: true, [fwd]: true }, { [fwd]: true }, {}]);
    return queue(Array.from({ length: 4 + Math.floor(r() * 8) }, () => ({ [fwd]: true })));
  };
}
