#!/usr/bin/env node
// 生成 R1 原创角色 c02–c08（c01 烈岩为手写模板，不动）。
// 普通技以 c01 为基底做数值微调；必杀/超必杀/结局为每角色独立设计。
// 用法：node scripts/gen-characters.mjs  → 覆盖写 src/theme/meilong/characters/c0[2-8].js
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import base from '../src/theme/meilong/characters/c01.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'src', 'theme', 'meilong', 'characters');
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- 普通技微调 ----------
function makeNormals(cfg) {
  const n = clone(base.normals);
  const ids = Object.keys(n);
  for (const id of ids) {
    const m = n[id];
    let startup = m.startup + (cfg.startupDelta?.[id] ?? cfg.startupAll ?? 0);
    startup = Math.max(2, startup);
    m.startup = startup;
    if (cfg.damageMul) m.damage = Math.round(m.damage * cfg.damageMul);
    if (cfg.damageMulIds && cfg.damageMulIds.includes(id)) m.damage = Math.round(m.damage * (cfg.damageMulIdsVal ?? 1.1));
  }
  return n;
}

// ---------- 角色定义 ----------
const CHARS = [
  {
    id: 'c02', name: '炭守', title: '深井守望者', archetype: 'charge',
    stage: 's01',
    style: '中年矿工，体格敦实，穿厚皮褂，护目镜推在额头上，双掌老茧厚得能挡火花',
    colors: { primary: '#b5651d', secondary: '#e8d5a3', skin: '#c9986a' },
    ending: '深井的灯灭那天，炭守第一次走出黑暗。他抬头看见满天星子，才知道井外的世界从来不是黑的。',
    stats: { health: 1050, walkF: 2.0, walkB: 1.8, jumpV: 7.6, jumpH: 2.6, stunMax: 110, throwRange: 40 },
    normals: { damageMul: 1.02 },
    throw: { name: '腕吊摔', damage: 130, stun: 10 },
    specials: [
      { id: 'baokong', name: '爆空弹', input: '[4]6P', desc: '后蓄力前放，压缩瓦斯气团（飞行道具）',
        startup: 14, active: 1, recovery: 34, damage: 80, chip: 15, stun: 10, hitstun: 18, blockstun: 14,
        projectile: { speed: 3.0, x: 30, y: 56, w: 30, h: 20, life: 240 }, anim: 'fireball' },
      { id: 'tanshui', name: '炭水击', input: '[4]6K', desc: '后蓄力前放，贴地煤水波，下段',
        startup: 18, active: 1, recovery: 40, damage: 110, chip: 20, stun: 12, hitstun: 20, blockstun: 16,
        level: 'low', projectile: { speed: 2.2, x: 26, y: 8, w: 40, h: 14, life: 260 }, anim: 'fireball' },
      { id: 'chongtianshan', name: '冲天闪', input: '[2]8K', desc: '下蓄力上放，对空上勾，起手无敌',
        startup: 6, active: 10, recovery: 26, damage: 105, chip: 12, stun: 16, hitstun: 20, blockstun: 16,
        knockdown: true, invuln: [1, 10], hitbox: { x: 2, y: 40, w: 36, h: 68 }, anim: 'uppercut' },
    ],
    supers: [
      { id: 'longxuantan', name: '龙旋炭钻', input: '236236P', desc: '全身压缩瓦斯，冲拳钻地突进',
        startup: 8, active: 26, recovery: 32, damage: 280, chip: 45, stun: 0, hitstun: 30, blockstun: 22,
        knockdown: true, invuln: [1, 14], hitbox: { x: 8, y: 20, w: 72, h: 70 },
        move: { vx: 3.6, frames: 20, at: 8 }, anim: 'super', sdm: { damage: 480, invuln: [1, 22] } },
    ],
  },
  {
    id: 'c03', name: '钢驮', title: '运矿巨汉', archetype: 'grappler',
    stage: 's06',
    style: '身高两米的运矿工，钢架背心配厚底工靴，肩宽得像一辆矿车，走路带起煤尘',
    colors: { primary: '#5a6b7a', secondary: '#9aa7b4', skin: '#b98a5e' },
    ending: '最后一车煤拉上井的那天，钢驮解下了挽具。他这辈子拉的都是别人的路，从今往后，拉自己的。',
    stats: { health: 1150, walkF: 1.8, walkB: 1.6, jumpV: 7.0, jumpH: 2.2, stunMax: 130, throwRange: 58 },
    normals: { damageMulIds: ['st.mp', 'st.hp', 'st.hk', 'cr.hp', 'cr.hk'], damageMulIdsVal: 1.1, startupDelta: { 'st.hp': 1, 'st.hk': 1 } },
    throw: { name: '黑推摔', damage: 150, stun: 12 },
    specials: [
      { id: 'zhongdan', name: '重弹摔', input: '360P', desc: '一圈指令投，抱摔砸地',
        startup: 8, active: 2, recovery: 30, damage: 160, stun: 12, throw: true, range: 56, anim: 'throw' },
      { id: 'suiluo', name: '碎落', input: '425P', desc: '下后上前砸落，下段击倒',
        startup: 10, active: 8, recovery: 26, damage: 110, chip: 14, stun: 14, hitstun: 20, blockstun: 14,
        level: 'low', knockdown: true, hitbox: { x: -6, y: 0, w: 56, h: 60 }, anim: 'heavy' },
      { id: 'kengtai', name: '坑台旋', input: '214K', desc: '扫堂腿，下段击倒',
        startup: 8, active: 6, recovery: 22, damage: 90, chip: 10, stun: 10, hitstun: 16, blockstun: 12,
        level: 'low', knockdown: true, hitbox: { x: 0, y: 0, w: 62, h: 16 }, anim: 'sweep' },
    ],
    supers: [
      { id: 'chaozhong', name: '超重摔', input: '236236K', desc: '扛起对手整圈砸地，下段',
        startup: 10, active: 22, recovery: 36, damage: 350, chip: 48, stun: 0, hitstun: 30, blockstun: 24,
        level: 'low', knockdown: true, invuln: [1, 8], hitbox: { x: -10, y: 0, w: 80, h: 80 },
        move: { vx: 2.6, frames: 18, at: 10 }, anim: 'super', sdm: { damage: 480 } },
    ],
  },
  {
    id: 'c04', name: '火萤', title: '灯廊灯女', archetype: 'rushdown',
    stage: 's02',
    style: '精瘦的灯女，短工装束腰系灯带，马尾扎得高，动作快得像窜动的火苗',
    colors: { primary: '#2e8b7a', secondary: '#f5f0dc', skin: '#e6b98d' },
    ending: '火萤把灯廊最后一盏灯点亮的时候，光不亮，但整条矿道的人都看见路了。她说这就够了。',
    stats: { health: 1080, walkF: 2.8, walkB: 2.2, jumpV: 8.8, jumpH: 3.4, stunMax: 95, throwRange: 42 },
    normals: { damageMul: 1.05, startupDelta: { 'st.lp': -1, 'st.lk': -1, 'cr.lp': -1, 'cr.lk': -1 } },
    throw: { name: '膝挂摔', damage: 130, stun: 10 },
    specials: [
      { id: 'denghua', name: '灯花蹴', input: '214P', desc: '下前滑步踢，突进压制',
        startup: 8, active: 10, recovery: 18, damage: 105, chip: 12, stun: 10, hitstun: 20, blockstun: 12,
        hitbox: { x: -16, y: 30, w: 60, h: 20 }, move: { vx: 2.8, frames: 14, at: 8 }, anim: 'kick' },
      { id: 'shanguang', name: '闪光旋', input: '41236P', desc: '下后下前跃起旋踢，起手无敌，对空',
        startup: 9, active: 12, recovery: 22, damage: 110, chip: 12, stun: 12, hitstun: 18, blockstun: 14,
        knockdown: true, invuln: [1, 6], hitbox: { x: -12, y: 40, w: 56, h: 30 }, move: { vx: 2.2, vy: 4.5, at: 6 }, anim: 'spin' },
      { id: 'jifenghua', name: '疾风花', input: '236K', desc: '前冲扫踢，快速接压',
        startup: 10, active: 14, recovery: 16, damage: 90, chip: 10, stun: 8, hitstun: 14, blockstun: 10,
        hitbox: { x: -14, y: 34, w: 54, h: 20 }, move: { vx: 3.2, frames: 16, at: 10 }, anim: 'rush' },
    ],
    supers: [
      { id: 'huaying', name: '花影旋', input: '214214P', desc: '化作灯影连续突刺',
        startup: 6, active: 24, recovery: 28, damage: 330, chip: 42, stun: 0, hitstun: 28, blockstun: 20,
        knockdown: true, invuln: [1, 10], hitbox: { x: -16, y: 20, w: 76, h: 60 },
        move: { vx: 3.4, frames: 18, at: 6 }, anim: 'super', sdm: { damage: 470 } },
    ],
  },
  {
    id: 'c05', name: '灯郎', title: '掌灯人', archetype: 'zoner',
    stage: 's03',
    style: '清瘦的掌灯老人，灰布长袍，背一根旧灯杆，眼神像灯油一样平静',
    colors: { primary: '#ffcc33', secondary: '#8a5a20', skin: '#d9a878' },
    ending: '灯油烧尽那天，路也走到了头。灯郎把灯杆一放，说：这条路，我亲自走完了。',
    stats: { health: 1050, walkF: 2.0, walkB: 2.0, jumpV: 7.4, jumpH: 2.8, stunMax: 90, throwRange: 36 },
    normals: {},
    throw: { name: '灯挑摔', damage: 110, stun: 8 },
    specials: [
      { id: 'denghuadan', name: '灯花弹', input: '236K', desc: '灯芯弹，飞行道具，速度快',
        startup: 12, active: 1, recovery: 28, damage: 65, chip: 12, stun: 10, hitstun: 18, blockstun: 14,
        projectile: { speed: 4.2, x: 30, y: 54, w: 24, h: 16, life: 200 }, anim: 'fireball' },
      { id: 'daiteng', name: '大镫弹', input: '623K', desc: '大镫慢弹，飞行道具，命中击退大',
        startup: 18, active: 1, recovery: 38, damage: 140, chip: 22, stun: 14, hitstun: 22, blockstun: 16,
        pushback: 18, projectile: { speed: 2.6, x: 30, y: 20, w: 34, h: 22, life: 240 }, anim: 'fireball' },
      { id: 'dengzhuo', name: '灯啄', input: '214P', desc: '近身快速戳拳，可取消',
        startup: 6, active: 3, recovery: 14, damage: 55, chip: 10, stun: 6, hitstun: 12, blockstun: 10,
        cancel: true, hitbox: { x: 10, y: 50, w: 44, h: 16 }, anim: 'punch' },
    ],
    supers: [
      { id: 'denghuadrag', name: '灯花龙', input: '236236K', desc: '灯杆挥出巨浪火弹，飞行道具',
        startup: 14, active: 1, recovery: 40, damage: 330, chip: 52, stun: 0, hitstun: 30, blockstun: 22,
        knockdown: true, projectile: { speed: 2.8, x: 36, y: 30, w: 44, h: 30, life: 300 },
        anim: 'super', sdm: { damage: 510, projectile: { speed: 3.4, x: 36, y: 30, w: 50, h: 34, life: 320 } } },
    ],
  },
  {
    id: 'c06', name: '青锋', title: '快镐手', archetype: 'speed',
    stage: 's01',
    style: '瘦长的年轻镐手，轻便皮靴短褂，肩上斜背短镐，出手快得像一阵穿巷的风',
    colors: { primary: '#46c8d8', secondary: '#1f4e5f', skin: '#d8a377' },
    ending: '青锋跑到矿道尽头，回头看了一眼，没有停。他觉得只要跑得够快，黑夜就追不上他。',
    stats: { health: 980, walkF: 3.4, walkB: 2.6, jumpV: 9.2, jumpH: 3.6, stunMax: 70, throwRange: 38 },
    normals: { damageMul: 1.0, startupAll: -1 },
    throw: { name: '立吊摔', damage: 105, stun: 8 },
    specials: [
      { id: 'shanfengt', name: '闪风突', input: '63214P', desc: '后下前下前快拳，高速突进',
        startup: 6, active: 8, recovery: 14, damage: 88, chip: 8, stun: 9, hitstun: 26, blockstun: 11,
        hitbox: { x: -14, y: 40, w: 52, h: 18 }, move: { vx: 3.4, frames: 12, at: 6 }, anim: 'rush' },
      { id: 'feihua', name: '飞花', input: '425K', desc: '下后上跃起回旋踢',
        startup: 7, active: 8, recovery: 16, damage: 80, chip: 9, stun: 10, hitstun: 17, blockstun: 12,
        hitbox: { x: -12, y: 30, w: 54, h: 22 }, move: { vx: 2.4, vy: 3.0, at: 6 }, anim: 'highkick' },
      { id: 'jifengdan', name: '疾风弹', input: '236P', desc: '短程快弹，飞行道具，存在时间短',
        startup: 9, active: 1, recovery: 22, damage: 55, chip: 8, stun: 8, hitstun: 14, blockstun: 11,
        projectile: { speed: 5.5, x: 28, y: 56, w: 22, h: 14, life: 110 }, anim: 'fireball' },
    ],
    supers: [
      { id: 'jifenglong', name: '疾风龙', input: '6321463214P', desc: '化风连续突刺，高速贯穿',
        startup: 5, active: 26, recovery: 26, damage: 310, chip: 40, stun: 0, hitstun: 28, blockstun: 20,
        knockdown: true, invuln: [1, 8], hitbox: { x: -18, y: 20, w: 78, h: 56 },
        move: { vx: 4.0, frames: 20, at: 5 }, anim: 'super', sdm: { damage: 450 } },
    ],
  },
  {
    id: 'c07', name: '铜首', title: '顶梁大汉', archetype: 'power',
    stage: 's04',
    style: '顶梁工大汉，铜色工装，手臂粗得像支柱，眼皮很少抬，一拳下去地面掉煤渣',
    colors: { primary: '#722f37', secondary: '#caa06a', skin: '#a9765a' },
    ending: '支柱立住了，铜首弯下腰。他顶过一万根柱子，第一次，顶住的是自己的心。',
    stats: { health: 1080, walkF: 1.6, walkB: 1.4, jumpV: 6.8, jumpH: 2.4, stunMax: 120, throwRange: 50 },
    normals: { damageMulIds: ['st.mp', 'st.hp', 'st.hk', 'cr.hp', 'cr.mk', 'cr.hk'], damageMulIdsVal: 1.05, startupDelta: { 'st.lp': 1, 'st.lk': 1 } },
    throw: { name: '石投', damage: 140, stun: 12 },
    specials: [
      { id: 'chongtiant', name: '冲天突', input: '623P', desc: '升龙式重拳，起手无敌，击飞',
        startup: 8, active: 12, recovery: 28, damage: 150, chip: 15, stun: 18, hitstun: 26, blockstun: 18,
        knockdown: true, invuln: [1, 8], hitbox: { x: 2, y: 40, w: 40, h: 68 }, move: { vy: 6.5, vx: 1.0, at: 5 }, anim: 'uppercut' },
      { id: 'zhongdanluo', name: '重弹落', input: '425P', desc: '下后上砸落拳，下段击倒',
        startup: 14, active: 10, recovery: 30, damage: 140, chip: 20, stun: 18, hitstun: 20, blockstun: 18,
        level: 'low', knockdown: true, hitbox: { x: -8, y: 0, w: 60, h: 64 }, anim: 'heavy' },
      { id: 'zhongkeng', name: '重坑踹', input: '624K', desc: '下后下踹翻，击倒',
        startup: 12, active: 6, recovery: 32, damage: 130, chip: 18, stun: 16, hitstun: 22, blockstun: 16,
        knockdown: true, hitbox: { x: 4, y: 10, w: 56, h: 30 }, anim: 'highkick' },
    ],
    supers: [
      { id: 'tongshoulong', name: '铜首龙', input: '623623P', desc: '顶梁之拳，重压突进',
        startup: 12, active: 28, recovery: 38, damage: 320, chip: 50, stun: 0, hitstun: 30, blockstun: 24,
        knockdown: true, invuln: [1, 14], hitbox: { x: 0, y: 10, w: 76, h: 72 },
        move: { vx: 3.0, frames: 22, at: 12 }, anim: 'super', sdm: { damage: 500, invuln: [1, 20] } },
    ],
  },
  {
    id: 'c08', name: '灰雁', title: '赶路人', archetype: 'balanced',
    stage: 's05',
    style: '灰袍赶路人，背灯拄木杖，脚程不快不慢，像矿道尽头永远飞不走的那只灰雁',
    colors: { primary: '#7b5ea7', secondary: '#cfc4e0', skin: '#d3a982' },
    ending: '雁群往南飞，灰雁跟着飞。路还很长，但他不再一个人走，灯就够亮了。',
    stats: { health: 1000, walkF: 2.3, walkB: 1.9, jumpV: 8.2, jumpH: 3.0, stunMax: 100, throwRange: 44 },
    normals: {},
    throw: { name: '两手提摔', damage: 120, stun: 10 },
    specials: [
      { id: 'huiyan', name: '灰炎弹', input: '236P', desc: '杖尖灯焰弹，飞行道具',
        startup: 14, active: 1, recovery: 32, damage: 48, chip: 8, stun: 8, hitstun: 15, blockstun: 12,
        projectile: { speed: 2.8, x: 32, y: 56, w: 24, h: 16, life: 130 }, anim: 'fireball' },
      { id: 'huihe', name: '灰鹤蹴', input: '425K', desc: '下后上跃起回旋踢',
        startup: 10, active: 8, recovery: 22, damage: 55, chip: 10, stun: 11, hitstun: 18, blockstun: 13,
        knockdown: true, hitbox: { x: -10, y: 30, w: 56, h: 24 }, move: { vx: 2.2, vy: 2.6, at: 7 }, anim: 'highkick' },
      { id: 'huayan', name: '华炎蹴', input: '623K', desc: '上挑旋踢，对空',
        startup: 9, active: 8, recovery: 30, damage: 95, chip: 10, stun: 12, hitstun: 20, blockstun: 14,
        knockdown: true, hitbox: { x: 2, y: 40, w: 36, h: 66 }, move: { vy: 6.0, vx: 0.8, at: 4 }, anim: 'uppercut' },
    ],
    supers: [
      { id: 'huiyanlong', name: '灰雁龙', input: '214236P', desc: '杖挥灰焰龙卷，中距离贯穿',
        startup: 14, active: 10, recovery: 40, damage: 200, chip: 32, stun: 0, hitstun: 26, blockstun: 20,
        knockdown: true, invuln: [1, 6], hitbox: { x: 6, y: 20, w: 68, h: 64 },
        move: { vx: 2.4, frames: 12, at: 10 }, anim: 'super', sdm: { damage: 340 } },
    ],
  },
];

// ---------- 输出 ----------
for (const c of CHARS) {
  const out = {
    id: c.id, name: c.name, title: c.title, style: c.style, archetype: c.archetype,
    stage: c.stage,
    colors: c.colors, ending: c.ending, stats: c.stats,
    normals: makeNormals(c.normals ?? {}),
    throw: c.throw,
    specials: c.specials,
    supers: c.supers,
  };
  const header = `// ${c.name}「${c.title}」— ${c.archetype}（R1 原创角色）\n// 由 scripts/gen-characters.mjs 生成；数据格式见 docs/角色数据格式.md\n`;
  const body = header + 'export default ' + JSON.stringify(out, null, 2) + ';\n';
  const path = join(OUT, `${c.id}.js`);
  writeFileSync(path, body);
  console.log(`✅ ${c.id} ${c.name} (${c.archetype}) → ${path}`);
}
console.log('完成。跑 npm run check -- --upto R1 验证。');
