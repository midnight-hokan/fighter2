#!/usr/bin/env python3
# C2 表情区分度（INBOX 07:25/07:30 队列第 1 条）：
# c02–c08 的 4 个表情立绘"几乎一样"（denoise 0.6 把脸锁死），
# 修法：只对脸部做局部重绘，身体/衣服/发型 100% 保持原图。
#
# 管线（Qwen-Image-Edit-2511 局部重绘）：
#   1) 原图 RGBA 合成到 #d8d8d8 灰底 → comp
#   2) VLM 脸部 bbox（scripts/art/face-bboxes.py → .check/face-bboxes.json）
#      → 内缩椭圆 mask，高斯羽化（混接缝落在皮肤上，不压头发/脸型轮廓）
#   3) Python 侧把 comp 的脸部区域填中灰（软边）→ 上传
#   4) ComfyUI：Edit-2511 看"脸部被遮住"的图 + 夸张表情提示词，denoise=1.0 全图重绘
#   5) Python 侧用羽化 mask 把新脸混回 comp（mask 外 = 原图像素，身体逐位不变），
#      再按原 alpha 合成 RGBA → 覆盖 portraits/<cid>/<expr>.png
#   6) QC：gen-c2 verify_portrait（身份色相签名）；同一角色 4 张脸部两两差异看 montage
#
# 用法：
#   python3 scripts/art/gen-c2c.py                  # 全量 c02–c08 ×4
#   CHARS=c03 python3 scripts/art/gen-c2c.py        # 只跑指定角色
#   SEED_SALT=1 换种子簇；DRY=1 只出图不覆盖 public/；NOBLANK=1 条件图不遮灰（只改表情）
# 断点：art-work/c2/express-c/<cid>_<expr>_fin.png 存在则跳过。

import importlib.util
import json
import os
import sys
import time
import zlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("genc2", ROOT / "scripts" / "art" / "gen-c2.py")
genc2 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(genc2)

EXPR = ["normal", "angry", "smug", "hurt"]
# 表情提示词按 Claude 要求写夸张（INBOX 07:25）
EXPRESSION = {
    "normal": "平静自然，眼神坚定，微微抿嘴，神态沉稳",
    "angry": "愤怒，眉头紧皱，眼神锐利凶狠，咬紧牙关露出牙齿",
    "smug": "得意，斜着眼，嘴角大幅上扬坏笑，微微眯眼",
    "hurt": "痛苦，闭着一只眼，咧嘴吃痛，眉头皱起",
}
BG = (216, 216, 216)          # #d8d8d8，与 gen-c2 管线一致
BLANK = np.array([128.0, 128.0, 128.0])   # 脸部区域填充的中灰

PORTS = ROOT / "public/assets/meilong/portraits"
WORK = ROOT / "art-work/c2/express-c"
BBX = ROOT / ".check/face-bboxes.json"
HELMET = {"c02": "红", "c04": "白", "c08": "蓝"}


def log(msg):
    print(time.strftime("%H:%M:%S ") + msg, flush=True)


def face_mask(box, W, H):
    """VLM bbox → 内缩椭圆 mask（羽化），float 0–1，1=重绘区。
    内缩保证混接缝落在脸内部（皮肤上），不压头发/脸型轮廓。
    TIGHT=1：椭圆下移到脸下半部（眉/眼/嘴），额头/发际线/太阳穴留在 mask 外
    （那里逐位保留底图像素）——2026-11-02 c03/hurt 重做时模型重画的发际线
    灰雾从羽化区渗漏，收紧后发际线不再被重绘。"""
    x, y, w, h = box["x"], box["y"], box["w"], box["h"]
    if os.environ.get("TIGHT") == "1":
        cx, cy = x + w / 2, y + h * 0.62
        rx, ry = w * 0.40, h * 0.36
        blur = max(3.0, w * 0.04)
    else:
        cx, cy = x + w / 2, y + h * 0.55
        rx, ry = w * 0.46, h * 0.50
        blur = max(4.0, w * 0.05)
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    arr = np.clip(1.0 - d, 0, 1)
    m = Image.fromarray((arr * 255).astype(np.uint8), "L")
    m = m.filter(ImageFilter.GaussianBlur(blur))   # 过渡带
    return np.array(m).astype(float) / 255.0


