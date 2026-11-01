#!/usr/bin/env python3
"""C2 表情立绘救援：从 ComfyUI output 里已生成的全部候选中挑最优，
轻微裁切（头顶/左右贴边 <40px）的候选做整体缩小+居中修复后复用，不重新生成。
用法：python3 scripts/art/rescue-portraits.py [c01 c06 ...]   默认处理所有缺图
输出：public/assets/meilong/portraits/<cid>/<expr>.png + 选择报告 .check/rescue-report.json
"""
import glob
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PORTRAITS_OUT = ROOT / "public/assets/meilong/portraits"
COMFY_OUT = Path.home() / "ComfyUI/output"
EXPRS = ["normal", "angry", "smug", "hurt"]
CROP_T = 40          # 允许救援的最大贴边像素
SCALE = 0.96         # 救援缩放
H = 1024


def load_mod():
    import importlib.util
    spec = importlib.util.spec_from_file_location("genc2", str(ROOT / "scripts/art/gen-c2.py"))
    g = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(g)
    return g


def score(g, fin_path, refsig):
    """返回 (ok, sim, reason)。与 gen-c2.verify_portrait 相同标准（色相阈值放宽到 0，只报告数值）。"""
    arr = np.array(Image.open(fin_path).convert("RGBA"))
    alpha = arr[:, :, 3]
    Hh, Ww = alpha.shape
    opaque = (alpha > 200).sum() / (Hh * Ww)
    if opaque < 0.12:
        return False, 0.0, "opaque %.1f%%" % (opaque * 100)
    ys, xs = np.where(alpha > 200)
    if len(ys) < 5000:
        return False, 0.0, "too small"
    y0, x0, x1 = int(ys.min()), int(xs.min()), int(xs.max())
    lr_m = min(x0, Ww - 1 - x1)
    top_bad = y0 < 0.015 * Hh
    lr_bad = lr_m < 0.01 * Ww
    gh, gmass = g._hue_hist(arr[alpha > 200, :3])
    rh, rmass = refsig
    sim = 1.0 - float(np.abs(gh - rh).sum()) / 2.0
    mass_ok = rmass <= 0 or gmass >= 0.55 * rmass
    if not mass_ok:
        return False, sim, "mass %.0f<%.0f" % (gmass, 0.55 * rmass)
    if top_bad or lr_bad:
        top_need = max(0, int(0.015 * Hh - y0)) if top_bad else 0
        lr_need = max(0, int(0.01 * Ww - lr_m)) if lr_bad else 0
        if top_need <= CROP_T and lr_need <= CROP_T:
            return "crop", sim, "top%d lr%d" % (y0, lr_m)
        return False, sim, "crop-severe top%d lr%d" % (y0, lr_m)
    return True, sim, ""


def rescue_image(g, fin_path, refsig):
    """对 crop-only 候选：整体缩小 SCALE 倍并居中，重新验证。"""
    arr = np.array(Image.open(fin_path).convert("RGBA"))
    Hh, Ww = arr.shape[:2]
    small = Image.fromarray(arr).resize((int(Ww * SCALE), int(Hh * SCALE)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (Ww, Hh), (0, 0, 0, 0))
    canvas.paste(small, ((Ww - small.width) // 2, (Hh - small.height) // 2))
    canvas.save(fin_path + ".rescued.png")
    ok, sim, why = score(g, fin_path + ".rescued.png", refsig)
    return ok, sim, why, fin_path + ".rescued.png"


def main():
    g = load_mod()
    chars = sys.argv[1:] or ["c0%d" % i for i in range(1, 9)]
    report = {}
    for cid in chars:
        refsig = g.ref_hue_sig(str(ROOT / "docs" / "art-review" / (cid + "-portrait.png")))
        for expr in EXPRS:
            out = PORTRAITS_OUT / cid / (expr + ".png")
            if out.exists():
                continue
            cands = sorted(glob.glob(str(COMFY_OUT / ("f2c2p_%s_%s_fin_*.png" % (cid, expr)))))
            scored = []
            for c in cands:
                try:
                    ok, sim, why = score(g, c, refsig)
                except Exception as e:
                    why = "load err %s" % e
                scored.append((c, ok, sim, why))
            scored.sort(key=lambda t: (t[1] is True, t[1] == "crop", t[2]), reverse=True)
            pick = None
            if not scored:
                report[cid + "_" + expr] = {"status": "no-candidates"}
                continue
            best_c, best_ok, best_sim, best_why = scored[0]
            if best_ok is True:
                Image.open(best_c).convert("RGBA").save(out)
                pick = {"src": best_c, "sim": round(best_sim, 3), "action": "direct", "reason": best_why}
            elif best_ok == "crop":
                ok2, sim2, why2, rescued = rescue_image(g, best_c, refsig)
                if ok2 is True:
                    Image.open(rescued).convert("RGBA").save(out)
                    os.unlink(rescued)
                    pick = {"src": best_c, "sim": round(sim2, 3), "action": "rescue-scale-center", "reason": best_why}
                else:
                    # 退而求其次：直接采用（贴边轻微），记录
                    Image.open(best_c).convert("RGBA").save(out)
                    pick = {"src": best_c, "sim": round(best_sim, 3), "action": "forced-crop", "reason": best_why + " | rescue-fail: " + why2}
            else:
                # 全都不达标：取色相最高的，留给人眼判定
                Image.open(best_c).convert("RGBA").save(out)
                pick = {"src": best_c, "sim": round(best_sim, 3), "action": "forced-best", "reason": best_why}
            report[cid + "_" + expr] = pick
            print("%s_%s: %s sim=%.3f (%s)" % (cid, expr, pick["action"], pick["sim"], best_why or "ok"), flush=True)
    json.dump(report, open(ROOT / ".check/rescue-report.json", "w"), ensure_ascii=False, indent=1)
    print("REPORT -> .check/rescue-report.json")


if __name__ == "__main__":
    main()
