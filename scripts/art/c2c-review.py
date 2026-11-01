#!/usr/bin/env python3
# C2 表情区分度 QC 蒙太奇：每角色 4 表情并排（上行全身、下行脸部放大），
# 另出一张 7 角色总览。供 vision 验收"四表情肉眼可辨 + 身份未漂移"。
# 用法：python3 scripts/art/c2c-review.py [c03 ...]
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
PORTS = ROOT / "public/assets/meilong/portraits"
BOXES = json.loads((ROOT / ".check/face-bboxes.json").read_text())
EXPR = ["normal", "angry", "smug", "hurt"]
CELL_H = 512
FACE_H = 300
LABEL_H = 44


def face_crop(im, box, pad=1.7):
    x, y, w, h = box["x"], box["y"], box["w"], box["h"]
    cw, ch = int(w * pad), int(h * pad)
    cx, cy = x + w // 2, y + int(h * 0.55)
    x0, y0 = max(0, cx - cw // 2), max(0, cy - ch // 2)
    return im.crop((x0, y0, min(im.width, x0 + cw), min(im.height, y0 + ch)))


def label(d, text, x, y, color=(255, 255, 255)):
    d.text((x, y), text, fill=color)


def main():
    ids = sys.argv[1:] or ["c0%d" % i for i in range(2, 9)]
    out_all = ROOT / ".check/c2c-review-all.png"
    strips = []
    for cid in ids:
        row1, row2 = [], []
        for expr in EXPR:
            im = Image.open(PORTS / cid / (expr + ".png")).convert("RGBA")
            scale = CELL_H / im.height
            row1.append(im.resize((int(im.width * scale), CELL_H)))
            box = BOXES.get(cid + "/" + expr)
            if box:
                fc = face_crop(im, box)
                scale = FACE_H / fc.height
                row2.append(fc.resize((int(fc.width * scale), FACE_H)))
            else:
                row2.append(im.resize((int(im.width * CELL_H / 1.6), CELL_H)))
        W = sum(i.width for i in row1) + 8 * (len(row1) + 1)
        H = LABEL_H + CELL_H + 10 + FACE_H + 10
        canvas = Image.new("RGB", (W, H), (30, 32, 38))
        x = 8
        for i, (full, fc) in enumerate(zip(row1, row2)):
            bg = Image.new("RGB", full.size, (216, 216, 216))
            bg.paste(full, mask=full.split()[3])
            canvas.paste(bg, (x, LABEL_H))
            bg2 = Image.new("RGB", fc.size, (216, 216, 216))
            bg2.paste(fc, mask=fc.split()[3]) if fc.mode == "RGBA" else canvas.paste(fc, (x, LABEL_H + CELL_H + 10))
            if fc.mode == "RGBA":
                canvas.paste(bg2, (x, LABEL_H + CELL_H + 10))
            else:
                canvas.paste(fc, (x, LABEL_H + CELL_H + 10))
            d = ImageDraw.Draw(canvas)
            label(d, "%s %s" % (cid.upper(), EXPR[i]), x + 4, 8)
            x += full.width + 8
        p = ROOT / (".check/c2c-review-%s.png" % cid)
        canvas.save(p)
        strips.append(canvas)
        print("saved", p)
    if len(strips) > 1:
        s = strips[0]
        scale = 0.45
        resized = [c.resize((int(c.width * scale), int(c.height * scale))) for c in strips]
        W = max(i.width for i in resized)
        H = sum(i.height for i in resized) + 10 * (len(resized) - 1)
        big = Image.new("RGB", (W, H), (20, 22, 26))
        y = 0
        for c in resized:
            big.paste(c, (0, y))
            y += c.height + 10
        big.save(out_all)
        print("saved", out_all)


if __name__ == "__main__":
    main()
