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
