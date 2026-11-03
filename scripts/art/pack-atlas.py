#!/usr/bin/env python3
"""把一个角色的全部动作帧拼成 atlas.png + atlas.json，并登记到 public/assets/manifest.json。
用法：python3 scripts/art/pack-atlas.py art-work/poses/c01.json art-work/frames/c01 [--theme meilong] [--frame 128]
     v3（当前）：python3 scripts/art/pack-atlas.py art-work/poses/c01.json art-work/frames/c01 --v3
帧目录里的文件名与 render-poses.py 一致：<动画名把.换成_>_<两位帧号>.png，透明背景 RGBA，任意分辨率（与骨架图同比例）。
缩到 frame×frame（默认 128，锚点按 poses json 里的 anchor），输出到 public/assets/<主题>/<角色id>/。
"""
import json, os, sys, math
from PIL import Image

if "--v3" in sys.argv:
    # v3（2026-11-04）：动画清单冻结版。输入同上（<动画名>_<两位帧号>.png，1024×1024，锚点与骨架一致）。
    # 输出两套 WebP 图集：
    #   atlas.webp / atlas.json        高清 256 像素帧，scale 2（桌面）
    #   atlas-sd.webp / atlas-sd.json  160 像素帧，scale 1.25（手机，解码后内存约为高清的 40%）
    # 骨架 json 里的 alias（中拳→轻拳等）写成指向同一组帧的动画条目。缺帧直接报错退出，不打半成品。
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opt = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
    poses_path, frames_dir = args[0], args[1]
    theme = opt("--theme", "meilong")
    data = json.load(open(poses_path))
    cid = data["id"]
    out_dir = os.path.join("public", "assets", theme, cid)
    os.makedirs(out_dir, exist_ok=True)
    srcs, order, missing = {}, [], []
    for name, anim in data["anims"].items():
        files = []
        for i in range(len(anim["frames"])):
            p = os.path.join(frames_dir, f"{name.replace('.', '_')}_{i:02d}.png")
            (files if os.path.exists(p) else missing).append(p)
        srcs[name] = files
    if missing:
        print(f"❌ 缺 {len(missing)} 帧，例如 {missing[:5]}；补齐后再打包（--v3 不打半成品）")
        sys.exit(1)
    for variant, F, scale in (("atlas", 256, 2), ("atlas-sd", 160, 1.25)):
        k = F / data["frameW"]
        anchor = {"x": round(data["anchor"]["x"] * k), "y": round(data["anchor"]["y"] * k)}
        cells, animations = [], {}
        for name, files in srcs.items():
            idx = []
            for p in files:
                idx.append(len(cells))
                cells.append(Image.open(p).convert("RGBA").resize((F, F), Image.LANCZOS))
            a = data["anims"][name]
            animations[name] = {"frames": idx, "fps": a["fps"], "loop": a["loop"]}
        for name, target in (data.get("alias") or {}).items():
            if target in animations and name not in animations:
                animations[name] = dict(animations[target])
        cols = 16
        rows = math.ceil(len(cells) / cols)
        sheet = Image.new("RGBA", (cols * F, rows * F), (0, 0, 0, 0))
        for i, im in enumerate(cells):
            sheet.paste(im, ((i % cols) * F, (i // cols) * F))
        img_name = f"{variant}.webp"
        sheet.save(os.path.join(out_dir, img_name), "WEBP", quality=85 if F == 256 else 82, method=6)
        meta = {"image": img_name, "frameW": F, "frameH": F, "columns": cols, "anchor": anchor, "scale": scale, "animations": animations}
        if F == 256:
            meta["sd"] = "atlas-sd.json"  # 手机版，运行时按需加载
        json.dump(meta, open(os.path.join(out_dir, f"{variant}.json"), "w"), ensure_ascii=False)
        mb = os.path.getsize(os.path.join(out_dir, img_name)) / 1048576
        print(f"{cid} {variant}: {len(cells)} 帧，{sheet.size[0]}×{sheet.size[1]}，{mb:.1f} MB")
        if F == 256 and mb >= 8:
            print("❌ 高清图集超过 8MB，降低 quality 后重打")
            sys.exit(1)
    old = os.path.join(out_dir, "atlas.png")
    if os.path.exists(old):
        os.remove(old)  # 旧版 PNG 图集作废，避免运行时误用
    mpath = os.path.join("public", "assets", "manifest.json")
    m = json.load(open(mpath)) if os.path.exists(mpath) else {}
    m.setdefault(theme, {})[cid] = f"assets/{theme}/{cid}/atlas.json"
    json.dump(m, open(mpath, "w"), ensure_ascii=False, indent=2)
    print(f"✅ {cid} 已打包并登记 manifest")
    sys.exit(0)

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
