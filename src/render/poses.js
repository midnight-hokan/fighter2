// 占位小人的姿态（在没有精灵图时使用）。骨架：髋 → 躯干 → 头；肩 → 上臂 → 前臂；髋 → 大腿 → 小腿。
// 角度以"竖直向下"为 0，正值 = 向前（朝向对手）旋转，单位弧度。
const P = Math.PI;
const S = Math.sin;

export const BONES = { thigh: 22, shin: 22, torso: 32, upper: 15, fore: 15, head: 8 };

const base = {
  hipY: 44, lean: 0,
  armF: [0.5, 1.6], armB: [0.2, 1.4],   // [上臂, 前臂相对上臂]
  legF: [0.25, -0.2], legB: [-0.2, -0.15],
};

const pose = (o) => ({ ...base, ...o });

// t：动作已进行帧数；p：招式进度 0–1；active：是否在有效帧
export const POSES = {
  idle: (t) => pose({ hipY: 43 + Math.round(S(t * 0.12)), armF: [0.6, 1.7], armB: [0.3, 1.6] }),
  walkf: (t) => pose({ legF: [0.45 * S(t * 0.25), -0.2], legB: [-0.45 * S(t * 0.25), -0.2], armF: [0.5, 1.6] }),
  walkb: (t) => pose({ legF: [-0.4 * S(t * 0.2), -0.2], legB: [0.4 * S(t * 0.2), -0.2], lean: -0.1 }),
  crouch: () => pose({ hipY: 24, lean: 0.25, legF: [1.4, -1.9], legB: [0.4, -1.6], armF: [0.9, 1.4] }),
  prejump: () => pose({ hipY: 34, lean: 0.15, legF: [0.8, -1.2], legB: [0.3, -1.0] }),
  jump: (t) => pose({ hipY: 40, legF: [1.2, -1.8], legB: t < 8 ? [0.2, -0.4] : [0.9, -1.6], armF: [1.2, 1.0], armB: [2.4, 0.5] }),
  blockstun: () => pose({ lean: -0.15, armF: [1.0, 2.4], armB: [0.9, 2.5] }),
  crblock: () => pose({ hipY: 24, lean: 0.1, legF: [1.4, -1.9], legB: [0.4, -1.6], armF: [1.1, 2.3], armB: [1.0, 2.4] }),
  hitstun: (t) => pose({ lean: -0.35 - 0.1 * S(t * 0.5), armF: [-0.4, 0.5], armB: [-0.6, 0.4], legF: [0.3, -0.3] }),
  airhit: () => pose({ lean: -1.2, armF: [-1.2, 0.3], armB: [-1.6, 0.2], legF: [0.8, -0.4], legB: [0.3, -0.2] }),
  knockdown: () => pose({ hipY: 6, lean: -1.55, armF: [-1.6, 0], armB: [-1.5, 0], legF: [1.5, 0], legB: [1.4, 0] }),
  ko: () => pose({ hipY: 6, lean: -1.55, armF: [-1.7, 0], armB: [-1.4, 0.2], legF: [1.5, 0], legB: [1.3, 0.1] }),
  dizzy: (t) => pose({ lean: 0.15 * S(t * 0.15), armF: [-0.2, 0.3], armB: [-0.1, 0.3] }),
  roll: (t) => pose({ hipY: 18, lean: (t * 0.5) % (2 * P), legF: [2.2, -2.4], legB: [2.0, -2.3], armF: [1.6, 1.8], armB: [1.4, 1.8] }),
  maxstart: (t) => pose({ armF: [1.6 + 0.1 * S(t), 0.2], armB: [-1.6, -0.2], legF: [0.5, -0.1], legB: [-0.5, 0] }),
  win: (t) => pose({ armF: [3.0 + 0.1 * S(t * 0.2), 0.1], armB: [0.3, 1.5] }),

  // 招式动画（由招式数据里的 anim 字段决定，没写就按招式 id 猜）
  punch: (t, p, a) => pose({ lean: 0.1, armF: a ? [1.55, 0.05] : [1.0, 1.0] }),
  heavy: (t, p, a) => pose({ lean: a ? 0.3 : 0.1, armF: a ? [1.6, 0] : [0.6, 1.8], legB: [-0.4, -0.1] }),
  upper: (t, p, a) => pose({ hipY: a ? 44 : 30, lean: -0.1, armF: a ? [2.9, 0.1] : [1.2, 1.6], legF: a ? [0.3, -0.2] : [1.2, -1.6] }),
  kick: (t, p, a) => pose({ lean: -0.2, legF: a ? [1.45, 0] : [1.0, -1.4] }),
  highkick: (t, p, a) => pose({ lean: -0.4, legF: a ? [2.1, 0] : [1.2, -1.5], armB: [-0.4, 1.0] }),
  lowkick: (t, p, a) => pose({ hipY: 24, lean: 0.1, legF: a ? [1.5, 0] : [1.3, -1.7], legB: [0.4, -1.6] }),
  sweep: (t, p, a) => pose({ hipY: 20, lean: 0.4, legF: a ? [1.55, 0] : [1.3, -1.8], legB: [0.6, -1.7], armB: [0.6, 0.3] }),
  fireball: (t, p, a) => pose({ lean: 0.2, armF: p > 0.25 ? [1.6, 0] : [0.3, 1.2], armB: p > 0.25 ? [1.5, 0.1] : [0.1, 1.3], legF: [0.4, -0.1], legB: [-0.4, 0] }),
  uppercut: (t, p, a) => pose({ lean: -0.1, armF: [3.0, 0], armB: [0.2, 1.0], legF: [0.6, -1.2], legB: [-0.1, -0.2] }),
  spin: (t) => pose({ lean: 0.1, legF: [t % 8 < 4 ? 1.5 : -1.5, 0], legB: [t % 8 < 4 ? -0.5 : 0.5, -0.4], armF: [1.4, 0.2], armB: [-1.4, 0.2] }),
  super: (t, p, a) => pose({ lean: 0.35, armF: [1.6, 0], armB: [1.4, 0.2], legF: [0.6, -0.4], legB: [-0.6, 0] }),
  throw: (t, p) => pose({ lean: p < 0.4 ? 0.2 : -0.3, armF: p < 0.4 ? [1.5, 0.3] : [2.6, 0.4], armB: p < 0.4 ? [1.4, 0.4] : [2.4, 0.5] }),
  grab: (t, p) => pose({ lean: 0.2, armF: [1.5, 0.3], armB: [1.4, 0.4] }),
  rush: (t, p, a) => pose({ lean: 0.4, armF: [1.6, 0], legF: [0.8, -0.3], legB: [-0.8, 0] }),
};

