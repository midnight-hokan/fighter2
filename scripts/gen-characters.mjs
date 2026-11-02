#!/usr/bin/env node
// 生成黑岭煤矿角色 c02–c08（c01 林啸为手写模板，不动）。
// 普通技以 c01 为基底做数值微调 + 按角色改名；必杀/超必杀/身份/故事为每角色独立设计。
// 身份与故事见 docs/故事设定.md；招式定名见 INBOX 19:45 表 + 19:58 霍兰修订（澡堂管理员）。
// 玩法/帧数据/数值一律沿用 R1 平衡终版，只换身份、名字与外观描述。
// 用法：node scripts/gen-characters.mjs  → 覆盖写 src/theme/meilong/characters/c0[2-8].js
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import base from '../src/theme/meilong/characters/c01.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'src', 'theme', 'meilong', 'characters');
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- 普通技微调 ----------
const GENERIC_NAMES = {
  'st.lp': '快拳', 'st.mp': '直拳', 'st.hp': '重拳', 'st.lk': '前踢', 'st.mk': '侧踹', 'st.hk': '旋踢',
  'cr.lp': '蹲快拳', 'cr.mp': '蹲直拳', 'cr.hp': '上勾拳', 'cr.lk': '低踢', 'cr.mk': '扫腿', 'cr.hk': '扫堂腿',
  'j.lp': '跳拳', 'j.mp': '跳直拳', 'j.hp': '跳重拳', 'j.lk': '跳膝', 'j.mk': '跳踢', 'j.hk': '跳旋踢',
};
function makeNormals(cfg) {
  const n = clone(base.normals);
  const ids = Object.keys(n);
  for (const id of ids) {
    const m = n[id];
    let startup = m.startup + (cfg.startupDelta?.[id] ?? cfg.startupAll ?? 0);
    startup = Math.max(2, startup);
    m.startup = startup;
    if (cfg.recoveryDelta?.[id] != null) m.recovery = Math.max(0, m.recovery + cfg.recoveryDelta[id]);
    else if (cfg.recoveryAll) m.recovery = Math.max(0, m.recovery + cfg.recoveryAll);
    if (cfg.activeAll) m.active = Math.max(1, m.active + cfg.activeAll);
    if (cfg.damageMul) m.damage = Math.round(m.damage * cfg.damageMul);
    if (cfg.damageMulIds && cfg.damageMulIds.includes(id)) m.damage = Math.round(m.damage * (cfg.damageMulIdsVal ?? 1.1));
    if (cfg.hitbox) {
      if (cfg.hitbox.reachAdd) m.hitbox.w = Math.round((m.hitbox.w + cfg.hitbox.reachAdd) * 10) / 10;
      if (cfg.hitbox.hMul) m.hitbox.h = Math.round(m.hitbox.h * cfg.hitbox.hMul);
      if (cfg.hitbox.xAdd) m.hitbox.x = m.hitbox.x + cfg.hitbox.xAdd;
    }
    m.name = cfg.names?.[id] ?? GENERIC_NAMES[id] ?? m.name;
  }
  return n;
}

