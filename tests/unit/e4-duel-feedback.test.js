import { expect, it } from 'vitest';
import { Game } from '../../src/engine/game.js';
import { getCharacter } from '../../src/theme/index.js';

function resolveStrike(attacker, distance, input, guard = false) {
  const defender = attacker === 'c01' ? 'c03' : 'c01';
  const game = new Game({
    characters: [attacker, defender].map(getCharacter),
    training: true, p1x: 350, p2x: 350 + distance,
  });
  for (let frame = 0; frame < 55; frame++) {
    game.step([frame === 0 ? input : {}, guard ? { right: true } : {}]);
    const state = game.getState();
    const contact = state.events.find(e => ['hit', 'block', 'throw'].includes(e.type));
    if (contact) return { contact, hitstop: state.hitstop, action: state.fighters[1].action };
  }
  return null;
}

it('轻拳、重脚、重防与落空保留不同的反馈', () => {
  expect(resolveStrike('c01', 44, { lp: true })).toMatchObject({ contact: { type: 'hit' }, hitstop: 6 });
  expect(resolveStrike('c01', 66, { hk: true })).toMatchObject({ contact: { type: 'hit', id: 'st.hk' }, hitstop: 10 });
  expect(resolveStrike('c01', 66, { hk: true }, true)).toMatchObject({ contact: { type: 'block', heavy: true }, hitstop: 5 });
  expect(resolveStrike('c01', 112, { hk: true })).toBeNull();
});

it('电缆缠摔成功时触发专用顿帧，落空时没有接触反馈', () => {
  const input = { special: 'zhongdan' };
  expect(resolveStrike('c03', 44, input)).toMatchObject({
    contact: { type: 'throw', id: 'zhongdan', command: true }, hitstop: 7, action: 'airhit',
  });
  expect(resolveStrike('c03', 66, input)).toBeNull();
});
