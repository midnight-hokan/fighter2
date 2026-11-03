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
  punch: (t, p, a) => pose({ lean: a ? 0.2 : 0.05, armF: a ? [1.57, 0.02] : [0.9, 1.4], armB: a ? [0.1, 1.7] : [0.3, 1.5] }),
  heavy: (t, p, a) => pose({ lean: a ? 0.4 : -0.05, armF: a ? [1.6, 0] : [0.4, 2.0], armB: a ? [-0.2, 1.6] : [0.6, 1.4], legF: a ? [0.5, -0.1] : [0.2, -0.2], legB: [-0.5, -0.05] }),
  upper: (t, p, a) => pose({ hipY: a ? 44 : 30, lean: -0.1, armF: a ? [2.9, 0.1] : [1.2, 1.6], legF: a ? [0.3, -0.2] : [1.2, -1.6] }),
  kick: (t, p, a) => pose({ lean: a ? -0.35 : -0.15, legF: a ? [1.55, 0] : [1.1, -1.6], legB: a ? [-0.15, -0.05] : [-0.2, -0.15], armB: a ? [-0.5, 1.2] : [0.2, 1.4] }),
  highkick: (t, p, a) => pose({ lean: a ? -0.6 : -0.25, legF: a ? [1.95, 0] : [1.3, -1.8], legB: [-0.1, -0.05], armF: a ? [0.9, 1.5] : [0.6, 1.7], armB: [-0.6, 1.0] }),
  lowkick: (t, p, a) => pose({ hipY: 24, lean: a ? -0.05 : 0.15, legF: a ? [1.6, 0] : [1.3, -1.8], legB: [0.4, -1.6] }),
  sweep: (t, p, a) => pose({ hipY: 16, lean: a ? 0.55 : 0.35, legF: a ? [1.62, 0] : [1.3, -1.9], legB: [0.7, -1.9], armF: [1.4, 0.4], armB: [0.8, 0.3] }),
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
    const rec = Math.max(1, f.move.total - f.move.startup - f.move.active);
    // 飞行道具、旋风腿等按时间变化的动画仍用原函数；其余攻击用关键帧插值
    if (!['spin', 'throw', 'grab'].includes(key)) return attackPose(key, f.move.frame, f.move.startup, f.move.active, rec, f.actionFrame);
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

// —— 攻击动作的关键帧插值 ——
// 每个招式动画在 POSES 里只定义"蓄力"（active=false）和"出招"（active=true）两个姿势；
// 这里按帧数把它们串成连贯动作：架势 → 蓄力（发生前段）→ 出招（发生末段到持续结束）→ 收招回架势。
const lerp = (a, b, k) => a + (b - a) * k;
function mix(A, B, k) {
  const out = {};
  for (const key of Object.keys(A)) {
    const a = A[key], b = B[key] ?? a;
    out[key] = Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], k)) : lerp(a, b, k);
  }
  return out;
}
const ease = (k) => k * k * (3 - 2 * k);

export function attackPose(anim, frame, startup, active, recovery, t = frame) {
  const fn = POSES[anim] ?? POSES.punch;
  const total = startup + active + recovery;
  const p = frame / Math.max(1, total);
  const G = POSES.idle(0);
  const W = fn(t, p, false);
  const S = fn(t, p, true);
  const w1 = Math.max(1, Math.round(startup * 0.55));
  if (frame <= w1) return mix(G, W, ease(frame / w1));                        // 架势 → 蓄力
  if (frame <= startup) return mix(W, S, ease((frame - w1) / Math.max(1, startup - w1)));  // 蓄力 → 出招
  if (frame <= startup + active + 1) return S;                                // 持续：保持出招姿势
  const r = (frame - startup - active - 1) / Math.max(1, recovery - 1);
  return mix(S, G, ease(Math.min(1, r)));                                     // 收招 → 架势
}
