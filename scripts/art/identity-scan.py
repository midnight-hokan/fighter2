#!/usr/bin/env python3
"""扫描 fixed/ 全部帧，按"动画内离群"flag 疑似 identity/损坏帧。
判据（每动画内）：
  - 颜色离群：可见像素主色 RGB 距离该动画中位主色 > COLOR_TH
  - 轮廓离群：alpha 剪影与该动画中位剪影 IoU < IOU_TH
两者都过阈才 flag（降低误报）。输出候选清单 + 每人一张候选帧拼图。
"""
import json, os, sys
import numpy as np
from PIL import Image
from collections import defaultdict

ROOT = "/home/yuguang/projects/fighter2"
FIXED = f"{ROOT}/art-work/fixed"
CHK = f"{ROOT}/.check"
COLOR_TH = 55   # RGB 欧氏距离阈值
IOU_TH = 0.55   # 剪影 IoU 阈值（低于则形状差异大）
ALPHA_TH = 100

def load(fp):
    return np.array(Image.open(fp).convert("RGBA"))

def vis_color(im):
    a = im[:, :, 3]
    v = im[a > ALPHA_TH]
    if len(v) < 50:
        return None
    return v[:, :3].mean(axis=0)

def vis_mask(im):
    return im[:, :, 3] > ALPHA_TH

def iou(m1, m2):
    inter = (m1 & m2).sum()
    union = (m1 | m2).sum()
    return inter / union if union else 0.0

chars = [f"c0{i}" for i in range(1, 9)]
out = {}
for cid in chars:
    poses = json.load(open(f"{ROOT}/art-work/poses/{cid}.json"))
    fdir = os.path.join(FIXED, cid)
    # 按动画分组
    byanim = defaultdict(list)
    for name, anim in poses["anims"].items():
        for i in range(len(anim["frames"])):
            fn = f"{name.replace('.', '_')}_{i:02d}.png"
            fp = os.path.join(fdir, fn)
            if os.path.exists(fp):
                byanim[name].append((fn, fp))
    flagged = []
    for anim, frs in byanim.items():
        if len(frs) < 2:
            continue
        ims = {}
        cols = []
        for fn, fp in frs:
            im = load(fp)
            ims[fn] = im
            c = vis_color(im)
            if c is not None:
                cols.append((fn, c))
        if len(cols) < 2:
            continue
        # 中位主色
        med = np.median(np.array([c for _, c in cols]), axis=0)
        # 中位剪影（用各帧 mask 的像素级多数投票近似中位）
        H, W = list(ims[frs[0][0]].shape[:2])
        vote = np.zeros((H, W), dtype=np.int32)
        for fn, _ in frs:
            vote += vis_mask(ims[fn]).astype(np.int32)
        medmask = vote >= (len(frs) // 2)
        for fn, _ in frs:
            im = ims[fn]
            c = vis_color(im)
            cd = float(np.linalg.norm(c - med)) if c is not None else 0.0
            io = iou(vis_mask(im), medmask)
            if cd > COLOR_TH and io < IOU_TH:
                flagged.append({"frame": fn, "anim": anim,
                                "color_dist": round(cd, 1), "iou": round(io, 3)})
    out[cid] = flagged
    print(f"{cid}: flag {len(flagged)} 帧", flush=True)

json.dump(out, open(f"{CHK}/identity-scan.json", "w"), ensure_ascii=False, indent=1)
tot = sum(len(v) for v in out.values())
print(f"\n== 共 flag {tot} 帧 → {CHK}/identity-scan.json ==")
for cid in chars:
    for f in out[cid]:
        print(f"  {cid}/{f['frame']}  anim={f['anim']} color_dist={f['color_dist']} iou={f['iou']}")
