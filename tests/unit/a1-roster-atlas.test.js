import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import theme from '../../src/theme/index.js';
import { requiredAnims, validateAtlas } from '../../src/render/atlas.js';

const signatureMoves = {
  c01: 'meiyan', c02: 'baokong', c03: 'zhongdan', c04: 'denghua',
  c05: 'denghuadan', c06: 'jifengdan', c07: 'chongtiant', c08: 'huiyan',
};

describe('新版角色图集覆盖', () => {
  for (const fighter of theme.roster) {
    it(`${fighter.id} 的桌面和手机图集覆盖全部招式与状态`, () => {
      const root = `public/assets/${theme.id}/${fighter.id}/`;
      const read = file => JSON.parse(readFileSync(root + file, 'utf8'));
      const desktop = read('atlas.json');
      const mobile = read(desktop.sd);
      for (const atlas of [desktop, mobile]) {
        expect(atlas.artRevision).toBeTruthy();
        expect(atlas.preview).toBeUndefined();
        expect(existsSync(root + atlas.image)).toBe(true);
        expect(validateAtlas(atlas, fighter)).toEqual([]);
        for (const key of requiredAnims(fighter)) expect(atlas.animations[key].frames.length).toBeGreaterThan(0);
      }
      expect(mobile.animations).toEqual(desktop.animations);
      expect(mobile.artRevision).toBe(desktop.artRevision);
      const { animations } = desktop;
      const ready = animations.idle.frames[0];
      const jab = animations['st.lp'].frames;
      const kick = animations['st.hk'].frames;
      const signature = animations[signatureMoves[fighter.id]].frames;
      expect(jab[0]).not.toBe(ready);
      expect(new Set(kick).size).toBe(4);
      expect(signature.length).toBeGreaterThanOrEqual(5);
      expect(signature.at(-1)).toBe(ready);
      if (animations['cl.hk']) expect(animations['cl.hk'].frames[1]).not.toBe(kick[1]);
    });
  }
});
