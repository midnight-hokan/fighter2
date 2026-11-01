#!/usr/bin/env python3
# C2 过场美术批量生成（INBOX 20:30）：
#   1) 场景图 32 张：story.js IMAGES 描述 → Qwen-Image-2512 t2i，1280×720
#      → public/assets/meilong/scenes/<id>.png
#   2) 表情立绘 8 人×4 表情：定稿立绘(docs/art-review/<id>-portrait.png)做参考
#      → Qwen-Image-Edit-2511 改表情+半身构图，768×1024，BiRefNet 抠透明
#      → public/assets/meilong/portraits/<id>/<expr>.png（RGBA）
#      抠图前原图存 art-work/c2/raw-portraits/<id>_<expr>.png（只重抠不重生成）
# 用法：python3 scripts/art/gen-c2.py [scenes|portraits|all]
# 断点续跑：输出已存在的自动跳过。心跳：每张图前后 touch .check/heartbeat。
# SEED_SALT 环境变量换种子簇（重试失败图时用）。

import json
import os
import sys
import time
import zlib
import numpy as np
import requests
from pathlib import Path
from PIL import Image

API = "http://127.0.0.1:8188"
ROOT = Path(__file__).resolve().parent.parent.parent
SCENES_OUT = ROOT / "public/assets/meilong/scenes"
PORTRAITS_OUT = ROOT / "public/assets/meilong/portraits"
RAW_DIR = ROOT / "art-work/c2/raw-portraits"
UPLOAD = Path.home() / "ComfyUI/input"
OUTPUT = Path.home() / "ComfyUI/output"
HB = ROOT / ".check/heartbeat"

T2I_UNET = "qwen_image_2512_fp8_e4m3fn.safetensors"
EDIT_UNET = "qwen_image_edit_2511_fp8mixed.safetensors"
CLIP = "qwen_2.5_vl_7b_fp8_scaled.safetensors"
VAE = "qwen_image_vae.safetensors"
BIREFNET = "birefnet.safetensors"

