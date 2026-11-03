#!/usr/bin/env python3
"""A1 P 判据校准辅助：从 QC 报告抽低 PCK 帧，生成"帧+目标骨架+检测点"叠加图，
人眼判定是"姿势真错"（需重生）还是"局部肢体偏差"（可放阈值）。

用法：python3 scripts/art/p-debug-overlay.py [pck_max=0.5] [max_n=8]
输出：/tmp/pband/<cid>__<frame>__pck<x.xx>.png
      绿圈=对齐正确点  红圈+红线=偏差点  蓝小圈=检测点原位置
"""
import importlib.util
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts", "art"))
spec = importlib.util.spec_from_file_location(
    "fq", os.path.join(ROOT, "scripts", "art", "frame-qc.py"))
assert spec is not None and spec.loader is not None
fq = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fq)


def main():
    pck_max = float(sys.argv[1]) if len(sys.argv) > 1 else 0.5
    max_n = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    rep = json.load(open(os.path.join(ROOT, ".check", "frame-qc-report.json")))
    dwp = fq.DWPose()
    out = "/tmp/pband"
    os.makedirs(out, exist_ok=True)

    # 收集 PCK < pck_max 的帧，按 PCK 升序，最多 max_n 张
    cands = []
    for cid, cd in rep["characters"].items():
        for fn, rec in cd.get("frames", {}).items():
            p = rec.get("pck")
            if p is not None and p < pck_max:
                cands.append((p, cid, fn))
    cands.sort()
    picked = cands[:max_n]
    print(f"PCK<{pck_max} 共 {len(cands)} 帧，取最低 {len(picked)} 张")

    for p, cid, fn in picked:
        fimg = np.array(Image.open(os.path.join(ROOT, "art-work", "frames", cid, fn)).convert("RGBA"))
        poses = json.load(open(os.path.join(ROOT, "art-work", "poses", f"{cid}.json")))
        target = None
        for name, anim in poses["anims"].items():
            if name.replace(".", "_") == fn.rsplit("_", 1)[0]:
                idx = int(fn.rsplit("_", 1)[1][:-4])
                if idx < len(anim["frames"]):
                    target = anim["frames"][idx]["keypoints"]
        if target is None:
            continue
        alpha = fimg[:, :, 3:4].astype(np.float32) / 255
        rgb = fimg[:, :, :3].astype(np.float32)
        bgr = cv2.cvtColor((rgb * alpha + 255 * (1 - alpha)).astype(np.uint8),
                           cv2.COLOR_RGB2BGR)
        boxes = dwp.detect(bgr)
        box = boxes[np.argmax((boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1]))]
        kps, scores = dwp.estimate(bgr, [box])
        kps, scores = kps[0], scores[0]
        ci_map = fq._assign_coco(kps, scores, target)
        pairs = [(ti, ci) for ti, ci in ci_map.items() if ci is not None]
        ys = [target[i][1] for i in fq.BODY_IDS]
        H = max(ys) - min(ys)
        src = np.array([kps[ci] for _, ci in pairs], dtype=np.float64)
        dst = np.array([np.asarray(target[ti], dtype=np.float64)[:2] for ti, _ in pairs])
        s, t = fq._procrustes(src, dst)
        tol = 0.1 * H
        vis = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
        dr = ImageDraw.Draw(vis)
        # 目标骨架连线（灰底参考）
        for (ti, ci) in pairs:
            d = np.asarray(target[ti], dtype=np.float64)[:2]
            e = kps[ci]
            ok = np.hypot(*(s * e + t - d)) <= tol
            color = (0, 200, 0) if ok else (255, 40, 40)
            dr.ellipse([d[0] - 9, d[1] - 9, d[0] + 9, d[1] + 9], outline=color, width=4)
            dr.ellipse([e[0] - 5, e[1] - 5, e[0] + 5, e[1] + 5], outline=(60, 60, 255), width=2)
            dr.line([d[0], d[1], e[0], e[1]], fill=color, width=2)
        vis = vis.resize((512, 512))
        op = os.path.join(out, f"{cid}__{fn}__pck{p:.2f}.png")
        vis.save(op)
        print(f"  {op}")


if __name__ == "__main__":
    main()
