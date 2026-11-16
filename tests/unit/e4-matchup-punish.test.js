import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/game.js';
import { getCharacter } from '../../src/theme/index.js';

function fight(distance, inputs) {
  const game = new Game({
    characters: ['c01', 'c03'].map(getCharacter),
    training: true,
    p1x: 350,
    p2x: 350 + distance,
  });
  const events = [];
  for (let frame = 0; frame < 60; frame++) {
    game.step(inputs[frame] ?? [{}, {}]);
    events.push(...game.getState().events);
  }
  return events;
}

describe('林啸与雷钧的收招反击', () => {
  it('雷钧翻滚越过光弹后，快拳能打中林啸最后几帧收招', () => {
    const events = fight(98, {
      0: [{ special: 'meiyan' }, {}],
      9: [{}, { lp: true, lk: true }],
      40: [{}, { lp: true }],
    });
    expect(events.find(e => e.type === 'projectile')).toMatchObject({ player: 0, id: 'meiyan' });
    expect(events.filter(e => e.type === 'hit')).toMatchObject([
      { attacker: 1, defender: 0, id: 'st.lp', punish: true, counter: false },
    ]);
  });

  it('缠摔落空时林啸能用前踢反击，缠摔在近身仍然有效', () => {
    const inputs = { 0: [{}, { special: 'zhongdan' }], 36: [{ lk: true }, {}] };
    const events = fight(66, inputs);
    expect(events.some(e => e.type === 'throw')).toBe(false);
    expect(events.find(e => e.type === 'hit')).toMatchObject({
      attacker: 0, defender: 1, id: 'st.lk', punish: true, counter: false,
    });
    expect(fight(48, inputs).find(e => e.type === 'throw')).toMatchObject({ attacker: 1, command: true });
  });
});
