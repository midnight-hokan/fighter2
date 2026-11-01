// 场景：程序化绘制的像素背景（不依赖图片）。layers 从远到近，parallax 越小越远。
// 【R2 由大炮扩充】至少 4 个场景，每个场景要有专属配色、层次和背景音乐 bgm。
export const STAGES = [
  {
    id: 's01', name: '废弃矿井',
    sky: ['#120d0b', '#2b1d14'],
    floor: { color: '#4a3424', line: '#6b4c33' },
    layers: [
      { kind: 'mountains', color: '#21160f', parallax: 0.2, height: 70, seed: 3 },
      { kind: 'beams', color: '#3a2a1c', parallax: 0.5, spacing: 90 },
      { kind: 'lamps', color: '#f2c14e', parallax: 0.8, spacing: 120 },
    ],
    bgm: { tempo: 132, key: 'A', scale: 'minor', seed: 1 },
  },
];
