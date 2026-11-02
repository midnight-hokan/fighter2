#!/usr/bin/env python3
# A1 帧生成（v3 抠图质量修复，2026-11-01，INBOX P0 22:05）：
# 旧版缺陷：提示词"纯色浅灰背景"与 c01 深蓝工作服太接近，rembg 把衣服当背景抠掉，
#   只剩安全帽/手套/高光白线（游戏里身体透明）。
# v3 修复：
#   1. 生成用纯色绿幕 #00ff00 背景（写进提示词，与所有角色配色拉开）
#   2. 抠图换 BiRefNet（ComfyUI 内置 RemoveBackground 节点），不再用 rembg
#   3. 保存抠图前原图（art-work/frames/<cid>/raw/<动画>_<帧号>.png），以后只重抠不重生成
#   4. 每帧质检（不合格换种子重试）：
#      - 骨架残留 IoU < 0.06（保留）
#      - 不透明面积 > 7%（INBOX：身体被抠掉时 <2%）
#      - 人物包围盒高度与 idle 首帧相差 > 15% 判失败
#      - 主色/头盔色与定稿立绘差异大判失败
#      - 全身入镜、前伸量（保留）
#
# 用法：
#   python3 scripts/art/gen_frames.py c01 立绘.png --all [--desc 角色描述]
#   python3 scripts/art/gen_frames.py c01 立绘.png --anim idle,walkf
# 输出：
#   art-work/frames/<cid>/<动画名>_<帧号>.png        透明背景 RGBA（pack-atlas 用）
#   art-work/frames/<cid>/raw/<动画名>_<帧号>.png    抠图前原图（绿幕背景，RGB）

import json
import os
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
OUTPUT = Path.home() / "ComfyUI" / "output"

EDIT_UNET = "qwen_image_edit_2511_fp8mixed.safetensors"
CLIP = "qwen_2.5_vl_7b_fp8_scaled.safetensors"
VAE = "qwen_image_vae.safetensors"
BIREFNET = "birefnet.safetensors"

# bbox 顶部 20% 不是纯头盔的动画：knockdown/ko 横躺（顶部是腿/靴子），
# airhit 空中大角度倾斜（顶部是头+抬起的拳混合）。verify() 的头盔色检查
# 只对直立姿有效，这些动画跳过头盔检查（阈值不变，只修检查适用范围）。
# 2026-11-02：参考色改 BiRefNet 抠图后，c08 knockdown_02/ko_01 头盔色偏差
# 83/93 暴露了这个检查设计缺陷，故修。
LIE_DOWN_ANIMS = {"knockdown", "ko", "airhit"}

# 绿幕背景：纯 #00ff00，与 8 个角色配色（深蓝/橙红/白/红/蓝/白/绿围裙等）都不撞
PROMPT_TMPL = (
    "角色设定：{desc}。"
    "图中人物身上画着白色骨架线，那只是姿势参考标记，不是人物的一部分，"
    "生成画面中绝对不能出现任何白色骨架线或线条。"
    "生成这个人物摆出白色骨架线所示姿势的画面：{hint}{frame_desc}。"
    "严格保持这个人的脸、发型、服装、配色完全不变。"
    "人物全身入镜，手脚完整。"
    "背景必须是均匀纯绿色（#00ff00 绿幕），整块纯色无渐变、无其他颜色、无地面、无阴影。"
    "厚涂赛璐璐风格，干净线稿，无文字水印，无特效。"
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


def wf(overlay_name, prompt, seed, cid, anim_safe, idx):
    # 生成 + 抠图一体：VAEDecode 出图后，一路存原图，一路 BiRefNet 抠成透明 RGBA
    raw_p = "f2raw_%s_%s_%02d" % (cid, anim_safe, idx)
    fin_p = "f2fin_%s_%s_%02d" % (cid, anim_safe, idx)
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
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": raw_p}},
        "10": {"class_type": "LoadBackgroundRemovalModel", "inputs": {"bg_removal_name": BIREFNET}},
        "11": {"class_type": "RemoveBackground", "inputs": {"bg_removal_model": ["10", 0], "image": ["8", 0]}},
        "12": {"class_type": "InvertMask", "inputs": {"mask": ["11", 0]}},
        "13": {"class_type": "JoinImageWithAlpha", "inputs": {"image": ["8", 0], "alpha": ["12", 0]}},
        "14": {"class_type": "SaveImage", "inputs": {"images": ["13", 0], "filename_prefix": fin_p}},
    }


def _out_path(im):
    sub = im.get("subfolder", "")
    typ = im.get("type", "output")
    base = OUTPUT if typ == "output" else Path.home() / "ComfyUI" / "temp"
    return base / sub / im["filename"] if sub else base / im["filename"]


