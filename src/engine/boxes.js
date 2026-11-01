// 判定框工具。招式里的 hitbox 以角色脚底中心为原点、朝向为正方向：{ x:向前偏移, y:离地高度, w, h }
import { PHYS } from './constants.js';

export function worldBox(f, box) {
  const x1 = f.facing >= 0 ? f.x + box.x : f.x - box.x - box.w;
  return { x1, x2: x1 + box.w, y1: f.y + box.y, y2: f.y + box.y + box.h };
}

export function overlap(a, b) {
  return !!a && !!b && a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

const CROUCH_ACTIONS = new Set(['crouch', 'crblock']);

export function isCrouching(f) {
  if (CROUCH_ACTIONS.has(f.action)) return true;
  if (f.action === 'attack' && f.move?.def.id?.startsWith('cr.')) return true;
  if (f.action === 'blockstun' && f.blockLow) return true;
  return false;
}

export function hurtbox(f, hurt) {
  if (f.action === 'knockdown' || f.action === 'ko') return null;
  const half = hurt.w / 2;
  const h = !f.grounded ? hurt.airH : isCrouching(f) ? hurt.crouchH : hurt.h;
  return { x1: f.x - half, x2: f.x + half, y1: f.y, y2: f.y + h };
}

export function pushHalf(stats) {
  return stats?.pushHalf ?? PHYS.pushHalf;
}
