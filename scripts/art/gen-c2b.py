#!/usr/bin/env python3
# C2 表情立绘修正批（img2img 重绘，2026-11-01 看门狗轮）：
# 初批 gen-c2.py 用 edit-plus + 空 latent denoise=1.0，身份漂移严重
# （无帽角色被加帽、c03_angry 换绿夹克、c07_smug 变仙女、多张全身图混入半身位）。
# 修法：定稿立绘(docs/art-review/<cid>-portrait.png)预裁半身构图(768×1024)
#   → VAEEncode 做 latent 底 → Qwen-Image-Edit-2511 img2img（denoise 可配，默认 0.6）
#   → BiRefNet 抠透明 → QC（复用 gen-c2.py verify_portrait：面积/裁切/色相签名≥0.70）
#   → 覆盖 public/assets/meilong/portraits/<cid>/<expr>.png
# 提示词按角色区分"戴帽/不戴帽"，无帽角色负向加"安全帽，头盔"防加帽。
# 用法：python3 scripts/art/gen-c2b.py [denoise]   # 默认 0.6
#   SEED_SALT=<n> 换种子簇；PAIRS=c01:hurt,c03:angry 只跑指定对（默认全部 TARGETS）。
# 断点：不自动跳过（本脚本只跑 QC 失败对，会覆盖旧图）。

import importlib.util
import os
import sys
import zlib
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("genc2", ROOT / "scripts" / "art" / "gen-c2.py")
genc2 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(genc2)

TARGETS = [
    ("c01", "hurt"),
    ("c02", "angry"), ("c02", "hurt"),
    ("c03", "normal"), ("c03", "angry"), ("c03", "smug"), ("c03", "hurt"),
    ("c04", "normal"), ("c04", "angry"), ("c04", "smug"), ("c04", "hurt"),
    ("c05", "normal"), ("c05", "angry"), ("c05", "smug"), ("c05", "hurt"),
    ("c06", "normal"), ("c06", "angry"), ("c06", "smug"), ("c06", "hurt"),
    ("c07", "normal"), ("c07", "angry"), ("c07", "smug"), ("c07", "hurt"),
    ("c08", "normal"), ("c08", "angry"), ("c08", "hurt"),
]

# 定稿立绘戴帽角色（无帽角色提示词明令不戴帽 + 负向加安全帽）
HELMET = {"c01": "黄", "c02": "红", "c04": "白", "c08": "蓝"}

RAWB = ROOT / "art-work" / "c2" / "raw-portraits-b"


def p2b_prompt(expr, cid):
    if cid == "c02":
        hat = "红色安全帽保持不变，脸露出来（脸上不戴面罩和呼吸器面罩）。"
    elif cid in HELMET:
        hat = f"安全帽的颜色和款式保持不变（{HELMET[cid]}色安全帽）。"
    else:
        hat = "头上没有安全帽，保持与参考图完全相同的发型（不戴任何帽子）。"
    return (
        "以这张半身像为唯一基础，只修改面部表情，其余一切保持不变。"
        f"表情：{genc2.EXPRS[expr]}。"
        + hat
        + "严格保持同一张脸、同样的发型、服装、配色、道具完全不变，必须是同一个人。"
        + "半身构图不变（头部到胸部），人物完整居中，绝不被画面边缘裁切。"
        + "背景必须是均匀纯浅灰色（#d8d8d8），整块纯色无渐变。"
        + "厚涂赛璐璐风格，干净线稿，色块分明，无文字，无水印，无特效。"
    )


def p2b_neg(cid):
    base = "低质量，模糊，变形，多余手指，多余肢体，水印，文字，变成另一个人，服装改变，" \
           "3D，写实照片，全身，裁切，出框，头部被切，身体被切，贴边"
    if cid not in HELMET:
        base += "，安全帽，头盔，戴帽子"
    return base


