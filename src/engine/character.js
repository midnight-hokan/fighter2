// 角色数据预处理：解析指令、补默认值、按优先级排序。
// 角色数据格式见 src/theme/README-角色数据格式.md 与 validate.js。
import { parseCommand, commandLength } from './input.js';
import { HURT, DEFAULT_GC, KOF } from './constants.js';

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
  kofNormals(normals);
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

// 拳皇式普通技规则（只在引擎里推导，角色数据文件不用改）：
// - 脚比手长：站/蹲的脚判定横向 ×1.3；重脚发生 +1 帧
// - 取消：拳类（轻拳、蹲重拳、近身重拳/重脚）和蹲轻脚可取消成必杀；远距离重拳重脚和其他脚不能取消
// - 近身 C/D（cl.hp / cl.hk）：由站立重拳重脚推导，发生快 3 帧、判定短、可取消
// - CD 吹飞攻击（cd / j.cd）：重拳+重脚同时按，击倒、可取消
function kofNormals(n) {
  for (const [id, m] of Object.entries(n)) {
    if (id.startsWith('j.')) continue;
    if (/k$/.test(id) && m.hitbox) {
      m.hitbox = { ...m.hitbox, w: Math.round(m.hitbox.w * KOF.kickReach) };
      if (id.endsWith('hk')) m.startup += 1;
    }
    if (['st.lp', 'cr.lp', 'cr.lk', 'cr.hp', 'st.mp', 'cr.mp'].includes(id)) m.cancel = true;
    if (['st.hp', 'st.hk', 'st.lk', 'st.mk', 'cr.mk', 'cr.hk'].includes(id)) m.cancel = false;
  }
  const close = (src, id, name) => {
    if (!src || n[id]) return;
    n[id] = {
      ...src, id, name,
      startup: Math.max(3, src.startup - 3), recovery: Math.max(8, src.recovery - 4),
      damage: Math.round(src.damage * 0.9), cancel: true,
      hitbox: src.hitbox ? { ...src.hitbox, w: Math.round(src.hitbox.w * 0.65) } : null,
    };
  };
  close(n['st.hp'], 'cl.hp', `近身${n['st.hp']?.name ?? '重拳'}`);
  close(n['st.hk'], 'cl.hk', `近身${n['st.hk']?.name ?? '重脚'}`);
  const hk = n['st.hk'];
  if (hk && !n.cd) {
    n.cd = {
      ...hk, id: 'cd', name: '吹飞攻击', startup: 10, active: 4, recovery: 20,
      damage: 80, stun: 10, hitstun: 22, blockstun: 16, knockdown: true, cancel: true, pushback: 22,
      hitbox: hk.hitbox ? { ...hk.hitbox, w: Math.round(hk.hitbox.w * 1.05), h: hk.hitbox.h + 10 } : null,
    };
  }
  const jhk = n['j.hk'];
  if (jhk && !n['j.cd']) n['j.cd'] = { ...jhk, id: 'j.cd', name: '空中吹飞', startup: 7, active: 6, damage: 85, hitbox: jhk.hitbox ? { ...jhk.hitbox, w: Math.round(jhk.hitbox.w * 1.15) } : null };
}
