#!/usr/bin/env python3
# A1 帧生成（定稿管线 v2，2026-11-01 验证通过）：
# 立绘 + 白色骨架线叠加 -> Qwen-Image-Edit-2511（EditPlus 单图输入，20 步）-> 动作帧
# 每帧姿势文字由 pose-text.py 从关键点程序化生成（文字是姿势跟随的主驱动力，
# 骨架线只是辅助；纯骨架无文字时模型会退回守势，已验证）。
# 生成后程序化验收：骨架残留 IoU < 0.06、全身入镜、前伸量达标；不合格自动换种子重试。
# 验收通过的帧用 rembg 抠成透明背景 RGBA 保存（pack-atlas.py 要求透明帧）。
#
# 用法：
#   python3 scripts/art/gen-frames.py c01 立绘.png --all [--desc 角色描述]
#   python3 scripts/art/gen-frames.py c01 立绘.png --anim idle,walkf
# 输出：art-work/frames/cid/动画名_帧号.png

import json
import zlib
import requests
import time
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pose_text import describe_frame  # noqa: E402

API = "http://127.0.0.1:8188"
ROOT = Path(__file__).resolve().parent.parent.parent
POSES = ROOT / "art-work" / "poses"
POSE_IMG = ROOT / "art-work" / "pose-img"
FRAMES = ROOT / "art-work" / "frames"
UPLOAD = Path.home() / "ComfyUI" / "input"

EDIT_UNET = "qwen_image_edit_2511_fp8mixed.safetensors"
CLIP = "qwen_2.5_vl_7b_fp8_scaled.safetensors"
VAE = "qwen_image_vae.safetensors"

PROMPT_TMPL = (
    "角色设定：{desc}。"
    "图中人物身上画着白色骨架线，那只是姿势参考标记，不是人物的一部分，"
    "生成画面中绝对不能出现任何白色骨架线或线条。"
    "生成这个人物摆出白色骨架线所示姿势的画面：{hint}{frame_desc}。"
    "严格保持这个人的脸、发型、服装、配色完全不变。"
    "人物全身入镜，手脚完整；纯色浅灰背景，无文字水印，无特效，厚涂赛璐璐风格，干净线稿。"
)

POSE_HINTS = {
    "idle": "格斗待机，",
    "walkf": "向前行走，",
    "walkb": "向后退步，",
    "crouch": "下蹲，",
    "prejump": "起跳前蓄力下蹲，",
    "jump": "腾空跃起，",
    "blockstun": "被击中后退的防御姿态，",
    "crblock": "下蹲防御被击中，",
    "hitstun": "被击中后仰，",
    "airhit": "空中被击中后仰，",
    "knockdown": "倒地，",
    "dizzy": "眩晕摇晃，",
    "roll": "翻滚，",
    "maxstart": "爆气蓄力，",
    "ko": "被击倒横躺，",
    "win": "胜利姿势，",
    "throw": "投技，",
    "gc": "起身，",
    "meiyan": "蓄力投掷飞行道具，",
    "chongtian": "上勾拳向上打，",
    "xuanfeng": "原地旋转踢腿，",
    "dihuolong": "超必杀技前冲，",
    "baokong": "蓄力投掷飞行道具，",
    "tanshui": "蓄力投掷低段飞行道具，",
    "chongtianshan": "上勾拳向上打，",
    "longxuantan": "蓄力出拳向前冲，",
    "zhongdan": "擒拿摔投，",
    "suiluo": "砸落重拳向下打，",
    "kengtai": "扫堂腿横扫，",
    "chaozhong": "扛起对手砸地，",
    "denghua": "滑步低踢向前冲，",
    "shanguang": "跃起旋踢，",
    "jifenghua": "前冲扫踢，",
    "huaying": "连续快速突刺，",
    "denghuadan": "从灯上放出飞行道具，",
    "daiteng": "抡臂投掷大飞行道具，",
    "dengzhuo": "近身快速戳拳，",
    "denghuadrag": "挥灯杆放出巨浪飞行道具，",
    "shanfengt": "快拳向前冲，",
    "feihua": "跃起回旋踢，",
    "jifengdan": "快速投掷短程飞行道具，",
    "jifenglong": "高速连续突刺，",
    "chongtiant": "升龙式上勾重拳，",
    "zhongdanluo": "砸落重拳向下打，",
    "zhongkeng": "踹翻对手，",
    "tongshoulong": "重拳向前压制冲，",
    "huiyan": "杖尖放出飞行道具，",
    "huihe": "跃起回旋踢，",
    "huayan": "上挑旋踢，",
    "huiyanlong": "挥杖放出龙卷飞行道具，",
}


