#!/usr/bin/env python3
"""Wan2.2-Animate 试点资产准备：c07 st.hp + c04 cr.hk

生成：
  art-work/wan-pilot/<tag>/pose/frame_%04d.png  49 帧 480x832 黑底骨架（16fps 驱动视频帧）
  art-work/wan-pilot/<tag>/ref.png              480x832 参考立绘（纯色底）
  docs/art-review/wan-pilot/<tag>-pose-sheet.png  49 帧拼图（目检）
  docs/art-review/wan-pilot/c04-crhk-skeleton-compare.png  踢腿新旧骨架对比（7 行 x 2 列）
  ~/ComfyUI/input/wanpilot_<tag>_ref.png / _pose_%04d.png  上传副本

规则（INBOX 21:05 指示）：
  - 姿态序列 = 动画帧按 16fps 补帧；生成长度固定 49（Wan 最短稳妥长度），动画时长之后持尾帧
  - cr.hk 踢腿关键帧：踢腿侧膝/踝 x 外伸量 +30%（按该帧外伸占全程 [min,max] 的比例加权，峰值帧满 30%）
  - 骨架渲染与 scripts/art/render-poses.py 完全一致（LIMBS/COLORS/线宽）
  - 480x832 画布：主体 bbox 适配到 88% 高（732px）、宽 <=450px，居中
"""
import json, os, shutil, sys
from PIL import Image, ImageDraw

PROJ = os.path.expanduser("~/projects/fighter2")
COMFY_IN = os.path.expanduser("~/ComfyUI/input")
LIMBS = [(1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7), (1, 8), (8, 9), (9, 10), (1, 11), (11, 12), (12, 13), (1, 0), (0, 14), (14, 16), (0, 15), (15, 17)]
COLORS = [(255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0), (170, 255, 0), (85, 255, 0), (0, 255, 0), (0, 255, 85), (0, 255, 170),
          (0, 255, 255), (0, 170, 255), (0, 85, 255), (0, 0, 255), (85, 0, 255), (170, 0, 255), (255, 0, 255), (255, 0, 170), (255, 0, 85)]
W, H = 480, 832          # 9:16 竖版（Wan 支持尺寸，16 倍数）
N_VIDEO = 49             # 生成帧数（step 4，Wan 稳妥最短）
TARGET_H = int(H * 0.88) # 主体占高 732
TARGET_W = 450           # 主体宽上限

def render_skeleton(kp, size=1024):
    im = Image.new("RGB", (size, size), (0, 0, 0))
    d = ImageDraw.Draw(im)
    for li, (a, b) in enumerate(LIMBS):
        d.line([tuple(kp[a][:2]), tuple(kp[b][:2])], fill=COLORS[li % 18], width=8)
    for ki, (x, y, c) in enumerate(kp):
        r = 8
        d.ellipse([x - r, y - r, x + r, y + r], fill=COLORS[ki])
    return im

