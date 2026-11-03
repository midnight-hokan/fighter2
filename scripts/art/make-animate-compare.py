#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 docs/art-review/animate-pilot.png：
每个试点一行，左=原图集帧(当前游戏)、右=Wan Animate 新帧(新骨架)，标出招帧(红框+“出招”)。
新帧出招帧用运动峰值定位(49→53 帧+模型时延，理论映射不准)。
用法：python3 scripts/art/make-animate-compare.py
"""
import os, glob, json, re
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PROJ = os.path.expanduser("~/projects/fighter2")
OUT = os.path.expanduser("~/ComfyUI/output")
REVIEW = os.path.join(PROJ, "docs/art-review")
os.makedirs(REVIEW, exist_ok=True)

def load_font(sz):
    for p in ["/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
              "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

def frnum(p):
    m = re.search(r"_(\d+)_\.png", os.path.basename(p))
    return int(m.group(1)) if m else 0

def wan_frames(tag):
    files = glob.glob(os.path.join(OUT, f"wanpilot_{tag}_*.png"))
    files.sort(key=frnum)
    return [Image.open(f).convert("RGB") for f in files]

def motion_peak(frames):
    """返回运动峰值帧下标(0起)与平滑运动序列"""
    prev, ms = None, []
    for im in frames:
        a = np.asarray(im.convert("L"), dtype=np.int16)
        ms.append(float(np.abs(a - prev).mean()) if prev is not None else 0.0)
        prev = a
    ms = np.array(ms)
    sm = np.convolve(ms, np.ones(3) / 3, mode="same")
    return int(np.argmax(sm)), sm

def strip(frames, target_h, strike_idx=None, gap=6, bg=(28, 28, 30)):
    th = target_h
    rs = [f.resize((max(1, int(f.width * th / f.height)), th), Image.Resampling.LANCZOS) for f in frames]
    label_h = 22
    W = sum(im.width for im in rs) + gap * (len(rs) - 1) + 4
    H = th + label_h + 8
    canvas = Image.new("RGB", (W, H), bg)
    dr = ImageDraw.Draw(canvas)
    fnt = load_font(15)
    x = 2
    for i, im in enumerate(rs):
        y = label_h + 2
        canvas.paste(im, (x, y))
        if i == strike_idx:
            dr.rectangle([x - 2, y - 2, x + im.width + 2, y + im.height + 2], outline=(255, 40, 40), width=3)
            dr.text((x + 3, y + 2), "出招", fill=(255, 60, 60), font=fnt)
        x += im.width + gap
    return canvas

# 出招帧（1起，人工放大复核选的最清晰帧）——运动峰值对扫帚前冲(c07)偏晚，故显式指定
ATTACK_FRAME = {"c07sthp": 10, "c04crhk": 11}

def main():
    pilots = [
        ("c07", "st.hp", "c07sthp", "c07 霍兰 · st.hp 站立重拳"),
        ("c04", "cr.hk", "c04crhk", "c04 严正 · cr.hk 下蹲重踢"),
    ]
    rows = []
    meta = []
    for cid, anim, tag, label in pilots:
        poses = json.load(open(os.path.join(PROJ, f"art-work/poses/{cid}.json")))
        a = poses["anims"][anim]
        acts = [i for i, f in enumerate(a["frames"]) if f.get("active")]
        # 原图集帧
        atlasj = json.load(open(os.path.join(PROJ, f"public/assets/meilong/{cid}/atlas.json")))
        fw, fh, cols = atlasj["frameW"], atlasj["frameH"], atlasj["columns"]
        idxs = atlasj["animations"][anim]["frames"]
        atlas = Image.open(os.path.join(PROJ, f"public/assets/meilong/{cid}/atlas.png")).convert("RGB")
        orig = [atlas.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh)) for r, c in (divmod(i, cols) for i in idxs)]
        old_strike = acts[len(acts) // 2] if acts else None
        # Wan 新帧 + 出招帧（人工指定，确保在采样里）
        wf = wan_frames(tag)
        nw = len(wf)
        attack_idx = max(0, min(nw - 1, ATTACK_FRAME.get(tag, 1) - 1))
        sample = sorted(set(int(i * (nw - 1) / 11) for i in range(12))) if nw > 12 else list(range(nw))
        if attack_idx not in sample:
            near = min(sample, key=lambda s: abs(s - attack_idx))
            sample = sorted(set(sample) - {near} | {attack_idx})
        wf_s = [wf[i] for i in sample]
        new_strike = sample.index(attack_idx)
        os_ = strip(orig, 300, old_strike)
        ws = strip(wf_s, 300, new_strike)
        rows.append((label, os_, ws, nw, attack_idx + 1))
        meta.append(f"{label}: 原{len(orig)}帧 active源帧={acts} | Wan {nw}帧 出招帧=输出f{attack_idx+1}")
    # 组装
    pad = 24
    maxw = max(max(o.width, w.width) for _, o, w, *_ in rows)
    title_h = 64
    row_gap = 40
    label_h = 34
    note_h = 26
    H = title_h + sum(o.height + label_h + note_h + row_gap for _, o, w, *_ in rows) + pad
    W = maxw * 2 + pad * 3
    canvas = Image.new("RGB", (W, H), (18, 18, 20))
    dr = ImageDraw.Draw(canvas)
    tf = load_font(28); lf = load_font(19); nf = load_font(15)
    dr.text((pad, 14), "Wan2.2-Animate 试点对比（新骨架·无拉骨·官方 umt5/clip_vision）", fill=(255, 255, 255), font=tf)
    y = title_h
    for label, os_, ws, nw, aframe in rows:
        dr.text((pad, y), label, fill=(255, 210, 80), font=lf); y += label_h
        dr.text((pad, y + 6), "原图集（当前游戏）", fill=(160, 160, 170), font=lf)
        dr.text((pad + maxw + pad, y + 6), f"Wan Animate 新帧（{nw}帧采样12）", fill=(120, 220, 120), font=lf)
        y += 26
        canvas.paste(os_, (pad, y))
        canvas.paste(ws, (pad + maxw + pad, y))
        y += os_.height + 6
        dr.text((pad + maxw + pad, y), f"注：动作集中在前~14帧，之后为静态定格（49驱动帧映射+模型时延）", fill=(120, 150, 200), font=nf)
        y += note_h + row_gap
    out = os.path.join(REVIEW, "animate-pilot.png")
    canvas.save(out)
    print("saved", out, canvas.size)
    for m in meta: print(m)

if __name__ == "__main__":
    main()
