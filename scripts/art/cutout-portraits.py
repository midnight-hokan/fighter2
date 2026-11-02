#!/usr/bin/env python3
# 8 张定稿立绘走 BiRefNet 抠图 -> art-work/portrait-cutout/<cid>.cutout.png
# 并打印参考色改前/改后对比（头盔色 + 主色）：
#   旧 = 背景减法（现 portrait_stats 逻辑，逐行复刻）
#   新 = BiRefNet 抠图 alpha（与帧抠图同法，修 c04 白盔被整块漏掉的标定 bug）
# 用法：python3 scripts/art/cutout-portraits.py
import json
import time
import shutil
import requests
import sys
import numpy as np
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_frames import API, BIREFNET, _out_path  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent
UPLOAD = Path.home() / "ComfyUI" / "input"
PORTRAIT_DIR = ROOT / "docs" / "art-review"
OUT_DIR = ROOT / "art-work" / "portrait-cutout"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def wf(portrait_name, cid):
    return {
        "1": {"class_type": "LoadImage", "inputs": {"image": portrait_name}},
        "2": {"class_type": "LoadBackgroundRemovalModel", "inputs": {"bg_removal_name": BIREFNET}},
        "3": {"class_type": "RemoveBackground", "inputs": {"bg_removal_model": ["2", 0], "image": ["1", 0]}},
        "4": {"class_type": "InvertMask", "inputs": {"mask": ["3", 0]}},
        "5": {"class_type": "JoinImageWithAlpha", "inputs": {"image": ["1", 0], "alpha": ["4", 0]}},
        "6": {"class_type": "SaveImage", "inputs": {"images": ["5", 0], "filename_prefix": "f2pc_" + cid}},
    }


def run(w, prefix, timeout_min=6):
    r = requests.post(API + "/prompt", json={"prompt": w, "client_id": "f2_cutout"})
    j = r.json()
    if "error" in j:
        raise RuntimeError("QUEUE ERROR " + json.dumps(j, ensure_ascii=False)[:500])
    pid = j["prompt_id"]
    t0 = time.time()
    while time.time() - t0 < timeout_min * 60:
        time.sleep(2)
        h = requests.get(API + "/history/" + pid).json()
        if pid in h:
            st = h[pid].get("status", {})
            if st.get("status_str") == "error":
                raise RuntimeError("CUTOUT ERROR " + json.dumps(st.get("messages"), ensure_ascii=False)[:300])
            for o in h[pid].get("outputs", {}).values():
                for im in o.get("images", []):
                    if im["filename"].startswith(prefix):
                        return _out_path(im)
    raise RuntimeError("TIMEOUT cutout " + prefix)


def ref_old(im):
    """现 portrait_stats：背景减法（dist>40，中心限制，top20%=头盔）。"""
    H, W = im.shape[:2]
    corners = [im[:40, :40], im[:40, -40:], im[-40:, :40], im[-40:, -40:]]
    bg = np.concatenate([x.reshape(-1, 3) for x in corners]).mean(axis=0)
    dist = np.linalg.norm(im - bg, axis=2)
    char = dist > 40
    yy, xx = np.mgrid[0:H, 0:W]
    char &= (yy > H * 0.08) & (yy < H * 0.95) & (xx > W * 0.1) & (xx < W * 0.9)
    if char.sum() < 2000:
        char = dist > 25
        char &= (yy > H * 0.08) & (yy < H * 0.95) & (xx > W * 0.1) & (xx < W * 0.9)
    ys, xs = np.where(char)
    y0, y1 = ys.min(), ys.max()
    bh = max(1, y1 - y0)
    pmean = im[char, :3].mean(axis=0)
    helmet = char & (yy < y0 + 0.20 * bh)
    phelmet = im[helmet, :3].mean(axis=0) if helmet.sum() > 100 else pmean
    return pmean, phelmet


def ref_new(rgba):
    """新参考：BiRefNet 抠图 alpha（中心限制去杂点，top20%=头盔）。"""
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


def rgb(v):
    return "[%d,%d,%d]" % (v[0], v[1], v[2]) if v is not None else "None"


def delta(a, b):
    if a is None or b is None:
        return "n/a"
    return "%.0f" % np.linalg.norm(a - b)


for i in range(1, 9):
    cid = "c0%d" % i
    p = PORTRAIT_DIR / (cid + "-portrait.png")
    dst = OUT_DIR / (cid + ".cutout.png")
    if not p.exists():
        print("MISSING portrait " + str(p), flush=True)
        continue
    if not dst.exists():
        UPLOAD.mkdir(parents=True, exist_ok=True)
        shutil.copy(p, UPLOAD / p.name)
        t0 = time.time()
        src = run(wf(p.name, cid), "f2pc_" + cid)
        Image.open(src).save(dst)
        cut_msg = "(%.0fs new)" % (time.time() - t0)
    else:
        cut_msg = "(cached)"
    im = np.array(Image.open(p).convert("RGB")).astype(float)
    pm_old, ph_old = ref_old(im)
    rgba = np.array(Image.open(dst).convert("RGBA"))
    pm_new, ph_new = ref_new(rgba)
    print("=" * 62, flush=True)
    print("%s  %s" % (cid, cut_msg), flush=True)
    print("  主色   旧=%s  新=%s  Δ=%s" % (rgb(pm_old), rgb(pm_new), delta(pm_old, pm_new)), flush=True)
    print("  头盔色 旧=%s  新=%s  Δ=%s" % (rgb(ph_old), rgb(ph_new), delta(ph_old, ph_new)), flush=True)
print("=" * 62, flush=True)
print("ALL DONE", flush=True)