def prompt_for(expr, cid, noblank=False):
    if noblank:
        # NOBLANK：条件图保留原脸（不遮灰），让 Edit 模型看到脸只改表情。
        # 遮灰模式下 c07/c08 模型看不到原脸，要么照抄原脸要么脸区画空（2026-11-02）。
        return (
            "把图中这个人的表情改成：%s。表情要夸张、清晰可辨，" % EXPRESSION[expr]
            + "严格保持同一身份：脸型、肤色、五官比例、发型、帽子、衣服、道具、姿势、背景全部原样不变，只改脸部表情。"
            + "脸必须和头、耳朵、脖子自然衔接，改动要平滑自然。"
            + "厚涂赛璐璐风格，干净线稿，色块分明，与画面其余部分画风完全一致。"
        )
    if cid in HELMET:
        hat = f"头顶戴着{HELMET[cid]}色安全帽，保持不变。"
    else:
        hat = "头上不戴帽子，保持与图中完全相同的发型和发际线。"
    return (
        "图中人物的脸部区域被一块灰色遮住了。请补全灰色区域：画出这个人的脸"
        "（额头到下巴），脸朝向右侧（3/4 侧面，与图中头部方向一致）。"
        + hat
        + f"表情：{EXPRESSION[expr]}，表情要夸张、清晰可辨。"
        + "严格保持与图中相同的脸型、肤色、五官比例，脸必须和头、耳朵、脖子自然衔接，"
        + "灰色区域边缘要与周围皮肤平滑过渡。"
        + "厚涂赛璐璐风格，干净线稿，色块分明，与画面其余部分画风完全一致。"
        + "灰色区域以外的头发、帽子、衣服、道具、背景全部保持原样，不要改动。"
    )


def wf_inpaint(img_name, prompt, seed, prefix):
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": genc2.EDIT_UNET, "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": genc2.CLIP, "type": "qwen_image"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": genc2.VAE}},
        "4": {"class_type": "LoadImage", "inputs": {"image": img_name}},
        "5": {"class_type": "TextEncodeQwenImageEditPlus",
              "inputs": {"clip": ["2", 0], "prompt": prompt, "image1": ["4", 0], "vae": ["3", 0]}},
        "6": {"class_type": "EmptySD3LatentImage", "inputs": {"width": 768, "height": 1024, "batch_size": 1}},
        "7": {"class_type": "KSampler",
              "inputs": {"model": ["1", 0], "positive": ["5", 0], "negative": ["5", 0],
                         "latent_image": ["6", 0], "seed": seed, "steps": 18, "cfg": 1.0,
                         "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["3", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": prefix}},
    }


def blend_face(orig_rgba, new_rgb, m):
    """羽化混回：m=1 处取新脸，m=0 处保持原图像素；alpha 通道不动。"""
    o = np.array(orig_rgba).astype(float)
    n = np.array(new_rgb).astype(float)
    a = o[:, :, 3:4] / 255.0
    mix = o[:, :, :3] * (1.0 - m[:, :, None]) + n[:, :, :3] * m[:, :, None]
    # 半透明边缘（alpha<255）保持原样，只在完全不透明区混入新脸
    out = np.concatenate([mix * a + o[:, :, :3] * (1 - a), o[:, :, 3:4]], axis=2)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), "RGBA")


def face_skin_ok(dec_rgb, m):
    """mask 核心区（m>0.5）里肤色像素占比：抓"脸没画出来/灰块残留"。
    校准（2026-11-01）：本画风脸饱和度低，真人脸 ≈0.145，纯灰块 =0.000，
    阈值取 0.10 留 40% 余量。戴帽角色帽檐（红/蓝）hue 也在 0–45 内会加分，可接受。"""
    # _hsv_vec 内部会 /255，这里传 0-255 原值，勿预除
    px = np.array(dec_rgb).astype(float)
    h, s, v = genc2._hsv_vec(px[m > 0.5])
    skin = (h >= 0) * (h <= 45) * (s > 0.05) * (v > 0.35)
    return float(skin.mean())


def mask_gray_ratio(res_rgba, m, s_th=0.08, v_lo=0.55, v_hi=0.93):
    """mask 核心区（m>0.5）低饱和高亮灰像素占比（INBOX 2026-11-02：>3% 判遮灰残留）。
    只算不透明像素（alpha>250）：角色外是透明背景，合成底 #d8d8d8 本身就是
    低饱和高亮灰，不算进来；v_hi 排除近白（牙齿/白安全帽）。
    2026-11-02 c05/normal 鬼脸灰雾 + c03 拳上灰雾均逃过 skin/identity 检查，此条兜底。
    校准：脸 mask 正确时干净脸 0–2.7%，灰雾残留 4%+（c05/normal 4.4%、c03/hurt 3.7%）。"""
    a = np.array(res_rgba)
    opq = (m > 0.5) & (a[:, :, 3] > 250)
    px = np.array(res_rgba).astype(float)[opq]
    if px.shape[0] == 0:
        return 0.0
    h, s, v = genc2._hsv_vec(px)
    return float(((s < s_th) * (v > v_lo) * (v < v_hi)).sum() / px.shape[0])


