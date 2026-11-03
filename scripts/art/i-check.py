#!/usr/bin/env python3
"""i-check.py — I"像待机"失败帧 vs idle_00 对比图，人工/视觉判断是真"动作没跟上"还是 IoU 误报。

用法：python3 scripts/art/i-check.py [角色...]
输出：.check/i-check/<cid>-idle-compare.png（idle_00 参考 + 该角色 I 失败帧，标 IoU）
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, ".check", "i-check")
try:
    _LANCZOS = Image.Resampling.LANCZOS
except AttributeError:
    _LANCZOS = 1

# 大幅攻击（IoU 高=真没跟上）vs 小幅攻击（IoU 高可能是边界误报）
BIG = ["st_hp", "st_hk", "cr_hk", "st_mp"]      # 重拳/重踢，动作幅度大
SMALL = ["st_lp", "st_lk", "cr_lp", "cr_lk"]    # 轻拳/轻踢，动作幅度小


def pick_i_fails(cid, frames, want, maxn):
    """挑 want 前缀的 I 失败帧，最多 maxn 张（按 IoU 降序，先看最像待机的）"""
    sel = []
    for fn, fr in frames.items():
        if "I" in fr.get("fails", []):
            anim = fn.rsplit("_", 1)[0]
            if any(fn.startswith(p + "_") for p in want):
                sel.append((fr.get("idle_iou", 0), fn))
    sel.sort(reverse=True)
    return [fn for _, fn in sel[:maxn]]


def make_sheet(cid, frames, idle_fn="idle_00.png"):
    idle = Image.open(os.path.join(ROOT, "art-work", "frames", cid, idle_fn)).convert("RGBA")
    # 大幅 + 小幅 各挑 4 张
    big = pick_i_fails(cid, frames, BIG, 4)
    small = pick_i_fails(cid, frames, SMALL, 4)
    cells = [("IDLE_00 (参考)", idle_fn, -1.0)]
    for fn in big:
        cells.append((f"{fn}  IoU={frames[fn].get('idle_iou', 0):.3f}", fn, 1.0))
    for fn in small:
        cells.append((f"{fn}  IoU={frames[fn].get('idle_iou', 0):.3f}", fn, -0.5))
    n = len(cells)
    cols = min(4, n)
    rows = (n + cols - 1) // cols
    S = 200
    pad = 8
    label_h = 26
    W = cols * (S + pad) + pad
    H = rows * (S + pad + label_h) + pad
    sheet = Image.new("RGB", (W, H), (24, 26, 30))
    d = ImageDraw.Draw(sheet)
    for i, (label, fn, kind) in enumerate(cells):
        r, c = divmod(i, cols)
        x0 = pad + c * (S + pad)
        y0 = pad + r * (S + pad + label_h)
        col = (255, 90, 90) if kind > 0 else ((120, 220, 120) if kind < 0 else (255, 220, 120))
        d.text((x0 + 2, y0), label, fill=col)
        im = Image.open(os.path.join(ROOT, "art-work", "frames", cid, fn)).convert("RGBA")
        im = im.resize((S, S), _LANCZOS)
        sheet.paste(im, (x0, y0 + label_h), im)
    return sheet


def main():
    rep = json.load(open(os.path.join(ROOT, ".check", "frame-qc-report.json")))
    chars = rep["characters"]
    args = [a for a in sys.argv[1:]]
    cids = args if args else [f"c0{i}" for i in range(1, 9)]
    os.makedirs(OUT, exist_ok=True)
    for cid in cids:
        if cid not in chars:
            continue
        frames = chars[cid]["frames"]
        n_i = sum(1 for fr in frames.values() if "I" in fr.get("fails", []))
        sheet = make_sheet(cid, frames)
        out = os.path.join(OUT, f"{cid}-idle-compare.png")
        sheet.save(out)
        print(f"{cid}: I失败 {n_i} 帧 → {out}", flush=True)


if __name__ == "__main__":
    main()