def upload_overlay(portrait, skeleton, cid, anim, idx):
    from PIL import Image
    import numpy as np
    port = Image.open(portrait).convert("RGB")
    if port.size != (1024, 1024):
        port = port.resize((1024, 1024))
    skel = np.array(Image.open(skeleton).convert("RGB"))
    out = np.array(port)
    out[skel.max(axis=2) > 100] = [255, 255, 255]
    safe = anim.replace(".", "_")
    name = "f2_ov_" + cid + "_" + safe + "_" + format(idx, "02d") + ".png"
    (UPLOAD / name).parent.mkdir(parents=True, exist_ok=True)
    from PIL import Image as _I
    _I.fromarray(out).save(UPLOAD / name)
    return name


def wf(overlay_name, prompt, seed, prefix):
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": EDIT_UNET, "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": CLIP, "type": "qwen_image"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": VAE}},
        "4": {"class_type": "LoadImage", "inputs": {"image": overlay_name}},
        "5": {"class_type": "TextEncodeQwenImageEditPlus",
              "inputs": {"clip": ["2", 0], "prompt": prompt, "image1": ["4", 0], "vae": ["3", 0]}},
        "6": {"class_type": "EmptySD3LatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "7": {"class_type": "KSampler",
              "inputs": {"model": ["1", 0], "positive": ["5", 0], "negative": ["5", 0],
                         "latent_image": ["6", 0], "seed": seed, "steps": 10, "cfg": 1.0,
                         "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["3", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": prefix}},
    }


def run(w, out, timeout_min=10):
    r = requests.post(API + "/prompt", json={"prompt": w, "client_id": "f2_frames"})
    j = r.json()
    if "error" in j:
        raise RuntimeError("QUEUE ERROR " + out.name + ": " + json.dumps(j, ensure_ascii=False)[:800])
    pid = j["prompt_id"]
    t0 = time.time()
    while time.time() - t0 < timeout_min * 60:
        time.sleep(4)
        h = requests.get(API + "/history/" + pid).json()
        if pid in h:
            st = h[pid].get("status", {})
            if st.get("status_str") == "error":
                raise RuntimeError("GEN ERROR " + out.name + ": " + json.dumps(st.get("messages"), ensure_ascii=False)[:400])
            for o in h[pid].get("outputs", {}).values():
                for im in o.get("images", []):
                    src = Path.home() / "ComfyUI" / "output" / im["filename"]
                    src.rename(out)
                    return time.time() - t0
    raise RuntimeError("TIMEOUT " + out.name)