def main():
    dry = os.environ.get("DRY") == "1"
    salt = int(os.environ.get("SEED_SALT", "0"))
    noblank = os.environ.get("NOBLANK") == "1"
    _chars = os.environ.get("CHARS", "").strip()
    ids = [c.strip() for c in _chars.split(",") if c.strip()] if _chars else ["c0%d" % i for i in range(2, 9)]
    boxes = json.loads(BBX.read_text())
    WORK.mkdir(parents=True, exist_ok=True)
    genc2.UPLOAD.mkdir(parents=True, exist_ok=True)
    ok = fail = skip = 0
    for cid in ids:
        refsig = genc2.ref_hue_sig(str(ROOT / "docs/art-review" / (cid + "-portrait.png")))
        for expr in EXPR:
            key = cid + "/" + expr
            done_p = WORK / ("f2c2c_%s_%s_done" % (cid, expr))
            if done_p.exists():
                skip += 1
                continue
            box = boxes.get(key)
            if not box:
                log("FAIL %s 无脸部 bbox（face-bboxes.py 未检出），跳过" % key)
                fail += 1
                continue
            out = PORTS / cid / (expr + ".png")
            orig = Image.open(out).convert("RGBA")
            comp = Image.new("RGB", orig.size, BG)
            comp.paste(orig, mask=orig.split()[3])
            m = face_mask(box, orig.width, orig.height)
            if noblank:
                blanked = np.array(comp)          # 不遮灰：条件图保留原脸
            else:
                blanked = (np.array(comp).astype(float) * (1 - m[:, :, None])
                           + BLANK[None, None, :] * m[:, :, None])
            img_name = "f2c2c_%s_%s.png" % (cid, expr)
            (genc2.UPLOAD / img_name).unlink(missing_ok=True)
            Image.fromarray(blanked.clip(0, 255).astype(np.uint8), "RGB").save(genc2.UPLOAD / img_name)
            base_seed = 70261100 + int(cid[1:]) * 100000 + zlib.crc32((cid + expr + "c").encode()) % 90000 + salt * 7919
            prefix = "f2c2c_%s_%s" % (cid, expr)
            qc_p = WORK / (prefix + "_qc.png")
            good = False
            for attempt in range(3):
                try:
                    fp = genc2.OUTPUT / (prefix + "_0.png")
                    if fp.exists():
                        fp.unlink()
                    seed = base_seed + attempt * 1000003
                    found, dt = genc2.run(wf_inpaint(img_name, prompt_for(expr, cid, noblank), seed, prefix), [prefix])
                    dec = Image.open(found[prefix]).convert("RGB")
                    skin = face_skin_ok(dec, m)
                    result = blend_face(orig, dec, m)
                    result.save(qc_p)
                    good_p, why = genc2.verify_portrait(str(qc_p), refsig)
                    if not good_p:
                        log("bad %s_%s [qc %s] try%d" % (cid, expr, why, attempt + 1))
                        continue
                    if skin < 0.10:
                        log("bad %s_%s [脸区肤色占比 %.3f < 0.10] try%d" % (cid, expr, skin, attempt + 1))
                        continue
                    gray_r = mask_gray_ratio(result, m)
                    if gray_r > 0.03:
                        log("bad %s_%s [mask区遮灰残留 %.2f%% > 3%%] try%d" % (cid, expr, gray_r * 100, attempt + 1))
                        continue
                    # 脸区实际变化量：模型照抄原脸（表情没生效）时 diff≈0（c07/c08 教训 2026-11-02）。
                    # normal 是静止表情：NOBLANK 下"保持原脸"就是正确结果，跳过此项（skin+qc 仍把关）。
                    if expr != 'normal':
                        od = np.array(orig.convert("RGB")).astype(float)
                        nd = np.array(result.convert("RGB")).astype(float)
                        core = (m > 0.7).reshape(-1)
                        delta = float(np.abs(nd[:, :, :3].reshape(-1, 3) - od.reshape(-1, 3))[core].mean())
                        if delta < 8.0:
                            log("bad %s_%s [脸区平均变化 %.1f < 8.0 表情未生效] try%d" % (cid, expr, delta, attempt + 1))
                            continue
                    if dry:
                        result.save(WORK / (prefix + "_preview.png"))
                        log("dry %s_%s skin=%.2f (%.0fs)" % (cid, expr, skin, dt))
                    else:
                        result.save(out)
                        done_p.write_text(json.dumps({"seed": seed, "skin": round(skin, 3),
                                                      "ts": int(time.time())}))
                        log("ok %s_%s skin=%.2f (%.0fs)" % (cid, expr, skin, dt))
                    ok += 1
                    good = True
                    break
                except RuntimeError as e:
                    log("err %s_%s: %s (try%d)" % (cid, expr, str(e)[:200], attempt + 1))
            if not good:
                fail += 1
                log("FAIL %s_%s（3 次失败，留待处理）" % (cid, expr))
            genc2.hb()
    log("C2C done: ok=%d fail=%d skip=%d dry=%s" % (ok, fail, skip, dry))


if __name__ == "__main__":
    main()
