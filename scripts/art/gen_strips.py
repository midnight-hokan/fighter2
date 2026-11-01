#!/usr/bin/env python3
# A2 场景图片条带生成（2026-11-01）：程序化像素剪影，与 R2 程序化背景同风格。
# 无缝保证：高度场 = 整数频率正弦和（周期恰为 W）；重复元素间距整除 W；
# 随机细节只依赖 (x // 单元宽) mod 单元数，平铺后逐像素一致。
# 输出 public/assets/meilong/stages/<sid>/{far,near}.png（RGBA，透明底，剪影贴条带底边）。
import math
import random
from pathlib import Path

from PIL import Image

W = 1024
ROOT = Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "public" / "assets" / "meilong" / "stages"


def rng(seed):
    return random.Random(seed)


def hmap(W, base, terms, seed):
    """周期 W 的高度场：terms = [(频率, 振幅)]。返回每像素高度。"""
    r = rng(seed)
    phases = [r.uniform(0, 2 * math.pi) for _ in terms]
    out = []
    for x in range(W):
        v = base
        for (k, a), ph in zip(terms, phases):
            v += a * math.sin(2 * math.pi * k * x / W + ph)
        out.append(max(2, int(round(v))))
    return out


def fill_silhouette(img, hs, color):
    """从条带底边向上填充剪影。hs: 每像素高度。"""
    W_, H = img.size
    px = img.load()
    for x in range(W_):
        top = H - hs[x]
        for y in range(top, H):
            px[x, y] = color


def cells_periodic(n_cells, W):
    return W // n_cells


