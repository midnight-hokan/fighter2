#!/usr/bin/env python3
"""A1 帧生成（路线2）：SDXL Illustrious + IP-Adapter(定稿立绘) + OpenPose ControlNet(骨架图)。
用法：
  python3 scripts/art/gen-frames-sdxl.py c01 docs/art-review/c01-portrait.png --test
  python3 scripts/art/gen-frames-sdxl.py c01 <立绘> --all
  python3 scripts/art/gen-frames-sdxl.py c01 <立绘> --anim idle,walkf --ipw 0.7 --cnw 0.9 --steps 24
输出：art-work/frames/<cid>/<动画名>_<帧号>.png
"""
import json, requests, time, sys, os
from pathlib import Path

API = "http://127.0.0.1:8188"
ROOT = Path(__file__).resolve().parent.parent.parent
POSES = ROOT / "art-work" / "poses"
POSE_IMG = ROOT / "art-work" / "pose-img"
FRAMES = ROOT / "art-work" / "frames"
UPLOAD = Path.home() / "ComfyUI/input"

CKPT = "Illustrious-XL-v2.0.safetensors"
IPADAPTER = "ip-adapter-plus_sdxl_vit-h.safetensors"
CONTROLNET = "controlnet_openpose_sdxl.safetensors"

# 各角色英文形象描述（Illustrious 吃英文）
CHAR_DESC = {
    "c01": ("1boy, male focus, young muscular boxer, short spiky black hair, "
            "black short jacket with rust red trim, wide golden yellow sash belt "
            "with a small glowing miner headlamp hanging on it, rust red hand wraps, "
            "black long pants, black boots"),
    "c02": ("1boy, male focus, stocky middle-aged miner, thick brown leather jacket, "
            "goggles pushed up on forehead, calloused big hands, sturdy build"),
    "c03": ("1boy, male focus, very tall giant miner, steel frame vest, heavy "
            "thick-soled work boots, extremely wide shoulders, coal dust"),
    "c04": ("1girl, lean young woman lamp girl, fitted short teal work clothes, "
            "lamp belt at waist, high ponytail, agile"),
    "c05": ("1boy, male focus, thin old man lamp bearer, gray cloth long robe, "
            "carrying an old wooden lamp pole on back, calm eyes"),
    "c06": ("1boy, male focus, tall slim young pickax man, light leather boots, "
            "short jacket, short pickax strapped diagonally across shoulder"),
    "c07": ("1boy, male focus, huge massive man, copper colored work clothes, "
            "arms as thick as pillars, heavy eyelids, stern face"),
    "c08": ("1boy, male focus, traveler in gray robe, carrying a lantern, "
            "leaning on a wooden staff, calm steady"),
}

POS_TAIL = ("masterpiece, best quality, solo, full body, side view, facing right, "
            "isolated character, plain solid light gray background, no scenery, "
            "no rain, no environment, cel shading, thick paint, "
            "video game character sprite, clean lineart, sharp focus")
NEG = ("worst quality, low quality, normal quality, watermark, text, logo, signature, "
       "multiple views, 3d, realistic, photo, deformed, bad anatomy, bad hands, "
       "extra fingers, missing fingers, extra limbs, cropped, out of frame, blurry, "
       "nsfw, multiple people, complex background, rain, glowing, glow, particles, "
       "energy effect, fire, magic, cape")

# 每个动画的文本姿势描述（配合 ControlNet 双保险）
POSE_DESC = {
    "idle": "fighting guard stance, both fists raised in front of chest",
    "walkf": "walking forward, natural arm swing",
    "walkb": "walking backward, natural arm swing",
    "jump": "mid-jump in the air, knees slightly bent",
    "fall": "falling through the air, limbs slightly spread",
    "land": "landing, knees bent",
    "crouch": "deep crouch, knees bent, fists in guard",
    "blockstun": "recoiling backward from a blocked hit, arms crossed in front",
    "airhit": "hit in the air, body leaning back, limbs flailing",
    "ko": "lying on the ground",
    "win": "victory pose, fist raised",
    "st.lp": "standing light punch, one fist extended forward at chest height",
    "st.mp": "standing medium punch, one fist extended forward at chest height",
    "st.hp": "standing heavy punch, one fist thrust straight forward, body leaning into it",
    "cr.lp": "crouching light punch, one fist extended forward low",
    "cr.mp": "crouching medium punch, one fist extended forward low",
    "cr.hp": "crouching heavy punch, one fist thrust straight forward low",
    "j.lp": "air light punch, one fist extended forward in the air",
    "j.mp": "air medium punch, one fist extended forward in the air",
    "j.hp": "air heavy kick, one leg extended forward in the air",
    "st.lk": "standing low kick, one leg extended forward at shin height",
    "st.mk": "standing medium kick, one leg extended forward at knee height",
    "st.hk": "standing high kick, one leg extended forward at head height",
    "cr.lk": "crouching low kick, one leg extended forward low",
    "cr.mk": "crouching medium kick, one leg extended forward low",
    "cr.hk": "crouching uppercut, one fist rising upward",
    "j.lk": "air low kick, one leg extended in the air",
    "j.mk": "air medium kick, one leg extended in the air",
    "j.hk": "air high kick, one leg extended overhead in the air",
    "meiyan": "throwing a fireball, both fists extended forward, palm outward",
    "chongtian": "rising uppercut, one fist thrust straight up overhead",
    "xuanfeng": "spinning roundhouse kick, leg extended, body rotating",
    "dihuolong": "full-body charge lunge, body low and horizontal, arm extended forward",
    "winp": "victory pose, fist raised",
}