# —— 场景图：描述取自 src/theme/meilong/story.js IMAGES（勿改台词，这里只是出图提示词）——
IMAGES = {
    "op_town": "黄昏，群山环抱的北方矿区全景：井架、天轮、高耸的烟囱，矿区小镇的楼房亮起灯",
    "op_museum": "矿史馆玻璃柜里一盏老式矿灯（头灯），铜灯头擦得发亮，旁边是泛黄的老照片",
    "op_square": "矿区广场，电线杆上的铁皮大喇叭，下面一群下了班的矿工抬头听广播",
    "op_bath": "澡堂门口和食堂窗口，三三两两的矿工在低声议论，脸上带着煤灰",
    "op_tunnel": "井下废弃的老三号大巷，宽阔的拱形巷道，两侧矿灯一字排开，中间空出一片擂台",
    "op_eight": "巷道入口逆光，八个人的剪影并排站立，安全帽上的矿灯同时亮起",
    "c01_a": "工作面上，年轻的采煤队长在轰鸣的采煤机旁指挥，煤尘在矿灯光柱里飞舞",
    "c01_b": "老旧的家门口，墙上挂着一顶褪色的安全帽，一位退休老矿工坐在门槛上抽烟",
    "c02_a": "救护中队训练场，队员们背着呼吸器在烟雾巷道里匍匐前进",
    "c02_b": "值班室墙上的出警记录板，一排排日期和地点，旁边挂着救援钩",
    "c03_a": "井下机电硐室，巨大的变压器和配电柜，电缆像藤蔓一样爬满墙壁",
    "c03_b": "仓库里一台盖着帆布的旧采煤机，帆布一角掀开，露出擦得锃亮的零件",
    "c04_a": "安监科办公室，墙上贴满隐患整改通知单，桌上一本翻旧的罚单本",
    "c04_b": "多年前的井下险情现场，昏暗的巷道里一束救护队员的头灯照进来",
    "c05_a": "宣传科的办公室，满墙标语和黑板报草稿，桌上堆着广播稿",
    "c05_b": "矿史馆的照片墙，几十年的老照片里几乎全是男人的面孔",
    "c06_a": "矿灯房里一排排充电架，几百盏矿灯的指示灯闪着绿光",
    "c06_b": "深夜的矿灯房，一个姑娘趴在桌上，对着一张老矿灯的图纸出神",
    "c07_a": "矿上的大澡堂门口，挂满钥匙的柜台，升井的矿工排着长队领毛巾",
    "c07_b": "二十多年前的擂台老照片：一个年轻姑娘和一个年轻矿工在擂台上对峙",
    "c08_a": "矿医院急诊室，白大褂挂在椅背上，桌上摊着一叠体检报告",
    "c08_b": "井口，救护车旁，一个女医生背着急救包正要下井",
    "vs_arena": "老三号大巷里的擂台，两侧围满戴安全帽的矿工，矿灯光束交错",
    "checkup": "擂台尽头，一张铺着白布的桌子，上面放着听诊器和血压计，背后是巷道深处的白光",
    "c01_end": "矿史馆里，头灯旁边挂着一顶褪色的安全帽，阳光照进窗户",
    "c02_end": "训练场上，救护队员身边多了一台四足巡检机器人和一架无人机",
    "c03_end": "崭新的智能装备维护中心，大屏幕上跳动着设备数据，机电队长站在最前面",
    "c04_end": "全矿大会的礼堂，台下坐满了人，讲台上的人摘下了白色安全帽",
    "c05_end": "矿史馆新增的一面墙，上面写满女性的名字，前面摆着鲜花",
    "c06_end": "矿史馆里那盏头灯重新亮起，光照亮了玻璃柜里的老照片",
    "c07_end": "深夜的澡堂灯火通明，热气腾腾，门口排着长队的矿工们有说有笑",
    "c08_end": "矿医院的桌上，一本擂台记录本翻开着，上面写满了体检意见",
}

# 个别场景的特殊质感覆盖（拼在描述后、统一风格前）
OVERRIDES = {
    "c07_b": "，泛黄做旧的旧照片质感，照片边缘磨损",
    "op_eight": "，逆光剪影，看不清正脸",
}

STYLE_SUFFIX = (
    "。画面风格统一：北方煤矿题材游戏过场背景，厚涂赛璐璐风格，偏暖的工业色调，"
    "电影感宽幅构图，光影有层次。画面里出现的人物一律以背影、剪影或远景呈现，"
    "不出现清晰正脸特写。无文字、无水印、无logo、无特效。"
)

SCENE_NEG = "低质量，模糊，变形，3D，写实照片，水印，文字，字幕，logo，正脸特写，现代城市，明亮刺眼"

EXPRS = {
    "normal": "平静自然，眼神坚定，微微抿嘴",
    "angry": "愤怒，眉头紧皱，眼神锐利，咬紧牙关",
    "smug": "得意，嘴角上扬，自信坏笑，微微眯眼",
    "hurt": "痛苦，咬牙忍痛，表情难受，脸颊有一道浅浅擦伤",
}


def log(msg):
    print(time.strftime("%H:%M:%S ") + msg, flush=True)


def hb():
    HB.parent.mkdir(parents=True, exist_ok=True)
    HB.touch()


def scene_prompt(iid):
    return IMAGES[iid] + OVERRIDES.get(iid, "") + STYLE_SUFFIX