def verify(out, pose_path):
    """程序化验收。返回 (ok, 原因, 抠图mask或None)。"""
    import numpy as np
    from PIL import Image
    from rembg import remove
    fm = np.array(Image.open(out).convert("RGB"))
    pm = np.array(Image.open(pose_path).convert("RGB"))
    pwhite = pm.max(axis=2) > 100
    fwhite = (fm > 240).all(axis=2)
    inter = np.logical_and(fwhite, pwhite).sum()
    union = np.logical_or(fwhite, pwhite).sum()
    iou = inter / union if union else 0.0
    if iou > 0.06:
        return False, "骨架残留 IoU=" + format(iou, ".3f"), None
    mask = np.array(remove(Image.open(out)).convert("L")) > 128
    h, w = fm.shape[:2]
    ys, xs = np.where(mask)
    if len(ys) < 5000:
        return False, "角色太小", None
    # 倒地帧横躺：用最大维度判全身入镜
    if max(ys.max() - ys.min(), xs.max() - xs.min()) / max(h, w) < 0.40:
        return False, "未全身入镜", None
    # 前伸量检查：骨架朝画面右伸出多少，角色至少伸出 50%
    pys, pxs = np.where(pwhite)
    pcx = (pxs.max() + pxs.min()) / 2
    pext = pxs.max() - pcx
    if pext > 150:
        ccx = (xs.max() + xs.min()) / 2
        cext = xs.max() - ccx
        if cext < 0.5 * pext:
            return False, "前伸不足 角色%.0f 骨架%.0f" % (cext, pext), None
    return True, "", mask


def main():
    cid = sys.argv[1]
    portrait = Path(sys.argv[2]).expanduser()
    desc = sys.argv[sys.argv.index("--desc") + 1] if "--desc" in sys.argv else ""
    anims = sys.argv[sys.argv.index("--anim") + 1].split(",") if "--anim" in sys.argv else None
    data = json.load(open(POSES / (cid + ".json")))
    if "--all" in sys.argv:
        todo = [(a, i) for a, anim in data["anims"].items() for i in range(len(anim["frames"]))]
    else:
        if not anims:
            raise SystemExit("需要 --all 或 --anim a,b")
        todo = [(a, i) for a in anims for i in range(len(data["anims"][a]["frames"]))]

    (FRAMES / cid).mkdir(parents=True, exist_ok=True)
    HB = ROOT / ".check" / "heartbeat"
    n = 0
    for a, i in todo:
        HB.parent.mkdir(exist_ok=True)
        HB.touch()
        safe = a.replace(".", "_")
        out = FRAMES / cid / (safe + "_" + format(i, "02d") + ".png")
        pose = POSE_IMG / cid / (safe + "_" + format(i, "02d") + ".png")
        if not pose.exists():
            raise SystemExit("骨架图缺失: " + str(pose) + "（先跑 render-poses.py）")
        if out.exists():
            n += 1
            continue
        overlay = upload_overlay(portrait, pose, cid, a, i)
        prompt = PROMPT_TMPL.format(
            desc=desc,
            hint=POSE_HINTS.get(a, ""),
            frame_desc=describe_frame(data["anims"][a]["frames"][i]),
        )
        seed = (20261101 + int(cid[1:]) * 100000 + zlib.crc32((a + "_" + str(i)).encode()) % 90000 + 1000) & 0x7FFFFFFF
        ok = False
        for attempt in range(4):
            try:
                if out.exists():
                    out.unlink()
                dt = run(wf(overlay, prompt, seed + attempt * 7, "f2_" + cid + "_f"), out)
                good, why, mask = verify(out, pose)
                if good:
                    from PIL import Image
                    im = Image.open(out).convert("RGBA")
                    im.putalpha(Image.fromarray((mask * 255).astype("uint8")))
                    im.save(out)
                    n += 1
                    print("ok " + str(n) + "/" + str(len(todo)) + " " + out.name + " (" + format(dt, ".0f") + "s)", flush=True)
                    ok = True
                    break
                print("bad " + out.name + " [" + why + "] retry " + str(attempt + 1), flush=True)
            except RuntimeError as e:
                print("err " + out.name + ": " + str(e)[:200] + " retry " + str(attempt + 1), flush=True)
        if not ok:
            print("FAIL " + out.name + "（4 次未过验收，留待人工处理）", flush=True)
    print("DONE " + cid + " " + str(n) + "/" + str(len(todo)), flush=True)


if __name__ == "__main__":
    main()
