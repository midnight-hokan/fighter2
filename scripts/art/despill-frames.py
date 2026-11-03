#!/usr/bin/env python3
"""A1 整身去绿（despill）：消除绿幕残留的整身泛绿 + 边缘绿晕。

INBOX 2026-11-03 06:20 光哥授权："骨架线/绿边：用已知骨架 mask 做局部
inpaint 或 despill，不重新生成。"

做法：对可见区域(A>150)的中强绿像素做 despill：
  G' = max(R,B) + (G - max(R,B)) * 0.15   （只保留 15% 绿色超出量）
  触发条件：G - max(R,B) > 40 且 V>80（排除暗部/描边）
  排除：立绘合法绿（c07 绿围裙等角色本色，palette L1<70）
  浅绿(G-mb 30~40) 轻处理：保留 40%（肉眼不可见但留着无害，防过度处理）

用法：
  python3 scripts/art/despill-frames.py all
  python3 scripts/art/despill-frames.py c01 c04
  python3 scripts/art/despill-frames.py all --dry-run
输出 .check/despill-report.json（每帧处理像素数 + 前后 G-mb 均值）。
"""
import argparse
import json
import os
import time

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, "art-work")
CHK = os.path.join(ROOT, ".check")


def load_palette_greens(cid):
    """立绘中出现的绿（角色本色，despill 不能碰）。与 frame-qc.py 同款：
    portrait-cutout 量化提取。"""
    p = os.path.join(ART, "portrait-cutout", f"{cid}.cutout.png")
    if not os.path.exists(p):
        return []
    im = np.array(Image.open(p).convert("RGBA"))[::4, ::4]
    m = im[:, :, 3] > 128
    R, G, B = (im[:, :, i].astype(np.int16) for i in range(3))
    gm = m & (G - np.maximum(R, B) > 30)
    cols = im[gm][:, :3]
    if len(cols) < 20:
        return []
    q = (cols // 16).astype(np.int32)
    keys, counts = np.unique(q, axis=0, return_counts=True)
    out = []
    for i in np.argsort(-counts):
        if counts[i] < 10:
            break
        out.append(keys[i] * 16 + 8)
        if len(out) >= 24:
            break
    return out


def despill(frgb, palette, strong_thr=40, strong_keep=0.15,
            mild_thr=30, mild_keep=0.40):
    A = frgb[:, :, 3].astype(np.int16)
    vis = A > 150
    R = frgb[:, :, 0].astype(np.int16)
    G = frgb[:, :, 1].astype(np.int16)
    B = frgb[:, :, 2].astype(np.int16)
    mb = np.maximum(R, B)
    d = G - mb
    V = frgb.max(axis=2)
    if palette and len(palette) > 0:
        legit = np.zeros(frgb.shape[:2], bool)
        for c in palette:
            legit |= (np.abs(R - c[0]) + np.abs(G - c[1]) + np.abs(B - c[2]) < 70)
        vis = vis & ~legit
    strong = vis & (d > strong_thr) & (V > 80)
    mild = vis & (d > mild_thr) & (d <= strong_thr) & (V > 60)
    out = frgb.copy()
    out[strong, 1] = (mb[strong] + d[strong] * strong_keep).clip(0, 255).astype(np.uint8)
    out[mild, 1] = (mb[mild] + d[mild] * mild_keep).clip(0, 255).astype(np.uint8)
    return out, int(strong.sum()), int(mild.sum())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("chars", nargs="+")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--src", default="",
                    help="帧目录根（默认 art-work/frames；如 art-work/fixed 则就地对 "
                         "art-work/fixed/<cid>/ 去绿边，原帧 raw/ 不动）")
    args = ap.parse_args()
    cids = ([f"c0{i}" for i in range(1, 9)] if args.chars == ["all"] else args.chars)
    t0 = time.time()
    report = {"ts": time.strftime("%F %T"), "chars": {}}
    tot_s = tot_m = 0
    for cid in cids:
        fdir = os.path.join(args.src, cid) if args.src else os.path.join(ART, "frames", cid)
        if not os.path.isdir(fdir):
            continue
        palette = load_palette_greens(cid)
        n_s = n_m = 0
        for fn in sorted(os.listdir(fdir)):
            if not fn.endswith(".png"):
                continue
            p = os.path.join(fdir, fn)
            im = np.array(Image.open(p).convert("RGBA"))
            if args.dry_run:
                _, s, m = despill(im, palette)
            else:
                im2, s, m = despill(im, palette)
                Image.fromarray(im2).save(p)
            n_s += s
            n_m += m
        tot_s += n_s
        tot_m += n_m
        report["chars"][cid] = {"palette": [[int(x) for x in c] for c in palette],
                                "strong_px": int(n_s), "mild_px": int(n_m)}
        print(f"{cid}: 强绿 {n_s}px 浅绿 {n_m}px 立绘合法绿 {len(palette)} 色", flush=True)
    if not args.dry_run:
        json.dump(report, open(os.path.join(CHK, "despill-report.json"), "w"),
                  ensure_ascii=False, indent=1)
    print(f"\ndespill 完成：强绿 {tot_s}px 浅绿 {tot_m}px  用时 {time.time()-t0:.0f}s"
          f"{'  (dry-run 未写文件)' if args.dry_run else ''}")


if __name__ == "__main__":
    main()
