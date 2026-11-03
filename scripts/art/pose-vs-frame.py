#!/usr/bin/env python3
"""pose-vs-frame.py — pose 骨架控制图 vs 生成帧 对比，定位"动作没跟上"根因
（骨架线本身画错 vs 模型没跟骨架线）。

用法：python3 scripts/art/pose-vs-frame.py <cid> <fn> [<fn> ...]
输出：.check/pose-vs-frame/<cid>-<fn>.png（左=pose骨架控制，右=生成帧）
"""
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, ".check", "pose-vs-frame")


def main():
    cid = sys.argv[1]
    fns = sys.argv[2:]
    os.makedirs(OUT, exist_ok=True)
    S = 300
    for fn in fns:
        pp = os.path.join(ROOT, "art-work", "pose-img", cid, fn)
        fp = os.path.join(ROOT, "art-work", "frames", cid, fn)
        if not (os.path.exists(pp) and os.path.exists(fp)):
            print(f"{cid}/{fn}: pose={os.path.exists(pp)} frame={os.path.exists(fp)}", flush=True)
            continue
        pose = Image.open(pp).convert("RGB").resize((S, S), Image.Resampling.NEAREST)
        frame = Image.open(fp).convert("RGBA").resize((S, S), Image.Resampling.LANCZOS)
        sheet = Image.new("RGB", (S * 2 + 16, S + 30), (20, 22, 26))
        d = ImageDraw.Draw(sheet)
        d.text((6, 6), f"POSE 骨架控制 {cid}/{fn}", fill=(255, 220, 120))
        d.text((S + 10, 6), f"生成帧", fill=(120, 220, 120))
        sheet.paste(pose, (0, 28))
        sheet.paste(frame, (S + 16, 28), frame)
        out = os.path.join(OUT, f"{cid}-{fn[:-4]}.png")
        sheet.save(out)
        print(f"{cid}/{fn} → {out}", flush=True)


if __name__ == "__main__":
    main()
