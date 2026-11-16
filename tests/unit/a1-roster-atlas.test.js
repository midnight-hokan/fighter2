import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import theme from '../../src/theme/index.js';
import { requiredAnims, validateAtlas } from '../../src/render/atlas.js';

describe('新版角色图集覆盖', () => {
  for (const fighter of theme.roster) {
    it(`${fighter.id} 的桌面和手机图集覆盖全部招式与状态`, () => {
      const root = `public/assets/${theme.id}/${fighter.id}/`;
      const read = file => JSON.parse(readFileSync(root + file, 'utf8'));
      const desktop = read('atlas.json');
      const mobile = read(desktop.sd);
      for (const atlas of [desktop, mobile]) {
        expect(atlas.artRevision).toBeTruthy();
        expect(theme.characterArtQuery).toBe(`?art=${atlas.artRevision}`);
        expect(atlas.preview).toBeUndefined();
        expect(existsSync(root + atlas.image)).toBe(true);
        expect(validateAtlas(atlas, fighter)).toEqual([]);
        for (const key of requiredAnims(fighter)) expect(atlas.animations[key].frames.length).toBeGreaterThan(0);
      }
      expect(mobile.animations).toEqual(desktop.animations);
    });
  }
});
