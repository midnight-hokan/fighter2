#!/usr/bin/env python3
"""把一个角色的全部动作帧拼成 atlas.png + atlas.json，并登记到 public/assets/manifest.json。
用法：python3 scripts/art/pack-atlas.py art-work/poses/c01.json art-work/frames/c01 [--theme meilong] [--frame 128]
帧目录里的文件名与 render-poses.py 一致：<动画名把.换成_>_<两位帧号>.png，透明背景 RGBA，任意分辨率（与骨架图同比例）。
缩到 frame×frame（默认 128，锚点按 poses json 里的 anchor），输出到 public/assets/<主题>/<角色id>/。
"""
import json, os, sys, math
from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opt = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
poses_path, frames_dir = args[0], args[1]
theme = opt("--theme", "meilong")
data = json.load(open(poses_path))
cid = data["id"]
F = int(opt("--frame", data["frameW"]))
k = F / data["frameW"]
anchor = {"x": round(data["anchor"]["x"] * k), "y": round(data["anchor"]["y"] * k)}

cells, animations, missing = [], {}, []
for name, anim in data["anims"].items():
    idx = []
    for i in range(len(anim["frames"])):
        p = os.path.join(frames_dir, f"{name.replace('.', '_')}_{i:02d}.png")
        if not os.path.exists(p):
            missing.append(p)
            continue
        im = Image.open(p).convert("RGBA").resize((F, F), Image.LANCZOS)
        idx.append(len(cells))
        cells.append(im)
    if idx:
        animations[name] = {"frames": idx, "fps": anim["fps"], "loop": anim["loop"]}
if missing:
    print(f"⚠️ 缺 {len(missing)} 帧，例如 {missing[:3]}")

cols = 16
rows = math.ceil(len(cells) / cols)
sheet = Image.new("RGBA", (cols * F, rows * F), (0, 0, 0, 0))
for i, im in enumerate(cells):
    sheet.paste(im, ((i % cols) * F, (i // cols) * F))
out = f"public/assets/{theme}/{cid}"
os.makedirs(out, exist_ok=True)
sheet.save(f"{out}/atlas.png", optimize=True)
json.dump({"image": "atlas.png", "frameW": F, "frameH": F, "columns": cols, "anchor": anchor, "animations": animations},
          open(f"{out}/atlas.json", "w"), ensure_ascii=False)

mpath = "public/assets/manifest.json"
m = json.load(open(mpath)) if os.path.exists(mpath) else {}
m.setdefault(theme, {})[cid] = f"assets/{theme}/{cid}/atlas.json"
json.dump(m, open(mpath, "w"), ensure_ascii=False, indent=2)
print(f"{cid}：{len(cells)} 帧、{len(animations)} 个动画 → {out}/atlas.png（{sheet.width}×{sheet.height}），已登记 manifest")
