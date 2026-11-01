// 场景：图片条带（A2，scripts/art/gen_strips.py 生成，横向无缝平铺）+ 程序化图层。layers 从远到近，parallax 越小越远。
// R2：6 个场景，每个场景专属配色、层次和背景音乐 bgm。角色主场见各角色 stage 字段。
export const STAGES = [
  {
    id: 's01', name: '废弃矿井',
    sky: ['#120d0b', '#2b1d14'],
    floor: { color: '#4a3424', line: '#6b4c33' },
    layers: [
      { kind: 'image', src: 'assets/meilong/stages/s01/far.png', parallax: 0.2 },
      { kind: 'image', src: 'assets/meilong/stages/s01/near.png', parallax: 0.5 },
      { kind: 'lamps', color: '#f2c14e', parallax: 0.8, spacing: 120 },
    ],
    bgm: { file: 'assets/meilong/audio/s01.ogg', tempo: 132, key: 'A', scale: 'minor', seed: 1 },
  },
  {
    id: 's02', name: '灯廊夜市',
    sky: ['#2a1626', '#66303a'],
    floor: { color: '#5c3a24', line: '#7d5233' },
    layers: [
      { kind: 'image', src: 'assets/meilong/stages/s02/far.png', parallax: 0.3 },
      { kind: 'lamps', color: '#f2c14e', parallax: 0.6, spacing: 80 },
      { kind: 'image', src: 'assets/meilong/stages/s02/near.png', parallax: 0.9 },
    ],
    bgm: { file: 'assets/meilong/audio/s02.ogg', tempo: 118, key: 'E', scale: 'dorian', seed: 2 },
  },
  {
    id: 's03', name: '炭湖夜渡',
    sky: ['#0a1224', '#1e3350'],
    floor: { color: '#39434d', line: '#55606b' },
    layers: [
      { kind: 'stars', color: '#cfe0ff', parallax: 0.1, seed: 11 },
      { kind: 'image', src: 'assets/meilong/stages/s03/far.png', parallax: 0.2 },
      { kind: 'image', src: 'assets/meilong/stages/s03/near.png', parallax: 0.45 },
      { kind: 'lamps', color: '#f2c14e', parallax: 0.5, spacing: 150 },
    ],
    bgm: { file: 'assets/meilong/audio/s03.ogg', tempo: 96, key: 'C', scale: 'minor', seed: 3 },
  },
  {
    id: 's04', name: '高炉之巅',
    sky: ['#2a0e08', '#8a3414'],
    floor: { color: '#4d2c1e', line: '#6e4230' },
    layers: [
      { kind: 'image', src: 'assets/meilong/stages/s04/far.png', parallax: 0.25 },
      { kind: 'image', src: 'assets/meilong/stages/s04/near.png', parallax: 0.5 },
      { kind: 'pillars', color: '#3a1a10', parallax: 0.8, spacing: 160 },
    ],
    bgm: { file: 'assets/meilong/audio/s04.ogg', tempo: 150, key: 'D', scale: 'minor', seed: 4 },
  },
  {
    id: 's05', name: '星夜矿镇',
    sky: ['#161129', '#3c2a54'],
    floor: { color: '#453a2e', line: '#655741' },
    layers: [
      { kind: 'stars', color: '#ffe9c9', parallax: 0.1, seed: 21 },
      { kind: 'image', src: 'assets/meilong/stages/s05/far.png', parallax: 0.3 },
      { kind: 'image', src: 'assets/meilong/stages/s05/near.png', parallax: 0.9 },
    ],
    bgm: { file: 'assets/meilong/audio/s05.ogg', tempo: 144, key: 'G', scale: 'major', seed: 5 },
  },
  {
    id: 's06', name: '井下斗场',
    sky: ['#0d1a11', '#26382a'],
    floor: { color: '#443a2c', line: '#61543e' },
    layers: [
      { kind: 'image', src: 'assets/meilong/stages/s06/far.png', parallax: 0.4 },
      { kind: 'image', src: 'assets/meilong/stages/s06/near.png', parallax: 0.7 },
      { kind: 'lamps', color: '#e8d5a3', parallax: 0.9, spacing: 100 },
    ],
    bgm: { file: 'assets/meilong/audio/s06.ogg', tempo: 162, key: 'B', scale: 'minor', seed: 6 },
  },
];