export const ANIM_NAMES = Object.keys(POSES);

export function guessAnim(id) {
  if (!id) return 'punch';
  if (id === 'throw') return 'throw';
  if (id === 'gc') return 'heavy';
  const [stance, b] = id.split('.');
  if (!b) return 'super';
  if (b.endsWith('p')) return stance === 'cr' && b === 'hp' ? 'upper' : b === 'hp' ? 'heavy' : 'punch';
  if (stance === 'cr') return b === 'hk' ? 'sweep' : 'lowkick';
  return b === 'hk' ? 'highkick' : 'kick';
}

export function poseFor(state) {
  const f = state;
  let key = f.action;
  let p = 0;
  let active = false;
  if (f.action === 'attack' && f.move) {
    key = f.move.anim && POSES[f.move.anim] ? f.move.anim : guessAnim(f.move.id);
    p = Math.min(1, f.move.frame / Math.max(1, f.move.total));
    active = f.move.frame > f.move.startup && f.move.frame <= f.move.startup + f.move.active + 2;
  }
  if (f.action === 'blockstun' && f.blockLow) key = 'crblock';
  const fn = POSES[key] ?? POSES.idle;
  return fn(f.actionFrame, p, active);
}

// 正向运动学：返回各段线段（局部坐标，y 向上，朝右）
export function skeleton(pose) {
  const B = BONES;
  const at = (x, y, a, len) => [x + Math.sin(a) * len, y - Math.cos(a) * len];
  const hip = [0, pose.hipY];
  const lean = pose.lean;
  const neck = [hip[0] + Math.sin(lean) * B.torso, hip[1] + Math.cos(lean) * B.torso];
  const head = [neck[0] + Math.sin(lean) * B.head, neck[1] + Math.cos(lean) * B.head];
  const limb = (origin, [a1, a2], l1, l2, up = false) => {
    const k = up ? -1 : 1;
    const j1 = at(origin[0], origin[1], a1 * k, l1);
    const j2 = at(j1[0], j1[1], (a1 + a2) * k, l2);
    return [origin, j1, j2];
  };
  const shoulder = [neck[0] - Math.sin(lean) * 3, neck[1] - Math.cos(lean) * 3];
  return {
    hip, neck, head,
    armF: limb(shoulder, pose.armF, B.upper, B.fore),
    armB: limb(shoulder, pose.armB, B.upper, B.fore),
    legF: limb(hip, pose.legF, B.thigh, B.shin),
    legB: limb(hip, pose.legB, B.thigh, B.shin),
  };
}
