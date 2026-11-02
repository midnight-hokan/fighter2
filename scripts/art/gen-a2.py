#!/usr/bin/env python3
# A2 场景背景升级（INBOX 19:15 第 10 条 / 07:25）：程序化剪影条带 → Qwen-Image 厚涂条带。
# 设计（保持现有格式，stages.js/渲染器零改动）：
#   - 文件规格不变：1024×96 far / 1024×160 near，RGBA 透明底，物体贴条带底边
#     （透明处仍透出 stages.js 的天空渐变，程序化 lamps/pillars/stars 图层叠加其上）
#   - 生成 1536×256（6:1 宽幅），提示词：扁平 #d8d8d8 纯灰底、无人物、物体横向铺满且留边
#   - 后处理：① 角点采样背景色 + 距离软 ramp 抠灰底 ② 底部锚定
#     ③ 缩到 1024×170 取底边 96/160 行 ④ 左右各 128px alpha 余弦淡出 → 平铺接缝两侧皆透明，天然无缝
#   - 断点：art-work/a2/<sid>_<layer>_done 存在则跳过；SEED_SALT=1 换种子簇重试
# 用法：python3 scripts/art/gen-a2.py [s01 s02 ...]
import importlib.util
import json
import os
import time
import zlib
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("genc2", ROOT / "scripts" / "art" / "gen-c2.py")
genc2 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(genc2)

WORK = ROOT / "art-work/a2"
STAGES_OUT = ROOT / "public/assets/meilong/stages"
GW, GH = 1536, 256          # 生成尺寸（6:1）
RW, RH = 1024, 170          # 缩放后统一高，再取底边
FARE_H, NEAR_H = 96, 160    # 最终条带高
FARE_BAND = 128             # far 取底边 128 行再缩到 96（下采样，物体不切腰）
NEAR_BAND = 160
FADE = 128                  # 左右 alpha 淡出宽
BG_FALLBACK = (216, 216, 216)

STYLE = ("厚涂赛璐璐风格，干净线稿，色块分明，侧视卷轴格斗游戏背景，横向宽幅构图，"
         "物体沿画面全宽自然分布、左右两端各留约十分之一空白不贴边，所有物体底部对齐画面底边，"
         "背景是纯净均匀的浅灰色(#d8d8d8)纯色，无渐变无阴影无地面纹理，画面干净。"
         "空白背景区域必须是纯 #d8d8d8 浅灰，背景里不许出现场景夜色、光晕、雾气、星星、月亮或任何渐变")
STYLE_FAR = ("远景全部物体尺度很小，高度不超过画面高度的四分之一，"
             "画面上方四分之三全部是空白背景，物体稀疏不连续，之间有大片空白背景空隙")
NEG = ("people, humans, characters, face, body, text, words, letters, logo, watermark, "
       "3d render, photorealistic, gradient background, vignette, dark background, "
       "ground texture, floor, horizon line in the middle, busy cluttered, noise")

SCENES = {
    "s01": {  # 废弃矿井，暗棕黑
        "far": "废弃矿井夜景远景：老式矿井井架和天轮、圆形煤仓筒仓、破损的铁路栈桥、零散破旧的矿区平房，个别窗户透出昏黄灯光，空气中有薄雾，暗棕灰色调，物体中小尺寸",
        "near": "废弃矿井夜景前景：锈迹斑斑的铁轨、翻倒的木制矿车、岩石堆、断裂的木梁、散落煤块，暗棕灰色调，物体大且靠近观者",
    },
    "s02": {  # 灯廊夜市，紫红
        "far": "灯廊夜市夜景远景：几栋两层临街店铺，窗户透出暖黄灯光，店铺之间挂着一串串红灯笼，物体色调为紫红夜色调，店铺彼此分开不连续",
        "near": "灯廊夜市夜景前景：木制摊位、成串红灯笼、堆叠的木箱、帆布遮阳棚、暖黄灯笼光晕，物体色调为紫红夜色调，物体大且靠近观者",
    },
    "s03": {  # 炭湖夜渡，深蓝
        "far": "炭湖夜景远景：暗色湖岸线、远处低矮山影、泊岸的煤驳船剪影，物体色调为深蓝夜色调，物体中小尺寸",
        "near": "湖畔码头夜景前景：粗壮木系缆桩、盘绕的粗绳、堆叠木桶、木码头边缘，物体色调为深蓝夜色调，物体大且靠近观者",
    },
    "s04": {  # 高炉之巅，红橙
        "far": "高炉厂区夜景远景：巨型高炉剪影、高耸烟囱、管道架、炉口透出的橙红炉光，物体色调为红橙工业色调，物体中大尺寸",
        "near": "高炉平台夜景前景：只画一根粗管道和一段走道栏杆两个物体，物体色调为红橙工业色调，物体大但彼此分开，物体之间和上方有大片纯灰背景空隙，物体不延伸到画面顶部",
    },
    "s05": {  # 星夜矿镇，深蓝
        "far": "矿镇夜景远景：北方矿区小镇民居屋顶、水塔、风车、零星亮灯的窗户，物体色调为深蓝夜色调，物体中小尺寸",
        "near": "矿镇夜景前景：木栅栏、老式街灯、岩石堆、电线杆与电线，物体色调为深蓝夜色调，物体大且靠近观者",
    },
    "s06": {  # 井下斗场，暗棕
        "far": "地下矿井深洞远景：拱形砖砌隧道洞口、成排的支撑柱、延伸向远处的铁轨、洞口尽头昏黄灯光，物体色调为暗棕色，物体中小尺寸",
        "near": "地下矿井前景：工字钢梁、木质支撑架、岩石堆、悬挂的工业灯、矿车，物体色调为暗棕色，物体大且靠近观者",
    },
}


