import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import theme from '../../src/theme/index.js';
import { validateAtlas } from '../../src/render/atlas.js';
import { pub, exists, size, imageSize } from './_assets.js';

// V2 高清美术（大炮负责）：全景场景图、动态场景层、256 像素高清图集、播报员语音
const SCREEN_W = 384, SCREEN_H = 224, STAGE_W = 768;

describe('V2 高清场景', () => {
  it('每个场景都有一张高清全景图：scale≥2，覆盖整个画面高度，宽度够镜头平移', () => {
    for (const st of theme.stages) {
      const pano = (st.layers ?? []).filter(l => l.kind === 'image' && (l.scale ?? 1) >= 2 && l.ground);
      expect(pano.length, `${st.id} 缺少全景图层（kind:'image', scale≥2, ground:true）`).toBeGreaterThan(0);
      for (const l of pano) {
        expect(exists(l.src), l.src).toBe(true);
        const { width, height } = imageSize(l.src);
        expect(height / l.scale, `${st.id} 全景图高度不够铺满画面`).toBeGreaterThanOrEqual(SCREEN_H);
        const need = SCREEN_W + (STAGE_W - SCREEN_W) * (l.parallax ?? 0.5);
        expect(width / l.scale, `${st.id} 全景图宽度不够`).toBeGreaterThanOrEqual(need);
        expect(size(l.src), `${l.src} 超过 3MB`).toBeLessThan(3 * 1024 * 1024);
      }
    }
  });

  it('全景图自带地面（floor.hidden），每个场景至少 2 个动态层（particles / glow）', () => {
    for (const st of theme.stages) {
      expect(st.floor?.hidden, `${st.id} floor.hidden`).toBe(true);
      const anim = [...(st.layers ?? []), ...(st.front ?? [])].filter(l => l.kind === 'particles' || l.kind === 'glow');
      expect(anim.length, `${st.id} 动态层`).toBeGreaterThanOrEqual(2);
    }
  });

  it('6 个场景的全景图互不相同', () => {
    const srcs = theme.stages.map(st => st.layers.find(l => l.kind === 'image' && l.ground)?.src);
    expect(new Set(srcs).size).toBe(theme.stages.length);
  });
});

describe('V2 高清角色图集', () => {
  const manifest = () => JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
  it('8 名角色的图集都是高清版：frameH 256、scale 2，校验通过，单张不超过 8MB', () => {
    const m = manifest()[theme.id];
    for (const c of theme.roster) {
      const path = m[c.id];
      const json = JSON.parse(readFileSync(pub(path), 'utf8'));
      const img = path.slice(0, path.lastIndexOf('/') + 1) + json.image;
      expect(json.scale, `${c.id} scale`).toBe(2);
      expect(json.frameH, `${c.id} frameH`).toBe(256);
      expect(validateAtlas(json, c, imageSize(img)), c.id).toEqual([]);
      expect(size(img), `${c.id} 图集超过 8MB`).toBeLessThan(8 * 1024 * 1024);
    }
  });
});

describe('V2 播报员', () => {
  it('播报员 9 句语音齐全：round1/round2/round3/final/fight/ko/timeup/perfect/win', () => {
    const a = theme.audio?.announcer ?? {};
    for (const k of ['round1', 'round2', 'round3', 'final', 'fight', 'ko', 'timeup', 'perfect', 'win']) {
      expect(a[k], `缺少 ${k}`).toBeTruthy();
      expect(exists(a[k]), a[k]).toBe(true);
      expect(size(a[k]), `${a[k]} 太小`).toBeGreaterThan(3000);
    }
  });
});
