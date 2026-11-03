#!/usr/bin/env python3
"""A1 G 项修复：清除半透明绿幕残留鬼影（2026-11-03 抽视检发现）。

现象：抠图后帧内残留半透明绿色团块（alpha 8~200、绿色主导、面积 >200px 的连通域），
悬浮在肢体旁/腿间，肉眼看像"脱离的部件"。G 项按 idle_00 基线+delta 判定，
这类团块不超阈值但视觉脏，需单独清除。

策略：
  1. 半透明区 alpha ∈ (8, 200)
  2. 绿色主导：G > max(R,B) + 12
  3. 连通域面积 > 200px → 整域 alpha 置 0（擦除）
  4. 边缘细碎（<200px）→ 只去绿偏色不动 alpha（despill：G' = max(R,B)）

用法：
  python3 scripts/art/fix-ghost.py all           # 8 人全扫全修
  python3 scripts/art/fix-ghost.py c01 c02       # 指定角色
  python3 scripts/art/fix-ghost.py all --dry-run # 只报告
输出：.check/fix-ghost-report.json（每帧擦除的域数/像素数）
"""
import json
import os
import sys
import time

import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_dilation

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, "art-work", "frames")
CHK = os.path.join(ROOT, ".check")

A_LO, A_HI = 8, 200       # 半透明 alpha 范围
G_DOM = 12                # 绿色主导阈值
BIG_AREA = 200            # 大域面积阈值（px）
FIXED = os.path.join(ROOT, "art-work", "fixed")  # 修复输出目录（INBOX 2026-11-03：不碰原帧）


def load_palette_greens(cid):
    """从立绘抠图提取该角色本有的绿色（排除 c07 绿围裙 / c04 黄绿背心等合法绿，
    防止 fix-ghost 误擦角色自带绿色）。判据与 frame-qc.py 一致：
    立绘抠图 A>128 且 G-max(R,B)>30 的像素，量化 16 级取主色。"""
    p = os.path.join(ROOT, "art-work", "portrait-cutout", f"{cid}.cutout.png")
    if not os.path.exists(p):
        return np.zeros((0, 3), dtype=np.int16)
    im = np.array(Image.open(p).convert("RGBA"))[::4, ::4]
    m = im[:, :, 3] > 128
    R, G, B = (im[:, :, i].astype(np.int16) for i in range(3))
    gm = m & (G - np.maximum(R, B) > 30)
    cols = im[gm][:, :3]
    if len(cols) < 20:
        return np.zeros((0, 3), dtype=np.int16)
    q = (cols // 16).astype(np.int32)
    keys, counts = np.unique(q, axis=0, return_counts=True)
    out = []
    for i in np.argsort(-counts):
        if counts[i] < 10:
            break
        out.append(keys[i] * 16 + 8)
        if len(out) >= 24:
            break
    return np.array(out, dtype=np.int16)


def process(cid: str, dry_run: bool = False, apply: bool = False,
            src: "str | None" = None):
    fdir = os.path.join(src, cid) if src else os.path.join(ART, cid)
    outdir = os.path.join(FIXED, cid)
    palette = load_palette_greens(cid)
    rows = []
    n_frames = 0
    for fn in sorted(os.listdir(fdir)):
        if not fn.endswith(".png"):
            continue
        p = os.path.join(fdir, fn)
        im = np.array(Image.open(p).convert("RGBA"))
        a = im[:, :, 3]
        rgb = im[:, :, :3].astype(np.int16)
        semi = (a > A_LO) & (a < A_HI)
        if not semi.any():
            continue
        green = (rgb[:, :, 1] > np.maximum(rgb[:, :, 0], rgb[:, :, 2]) + G_DOM)
        # 调色板保护（INBOX 2026-11-03）：排除接近立绘合法色的绿，
        # 防止误擦角色自带绿（c07 绿围裙 / c04 黄绿背心 / c06 等）
        if len(palette) > 0:
            cand_all = semi & green
            ys, xs = np.nonzero(cand_all)
            cols = rgb[ys, xs]
            legit = np.zeros(len(cols), bool)
            for c in palette:
                legit |= (np.abs(cols - c).sum(axis=1) < 70)
            protected = np.zeros_like(green)
            protected[ys, xs] = legit
            green = green & ~protected
        cand = semi & green
        if not cand.any():
            continue
        lab, n = label(cand)
        if n == 0:
            continue
        sizes = np.bincount(lab.ravel())
        big_ids = [i for i in range(1, n + 1) if sizes[i] > BIG_AREA]
        small_mask = np.isin(lab, [i for i in range(1, n + 1) if sizes[i] <= BIG_AREA])
        if not big_ids and not small_mask.any():
            continue
        n_frames += 1
        entry = {"frame": fn, "n_big": len(big_ids),
                 "big_px": int(sizes[big_ids].sum()) if big_ids else 0,
                 "small_px": int(small_mask.sum())}
        if not dry_run:
            out = im.copy()
            if big_ids:
                big_mask = np.isin(lab, big_ids)
                # 域外扩 1px 吃边
                big_mask = binary_dilation(big_mask, iterations=1)
                out[big_mask, 3] = 0
            if small_mask.any():
                sm = binary_dilation(small_mask, iterations=1)
                g = out[:, :, 1].astype(np.int16)
                rb = np.maximum(out[:, :, 0].astype(np.int16), out[:, :, 2].astype(np.int16))
                out[sm, 1] = np.clip(np.where(g[sm] > rb[sm], rb[sm], g[sm]), 0, 255).astype(np.uint8)
            if apply:
                Image.fromarray(out).save(p)          # --apply：确认无误后写回原帧
            else:
                os.makedirs(outdir, exist_ok=True)
                Image.fromarray(out).save(os.path.join(outdir, fn))  # 默认写 fixed/，不碰原帧
        rows.append(entry)
        print(f"  {cid}/{fn}: 擦除 {len(big_ids)} 域 {entry['big_px']}px, "
              f"去绿偏 {entry['small_px']}px", flush=True)
    return {"char": cid, "n_touched": len(rows), "frames": rows}


def main():
    raw_args = sys.argv[1:]
    dry_run = "--dry-run" in raw_args
    apply = "--apply" in raw_args
    src = None
    if "--src" in raw_args:
        i = raw_args.index("--src")
        src = raw_args[i + 1]
        raw_args = raw_args[:i] + raw_args[i + 2:]
    args = [a for a in raw_args if a not in ("--dry-run", "--apply")]
    cids = ([f"c0{i}" for i in range(1, 9)] if args == ["all"] else args)
    rep = {}
    t0 = time.time()
    for cid in cids:
        rep[cid] = process(cid, dry_run, apply, src)
        r = rep[cid]
        print(f"== {cid}: 触碰 {r['n_touched']} 帧, "
              f"擦除 {sum(f['big_px'] for f in r['frames'])}px", flush=True)
    json.dump({"ts": time.strftime("%F %T"), "dry_run": dry_run, "apply": apply, **rep},
              open(os.path.join(CHK, "fix-ghost-report.json"), "w"),
              ensure_ascii=False, indent=1)
    dest = "原帧(--apply)" if (apply and not dry_run) else (
        "dry-run" if dry_run else "art-work/fixed/<cid>/")
    print(f"完成（输出→{dest}），用时 {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
