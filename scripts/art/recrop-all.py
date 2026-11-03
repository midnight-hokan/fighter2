#!/usr/bin/env python3
"""recrop-all.py — 8 人 raw 全量 BiRefNet 重抠（还原"修复前"帧），再跑新 fix-ghost（调色板保护）。

背景（INBOX 2026-11-03 第 3 条）：fix-ghost.py 已就地改过帧，"修复前"帧被覆盖。
raw（抠图前绿幕原图）仍在，BiRefNet 推理确定性，从 raw 重抠可精确还原"修复前"帧。
本脚本：
  1. 重抠 8 人全部 raw → art-work/recrop/<cid>/（"修复前"帧，含半透明绿鬼影）
  2. 跑 fix-ghost --src art-work/recrop → art-work/fixed/<cid>/
     （新版 fix-ghost 带调色板保护：排除立绘自带绿，只 alpha 8-200 且非立绘绿）
  3. 报告 → .check/recrop-all-report.json

用法：python3 scripts/art/recrop-all.py [--chars c01 c02 ...] [--skip-fix]
输出：art-work/recrop/<cid>/<帧>.png（重抠，含鬼影）
      art-work/fixed/<cid>/<帧>.png（新 fix-ghost 后，不碰原帧）
      .check/recrop-all-report.json
"""
import json
import os
import shutil
import subprocess
import sys
import time

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
API = "http://127.0.0.1:8188"
UPLOAD = os.path.expanduser("~/ComfyUI/input")
OUTPUT = os.path.expanduser("~/ComfyUI/output")
RECROP = os.path.join(ROOT, "art-work", "recrop")
BIREFNET = "birefnet.safetensors"
BATCH = 4  # 并行提交数（GPU 96GB 可同时跑多个 BiRefNet）


def wf_recrop(raw_name, out_prefix):
    """只抠图不生成：与 gen_frames.py 抠图段（节点 10-14）一致，保证还原原始抠图。"""
    return {
        "1": {"class_type": "LoadImage", "inputs": {"image": raw_name}},
        "2": {"class_type": "LoadBackgroundRemovalModel", "inputs": {"bg_removal_name": BIREFNET}},
        "3": {"class_type": "RemoveBackground", "inputs": {"bg_removal_model": ["2", 0], "image": ["1", 0]}},
        "4": {"class_type": "InvertMask", "inputs": {"mask": ["3", 0]}},
        "5": {"class_type": "JoinImageWithAlpha", "inputs": {"image": ["1", 0], "alpha": ["4", 0]}},
        "6": {"class_type": "SaveImage", "inputs": {"images": ["5", 0], "filename_prefix": out_prefix}},
    }


def submit(w, cid_tag):
    r = requests.post(API + "/prompt", json={"prompt": w, "client_id": cid_tag})
    j = r.json()
    if "error" in j:
        print(f"  QUEUE ERROR: {str(j)[:300]}", flush=True)
        return None
    return j


def poll(pid, prefix, timeout=180):
    t0 = time.time()
    while time.time() - t0 < timeout:
        time.sleep(2)
        h = requests.get(API + f"/history/{pid}").json()
        if pid in h:
            for o in h[pid].get("outputs", {}).values():
                for im in o.get("images", []):
                    if im["filename"].startswith(prefix):
                        sub = im.get("subfolder", "")
                        base = OUTPUT if im.get("type", "output") == "output" \
                            else os.path.expanduser("~/ComfyUI/temp")
                        return (os.path.join(base, sub, im["filename"]) if sub
                                else os.path.join(base, im["filename"]))
    print(f"  TIMEOUT {pid[:8]} {prefix}", flush=True)
    return None


def recrop_char(cid):
    rawdir = os.path.join(ROOT, "art-work", "frames", cid, "raw")
    outdir = os.path.join(RECROP, cid)
    os.makedirs(outdir, exist_ok=True)
    frames = sorted(f for f in os.listdir(rawdir) if f.endswith(".png"))
    n_done = 0
    t0 = time.time()
    for i in range(0, len(frames), BATCH):
        batch = frames[i:i + BATCH]
        items = []
        for fn in batch:
            raw_name = f"f2ra_{cid}_{fn}"
            shutil.copy(os.path.join(rawdir, fn), os.path.join(UPLOAD, raw_name))
            prefix = f"f2raf_{cid}_{fn[:-4]}"
            r = submit(wf_recrop(raw_name, prefix), f"recrop-{cid}")
            if r is None:
                continue
            items.append((fn, prefix, r["prompt_id"]))
        for fn, prefix, pid in items:
            t = poll(pid, prefix)
            if t is None:
                continue
            shutil.copy(t, os.path.join(outdir, fn))
            n_done += 1
            try:
                os.remove(os.path.join(UPLOAD, f"f2ra_{cid}_{fn}"))
            except OSError:
                pass
        print(f"  {cid}: {min(i + BATCH, len(frames))}/{len(frames)} "
              f"({time.time() - t0:.0f}s)", flush=True)
    return n_done, len(frames)


def main():
    args = sys.argv[1:]
    skip_fix = "--skip-fix" in args
    args = [a for a in args if a != "--skip-fix"]
    cids = args[1:] if (args and args[0] == "--chars") else [f"c0{i}" for i in range(1, 9)]
    os.makedirs(RECROP, exist_ok=True)
    rep = {}
    t0 = time.time()
    for cid in cids:
        print(f"== {cid} 重抠 ==", flush=True)
        n, total = recrop_char(cid)
        rep[cid] = {"recropped": n, "total": total}
        print(f"== {cid}: {n}/{total}（累计 {time.time() - t0:.0f}s）==", flush=True)
    json.dump({"ts": time.strftime("%F %T"), "step": "recrop", **rep},
              open(os.path.join(ROOT, ".check", "recrop-all-report.json"), "w"),
              ensure_ascii=False, indent=1)
    print(f"重抠完成 {sum(v['recropped'] for v in rep.values())} 帧，"
          f"总 {time.time() - t0:.0f}s", flush=True)
    if skip_fix:
        print("--skip-fix，跳过 fix-ghost", flush=True)
        return
    print(f"== 跑新 fix-ghost（--src {RECROP}，调色板保护）==", flush=True)
    r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "art", "fix-ghost.py"),
                        "--src", RECROP, "all"], capture_output=True, text=True)
    print(r.stdout[-2500:], flush=True)
    if r.returncode != 0:
        print("fix-ghost STDERR:", r.stderr[-2500:], flush=True)
    print("recrop-all 完成", flush=True)


if __name__ == "__main__":
    main()
