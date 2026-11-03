// 精灵图（图集）：规格、校验、加载与绘制。规格详见 docs/精灵图规格.md；生成流水线见 TASK.md 第十一节
//
// public/assets/manifest.json：{ "<主题id>": { "<角色id>": "assets/<主题id>/<角色id>/atlas.json" } }
// atlas.json：{
//   "image": "atlas.png", "frameW": 128, "frameH": 128, "columns": 8,
//   "anchor": { "x": 64, "y": 124 },            // 脚底中心在单帧里的像素位置
//   "animations": { "<动画名>": { "frames": [0,1,2], "fps": 10, "loop": true } },
//   "scale": 2                                   // 可选：高清图集（256 像素帧）写 2，按逻辑尺寸 128 绘制

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

// 图集里没有某个动画时借用的动画（v2 新动画陆续交付，交付前用旧动画顶上）：
// 近身重拳/重脚用站立版，吹飞攻击用站立重脚，空中吹飞用跳重脚，开场/挑衅/第二胜利姿势用待机/胜利，
// 4 键后不用的中拳中脚用轻拳轻脚
export const ANIM_ALIAS = {
  'cl.hp': 'st.hp', 'cl.hk': 'st.hk', cd: 'st.hk', 'j.cd': 'j.hk',
  intro: 'idle', taunt: 'win', win2: 'win',
  'st.mp': 'st.lp', 'st.mk': 'st.lk', 'cr.mp': 'cr.lp', 'cr.mk': 'cr.lk', 'j.mp': 'j.lp', 'j.mk': 'j.lk',
};
export function resolveAnim(animations, key) {
  let k = key;
  for (let i = 0; i < 3 && !animations[k] && ANIM_ALIAS[k]; i++) k = ANIM_ALIAS[k];
  return animations[k] ? k : 'idle';
}
export function animKeyFor(f) {
  if (f.action === 'attack' && f.move) return f.move.id;
  if (f.action === 'blockstun' && f.blockLow) return 'crblock';
  if (f.action === 'run') return 'walkf';
  if (f.action === 'backstep') return 'walkb';
  return f.action;
}

class Atlas {
  constructor(json, image) { this.json = json; this.image = image; }

  frameIndex(key0, f) {
    const key = resolveAnim(this.json.animations, key0);
    const a = this.json.animations[key];
    if (f.action === 'attack' && f.move && key !== 'idle') {
      const k = Math.min(a.frames.length - 1, Math.floor(((f.move.frame - 1) / Math.max(1, f.move.total)) * a.frames.length));
      return a.frames[k];
    }
    const step = Math.floor((f.actionFrame * (a.fps ?? 10)) / 60);
    return a.loop === false ? a.frames[Math.min(step, a.frames.length - 1)] : a.frames[step % a.frames.length];
  }

  // tint：残影着色（'special' 青白 / 'super' 金色）。json.scale = 图集像素 / 逻辑像素（高清图集 256 帧用 2）
  draw(ctx, key, f, x, y, alt, flash = false, tint = null) {
    const j = this.json;
    const k = j.scale ?? 1;
    const idx = this.frameIndex(key, f);
    const sx = (idx % j.columns) * j.frameW;
    const sy = Math.floor(idx / j.columns) * j.frameH;
    ctx.save();
    // 软件渲染下 ctx.filter 很慢：只有镜像换色才用滤镜；受击闪白改成 lighter 叠画一遍
    if (alt) ctx.filter = 'hue-rotate(160deg) saturate(0.8)';
    if (tint === 'special') ctx.filter = 'brightness(1.4) sepia(1) hue-rotate(160deg) saturate(3)';
    if (tint === 'super') ctx.filter = 'brightness(1.5) sepia(1) saturate(4)';
    ctx.translate(x, y);
    if (f.facing < 0) ctx.scale(-1, 1);
    ctx.drawImage(this.image, sx, sy, j.frameW, j.frameH, -j.anchor.x / k, -j.anchor.y / k, j.frameW / k, j.frameH / k);
    if (flash) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= 0.85;
      ctx.drawImage(this.image, sx, sy, j.frameW, j.frameH, -j.anchor.x / k, -j.anchor.y / k, j.frameW / k, j.frameH / k);
    }
    ctx.restore();
  }
}

export class AtlasStore {
  constructor(themeId) { this.themeId = themeId; this.map = new Map(); this.errors = {}; }

  // 清单只取一次
  manifest() {
    this.manifestP ??= fetch('assets/manifest.json', { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : {})).catch(() => ({}));
    return this.manifestP;
  }

  // 全部加载（测试和预取用）
  async load(roster) { return this.ensure(roster, roster.map(c => c.id)); }

  // 按需加载指定角色（对战双方），已加载或正在加载的不会重复请求
  async ensure(roster, ids) {
    const entries = (await this.manifest())[this.themeId] ?? {};
    this.pending ??= new Map();
    await Promise.all(ids.filter(id => entries[id]).map((id) => {
      if (!this.pending.has(id)) this.pending.set(id, this.loadOne(roster, id, entries[id]));
      return this.pending.get(id);
    }));
  }

  async loadOne(roster, id, path) {
    const ch = roster.find(c => c.id === id);
    if (!ch) return;
    try {
      const getJson = async (p) => { const r = await fetch(p, { cache: 'no-cache' }); if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json(); };
      const base = path.slice(0, path.lastIndexOf('/') + 1);
      let json = await getJson(path);
      // 手机（粗指针）改用 json.sd 指向的 160 像素版（v3 打包才有），解码后内存约为高清版的 40%
      const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
      if (coarse && json.sd) json = await getJson(base + json.sd).catch(() => json);
      // 优先加载同名 .webp（体积约 PNG 的十分之一），失败再回退原图
      const load = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
      const src = base + json.image;
      const image = /\.png$/.test(src) ? await load(src.replace(/\.png$/, '.webp')).catch(() => load(src)) : await load(src);
      const errs = validateAtlas(json, ch, image);
      if (errs.length) { this.errors[id] = errs; console.warn(`精灵图 ${id} 不合格，改用占位小人：`, errs); return; }
      this.map.set(id, new Atlas(json, image));
    } catch (e) {
      this.errors[id] = [String(e)];
      console.warn(`精灵图 ${id} 加载失败：`, e);
    }
  }

  has(id) { return this.map.has(id); }
  get(id) { return this.map.get(id) ?? null; }
  loadedIds() { return [...this.map.keys()]; }
}
