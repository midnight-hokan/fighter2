#!/usr/bin/env python3
"""构建并排队 Wan2.2-Animate 试点工作流（c07 st.hp + c04 cr.hk）。

拓扑：
  UNETLoader(wan2.2_animate_14B) -> WanAnimate2Cache(cpu)
  CLIPLoader(umt5-xxl, wan) -> CLIPTextEncode x3 (pos/neg/pose)
  CLIPVisionLoader(xlm-roberta) -> CLIPVisionEncode x2 (ref / pose 首帧)
  VAELoader(wan_2.1_vae)
  LoadImage(ref) + LoadImage(pose 49 帧) -> ImageBatch x48 -> pose_video
  WanAnimate2ToVideo(480x832, length=49) -> KSampler(30 steps, cfg 5, euler/beta)
  VAEDecode -> SaveImage(PNG 序列，便于逐帧取用)

用法：
  python3 scripts/art/wan-pilot-workflow.py            # 构建 + 排队两个试点
  python3 scripts/art/wan-pilot-workflow.py --dry      # 只打印 JSON 不排队
"""
import json, os, sys, urllib.request, urllib.error

COMFY = "http://localhost:8188"
PROJ = os.path.expanduser("~/projects/fighter2")
CLIENT = "wanpilot-cron"
SEED = 20261103
LENGTH = 49

PILOTS = {
    "c07sthp": {
        "pos": "Full body side view of a single fighter character, complete body visible from head to feet, plain light beige studio background, sharp focus, high quality, clean illustration, no text, no watermark",
        "neg": "close-up, cropped, partial body, head only, blurry, deformed, distorted, extra limbs, extra fingers, mutated hands, mutated face, watermark, text, logo, signature, low quality, jpeg artifacts, dark background",
        "pose": "side view, the character throws a straight punch forward, dynamic arm motion, full body visible on a plain background",
    },
    "c04crhk": {
        "pos": "Full body side view of a single fighter character, complete body visible from head to feet, plain light beige studio background, sharp focus, high quality, clean illustration, no text, no watermark",
        "neg": "close-up, cropped, partial body, head only, blurry, deformed, distorted, extra limbs, extra fingers, mutated hands, mutated face, watermark, text, logo, signature, low quality, jpeg artifacts, dark background",
        "pose": "side view, the character performs a high crouching kick, one leg raised and extended upward, dynamic kick motion, full body visible on a plain background",
    },
}

def build(tag):
    p = PILOTS[tag]
    nodes = {}
    nodes["1"] = {"class_type": "UNETLoader", "inputs": {"unet_name": "wan2.2_animate_14B.safetensors", "weight_dtype": "default"}}
    nodes["2"] = {"class_type": "WanAnimate2Cache", "inputs": {"model": ["1", 0], "device": "cpu", "dtype": "default"}}
    nodes["3"] = {"class_type": "CLIPLoader", "inputs": {"clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "type": "wan"}}
    nodes["4"] = {"class_type": "CLIPTextEncode", "inputs": {"text": p["pos"], "clip": ["3", 0]}}
    nodes["5"] = {"class_type": "CLIPTextEncode", "inputs": {"text": p["neg"], "clip": ["3", 0]}}
    nodes["6"] = {"class_type": "CLIPTextEncode", "inputs": {"text": p["pose"], "clip": ["3", 0]}}
    nodes["7"] = {"class_type": "CLIPVisionLoader", "inputs": {"clip_name": "clip_vision_h.safetensors"}}
    nodes["8"] = {"class_type": "LoadImage", "inputs": {"image": f"wanpilot_{tag}_ref.png"}}
    nodes["9"] = {"class_type": "CLIPVisionEncode", "inputs": {"clip_vision": ["7", 0], "image": ["8", 0], "crop": "center"}}
    nodes["10"] = {"class_type": "LoadImage", "inputs": {"image": f"wanpilot_{tag}_pose_0000.png"}}
    nodes["11"] = {"class_type": "CLIPVisionEncode", "inputs": {"clip_vision": ["7", 0], "image": ["10", 0], "crop": "center"}}
    nodes["12"] = {"class_type": "VAELoader", "inputs": {"vae_name": "wan_2.1_vae.safetensors"}}
    # 49 个 pose 帧 LoadImage: id 13..61
    for i in range(LENGTH):
        nodes[str(13 + i)] = {"class_type": "LoadImage", "inputs": {"image": f"wanpilot_{tag}_pose_{i:04d}.png"}}
    # ImageBatch 链: id 62..109（48 个）
    prev = None
    for i in range(LENGTH - 1):
        nid = 62 + i
        if i == 0:
            nodes[str(nid)] = {"class_type": "ImageBatch", "inputs": {"image1": ["13", 0], "image2": ["14", 0]}}
        else:
            nodes[str(nid)] = {"class_type": "ImageBatch", "inputs": {"image1": [str(61 + i), 0], "image2": [str(14 + i), 0]}}
        prev = nid
    nodes["110"] = {"class_type": "WanAnimate2ToVideo", "inputs": {
        "positive": ["4", 0], "negative": ["5", 0], "vae": ["12", 0],
        "width": 480, "height": 832, "length": LENGTH, "batch_size": 1,
        "video_frame_offset": 0, "pose_strength": 1.0,
        "pose_start_percent": 0.0, "pose_end_percent": 1.0, "reference_image_strength": 1.0,
        "reference_image": ["8", 0], "pose_video": [str(prev), 0],
        "clip_vision_output": ["9", 0], "positive_pose": ["6", 0], "clip_vision_output_pose": ["11", 0],
    }}
    nodes["111"] = {"class_type": "KSampler", "inputs": {
        "model": ["2", 0], "seed": SEED, "steps": 30, "cfg": 5.0,
        "sampler_name": "euler", "scheduler": "beta",
        "positive": ["110", 0], "negative": ["110", 1], "latent_image": ["110", 2], "denoise": 1.0,
    }}
    nodes["112"] = {"class_type": "VAEDecode", "inputs": {"samples": ["111", 0], "vae": ["12", 0]}}
    nodes["113"] = {"class_type": "SaveImage", "inputs": {"images": ["112", 0], "filename_prefix": f"wanpilot_{tag}"}}
    return {"prompt": nodes, "extra_data": {"client_id": CLIENT}}

def post(path, payload):
    req = urllib.request.Request(COMFY + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:1500]
        return {"error": f"HTTP {e.code}", "body": body}

def get(path):
    with urllib.request.urlopen(COMFY + path, timeout=30) as r:
        return json.loads(r.read())

def main():
    dry = "--dry" in sys.argv
    q = get("/queue")
    print("queue running:", len(q["queue_running"]), "pending:", len(q["queue_pending"]))
    ids = {}
    for tag in PILOTS:
        wf = build(tag)
        out = os.path.join(PROJ, f"art-work/wan-pilot/workflow-{tag}.json")
        with open(out, "w") as f:
            json.dump(wf, f, ensure_ascii=False, indent=1)
        print(f"[{tag}] workflow -> {out}")
        if dry:
            continue
        r = post("/prompt", wf)
        if "error" in r:
            print(f"[{tag}] QUEUE ERROR: {json.dumps(r, ensure_ascii=False)[:800]}")
            continue
        ids[tag] = r["prompt_id"]
        print(f"[{tag}] queued prompt_id={r['prompt_id']} number={r.get('number')}")
    if ids:
        print("PROMPT_IDS " + json.dumps(ids))

if __name__ == "__main__":
    main()