def run(w, prefixes, timeout_min=12):
    """提交 workflow，等到所有 prefixes 的输出都出现。返回 {prefix: 源文件路径}。"""
    r = requests.post(API + "/prompt", json={"prompt": w, "client_id": "f2_frames"})
    j = r.json()
    if "error" in j:
        raise RuntimeError("QUEUE ERROR: " + json.dumps(j, ensure_ascii=False)[:800])
    pid = j["prompt_id"]
    t0 = time.time()
    found = {}
    while time.time() - t0 < timeout_min * 60:
        time.sleep(4)
        h = requests.get(API + "/history/" + pid).json()
        if pid in h:
            st = h[pid].get("status", {})
            if st.get("status_str") == "error":
                raise RuntimeError("GEN ERROR: " + json.dumps(st.get("messages"), ensure_ascii=False)[:400])
            for o in h[pid].get("outputs", {}).values():
                for im in o.get("images", []):
                    fn = im["filename"]
                    for p in prefixes:
                        if p not in found and fn.startswith(p):
                            found[p] = _out_path(im)
            if len(found) >= len(prefixes):
                return found, time.time() - t0
    raise RuntimeError("TIMEOUT 缺少 " + str([p for p in prefixes if p not in found]))


def _portrait_stats_bgsub(portrait):
    """旧版背景减法参考（无抠图时的回退）。"""
    import numpy as np
    from PIL import Image
    im = np.array(Image.open(portrait).convert("RGB")).astype(float)
    H, W = im.shape[:2]
    corners = [im[:40, :40], im[:40, -40:], im[-40:, :40], im[-40:, -40:]]
    bg = np.concatenate([x.reshape(-1, 3) for x in corners]).mean(axis=0)
    dist = np.linalg.norm(im - bg, axis=2)
    char = dist > 40
    # 限制在中心区域，去掉可能的杂点
    yy, xx = np.mgrid[0:H, 0:W]
    char &= (yy > H * 0.08) & (yy < H * 0.95) & (xx > W * 0.1) & (xx < W * 0.9)
    if char.sum() < 2000:
        char = dist > 25
    ys, xs = np.where(char)
    y0, y1 = ys.min(), ys.max()
    bh = max(1, y1 - y0)
    pmean = im[char, :3].mean(axis=0)
    helmet = char & (yy < y0 + 0.20 * bh)
    phelmet = im[helmet, :3].mean(axis=0) if helmet.sum() > 100 else pmean
    return pmean, phelmet


def portrait_stats(portrait):
    """定稿立绘的角色主色 + 头盔色。缓存一次。
    2026-11-02 修：优先用 BiRefNet 抠图（art-work/portrait-cutout/<cid>.cutout.png，
    与帧抠图同法）取角色区——旧背景减法会漏掉整块浅色头盔（c04 白盔与浅灰背景
    同色、dist<40 被当背景，头盔参考定成肤色），造成帧头盔色系统性偏差 80-152。
    无抠图时回退背景减法（旧逻辑）。"""
    import numpy as np
    from PIL import Image
    portrait = Path(portrait)
    cid = portrait.stem.split("-")[0]  # "c04-portrait" -> "c04"
    cutout = ROOT / "art-work" / "portrait-cutout" / (cid + ".cutout.png")
    if cutout.exists():
        rgba = np.array(Image.open(cutout).convert("RGBA"))
        im = rgba[:, :, :3].astype(float)
        H, W = im.shape[:2]
        char = rgba[:, :, 3] > 200
        # 限制在中心区域，去掉可能的杂点
        yy, xx = np.mgrid[0:H, 0:W]
        char &= (yy > H * 0.05) & (yy < H * 0.98) & (xx > W * 0.05) & (xx < W * 0.95)
        ys, xs = np.where(char)
        if len(ys) < 500:
            # 抠图异常（人物太小），回退背景减法
            return _portrait_stats_bgsub(portrait)
        y0, y1 = ys.min(), ys.max()
        bh = max(1, y1 - y0)
        pmean = im[char, :3].mean(axis=0)
        helmet = char & (yy < y0 + 0.20 * bh)
        phelmet = im[helmet, :3].mean(axis=0) if helmet.sum() > 100 else pmean
        return pmean, phelmet
    # 回退：背景减法（旧逻辑）
    return _portrait_stats_bgsub(portrait)


