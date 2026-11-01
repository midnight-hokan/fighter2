#!/usr/bin/env python3
"""把 export-poses.mjs 导出的关键点画成 OpenPose 骨架图（黑底彩色骨架），作为 ControlNet 的输入。
用法：python3 scripts/art/render-poses.py art-work/poses/c01.json art-work/pose-img/c01
输出：<目录>/<动画名>_<帧序号>.png，尺寸 = frameW*scale × frameH*scale
"""
import json, os, sys
from PIL import Image, ImageDraw

LIMBS = [(1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7), (1, 8), (8, 9), (9, 10), (1, 11), (11, 12), (12, 13), (1, 0), (0, 14), (14, 16), (0, 15), (15, 17)]
COLORS = [(255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0), (170, 255, 0), (85, 255, 0), (0, 255, 0), (0, 255, 85), (0, 255, 170),
          (0, 255, 255), (0, 170, 255), (0, 85, 255), (0, 0, 255), (85, 0, 255), (170, 0, 255), (255, 0, 255), (255, 0, 170), (255, 0, 85)]

src, dst = sys.argv[1], sys.argv[2]
data = json.load(open(src))
W, H, s = data["frameW"] * data["scale"], data["frameH"] * data["scale"], data["scale"]
os.makedirs(dst, exist_ok=True)
n = 0
for name, anim in data["anims"].items():
    for i, fr in enumerate(anim["frames"]):
        im = Image.new("RGB", (W, H), (0, 0, 0))
        d = ImageDraw.Draw(im)
        kp = fr["keypoints"]
        for li, (a, b) in enumerate(LIMBS):
            d.line([tuple(kp[a][:2]), tuple(kp[b][:2])], fill=COLORS[li % 18], width=max(4, s))
        for ki, (x, y, c) in enumerate(kp):
            r = max(4, s)
            d.ellipse([x - r, y - r, x + r, y + r], fill=COLORS[ki])
        im.save(os.path.join(dst, f"{name.replace('.', '_')}_{i:02d}.png"))
        n += 1
print(f"{data['id']}：{n} 张骨架图 → {dst}")
