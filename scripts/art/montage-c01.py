#!/usr/bin/env python3
"""拼 docs/art-review/c01-frames.png：idle/walkf/st.hp/cr.hk 全帧 + 每个必杀技 3 帧，供 Claude 看图。"""
import json
from PIL import Image, ImageDraw

ROOT = "/home/yuguang/projects/fighter2"
data = json.load(open(f"{ROOT}/art-work/poses/c01.json"))
F = 128
LBL = 150

# (动画名, 帧索引列表)
rows = [
    ("idle", list(range(6))),
    ("walkf", list(range(8))),
    ("st.hp", list(range(7))),
    ("cr.hk", list(range(8))),
    ("meiyan", [0, 3, 6]),
    ("chongtian", [0, 3, 6]),
    ("xuanfeng", [0, 3, 6]),
    ("dihuolong", [0, 3, 6]),
]
maxw = max(len(ix) for _, ix in rows)
W = LBL + maxw * F
H = len(rows) * (F + 8) + 8
sheet = Image.new("RGBA", (W, H), (40, 40, 48, 255))
dr = ImageDraw.Draw(sheet)
for r, (anim, idxs) in enumerate(rows):
    y = 8 + r * (F + 8)
    dr.text((10, y + F // 2 - 8), anim, fill=(255, 220, 120))
    for c, i in enumerate(idxs):
        p = f"{ROOT}/art-work/frames/c01/{anim.replace('.', '_')}_{i:02d}.png"
        im = Image.open(p).convert("RGBA").resize((F, F), Image.LANCZOS)
        sheet.paste(im, (LBL + c * F, y), im)
sheet.convert("RGB").save(f"{ROOT}/docs/art-review/c01-frames.png", optimize=True)
print("saved", W, "x", H)
