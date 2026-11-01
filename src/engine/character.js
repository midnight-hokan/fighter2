// 角色数据预处理：解析指令、补默认值、按优先级排序。
// 角色数据格式见 src/theme/README-角色数据格式.md 与 validate.js。
import { parseCommand, commandLength } from './input.js';
import { HURT, DEFAULT_GC } from './constants.js';

export const DEFAULT_STATS = {
  health: 1000, walkF: 2.4, walkB: 1.9, jumpV: 8.4, jumpH: 3.0, stunMax: 100, throwRange: 44,
};

function withDefaults(move, kind, id) {
  return {
    id, kind,
    name: move.name ?? id,
    startup: move.startup, active: move.active ?? 1, recovery: move.recovery ?? 0,
    damage: move.damage ?? 0, chip: move.chip ?? 0, stun: move.stun ?? 0,
    hitstun: move.hitstun ?? 16, blockstun: move.blockstun ?? 10,
    level: move.level ?? (id?.startsWith('j.') ? 'high' : id?.startsWith('cr.') && /k$/.test(id) ? 'low' : 'mid'),
    hitbox: move.hitbox ?? null,
    knockdown: !!move.knockdown,
    cancel: !!move.cancel,
    pushback: move.pushback ?? 10,
    hitstop: move.hitstop ?? null,
    invuln: move.invuln ?? null,
    move: move.move ?? null,         // { vx, vy, at }：在第 at 帧给自身速度（升龙上升、突进）
    projectile: move.projectile ?? null, // { speed, x, y, w, h, life }
    throw: !!move.throw,
    range: move.range ?? null,
    meterGain: move.meterGain ?? null,
    strength: move.strength ?? null, // { l:{...}, m:{...}, h:{...} } 按键强度覆盖
    sdm: move.sdm ?? null,           // MAX 超必杀覆盖
    anim: move.anim ?? null,
    air: !!move.air,
    cost: move.cost ?? (kind === 'super' ? 1 : 0),
    input: move.input ?? null,
    desc: move.desc ?? '',
  };
}

export function prepareCharacter(def) {
  if (!def || !def.id) throw new Error('角色数据缺少 id');
  const stats = { ...DEFAULT_STATS, ...(def.stats ?? {}) };
  const hurt = { ...HURT, ...(def.hurt ?? {}) };
  const normals = {};
  for (const [id, m] of Object.entries(def.normals ?? {})) normals[id] = withDefaults(m, 'normal', id);
  const throwMove = withDefaults({ startup: 3, active: 1, recovery: 20, damage: 120, stun: 10, knockdown: true, anim: 'throw', ...(def.throw ?? {}) }, 'throw', 'throw');
  const prep = (list, kind) => (list ?? []).map((m) => {
    const parsed = parseCommand(m.input);
    return { ...withDefaults(m, kind, m.id), parsed, len: commandLength(parsed) };
  }).sort((a, b) => b.len - a.len);
  const specials = prep(def.specials, 'special');
  const supers = prep(def.supers, 'super');
  const gc = withDefaults({ ...DEFAULT_GC, ...(def.gc ?? {}) }, 'gc', 'gc');
  return { def, id: def.id, name: def.name, stats, hurt, normals, throwMove, specials, supers, gc };
}

// 根据强度合并招式覆盖项
export function resolveStrength(move, strength) {
  if (!move.strength || !move.strength[strength]) return move;
  return { ...move, ...move.strength[strength] };
}

export function totalFrames(move) {
  return move.startup + move.active + move.recovery;
}
