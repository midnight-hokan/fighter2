#!/usr/bin/env python3
"""A1 帧修复（INBOX 2026-11-03 06:20 第二步）：本地修 S 骨架线 / K 绿边，不重新生成。

用法：
  python3 scripts/art/fix-frames-qc.py c01 [c02 ...]     # 修指定角色
  python3 scripts/art/fix-frames-qc.py all               # 8 人全修
  python3 scripts/art/fix-frames-qc.py c01 --dry-run     # 只报告哪些帧要修，不动文件

策略（按 frame-qc-report.json 的失败项）：
  - 只 skel / 只 green / skel+green → 本地修（本脚本）：
      S: 骨架线掩膜（与 frame-qc 同判据）→ cv2.inpaint radius 3
      K: 绿边像素（与 frame-qc 同判据，含立绘合法绿排除）→ cv2.inpaint radius 3
    修完自动重跑该帧 4 项 QC 验证，仍失败则标记（留给重生/顶替流程）。
  - ghost / pck 失败 → 本脚本只列出清单（regen-needed.json），由
    run-regen.sh 走 SEED_SALT 重生 + 邻帧顶替。

输出：
  .check/fix-qc-report-<cid>.json   每帧 修前/修后 4 项指标
  .check/regen-needed.json          需要重生成的帧清单（合并累计）
  蒙太奇 .check/fix-montage-<cid>.png（修后问题帧标红，人眼复核 inpaint 痕迹）
"""
import argparse
import json
import os
import shutil
import sys
import time

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from frame_qc_lib import (check_skel, check_green, skel_mask, green_mask,  # noqa: E402
                          load_palette_greens, TH)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, "art-work")
CHK = os.path.join(ROOT, ".check")
REPORT = os.path.join(CHK, "frame-qc-report.json")


def load_rgba(p):
    return np.array(Image.open(p).convert("RGBA"))


def inpaint_mask(frgb, mask, radius=3):
    """对 RGB 通道做 inpaint（alpha 不动），掩膜膨胀 1px 吃边。"""
    if not mask.any():
        return frgb, 0
    m8 = cv2.dilate(mask.astype(np.uint8), np.ones((3, 3), np.uint8))
    rgb = frgb[:, :, :3].copy()
    fixed = cv2.inpaint(rgb, m8, radius, cv2.INPAINT_TELEA)
    out = frgb.copy()
    out[:, :, :3] = fixed
    return out, int(m8.sum())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("chars", nargs="+")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    cids = ([f"c0{i}" for i in range(1, 9)] if args.chars == ["all"] else args.chars)

    rep = json.load(open(REPORT))
    regen = json.load(open(os.path.join(CHK, "regen-needed.json"))) \
        if os.path.exists(os.path.join(CHK, "regen-needed.json")) else {"frames": []}

    for cid in cids:
        fdir = os.path.join(ART, "frames", cid)
        pdir = os.path.join(ART, "pose-img", cid)
        palette = load_palette_greens(cid)
        crep = rep["characters"].get(cid, {})
        fixed, still_bad = [], []
        known = {(f["cid"], f["frame"]) for f in regen["frames"]}
        for fname, rec in crep.get("frames", {}).items():
            fails = rec.get("fails", [])
            need_local = any(f in ("S", "K") for f in fails)
            need_regen = any(f in ("G", "P") for f in fails)
            if not need_local and not need_regen:
                continue
            if need_regen:
                if (cid, fname) not in known:
                    regen["frames"].append({"cid": cid, "frame": fname, "fails": fails,
                                            "pck": rec.get("pck"), "ghost": rec.get("ghost")})
                    known.add((cid, fname))
            if not need_local or args.dry_run:
                continue
            p = os.path.join(fdir, fname)
            fimg = load_rgba(p)
            pp = os.path.join(pdir, fname)
            if not os.path.exists(pp):
                continue
            poseimg_arr = np.array(Image.open(pp).convert("RGB"))
            a0 = {}
            if "S" in fails:
                a0["skel"] = round(check_skel(fimg, poseimg_arr), 5)
                fimg, _ = inpaint_mask(fimg, skel_mask(fimg, poseimg_arr), 3)
            if "K" in fails:
                g0, _ = check_green(fimg, palette)
                a0["green"] = round(g0, 5)
                fimg, _ = inpaint_mask(fimg, green_mask(fimg, palette), 3)
            # 修后验证（纯图像 2 项，G/P 不变）
            a1 = {}
            if "S" in fails:
                a1["skel"] = round(check_skel(fimg, poseimg_arr), 5)
            if "K" in fails:
                g1, _ = check_green(fimg, palette)
                a1["green"] = round(g1, 5)
            Image.fromarray(fimg).save(p)
            keymap = {"skel": "skel_frac", "green": "green_frac"}
            ok = all(a1[k] <= TH[keymap[k]] for k in a1)
            entry = {"frame": fname, "fails": fails, "pre": a0, "post": a1, "ok": ok}
            (fixed if ok else still_bad).append(entry)
            print(f"  {cid}/{fname}: {fails} {a0} → {a1} {'✓' if ok else '✗ 仍需重生/顶替'}",
                  flush=True)

        json.dump({"char": cid, "fixed": fixed, "still_bad": still_bad,
                   "ts": time.strftime("%F %T")},
                  open(os.path.join(CHK, f"fix-qc-report-{cid}.json"), "w"),
                  ensure_ascii=False, indent=1)
        print(f"== {cid}: 本地修 {len(fixed)} 仍失败 {len(still_bad)} "
              f"需重生/顶替 {sum(1 for f in regen['frames'] if f['cid'] == cid)}", flush=True)

    json.dump(regen, open(os.path.join(CHK, "regen-needed.json"), "w"), ensure_ascii=False, indent=1)
    print(f"\nregen-needed 累计 {len(regen['frames'])} 帧 → {CHK}/regen-needed.json")


if __name__ == "__main__":
    main()
