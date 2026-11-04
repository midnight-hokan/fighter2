#!/usr/bin/env python3
"""v3 图集分包（光哥 2026-11-04 裁决：不改 U1 阈值、不降 q，走资源分包）。

把 pack-atlas.py --v3 的单体图集拆成按动画段分页的多包：
  - 单包目标 ≤ --target MB（默认 1.5MB）；段超限时按动画边界分页，单动画仍超则按帧预算分页
  - 运行时按需加载：首屏只加载 --initial 指定的段（默认 core），其余段由引擎后台/触发时拉取
  - 每个段文件与单体 atlas.json 同格式（image/frameW/frameH/columns/anchor/scale/animations），
    帧索引为段内局部索引；引擎按 segments.json 做 anim → (段, 局部索引) 映射
  - alias 只写入其目标动画同段的 manifest（mp/mk→lp/lk 同在 core，天然满足；跨段 alias 会报错）

用法：python3 scripts/art/split-atlas.py <poses.json> <frames_dir> --out <输出目录> [--target 1.5]
输入与 pack-atlas.py --v3 完全相同（<动画名，.换成_>_帧号.png，1024×1024）。
输出：<out>/hd/<段>.webp+json、<out>/sd/<段>.webp+json、<out>/segments.json（段索引+体积+层级）
"""
import json, os, sys, math
from PIL import Image

LANCZOS = getattr(Image, "Resampling", Image).LANCZOS

TIER_CORE = [
    "idle", "walkf", "walkb", "crouch", "prejump", "jump",
    "hitstun", "blockstun", "crblock", "airhit", "knockdown", "dizzy", "roll", "ko", "intro",
    "st.lp", "st.hp", "st.lk", "st.hk", "cr.lp", "cr.hp", "cr.lk", "cr.hk",
    "j.lp", "j.hp", "j.lk", "j.hk", "cl.hp", "cl.hk", "cd", "j.cd",
    "st.mp", "st.mk", "cr.mp", "cr.mk", "j.mp", "j.mk",
]
TIER_SKILL_FIXED = ["throw", "gc", "maxstart"]
TIER_EXPRESS = ["win", "win2", "taunt"]
# 未点名动画（特殊技/新招式）全部进 skill

def build_tiers(anims_names):
    tiers = {
        "core": [a for a in TIER_CORE if a in anims_names],
        "skill": [a for a in TIER_SKILL_FIXED if a in anims_names],
        "express": [a for a in TIER_EXPRESS if a in anims_names],
    }
    named = {a for t in tiers.values() for a in t}
    for a in anims_names:
        if a not in named:
            tiers["skill"].append(a)
    order = {n: i for i, n in enumerate(anims_names)}
    return {t: sorted(v, key=lambda n: order[n]) for t, v in tiers.items()}

