#!/usr/bin/env python3
"""校准 v2：主色覆盖率指标 + 高度比豁免集分析"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, "art-work")

def main_colors(rgba, mask, steps=16, topk=8, min_count=15):
    """top-k 主色（steps 量化），返回 [(color, weight)]"""
    px = rgba[mask][:, :3].astype(np.int32)
    if len(px) < 50:
        return []
    q = px // steps
    keys, counts = np.unique(q, axis=0, return_counts=True)
    out = []
    for i in np.argsort(-counts):
        if counts[i] < min_count:
            break
        out.append((keys[i] * steps + steps // 2, float(counts[i]) / len(px)))
        if len(out) >= topk:
            break
    return out

def coverage(frame_rgba, palette, tol=32):
    """立绘主色在帧里的覆盖率：Σ portrait_weight × frame_frac(color±tol)，截断 [0,1]"""
    A = frame_rgba[:, :, 3]
    m = A > 150
    px = frame_rgba[m][:, :3].astype(np.int32)
    if len(px) < 100 or not palette:
        return None
    score = 0.0
    for c, w in palette:
        d = np.abs(px - np.array(c)).max(axis=1)
        frac = float((d <= tol).sum()) / len(px)
        score += w * min(frac, 1.0)
    return score

def hist3d_dist(rgba1, m1, rgba2, m2, bins=4):
    def h(rgba, m):
        px = rgba[m][:, :3].astype(np.int32)
        q = px * bins // 256
        idx = q[:, 0] * bins * bins + q[:, 1] * bins + q[:, 2]
        h, _ = np.unique(idx, return_counts=True)
        out = np.zeros(bins ** 3, dtype=np.float64)
        out[h] = _
        return out / out.sum()
    return 1.0 - np.minimum(h(rgba1, m1), h(rgba2, m2)).sum()

def bbox_h(rgba):
    m = rgba[:, :, 3] > 100
    if m.sum() < 100:
        return 0
    ys = np.where(m.any(axis=1))[0]
    return int(ys.max() - ys.min() + 1)

# 候选豁免集（蹲/倒地/腾空/旋转/状态类）
EXEMPT_CAND = {"idle", "ko", "knockdown", "crouch", "crblock", "cr.hk", "cr.hp", "cr.lk",
               "cr.lp", "cr.mk", "cr.mp", "airhit", "jump", "prejump", "xuanfeng", "roll",
               "maxstart", "blockstun", "hitstun", "dizzy", "win",
               "j.hk", "j.hp", "j.lk", "j.lp", "j.mk", "j.mp"}

rows = []
for cid in [f"c0{i}" for i in range(1, 9)]:
    cut = np.array(Image.open(os.path.join(ART, "portrait-cutout", f"{cid}.cutout.png")).convert("RGBA"))
    palette = main_colors(cut, cut[:, :, 3] > 128)
    fdir = os.path.join(ART, "frames", cid)
    idle = np.array(Image.open(os.path.join(fdir, "idle_00.png")).convert("RGBA"))
    h_idle = bbox_h(idle)
    idle_pal = main_colors(idle, idle[:, :, 3] > 150)
    for fname in sorted(os.listdir(fdir)):
        if not fname.endswith(".png"):
            continue
        fimg = np.array(Image.open(os.path.join(fdir, fname)).convert("RGBA"))
        h = bbox_h(fimg)
        ratio = h / h_idle if h_idle else None
        cov = coverage(fimg, palette)
        d_idle = coverage(fimg, idle_pal)
        anim = fname.rsplit("_", 1)[0].replace("_", ".")
        rows.append((cid, fname, anim, ratio, cov, d_idle, anim in EXEMPT_CAND))

print("=== 主色覆盖率（立绘）分布 ===")
covs = sorted(r[4] for r in rows if r[4] is not None)
for p in (1, 5, 10, 25, 50, 75, 90, 95):
    print(f"  p{p}={np.percentile(covs, p):.4f}")
print("  min=", f"{min(covs):.4f}", " max=", f"{max(covs):.4f}")
print("\n覆盖率最低 20 帧:")
for cid, fname, anim, ratio, cov, d_idle, ex in sorted(rows, key=lambda r: r[4] if r[4] is not None else 9)[:20]:
    print(f"  {cid} {fname}: cov={cov:.4f} d_idle={d_idle:.4f} 豁免={ex}")
print("\n覆盖率最低 20 帧（仅非豁免）:")
for cid, fname, anim, ratio, cov, d_idle, ex in sorted([r for r in rows if not r[6] and r[4] is not None], key=lambda r: r[4])[:20]:
    print(f"  {cid} {fname}: cov={cov:.4f} d_idle={d_idle:.4f}")

print("\n=== d_idle（与本人 idle 帧主色覆盖率）分布 ===")
di = sorted(r[5] for r in rows if r[5] is not None)
for p in (1, 5, 10, 25, 50, 90, 95):
    print(f"  p{p}={np.percentile(di, p):.4f}")
print("\nd_idle 最低 20 帧（仅非豁免）:")
for cid, fname, anim, ratio, cov, d_idle, ex in sorted([r for r in rows if not r[6] and r[5] is not None], key=lambda r: r[5])[:20]:
    print(f"  {cid} {fname}: d_idle={d_idle:.4f} cov={cov:.4f}")

print("\n=== 高度比：非豁免帧超出 [0.85,1.15] 的 ===")
n = 0
for cid, fname, anim, ratio, cov, d_idle, ex in rows:
    if ex or ratio is None:
        continue
    if ratio < 0.85 or ratio > 1.15:
        n += 1
        print(f"  {cid} {fname}: {ratio:.2f}")
print(f"  共 {n} 帧")
