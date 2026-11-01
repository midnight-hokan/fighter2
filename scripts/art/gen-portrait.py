#!/usr/bin/env python3
"""A1 定稿立绘生成：Qwen-Image-2512 t2i，1024×1024，出 N 张候选。
用法：python3 scripts/art/gen-portrait.py c01 [n=4]
提示词从 art-work/poses/<id>.json 的 style/colors 组装。
产出 ComfyUI/output/f2_<id>_ref_*.png，人工挑定稿后拷到 docs/art-review/<id>-portrait.png
"""
import json, requests, time
from pathlib import Path

API = "http://127.0.0.1:8188"
OUT = Path.home() / "ComfyUI/output"
POSES_DIR = Path(__file__).resolve().parent.parent.parent / "art-work" / "poses"

def prompt_for(style, colors):
    return (f"游戏角色「{style}」，严格按照以上服装与造型描述绘制。"
            f"配色：主色{colors['primary']}、辅色{colors['secondary']}、肤色{colors['skin']}。"
            "2D游戏角色立绘，厚涂赛璐璐风格，干净线稿，色块分明。"
            "侧身朝右，全身入镜，双脚完整，站立格斗架势，双拳收在胸前护住头部，双手完整可见。"
            "纯色浅灰背景，无文字水印，不要特效不要光效不要武器特效。")

NEG = ("低质量，模糊，变形，多余手指，多余肢体，裁剪，出框，"
       "3D，写实照片，水印，文字，多个角色，复杂背景")

def wf(seed, prefix, prompt):
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "qwen_image_2512_fp8_e4m3fn.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_2.5_vl_7b_fp8_scaled.safetensors", "type": "qwen_image"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_vae.safetensors"}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": prompt}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": NEG}},
        "6": {"class_type": "EmptySD3LatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "7": {"class_type": "KSampler",
              "inputs": {"model": ["1", 0], "positive": ["4", 0], "negative": ["5", 0],
                         "latent_image": ["6", 0], "seed": seed, "steps": 20, "cfg": 3.0,
                         "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["3", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": prefix}},
    }

def main():
    import sys
    cid = sys.argv[1]
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    data = json.load(open(POSES_DIR / f"{cid}.json"))
    prompt = prompt_for(data["style"], data["colors"])
    base_seed = 30261100 + int(cid[1:]) * 1000
    pids = []
    for i in range(n):
        r = requests.post(f"{API}/prompt",
                          json={"prompt": wf(base_seed + i, f"f2_{cid}_ref", prompt),
                                "client_id": "f2_art"})
        assert "error" not in r.json(), r.json()
        pids.append(r.json()["prompt_id"])
        print(f"queued {cid} seed={base_seed+i}", flush=True)
    for pid in pids:
        for _ in range(900):
            time.sleep(3)
            h = requests.get(f"{API}/history/{pid}").json()
            if pid in h:
                for o in h[pid].get("outputs", {}).values():
                    for im in o.get("images", []):
                        print(OUT / im["filename"], flush=True)
                break

if __name__ == "__main__":
    main()
