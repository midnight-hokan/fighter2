import { expect, it } from 'vitest';
import { Game } from '../../src/engine/game.js';
import { simpleSpecialFor } from '../../src/ui/touch.js';
import { getCharacter } from '../../src/theme/index.js';

function duel(id, gap) {
  return new Game({ characters: [id, 'c01'].map(getCharacter), training: true, p1x: 300, p2x: 300 + gap });
}

function simulate(game, frames, inputs) {
  const states = [];
  for (let frame = 0; frame < frames; frame++) {
    game.step(inputs(frame, game.getState()));
    states.push(game.getState());
  }
  return states;
}

it('救生绳命中拉近并接成钩扫连段，防住则没有拉拽', () => {
  expect(simpleSpecialFor(getCharacter('c02'), { forward: true, down: true })).toBe('gousao');
  let usedHook = false;
  const hit = simulate(duel('c02', 85), 60, (frame, state) => {
    if (!frame) return [{ special: 'baokong' }, {}];
    if (!usedHook && state.fighters[0].action === 'idle') {
      usedHook = true;
      return [{ down: true, right: true, hk: true }, {}];
    }
    return [{}, {}];
  });
  expect(hit.flatMap(s => s.events)).toContainEqual(expect.objectContaining({ type: 'rescuepull' }));
  expect(hit.flatMap(s => s.events)).toContainEqual(expect.objectContaining({ type: 'hit', id: 'gousao', combo: 2 }));
  const blocked = simulate(duel('c02', 65), 60, frame => [!frame ? { special: 'baokong' } : {}, { right: true }]).flatMap(s => s.events);
  expect(blocked).toContainEqual(expect.objectContaining({ type: 'block', id: 'baokong' }));
  expect(blocked.some(e => e.type === 'rescuepull')).toBe(false);
});

it('双灯按次序打出两束，可在第二束接触前走位，两束都能防', () => {
  const states = simulate(duel('c06', 95), 65, frame => [!frame ? { special: 'jifengdan' } : frame >= 34 ? { right: true } : {}, {}]);
  expect(states[9].projectiles).toHaveLength(1);
  expect(states[9].projectiles[0].second).toBeUndefined();
  expect(states.some(s => s.projectiles.some(p => p.second))).toBe(true);
  const hits = states.flatMap(s => s.events).filter(e => e.type === 'hit');
  expect(hits.map(e => e.damage)).toEqual([42, 22]);
  expect(states[hits[1].frame].fighters[0].x).toBeGreaterThan(300);
  const guard = simulate(duel('c06', 55), 65, frame => [!frame ? { special: 'jifengdan' } : {}, { right: true }]);
  expect(guard.flatMap(s => s.events).filter(e => e.type === 'block').map(e => e.damage)).toEqual([8, 3]);
});

it('排查命中空挥收招才追加伤害', () => {
  const getHit = (whiff) => simulate(duel('c04', 85), 50, frame => [
    frame === 8 ? { special: 'denghua' } : {}, !frame && whiff ? { hp: true } : {},
  ]).flatMap(s => s.events).find(e => e.type === 'hit' && e.attacker === 0);
  expect(getHit(true)).toMatchObject({ id: 'denghua', damage: 125, inspection: true });
  expect(getHit(false)).toMatchObject({ id: 'denghua', damage: 105, inspection: false });
});