def bbox_fit(im, bg=(0, 0, 0), thresh=30, canvas_bg=None):
    """主体 bbox 适配到 480x832 画布（88% 高，宽 <=450），居中。
    canvas_bg: 画布底色（骨架=黑；立绘=其自身背景色，保证整幅纯色底）"""
    px = im.load()
    xs, ys = [], []
    for y in range(0, im.height, 2):
        for x in range(0, im.width, 2):
            r, g, b = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > thresh:
                xs.append(x); ys.append(y)
    if not xs:
        return im.resize((W, H))
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    m = int(0.04 * max(x1 - x0, y1 - y0))
    x0, y0 = max(0, x0 - m), max(0, y0 - m)
    x1, y1 = min(im.width - 1, x1 + m), min(im.height - 1, y1 + m)
    crop = im.crop((x0, y0, x1 + 1, y1 + 1))
    s = min(TARGET_H / (y1 - y0 + 1), TARGET_W / (x1 - x0 + 1))
    nw, nh = max(1, int((x1 - x0 + 1) * s)), max(1, int((y1 - y0 + 1) * s))
    canvas = Image.new("RGB", (W, H), canvas_bg if canvas_bg is not None else (0, 0, 0))
    canvas.paste(crop.resize((nw, nh), Image.Resampling.LANCZOS), ((W - nw) // 2, (H - nh) // 2))
    return canvas

def build_sequence(anim, n_video=N_VIDEO):
    n, fps = len(anim["frames"]), anim["fps"]
    T = max(4, round(n / fps * 16))
    src = [min(n - 1, int(t * fps / 16)) if t < T else n - 1 for t in range(n_video)]
    return T, src

def sheet(frames, cols=10, scale=0.25):
    cw, ch = int(W * scale), int(H * scale)
    rows = (len(frames) + cols - 1) // cols
    out = Image.new("RGB", (cols * cw, rows * ch), (40, 40, 40))
    for i, f in enumerate(frames):
        out.paste(f.resize((cw, ch)), ((i % cols) * cw, (i // cols) * ch))
    return out

def main():
    pilots = [
        ("c07", "st.hp", "c07sthp", False),
        ("c04", "cr.hk", "c04crhk", True),
    ]
    review_dir = os.path.join(PROJ, "docs/art-review/wan-pilot")
    os.makedirs(review_dir, exist_ok=True)
    os.makedirs(COMFY_IN, exist_ok=True)
    summary = {}
    for cid, anim_name, tag, is_kick in pilots:
        data = json.load(open(os.path.join(PROJ, f"art-work/poses/{cid}.json")))
        anim = data["anims"][anim_name]
        frames = [fr for fr in anim["frames"]]
        # INBOX 22:55：撤掉 +30% 拉骨——新骨架（afb4fcf 关键帧插值 架势→蓄力→出招→收招）
        # 踢腿出招已完全伸直，不再二次拉伸。active 帧（出招帧）直接读 frames[i]["active"]。
        T, src = build_sequence(anim)
        # 源帧渲染（1024）
        rendered = [render_skeleton(fr["keypoints"]) for fr in frames]
        # 49 帧驱动序列
        seq = [bbox_fit(rendered[i]) for i in src]
        out_dir = os.path.join(PROJ, f"art-work/wan-pilot/{tag}")
        pose_dir = os.path.join(out_dir, "pose")
        os.makedirs(pose_dir, exist_ok=True)
        for t, im in enumerate(seq):
            im.save(os.path.join(pose_dir, f"frame_{t:04d}.png"))
            im.save(os.path.join(COMFY_IN, f"wanpilot_{tag}_pose_{t:04d}.png"))
        # 参考立绘
        port = Image.open(os.path.join(PROJ, f"docs/art-review/{cid}-portrait.png")).convert("RGB")
        corners = [port.getpixel(p) for p in ((5, 5), (1018, 5), (5, 1018), (1018, 1018))]
        bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
        ref = bbox_fit(port, bg=bg, thresh=45, canvas_bg=bg)
        ref.save(os.path.join(out_dir, "ref.png"))
        ref.save(os.path.join(COMFY_IN, f"wanpilot_{tag}_ref.png"))
        # 审查拼图
        sheet(seq).save(os.path.join(review_dir, f"{tag}-pose-sheet.png"))
        if is_kick:
            data0 = json.load(open(os.path.join(PROJ, f"art-work/poses/{cid}.json")))
            old = [render_skeleton(fr["keypoints"]) for fr in data0["anims"][anim_name]["frames"]]
            cw, ch = int(W * 2 / 3), int(H * 2 / 3)
            comp = Image.new("RGB", (2 * cw, len(old) * ch), (40, 40, 40))
            for i in range(len(old)):
                comp.paste(old[i].resize((cw, ch)), (0, i * ch))
                comp.paste(bbox_fit(old[i]).resize((cw, ch)), (cw, i * ch))
            comp.save(os.path.join(review_dir, "c04-crhk-skeleton-compare.png"))
            # 单帧放大对比（第 0 帧，全尺寸 480x832 x2），腿外伸一目了然
            zoom = Image.new("RGB", (2 * W, H), (40, 40, 40))
            zoom.paste(bbox_fit(old[0]), (0, 0))
            zoom.paste(bbox_fit(render_skeleton(frames[0]["keypoints"])), (W, 0))
            zoom.save(os.path.join(review_dir, "c04-crhk-skeleton-zoom.png"))
        summary[tag] = {"anim": anim_name, "n_frames": len(anim["frames"]), "fps": anim["fps"], "T_16fps": T}
        print(f"{tag}: {anim_name} {len(anim['frames'])}帧@{anim['fps']}fps -> T={T} 驱动49帧", flush=True)
    print(json.dumps(summary, ensure_ascii=False))

if __name__ == "__main__":
    main()