def portrait_prompt(expr, primary):
    return (
        "以这个人为基准，生成这个人的半身立绘（头部到胸部以上的半身像构图）。"
        "严格保持这个人的脸、发型、服装、配色完全不变，是同一个人，"
        "安全帽颜色和服装配色必须与参考图完全一致（主色 " + primary + "）。"
        + f"表情：{EXPRS[expr]}。"
        + "侧身朝右。人物在画面内完整居中，头顶距离上边缘约 8% 画布高度，"
        + "左右各留约 5% 空白，半身（头部到胸部）完整呈现，绝不被画面边缘裁切。"
        + "背景必须是均匀纯浅灰色（#d8d8d8），整块纯色无渐变。"
        + "厚涂赛璐璐风格，干净线稿，色块分明，无文字，无水印，无特效。"
    )


PORTRAIT_NEG = "低质量，模糊，变形，多余手指，多余肢体，水印，文字，变成另一个人，服装改变，3D，写实照片，全身，裁切，出框，头部被切，身体被切，贴边"


def wf_scene(prompt, seed, prefix):
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": T2I_UNET, "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": CLIP, "type": "qwen_image"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": VAE}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": prompt}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": SCENE_NEG}},
        "6": {"class_type": "EmptySD3LatentImage", "inputs": {"width": 1280, "height": 720, "batch_size": 1}},
        "7": {"class_type": "KSampler",
              "inputs": {"model": ["1", 0], "positive": ["4", 0], "negative": ["5", 0],
                         "latent_image": ["6", 0], "seed": seed, "steps": 20, "cfg": 3.0,
                         "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["3", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": prefix}},
    }


def wf_portrait(ref_name, prompt, seed, prefix):
    # 生成 + 抠图一体（同 gen_frames.py）：原图存一份，BiRefNet 抠成透明 RGBA 存一份
    raw_p = prefix + "_raw"
    fin_p = prefix + "_fin"
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": EDIT_UNET, "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": CLIP, "type": "qwen_image"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": VAE}},
        "4": {"class_type": "LoadImage", "inputs": {"image": ref_name}},
        "5": {"class_type": "TextEncodeQwenImageEditPlus",
              "inputs": {"clip": ["2", 0], "prompt": prompt, "image1": ["4", 0], "vae": ["3", 0]}},
        "6": {"class_type": "EmptySD3LatentImage", "inputs": {"width": 768, "height": 1024, "batch_size": 1}},
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
    base = OUTPUT if typ == "output" else Path.home() / "ComfyUI/temp"
    return base / sub / im["filename"] if sub else base / im["filename"]


def run(w, prefixes, timeout_min=12):
    """提交 workflow，等所有 prefixes 的输出出现。返回 {prefix: 源文件路径}。"""
    r = requests.post(API + "/prompt", json={"prompt": w, "client_id": "f2_c2"})
    j = r.json()
    if "error" in j:
        raise RuntimeError("QUEUE ERROR: " + json.dumps(j, ensure_ascii=False)[:800])
    pid = j["prompt_id"]
    t0 = time.time()
    last_hb = 0.0
    found = {}
    while time.time() - t0 < timeout_min * 60:
        time.sleep(4)
        if time.time() - last_hb > 30:
            hb()
            last_hb = time.time()
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


def gen_scenes():
    from PIL import Image
    SCENES_OUT.mkdir(parents=True, exist_ok=True)
    salt = int(os.environ.get("SEED_SALT", "0"))
    ok = fail = skip = 0
    for iid, _ in IMAGES.items():
        out = SCENES_OUT / (iid + ".png")
        if out.exists():
            skip += 1
            continue
        hb()
        base_seed = 50261100 + zlib.crc32(iid.encode()) % 90000 + salt * 7919
        prefix = "f2c2s_" + iid
        good = False
        for attempt in range(3):
            try:
                src_path = OUTPUT / (prefix + "_" + format(0, "d") + ".png")
                if src_path.exists():
                    src_path.unlink()
                seed = base_seed + attempt * 1000003
                found, dt = run(wf_scene(scene_prompt(iid), seed, prefix), [prefix])
                src = found[prefix]
                im = Image.open(src).convert("RGB")
                if im.size != (1280, 720):
                    im = im.resize((1280, 720))
                im.save(out)
                log("ok scene %s (%.0fs)" % (iid, dt))
                ok += 1
                good = True
                break
            except RuntimeError as e:
                log("err scene %s: %s (retry %d)" % (iid, str(e)[:200], attempt + 1))
        if not good:
            fail += 1
            log("FAIL scene %s（3 次失败，留待处理）" % iid)
    log("SCENES done: ok=%d skip=%d fail=%d total=%d" % (ok, skip, fail, len(IMAGES)))