def halfbody_ref(cid):
    """定稿立绘 → 半身构图 768×1024 底图，传 ComfyUI input。
    有初批合格表情立绘的角色（c01/c02/c08）直接用其原图做底（构图/留白已被 QC 验证）；
    其余（c03–c07）用定稿立绘头顶到腰部的自然宽幅裁切（含道具）letterbox 到 #d8d8d8 画布，
    人物占宽 ~79%、头顶留 ~100px，避免 img2img 后人物贴边/头顶贴边。"""
    name = "f2c2b_ref_" + cid + ".png"
    dst = genc2.UPLOAD / name
    # c01 底图用 c01_angry（对定稿色相 0.808、蓝色工作服饱和度高）；c01_normal 底图
    # 的钢蓝工作服饱和度不足（色相仅 0.48），img2img 会继承其偏色导致 QC 色相卡 0.49。
    raw_base = {"c01": "c01_angry", "c02": "c02_smug", "c08": "c08_smug"}
    if cid in raw_base:
        if not dst.exists():
            src = ROOT / "art-work" / "c2" / "raw-portraits" / (raw_base[cid] + ".png")
            Image.open(src).convert("RGB").save(dst)
        return name
    if dst.exists():
        return name
    # c03–c07：定稿立绘（1024×1024 均匀浅灰底）→ 头顶到腰部的自然宽幅裁切（含道具），
    # 等比缩到宽 ~604px（人物占画布 79%）贴到 768×1024 #d8d8d8 画布、头顶 ~100px 留白。
    # 不硬压 3:4 裁切（道具会撑满贴边），letterbox 保证 img2img 后人物不贴边、构图为半身。
    im = Image.open(ROOT / "docs" / "art-review" / (cid + "-portrait.png")).convert("RGB")
    a = np.array(im).astype(float)
    corners = [a[:40, :40], a[:40, -40:], a[-40:, :40], a[-40:, -40:]]
    bg = np.concatenate([x.reshape(-1, 3) for x in corners]).mean(axis=0)
    mask = np.linalg.norm(a - bg, axis=2) > 40
    ys, xs = np.where(mask)
    y0, y1 = int(ys.min()), int(ys.max())
    bh = max(1, y1 - y0)
    top = max(0, y0 - int(bh * 0.03))
    bot = min(im.height - 1, y0 + int(bh * 0.70))
    band = mask[top:bot, :]
    bys, bxs = np.where(band)
    span = max(1, int(bxs.max() - bxs.min()))
    center = int((bxs.min() + bxs.max()) / 2 + span * 0.02)   # 角色朝右，中心略右移保脸
    cw = int(span * 1.15)
    left = max(0, min(center - cw // 2, im.width - cw))
    crop = im.crop((left, top, left + cw, bot))
    canvas = Image.new("RGB", (768, 1024), (216, 216, 216))
    s = min(695 / crop.width, 932 / crop.height)
    crop = crop.resize((int(crop.width * s), int(crop.height * s)), Image.LANCZOS)
    canvas.paste(crop, ((768 - crop.width) // 2, 72))
    canvas.save(dst)
    return name


def wf_img2img(ref_name, prompt, neg, seed, prefix, denoise):
    raw_p, fin_p = prefix + "_raw", prefix + "_fin"
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": genc2.EDIT_UNET, "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": genc2.CLIP, "type": "qwen_image"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": genc2.VAE}},
        "4": {"class_type": "LoadImage", "inputs": {"image": ref_name}},
        "5": {"class_type": "TextEncodeQwenImageEditPlus",
              "inputs": {"clip": ["2", 0], "prompt": prompt, "image1": ["4", 0], "vae": ["3", 0]}},
        "6": {"class_type": "VAEEncode", "inputs": {"pixels": ["4", 0], "vae": ["3", 0]}},
        "7": {"class_type": "KSampler",
              "inputs": {"model": ["1", 0], "positive": ["5", 0], "negative": ["5", 0],
                         "latent_image": ["6", 0], "seed": seed, "steps": 15, "cfg": 1.0,
                         "sampler_name": "euler", "scheduler": "simple", "denoise": denoise}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["3", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": raw_p}},
        "10": {"class_type": "LoadBackgroundRemovalModel", "inputs": {"bg_removal_name": genc2.BIREFNET}},
        "11": {"class_type": "RemoveBackground", "inputs": {"bg_removal_model": ["10", 0], "image": ["8", 0]}},
        "12": {"class_type": "InvertMask", "inputs": {"mask": ["11", 0]}},
        "13": {"class_type": "JoinImageWithAlpha", "inputs": {"image": ["8", 0], "alpha": ["12", 0]}},
        "14": {"class_type": "SaveImage", "inputs": {"images": ["13", 0], "filename_prefix": fin_p}},
    }


def main():
    denoise = float(sys.argv[1]) if len(sys.argv) > 1 else 0.6
    salt = int(os.environ.get("SEED_SALT", "0"))
    pairs = TARGETS
    if os.environ.get("PAIRS"):
        pairs = [tuple(p.split(":")) for p in os.environ["PAIRS"].split(",")]
    RAWB.mkdir(parents=True, exist_ok=True)
    ok = fail = 0
    for cid, expr in pairs:
        ref = halfbody_ref(cid)
        refsig = genc2.ref_hue_sig(str(ROOT / "docs" / "art-review" / (cid + "-portrait.png")))
        out = genc2.PORTRAITS_OUT / cid / (expr + ".png")
        good = False
        for attempt in range(3):
            try:
                for p in (out,):
                    if p.exists():
                        p.unlink()          # 覆盖旧的不合格图
                for suf in ("_raw", "_fin"):
                    fp = genc2.OUTPUT / ("f2c2b_%s_%s%s_0.png" % (cid, expr, suf))
                    if fp.exists():
                        fp.unlink()
                seed = (60261100 + int(cid[1:]) * 100000
                        + zlib.crc32((cid + expr + "b").encode()) % 90000
                        + salt * 7919 + attempt * 1000003)
                found, dt = genc2.run(
                    wf_img2img(ref, p2b_prompt(expr, cid), p2b_neg(cid), seed,
                               "f2c2b_%s_%s" % (cid, expr), denoise),
                    ["f2c2b_%s_%s_raw" % (cid, expr), "f2c2b_%s_%s_fin" % (cid, expr)])
                raw_src, fin_src = found["f2c2b_%s_%s_raw" % (cid, expr)], found["f2c2b_%s_%s_fin" % (cid, expr)]
                genc2.verify_portrait.__name__  # noqa
                good_p, why = genc2.verify_portrait(fin_src, refsig)
                if not good_p:
                    genc2.log("bad %s_%s [%s] try%d" % (cid, expr, why, attempt + 1))
                    continue
                Image.open(fin_src).convert("RGBA").save(out)
                raw_src.rename(RAWB / ("%s_%s.png" % (cid, expr)))
                genc2.log("ok %s_%s (%.0fs)" % (cid, expr, dt))
                ok += 1
                good = True
                break
            except RuntimeError as e:
                genc2.log("err %s_%s: %s (try%d)" % (cid, expr, str(e)[:200], attempt + 1))
        if not good:
            fail += 1
            genc2.log("FAIL %s_%s（3 次失败，留待处理）" % (cid, expr))
    genc2.hb()
    genc2.log("C2B done: ok=%d fail=%d total=%d denoise=%.2f" % (ok, fail, len(pairs), denoise))


if __name__ == "__main__":
    main()
