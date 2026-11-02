#!/usr/bin/env python3
"""拼 docs/art-review/<cid>-frames.png：idle/walkf/st.hp/cr.hk 全帧 + 每个必杀技/超必杀全帧，供 Claude 看图。
用法：python3 scripts/art/montage-frames.py <cid>
帧文件来自 art-work/frames/<cid>/（gen_frames.py 产出，透明 RGBA）。
"""
import json, sys
from PIL import Image, ImageDraw

ROOT = "/home/yuguang/projects/fighter2"
cid = sys.argv[1]
data = json.load(open(f"{ROOT}/art-work/poses/{cid}.json"))
anims = data["anims"]
F = 128
LBL = 150

# 状态动画（全帧展示）
STATE_SHOW = ["idle", "walkf", "st.hp", "cr.hk"]
# 每人的必杀技 + 超必杀 id（与 theme roster 同步）
MOVE_IDS = {
    "c01": ["meiyan", "chongtian", "xuanfeng", "dengya", "dihuolong"],
    "c02": ["baokong", "tanshui", "chongtianshan", "gousao", "longxuantan"],
    "c03": ["zhongdan", "suiluo", "kengtai", "lansao", "chaozhong"],
    "c04": ["denghua", "shanguang", "jifenghua", "fadanjia", "huaying"],
    "c05": ["denghuadan", "daiteng", "dengzhuo", "hengsaotui", "denghuadrag"],
    "c06": ["shanfengt", "feihua", "jifengdan", "dengliandian", "jifenglong"],
    "c07": ["chongtiant", "zhongdanluo", "zhongkeng", "tuobachongtui", "tongshoulong"],
    "c08": ["huiyan", "huihe", "huayan", "zhenxiansao", "huiyanlong"],
}

rows = []
for a in STATE_SHOW:
    if a in anims:
        rows.append((a, list(range(len(anims[a]["frames"])))))
for a in MOVE_IDS.get(cid, []):
    if a in anims:
        rows.append((a, list(range(len(anims[a]["frames"])))))

maxw = max(len(ix) for _, ix in rows)
W = LBL + maxw * F
H = len(rows) * (F + 8) + 8
sheet = Image.new("RGBA", (W, H), (40, 40, 48, 255))
dr = ImageDraw.Draw(sheet)
for r, (anim, idxs) in enumerate(rows):
    y = 8 + r * (F + 8)
    dr.text((10, y + F // 2 - 8), anim, fill=(255, 220, 120))
    for c, i in enumerate(idxs):
        p = f"{ROOT}/art-work/frames/{cid}/{anim.replace('.', '_')}_{i:02d}.png"
        im = Image.open(p).convert("RGBA").resize((F, F), Image.LANCZOS)
        sheet.paste(im, (LBL + c * F, y), im)
sheet.convert("RGB").save(f"{ROOT}/docs/art-review/{cid}-frames.png", optimize=True)
print("saved", cid, W, "x", H)
