#!/usr/bin/env python3
"""A1 帧清理（INBOX 2026-11-01 23:45 c01 v2 复核，批量完成后、A2/A3 之前）v2。

每帧 3 项质检 + 2 项几何修正：
  1. 绿幕溢色：G 显著压过 R/B 且偏亮（G>120，排除深绿衣物）的像素占比。
     > 1.5% 判"严重"。--fix 时去溢色（G' = max(R,B) + 差值*0.25）。
  2. 白色骨架细线：近白低饱和像素腐蚀 2 次后的"细线部分"占比 > 1.0% 判中 → 建议重生成。
  3. 身份漂移：帧与立绘主色板（k-means k=8）的覆盖率（tol=60）< 0.87 判中 → 建议重生成。
     （先 --fix 去溢色再复测；溢色修好后仍低的才是真漂移。刀具类异常靠人眼/vision 复核。）
  4. 整体缩放：人物按 idle_00 高度归一到 896px（=128 空间锚点线，anchor.y=112）。
     实测生成帧人物高 ~984px、脚底 ~1005 行（比锚点线低 109px → 游戏里脚陷地 13px），
     直接平移会切头顶，必须先缩（s≈0.91）再对齐。对应 INBOX 第 5 条"比例统一"。
  5. 脚底对齐：站立类动画（idle/walk/crouch/受击/站蹲攻击/胜利/投技等）
     按"最低不透明像素"平移到脚底线 y=896。跳跃/倒地/翻滚/超必杀等动态姿势只缩不对齐
     （保持腾空相对位置）。

用法：
  python3 scripts/art/cleanup-frames.py c04            # 只出报告（.check/cleanup-report-c04.json）
  python3 scripts/art/cleanup-frames.py all            # 8 人全扫
  python3 scripts/art/cleanup-frames.py c04 --fix      # 应用去溢色+缩放+对齐（覆写 frames/）
  重生成坏帧：gen_frames.py <cid> <立绘> --anim <动画> SEED_SALT=<n>，之后必须再跑 --fix。

注意：只改 frames/<cid>/*.png 成品帧，raw/ 原图永远保留。
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
FRAMES = ROOT / "art-work" / "frames"
PORTRAITS = ROOT / "docs" / "art-review"
REPORT_DIR = ROOT / ".check"

CANVAS = 1024
ANCHOR_Y = 896             # 128 空间 anchor.y=112 × 8 = 脚底线
ALPHA_T = 200
STANDING = {
    "idle", "walkf", "walkb", "crouch", "blockstun", "crblock", "hitstun",
    "dizzy", "win", "throw", "gc", "maxstart",
}
STANDING_PREFIX = ("st.", "cr.")

SPILL_DIFF = 20
SPILL_G_MIN = 120
SPILL_SEVERE = 0.015
SPILL_FIX = 0.002
WHITE_R = 220
WHITE_SAT = 30
THIN_WHITE_FLAG = 0.010
PALETTE_K = 8
PALETTE_TOL = 60
COVERAGE_FLAG = 0.87


def load(p):
    return np.array(Image.open(p).convert("RGBA"))


def is_standing(anim):
    return anim in STANDING or anim.startswith(STANDING_PREFIX)


def bbox(a):
    m = a[:, :, 3] > ALPHA_T
    if not m.any():
        return None
    ys, xs = np.where(m)
    return int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())


def kmeans(px, k=8, iters=20, seed=0):
    rng = np.random.default_rng(seed)
    C = px[rng.choice(len(px), k, replace=False)].astype(float)
    for _ in range(iters):
        d = ((px[:, None, :].astype(float) - C[None, :, :]) ** 2).sum(-1)
        lab = d.argmin(1)
        for j in range(k):
            m = lab == j
            if m.any():
                C[j] = px[m].mean(0)
    return C


def palette_of(portrait_path):
    a = load(portrait_path)
    px = a[a[:, :, 3] > ALPHA_T][:, :3].astype(np.uint8)
    return kmeans(px, PALETTE_K)


def palette_from_frames(fdir, sample=200000, k=12):
    """自参照色板：从角色自己的全部帧提取（排除溢色像素），
    比立绘图色板稳——立绘光照/配色与帧不一致会导致整角色系统性低覆盖率。
    单帧漂移色只占池子 ~1-3%，k=12 不会为它单独成簇 → 漂移帧覆盖率会掉。"""
    rng = np.random.default_rng(0)
    parts = []
    for fn in sorted(fdir.glob("*.png")):
        a = load(fn)
        m = a[:, :, 3] > ALPHA_T
        if not m.any():
            continue
        r, g, b = (a[:, :, j].astype(np.int16) for j in range(3))
        mb = np.maximum(r, b)
        m = m & ~(((g - mb) > SPILL_DIFF) & (g > SPILL_G_MIN))
        if m.any():
            parts.append(a[m][:, :3])
    if not parts:
        return None
    px = np.vstack(parts)
    if len(px) > sample:
        px = px[rng.choice(len(px), sample, replace=False)]
    return kmeans(px, k)


def coverage(frame, C):
    m = frame[:, :, 3] > ALPHA_T
    px = frame[m][:, :3].astype(np.float32)
    if len(px) < 50:
        return 1.0
    d = ((px[:, None, :] - C[None, :, :]) ** 2).sum(-1).min(1)
    return float((d < PALETTE_TOL ** 2).mean())


def spill_ratio(a):
    m = a[:, :, 3] > ALPHA_T
    if not m.any():
        return 0.0, 0
    r, g, b = a[:, :, 0].astype(np.int16), a[:, :, 1].astype(np.int16), a[:, :, 2].astype(np.int16)
    mb = np.maximum(r, b)
    spill = m & ((g - mb) > SPILL_DIFF) & (g > SPILL_G_MIN)
    return float(spill.sum()) / m.sum(), int(spill.sum())


def despill(a):
    r, g, b = a[:, :, 0].astype(np.int16), a[:, :, 1].astype(np.int16), a[:, :, 2].astype(np.int16)
    mb = np.maximum(r, b)
    spill = (a[:, :, 3] > ALPHA_T) & ((g - mb) > SPILL_DIFF) & (g > SPILL_G_MIN)
    if not spill.any():
        return a, 0
    out = a.copy()
    out[:, :, 1] = np.where(spill, (mb + (g - mb) * 0.25).astype(np.uint8), a[:, :, 1])
    return out, int(spill.sum())


def thin_white_ratio(a):
    m = a[:, :, 3] > ALPHA_T
    if not m.any():
        return 0.0
    mx = a[:, :, :3].max(axis=2).astype(np.int16)
    mn = a[:, :, :3].min(axis=2).astype(np.int16)
    white = m & (mn > WHITE_R) & ((mx - mn) < WHITE_SAT)
    er = Image.fromarray((white * 255).astype(np.uint8))
    for _ in range(2):
        er = er.filter(ImageFilter.MinFilter(3))
    thin = white & ~(np.array(er) > 128)
    return float(thin.sum()) / m.sum()


def resize_canvas(a, s):
    W = round(CANVAS * s)
    im = Image.fromarray(a).resize((W, W), Image.LANCZOS)
    out = np.zeros((CANVAS, CANVAS, 4), np.uint8)
    x0 = round((CANVAS - W) / 2)
    # 垂直位置先按原比例贴，主循环里再按脚底/居中重贴
    out[:W, x0:x0 + W] = np.array(im)
    return out, W, x0


def main():
    args = [a for a in sys.argv[1:] if a != "--fix"]
    fix = "--fix" in sys.argv
    cids = [f"c{i:02d}" for i in range(1, 9)] if args and args[0] == "all" else args[:1]
    if not cids:
        raise SystemExit("用法: cleanup-frames.py <c01..c08|all> [--fix]")

    for cid in cids:
        fdir = FRAMES / cid
        if not fdir.exists():
            print(f"!! {cid} 帧目录不存在，跳过")
            continue
        pose = json.load(open(ROOT / "art-work" / "poses" / f"{cid}.json"))
        # 自参照色板（角色自己的帧提取）；提取失败才退回立绘图色板
        C = palette_from_frames(fdir)
        if C is None:
            C = palette_of(PORTRAITS / f"{cid}-portrait.png")

        # 角色统一缩放：按 idle_00 高度归一到 ANCHOR_Y
        idle = load(fdir / "idle_00.png")
        bb0 = bbox(idle)
        if bb0 is None:
            print(f"!! {cid} idle_00 空帧，跳过")
            continue
        h_idle = bb0[1] - bb0[0] + 1
        s_char = min(1.0, ANCHOR_Y / h_idle)

        report = []
        n_spill = n_scaled = n_aligned = 0
        for name, anim in pose["anims"].items():
            for i in range(len(anim["frames"])):
                fn = f"{name.replace('.', '_')}_{i:02d}.png"
                p = fdir / fn
                if not p.exists():
                    report.append({"frame": fn, "missing": True})
                    continue
                a = load(p)
                bb = bbox(a)
                if bb is None:
                    report.append({"frame": fn, "empty": True})
                    continue
                t, b, x0_, x1_ = bb
                h = b - t + 1
                rec = {"frame": fn, "anim": name, "h": h, "foot": b}

                if fix:
                    changed = False
                    sr_pre, _ = spill_ratio(a)
                    if sr_pre > SPILL_FIX:
                        a, nchg = despill(a)
                        if nchg:
                            rec["despill_px"] = nchg
                            rec["spill_pct_pre"] = round(100 * sr_pre, 2)
                            n_spill += 1
                            changed = True
                    s = min(s_char, ANCHOR_Y / h) if is_standing(name) else s_char
                    if s < 0.999:
                        a, W, x0r = resize_canvas(a, s)
                        rec["scale"] = round(s, 3)
                        n_scaled += 1
                        changed = True
                        bb = bbox(a)
                        if bb is None:  # 理论上不会发生（帧非空），仅满足类型检查
                            raise RuntimeError(f"{fn} 缩放后变空帧")
                        t, b = bb[0], bb[1]
                        h = b - t + 1
                    if is_standing(name):
                        dy = ANCHOR_Y - b
                        if dy:
                            out = np.zeros_like(a)
                            if dy > 0:
                                out[dy:, :] = a[:CANVAS - dy, :]
                            else:
                                out[:dy, :] = a[-dy:, :]
                            a = out
                            rec["align_dy"] = dy
                            n_aligned += 1
                            changed = True
                    if changed:
                        Image.fromarray(a).save(p)

                # 指标在 fix 之后测量——报告反映最终状态（去溢色修好的帧不再误报）
                sr, _ = spill_ratio(a)
                twr = thin_white_ratio(a)
                cov = coverage(a, C)
                rec["spill_pct"] = round(100 * sr, 2)
                rec["thin_white_pct"] = round(100 * twr, 2)
                rec["coverage"] = round(cov, 3)
                report.append(rec)

        # 白色细线：角色相对阈值。白衣服细节全帧恒定（p75 基线高），
        # 骨架线是零星出现的（个别帧显著高于基线）→ 只 flag 显著超基线的帧。
        twrs = [r["thin_white_pct"] for r in report if not r.get("missing") and not r.get("empty")]
        tw_base = float(np.percentile(twrs, 75)) if twrs else 0.0
        tw_thr = max(THIN_WHITE_FLAG * 100, tw_base + 0.4)
        for r in report:
            if r.get("missing") or r.get("empty"):
                continue
            flags = []
            if r["spill_pct"] > SPILL_SEVERE * 100:
                flags.append("溢色严重")
            if r["thin_white_pct"] > tw_thr:
                flags.append("白色细线")
            # 倒地类姿势（knockdown/ko）身体朝向变化大，色板覆盖率天然偏低，排除误报
            if r["coverage"] < COVERAGE_FLAG and r["anim"] not in ("knockdown", "ko"):
                flags.append("身份漂移")
            r["flags"] = flags

        REPORT_DIR.mkdir(exist_ok=True)
        rpath = REPORT_DIR / f"cleanup-report-{cid}.json"
        json.dump({"s_char": round(s_char, 4), "h_idle": h_idle, "white_thr_pct": round(tw_thr, 2),
                  "frames": report},
                  open(rpath, "w"), ensure_ascii=False, indent=1)
        flagged = [r for r in report if r.get("flags")]
        miss = [r for r in report if r.get("missing")]
        print(f"== {cid}: {len(report)} 帧 s_char={s_char:.3f} h_idle={h_idle} 白线阈值={tw_thr:.1f}% | "
              f"问题帧 {len(flagged)} 缺帧 {len(miss)}"
              + (f" | fix: 去溢色 {n_spill} 缩放 {n_scaled} 对齐 {n_aligned}" if fix else ""))
        for r in flagged:
            print(f"   ⚠ {r['frame']} {r['flags']} spill={r['spill_pct']}% 白线={r['thin_white_pct']}% cov={r['coverage']}")


if __name__ == "__main__":
    main()