def add_windows(img, hs, color, win_color, seed, w=2, hgt=3, gap_x=12, gap_y=9, yoff=8, density=0.28):
    """建筑窗户：格点位置由 (cell 索引) 确定性决定，周期与条带一致。"""
    r = rng(seed)
    rolls = [r.random() for _ in range(2048)]
    px = img.load()
    W_, H = img.size
    maxc = len(rolls)
    for x in range(0, W_ - w, gap_x):
        for y in range(H - hs[x] + yoff, H - 6, gap_y):
            c = (x // gap_x) * 31 + (y // gap_y) * 7
            if rolls[c % maxc] < density:
                for dx in range(w):
                    for dy in range(hgt):
                        if 0 <= x + dx < W_ and 0 <= y + dy < H:
                            px[x + dx, y + dy] = win_color


def add_lamp(img, x, y, color, glow=(242, 193, 78), glow_a=46, core=None):
    """灯：半透明光晕 + 实色灯芯。x 可为负/超宽（跨边部分画两次保证平铺）。"""
    W_, H = img.size
    px = img.load()
    for xx in (x, x - W_, x + W_):
        for dx in range(-7, 8):
            for dy in range(-8, 9):
                X, Y = xx + dx, y + dy
                if 0 <= X < W_ and 0 <= Y < H:
                    d = abs(dx) + abs(dy)
                    if d <= 7:
                        old = px[X, Y]
                        a = glow_a * (1 - d / 9)
                        px[X, Y] = (
                            min(255, int(old[0] * (1 - a / 255) + glow[0] * a / 255)),
                            min(255, int(old[1] * (1 - a / 255) + glow[1] * a / 255)),
                            min(255, int(old[2] * (1 - a / 255) + glow[2] * a / 255)),
                            255,
                        )
        if core and 0 <= xx - 1 < W_ and 0 <= y - 2 < H:
            for dx in range(-1, 2):
                for dy in range(-2, 3):
                    X, Y = xx + dx, y + dy
                    if 0 <= X < W_ and 0 <= Y < H:
                        px[X, Y] = core


def add_pole_lamp(img, x, top_y, ground_h, color, glow=(242, 193, 78)):
    """立柱灯：杆 + 顶部灯芯光晕。"""
    W_, H = img.size
    px = img.load()
    for xx in (x, x - W_, x + W_):
        for y in range(top_y, H):
            if 0 <= xx < W_:
                px[xx, y] = color
        add_lamp(img, xx, top_y - 4, (0, 0, 0), glow=glow, glow_a=60, core=(255, 230, 150))


def add_crowd(img, color, seed, n_cells, head_r=2, body_h=14, jitter=6, y_base=None):
    """人群剪影：单元宽整除 W，每单元一人（或空），身高周期重复。"""
    W_, H = img.size
    cell = cells_periodic(n_cells, W)
    r = rng(seed)
    people = []
    for i in range(n_cells):
        if r.random() < 0.85:
            people.append((cell * i + r.randint(0, cell - 4),
                           body_h + r.randint(-2, jitter),
                           head_r + r.randint(0, 1)))
    else_h = [0] * n_cells
    px = img.load()
    for (x, bh, hr) in people:
        top = H - (y_base if y_base is not None else 0) - bh
        for xx in range(x - hr, x + hr + 1):
            for dy in range(hr * 2):
                Y = top + dy
                if 0 <= xx < W_ and 0 <= Y < H:
                    px[xx, Y] = color
        for xx in range(x - 1, x + 2):
            for dy in range(body_h):
                Y = top + hr * 2 + dy
                if 0 <= xx < W_ and 0 <= Y < H:
                    px[xx, Y] = color


def add_beams(img, color, n_beams, post_w=8, cross=True):
    """矿井支架：立柱 + 横担。"""
    W_, H = img.size
    cell = cells_periodic(n_beams, W)
    px = img.load()
    for i in range(n_beams):
        x = i * cell + cell // 2
        for y in range(6, H):
            for dx in range(post_w):
                if 0 <= x + dx < W_:
                    px[x + dx, y] = color
        if cross:
            for y in range(8, 14):
                for dx in range(-24, 25):
                    X = x + post_w // 2 + dx
                    if 0 <= X < W_:
                        px[X, y] = color
            for y in range(60, 66):
                for dx in range(-20, 21):
                    X = x + post_w // 2 + dx
                    if 0 <= X < W_:
                        px[X, y] = color


def add_pillars(img, color, n_pillars, pw=18, top=16):
    W_, H = img.size
    cell = cells_periodic(n_pillars, W)
    px = img.load()
    for i in range(n_pillars):
        x = i * cell + cell // 2
        for y in range(top, H):
            for dx in range(pw):
                if 0 <= x + dx < W_:
                    px[x + dx, y] = color


def add_stars(img, color, n, seed, h_limit=None):
    W_, H = img.size
    cell = W // n
    r = rng(seed)
    px = img.load()
    for i in range(n):
        x = i * cell + r.randint(2, cell - 3)
        y = r.randint(2, (h_limit if h_limit else H - 20))
        px[x, y] = color
        if r.random() < 0.3:
            px[min(x + 1, W_ - 1), y] = color


def save(tag, img):
    sid, name = tag.split("/")
    d = OUT / sid
    d.mkdir(parents=True, exist_ok=True)
    img.save(d / (name + ".png"))
    return d / (name + ".png")


def stage_s01():
    far = Image.new("RGBA", (W, 96), (0, 0, 0, 0))
    fill_silhouette(far, hmap(W, 34, [(1, 10), (2, 7), (3, 5), (5, 3)], 11), (33, 22, 15))
    save("s01/far", far)
    near = Image.new("RGBA", (W, 160), (0, 0, 0, 0))
    add_beams(near, (58, 42, 28), 8)
    save("s01/near", near)


def stage_s02():
    far = Image.new("RGBA", (W, 96), (0, 0, 0, 0))
    hs = hmap(W, 44, [(1, 8), (2, 9), (4, 6)], 21)
    fill_silhouette(far, hs, (51, 32, 46))
    add_windows(far, hs, (51, 32, 46), (242, 193, 78), 22, density=0.22)
    save("s02/far", far)
    near = Image.new("RGBA", (W, 160), (0, 0, 0, 0))
    add_crowd(near, (31, 18, 25), 23, n_cells=48, body_h=16)
    save("s02/near", near)


def stage_s03():
    far = Image.new("RGBA", (W, 96), (0, 0, 0, 0))
    fill_silhouette(far, hmap(W, 22, [(1, 6), (2, 5), (3, 3)], 31), (20, 31, 48))
    add_stars(far, (207, 224, 255), 42, 32, h_limit=60)
    save("s03/far", far)
    near = Image.new("RGBA", (W, 160), (0, 0, 0, 0))
    fill_silhouette(near, hmap(W, 26, [(1, 6), (2, 4), (5, 2)], 33), (14, 22, 38))
    save("s03/near", near)


def stage_s04():
    far = Image.new("RGBA", (W, 128), (0, 0, 0, 0))
    hs = hmap(W, 52, [(1, 10), (2, 12), (3, 7)], 41)
    fill_silhouette(far, hs, (51, 20, 16))
    add_windows(far, hs, (51, 20, 16), (255, 154, 60), 42, density=0.3)
    save("s04/far", far)
    near = Image.new("RGBA", (W, 160), (0, 0, 0, 0))
    add_beams(near, (84, 40, 26), 8, post_w=10)
    for i in range(4):
        x = i * 256 + 160
        for dx in range(-16, 17):
            for dy in range(-14, 0):
                X, Y = x + dx, 158 + dy
                if 0 <= X < W and 0 <= Y < 160:
                    d = abs(dx) / 16 + abs(dy) / 14
                    if d < 1:
                        a = int(90 * (1 - d))
                        old = near.load()[X, Y]
                        near.load()[X, Y] = (
                            min(255, int(old[0] * (1 - a / 255) + 255 * a / 255)),
                            min(255, int(old[1] * (1 - a / 255) + 120 * a / 255)),
                            int(old[2] * (1 - a / 255)),
                            255)
    save("s04/near", near)


def stage_s05():
    far = Image.new("RGBA", (W, 128), (0, 0, 0, 0))
    hs = hmap(W, 46, [(1, 8), (2, 10), (4, 6)], 51)
    fill_silhouette(far, hs, (36, 26, 48))
    add_windows(far, hs, (36, 26, 48), (255, 217, 138), 52, density=0.24)
    add_stars(far, (255, 233, 201), 52, 53, h_limit=70)
    save("s05/far", far)
    near = Image.new("RGBA", (W, 160), (0, 0, 0, 0))
    add_crowd(near, (21, 15, 30), 54, n_cells=56, body_h=15)
    save("s05/near", near)


def stage_s06():
    far = Image.new("RGBA", (W, 160), (0, 0, 0, 0))
    add_crowd(far, (28, 36, 24), 61, n_cells=64, body_h=13, jitter=5)
    add_crowd(far, (28, 36, 24), 62, n_cells=48, body_h=20, jitter=7, y_base=26)
    save("s06/far", far)
    near = Image.new("RGBA", (W, 160), (0, 0, 0, 0))
    add_pillars(near, (44, 56, 38), 4, pw=18, top=12)
    save("s06/near", near)


for fn in (stage_s01, stage_s02, stage_s03, stage_s04, stage_s05, stage_s06):
    fn()
    print(fn.__name__, "ok")
print("STRIPS DONE")
