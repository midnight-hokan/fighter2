#!/usr/bin/env python3
# 用新参考（BiRefNet 抠图）复检所有已有帧（完整 verify()），报告因参考变化而新不合格的帧。
# 目的：改参考不能让已提交/已生成帧复检变不合格而不报（光哥 2026-11-02 指令）。
import json
import sys
import numpy as np
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_frames import verify, POSES, POSE_IMG, FRAMES  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent
CUT_DIR = ROOT / "art-work" / "portrait-cutout"


def ref_new(rgba):
    im = rgba[:, :, :3].astype(float)
    H, W = im.shape[:2]
    char = rgba[:, :, 3] > 200
    yy, xx = np.mgrid[0:H, 0:W]
    char &= (yy > H * 0.05) & (yy < H * 0.98) & (xx > W * 0.05) & (xx < W * 0.95)
    ys, xs = np.where(char)
    if len(ys) < 500:
        return None, None
    y0, y1 = ys.min(), ys.max()
    bh = max(1, y1 - y0)
    pmean = im[char, :3].mean(axis=0)
    helmet = char & (yy < y0 + 0.20 * bh)
    phelmet = im[helmet, :3].mean(axis=0) if helmet.sum() > 100 else pmean
    return pmean, phelmet


for i in range(1, 9):
    cid = "c0%d" % i
    frames_dir = FRAMES / cid
    raw_dir = frames_dir / "raw"
    data = json.load(open(POSES / (cid + ".json")))
    cutout = CUT_DIR / (cid + ".cutout.png")
    if not cutout.exists():
        print("%s: 无抠图，跳过" % cid, flush=True)
        continue
    rgba = np.array(Image.open(cutout).convert("RGBA"))
    pstats = ref_new(rgba)
    ref_frame = frames_dir / "idle_00.png"
    height_ref = None
    if ref_frame.exists():
        a = np.array(Image.open(ref_frame).convert("RGBA"))[:, :, 3]
        ys, xs = np.where(a > 200)
        if len(ys):
            height_ref = int(ys.max() - ys.min() + 1)
    fails = []
    total = 0
    for a, anim in data["anims"].items():
        safe = a.replace(".", "_")
        for idx in range(len(anim["frames"])):
            out = frames_dir / (safe + "_%02d.png" % idx)
            raw = raw_dir / (safe + "_%02d.png" % idx)
            pose = POSE_IMG / cid / (safe + "_%02d.png" % idx)
            if not (out.exists() and raw.exists() and pose.exists()):
                continue
            total += 1
            is_ref = (a == "idle" and idx == 0)
            hm = "none" if is_ref else "loose"
            good, why, bh = verify(raw, out, pose, pstats, height_ref, hm, anim_name=a)
            if not good:
                fails.append((out.name, "; ".join(why)))
    print("=" * 54, flush=True)
    print("%s: 已有 %d 帧，新参考下不合格 %d 帧" % (cid, total, len(fails)), flush=True)
    for name, why in fails:
        print("   FAIL %s [%s]" % (name, why), flush=True)
print("DONE", flush=True)