class Encoder:
    """把若干 (动画名, [帧Image]) 块拼成 16 列 sheet 并编码 webp（参数与 pack-atlas --v3 一致）"""
    def __init__(self, out_dir, F, q):
        self.out_dir, self.F, self.q = out_dir, F, q
        self.cols = 16

    def encode(self, chunks, path):
        cells = [im for _, frames in chunks for im in frames]
        rows = math.ceil(len(cells) / self.cols)
        sheet = Image.new("RGBA", (self.cols * self.F, rows * self.F), (0, 0, 0, 0))
        for i, im in enumerate(cells):
            sheet.paste(im, ((i % self.cols) * self.F, (i // self.cols) * self.F))
        sheet.save(path, "WEBP", quality=self.q, method=6)
        return os.path.getsize(path)

def page_chunks(chunks, enc, target, probe):
    """贪心分页：动画边界优先；单块超限按帧预算二分。返回 [[(anim, frames)], ...]"""
    pages, i = [], 0
    while i < len(chunks):
        j = len(chunks)
        while True:
            sz = enc.encode(chunks[i:j], probe)
            if sz <= target or j - i == 1:
                break
            j -= 1
        if j - i == 1:
            sz = enc.encode(chunks[i:j], probe)
            if sz > target:
                name, frames = chunks[i]
                lo, hi, best = 1, len(frames) - 1, None
                while lo <= hi:
                    mid = (lo + hi) // 2
                    if enc.encode([(name, frames[:mid])], probe) <= target:
                        best = mid
                        lo = mid + 1
                    else:
                        hi = mid - 1
                if best is None:
                    raise SystemExit(f"❌ {name}: 单帧都超 {target} 字节，无法分页")
                pages.append([(name, frames[:best])])
                chunks = chunks[:i] + [(name, frames[best:])] + chunks[i + 1:]
                continue  # i 不变，下一页先装该动画剩余帧
        pages.append(chunks[i:j])
        i = j
    return pages

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opt = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
    poses_path, frames_dir = args[0], args[1]
    out_root = opt("--out", None)
    target_mb = float(opt("--target", "1.5"))
    if not out_root:
        print("❌ 需要 --out <输出目录>")
        sys.exit(1)

    data = json.load(open(poses_path))
    cid = data["id"]
    anims_names = list(data["anims"].keys())
    alias = data.get("alias") or {}
    tiers = build_tiers(anims_names)

    srcs, missing = {}, []
    for name, anim in data["anims"].items():
        files = []
        for i in range(len(anim["frames"])):
            p = os.path.join(frames_dir, f"{name.replace('.', '_')}_{i:02d}.png")
            (files if os.path.exists(p) else missing).append(p)
        srcs[name] = files
    if missing:
        print(f"❌ 缺 {len(missing)} 帧，例如 {missing[:5]}")
        sys.exit(1)

    target = int(target_mb * 1048576)
    for variant, F, scale, q in (("hd", 256, 2, 85), ("sd", 160, 1.25, 82)):
        k = F / data["frameW"]
        anchor = {"x": round(data["anchor"]["x"] * k), "y": round(data["anchor"]["y"] * k)}
        vdir = os.path.join(out_root, variant)
        os.makedirs(vdir, exist_ok=True)
        enc = Encoder(vdir, F, q)
        probe = os.path.join(vdir, "_probe.webp")

        small = {n: [Image.open(p).convert("RGBA").resize((F, F), LANCZOS) for p in files]
                 for n, files in srcs.items()}

        for tier, anim_names in tiers.items():
            chunks = [(n, small[n]) for n in anim_names if small[n]]
            if not chunks:
                continue
            pages = page_chunks(chunks, enc, target, probe)
            if os.path.exists(probe):
                os.remove(probe)
            for pi, page in enumerate(pages):
                suffix = "" if len(pages) == 1 else ("" if pi == 0 else f"_{pi + 1}")
                base = f"{cid}-{tier}{suffix}"
                img_path = os.path.join(vdir, base + ".webp")
                enc.encode(page, img_path)
                sz = os.path.getsize(img_path)
                animations, offset = {}, 0
                for n, frames in page:
                    animations[n] = {"frames": list(range(offset, offset + len(frames))),
                                     "fps": data["anims"][n]["fps"], "loop": data["anims"][n]["loop"]}
                    offset += len(frames)
                for an, tgt in alias.items():
                    if an in animations and tgt in animations:
                        animations[an] = dict(animations[tgt])
                meta = {"image": base + ".webp", "frameW": F, "frameH": F, "columns": enc.cols,
                        "anchor": anchor, "scale": scale, "tier": tier, "page": pi + 1,
                        "animations": animations}
                json.dump(meta, open(os.path.join(vdir, base + ".json"), "w"), ensure_ascii=False)
                print(f"{cid} {variant} {base}.webp: {offset} 帧, {sz / 1048576:.2f} MB, 动画={list(animations)}")
        del small

        # alias 跨段校验
        seg_of = {}
        for jf in os.listdir(vdir):
            if jf.endswith(".json"):
                m = json.load(open(os.path.join(vdir, jf)))
                for a in m["animations"]:
                    seg_of[a] = m["image"]
        for an, tgt in alias.items():
            if an in seg_of and tgt in seg_of and seg_of[an] != seg_of[tgt]:
                print(f"❌ alias {an}→{tgt} 跨段（{seg_of[an]} vs {seg_of[tgt]}），引擎无法解析")
                sys.exit(1)

    # segments.json 总索引
    segments = {"id": cid, "initial": ["core"], "variants": {}}
    for v in ("hd", "sd"):
        vdir = os.path.join(out_root, v)
        segs = []
        for jf in sorted(os.listdir(vdir)):
            if not jf.endswith(".json"):
                continue
            m = json.load(open(os.path.join(vdir, jf)))
            img = os.path.join(vdir, m["image"])
            segs.append({"file": f"{v}/{m['image']}", "meta": f"{v}/{jf}", "tier": m["tier"],
                         "page": m.get("page", 1), "bytes": os.path.getsize(img),
                         "anims": list(m["animations"].keys())})
        segs.sort(key=lambda s: (s["tier"], s["page"]))
        segments["variants"][v] = {
            "segments": segs,
            "total_bytes": sum(s["bytes"] for s in segs),
            "max_segment_bytes": max(s["bytes"] for s in segs),
            "under_target": max(s["bytes"] for s in segs) <= target,
        }
    json.dump(segments, open(os.path.join(out_root, "segments.json"), "w"), ensure_ascii=False, indent=2)
    for v, d in segments["variants"].items():
        print(f"{cid} {v}: 总 {d['total_bytes'] / 1048576:.2f} MB, 最大单包 {d['max_segment_bytes'] / 1048576:.2f} MB, "
              f"≤{target_mb}MB: {d['under_target']}")
    print(f"✅ {cid} 分包完成 → {out_root}")

if __name__ == "__main__":
    main()
