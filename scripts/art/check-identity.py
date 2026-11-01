#!/usr/bin/env python3
"""程序化身份检查：抠出角色，比配色（金黄腰带/黑褂/黑裤 vs 立绘）。"""
import sys
from collections import Counter
from pathlib import Path
import numpy as np
from PIL import Image
from rembg import remove

REF = Path.home() / "projects/fighter2/docs/art-review/c01-portrait.png"
EXP = Path.home() / "projects/fighter2/art-work/exp-c01"

def palette(p: Path):
    im = Image.open(p).convert("RGB")
    cut = remove(im)  # RGBA
    a = np.array(cut)
    mask = a[:, :, 3] > 160
    if mask.sum() < 500:
        return None, 0
    rgb = a[:, :, :3][mask]
    # 量化到 32 的倍数，数主色
    q = (rgb // 24 * 24)
    cnt = Counter(map(tuple, q[::7]))
    total = cnt.total()
    top = [(f"#{r:02x}{g:02x}{b:02x}", round(c / total * 100)) for (r, g, b), c in cnt.most_common(6)]
    return top, int(mask.mean() * 100)

def gold_ratio(p: Path):
    """金黄腰带像素占比（R>180, G>140, B<140 且 R>G>B）"""
    im = Image.open(p).convert("RGB")
    cut = remove(im)
    a = np.array(cut)
    mask = a[:, :, 3] > 160
    rgb = a[:, :, :3][mask].astype(int)
    if len(rgb) == 0:
        return 0.0
    sel = (rgb[:, 0] > 180) & (rgb[:, 1] > 130) & (rgb[:, 1] < 220) & (rgb[:, 2] < 150) & (rgb[:, 0] > rgb[:, 2])
    return round(sel.sum() / len(rgb) * 100, 1)

def black_ratio(p: Path):
    im = Image.open(p).convert("RGB")
    cut = remove(im)
    a = np.array(cut)
    mask = a[:, :, 3] > 160
    rgb = a[:, :, :3][mask].astype(int)
    if len(rgb) == 0:
        return 0.0
    sel = (rgb[:, 0] < 70) & (rgb[:, 1] < 70) & (rgb[:, 2] < 70)
    return round(sel.sum() / len(rgb) * 100, 1)

def main():
    print("== 立绘（参照）==")
    top, cov = palette(REF)
    print(f"  覆盖率{cov}% 主色: {top}  金黄比={gold_ratio(REF)}% 黑比={black_ratio(REF)}%")
    print()
    for f in sorted(EXP.glob("*.png")):
        top, cov = palette(f)
        print(f"{f.name:32s} 覆盖率{cov}% 金黄比={gold_ratio(f):5}% 黑比={black_ratio(f):5}% 主色: {top[:4]}")

if __name__ == "__main__":
    main()
