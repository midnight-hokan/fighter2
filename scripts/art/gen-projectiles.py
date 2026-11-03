#!/usr/bin/env python3
"""gen-projectiles.py — 飞行道具贴图：6 张透明道具图（INBOX 2026-11-03 13:40）。

流程（每物体 2 候选）：
  1. Qwen-Image-2512 t2i 1024×1024 绿幕底（与立绘同画风：厚涂赛璐璐、侧视、无人物）
  2. BiRefNet RemoveBackground 抠图（ComfyUI 节点，A1 已验证）
  3. PIL 裁边（alpha bbox）+ 缩到 128 宽 → .check/proj-cand/<name>_cand{i}.png
  4. 选择蒙太奇 .check/proj-select.png（6 行 × 2 列，白底，供视觉挑图）
挑定后把赢家拷到 public/assets/meilong/projectiles/<name>.png（主流程外，手动做）。

用法：python3 scripts/art/gen-projectiles.py
"""
import json
import os
import shutil
import time

import requests
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
API = "http://127.0.0.1:8188"
UPLOAD = os.path.expanduser("~/ComfyUI/input")
OUTPUT = os.path.expanduser("~/ComfyUI/output")
CAND_DIR = os.path.join(ROOT, ".check", "proj-cand")
SELECT_PNG = os.path.join(ROOT, ".check", "proj-select.png")

BIREFNET = "birefnet.safetensors"
UNET = "qwen_image_2512_fp8_e4m3fn.safetensors"
CLIP = "qwen_2.5_vl_7b_fp8_scaled.safetensors"
VAE = "qwen_image_vae.safetensors"

STYLE = ("2D游戏道具，厚涂赛璐璐风格，干净线稿，色块分明，侧视，"
         "纯色亮绿背景（绿幕），无水印，无人物，无复杂背景，无特效")
NEG = ("低质量，模糊，变形，裁剪，出框，3D，写实照片，水印，文字，"
       "人物，人，多个物体，复杂背景")
NEG_TEXT = ("低质量，模糊，变形，裁剪，出框，3D，写实照片，水印，"
            "人物，人，多个物体，复杂背景，乱码，错字")

# name: (prompt, neg, size, spin, theme_key)
OBJECTS = {
    "c01_helmet": ("一个黄色矿工安全帽，正前方中央装着一盏小矿灯，矿灯发出暖黄色亮光，侧视朝右。" + STYLE,
                   NEG, 30, 14, "c01:meiyan"),
    "c02_rope": ("一根橙红色救生救援绳，盘成一个绳圈，绳的一端连着金属救援钩，侧视。" + STYLE,
                 NEG, 34, 12, "c02:baokong"),
    "c02_flare": ("一支红色手持信号弹，已经点燃，顶端有明亮的红色火焰和一缕烟，侧视。" + STYLE,
                  NEG, 30, 0, "c02:tanshui"),
    "c05_banner": ("一面红色布横幅，卷起一半，展开的部分写着四个黄色汉字“安全生产”，侧视。" + STYLE,
                   NEG_TEXT, 40, 0, "c05:daiteng"),
    "c06_lamp": ("一盏蓝灰色的矿工矿灯，灯头前方发出暖黄色的亮光，侧视。" + STYLE,
                 NEG, 20, 8, "c06:jifengdan"),
    "c08_needle": ("一根细长的银色针灸银针，有金属光泽，针尖朝右，侧视。" + STYLE,
                   NEG, 24, 0, "c08:huiyan"),
}


def wf_gen(seed, prefix, prompt, neg):
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": UNET, "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": CLIP, "type": "qwen_image"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": VAE}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": prompt}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": neg}},
        "6": {"class_type": "EmptySD3LatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "7": {"class_type": "KSampler",
              "inputs": {"model": ["1", 0], "positive": ["4", 0], "negative": ["5", 0],
                         "latent_image": ["6", 0], "seed": seed, "steps": 20, "cfg": 3.0,
                         "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["3", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": prefix}},
    }


def wf_cutout(src_name, out_prefix):
    return {
        "1": {"class_type": "LoadImage", "inputs": {"image": src_name}},
        "2": {"class_type": "LoadBackgroundRemovalModel", "inputs": {"bg_removal_name": BIREFNET}},
        "3": {"class_type": "RemoveBackground", "inputs": {"bg_removal_model": ["2", 0], "image": ["1", 0]}},
        "4": {"class_type": "InvertMask", "inputs": {"mask": ["3", 0]}},
        "5": {"class_type": "JoinImageWithAlpha", "inputs": {"image": ["1", 0], "alpha": ["4", 0]}},
        "6": {"class_type": "SaveImage", "inputs": {"images": ["5", 0], "filename_prefix": out_prefix}},
    }


def submit(w, tag):
    r = requests.post(API + "/prompt", json={"prompt": w, "client_id": tag})
    j = r.json()
    if "error" in j:
        print(f"  QUEUE ERROR {tag}: {str(j)[:300]}", flush=True)
        return None
    return j["prompt_id"]