def log(msg):
    print(time.strftime("%H:%M:%S ") + msg, flush=True)


def wf_t2i(prompt, seed, prefix):
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": genc2.T2I_UNET, "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": genc2.CLIP, "type": "qwen_image"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": genc2.VAE}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": prompt}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": NEG}},
        "6": {"class_type": "EmptySD3LatentImage", "inputs": {"width": GW, "height": GH, "batch_size": 1}},
        "7": {"class_type": "KSampler",
              "inputs": {"model": ["1", 0], "positive": ["4", 0], "negative": ["5", 0],
                         "latent_image": ["6", 0], "seed": seed, "steps": 20, "cfg": 2.5,
                         "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["3", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": prefix}},
    }


def key_bg(rgb: np.ndarray) -> np.ndarray:
    """背景色采样：四角 8×8 中值 vs 顶 16 行中值，取较亮者。
    （模型背景是浅灰 #d8d8d8，物体多为深色；四角可能被物体/雾污染，顶行反之，谁亮谁是背景）"""
    pix = np.concatenate([
        rgb[:8, :8].reshape(-1, 3), rgb[:8, -8:].reshape(-1, 3),
        rgb[-8:, :8].reshape(-1, 3), rgb[-8:, -8:].reshape(-1, 3),
    ]).astype(float)
    corner = np.median(pix, axis=0)
    top = np.median(rgb[:16, :, :].reshape(-1, 3), axis=0)
    bg = corner if corner.sum() >= top.sum() else top
    if np.all(np.abs(bg - np.array(BG_FALLBACK)) < 30):
        pass  # 背景色正常
    else:
        log("  警告：背景采样 %s（corner %s / top %s）偏离 #d8d8d8"
            % (bg.round(0).tolist(), corner.round(0).tolist(), top.round(0).tolist()))
    d = np.linalg.norm(rgb.astype(float) - bg, axis=2)
    a = np.clip((d - 16.0) / (40.0 - 16.0), 0, 1) * 255.0
    # 去噪：3×3 中值
    from PIL import ImageFilter
    a = np.array(Image.fromarray(a.astype(np.uint8), "L").filter(ImageFilter.MedianFilter(3))).astype(float)
    return a


def anchor_bottom(rgba: np.ndarray) -> np.ndarray:
    """底边锚定：最下有内容的行移到条带底边。"""
    rows = np.where((rgba[:, :, 3] > 16).any(axis=1))[0]
    if len(rows) == 0:
        return rgba
    shift = rgba.shape[0] - 1 - rows.max()
    if shift <= 0:
        return rgba
    out = np.zeros_like(rgba)
    out[shift:] = rgba[:rgba.shape[0] - shift]
    return out


def fade_edges(rgba: np.ndarray, fade: int) -> np.ndarray:
    """左右两端 alpha 余弦淡出到 0（边缘列=0，向内 128px 恢复 1）→ 平铺接缝两侧皆透明。"""
    out = rgba.astype(float)
    ramp = (1.0 - np.cos(np.linspace(0, np.pi / 2, fade))) / 2.0   # 0→1（0 在边缘）
    for x in range(fade):
        f = ramp[x]
        out[:, x, 3] *= f
        out[:, out.shape[1] - 1 - x, 3] *= f
    return out.clip(0, 255).astype(np.uint8)


