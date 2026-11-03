// 主题包：煤龙拳。换主题 = 新建一个同结构的目录，并在 src/theme/index.js 里切换。
import { ROSTER } from './characters/index.js';
import { STAGES } from './stages.js';
import * as STORY from './story.js';

export default {
  id: 'meilong',
  title: '煤龙拳',
  subtitle: 'COAL DRAGON FIST',
  roster: ROSTER,
  stages: STAGES,
  story: STORY,
  // 街机最后一关（docs/故事设定.md）：固定沈清；玩家选沈清时最后一关为林啸
  finalBoss: { boss: 'c08', ifBoss: 'c01' },
  palette: { ui: '#f2c14e', uiDark: '#1a1410', accent: '#c8452c' },
  // 飞行道具外观：用角色随身物品。key = 角色id:招式id。fx 是渲染器内置的程序化画法；
  // sprite（可选，图片放好后再加，否则 404 会报错）：{ src, size（逻辑像素宽）, spin（旋转速度） }，有图片就优先用图片
  projectiles: {
    'c01:meiyan': { fx: 'helmet' },
    'c02:baokong': { fx: 'rope' },
    'c02:tanshui': { fx: 'flare' },
    'c05:denghuadan': { fx: 'sound' },
    'c05:daiteng': { fx: 'banner' },
    'c05:denghuadrag': { fx: 'megasound' },
    'c06:jifengdan': { fx: 'lamps' },
    'c08:huiyan': { fx: 'needles' },
  },
  audio: {
    title: 'assets/meilong/audio/title.ogg',
    sfx: {
      // 真实音效（AudioGen 生成，public/assets/meilong/sfx/）；加载失败时 audio.js 回退 WebAudio 合成音
      hit: 'assets/meilong/sfx/hit_med.ogg',
      hit_light: 'assets/meilong/sfx/hit_light.ogg',
      hit_med: 'assets/meilong/sfx/hit_med.ogg',
      hit_heavy: 'assets/meilong/sfx/hit_heavy.ogg',
      block: 'assets/meilong/sfx/block.ogg',
      throw: 'assets/meilong/sfx/throw.ogg',
      projectile: 'assets/meilong/sfx/projectile.ogg',
      super: 'assets/meilong/sfx/super.ogg',
      max: 'assets/meilong/sfx/max.ogg',
      stock: 'assets/meilong/sfx/stock.ogg',
      ko: 'assets/meilong/sfx/ko.ogg',
      round: 'assets/meilong/sfx/round.ogg',
      roll: 'assets/meilong/sfx/roll.ogg',
      gc: 'assets/meilong/sfx/gc.ogg',
      knockdown: 'assets/meilong/sfx/knockdown.ogg',
    },
    // 角色语音（CosyVoice2 零样本克隆，8 人音色各异；每人 4 句：intro 开场白 / special 必杀喊招 / super 超必杀喊招 / ko 被 KO 台词）
    voice: {
      c01: { intro: 'assets/meilong/voice/c01_intro.ogg', special: 'assets/meilong/voice/c01_special.ogg', super: 'assets/meilong/voice/c01_super.ogg', ko: 'assets/meilong/voice/c01_ko.ogg' },
      c02: { intro: 'assets/meilong/voice/c02_intro.ogg', special: 'assets/meilong/voice/c02_special.ogg', super: 'assets/meilong/voice/c02_super.ogg', ko: 'assets/meilong/voice/c02_ko.ogg' },
      c03: { intro: 'assets/meilong/voice/c03_intro.ogg', special: 'assets/meilong/voice/c03_special.ogg', super: 'assets/meilong/voice/c03_super.ogg', ko: 'assets/meilong/voice/c03_ko.ogg' },
      c04: { intro: 'assets/meilong/voice/c04_intro.ogg', special: 'assets/meilong/voice/c04_special.ogg', super: 'assets/meilong/voice/c04_super.ogg', ko: 'assets/meilong/voice/c04_ko.ogg' },
      c05: { intro: 'assets/meilong/voice/c05_intro.ogg', special: 'assets/meilong/voice/c05_special.ogg', super: 'assets/meilong/voice/c05_super.ogg', ko: 'assets/meilong/voice/c05_ko.ogg' },
      c06: { intro: 'assets/meilong/voice/c06_intro.ogg', special: 'assets/meilong/voice/c06_special.ogg', super: 'assets/meilong/voice/c06_super.ogg', ko: 'assets/meilong/voice/c06_ko.ogg' },
      c07: { intro: 'assets/meilong/voice/c07_intro.ogg', special: 'assets/meilong/voice/c07_special.ogg', super: 'assets/meilong/voice/c07_super.ogg', ko: 'assets/meilong/voice/c07_ko.ogg' },
      c08: { intro: 'assets/meilong/voice/c08_intro.ogg', special: 'assets/meilong/voice/c08_special.ogg', super: 'assets/meilong/voice/c08_super.ogg', ko: 'assets/meilong/voice/c08_ko.ogg' },
    },
  },
  text: {
    pressStart: '按 Enter 开始',
    select: '选择角色',
    fight: '开打！',
    round: (n) => `第 ${n} 回合`,
    ko: 'K.O.',
    timeUp: '时间到',
    draw: '平局',
    win: (name) => `${name} 胜`,
  },
};