def poll(pid, prefix, timeout=300):
    t0 = time.time()
    while time.time() - t0 < timeout:
        time.sleep(3)
        h = requests.get(API + f"/history/{pid}").json()
        if pid in h:
            item = h[pid]
            for o in item.get("outputs", {}).values():
                for im in o.get("images", []):
                    if im["filename"].startswith(prefix):
                        base = OUTPUT if im.get("type", "output") == "output" \
                            else os.path.expanduser("~/ComfyUI/temp")
                        sub = im.get("subfolder", "")
                        p = os.path.join(base, sub, im["filename"]) if sub else os.path.join(base, im["filename"])
                        return p
            # prompt 已结束但没有目标输出图 = 执行出错，打印真实错误别空等
            for m in item.get("status", {}).get("messages", []):
                if m[0] == "execution_error":
                    print(f"  EXEC ERROR {pid[:8]} {prefix}: {str(m[1])[:300]}", flush=True)
            break
    print(f"  TIMEOUT {pid[:8]} {prefix}", flush=True)
    return None


def to_128(src, dst):
    """裁边（alpha bbox）+ 缩到 128 宽，保纵横比。返回 (w,h)。"""
    im = Image.open(src).convert("RGBA")
    bbox = im.getchannel("A").getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    nw = 128
    nh = max(1, round(h * nw / w))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    im.save(dst)
    return nw, nh


def main():
    os.makedirs(CAND_DIR, exist_ok=True)
    names = list(OBJECTS.keys())
    base_seed = 30261200
    # 阶段 1+2：每物体 2 候选，生成 + 抠图
    cutouts = {}  # name -> [ (cand_idx, cutout_path) ]
    for ni, name in enumerate(names):
        prompt, neg, *_ = OBJECTS[name]
        paths = []
        for ci in range(2):
            seed = base_seed + ni * 10 + ci
            gprefix = f"f2pg_{name}_{ci}"
            pid = submit(wf_gen(seed, gprefix, prompt, neg), f"projgen-{name}")
            if not pid:
                continue
            g = poll(pid, gprefix, timeout=300)
            if not g:
                continue
            # 抠图
            up = f"f2pgu_{name}_{ci}.png"
            shutil.copy(g, os.path.join(UPLOAD, up))
            cprefix = f"f2pgc_{name}_{ci}"
            pid2 = submit(wf_cutout(up, cprefix), f"projcut-{name}")
            if not pid2:
                os.remove(os.path.join(UPLOAD, up))
                continue
            c = poll(pid2, cprefix, timeout=180)
            # 上传文件必须等抠图结束才能删：LoadImage 执行时才读文件，提前删会 FileNotFoundError
            try:
                os.remove(os.path.join(UPLOAD, up))
            except FileNotFoundError:
                pass
            if c:
                paths.append((ci, c))
                print(f"  {name} cand{ci} 生成+抠图 OK", flush=True)
        cutouts[name] = paths
        print(f"== {name}: {len(paths)}/2 候选就绪 ==", flush=True)
    # 阶段 3：裁边缩 128 宽
    finals = {}
    for name, paths in cutouts.items():
        for ci, c in paths:
            dst = os.path.join(CAND_DIR, f"{name}_cand{ci}.png")
            w, h = to_128(c, dst)
            finals.setdefault(name, []).append((ci, dst, w, h))
    # 阶段 4：选择蒙太奇（6 行 × 2 列，白底 220 单元格）
    cell = 220
    cols = 2
    rows = len(names)
    canvas = Image.new("RGB", (cell * cols, cell * rows), "white")
    d = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
    except OSError:
        font = ImageFont.load_default()
    for ri, name in enumerate(names):
        for ci in range(cols):
            x0, y0 = ci * cell, ri * cell
            entry = next((e for e in finals.get(name, []) if e[0] == ci), None)
            if entry:
                im = Image.open(entry[1]).convert("RGBA")
                im.thumbnail((cell - 16, cell - 30), Image.Resampling.LANCZOS)
                canvas.paste(im, (x0 + (cell - im.width) // 2, y0 + 24 + (cell - 30 - im.height) // 2), im)
            tag = f"{name} {'AB'[ci]} (128w)" if entry else f"{name} {'AB'[ci]} (缺)"
            d.text((x0 + 6, y0 + 4), tag, fill="black", font=font)
            d.rectangle([x0, y0, x0 + cell - 1, y0 + cell - 1], outline="#cccccc")
    canvas.save(SELECT_PNG)
    rep = {"ts": time.strftime("%F %T"), "candidates": {n: [e[:2] for e in v] for n, v in finals.items()}}
    json.dump(rep, open(os.path.join(ROOT, ".check", "proj-report.json"), "w"), ensure_ascii=False, indent=1)
    print(f"\n选择蒙太奇: {SELECT_PNG}", flush=True)
    print(f"128 宽候选: {CAND_DIR}", flush=True)
    for n in names:
        print(f"  {n}: {[f'cand{e[0]}' for e in finals.get(n, [])]}", flush=True)


if __name__ == "__main__":
    main()
