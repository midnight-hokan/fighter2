// 剧情组装（纯函数，不碰 DOM）：根据玩家、对手、第几战，从主题的 story 里取出要播放的场景。
// 场景/台词格式见 src/theme/<主题>/story.js 顶部注释。

const FINAL_GUARD = 'c08';   // 第七战守关人（docs/故事设定.md：体检关）
const FINAL_FOR_GUARD = 'c01'; // 玩家就是守关人时，第七战的对手

export function finalOpponent(playerId) {
  return playerId === FINAL_GUARD ? FINAL_FOR_GUARD : FINAL_GUARD;
}

const resolve = (lines, me, opp) => lines.map(l => ({ ...l, who: l.who === 'me' ? me : l.who === 'opp' ? opp : l.who }));

export function openingScenes(story) { return story?.OPENING ?? []; }

export function prologueScenes(story, me) { return story?.PROLOGUE?.[me] ?? []; }

// 对战前对话：宿敌用 RIVALS，其余对手用 DUELS（故事模式每对都有专门台词），都没有才用 TAUNTS 拼一段
export function preFightScenes(story, me, opp, { stage = 1, final = false } = {}) {
  if (!story) return [];
  if (final) {
    if (me === FINAL_GUARD) return story.FINAL_FOR_SHEN ?? [];
    const extra = story.CHECKUP_EXTRA?.[me];
    const base = story.CHECKUP ?? [];
    return extra ? [...base, { img: 'checkup', cam: 'still', vs: { me, opp }, lines: extra }] : base;
  }
  const rival = story.RIVALS?.[`${me}>${opp}`] ?? story.DUELS?.[`${me}>${opp}`];
  const lines = rival ? resolve(rival, me, opp) : [
    { who: me, expr: 'smug', text: pick(story.TAUNTS?.[me]?.open, stage) },
    { who: opp, expr: 'normal', text: pick(story.TAUNTS?.[opp]?.reply, stage) },
  ].filter(l => l.text);
  return [{ img: 'vs_arena', cam: 'push', vs: { me, opp }, lines }];
}

// 故事模式中段剧情（第三战后、第四战前）
export function midpointScenes(story, me) { return story?.MIDPOINT?.[me] ?? []; }

// 故事模式挑战顺序：剧本里写了就按剧本，没写返回 null（由 createArcade 洗牌）
export function storyOrder(story, me) { return story?.ORDER?.[me] ?? null; }

export function endingScenes(story, me) {
  return [...(story?.ENDINGS?.[me] ?? []), ...(story?.TRUTH ?? [])];
}

const pick = (arr, i) => (arr && arr.length ? arr[i % arr.length] : null);

// 说话人：角色 id → 角色名；'npc:名字' → 名字；null → 旁白
export function speakerOf(who, roster) {
  if (!who) return { id: null, name: '' };
  if (who.startsWith('npc:')) return { id: null, name: who.slice(4) };
  const c = roster.find(x => x.id === who);
  return { id: c ? c.id : null, name: c ? c.name : who };
}

// 剧本里引用到的所有场景图 id
export function referencedImages(story, roster) {
  const out = new Set();
  const add = (scenes) => scenes.forEach(s => s.img && out.add(s.img));
  add(story.OPENING ?? []);
  Object.values(story.PROLOGUE ?? {}).forEach(add);
  Object.values(story.ENDINGS ?? {}).forEach(add);
  add(story.CHECKUP ?? []); add(story.FINAL_FOR_SHEN ?? []); add(story.TRUTH ?? []);
  Object.values(story.MIDPOINT ?? {}).forEach(add);
  for (const a of roster) for (const b of roster) if (a.id !== b.id) add(preFightScenes(story, a.id, b.id));
  return out;
}
