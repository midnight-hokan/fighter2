#!/usr/bin/env python3
"""A1 帧拼图（Claude 审图用）：6 列 × 4 行，每格一帧 + 动画名标注。
默认取 idle/walkf/st.hp/各必杀/超必杀 各几帧；--anim 可指定。
用法：python3 scripts/art/make-contact.py c01 [--anim idle,walkf,st.hp,xuanfeng] [--cols 6] [--rows 4]
输出：docs/art-review/<cid>.png（覆盖）
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent.parent
FRAMES = ROOT / "art-work" / "frames"
OUT = ROOT / "docs" / "art-review"
CELL = 256

DEFAULT_ANIMS = ["idle", "walkf", "walkb", "st.hp", "st.hk", "dizzy",
                 "meiyan", "chongtian", "xuanfeng", "dihuolong"]


def pick(cid, anims, cols, rows):
    slots = cols * rows
    picked = []  # (path, label)
    # 每个动画均匀取最多 3 帧，轮转塞满格子
    per = []
    for a in anims:
        safe = a.replace(".", "_")
        fs = sorted((FRAMES / cid).glob(safe + "_*.png"))
        if not fs:
            continue
        step = max(1, len(fs) // 3)
        for f in fs[::step][:3]:
            per.append((f, f"{a} {f.stem.rsplit('_', 1)[-1]}"))
    # 轮转混排，让不同动画交错
    while per and len(picked) < slots:
        for i in range(0, len(per), 1):
            if len(picked) >= slots:
                break
            picked.append(per.pop(i))
    return picked[:slots]


def main():
    cid = sys.argv[1]
    anims = sys.argv[sys.argv.index("--anim") + 1].split(",") if "--anim" in sys.argv else DEFAULT_ANIMS
    cols = int(sys.argv[sys.argv.index("--cols") + 1]) if "--cols" in sys.argv else 6
    rows = int(sys.argv[sys.argv.index("--rows") + 1]) if "--rows" in sys.argv else 4
    picked = pick(cid, anims, cols, rows)
    if not picked:
        raise SystemExit(f"{cid} 还没有任何帧")
    canvas = Image.new("RGB", (cols * CELL, rows * CELL), (24, 24, 28))
    draw = ImageDraw.Draw(canvas)
    for i, (f, label) in enumerate(picked):
        x, y = (i % cols) * CELL, (i // cols) * CELL
        im = Image.open(f).convert("RGB").resize((CELL, CELL - 18))
        canvas.paste(im, (x, y))
        draw.text((x + 4, y + CELL - 15), label, fill=(255, 255, 255))
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / (cid + ".png")
    canvas.save(out)
    print(f"saved {out} ({len(picked)} frames from {len({l.split()[0] for _, l in picked})} anims)")


if __name__ == "__main__":
    main()