// ---------- 角色定义 ----------
const CHARS = [
  {
    id: 'c02', name: '罗铮', title: '矿山救护队员', archetype: 'charge',
    stage: 's01',
    style: '三十五岁救护中队老队员，橙红色救护服，背正压氧气呼吸器，面罩推在额头上，腰挂救援钩和绳索，体格敦实',
    colors: { primary: '#e05a2b', secondary: '#f0ead6', skin: '#c9986a' },
    intro: '我的本事是从险区里带人出来，不是在擂台上表演。不过，今天破个例。',
    story: '传言改造后井下人少了，救护队要缩编。他不服："人少了，救援就不要了？"他要用擂台证明，救护队的本事一样也不能丢。',
    ending: '智能化之后，救护队不但没缩编，还配上了无人机和井下机器人，罗铮成了第一任技术教官。他第一堂课对新队员说："机器能进去，人也得能进去。"',
    stats: { health: 1050, walkF: 2.0, walkB: 1.8, jumpV: 7.6, jumpH: 2.6, stunMax: 110, throwRange: 40 },
    normals: { damageMul: 1.04, startupAll: 1, recoveryAll: 2, hitbox: { reachAdd: 4 }, names: { 'st.hp': '救护重拳', 'st.hk': '钩踢', 'cr.hk': '钩扫腿' } },
    throw: { name: '担架摔', damage: 130, stun: 10 },
    specials: [
      { id: 'baokong', name: '抛救生绳', input: '[4]6P', desc: '后蓄力前放，抛出救生绳（飞行道具）',
        startup: 14, active: 1, recovery: 34, damage: 80, chip: 15, stun: 10, hitstun: 18, blockstun: 14,
        projectile: { speed: 3.0, x: 30, y: 56, w: 30, h: 20, life: 240 }, anim: 'fireball' },
      { id: 'tanshui', name: '照明信号弹', input: '[4]6K', desc: '后蓄力前放，贴地飞出的照明信号弹，下段',
        startup: 18, active: 1, recovery: 40, damage: 110, chip: 20, stun: 12, hitstun: 20, blockstun: 16,
        level: 'low', projectile: { speed: 2.2, x: 26, y: 8, w: 40, h: 14, life: 260 }, anim: 'fireball' },
      { id: 'chongtianshan', name: '救援钩上挑', input: '[2]8K', desc: '下蓄力上放，救援钩对空上挑，起手无敌',
        startup: 6, active: 10, recovery: 26, damage: 105, chip: 12, stun: 16, hitstun: 20, blockstun: 16,
        knockdown: true, invuln: [1, 10], hitbox: { x: 2, y: 40, w: 36, h: 68 }, anim: 'uppercut' },
    ],
    supers: [
      { id: 'longxuantan', name: '生命通道', input: '236236P', desc: '展开生命通道，冲拳钻地突进',
        startup: 8, active: 26, recovery: 32, damage: 280, chip: 45, stun: 0, hitstun: 30, blockstun: 22,
        knockdown: true, invuln: [1, 14], hitbox: { x: 8, y: 20, w: 72, h: 70 },
        move: { vx: 3.6, frames: 20, at: 8 }, anim: 'super', sdm: { damage: 480, invuln: [1, 22] } },
    ],
  },
  {
    id: 'c03', name: '雷钧', title: '机电队长', archetype: 'grappler',
    stage: 's06',
    style: '四十二岁全矿最魁梧的人，络腮胡，厚实工装领口立起，肩上缠一圈电缆，腰挂大扳手，手上绝缘手套',
    colors: { primary: '#4a4f57', secondary: '#c98a3d', skin: '#b98a5e' },
    intro: '来，让我看看你的接线牢不牢。',
    story: '智能化改造要换掉他亲手维护了二十年的老设备。他心里想要的是：改造的设备，得由他的人来管。',
    ending: '新设备进矿那天，厂家工程师来培训，讲到一半，雷钧举手指出了说明书上的两处错误。三个月后，他成了矿上智能装备维护中心的主任。',
    stats: { health: 1150, walkF: 1.8, walkB: 1.6, jumpV: 7.0, jumpH: 2.2, stunMax: 130, throwRange: 58 },
    normals: { damageMul: 1.02, startupAll: 1, startupDelta: { 'st.mp': 1, 'st.hp': 1, 'st.mk': 1, 'st.hk': 1, 'cr.hp': 1, 'cr.hk': 1 }, recoveryAll: 3, hitbox: { reachAdd: 4 }, names: { 'st.hp': '扳手重击', 'st.hk': '缆线旋踢', 'cr.hp': '扳手勾拳', 'cr.hk': '电缆扫堂' } },
    throw: { name: '电缆抱摔', damage: 150, stun: 12 },
    specials: [
      { id: 'zhongdan', name: '电缆缠摔', input: '360P', desc: '一圈指令投，电缆缠抱摔砸地',
        startup: 8, active: 2, recovery: 30, damage: 160, stun: 12, throw: true, range: 56, anim: 'throw' },
      { id: 'suiluo', name: '扳手砸', input: '421P', desc: '后下下后大扳手下砸，下段击倒',
        startup: 10, active: 8, recovery: 26, damage: 110, chip: 14, stun: 14, hitstun: 20, blockstun: 14,
        level: 'low', knockdown: true, hitbox: { x: -6, y: 0, w: 56, h: 60 }, anim: 'heavy' },
      { id: 'kengtai', name: '绝缘靴踹', input: '214K', desc: '扫堂腿，下段击倒',
        startup: 8, active: 6, recovery: 22, damage: 90, chip: 10, stun: 10, hitstun: 16, blockstun: 12,
        level: 'low', knockdown: true, hitbox: { x: 0, y: 0, w: 62, h: 16 }, anim: 'sweep' },
    ],
    supers: [
      { id: 'chaozhong', name: '高压送电', input: '236236K', desc: '扛起对手整圈砸地，下段',
        startup: 10, active: 22, recovery: 36, damage: 350, chip: 48, stun: 0, hitstun: 30, blockstun: 24,
        level: 'low', knockdown: true, invuln: [1, 8], hitbox: { x: -10, y: 0, w: 80, h: 80 },
        move: { vx: 2.6, frames: 18, at: 10 }, anim: 'super', sdm: { damage: 480 } },
    ],
  },
  {
    id: 'c04', name: '严正', title: '安监科主任', archetype: 'rushdown',
    stage: 's02',
    style: '四十八岁精干中年，白色安全帽，卡其色工装外套内穿亮黄色"安全监察"反光背心，左臂"安全监察"袖标，手持瓦斯检测仪，胸袋永远插着罚单本',
    colors: { primary: '#f0c020', secondary: '#9c8f6b', skin: '#e6b98d' },
    intro: '你这个站位，已经构成违章了。',
    story: '恢复擂台的消息一出，他第一个跳出来反对。反对无效，他干脆报名："那我就进去盯着，谁敢违章，我当场叫停。"',
    ending: '严正捧着头灯，在全矿大会上第一次讲了自己被困的那十一个小时。最后他说："以后井下的人少了，这是我干安监这么多年，最想看到的事。"台下安静了很久，然后掌声响了起来。',
    stats: { health: 1080, walkF: 2.8, walkB: 2.2, jumpV: 8.8, jumpH: 3.4, stunMax: 95, throwRange: 42 },
    normals: { damageMul: 0.94, startupAll: -1, recoveryAll: -2, startupDelta: { 'st.lp': -1, 'st.lk': -1, 'cr.lp': -1, 'cr.lk': -1 }, names: { 'st.hp': '检测重击', 'st.hk': '监察旋踢', 'cr.hk': '罚单扫堂' } },
    throw: { name: '按倒摔', damage: 130, stun: 10 },
    specials: [
      { id: 'denghua', name: '隐患排查', input: '214P', desc: '下前滑步踢，突进压制',
        startup: 8, active: 10, recovery: 18, damage: 105, chip: 12, stun: 10, hitstun: 20, blockstun: 12,
        hitbox: { x: -16, y: 30, w: 60, h: 20 }, move: { vx: 2.8, frames: 14, at: 8 }, anim: 'kick' },
      { id: 'shanguang', name: '当场整改', input: '41236P', desc: '下后下前跃起旋踢，起手无敌，对空',
        startup: 9, active: 12, recovery: 22, damage: 110, chip: 12, stun: 12, hitstun: 18, blockstun: 14,
        knockdown: true, invuln: [1, 6], hitbox: { x: -12, y: 40, w: 56, h: 30 }, move: { vx: 2.2, vy: 4.5, at: 6 }, anim: 'spin' },
      { id: 'jifenghua', name: '停产整顿', input: '236K', desc: '前冲扫踢，快速接压',
        startup: 10, active: 14, recovery: 16, damage: 90, chip: 10, stun: 8, hitstun: 14, blockstun: 10,
        hitbox: { x: -14, y: 34, w: 54, h: 20 }, move: { vx: 3.2, frames: 16, at: 10 }, anim: 'rush' },
    ],
    supers: [
      { id: 'huaying', name: '一票否决', input: '214214P', desc: '罚单翻飞，连续突刺',
        startup: 6, active: 24, recovery: 28, damage: 330, chip: 42, stun: 0, hitstun: 28, blockstun: 20,
        knockdown: true, invuln: [1, 10], hitbox: { x: -16, y: 20, w: 76, h: 60 },
        move: { vx: 3.4, frames: 18, at: 6 }, anim: 'super', sdm: { damage: 470 } },
    ],
  },
  {
    id: 'c05', name: '苏红', title: '宣传科主任', archetype: 'zoner',
    stage: 's03',
    style: '三十四岁干练短发女性，红色短夹克配深色长裤，红袖章，一手铁皮大喇叭，背上斜插一卷红色横幅',
    colors: { primary: '#c0392b', secondary: '#3f4557', skin: '#d9a878' },
    intro: '这一场，我要上头版。',
    story: '她负责六十周年的庆典宣传，本来只是来报道擂台的。结果写稿写到一半发现：黑岭六十年的故事里，几乎没有女人的名字。她把稿子一扔，自己报了名。',
    ending: '苏红赢下擂台，主持了黑岭六十周年的庆典。她在矿史馆里加了一面新墙，上面写满了黑岭六十年来所有女工、女技术员、女干部的名字。第一个名字是澡堂的霍兰，第二个是她自己。',
    stats: { health: 1050, walkF: 2.0, walkB: 2.0, jumpV: 7.4, jumpH: 2.8, stunMax: 90, throwRange: 36 },
    normals: { startupAll: 1, hitbox: { reachAdd: 6 }, names: { 'st.hp': '挥臂重拳', 'cr.hk': '横幅扫腿' } },
    throw: { name: '横幅摔', damage: 110, stun: 8 },
    specials: [
      { id: 'denghuadan', name: '喇叭声波', input: '236K', desc: '大喇叭声波，飞行道具，速度快',
        startup: 12, active: 1, recovery: 28, damage: 65, chip: 12, stun: 10, hitstun: 18, blockstun: 14,
        projectile: { speed: 4.2, x: 30, y: 54, w: 24, h: 16, life: 200 }, anim: 'fireball' },
      { id: 'daiteng', name: '标语封顶', input: '623K', desc: '高抛标语横幅，飞行道具，命中击退大',
        startup: 18, active: 1, recovery: 38, damage: 140, chip: 22, stun: 14, hitstun: 22, blockstun: 16,
        pushback: 18, projectile: { speed: 2.6, x: 30, y: 20, w: 34, h: 22, life: 240 }, anim: 'fireball' },
      { id: 'dengzhuo', name: '横幅横扫', input: '214P', desc: '近身快速横扫，可取消',
        startup: 6, active: 3, recovery: 14, damage: 55, chip: 10, stun: 6, hitstun: 12, blockstun: 10,
        cancel: true, hitbox: { x: 10, y: 50, w: 44, h: 16 }, anim: 'punch' },
    ],
    supers: [
      { id: 'denghuadrag', name: '全矿广播', input: '236236K', desc: '全矿广播，挥出巨型声波弹，飞行道具',
        startup: 14, active: 1, recovery: 40, damage: 330, chip: 52, stun: 0, hitstun: 30, blockstun: 22,
        knockdown: true, projectile: { speed: 2.8, x: 36, y: 30, w: 44, h: 30, life: 300 },
        anim: 'super', sdm: { damage: 510, projectile: { speed: 3.4, x: 36, y: 30, w: 50, h: 34, life: 320 } } },
    ],
  },
  {
    id: 'c06', name: '方萤', title: '矿灯房女工', archetype: 'speed',
    stage: 's01',
    style: '二十一岁娇小身形，灯房蓝色工作服系浅色围裙，两手各拎一盏矿灯，口袋插充电线',
    colors: { primary: '#3d8bb5', secondary: '#f0ead6', skin: '#d8a377' },
    intro: '你的灯，是我充的电。',
    story: '她听说头灯里面装的，是黑岭第一盏灯的原装灯头。她从十五岁起就想亲手修一修那盏灯，让它再亮一次。',
    ending: '方萤捧着头灯回到灯房，用了一整夜把它修好了。六十周年庆典上，头灯在矿史馆里重新亮起来。后来智能矿灯进矿，她成了矿上第一个"智能矿灯管理员"，徽章上的编号是 001。',
    stats: { health: 980, walkF: 3.4, walkB: 2.6, jumpV: 9.2, jumpH: 3.6, stunMax: 70, throwRange: 38 },
    normals: { damageMul: 0.88, startupAll: -1, recoveryAll: -3 },
    throw: { name: '灯绳摔', damage: 105, stun: 8 },
    specials: [
      { id: 'shanfengt', name: '充电冲刺', input: '63214P', desc: '后下前下前快拳，高速突进',
        startup: 6, active: 8, recovery: 14, damage: 88, chip: 8, stun: 9, hitstun: 26, blockstun: 11,
        hitbox: { x: -14, y: 40, w: 52, h: 18 }, move: { vx: 3.4, frames: 12, at: 6 }, anim: 'rush' },
      { id: 'feihua', name: '灯链旋', input: '41236K', desc: '下后下前跃起回旋踢',
        startup: 7, active: 8, recovery: 16, damage: 80, chip: 9, stun: 10, hitstun: 17, blockstun: 12,
        hitbox: { x: -12, y: 30, w: 54, h: 22 }, move: { vx: 2.4, vy: 3.0, at: 6 }, anim: 'highkick' },
      { id: 'jifengdan', name: '双灯连闪', input: '236P', desc: '短程快弹，飞行道具，存在时间短',
        startup: 9, active: 1, recovery: 22, damage: 55, chip: 8, stun: 8, hitstun: 14, blockstun: 11,
        projectile: { speed: 5.5, x: 28, y: 56, w: 22, h: 14, life: 110 }, anim: 'fireball' },
    ],
    supers: [
      { id: 'jifenglong', name: '万灯齐明', input: '236236P', desc: '双灯满电，化风连续突刺，高速贯穿',
        startup: 5, active: 26, recovery: 26, damage: 310, chip: 40, stun: 0, hitstun: 28, blockstun: 20,
        knockdown: true, invuln: [1, 8], hitbox: { x: -18, y: 20, w: 78, h: 56 },
        move: { vx: 4.0, frames: 20, at: 5 }, anim: 'super', sdm: { damage: 450 } },
    ],
  },
  {
    id: 'c07', name: '霍兰', title: '澡堂管理员', archetype: 'power',
    stage: 's04',
    style: '四十六岁高壮结实的中年女性，白色工装上衣外罩深绿色防水胶围裙，脚穿高筒胶靴，肩搭白毛巾，腰挂一大串更衣柜钥匙，手持长柄大拖把',
    colors: { primary: '#356e46', secondary: '#e8ebe0', skin: '#a9765a' },
    intro: '洗干净了没？没洗干净的，别想上我的擂台。',
    story: '二十多年前最后一届擂台，她是唯一打进决赛的女人，在最后一场输给了林啸的父亲。她不是想报仇，就是一直想知道："如果那天我没输，会怎么样？"',
    ending: '霍兰捧着头灯，去林啸家敲了门。林啸的父亲开门，两人对视了很久，一起笑了出来。那天夜里，澡堂破例开到天亮，热水管够，全矿的人都来了。',
    stats: { health: 1080, walkF: 1.6, walkB: 1.4, jumpV: 6.8, jumpH: 2.4, stunMax: 120, throwRange: 50 },
    normals: { damageMul: 1.06, startupAll: 1, startupDelta: { 'st.mp': 1, 'st.hp': 1, 'st.mk': 1, 'st.hk': 1, 'cr.hp': 1, 'cr.hk': 1 }, recoveryAll: 3, hitbox: { reachAdd: 4 } },
    throw: { name: '拖把摔', damage: 140, stun: 12 },
    specials: [
      { id: 'chongtiant', name: '蒸汽冲天', input: '623P', desc: '长柄大拖把对空抡扫，起手无敌，击飞',
        startup: 8, active: 12, recovery: 28, damage: 150, chip: 15, stun: 18, hitstun: 26, blockstun: 18,
        knockdown: true, invuln: [1, 8], hitbox: { x: 2, y: 40, w: 40, h: 68 }, move: { vy: 6.5, vx: 1.0, at: 5 }, anim: 'uppercut' },
      { id: 'zhongdanluo', name: '木盆扣顶', input: '421P', desc: '后下下后木盆大扣，下段击倒',
        startup: 14, active: 10, recovery: 30, damage: 140, chip: 20, stun: 18, hitstun: 20, blockstun: 18,
        level: 'low', knockdown: true, hitbox: { x: -8, y: 0, w: 60, h: 64 }, anim: 'heavy' },
      { id: 'zhongkeng', name: '拖把横扫', input: '214K', desc: '下后下长柄拖把横扫踹翻，击倒',
        startup: 12, active: 6, recovery: 32, damage: 130, chip: 18, stun: 16, hitstun: 22, blockstun: 16,
        knockdown: true, hitbox: { x: 4, y: 10, w: 56, h: 30 }, anim: 'highkick' },
    ],
    supers: [
      { id: 'tongshoulong', name: '开闸放水', input: '214214P', desc: '高压水管连环冲击，重压突进',
        startup: 12, active: 28, recovery: 38, damage: 320, chip: 50, stun: 0, hitstun: 30, blockstun: 24,
        knockdown: true, invuln: [1, 14], hitbox: { x: 0, y: 10, w: 76, h: 72 },
        move: { vx: 3.0, frames: 22, at: 12 }, anim: 'super', sdm: { damage: 500, invuln: [1, 20] } },
    ],
  },
  {
    id: 'c08', name: '沈清', title: '矿医院医生', archetype: 'balanced',
    stage: 's05',
    style: '三十五岁清瘦冷静，白大褂外套工作马甲，戴安全帽，听诊器挂脖子，腰挂红十字急救包，袖口别一排银针',
    colors: { primary: '#c9cdd4', secondary: '#cc3344', skin: '#d3a982' },
    intro: '放松。只是例行检查。',
    story: '她不想参赛，是被矿长"请"来把守最后一关的。不过她心里清楚：擂台上每一个人的身体，她都要亲眼看着。',
    ending: '沈清赢了所有人，把头灯放回矿史馆，然后在擂台记录本上写下了每个人的体检意见：罗铮的腰、雷钧的血压、严正的旧伤、霍兰的膝盖……最后一行写着："全员合格。下次比武，请提前预约体检。"',
    stats: { health: 1000, walkF: 2.3, walkB: 1.9, jumpV: 8.2, jumpH: 3.0, stunMax: 100, throwRange: 44 },
    normals: {},
    throw: { name: '按压摔', damage: 120, stun: 10 },
    specials: [
      { id: 'huiyan', name: '银针连射', input: '236P', desc: '袖口银针连射，飞行道具',
        startup: 14, active: 1, recovery: 32, damage: 48, chip: 8, stun: 8, hitstun: 15, blockstun: 12,
        projectile: { speed: 2.8, x: 32, y: 56, w: 24, h: 16, life: 130 }, anim: 'fireball' },
      { id: 'huihe', name: '急救突进', input: '214K', desc: '下后下跃起回旋踢，跃起突进',
        startup: 10, active: 8, recovery: 22, damage: 55, chip: 10, stun: 11, hitstun: 18, blockstun: 13,
        knockdown: true, hitbox: { x: -10, y: 30, w: 56, h: 24 }, move: { vx: 2.2, vy: 2.6, at: 7 }, anim: 'highkick' },
      { id: 'huayan', name: '点穴上挑', input: '623K', desc: '点穴手法上挑旋踢，对空',
        startup: 9, active: 8, recovery: 30, damage: 95, chip: 10, stun: 12, hitstun: 20, blockstun: 14,
        knockdown: true, hitbox: { x: 2, y: 40, w: 36, h: 66 }, move: { vy: 6.0, vx: 0.8, at: 4 }, anim: 'uppercut' },
    ],
    supers: [
      { id: 'huiyanlong', name: '妙手回春', input: '214214P', desc: '银针龙卷，中距离贯穿',
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
    colors: c.colors, intro: c.intro, story: c.story, ending: c.ending, stats: c.stats,
    normals: makeNormals(c.normals ?? {}),
    throw: c.throw,
    specials: c.specials,
    supers: c.supers,
  };
  const header = `// ${c.name}「${c.title}」— ${c.archetype}（黑岭煤矿角色）\n// 由 scripts/gen-characters.mjs 生成；数据格式见 docs/角色数据格式.md；身份与故事见 docs/故事设定.md\n`;
  const body = header + 'export default ' + JSON.stringify(out, null, 2) + ';\n';
  const path = join(OUT, `${c.id}.js`);
  writeFileSync(path, body);
  console.log(`✅ ${c.id} ${c.name} (${c.archetype}) → ${path}`);
}
console.log('完成。跑 npm run check -- --upto R1 验证。');
