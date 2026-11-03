// 全局常量。坐标单位 = 像素（原生分辨率 384×224），时间单位 = 帧（60 帧 = 1 秒）。
// ⚠️ 引擎文件受 tests.lock 之外的 E 系列测试保护：改数值可以，但改完 E1–E8 必须仍然全绿。

export const FPS = 60;

export const SCREEN = { w: 384, h: 224, groundY: 200 };
export const STAGE = { left: 0, right: 768 };      // 场地宽度（两个屏幕）
export const MAX_SEPARATION = SCREEN.w - 48;       // 双方最大距离（不能走出镜头）

export const DIRS = ['up', 'down', 'left', 'right'];
export const PUNCHES = ['lp', 'mp', 'hp'];
export const KICKS = ['lk', 'mk', 'hk'];
export const ATTACKS = [...PUNCHES, ...KICKS];
export const BUTTONS = [...DIRS, ...ATTACKS];
export const NORMAL_IDS = ['st', 'cr', 'j'].flatMap(p => ATTACKS.map(b => `${p}.${b}`));
export const STRENGTH = { lp: 'l', mp: 'm', hp: 'h', lk: 'l', mk: 'm', hk: 'h' };

export const PHYS = {
  gravity: 0.42,
  prejump: 3,          // 起跳前的预备帧（这几帧内仍可出必杀，方便 360 指令）
  pushHalf: 18,        // 推挤盒半宽
};

export const HURT = { w: 32, h: 92, crouchH: 60, airH: 78 };

export const INPUT = {
  stepWindow: 10,      // 搓招相邻两个方向之间最多间隔的帧数
  motionWindow: 30,    // 普通搓招整体时限
  superWindow: 45,     // 超必杀（双重搓招）整体时限
  chargeFrames: 40,    // 蓄力所需帧数
  chargeWindow: 10,    // 蓄力释放后多少帧内必须按键
  simulWindow: 3,      // 同时按键的宽容帧数
  history: 90,
};

export const ROUND = { seconds: 99, introFrames: 0, endDelayFrames: 150, winsToMatch: 2, maxRounds: 5 };

// 拳皇97 进阶模式（Advanced）气槽
export const METER = {
  perStock: 100,
  maxStocks: 3,
  maxModeFrames: 480,  // 爆气持续时间
  maxDamageMul: 1.25,  // 爆气期间伤害加成
  sdmDamageMul: 1.6,   // MAX 超必杀相对普通超必杀的伤害倍率（招式可单独指定）
  gain: { normal: 4, special: 8, throw: 6, specialStart: 3, blockMul: 0.5, damagedPerPoint: 0.05 },
};

export const STUN = { decayDelay: 90, decayPerFrame: 0.5, dizzyFrames: 150 };
export const HITSTOP = { l: 6, m: 8, h: 10, super: 14, block: 5 };

// 连段与反击
export const COMBO = {
  lightChains: 2,       // 轻→轻 最多连 2 次
  scalePerHit: 0.1,     // 第 3 击起每击伤害 -10%
  minScale: 0.5,        // 普通技/必杀最低 50%
  superMinScale: 0.6,   // 超必杀最低 60%
  counterHitstun: 4,    // 反击额外硬直
  counterHitstop: 3,    // 反击额外顿帧
};
export const SUPER_FREEZE = 30;
export const KNOCKDOWN_FRAMES = 50;
export const ROLL = { frames: 26, invuln: [1, 16], speed: 4 };
export const MAX_START_FRAMES = 20;
export const THROW_PROTECT = 8;     // 受击/防御硬直结束后的防投帧数

// 默认的通用招式（角色数据里可以覆盖）
export const DEFAULT_GC = {
  name: '防御反击', startup: 4, active: 4, recovery: 20, damage: 30, chip: 0, stun: 0,
  hitstun: 20, blockstun: 12, level: 'mid', knockdown: true, invuln: [1, 10],
  hitbox: { x: 8, y: 30, w: 50, h: 50 }, anim: 'heavy',
};