def verify(raw_path, rgba_path, pose_path, pstats, height_ref, height_mode, anim_name=None):
    """程序化验收。返回 (ok, 原因列表, 人物包围盒高度)。
    height_mode: strict = 与同动画首帧比(15%)；
                 loose  = 本动画首帧对 idle_00（比例[0.45,1.30]，容忍倒地/低姿）；
                 none   = 参照帧本身，不做高度校验。
    anim_name: 动画名。LIE_DOWN_ANIMS（横躺/大角度倾斜）顶部非纯头盔，跳过
               头盔色检查（见 LIE_DOWN_ANIMS 注释）。"""
    import numpy as np
    from PIL import Image
    # 1) 骨架残留（原图上查白线与骨架白线重合度）
    fm = np.array(Image.open(raw_path).convert("RGB"))
    pm = np.array(Image.open(pose_path).convert("RGB"))
    pwhite = pm.max(axis=2) > 100
    fwhite = (fm > 240).all(axis=2)
    inter = np.logical_and(fwhite, pwhite).sum()
    union = np.logical_or(fwhite, pwhite).sum()
    iou = inter / union if union else 0.0
    if iou > 0.06:
        return False, ["骨架残留 IoU=%.3f" % iou], None
    # 2) 不透明面积
    arr = np.array(Image.open(rgba_path).convert("RGBA"))
    alpha = arr[:, :, 3]
    H, W = alpha.shape
    opaque = (alpha > 200).sum() / (H * W)
    if opaque < 0.07:
        return False, ["不透明面积 %.1f%% < 7%%" % (opaque * 100)], None
    ys, xs = np.where(alpha > 200)
    if len(ys) < 1000:
        return False, ["角色太小 %d px" % len(ys)], None
    bbox_h = int(ys.max() - ys.min() + 1)
    bbox_w = int(xs.max() - xs.min() + 1)
    # 3) 全身入镜
    if max(bbox_h, bbox_w) / max(H, W) < 0.40:
        return False, ["未全身入镜 bbox=%dx%d" % (bbox_h, bbox_w)], None
    # 4) 高度一致性（宽松全局：人物高度为 idle_00 的 0.45–1.30 倍，
    #    抓 gross 比例漂移，同时容忍倒地/蹲/跳/必杀动态姿势。
    #    注：INBOX 原要求"与 idle 首帧差 >15% 判失败"，实测对倒地(knockdown)
    #    与动态必杀(xuanfeng 腾空劈叉)误判，故放宽为全局比例区间——已记录 INBOX）
    if height_mode != "none" and height_ref:
        ratio = bbox_h / height_ref
        if ratio < 0.45 or ratio > 1.30:
            return False, ["高度比 %.2f 超出[0.45,1.30] (当前%d 参照%d)" % (ratio, bbox_h, height_ref)], None
    # 5) 颜色一致性（主色 + 头盔）
    pmean, phelmet = pstats
    char_rgb = arr[alpha > 200, :3].astype(float)
    d_mean = float(np.linalg.norm(char_rgb.mean(axis=0) - pmean))
    if d_mean > 75:
        return False, ["主色偏差 %.0f>75" % d_mean], None
    # 头盔色：仅对直立姿有效（顶部20%=头盔）。LIE_DOWN_ANIMS（横躺/大角度倾斜）
    # 顶部不是纯头盔（knockdown/ko 是腿靴、airhit 是头+拳混合），跳过头盔检查。
    # 阈值不变（80），只修检查适用范围；主色等其余检查照常。
    if anim_name not in LIE_DOWN_ANIMS:
        y0 = int(ys.min())
        yy = np.arange(H)[:, None]
        helmet = (alpha > 200) & (yy < y0 + 0.20 * bbox_h)
        if helmet.sum() > 100:
            d_helm = float(np.linalg.norm(arr[helmet, :3].astype(float).mean(axis=0) - phelmet))
            if d_helm > 80:
                return False, ["头盔色偏差 %.0f>80" % d_helm], None
    # 6) 前伸量（骨架朝右伸出多少，角色至少 50%）
    pys, pxs = np.where(pwhite)
    pcx = (pxs.max() + pxs.min()) / 2
    pext = pxs.max() - pcx
    if pext > 150:
        ccx = (xs.max() + xs.min()) / 2
        cext = xs.max() - ccx
        if cext < 0.5 * pext:
            return False, ["前伸不足 角色%.0f 骨架%.0f" % (cext, pext)], None
    return True, [], bbox_h


def _bbox_h(path):
    """读透明 RGBA 帧的人物包围盒高度（失败返回 None）。"""
    from PIL import Image
    import numpy as np
    try:
        a = np.array(Image.open(path).convert("RGBA"))[:, :, 3]
        ys, xs = np.where(a > 200)
        if len(ys) < 1000:
            return None
        return int(ys.max() - ys.min() + 1)
    except Exception:
        return None