def upload_ref(cid):
    from PIL import Image
    src = ROOT / "docs/art-review" / (cid + "-portrait.png")
    dst = UPLOAD / ("f2c2ref_" + cid + ".png")
    if not dst.exists():
        Image.open(src).convert("RGB").save(dst)
    return dst.name


def _hsv_vec(a):
    """向量化 RGB(HxW,3 uint8/float) -> (h[deg], s, v) 每像素。"""
    a = a.astype(float) / 255.0
    mx = a.max(axis=1); mn = a.min(axis=1)
    d = mx - mn
    h = np.zeros(len(a)); s = np.zeros(len(a)); v = mx
    nz = d > 0
    r, g, b = a[:, 0], a[:, 1], a[:, 2]
    m = nz * (mx == r); h[m] = (60.0 * ((g[m] - b[m]) / d[m]) + 360.0) % 360.0
    m = nz * (mx == g); h[m] = 60.0 * ((b[m] - r[m]) / d[m]) + 120.0
    m = nz * (mx == b); h[m] = 60.0 * ((r[m] - g[m]) / d[m]) + 240.0
    s[nz] = d[nz] / mx[nz]
    return h, s, v


def _hue_hist(pix):
    """有色像素（s>0.25, v>0.15）的 12 桶色相直方图（归一化）+ 饱和色彩总量。"""
    h, s, v = _hsv_vec(pix)
    keep = (s > 0.25) * (v > 0.15)
    hist, _ = np.histogram(h[keep], bins=12, range=(0.0, 360.0))
    hist = hist.astype(float)
    if hist.sum() > 0:
        hist = hist / hist.sum()
    mass = float(s[keep].sum())
    return hist, mass


def ref_hue_sig(portrait_path):
    """定稿立绘（RGB，浅底）头部+上身区（bbox 顶 45%）的色相签名。"""
    im = np.array(Image.open(portrait_path).convert("RGB")).astype(float)
    H, W = im.shape[:2]
    corners = [im[:40, :40], im[:40, -40:], im[-40:, :40], im[-40:, -40:]]
    bg = np.concatenate([x.reshape(-1, 3) for x in corners]).mean(axis=0)
    char = np.linalg.norm(im - bg, axis=2) > 40
    yy, xx = np.mgrid[0:H, 0:W]
    char = char * ((yy > H * 0.05) * (yy < H * 0.97) * (xx > W * 0.08) * (xx < W * 0.92))
    ys, _ = np.where(char)
    y0, y1 = ys.min(), ys.max()
    bh = max(1, y1 - y0)
    band = char * (yy < y0 + 0.45 * bh)
    return _hue_hist(im[band, :3])


