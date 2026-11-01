// 精灵图（图集）：规格、校验、加载与绘制。规格详见 docs/精灵图规格.md；生成流水线见 TASK.md 第十一节
//
// public/assets/manifest.json：{ "<主题id>": { "<角色id>": "assets/<主题id>/<角色id>/atlas.json" } }
// atlas.json：{
//   "image": "atlas.png", "frameW": 128, "frameH": 128, "columns": 8,
//   "anchor": { "x": 64, "y": 124 },            // 脚底中心在单帧里的像素位置
//   "animations": { "<动画名>": { "frames": [0,1,2], "fps": 10, "loop": true } }
// }
// 动画名 = 状态名（见 BASE_ANIMS）或招式 id（st.lp、必杀技 id、超必杀 id、throw、gc）。

export const BASE_ANIMS = [
  'idle', 'walkf', 'walkb', 'crouch', 'prejump', 'jump', 'blockstun', 'crblock', 'hitstun', 'airhit',
  'knockdown', 'dizzy', 'roll', 'maxstart', 'ko', 'win', 'throw', 'gc',
];

export function requiredAnims(character) {
  const ids = [
    ...Object.keys(character.normals ?? {}),
    ...(character.specials ?? []).map(s => s.id),
    ...(character.supers ?? []).map(s => s.id),
  ];
  return [...BASE_ANIMS, ...ids];
}

// 纯函数校验（Node 和浏览器都能用）。img：{ width, height }
export function validateAtlas(json, character, img) {
  const errs = [];
  for (const k of ['image', 'frameW', 'frameH', 'columns', 'anchor', 'animations']) if (json?.[k] === undefined) errs.push(`缺少 ${k}`);
  if (errs.length) return errs;
  if (!(json.frameW >= 48 && json.frameW <= 256)) errs.push('frameW 应在 48–256');
  if (!(json.frameH >= 64 && json.frameH <= 256)) errs.push('frameH 应在 64–256');
  if (img) {
    if (img.width % json.frameW !== 0) errs.push(`图片宽 ${img.width} 不是 frameW 的整数倍`);
    if (img.height % json.frameH !== 0) errs.push(`图片高 ${img.height} 不是 frameH 的整数倍`);
    if (Math.round(img.width / json.frameW) !== json.columns) errs.push('columns 与图片宽度不符');
  }
  const total = img ? (img.width / json.frameW) * (img.height / json.frameH) : Infinity;
  for (const key of requiredAnims(character)) {
    const a = json.animations[key];
    if (!a) { errs.push(`缺少动画：${key}`); continue; }
    if (!Array.isArray(a.frames) || !a.frames.length) errs.push(`${key}：frames 为空`);
    else if (a.frames.some(i => !Number.isInteger(i) || i < 0 || i >= total)) errs.push(`${key}：帧序号越界`);
  }
  if (!(json.anchor.x >= 0 && json.anchor.x <= json.frameW && json.anchor.y >= 0 && json.anchor.y <= json.frameH)) errs.push('anchor 超出单帧范围');
  return errs;
}

export function animKeyFor(f) {
  if (f.action === 'attack' && f.move) return f.move.id;
  if (f.action === 'blockstun' && f.blockLow) return 'crblock';
  return f.action;
}

class Atlas {
  constructor(json, image) { this.json = json; this.image = image; }

  frameIndex(key, f) {
    const a = this.json.animations[key] ?? this.json.animations.idle;
    if (f.action === 'attack' && f.move && this.json.animations[key]) {
      const k = Math.min(a.frames.length - 1, Math.floor(((f.move.frame - 1) / Math.max(1, f.move.total)) * a.frames.length));
      return a.frames[k];
    }
    const step = Math.floor((f.actionFrame * (a.fps ?? 10)) / 60);
    return a.loop === false ? a.frames[Math.min(step, a.frames.length - 1)] : a.frames[step % a.frames.length];
  }

  draw(ctx, key, f, x, y, alt, flash = false) {
    const j = this.json;
    const idx = this.frameIndex(key, f);
    const sx = (idx % j.columns) * j.frameW;
    const sy = Math.floor(idx / j.columns) * j.frameH;
    ctx.save();
    const filters = [];
    if (alt) filters.push('hue-rotate(160deg) saturate(0.8)');
    if (flash) filters.push('brightness(2.4)');
    if (filters.length) ctx.filter = filters.join(' ');
    ctx.translate(x, y);
    if (f.facing < 0) ctx.scale(-1, 1);
    ctx.drawImage(this.image, sx, sy, j.frameW, j.frameH, -j.anchor.x, -j.anchor.y, j.frameW, j.frameH);
    ctx.restore();
  }
}

export class AtlasStore {
  constructor(themeId) { this.themeId = themeId; this.map = new Map(); this.errors = {}; }

  async load(roster) {
    let manifest = {};
    try {
      const r = await fetch('assets/manifest.json', { cache: 'no-cache' });
      if (r.ok) manifest = await r.json();
    } catch { /* 没有清单就全部用占位小人 */ }
    const entries = manifest[this.themeId] ?? {};
    await Promise.all(Object.entries(entries).map(async ([id, path]) => {
      const ch = roster.find(c => c.id === id);
      if (!ch) return;
      try {
        const json = await (await fetch(path, { cache: 'no-cache' })).json();
        const base = path.slice(0, path.lastIndexOf('/') + 1);
        const image = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = base + json.image; });
        const errs = validateAtlas(json, ch, image);
        if (errs.length) { this.errors[id] = errs; console.warn(`精灵图 ${id} 不合格，改用占位小人：`, errs); return; }
        this.map.set(id, new Atlas(json, image));
      } catch (e) {
        this.errors[id] = [String(e)];
        console.warn(`精灵图 ${id} 加载失败：`, e);
      }
    }));
  }

  get(id) { return this.map.get(id) ?? null; }
  loadedIds() { return [...this.map.keys()]; }
}
