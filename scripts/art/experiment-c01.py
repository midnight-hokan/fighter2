#!/usr/bin/env python3
"""c01 参数实验：IPAdapter 提权 vs 立绘 img2img，各 3 帧（idle/st.hp/xuanfeng）。"""
import json, requests, time, sys, os
from pathlib import Path

API = "http://127.0.0.1:8188"
ROOT = Path(__file__).resolve().parent.parent.parent
POSE_IMG = ROOT / "art-work" / "pose-img"
OUT = ROOT / "art-work" / "exp-c01"
UPLOAD = Path.home() / "ComfyUI/input"

CKPT = "Illustrious-XL-v2.0.safetensors"
IPADAPTER = "ip-adapter-plus_sdxl_vit-h.safetensors"
CONTROLNET = "controlnet_openpose_sdxl.safetensors"

CHAR = ("1boy, male focus, young muscular boxer, short spiky black hair, "
        "black short jacket with rust red trim, wide golden yellow sash belt "
        "with a small glowing miner headlamp hanging on it, rust red hand wraps, "
        "black long pants, black boots")
TAIL = ("masterpiece, best quality, solo, full body, side view, facing right, "
        "isolated character, plain solid light gray background, no scenery, "
        "no rain, no environment, cel shading, thick paint, "
        "video game character sprite, clean lineart, sharp focus")
NEG = ("worst quality, low quality, normal quality, watermark, text, logo, signature, "
       "multiple views, 3d, realistic, photo, deformed, bad anatomy, bad hands, "
       "extra fingers, missing fingers, extra limbs, cropped, out of frame, blurry, "
       "nsfw, multiple people, complex background, rain, glowing, glow, particles, "
       "energy effect, fire, magic, cape")
POSE_DESC = {
    "idle": "fighting guard stance, both fists raised in front of chest",
    "st.hp": "standing heavy punch, one fist thrust straight forward, body leaning into it",
    "xuanfeng": "spinning roundhouse kick, leg extended, body rotating",
}

def upload(src):
    dst = UPLOAD / src.name
    if not dst.exists():
        dst.write_bytes(src.read_bytes())
    return src.name

def wf_ipa(portrait_name, pose_name, seed, prefix, anim, ipw, cnw):
    pos = f"{CHAR}, {POSE_DESC[anim]}, {TAIL}"
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "2": {"class_type": "IPAdapterUnifiedLoader",
              "inputs": {"model": ["1", 0], "preset": "PLUS (high strength)"}},
        "3": {"class_type": "LoadImage", "inputs": {"image": portrait_name}},
        "4": {"class_type": "IPAdapterAdvanced",
              "inputs": {"model": ["2", 0], "ipadapter": ["2", 1], "image": ["3", 0],
                         "weight": ipw, "weight_type": "linear", "combine_embeds": "concat",
                         "start_at": 0.0, "end_at": 1.0, "embeds_scaling": "V only"}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": pos}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": NEG}},
        "7": {"class_type": "ControlNetLoader", "inputs": {"control_net_name": CONTROLNET}},
        "8": {"class_type": "LoadImage", "inputs": {"image": pose_name}},
        "9": {"class_type": "ControlNetApplyAdvanced",
              "inputs": {"positive": ["5", 0], "negative": ["6", 0], "control_net": ["7", 0],
                         "image": ["8", 0], "strength": cnw, "start_percent": 0.0, "end_percent": 1.0}},
        "10": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "11": {"class_type": "KSampler",
               "inputs": {"model": ["4", 0], "positive": ["9", 0], "negative": ["9", 1],
                          "latent_image": ["10", 0], "seed": seed, "steps": 24, "cfg": 5.5,
                          "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0}},
        "12": {"class_type": "VAEDecode", "inputs": {"samples": ["11", 0], "vae": ["1", 2]}},
        "13": {"class_type": "SaveImage", "inputs": {"images": ["12", 0], "filename_prefix": prefix}},
    }

def wf_i2i(portrait_name, pose_name, seed, prefix, anim, denoise, cnw):
    pos = f"{CHAR}, {POSE_DESC[anim]}, {TAIL}"
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "2": {"class_type": "LoadImage", "inputs": {"image": portrait_name}},
        "3": {"class_type": "VAEEncode", "inputs": {"pixels": ["2", 0], "vae": ["1", 2]}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": pos}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": NEG}},
        "6": {"class_type": "ControlNetLoader", "inputs": {"control_net_name": CONTROLNET}},
        "7": {"class_type": "LoadImage", "inputs": {"image": pose_name}},
        "8": {"class_type": "ControlNetApplyAdvanced",
              "inputs": {"positive": ["4", 0], "negative": ["5", 0], "control_net": ["6", 0],
                         "image": ["7", 0], "strength": cnw, "start_percent": 0.0, "end_percent": 1.0}},
        "9": {"class_type": "KSampler",
              "inputs": {"model": ["1", 0], "positive": ["8", 0], "negative": ["8", 1],
                         "latent_image": ["3", 0], "seed": seed, "steps": 24, "cfg": 5.5,
                         "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": denoise}},
        "10": {"class_type": "VAEDecode", "inputs": {"samples": ["9", 0], "vae": ["1", 2]}},
        "11": {"class_type": "SaveImage", "inputs": {"images": ["10", 0], "filename_prefix": prefix}},
    }

