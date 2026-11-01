// 主题包：煤龙拳。换主题 = 新建一个同结构的目录，并在 src/theme/index.js 里切换。
import { ROSTER } from './characters/index.js';
import { STAGES } from './stages.js';

export default {
  id: 'meilong',
  title: '煤龙拳',
  subtitle: 'COAL DRAGON FIST',
  roster: ROSTER,
  stages: STAGES,
  palette: { ui: '#f2c14e', uiDark: '#1a1410', accent: '#c8452c' },
  audio: {
    title: 'assets/meilong/audio/title.ogg',
    sfx: {
      hit: 'assets/meilong/audio/sfx_hit.ogg',
      block: 'assets/meilong/audio/sfx_block.ogg',
      throw: 'assets/meilong/audio/sfx_throw.ogg',
      projectile: 'assets/meilong/audio/sfx_projectile.ogg',
      super: 'assets/meilong/audio/sfx_super.ogg',
      ko: 'assets/meilong/audio/sfx_ko.ogg',
      round: 'assets/meilong/audio/sfx_round.ogg',
      knockdown: 'assets/meilong/audio/sfx_knockdown.ogg',
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
