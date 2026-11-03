#!/usr/bin/env python3
"""A1 邻帧顶替（INBOX 2026-11-03 06:20 第二步兜底）：QC 仍失败的帧用
同角色同动画相邻的通过帧顶替，顶替清单写 .check/substitute-list.json
（PROGRESS 交付时引用）。

用法：
  python3 scripts/art/substitute-frames.py <cid> <frame.png> [邻帧.png ...]
    默认邻帧 = 同动画 i±1（通过 QC 的最近帧）
  python3 scripts/art/substitute-frames.py --from-report all
    读 frame-qc-report.json，对每个仍失败帧自动选邻帧顶替（跳过 idle_00——
    它是 G 基线，顶替会污染基线；基线帧失败应走重生）

顶替后该动画若被顶替帧的 pose-img 存在，同步复制 pose-img（保持 S 检查一致）。
"""
import argparse
import json
import os
import shutil
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, "art-work")
CHK = os.path.join(ROOT, ".check")


def parse_fname(fn):
    anim, idx = fn.rsplit("_", 1)
    return anim, int(idx[:-4])


def find_neighbor(cid, anim, idx, report):
    """同动画里离 idx 最近的、QC 通过的帧"""
    crep = report["characters"].get(cid, {}).get("frames", {})
    best = None
    for d in (1, -1, 2, -2, 3, -3):
        j = idx + d
        if j < 0:
            continue
        fn = f"{anim}_{j:02d}.png"
        if fn == f"{anim}_{idx:02d}.png":
            continue
        rec = crep.get(fn)
        if rec is not None and not rec.get("fails") and os.path.exists(os.path.join(ART, "frames", cid, fn)):
            best = fn
            break
    return best


def substitute(cid, src, dst):
    fdir = os.path.join(ART, "frames", cid)
    shutil.copy2(os.path.join(fdir, src), os.path.join(fdir, dst))
    # pose-img 同步（若存在）
    pdir = os.path.join(ART, "pose-img", cid)
    sp = os.path.join(pdir, src)
    if os.path.exists(sp):
        shutil.copy2(sp, os.path.join(pdir, dst))
    print(f"  {cid}: {dst} ← {src}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-report", action="store_true")
    ap.add_argument("args", nargs="*")
    args = ap.parse_args()
    rep_path = os.path.join(CHK, "frame-qc-report.json")
    report = json.load(open(rep_path))
    out_path = os.path.join(CHK, "substitute-list.json")
    lst = json.load(open(out_path)) if os.path.exists(out_path) else {"subs": []}

    if args.from_report:
        cids = [f"c0{i}" for i in range(1, 9)]
        for cid in cids:
            cd = report["characters"].get(cid, {})
            for fn, rec in cd.get("frames", {}).items():
                if not rec.get("fails"):
                    continue
                if fn == "idle_00.png":
                    print(f"  {cid}/idle_00 是 G 基线，跳过顶替（需重生）", flush=True)
                    continue
                anim, idx = parse_fname(fn)
                nb = find_neighbor(cid, anim, idx, report)
                if nb is None:
                    print(f"  {cid}/{fn} 无可用邻帧（需重生）", flush=True)
                    continue
                substitute(cid, nb, fn)
                lst["subs"].append({"cid": cid, "dst": fn, "src": nb,
                                    "fails": rec["fails"],
                                    "ts": time.strftime("%F %T")})
    else:
        # 手动模式：cid frame [neighbors...]（不给邻帧则自动找）
        cid, fn = args.args[0], args.args[1]
        if len(args.args) > 2:
            srcs = args.args[2:]
        else:
            anim, idx = parse_fname(fn)
            nb = find_neighbor(cid, anim, idx, report)
            srcs = [nb] if nb else []
            if not srcs:
                raise SystemExit(f"无可用邻帧：{cid}/{fn}")
        for src in srcs:
            substitute(cid, src, fn)
            lst["subs"].append({"cid": cid, "dst": fn, "src": src,
                                "ts": time.strftime("%F %T")})

    lst["ts"] = time.strftime("%F %T")
    json.dump(lst, open(out_path, "w"), ensure_ascii=False, indent=1)
    print(f"\n顶替清单 {len(lst['subs'])} 条 → {out_path}")


if __name__ == "__main__":
    main()
