// 回合与比赛结算：计时、KO、时间到、三局两胜、最多 5 回合、气槽跨回合保留。
import { ROUND } from './constants.js';

export function updateRound(game) {
  const r = game.round;
  if (r.matchOver) return;
  const [a, b] = game.fighters;

  if (!r.over) {
    if (!game.training) {
      r.timerFrames = Math.max(0, r.timerFrames - 1);
      r.timer = Math.ceil(r.timerFrames / 60);
    }
    let winner = null;
    if (a.hp <= 0 || b.hp <= 0) {
      if (game.training) {
        for (const f of game.fighters) if (f.hp <= 0) f.hp = 1;
        return;
      }
      winner = a.hp <= 0 && b.hp <= 0 ? 'draw' : a.hp <= 0 ? 1 : 0;
      game.emit('ko', { loser: winner === 'draw' ? 'both' : 1 - winner });
    } else if (r.timerFrames === 0 && !game.training) {
      winner = a.hp === b.hp ? 'draw' : a.hp > b.hp ? 0 : 1;
      game.emit('timeup');
    }
    if (winner === null) return;

    for (const f of game.fighters) {
      f.move = null; f.queued = null; f.hitstun = 0; f.blockstun = 0; f.slide = null;
      f.meter.max = 0;
      f.action = f.hp <= 0 ? 'ko' : winner === f.index ? 'win' : 'idle';
      f.actionFrame = 0;
    }
    game.projectiles = [];
    r.over = true;
    r.winner = winner;
    r.endDelay = ROUND.endDelayFrames;
    if (winner !== 'draw') r.wins[winner]++;
    if (r.wins[0] >= ROUND.winsToMatch || r.wins[1] >= ROUND.winsToMatch) {
      r.matchOver = true;
      r.matchWinner = r.wins[0] >= ROUND.winsToMatch ? 0 : 1;
    } else if (r.number >= ROUND.maxRounds) {
      r.matchOver = true;
      r.matchWinner = r.wins[0] === r.wins[1] ? 'draw' : r.wins[0] > r.wins[1] ? 0 : 1;
    }
    if (r.matchOver) game.emit('matchover', { winner: r.matchWinner });
    return;
  }

  if (--r.endDelay <= 0) {
    r.number++;
    game.resetPositions();
    r.timerFrames = ROUND.seconds * 60;
    r.timer = ROUND.seconds;
    r.over = false;
    r.winner = null;
    game.emit('round', { number: r.number });
  }
}