def upload(src: Path) -> str:
    if not src.exists():
        raise SystemExit(f"找不到图: {src}")
    dst = UPLOAD / src.name
    if not dst.exists():
        dst.write_bytes(src.read_bytes())
    return src.name

def wf(cid, portrait_name, pose_name, seed, prefix, anim, ipw, cnw, steps):
    pose_desc = POSE_DESC.get(anim, "dynamic fighting pose")
    pos = f"{CHAR_DESC[cid]}, {pose_desc}, {POS_TAIL}"
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
                          "latent_image": ["10", 0], "seed": seed, "steps": steps, "cfg": 5.5,
                          "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0}},
        "12": {"class_type": "VAEDecode", "inputs": {"samples": ["11", 0], "vae": ["1", 2]}},
        "13": {"class_type": "SaveImage", "inputs": {"images": ["12", 0], "filename_prefix": prefix}},
    }

def run(w, out_name, timeout_min=10):
    r = requests.post(f"{API}/prompt", json={"prompt": w, "client_id": "f2_frames2"})
    j = r.json()
    if "error" in j:
        raise SystemExit(f"QUEUE ERROR {out_name}: {json.dumps(j, ensure_ascii=False)[:1200]}")
    pid = j["prompt_id"]
    t0 = time.time()
    while time.time() - t0 < timeout_min * 60:
        time.sleep(4)
        h = requests.get(f"{API}/history/{pid}").json()
        if pid in h:
            st = h[pid].get("status", {})
            if st.get("status_str") == "error":
                raise SystemExit(f"GEN ERROR {out_name}: {json.dumps(st.get('messages', []), ensure_ascii=False)[:800]}")
            for o in h[pid].get("outputs", {}).values():
                for im in o.get("images", []):
                    src = Path.home() / "ComfyUI/output" / im["filename"]
                    src.rename(out_name)
                    print(f"ok {out_name.name} ({time.time()-t0:.0f}s)", flush=True)
                    return
    raise SystemExit(f"TIMEOUT {out_name}")

def main():
    cid = sys.argv[1]
    portrait = Path(sys.argv[2])
    args = sys.argv[3:]
    def opt(flag, dflt=None):
        i = args.index(flag) + 1 if flag in args else None
        return sys.argv[i] if i and i < len(sys.argv) else dflt
    ipw = float(opt("--ipw", "0.8"))
    cnw = float(opt("--cnw", "1.0"))
    steps = int(opt("--steps", "24"))
    anims = opt("--anim").split(",") if opt("--anim") else None
    mode = "test" if "--test" in args else "all" if "--all" in args else "anim"
    if mode == "anim" and not anims:
        raise SystemExit("缺 --anim a,b")

    data = json.load(open(POSES / f"{cid}.json"))
    portrait_name = upload(portrait)

    if mode == "test":
        picks = [("idle", 0), ("walkf", 0), ("st.hp", 2), ("meiyan", 0), ("chongtian", 1), ("xuanfeng", 0)]
        todo = [p for p in picks if p[0] in data["anims"]]
    elif mode == "all":
        todo = [(a, i) for a, anim in data["anims"].items() for i in range(len(anim["frames"]))]
    else:
        todo = [(a, i) for a in anims for i in range(len(data["anims"][a]["frames"]))]

    (FRAMES / cid).mkdir(parents=True, exist_ok=True)
    print(f"{cid}: {len(todo)} 帧待生成 (ipw={ipw}, cnw={cnw}, steps={steps})", flush=True)
    for a, i in todo:
        out = FRAMES / cid / f"{a.replace('.', '_')}_{i:02d}.png"
        if out.exists():
            continue
        pose = POSE_IMG / cid / f"{a.replace('.', '_')}_{i:02d}.png"
        if not pose.exists():
            raise SystemExit(f"骨架图缺失: {pose}")
        pose_name = upload(pose)
        seed = (20261101 + int(cid[1:]) * 100000 + hash((a, i)) % 100000) & 0x7FFFFFFF
        run(wf(cid, portrait_name, pose_name, seed, f"f2_{cid}_f", a, ipw, cnw, steps), out)

if __name__ == "__main__":
    main()