def run(w, out_path, timeout_min=10):
    r = requests.post(f"{API}/prompt", json={"prompt": w, "client_id": "f2_exp"})
    j = r.json()
    if "error" in j:
        raise SystemExit(f"QUEUE ERROR {out_path.name}: {json.dumps(j, ensure_ascii=False)[:1200]}")
    pid = j["prompt_id"]
    t0 = time.time()
    while time.time() - t0 < timeout_min * 60:
        time.sleep(4)
        h = requests.get(f"{API}/history/{pid}").json()
        if pid in h:
            st = h[pid].get("status", {})
            if st.get("status_str") == "error":
                raise SystemExit(f"GEN ERROR {out_path.name}: {json.dumps(st.get('messages', []), ensure_ascii=False)[:800]}")
            for o in h[pid].get("outputs", {}).values():
                for im in o.get("images", []):
                    src = Path.home() / "ComfyUI/output" / im["filename"]
                    src.rename(out_path)
                    print(f"ok {out_path.name} ({time.time()-t0:.0f}s)", flush=True)
                    return
    raise SystemExit(f"TIMEOUT {out_path.name}")

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    portrait = upload(Path.home() / "projects/fighter2/docs/art-review/c01-portrait.png")
    frames = [("idle", 0), ("st.hp", 2), ("xuanfeng", 0)]
    for name in ["ipa10", "ipa12", "i2i65", "i2i75"]:
        for anim, idx in frames:
            out = OUT / f"{name}_{anim.replace('.', '_')}_{idx:02d}.png"
            if out.exists():
                print(f"skip {out.name}", flush=True)
                continue
            pose = upload(POSE_IMG / "c01" / f"{anim.replace('.', '_')}_{idx:02d}.png")
            seed = 99000 + idx
            if name == "ipa10":
                w = wf_ipa(portrait, pose, seed, "f2_exp_ipa10", anim, 1.0, 1.0)
            elif name == "ipa12":
                w = wf_ipa(portrait, pose, seed, "f2_exp_ipa12", anim, 1.2, 0.8)
            elif name == "i2i65":
                w = wf_i2i(portrait, pose, seed, "f2_exp_i2i65", anim, 0.65, 1.0)
            else:
                w = wf_i2i(portrait, pose, seed, "f2_exp_i2i75", anim, 0.75, 0.9)
            run(w, out)
    print("ALL DONE", flush=True)

if __name__ == "__main__":
    main()
