#!/usr/bin/env python3
"""A1 帧修复：顶替脚本（INBOX 06:20 / 11:10）

对 .check/regen-out/substitute.json 里重生成失败的帧，用"同动画相邻的合格帧"顶替。
合格 = 不在 substitute.json（bad 集合）里：即原本就过 QC，或重生成功（ok.json）。

规则（INBOX 11:10 第 4 条）：
- 顶替源必须是同一动画（同 anim 前缀）的相邻帧（idx±1,±2,...）
- 顶替源必须合格（不在 bad 集合）
- 若同动画找不到合格邻帧，回退到该角色 idle 首帧（仅当该帧合格），并标记 fallback
- 输出顶替清单 .check/substitute-report.json，写 PROGRESS 用

用法：
  python3 scripts/art/substitute-frames.py            # 执行顶替（cp 到 art-work/fixed/<cid>/）
  python3 scripts/art/substitute-frames.py --dry-run  # 只打印，不 cp
"""
import argparse
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIXED = ROOT / "art-work" / "fixed"
REGEN_OUT = ROOT / ".check" / "regen-out"


def parse_fname(fname):
    """cr_hp_03.png -> (anim='cr_hp', idx=3)；denghua_04.png -> ('denghua', 4)"""
    m = re.match(r"^(.+)_(\d{2})\.png$", fname)
    if not m:
        return None, None
    return m.group(1), int(m.group(2))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    sub_path = REGEN_OUT / "substitute.json"
    ok_path = REGEN_OUT / "ok.json"
    if not sub_path.exists():
        print(f"缺少 {sub_path}（重生还没跑完？）", file=sys.stderr)
        sys.exit(1)
    bad = json.loads(sub_path.read_text())
    ok = json.loads(ok_path.read_text()) if ok_path.exists() else []
    bad_set = {(b["cid"], b["fname"]) for b in bad}
    ok_set = {(o["cid"], o["fname"]) for o in ok}

    # 每角色在 fixed/ 的全部帧 + 各动画的 idx 集合
    char_frames = {}
    for cid_dir in sorted(FIXED.iterdir()):
        if not cid_dir.is_dir():
            continue
        frames = {}
        for f in cid_dir.glob("*.png"):
            anim, idx = parse_fname(f.name)
            if anim is None:
                continue
            frames.setdefault(anim, []).append(idx)
        char_frames[cid_dir.name] = frames

    report = []
    for b in bad:
        cid, fname = b["cid"], b["fname"]
        anim, idx = parse_fname(fname)
        if anim is None:
            report.append({"cid": cid, "fname": fname, "status": "parse_fail", "reason": b["reason"]})
            continue
        frames = char_frames.get(cid, {})
        same_anim = sorted(frames.get(anim, []))
        # 同动画邻帧，按距离排序；跳过 bad 帧
        cands = []
        for j in same_anim:
            if (cid, f"{anim}_{j:02d}.png") in bad_set:
                continue  # 顶替源本身也失败，不能用
            cands.append((abs(j - idx), j))
        cands.sort()
        target = None
        fallback = False
        if cands:
            target = f"{anim}_{cands[0][1]:02d}.png"
        elif (cid, "idle_00.png") not in bad_set:
            target = "idle_00.png"
            fallback = True
        else:
            report.append({"cid": cid, "fname": fname, "status": "no_source",
                           "reason": b["reason"]})
            print(f"  ✗ {cid}/{fname} 无合格顶替源（同动画全败且 idle_00 也败）", flush=True)
            continue
        src = FIXED / cid / target
        dst = FIXED / cid / fname
        if not src.exists():
            report.append({"cid": cid, "fname": fname, "status": "src_missing", "from": target})
            continue
        if not args.dry_run:
            shutil.copy2(src, dst)
        report.append({"cid": cid, "fname": fname, "status": "ok",
                       "from": target, "fallback_idle": fallback,
                       "reason": b["reason"]})
        tag = " [idle回退]" if fallback else ""
        print(f"  {'would ' if args.dry_run else ''}sub {cid}/{fname} <- {cid}/{target}{tag}", flush=True)

    out = ROOT / ".check" / "substitute-report.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=1))
    ok_n = sum(1 for r in report if r["status"] == "ok")
    fb_n = sum(1 for r in report if r.get("fallback_idle"))
    bad_n = len(bad)
    print(f"\n== 顶替完成 {ok_n}/{bad_n}（其中 idle 回退 {fb_n}），清单 {out} ==", flush=True)


if __name__ == "__main__":
    main()
