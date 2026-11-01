// 示例角色（完整数据，作为其他角色的参考模板）
// 数据格式说明见 docs/角色数据格式.md；校验器 src/engine/validate.js
export default {
  id: 'c01',
  name: '烈岩',
  title: '矿脉拳士',
  style: '黑色短褂、腰缠矿灯带的年轻拳手，出拳带火星',
  archetype: 'shoto',
  colors: { primary: '#c8452c', secondary: '#f2c14e', skin: '#e0ac7e' },
  ending: '烈岩打穿了最深的矿脉，却发现地火之下还有更强的对手在等他。他把矿灯系紧，转身走进了下一条巷道。',
  stats: { health: 1000, walkF: 2.4, walkB: 1.9, jumpV: 8.4, jumpH: 3.0, stunMax: 100, throwRange: 44 },

  normals: {
    'st.lp': { name: '刺拳', startup: 4, active: 3, recovery: 7, damage: 30, stun: 4, hitstun: 12, blockstun: 9, hitbox: { x: 12, y: 62, w: 38, h: 14 }, cancel: true, pushback: 8, anim: 'punch' },
    'st.mp': { name: '直拳', startup: 6, active: 3, recovery: 12, damage: 60, stun: 8, hitstun: 16, blockstun: 12, hitbox: { x: 12, y: 62, w: 46, h: 16 }, cancel: true, anim: 'punch' },
    'st.hp': { name: '重拳', startup: 8, active: 4, recovery: 20, damage: 100, stun: 14, hitstun: 20, blockstun: 15, hitbox: { x: 12, y: 60, w: 52, h: 18 }, pushback: 14, anim: 'heavy' },
    'st.lk': { name: '前踢', startup: 5, active: 3, recovery: 9, damage: 35, stun: 4, hitstun: 12, blockstun: 9, hitbox: { x: 10, y: 30, w: 44, h: 14 }, anim: 'kick' },
    'st.mk': { name: '中段踢', startup: 7, active: 3, recovery: 14, damage: 65, stun: 8, hitstun: 16, blockstun: 12, hitbox: { x: 10, y: 40, w: 52, h: 16 }, anim: 'kick' },
    'st.hk': { name: '回旋踢', startup: 10, active: 4, recovery: 22, damage: 105, stun: 14, hitstun: 20, blockstun: 15, hitbox: { x: 10, y: 56, w: 60, h: 18 }, pushback: 16, anim: 'highkick' },
    'cr.lp': { name: '蹲刺拳', startup: 4, active: 2, recovery: 7, damage: 25, stun: 3, hitstun: 11, blockstun: 8, hitbox: { x: 10, y: 40, w: 36, h: 12 }, cancel: true, anim: 'punch' },
    'cr.mp': { name: '蹲直拳', startup: 6, active: 3, recovery: 12, damage: 55, stun: 7, hitstun: 15, blockstun: 11, hitbox: { x: 10, y: 38, w: 44, h: 14 }, cancel: true, anim: 'punch' },
    'cr.hp': { name: '上勾拳', startup: 7, active: 5, recovery: 22, damage: 95, stun: 12, hitstun: 20, blockstun: 14, hitbox: { x: 4, y: 50, w: 40, h: 54 }, cancel: true, anim: 'upper' },
    'cr.lk': { name: '蹲踢', startup: 5, active: 3, recovery: 9, damage: 30, stun: 3, hitstun: 11, blockstun: 8, level: 'low', hitbox: { x: 10, y: 0, w: 46, h: 12 }, cancel: true, anim: 'lowkick' },
    'cr.mk': { name: '扫腿', startup: 7, active: 3, recovery: 15, damage: 55, stun: 7, hitstun: 15, blockstun: 11, level: 'low', hitbox: { x: 10, y: 0, w: 56, h: 12 }, cancel: true, anim: 'lowkick' },
    'cr.hk': { name: '大扫堂', startup: 9, active: 4, recovery: 24, damage: 90, stun: 12, hitstun: 18, blockstun: 13, level: 'low', knockdown: true, hitbox: { x: 8, y: 0, w: 64, h: 14 }, anim: 'sweep' },
    'j.lp': { name: '跳刺拳', startup: 4, active: 6, recovery: 4, damage: 35, stun: 5, hitstun: 12, blockstun: 9, hitbox: { x: 6, y: 30, w: 34, h: 16 }, anim: 'punch' },
    'j.mp': { name: '跳直拳', startup: 6, active: 5, recovery: 6, damage: 60, stun: 9, hitstun: 16, blockstun: 12, hitbox: { x: 8, y: 26, w: 40, h: 18 }, anim: 'punch' },
    'j.hp': { name: '跳重拳', startup: 8, active: 5, recovery: 8, damage: 90, stun: 14, hitstun: 20, blockstun: 14, hitbox: { x: 8, y: 20, w: 46, h: 22 }, anim: 'heavy' },
    'j.lk': { name: '跳膝', startup: 5, active: 7, recovery: 4, damage: 40, stun: 5, hitstun: 12, blockstun: 9, hitbox: { x: 4, y: 10, w: 38, h: 18 }, anim: 'kick' },
    'j.mk': { name: '跳踢', startup: 6, active: 5, recovery: 6, damage: 65, stun: 9, hitstun: 16, blockstun: 12, hitbox: { x: 6, y: 6, w: 44, h: 18 }, anim: 'kick' },
    'j.hk': { name: '跳重踢', startup: 8, active: 5, recovery: 8, damage: 95, stun: 14, hitstun: 20, blockstun: 14, hitbox: { x: 6, y: 4, w: 52, h: 20 }, anim: 'highkick' },
  },

  throw: { name: '过肩摔', damage: 120, stun: 10 },

  specials: [
    {
      id: 'meiyan', name: '煤焰弹', input: '236P', desc: '打出一团煤焰，轻中重决定速度',
      startup: 12, active: 1, recovery: 30, damage: 70, chip: 12, stun: 10, hitstun: 18, blockstun: 14,
      projectile: { speed: 3.5, x: 34, y: 58, w: 26, h: 18, life: 220 }, anim: 'fireball',
      strength: {
        l: { projectile: { speed: 2.4, x: 34, y: 58, w: 26, h: 18, life: 260 } },
        h: { projectile: { speed: 5, x: 34, y: 58, w: 26, h: 18, life: 160 } },
      },
    },
    {
      id: 'chongtian', name: '冲天凿', input: '623P', desc: '对空必杀，起手无敌',
      startup: 3, active: 12, recovery: 24, damage: 120, chip: 10, stun: 15, hitstun: 24, blockstun: 16,
      knockdown: true, invuln: [1, 8], hitbox: { x: 2, y: 40, w: 36, h: 70 },
      move: { vy: 7.6, vx: 1.2, at: 4 }, anim: 'uppercut',
      strength: { l: { damage: 95, invuln: [1, 4], move: { vy: 6, vx: 0.8, at: 4 } } },
    },
    {
      id: 'xuanfeng', name: '旋风镐', input: '214K', desc: '旋身突进踢，可穿过飞行道具下方',
      startup: 10, active: 18, recovery: 16, damage: 85, chip: 8, stun: 10, hitstun: 28, blockstun: 12,
      hitbox: { x: -20, y: 44, w: 70, h: 24 }, move: { vx: 3.0, frames: 18, at: 10 }, anim: 'spin',
    },
  ],

  supers: [
    {
      id: 'dihuolong', name: '地火龙', input: '236236P', desc: '燃烧斗气全身突进，MAX 状态下威力更大',
      startup: 6, active: 24, recovery: 30, damage: 300, chip: 40, stun: 0, hitstun: 30, blockstun: 20,
      knockdown: true, invuln: [1, 12], hitbox: { x: 8, y: 20, w: 70, h: 72 },
      move: { vx: 4, frames: 20, at: 6 }, anim: 'super', sdm: { damage: 460, invuln: [1, 20] },
    },
  ],
};
