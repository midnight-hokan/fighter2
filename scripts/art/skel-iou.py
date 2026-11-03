#!/usr/bin/env python3
"""skel-iou.py — 客观定位"动作没跟上"根因：比较 pose 骨架线与 idle 骨架线的 IoU。

对每个 I 失败帧：
  - skel_iou = 该帧骨架线 与 idle_00 骨架线 的掩膜 IoU
  - 若 skel_iou 低（骨架伸展，明显不是站姿）但生成帧 idle_iou 高（像待机）→ 模型没跟骨架线
  - 若 skel_iou 也高（骨架本身就接近站姿）→ 骨架画错 / 或启动帧正常（非误报但非缺陷）

用法：python3 scripts/art/skel-iou.py [角色...]
输出：.check/skel-iou-report.json + 打印分类
"""
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
POSE = os.path.join(ROOT, "art-work", "pose-img")
OUT = os.path.join(ROOT, ".check", "skel-iou-report.json")


def skel_mask(path):
    """骨架线掩膜：非黑非透明像素（骨架是彩色线，背景黑）"""
    im = np.array(Image.open(path).convert("RGBA"))
    if im.shape[2] == 4:
        a = im[:, :, 3]
        rgb = im[:, :, :3].astype(np.int16)
        m = (a > 30) & (rgb.max(axis=2) > 40)
    else:
        rgb = im.astype(np.int16)
        m = rgb.max(axis=2) > 40
    return m


def iou(m1, m2):
    if m1.shape != m2.shape:
        # resize m2 to m1
        from PIL import Image as I
        m2 = np.array(I.fromarray((m2 * 255).astype(np.uint8)).resize(
            (m1.shape[1], m1.shape[0]), I.Resampling.NEAREST)) > 127
    inter = (m1 & m2).sum()
    union = (m1 | m2).sum()
    return float(inter) / max(int(union), 1)


def main():
    import sys
    rep = json.load(open(os.path.join(ROOT, ".check", "frame-qc-report.json")))
    chars = rep["characters"]
    cids = [a for a in sys.argv[1:]] or [f"c0{i}" for i in range(1, 9)]
    result = {}
    for cid in cids:
        if cid not in chars:
            continue
        pdir = os.path.join(POSE, cid)
        if not os.path.isdir(pdir):
            continue
        idle_m = skel_mask(os.path.join(pdir, "idle_00.png"))
        rows = []
        for fn, fr in chars[cid]["frames"].items():
            if "I" not in fr.get("fails", []):
                continue
            pp = os.path.join(pdir, fn)
            if not os.path.exists(pp):
                rows.append({"fn": fn, "frame_idle_iou": fr.get("idle_iou"),
                             "skel_iou": None, "cls": "no-pose"})
                continue
            sm = skel_mask(pp)
            si = iou(idle_m, sm)
            fi = fr.get("idle_iou", 0)
            # 分类
            if si is None:
                cls = "no-pose"
            elif si < 0.60:
                cls = "MODEL"      # 骨架伸展但帧像待机 → 模型没跟
            elif si > 0.85:
                cls = "SKEL"       # 骨架本身就接近待机 → 骨架画错/启动帧
            else:
                cls = "MID"        # 中间态（启动/收招帧，需人工看）
            rows.append({"fn": fn, "frame_idle_iou": fi, "skel_iou": round(si, 3),
                         "cls": cls})
        result[cid] = rows
        from collections import Counter
        c = Counter(r["cls"] for r in rows)
        print(f"== {cid}: I失败 {len(rows)} 帧 → MODEL(模型没跟)={c['MODEL']} "
              f"SKEL(骨架近待机)={c['SKEL']} MID(中间态)={c['MID']} no-pose={c['no-pose']}",
              flush=True)
    json.dump(result, open(OUT, "w"), ensure_ascii=False, indent=1)
    print(f"→ {OUT}", flush=True)


if __name__ == "__main__":
    main()