def make_strip(raw_path, layer):
    _L = getattr(Image, "Resampling", Image).LANCZOS
    im = Image.open(raw_path).convert("RGB").resize((RW, RH), _L)
    rgb = np.array(im)
    a = key_bg(rgb)
    band_h = FARE_BAND if layer == "far" else NEAR_BAND
    band = slice(RH - band_h, RH)
    rgba = np.dstack([rgb, a])[band]
    rgba = anchor_bottom(rgba)
    rgba = fade_edges(rgba, FADE)
    img = Image.fromarray(rgba, "RGBA")
    if layer == "far":
        img = img.resize((1024, FARE_H), _L)
    return img


def preview(sid, out_path):
    """假游戏内合成：天空渐变 + far + near，384×224×2 平铺验证。"""
    import re
    m = re.search(r"sky: \['(#\w+)', '(#\w+)'\].*?id: '%s'" % sid,
                  (ROOT / "src/theme/meilong/stages.js").read_text(), re.S)
    if not m:
        m = re.search(r"id: '%s'.*?sky: \['(#\w+)', '(#\w+)'\]" % sid,
                      (ROOT / "src/theme/meilong/stages.js").read_text(), re.S)
    top, bot = m.group(1), m.group(2)

    def hx(c):
        return np.array([int(c[i:i + 2], 16) for i in (1, 3, 5)], float)

    W, H, G = 384, 224, 200
    far = Image.open(STAGES_OUT / sid / "far.png")
    near = Image.open(STAGES_OUT / sid / "near.png")
    sky = np.zeros((H, W, 3), float)
    for y in range(G):
        sky[y] = hx(top) * (1 - y / G) + hx(bot) * (y / G)
    canvas = Image.fromarray(sky.astype(np.uint8))
    for x in range(-far.width, W, far.width):
        canvas.paste(far, (x, G - far.height), far)
    for x in range(-near.width, W, near.width):
        canvas.paste(near, (x, G - near.height), near)
    twin = Image.new("RGB", (W * 2 + 4, H), (40, 40, 40))
    twin.paste(canvas, (0, 0))
    twin.paste(canvas, (W + 4, 0))
    twin.save(out_path)


def main():
    salt = int(os.environ.get("SEED_SALT", "0"))
    sids = [a for a in (sys.argv[1:]) if a in SCENES] if len(__import__("sys").argv) > 1 else list(SCENES)
    WORK.mkdir(parents=True, exist_ok=True)
    ok = fail = skip = 0
    for sid in sids:
        for layer in ("far", "near"):
            key = "%s_%s" % (sid, layer)
            done_p = WORK / (key + "_done")
            if done_p.exists():
                skip += 1
                continue
            prompt = (SCENES[sid][layer] + "。" + STYLE + ("。" + STYLE_FAR if layer == "far" else ""))
            seed = 80110400 + int(sid[1:]) * 100000 + (0 if layer == "far" else 50000) \
                + zlib.crc32((sid + layer).encode()) % 90000 + salt * 7919
            prefix = "f2a2_%s" % key
            try:
                fp = genc2.OUTPUT / (prefix + "_0.png")
                if fp.exists():
                    fp.unlink()
                found, dt = genc2.run(wf_t2i(prompt, seed, prefix), [prefix])
                strip = make_strip(found[prefix], layer)
                assert strip.size == (1024, FARE_H if layer == "far" else NEAR_H)
                # 质检：不透明内容占比（far 3–45%，near 10–80%）
                frac = (np.array(strip)[:, :, 3] > 16).mean()
                lo, hi = (0.03, 0.60) if layer == "far" else (0.10, 0.80)
                if not (lo < frac < hi):
                    raise RuntimeError("内容占比 %.1f%% 超界 (%.0f–%.0f%%)" % (frac * 100, lo * 100, hi * 100))
                strip.save(STAGES_OUT / sid / (layer + ".png"))
                done_p.write_text(json.dumps({"seed": seed, "frac": round(frac, 3), "ts": int(time.time())}))
                log("ok %s (%.0fs, 内容 %.1f%%)" % (key, dt, frac * 100))
                ok += 1
            except Exception as e:
                fail += 1
                log("FAIL %s: %s" % (key, str(e)[:160]))
            genc2.hb()
        preview(sid, WORK / ("preview-%s.png" % sid))
    log("A2 done: ok=%d fail=%d skip=%d" % (ok, fail, skip))


if __name__ == "__main__":
    import sys
    main()
