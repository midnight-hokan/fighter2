#!/usr/bin/env python3
"""regen-one.py — A 方案验证：用优化 prompt 重生成单帧（不碰原帧，输出临时处），
算新帧 vs idle_00 剪影 IoU，看"强化姿势指令"能否让 Qwen-Image-Edit 跟骨架线。

用法：python3 scripts/art/regen-one.py <cid> <anim> <idx> <立绘.png> [--desc 描述]
输出：.check/regen-test/<cid>_<anim>_<idx>.png + 打印 idle_iou（对照原帧 idle_iou）
"""
import json
import os
import sys
import zlib

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_frames as gf  # noqa: E402

ROOT = gf.ROOT

# 优化 prompt：删"只是参考标记不是人物一部分"（弱化骨架线权重），
# 强化"姿势变换任务、必须显著改变、别保持站姿、各肢体匹配骨架线"
PROMPT_V2 = (
    "角色设定：{desc}。"
    "图中人物身上画着白色骨架线，它指示这张图里人物要摆出的姿势。"
    "你必须让人物的四肢位置（双臂、双腿、头、躯干）与白色骨架线一致——"
    "每只手臂伸出的方向、肘部弯曲角度、每条腿伸出的方向、膝盖弯曲程度都要贴合骨架线。"
    "这是一个姿势变换任务：人物的姿势必须从原图明显改变成骨架线所示的姿势，"
    "绝对不能保留原图里人物的站立姿势。"
    "生成画面中绝对不能出现白色骨架线或线条（只参考骨架线的姿势，不要把骨架线画出来）。"
    "生成这个人物摆出白色骨架线所示姿势的画面：{hint}{frame_desc}。"
    "严格保持这个人的脸、发型、服装、配色完全不变。"
    "人物全身入镜，手脚完整。"
    "背景必须是均匀纯绿色（#00ff00 绿幕），整块纯色无渐变、无其他颜色、无地面、无阴影。"
    "厚涂赛璐璐风格，干净线稿，无文字水印，无特效。"
)


def idle_like(fimg, idle):
    """简化剪影 IoU（脚底+质心 x 对齐），对照 frame-qc 的 idle_like_ratio"""

    def mask(m):
        a = m[:, :, 3]
        return a > 200

    fm, im = mask(fimg), mask(idle)
    if fm.sum() < 100 or im.sum() < 100:
        return None
    # 脚底对齐
    fy = np.where(fm.any(axis=1))[0].max()
    iy = np.where(im.any(axis=1))[0].max()
    fimg2 = np.roll(fimg, iy - fy, axis=0)
    fm = mask(fimg2)
    # 质心 x 对齐
    fxs = np.where(fm.any(axis=0))[0]
    ix_ = np.where(im.any(axis=0))[0]
    fcx, icx = (fxs.max() + fxs.min()) / 2, (ix_.max() + ix_.min()) / 2
    fimg2 = np.roll(fimg2, int(round(icx - fcx)), axis=1)
    fm = mask(fimg2)
    inter = (fm & im).sum()
    union = (fm | im).sum()
    return float(inter) / max(int(union), 1)


def main():
    cid, anim, idx = sys.argv[1], sys.argv[2], int(sys.argv[3])
    portrait = sys.argv[4]
    desc = None
    if "--desc" in sys.argv:
        desc = sys.argv[sys.argv.index("--desc") + 1]
    safe = anim.replace(".", "_")
    data = json.load(open(gf.POSES / (cid + ".json")))
    if desc is None:
        desc = data.get("style", "")

    pose = gf.POSE_IMG / cid / f"{safe}_{idx:02d}.png"
    if not pose.exists():
        raise SystemExit(f"骨架图缺失 {pose}")
    overlay = gf.upload_overlay(portrait, str(pose), cid, anim, idx)
    prompt = PROMPT_V2.format(desc=desc, hint=gf.POSE_HINTS.get(anim, ""),
                              frame_desc=gf.describe_frame(data["anims"][anim]["frames"][idx]))
    seed = (20261101 + int(cid[1:]) * 100000 + zlib.crc32(f"{anim}_{idx}".encode()) % 90000
            + 1000) & 0x7FFFFFFF
    raw_p = f"f2raw_{cid}_{safe}_{idx:02d}"
    fin_p = f"f2fin_{cid}_{safe}_{idx:02d}"
    print(f"生成 {cid}/{safe}_{idx:02d} overlay={overlay} seed={seed}", flush=True)
    found, dt = gf.run(gf.wf(overlay, prompt, seed, cid, safe, idx), [raw_p, fin_p])
    fin_src = found[fin_p]
    outdir = ROOT / ".check" / "regen-test"
    outdir.mkdir(parents=True, exist_ok=True)
    out = outdir / f"{cid}_{safe}_{idx:02d}.png"
    import shutil
    shutil.copy(fin_src, out)
    print(f"新帧 → {out} ({dt:.0f}s)", flush=True)

    # 算 idle_iou（对照 frames 原 idle_00）
    fimg = np.array(Image.open(out).convert("RGBA"))
    idle = np.array(Image.open(gf.FRAMES / cid / "idle_00.png").convert("RGBA"))
    iou = idle_like(fimg, idle)
    print(f"新帧 idle_iou = {iou:.4f}（阈值 0.88，<0.88=姿势跟上了）", flush=True)
    # 对照原帧
    orig = gf.FRAMES / cid / f"{safe}_{idx:02d}.png"
    if orig.exists():
        oiou = idle_like(np.array(Image.open(orig).convert("RGBA")), idle)
        print(f"原帧 idle_iou = {oiou:.4f}（对照）", flush=True)


if __name__ == "__main__":
    main()
