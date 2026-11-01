#!/usr/bin/env python3
"""姿势验证：骨架线残留 IoU + 角色遮罩极值 vs 骨架极值。"""
import numpy as np
from PIL import Image
from rembg import remove
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
frames = ROOT / "art-work" / "frames" / "c01"
poses = ROOT / "art-work" / "pose-img" / "c01"
print(f"{'frame':18s} {'白IoU':>7s} {'角色右x':>7s} {'骨架右x':>7s} {'角色上y':>7s} {'骨架上y':>7s}  判定")
for f in sorted(frames.glob("*.png")):
    pose = poses / f.name
    if not pose.exists():
        continue
    fm = np.array(Image.open(f).convert("RGB"))
    pm = np.array(Image.open(pose).convert("RGB"))
    pwhite = pm.max(axis=2) > 100
    fwhite = (fm > 240).all(axis=2)
    inter = np.logical_and(fwhite, pwhite).sum()
    union = np.logical_or(fwhite, pwhite).sum()
    iou = inter / union if union else 0.0
    mask = np.array(remove(Image.open(f)).convert("L")) > 128
    ys, xs = np.where(mask)
    fmaxx, fminy = int(xs.max()), int(ys.min())
    pys, pxs = np.where(pwhite)
    pmaxx, pminy = int(pxs.max()), int(pys.min())
    notes = []
    if iou > 0.08:
        notes.append("骨架残留!")
    if fmaxx < pmaxx - 120:
        notes.append("前伸不够")
    if fminy < pminy - 80:
        notes.append("高出骨架(悬空?)")
    print(f"{f.name:18s} {iou:7.3f} {fmaxx:7d} {pmaxx:7d} {fminy:7d} {pminy:7d}  {' '.join(notes) or 'OK'}")
