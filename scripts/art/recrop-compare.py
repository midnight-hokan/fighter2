#!/usr/bin/env python3
"""recrop-compare.py — 从 raw 用 BiRefNet 重抠几帧（还原"修复前"帧），生成修复前后对比图。

背景（INBOX 2026-11-03 第 3 条）：fix-ghost.py 已就地改过帧，"修复前"帧被覆盖。
raw（抠图前绿幕原图）仍在，BiRefNet 推理确定性（同输入同输出），故从 raw 重抠
可精确还原"修复前"帧（含半透明绿鬼影）。本脚本重抠 c07/c04 各 3 帧，拼成
before（raw 重抠，有鬼影）/ after（当前帧，已修复）对比图，供目检确认
"鬼影被擦掉、围裙/背心等角色自带绿没被误擦"。

用法：python3 scripts/art/recrop-compare.py
输出：.check/compare/<cid>-<帧>-before.png / -after.png / <cid>-compare.png
"""
import os
import shutil
import time

import requests
from PIL import Image, ImageDraw
try:
    _LANCZOS = Image.Resampling.LANCZOS
except AttributeError:  # 老版 Pillow 兜底（LANCZOS 常量值为 1）
    _LANCZOS = 1

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
API = "http://127.0.0.1:8188"
UPLOAD = os.path.expanduser("~/ComfyUI/input")
OUTPUT = os.path.expanduser("~/ComfyUI/output")
CHK = os.path.join(ROOT, ".check", "compare")
BIREFNET = "birefnet.safetensors"

# 待对比帧：角色 -> 帧名（带 .png；选围裙/背心/特殊技明显的帧）
PICKS = {
    "c07": ["idle_00.png", "st_hp_00.png", "chongtiant_00.png"],
    "c04": ["idle_00.png", "st_hp_00.png", "denghua_00.png"],
}


def wf_recrop(raw_name, out_prefix):
    """只抠图不生成：LoadImage(raw) → BiRefNet → JoinImageWithAlpha → SaveImage。
    与 gen_frames.py 的抠图段（节点 10-14）完全一致，保证还原原始抠图结果。"""
    return {
        "1": {"class_type": "LoadImage", "inputs": {"image": raw_name}},
        "2": {"class_type": "LoadBackgroundRemovalModel", "inputs": {"bg_removal_name": BIREFNET}},
        "3": {"class_type": "RemoveBackground", "inputs": {"bg_removal_model": ["2", 0], "image": ["1", 0]}},
        "4": {"class_type": "InvertMask", "inputs": {"mask": ["3", 0]}},
        "5": {"class_type": "JoinImageWithAlpha", "inputs": {"image": ["1", 0], "alpha": ["4", 0]}},
        "6": {"class_type": "SaveImage", "inputs": {"images": ["5", 0], "filename_prefix": out_prefix}},
    }


def run(w, prefix, timeout=120):
    r = requests.post(API + "/prompt", json={"prompt": w, "client_id": "f2_recrop"})
    j = r.json()
    if "error" in j:
        raise RuntimeError("QUEUE ERROR: " + str(j)[:400])
    pid = j["prompt_id"]
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
    raise RuntimeError(f"TIMEOUT 缺 {prefix}")


def make_sheet(cid, frames):
    S = 320
    rows = len(frames)
    canvas = Image.new("RGB", (S * 2 + 20, rows * S + 44), (30, 30, 34))
    dr = ImageDraw.Draw(canvas)
    dr.text((10, 10), f"{cid}  左=修复前(raw BiRefNet 重抠, 含鬼影)   右=修复后(当前帧)", fill=(255, 255, 255))
    for i, fn in enumerate(frames):
        base = fn[:-4]
        for col, tag in enumerate(("before", "after")):
            p = os.path.join(CHK, f"{cid}-{base}-{tag}.png")
            if not os.path.exists(p):
                continue
            im = Image.open(p).convert("RGBA").resize((S, S), _LANCZOS)
            tmp = Image.new("RGBA", (S, S), (30, 30, 34, 255))
            tmp.alpha_composite(im)
            canvas.paste(tmp.convert("RGB"), (10 + col * (S + 10), 34 + i * S))
            dr.text((12 + col * (S + 10), 34 + i * S + S - 18),
                    f"{base} {tag}", fill=(180, 180, 180))
    out = os.path.join(CHK, f"{cid}-compare.png")
    canvas.save(out)
    print(f"对比图: {out}", flush=True)


def main():
    os.makedirs(CHK, exist_ok=True)
    for cid, frames in PICKS.items():
        for fn in frames:
            base = fn[:-4]
            rawp = os.path.join(ROOT, "art-work", "frames", cid, "raw", fn)
            frp = os.path.join(ROOT, "art-work", "frames", cid, fn)
            if not os.path.exists(rawp):
                print(f"skip {cid}/{fn}（无 raw）", flush=True)
                continue
            raw_name = f"f2rc_{cid}_{base}.png"
            shutil.copy(rawp, os.path.join(UPLOAD, raw_name))
            prefix = f"f2rcfin_{cid}_{base}"
            t0 = time.time()
            src = run(wf_recrop(raw_name, prefix), prefix)
            before = os.path.join(CHK, f"{cid}-{base}-before.png")
            shutil.copy(src, before)
            after = os.path.join(CHK, f"{cid}-{base}-after.png")
            shutil.copy(frp, after)
            print(f"{cid}/{fn}: 重抠 {time.time()-t0:.1f}s → {os.path.basename(before)}", flush=True)
        make_sheet(cid, frames)
    print("完成", flush=True)


if __name__ == "__main__":
    main()