def verify_portrait(rgba_path, refsig):
    """透明 RGBA 立绘验收：
    1) 不透明面积≥12%、人物够大
    2) 头部不裁切：bbox 顶部离画布上缘 ≥1.5%、左右离缘 ≥1%
    3) 身份色检：与定稿色相直方图相似度 ≥0.70，饱和色彩总量 ≥ 定稿的 55%
    返回 (ok, 原因)。"""
    arr = np.array(Image.open(rgba_path).convert("RGBA"))
    alpha = arr[:, :, 3]
    H, W = alpha.shape
    opaque = (alpha > 200).sum() / (H * W)
    if opaque < 0.12:
        return False, "不透明面积 %.1f%% < 12%%" % (opaque * 100)
    ys, xs = np.where(alpha > 200)
    if len(ys) < 5000:
        return False, "人物太小 %d px" % len(ys)
    y0, y1 = int(ys.min()), int(ys.max())
    if y0 < 0.015 * H:
        return False, "头顶裁切 y0=%d" % y0
    if int(xs.min()) < 0.01 * W or int(xs.max()) > W - 0.01 * W:
        return False, "左右裁切 x=[%d,%d]" % (int(xs.min()), int(xs.max()))
    if refsig is not None:
        rh, rmass = refsig
        gh, gmass = _hue_hist(arr[alpha > 200, :3])
        hsim = 1.0 - float(np.abs(gh - rh).sum()) / 2.0
        if hsim < 0.70:
            return False, "色相签名相似度 %.3f<0.70（身份漂移）" % hsim
        if rmass > 0 and gmass < 0.55 * rmass:
            return False, "色彩总量不足 %.0f<%.0f（灰化）" % (gmass, 0.55 * rmass)
    return True, ""


def gen_portraits():
    from PIL import Image
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    salt = int(os.environ.get("SEED_SALT", "0"))
    ok = fail = skip = 0
    _chars = os.environ.get("CHARS", "").strip()
    ids = [c.strip() for c in _chars.split(",") if c.strip()] if _chars else ["c0%d" % i for i in range(1, 9)]
    for cid in ids:
        d = PORTRAITS_OUT / cid
        d.mkdir(parents=True, exist_ok=True)
        ref_path = ROOT / "docs/art-review" / (cid + "-portrait.png")
        refsig = ref_hue_sig(str(ref_path))
        pdata = json.load(open(ROOT / "art-work/poses" / (cid + ".json")))
        primary = pdata.get("colors", {}).get("primary", "#888888")
        ref = upload_ref(cid)
        for expr in EXPRS:
            out = d / (expr + ".png")
            if out.exists():
                skip += 1
                continue
            hb()
            base_seed = 60261100 + int(cid[1:]) * 100000 + zlib.crc32((cid + expr).encode()) % 90000 + salt * 7919
            prefix = "f2c2p_%s_%s" % (cid, expr)
            good = False
            for attempt in range(6):
                try:
                    for p in (prefix + "_raw", prefix + "_fin"):
                        fp = OUTPUT / (p + "_0.png")
                        if fp.exists():
                            fp.unlink()
                    seed = base_seed + attempt * 1000003
                    found, dt = run(wf_portrait(ref, portrait_prompt(expr, primary), seed, prefix),
                                    [prefix + "_raw", prefix + "_fin"])
                    raw_src, fin_src = found[prefix + "_raw"], found[prefix + "_fin"]
                    raw_dst = RAW_DIR / (cid + "_" + expr + ".png")
                    raw_src.rename(raw_dst)          # 保存抠图前原图
                    good_p, why = verify_portrait(fin_src, refsig)
                    if not good_p:
                        log("bad portrait %s_%s [%s] retry %d" % (cid, expr, why, attempt + 1))
                        continue
                    Image.open(fin_src).convert("RGBA").save(out)
                    log("ok portrait %s_%s (%.0fs)" % (cid, expr, dt))
                    ok += 1
                    good = True
                    break
                except RuntimeError as e:
                    log("err portrait %s_%s: %s (retry %d)" % (cid, expr, str(e)[:200], attempt + 1))
            if not good:
                fail += 1
                log("FAIL portrait %s_%s（6 次失败，留待处理）" % (cid, expr))
    log("PORTRAITS done: ok=%d skip=%d fail=%d total=%d" % (ok, skip, fail, len(ids) * len(EXPRS)))


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which in ("scenes", "all"):
        gen_scenes()
    if which in ("portraits", "all"):
        gen_portraits()
    hb()
    log("ALL DONE")


if __name__ == "__main__":
    main()
