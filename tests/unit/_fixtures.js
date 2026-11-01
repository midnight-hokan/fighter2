// 测试专用角色（受保护，不得修改）。引擎测试只用这些固定数据，不依赖主题里的角色内容。
import { NORMAL_IDS } from '../../src/engine/constants.js';
import { Game } from '../../src/engine/game.js';

function normals() {
  const out = {};
  for (const id of NORMAL_IDS) {
    const [stance, b] = id.split('.');
    const s = b[0] === 'l' ? 0 : b[0] === 'm' ? 1 : 2;
    const kick = b.endsWith('k');
    out[id] = {
      name: id,
      startup: [4, 6, 8][s], active: 3, recovery: [7, 12, 20][s],
      damage: [30, 60, 100][s], stun: [4, 8, 14][s], hitstun: [12, 16, 20][s], blockstun: [9, 12, 15][s],
      cancel: s < 2 && stance !== 'j',
      level: stance === 'j' ? 'high' : stance === 'cr' && kick ? 'low' : 'mid',
      knockdown: id === 'cr.hk',
      hitbox: stance === 'j'
        ? { x: 6, y: 8, w: 44, h: 22 }
        : stance === 'cr'
          ? { x: 10, y: kick ? 0 : 36, w: 46 + s * 6, h: 14 }
          : { x: 12, y: kick ? 36 : 60, w: 40 + s * 8, h: 16 },
    };
  }
  return out;
}

const base = (id, extra) => ({
  id, name: `测试${id}`, title: '测试', style: '测试用', archetype: 'balanced', ending: '测试结局测试结局测试结局',
  colors: { primary: '#888888', secondary: '#dddddd' },
  stats: { health: 1000, walkF: 2.4, walkB: 1.9, jumpV: 8.4, jumpH: 3.0, stunMax: 100, throwRange: 44 },
  normals: normals(),
  throw: { name: '投', damage: 120, stun: 10 },
  ...extra,
});

export const FX = base('fx', {
  archetype: 'shoto',
  specials: [
    { id: 'ball', name: '波', input: '236P', startup: 12, active: 1, recovery: 30, damage: 70, chip: 12, stun: 10, hitstun: 18, blockstun: 14,
      projectile: { speed: 3.5, x: 34, y: 58, w: 26, h: 18, life: 220 },
      strength: { l: { projectile: { speed: 2, x: 34, y: 58, w: 26, h: 18, life: 300 } }, h: { projectile: { speed: 5, x: 34, y: 58, w: 26, h: 18, life: 160 } } } },
    { id: 'rise', name: '升', input: '623P', startup: 3, active: 12, recovery: 24, damage: 120, chip: 10, stun: 15, knockdown: true, invuln: [1, 8],
      hitbox: { x: 2, y: 40, w: 36, h: 70 }, move: { vy: 7.6, vx: 1.2, at: 4 } },
    { id: 'spin', name: '旋', input: '214K', startup: 10, active: 18, recovery: 16, damage: 80, chip: 8, stun: 10,
      hitbox: { x: -20, y: 44, w: 70, h: 24 }, move: { vx: 3, frames: 18, at: 10 } },
    { id: 'half', name: '半圆', input: '41236K', startup: 8, active: 6, recovery: 20, damage: 90, chip: 9, stun: 10, hitbox: { x: 10, y: 30, w: 60, h: 30 } },
  ],
  supers: [
    { id: 'big', name: '超', input: '236236P', startup: 6, active: 24, recovery: 30, damage: 300, chip: 40, knockdown: true, invuln: [1, 12],
      hitbox: { x: 8, y: 20, w: 70, h: 72 }, move: { vx: 4, frames: 20, at: 6 }, sdm: { damage: 460 } },
  ],
});

