#!/usr/bin/env python3
"""校准身份检查阈值：对当前 8 人全部帧算 高度比 + 主色直方图距离分布"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, "art-work")

BIN = 4  # 每通道 4 档 → 64 个 3D 直方图 bin（粗，抓整体配色）

def hist3d(rgb, mask, bins=BIN):
    px = rgb[mask]
    if len(px) < 50:
        return None
    q = (px[:, :3].astype(np.int32) * bins // 256)
    idx = q[:, 0] * bins * bins + q[:, 1] * bins + q[:, 2]
    h, _ = np.unique(idx, return_counts=True)
    out = np.zeros(bins ** 3, dtype=np.float64)
    out[h] = _
    s = out.sum()
    return out / s if s > 0 else None

def hist_dist(h1, h2):
    """1 - 交集（对称，0=完全相同 1=完全不同）"""
    inter = np.minimum(h1, h2).sum()
    return 1.0 - inter

def bbox_h(fimg):
    A = fimg[:, :, 3]
    m = A > 100
    if m.sum() < 100:
        return 0
    ys = np.where(m.any(axis=1))[0]
    return int(ys.max() - ys.min() + 1)

def main():
    rows = []
    for cid in [f"c0{i}" for i in range(1, 9)]:
        cut = np.array(Image.open(os.path.join(ART, "portrait-cutout", f"{cid}.cutout.png")).convert("RGBA"))
        cm = cut[:, :, 3] > 128
        h_port = hist3d(cut, cm)
        fdir = os.path.join(ART, "frames", cid)
        idle = np.array(Image.open(os.path.join(fdir, "idle_00.png")).convert("RGBA"))
        h_idle = bbox_h(idle)
        h_port_frame = hist3d(idle, idle[:, :, 3] > 150)
        d_idle_port = hist_dist(h_port_frame, h_port) if (h_port_frame is not None and h_port is not None) else None
        for fname in sorted(os.listdir(fdir)):
            if not fname.endswith(".png"):
                continue
            fimg = np.array(Image.open(os.path.join(fdir, fname)).convert("RGBA"))
            h = bbox_h(fimg)
            ratio = h / h_idle if h_idle else None
            hf = hist3d(fimg, fimg[:, :, 3] > 150)
            d = hist_dist(hf, h_port) if (hf is not None and h_port is not None) else None
            rows.append((cid, fname, ratio, d, d_idle_port))
    import collections
    byc = collections.defaultdict(list)
    for cid, fname, ratio, d, dip in rows:
        byc[cid].append((fname, ratio, d, dip))
    for cid in sorted(byc):
        rs = [r[1] for r in byc[cid] if r[1] is not None]
        ds = [r[2] for r in byc[cid] if r[2] is not None]
        dipo = byc[cid][0][3]
        print(f"{cid}: idle-肖像距离={dipo:.4f}  高度比 min={min(rs):.2f} p50={np.median(rs):.2f} max={max(rs):.2f}  距离 min={min(ds):.4f} p50={np.median(ds):.4f} p90={np.percentile(ds,90):.4f} max={max(ds):.4f}")
    # 全局
    allds = [r[3] for r in rows if r[3] is not None]
    allrs = [r[2] for r in rows if r[2] is not None]
    print(f"\n全局: 高度比 p1={np.percentile(allrs,1):.2f} p99={np.percentile(allrs,99):.2f}")
    print(f"全局: 距离 p50={np.percentile(allds,50):.4f} p90={np.percentile(allds,90):.4f} p95={np.percentile(allds,95):.4f} p99={np.percentile(allds,99):.4f} max={max(allds):.4f}")
    print("\n距离 top15（最不像立绘的帧）:")
    for cid, fname, ratio, d, dip in sorted(rows, key=lambda r: -(r[3] or 0))[:15]:
        print(f"  {cid} {fname}: d={d:.4f} 高度比={ratio:.2f}")
    print("\n高度比 top15（偏离 1 最远）:")
    for cid, fname, ratio, d, dip in sorted(rows, key=lambda r: abs((r[2] or 1) - 1), reverse=True)[:15]:
        print(f"  {cid} {fname}: ratio={ratio:.2f}")

if __name__ == "__main__":
    main()