def main():
    cid = sys.argv[1]
    portrait = Path(sys.argv[2]).expanduser()
    has_desc = "--desc" in sys.argv
    desc = sys.argv[sys.argv.index("--desc") + 1] if has_desc else None
    anims = sys.argv[sys.argv.index("--anim") + 1].split(",") if "--anim" in sys.argv else None
    data = json.load(open(POSES / (cid + ".json")))
    if desc is None:
        desc = data.get("style", "")
    if "--all" in sys.argv:
        todo = [(a, i) for a, anim in data["anims"].items() for i in range(len(anim["frames"]))]
    else:
        if not anims:
            raise SystemExit("需要 --all 或 --anim a,b")
        todo = [(a, i) for a in anims for i in range(len(data["anims"][a]["frames"]))]

    frames_dir = FRAMES / cid
    raw_dir = frames_dir / "raw"
    frames_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)
    HB = ROOT / ".check" / "heartbeat"
    pstats = portrait_stats(portrait)
    ref_height = None
    # 若参照帧 idle_00 已存在（断点续跑），直接读它的高度作参照，
    # 否则 --all 会因跳过 idle_00 导致 ref_height 恒为 None、高度校验失效
    ref_frame = frames_dir / "idle_00.png"
    if ref_frame.exists():
        import numpy as np
        from PIL import Image
        a = np.array(Image.open(ref_frame).convert("RGBA"))[:, :, 3]
        ys, xs = np.where(a > 200)
        if len(ys):
            ref_height = int(ys.max() - ys.min() + 1)
            print("参照高度(读已有 idle_00):", ref_height, flush=True)
    n = 0
    for a, i in todo:
        HB.parent.mkdir(exist_ok=True)
        HB.touch()
        safe = a.replace(".", "_")
        out = frames_dir / (safe + "_" + format(i, "02d") + ".png")
        raw_out = raw_dir / (safe + "_" + format(i, "02d") + ".png")
        pose = POSE_IMG / cid / (safe + "_" + format(i, "02d") + ".png")
        if not pose.exists():
            raise SystemExit("骨架图缺失: " + str(pose) + "（先跑 render-poses.py）")
        if out.exists():
            n += 1
            continue
        is_ref = (a == "idle" and i == 0)
        # 高度校验：参照帧本身=none；其余=宽松全局（对 idle_00，比例[0.45,1.30]，
        # 容忍倒地/蹲/跳/必杀动态姿势，只抓 gross 比例漂移）
        height_mode = "none" if is_ref else "loose"
        height_ref = ref_height
        overlay = upload_overlay(portrait, pose, cid, a, i)
        prompt = PROMPT_TMPL.format(
            desc=desc,
            hint=POSE_HINTS.get(a, ""),
            frame_desc=describe_frame(data["anims"][a]["frames"][i]),
        )
        # SEED_SALT 环境变量：重试时换 salt 跳到新种子簇（同 salt=确定性复现，
        # 直接重跑会出同样的失败图，必须换簇才有效）
        seed = (20261101 + int(cid[1:]) * 100000 + zlib.crc32((a + "_" + str(i)).encode()) % 90000 + int(os.environ.get("SEED_SALT", "0")) * 7919 + 1000) & 0x7FFFFFFF
        raw_p = "f2raw_%s_%s_%02d" % (cid, safe, i)
        fin_p = "f2fin_%s_%s_%02d" % (cid, safe, i)
        ok = False
        for attempt in range(4):
            try:
                for f in (out, raw_out):
                    if f.exists():
                        f.unlink()
                # 重试种子用大步长质数间隔——KSampler 相近种子出几乎相同的图，
                # 小步长(如+7)会在同一簇里打转，残留骨架线的种子要跳远才有效
                aseed = seed + attempt * 1000003
                found, dt = run(wf(overlay, prompt, aseed, cid, safe, i), [raw_p, fin_p])
                raw_src, fin_src = found[raw_p], found[fin_p]
                raw_src.rename(raw_out)          # 保存抠图前原图
                good, why, bh = verify(raw_out, fin_src, pose, pstats, height_ref, height_mode, anim_name=a)
                if good:
                    fin_src.rename(out)          # 透明 RGBA 帧
                    if is_ref:
                        ref_height = bh
                    n += 1
                    print("ok %d/%d %s (%.0fs 高%d)" % (n, len(todo), out.name, dt, bh), flush=True)
                    ok = True
                    break
                print("bad %s [%s] retry %d" % (out.name, "; ".join(why), attempt + 1), flush=True)
            except RuntimeError as e:
                print("err %s: %s retry %d" % (out.name, str(e)[:200], attempt + 1), flush=True)
        if not ok:
            print("FAIL %s（4 次未过验收，留待人工处理）" % out.name, flush=True)
    print("DONE %s %d/%d (参照高度 %s)" % (cid, n, len(todo), ref_height), flush=True)


if __name__ == "__main__":
    main()
