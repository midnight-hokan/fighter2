// 角色数据校验器：返回错误列表（空数组 = 合格）。测试和大炮都用它检查角色数据。
import { NORMAL_IDS } from './constants.js';
import { parseCommand } from './input.js';

export const ARCHETYPES = ['shoto', 'charge', 'grappler', 'rushdown', 'zoner', 'speed', 'power', 'balanced'];
const LEVELS = ['mid', 'low', 'high'];

const isInt = (v) => Number.isInteger(v);
const inRange = (v, lo, hi) => typeof v === 'number' && v >= lo && v <= hi;

function checkMove(m, label, errs, { needHitbox = true } = {}) {
  if (!m || typeof m !== 'object') { errs.push(`${label}：缺少招式数据`); return; }
  if (!m.name) errs.push(`${label}：缺少 name`);
  if (!isInt(m.startup) || m.startup < 1 || m.startup > 40) errs.push(`${label}：startup 应为 1–40 的整数`);
  if (!isInt(m.active) || m.active < 1 || m.active > 60) errs.push(`${label}：active 应为 1–60 的整数`);
  if (!isInt(m.recovery) || m.recovery < 0 || m.recovery > 80) errs.push(`${label}：recovery 应为 0–80 的整数`);
  if (!inRange(m.damage, 0, 600)) errs.push(`${label}：damage 应在 0–600`);
  if (m.hitstun !== undefined && !inRange(m.hitstun, 1, 60)) errs.push(`${label}：hitstun 应在 1–60`);
  if (m.blockstun !== undefined && !inRange(m.blockstun, 1, 60)) errs.push(`${label}：blockstun 应在 1–60`);
  if (m.level && !LEVELS.includes(m.level)) errs.push(`${label}：level 只能是 ${LEVELS.join('/')}`);
  if (m.invuln && !(Array.isArray(m.invuln) && m.invuln.length === 2 && m.invuln[0] <= m.invuln[1])) errs.push(`${label}：invuln 应为 [起, 止]`);
  const hasBox = m.hitbox && ['x', 'y', 'w', 'h'].every(k => typeof m.hitbox[k] === 'number') && m.hitbox.w > 0 && m.hitbox.h > 0;
  if (needHitbox && !m.projectile && !m.throw && !hasBox) errs.push(`${label}：缺少有效的 hitbox {x,y,w,h}`);
  if (m.projectile && !(m.projectile.speed > 0)) errs.push(`${label}：projectile.speed 必须大于 0`);
}

export function validateCharacter(c) {
  const errs = [];
  if (!c || typeof c !== 'object') return ['角色数据不是对象'];
  for (const k of ['id', 'name', 'title', 'style', 'archetype', 'ending']) if (!c[k]) errs.push(`缺少 ${k}`);
  if (c.archetype && c.archetype !== 'placeholder' && !ARCHETYPES.includes(c.archetype)) errs.push(`archetype 只能是 ${ARCHETYPES.join('/')}`);
  if (!c.colors?.primary) errs.push('缺少 colors.primary');
  const s = c.stats ?? {};
  const ranges = { health: [800, 1200], walkF: [1.2, 4.5], walkB: [1, 4], jumpV: [6.5, 11], jumpH: [1.8, 5], stunMax: [70, 160], throwRange: [30, 70] };
  for (const [k, [lo, hi]] of Object.entries(ranges)) if (!inRange(s[k], lo, hi)) errs.push(`stats.${k} 应在 ${lo}–${hi}`);
  for (const id of NORMAL_IDS) checkMove(c.normals?.[id], `普通技 ${id}`, errs);
  if (!c.throw || !(c.throw.damage > 0)) errs.push('缺少 throw.damage');
  const specials = c.specials ?? [];
  const supers = c.supers ?? [];
  if (specials.length < 3) errs.push('必杀技至少 3 个');
  if (supers.length < 1) errs.push('超必杀至少 1 个');
  const inputs = new Set();
  for (const [i, m] of [...specials, ...supers].entries()) {
    const label = `${i < specials.length ? '必杀技' : '超必杀'} ${m.id ?? i}`;
    if (!m.id) errs.push(`${label}：缺少 id`);
    try { parseCommand(m.input); } catch (e) { errs.push(`${label}：${e.message}`); }
    if (inputs.has(m.input)) errs.push(`${label}：指令 ${m.input} 重复`);
    inputs.add(m.input);
    checkMove(m, label, errs);
  }
  for (const m of supers) {
    let p = null;
    try { p = parseCommand(m.input); } catch { /* 已报错 */ }
    if (p && p.type === 'motion' && p.dirs.length < 6) errs.push(`超必杀 ${m.id}：指令应为双重搓招（如 236236P）`);
    if (!(m.damage >= 200)) errs.push(`超必杀 ${m.id}：伤害应不低于 200`);
  }
  return errs;
}
