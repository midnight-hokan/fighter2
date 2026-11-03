// v2 动画清单冻结表（2026-11-04）。来源：docs/角色设计表.md + docs/对标设计.md 第 10 节修正。
// 用途：export-poses 按这里导出骨架，大炮按骨架生成动画；引擎实现这些招式时用同样的 id。
// 引擎还没实现的招式，图集里先有动画也不影响游戏（atlas 找不到对应招式就不会播）。
//
// moves：新增招式（id、名称、指令、骨架模板 anim、帧数 startup/active/recovery）
//   guard: 'cr' | 'j' 起手架势（默认站姿）；twoHand: 双手持器械
// overrides：已有招式改骨架模板（设计变了，动作也要跟着变）

// 每人都有的新状态动画
export const V2_STATES = {
  intro: [12, 10, false],  // 开场：帧数、fps、循环
  win2: [8, 8, true],      // 第二个胜利姿势
  taunt: [8, 10, false],   // 挑衅
};

// 拳皇式派生普通技：以前借用站立版动画，现在单独画
export const KOF_NORMALS = {
  'cl.hp': { from: 'st.hp', anim: 'heavy', dStartup: -3, dRecovery: -4 },   // 近身 C：短促肘击/勾拳
  'cl.hk': { from: 'st.hk', anim: 'kick', dStartup: -3, dRecovery: -4 },    // 近身 D：膝撞/短踢
  cd: { from: 'st.hk', anim: 'highkick', startup: 10, active: 4, recovery: 20 }, // 吹飞攻击
  'j.cd': { from: 'j.hk', anim: 'highkick', startup: 7, active: 6, recovery: 10, guard: 'j' },
};

const m = (id, name, input, anim, startup, active, recovery, extra = {}) => ({ id, name, input, anim, startup, active, recovery, ...extra });

export const V2_MOVES = {
  c01: [
    m('jiegeshangtiao', '截割上挑', '3C', 'upper', 6, 6, 20),
    m('meihuozhang', '煤火掌', '41236P', 'heavy', 10, 5, 22, { twoHand: true }),
    m('dihuopenyong', '地火喷涌', '214214P', 'stomp', 12, 20, 30),
    m('meilongquan', '煤龙拳', '2363214C', 'uppercut', 10, 40, 40),
  ],
  c02: [
    m('yangqipingzhuang', '氧气瓶撞', '6C', 'rush', 12, 4, 20),
    m('gousuolazhuai', '钩索拉拽', '[2]8P', 'pull', 14, 6, 30),
    m('yangqibaopen', '氧气爆喷', '[4]646K', 'heavy', 8, 10, 34, { twoHand: true }),
    m('juejingjiuyuan', '绝境救援', '[2]828C', 'pull', 10, 50, 40),
  ],
  c03: [
    m('banshouza6c', '扳手敲', '6C', 'overhead', 16, 4, 24),
    m('gaoyadianzhu', '高压电柱', '623P', 'uppercut', 5, 10, 30),
    m('loudianqu', '漏电区', '236236K', 'stomp', 14, 4, 40),
    m('quankuangtingdian', '全矿停电', '720C', 'throw', 2, 60, 30),
  ],
  c04: [
    m('huabuditi', '滑步低踢', '3B', 'lowkick', 5, 3, 12, { guard: 'cr' }),
    m('kaifadan', '开罚单', '214K', 'punch', 6, 3, 14),
    m('quanmiantingchan', '全面停产', '236236K', 'spin', 8, 30, 30),
    m('anquandajiancha', '安全大检查', '2363214D', 'rush', 8, 50, 40),
  ],
  c05: [
    m('hengfuchou', '横幅抽', '6C', 'heavy', 12, 4, 24, { twoHand: true }),
    m('guangbohuiyin', '广播回音', '22P', 'fireball', 14, 2, 26),
    m('biaoyuqiang', '标语墙', '214214P', 'stomp', 12, 10, 30),
    m('zhenerlong', '震耳欲聋', '2363214B', 'super', 14, 30, 40),
  ],
  c06: [
    m('dikonghuachan', '低空滑铲', '3B', 'sweep', 6, 8, 18, { guard: 'cr' }),
    m('denglianxiaza', '灯链下砸', 'j.214K', 'overhead', 6, 6, 12, { guard: 'j' }),
    m('liuguanglianwu', '流光链舞', '214214K', 'spin', 6, 36, 26),
    m('qiandengzhaojing', '千灯照井', '2363214A', 'rush', 6, 50, 36),
  ],
  c07: [
    m('tuobasaodi', '拖把扫地', '3D', 'sweep', 12, 6, 26, { guard: 'cr', twoHand: true }),
    m('xuanfengtuoba', '旋风拖把', 'P 连打', 'spin', 8, 30, 24, { twoHand: true }),
    m('zhengqidasaochu', '蒸汽大扫除', '236236K', 'spin', 10, 40, 36, { twoHand: true }),
    m('reshuiguanbaolie', '热水管爆裂', '2363214C', 'super', 14, 40, 44, { twoHand: true }),
  ],
  c08: [
    m('dianxuezhi', '点穴指', '6A', 'punch', 9, 3, 16),
    m('zhenzhen', '针阵', '22P', 'stomp', 12, 4, 24, { guard: 'cr' }),
    m('fengxue', '封穴', '236236P', 'rush', 8, 20, 30),
    m('huihunjiuzhen', '回魂九针', '2363214A', 'super', 12, 40, 40),
  ],
};

export const V2_OVERRIDES = {
  c06: { jifengdan: { anim: 'heavy', twoHand: true } },          // 双灯连闪：飞行道具改为近身闪光打击
  c07: { tuobachongtui: { anim: 'heavy', twoHand: true } },      // 6C 拖把直戳（原 6D 拖把冲腿）
};

// 4 键之后不再使用的普通技（中拳中脚）：不画，打包时指向轻拳/轻脚的帧
export const UNUSED_NORMALS = { 'st.mp': 'st.lp', 'st.mk': 'st.lk', 'cr.mp': 'cr.lp', 'cr.mk': 'cr.lk', 'j.mp': 'j.lp', 'j.mk': 'j.lk' };
