import { describe, it, expect } from 'vitest';
import { Game } from '../../src/engine/game.js';
import theme from '../../src/theme/index.js';
import { simpleSpecialFor } from '../../src/ui/touch.js';

const run = (g, ins, n = 1) => { for (let i = 0; i < n; i++) g.step(ins); };

describe('U1 简易出招（触屏一键必杀）', () => {
  it('每个角色：不推 / 前 / 后 对应三个不同的必杀技，下 = 超必杀', () => {
    for (const c of theme.roster) {
      const ids = [simpleSpecialFor(c, {}), simpleSpecialFor(c, { forward: true }), simpleSpecialFor(c, { back: true })];
      expect(new Set(ids).size, c.id).toBe(3);
      expect(simpleSpecialFor(c, { down: true }), c.id).toBe(c.supers[0].id);
    }
  });

  it('input.special 能直接发动必杀技（所有角色）', () => {
    for (const c of theme.roster) {
      const g = new Game({ seed: 1, characters: [c, theme.roster[0]] });
      run(g, [{}, {}], 5);
      const id = c.specials[0].id;
      g.step([{ special: id }, {}]);
      run(g, [{}, {}], 2);
      expect(g.getState().fighters[0].move?.id, c.id).toBe(id);
    }
  });

  it('超必杀没有豆时不能用简易出招发动，有豆时能，并扣 1 豆', () => {
    const c = theme.roster[0];
    const g = new Game({ seed: 1, characters: [c, theme.roster[1]] });
    run(g, [{}, {}], 5);
    g.step([{ special: c.supers[0].id }, {}]);
    run(g, [{}, {}], 2);
    expect(g.getState().fighters[0].move?.id).not.toBe(c.supers[0].id);
    run(g, [{}, {}], 60);
    g.debug.setMeter(0, 1, 0);
    g.step([{ special: c.supers[0].id }, {}]);
    run(g, [{}, {}], 2);
    const f = g.getState().fighters[0];
    expect(f.move?.id).toBe(c.supers[0].id);
    expect(f.meter.stocks).toBe(0);
  });

  it('不认识的 id 不报错也不出招', () => {
    const g = new Game({ seed: 1, characters: [theme.roster[0], theme.roster[1]] });
    run(g, [{}, {}], 5);
    expect(() => g.step([{ special: 'nope' }, {}])).not.toThrow();
  });
});