export const FXC = base('fxc', {
  archetype: 'charge',
  specials: [
    { id: 'boom', name: '音', input: '[4]6P', startup: 10, active: 1, recovery: 26, damage: 60, chip: 10, stun: 8,
      projectile: { speed: 4, x: 30, y: 58, w: 24, h: 16, life: 220 } },
    { id: 'flash', name: '空', input: '[2]8K', startup: 3, active: 10, recovery: 28, damage: 120, chip: 10, stun: 14, knockdown: true, invuln: [1, 6],
      hitbox: { x: 0, y: 30, w: 44, h: 70 }, move: { vy: 7, vx: 1, at: 3 } },
    { id: 'dash', name: '冲', input: '214P', startup: 8, active: 10, recovery: 18, damage: 70, chip: 7, stun: 8, hitbox: { x: 10, y: 40, w: 50, h: 30 }, move: { vx: 4, frames: 12, at: 6 } },
  ],
  supers: [
    { id: 'csuper', name: '蓄超', input: '236236K', startup: 5, active: 20, recovery: 30, damage: 280, chip: 30, knockdown: true, invuln: [1, 10],
      hitbox: { x: 8, y: 20, w: 70, h: 72 }, move: { vx: 4, frames: 18, at: 5 } },
  ],
});

export const FXG = base('fxg', {
  archetype: 'grappler',
  stats: { health: 1100, walkF: 1.8, walkB: 1.5, jumpV: 8, jumpH: 2.6, stunMax: 120, throwRange: 48 },
  specials: [
    { id: 'pile', name: '摔', input: '360P', startup: 2, active: 1, recovery: 30, damage: 200, stun: 20, throw: true, range: 60 },
    { id: 'lariat', name: '旋臂', input: '236K', startup: 8, active: 16, recovery: 20, damage: 90, chip: 9, stun: 10, hitbox: { x: -30, y: 50, w: 80, h: 30 } },
    { id: 'head', name: '头', input: '623P', startup: 4, active: 8, recovery: 26, damage: 100, chip: 10, stun: 12, invuln: [1, 6], hitbox: { x: 4, y: 50, w: 40, h: 50 } },
  ],
  supers: [
    { id: 'gsuper', name: '大摔', input: '236236P', startup: 4, active: 10, recovery: 30, damage: 320, chip: 30, knockdown: true, invuln: [1, 8],
      hitbox: { x: 8, y: 20, w: 50, h: 72 } },
  ],
});

export const MID = 384;

export function newGame(opts = {}) {
  return new Game({ seed: 1, characters: opts.characters ?? [FX, FX], ...opts });
}

// 段落式输入：[[p1, p2, 帧数], ...]，返回每帧之后的状态
export function play(game, segments) {
  const states = [];
  for (const [a, b, frames] of segments) {
    for (let i = 0; i < frames; i++) {
      game.step([a ?? {}, b ?? {}]);
      states.push(game.getState());
    }
  }
  return states;
}

export const idle = (game, n) => play(game, [[{}, {}, n]]);
export const events = (states, type) => states.flatMap(s => s.events.filter(e => type === undefined || e.type === type));

// P1 面朝右时，把小键盘方向序列转成段落
const KEY = { 1: { down: true, left: true }, 2: { down: true }, 3: { down: true, right: true }, 4: { left: true }, 5: {}, 6: { right: true }, 7: { up: true, left: true }, 8: { up: true }, 9: { up: true, right: true } };
export function motion(dirs, button, { player = 0, facing = 1, hold = 2 } = {}) {
  const mirror = (k) => (facing > 0 ? k : Object.fromEntries(Object.entries(k).map(([key, v]) => [key === 'left' ? 'right' : key === 'right' ? 'left' : key, v])));
  const segs = [];
  const ds = String(dirs).split('').map(Number);
  ds.forEach((d, i) => {
    const k = mirror(KEY[d]);
    const last = i === ds.length - 1;
    const input = last && button ? { ...k, [button]: true } : k;
    segs.push(player === 0 ? [input, {}, last ? 1 : hold] : [{}, input, last ? 1 : hold]);
  });
  return segs;
}
