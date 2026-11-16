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

it('林啸光弹打中才推进，苏红声波被防时拉开身位', () => {
  const lin = (guard) => simulate(duel('c01', 85), 60, frame => [
    !frame ? { special: 'meiyan' } : {}, guard ? { right: true } : {},
  ]);
  expect(lin(false).at(-1).fighters[0].x).toBe(318);
  expect(lin(true).at(-1).fighters[0].x).toBe(300);
  const su = simulate(duel('c05', 60), 45, frame => [
    !frame ? { special: 'denghuadan' } : {}, frame <= 22 ? { right: true } : {},
  ]);
  const block = su.flatMap(s => s.events).find(e => e.type === 'block');
  expect(block).toMatchObject({ id: 'denghuadan', guardPush: true });
  expect(su[block.frame + 12].fighters[1].x - su[block.frame].fighters[1].x).toBeCloseTo(24);
});

it('雷钧扛轻拳时照常扣血，重拳能打断扳手', () => {
  const attempt = (button) => simulate(duel('c03', 36), 24, frame => [
    !frame ? { special: 'suiluo' } : {}, !frame ? { [button]: true } : {},
  ]).flatMap(s => s.events);
  const light = attempt('lp');
  expect(light).toContainEqual(expect.objectContaining({ type: 'armor', player: 0, damage: 30 }));
  expect(light).toContainEqual(expect.objectContaining({ type: 'hit', id: 'suiluo' }));
  expect(attempt('hp').some(e => e.type === 'armor' || e.id === 'suiluo' && e.type === 'hit')).toBe(false);
});

it('霍兰对空追加伤害，沈清通过打断出招回少量血', () => {
  const huo = simulate(duel('c07', 60), 20, frame => [
    !frame ? { special: 'chongtiant' } : {}, { up: true },
  ]);
  expect(huo.flatMap(s => s.events)).toContainEqual(expect.objectContaining({ type: 'hit', id: 'chongtiant', damage: 170, antiAir: true }));
  const shen = (counter) => {
    const game = duel('c08', 45);
    game.fighters[0].hp -= 100;
    game.fighters[0].lastHitFrame = 0;
    return simulate(game, 16, frame => [
      !frame ? { special: 'huayan' } : {}, frame === 5 && counter ? { hk: true, up: true } : {},
    ]);
  };
  expect(shen(true).flatMap(s => s.events)).toContainEqual(expect.objectContaining({ type: 'hit', id: 'huayan', heal: 24 }));
  expect(shen(false).flatMap(s => s.events)).toContainEqual(expect.objectContaining({ type: 'hit', id: 'huayan', heal: 0 }));
});
