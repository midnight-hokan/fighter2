#!/usr/bin/env python3
"""wan-v3.py — v3 全量动画生产（Wan2.2-Animate 驱动视频 → 1024×1024 透明帧）。

管线（每角色 46 动画）：
  prep <cid>  参考立绘 480×832 上传 + 每动画 dense 驱动序列（1024 彩虹骨架→4% 边距居中 480×832）
              上传 ComfyUI，存 fit.json（逐帧 s/x0/y0/cx/cy 仿射参数）
  gen <cid>   逐动画：Wan 视频（length 对齐 8k+1）→ 取 pick 帧 → BiRefnet 批量抠图
              → 逐帧逆仿射回 1024 → art-work/frames-v3/<cid>/<anim>_<k:02d>.png + mp4 归档
  contact <cid>  帧联系表 docs/art-review/v3-<cid>.jpg
  finish <cid>   frame-qc(K/G/P, poses-v3) + pack-atlas --v3 + contact + 结果报告
  run             8 角色顺序全量（心跳守护 + 逐人 commit），断点续跑（按产物存在性跳过）

复刻试点（c04 cr.hk 已验证）：骨架渲染/fit/提示词/节点参数全部与 wan-pilot 一致。
断点续跑：prep 按 fit.json 跳过；gen 按 mp4+全帧跳过。
"""
import json, os, sys, zlib, shutil, subprocess, time
import urllib.parse
import urllib.request
from PIL import Image, ImageDraw

PY = "/home/yuguang/latentsync-env/bin/python"
ROOT = os.path.expanduser("~/projects/fighter2")
WORK = os.path.join(ROOT, "art-work/wan-v3")
REFDIR = os.path.join(WORK, "ref")
FRAMES = os.path.join(ROOT, "art-work/frames-v3")
ANIMATE = os.path.join(ROOT, "art-work/animate")
REV = os.path.join(ROOT, "docs/art-review")
CK = os.path.join(ROOT, ".check")
LOG = os.path.join(CK, "v3-frames.log")
CUI = "http://localhost:8188"
INPUT_DIR = os.path.expanduser("~/ComfyUI/input")

W, H = 480, 832                 # ComfyUI 驱动/生成画布（9:16）
TARGET_H = int(H * 0.88)        # 主体占高 732（试点参数）
TARGET_W = 450
LIMBS = [(1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7), (1, 8), (8, 9), (9, 10), (1, 11), (11, 12), (12, 13), (1, 0), (0, 14), (14, 16), (0, 15), (15, 17)]
COLORS = [(255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0), (170, 255, 0), (85, 255, 0), (0, 255, 0), (0, 255, 85), (0, 255, 170),
          (0, 255, 255), (0, 170, 255), (0, 85, 255), (0, 0, 255), (85, 0, 255), (170, 0, 255), (255, 0, 255), (255, 0, 170), (255, 0, 85)]
ORDER = ["c04", "c07", "c01", "c03", "c02", "c05", "c06", "c08"]

WAN_UNET = "wan2.2_animate_14B.safetensors"
WAN_TEXT = "umt5_xxl_fp8_e4m3fn_scaled.safetensors"
WAN_VAE = "wan_2.1_vae.safetensors"
WAN_CLIPV = "clip_vision_h.safetensors"

# 试点验证过的提示词原文
POS_BASE = ("Full body side view of a single fighter character, complete body visible from head to feet, "
            "plain light beige studio background, sharp focus, high quality, clean illustration, no text, no watermark")
NEG_BASE = ("close-up, cropped, partial body, head only, blurry, deformed, distorted, extra limbs, extra fingers, "
            "mutated hands, mutated face, watermark, text, logo, signature, low quality, jpeg artifacts, dark background")

POSE_PROMPTS = {
  "idle":"standing idle, balanced fighting stance","walkf":"walking forward, mid stride","walkb":"walking backward, mid stride",
  "crouch":"crouching low, knees bent, ready position","prejump":"coiling legs for a jump, slight crouch","jump":"jumping, legs tucked, airborne",
  "blockstun":"block broken, leaning back slightly","crblock":"crouching guard, arms raised in crouch","hitstun":"hit reaction, leaning back, head snapping",
  "airhit":"hit in the air, body recoiling backward","knockdown":"falling down to the ground","dizzy":"staggering, dizzy, wobbling",
  "roll":"rolling on the ground, tucking body","maxstart":"charging up a special move, crouching with energy","ko":"knocked out, lying flat on the ground",
  "win":"victory pose, standing tall with fist raised","win2":"victory pose, flexing arms triumphantly","throw":"grabbing and lifting the opponent for a throw",
  "gc":"being grabbed, arms crossed being held","intro":"fighting entrance pose, fists raised","taunt":"taunting, pointing and mocking",
  "st.lp":"a light punch jab, one arm extended straight","st.hp":"a heavy punch, big straight cross punch","st.lk":"a low kick, front leg extended low","st.hk":"a high kick, leg extended to head height",
  "cr.lp":"a crouching light punch, low jab","cr.hp":"a crouching heavy punch, rising elbow punch","cr.lk":"a crouching low kick, short front kick","cr.hk":"a high crouching kick, one leg raised and extended upward, dynamic kick motion",
  "j.lp":"a jumping light punch, airborne punch","j.hp":"a jumping heavy punch, airborne big punch","j.lk":"a jumping low kick, airborne low kick","j.hk":"a jumping high kick, airborne flying kick",
  "cl.hp":"a claw heavy punch, big claw strike forward","cl.hk":"a claw high kick, claw foot strike","cd":"a crouch dash, lunging low forward","j.cd":"a jumping dash, flying forward",
  # c01 梅兰（矿工）
  "meiyan":"throwing the miner's lamp forward as a projectile, arm extended forward","chongtian":"an uppercut strike upward with both arms, body driving up",
  "xuanfeng":"a spinning kick, leg sweeping in an arc","dengya":"a mid-level pressing punch, short forward thrust","dihuolong":"a full-power multi-hit cutting combo, aggressive lunging strikes",
  "jiegeshangtiao":"an uppercut thrusting strike, arm swinging upward","meihuozhang":"a wide open-palm strike forward","dihuopenyong":"a bursting ground strike, both arms driving down and out","meilongquan":"a powerful dragon fist combo, big winding punch",
  # c02 赵铁柱（救援）
  "baokong":"an explosive forward blast, arms pushing out","tanshui":"a forward probing lunge with extended arm","chongtianshan":"a rising uppercut, body driving upward",
  "gousao":"a low hooking sweep with the leg","longxuantan":"a spinning kick, body rotating","yangqipingzhuang":"a shoulder check charge, body lunging forward",
  "gousuolazhuai":"grabbing and yanking the opponent in","yangqibaopen":"an explosive double palm blast, both arms out","juejingjiuyuan":"a big rescue sweep, wide low kick",
  # c03 雷震（电工）
  "zhongdan":"a mid-level straight punch","suiluo":"a heavy falling strike, arm dropping down","kengtai":"a ground slam, driving the opponent down",
  "lansao":"a cable whip sweep, arm swinging wide","chaozhong":"a heavy overhead smash, both arms overhead","banshouza6c":"a wrench smash, big swing with the wrench",
  "gaoyadianzhu":"a vertical upward strike, arm thrusting straight up","loudianqu":"a wide spreading strike, both arms opening out","quankuangtingdian":"a final heavy blow, both arms crashing down",
  # c04 严正（安监）
  "denghua":"a fast lunging multi-hit rush, quick successive punches","shanguang":"an armored counter strike, powerful mid punch","jifenghua":"a fast rising kick, quick low to high kick",
  "fadanjia":"a two-hander clamp strike, both arms clamping forward","huaying":"a shadow step strike, quick sidestep and punch","huabuditi":"a flowing step low kick, weaving low kick",
  "kaifadan":"a ticket book strike, thrusting the book forward","quanmiantingchan":"a full shutdown combo, multi-hit punching barrage","anquandajiancha":"a sweeping inspection kick, big checking kick",
  # c05 大喇叭（广播员）
  "denghuadan":"a megaphone sound wave blast, pushing the horn forward","daiteng":"a banner whip strike, swinging the banner roll","dengzhuo":"a horn jab, quick thrust with the horn",
  "hengsaotui":"a low banner sweep, sweeping kick with the banner roll","denghuadrag":"a horn drag strike, pulling the horn across","hengfuchou":"a banner elbow, striking with the elbow",
  "guangbohuiyin":"a broadcast echo wave, both hands pushing out a wave","biaoyuqiang":"a slogan wall, both arms spreading a barrier","zhenerlong":"a final dragon strike, horn thrust combo",
  # c06 灯影（跑灯）
    "shanfengt":"a high-speed charging dash, body lunging forward, lead fist driving a rushing punch","feihua":"a flying kick, quick spinning kick","jifengdan":"a fast lamp flash strike, both lamps forward",
  "dengliandian":"a lamp chain jab, quick double lamp thrust","jifenglong":"a gale needle thrust, fast straight jab","dikonghuachan":"a ground to air spark, low rising kick",
  "denglianxiaza":"a lamp chain down slam, both lamps driving down","liuguanglianwu":"a flowing light dance, multi-hit combo","qiandengzhaojing":"a front lamp flash, both lamps thrusting forward",
  # c07 老抠（保洁）
  "chongtiant":"a two-handed mop uppercut, driving the mop upward with both hands","zhongdanluo":"a mop downward strike, swinging the mop down","zhongkeng":"a mid-level mop jab, thrusting the mop forward",
  "tuobachongtui":"a mop thrusting kick, kicking while holding the mop","tongshoulong":"a mop head thrust, punching forward with the mop","tuobasaodi":"a mop floor sweep, low sweeping stroke with the mop",
  "xuanfengtuoba":"a spinning mop whirlwind, body rotating with the mop","zhengqidasaochu":"a big rectification sweep, wide multi-sweep combo","reshuiguanbaolie":"a bursting spray rush, explosive forward mop thrust",
  # c08 灰鹤（针灸）
  "huiyan":"a needle throw, throwing needles forward with a flick","huihe":"a crane needle jab, quick straight needle thrust","huayan":"a swift needle flurry, multi-hit needle strikes",
  "zhenxiansao":"a needle thread sweep, low sweeping needle strike","huiyanlong":"a swirling needle vortex, spinning multi-needle combo","dianxuezhi":"a pressure point uppercut, two-finger upper thrust",
  "zhenzhen":"a double needle jab, quick two-needle thrust","fengxue":"a blizzard needle storm, spreading needle strike","huihunjiuzhen":"a final healing needle, dramatic needle thrust combo",
}

# ---------- 日志 / 随机 ----------
def log(msg):
    line = f"[{time.strftime('%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    os.makedirs(CK, exist_ok=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")

def seed_for(cid, anim, attempt=0):
    return (20261104 + zlib.crc32(f"{cid}:{anim}".encode()) % 100000 + 1000003 * attempt) % (2**63)

# ---------- ComfyUI ----------
def queue_prompt(wf):
    req = urllib.request.Request(CUI + "/prompt", data=json.dumps({"prompt": wf}).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=30))["prompt_id"]

def wait_done(pid, timeout=2700):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            h = json.load(urllib.request.urlopen(CUI + "/history/" + pid, timeout=30))
        except Exception:
            time.sleep(5)
            continue
        if pid in h:
            out = h[pid]["outputs"]
            for v in out.values():
                if isinstance(v, dict) and v.get("status") == "error":
                    raise RuntimeError("node error: " + str(v.get("status_message", ""))[:400])
            if h[pid].get("status", {}).get("completed"):
                return out
        time.sleep(3)
    raise TimeoutError("prompt " + pid + " timeout")

def _save_imgs(o):
    """SaveImage 输出取平图列表：本机构建扁平 [{filename,subfolder,type}]，标准版双层 [[{...}]]"""
    imgs = o.get("images", [])
    if imgs and isinstance(imgs[0], list):
        return imgs[0]
    return imgs

def view_image(im, local):
    url = (f"{CUI}/view?filename={urllib.parse.quote(im['filename'])}"
           f"&subfolder={im.get('subfolder', '')}&type={im.get('type', 'output')}")
    with urllib.request.urlopen(url, timeout=300) as r, open(local, "wb") as f:
        shutil.copyfileobj(r, f)

def upload(name, local):
    import requests
    with open(local, "rb") as f:
        r = requests.post(CUI + "/upload/image",
                          files={"image": (name, f)},
                          data={"overwrite": "true", "subfolder": "", "type": "input"},
                          timeout=120)
    if r.status_code != 200:
        raise RuntimeError(f"upload failed {name}: {r.status_code} {r.text[:200]}")

# ---------- 骨架 / 驱动（与 wan-pilot-prep 完全一致） ----------
def render_skeleton(kp, size=1024):
    im = Image.new("RGB", (size, size), (0, 0, 0))
    d = ImageDraw.Draw(im)
    for li, (a, b) in enumerate(LIMBS):
        d.line([tuple(kp[a][:2]), tuple(kp[b][:2])], fill=COLORS[li % 18], width=8)
    for ki, (x, y, c) in enumerate(kp):
        r = 8
        d.ellipse([x - r, y - r, x + r, y + r], fill=COLORS[ki])
    return im

def bbox_fit(im, bg=(0, 0, 0), thresh=30, canvas_bg=None):
    """主体 bbox 适配 480×832（88% 高、宽 ≤450），居中。返回 (canvas, fit 参数)"""
    px = im.load()
    xs, ys = [], []
    for y in range(0, im.height, 2):
        for x in range(0, im.width, 2):
            r, g, b = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > thresh:
                xs.append(x); ys.append(y)
    if not xs:
        return im.resize((W, H)), {"s": W / im.width, "x0": 0, "y0": 0, "cx": 0, "cy": 0}
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    m = int(0.04 * max(x1 - x0, y1 - y0))
    x0, y0 = max(0, x0 - m), max(0, y0 - m)
    x1, y1 = min(im.width - 1, x1 + m), min(im.height - 1, y1 + m)
    crop = im.crop((x0, y0, x1 + 1, y1 + 1))
    s = min(TARGET_H / (y1 - y0 + 1), TARGET_W / (x1 - x0 + 1))
    nw, nh = max(1, int((x1 - x0 + 1) * s)), max(1, int((y1 - y0 + 1) * s))
    canvas = Image.new("RGB", (W, H), canvas_bg if canvas_bg is not None else (0, 0, 0))
    cx, cy = (W - nw) // 2, (H - nh) // 2
    canvas.paste(crop.resize((nw, nh), Image.Resampling.LANCZOS), (cx, cy))
    return canvas, {"s": s, "x0": x0, "y0": y0, "cx": cx, "cy": cy}

def load_poses(cid):
    with open(os.path.join(ROOT, "art-work/poses-v3", f"{cid}.json")) as f:
        return json.load(f)

def lerp_kp(a, b, t):
    return [[a[i][0] + (b[i][0] - a[i][0]) * t, a[i][1] + (b[i][1] - a[i][1]) * t,
             max(a[i][2], b[i][2])] for i in range(len(a))]

def resample_dense(seq, n):
    """dense 序列重采样到 n 帧（线性插值关键点）"""
    m = len(seq)
    if m == n:
        return seq
    out = []
    for t in range(n):
        pos = t * (m - 1) / (n - 1)
        i0 = int(pos)
        i1 = min(m - 1, i0 + 1)
        out.append(lerp_kp(seq[i0], seq[i1], pos - i0))
    return out


# ---------------- 格斗架势参考图（01:30 规范：参考图用全身格斗架势，非站立立绘） ----------------
EDIT_UNET = "qwen_image_edit_2511_fp8mixed.safetensors"
EDIT_CLIP = "qwen_2.5_vl_7b_fp8_scaled.safetensors"
EDIT_VAE = "qwen_image_vae.safetensors"
REFGEN_PROMPT = ("Convert this standing portrait into a full-body dynamic fighting stance: "
                 "one foot forward, knees bent, fists raised in a martial arts guard, ready to fight. "
                 "Full body visible from head to feet, same character, identical face and outfit, "
                 "plain light beige studio background, no text, no visual effects")
REFGEN_NEG = ("text, watermark, deformed, extra limbs, multiple people, sitting, lying down, "
              "close-up, half body, visual effects, fire, lightning")


def wf_refgen(ref_name, prompt, neg, seed, prefix):
    """Edit-2511 img2img（denoise 0.55）+ BiRefNet 抠图副产物（供覆盖度/直方图评分）"""
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": EDIT_UNET, "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": EDIT_CLIP, "type": "qwen_image"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": EDIT_VAE}},
        "4": {"class_type": "LoadImage", "inputs": {"image": ref_name}},
        "5": {"class_type": "TextEncodeQwenImageEditPlus",
              "inputs": {"clip": ["2", 0], "prompt": prompt, "image1": ["4", 0], "vae": ["3", 0]}},
        "6": {"class_type": "VAEEncode", "inputs": {"pixels": ["4", 0], "vae": ["3", 0]}},
        "7": {"class_type": "KSampler",
              "inputs": {"model": ["1", 0], "positive": ["5", 0], "negative": ["5", 0],
                         "latent_image": ["6", 0], "seed": seed, "steps": 15, "cfg": 1.0,
                         "sampler_name": "euler", "scheduler": "simple", "denoise": 0.55}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["3", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": prefix}},
        "10": {"class_type": "LoadBackgroundRemovalModel", "inputs": {"bg_removal_name": "birefnet.safetensors"}},
        "11": {"class_type": "RemoveBackground", "inputs": {"bg_removal_model": ["10", 0], "image": ["8", 0]}},
        "12": {"class_type": "InvertMask", "inputs": {"mask": ["11", 0]}},
        "13": {"class_type": "JoinImageWithAlpha", "inputs": {"image": ["8", 0], "alpha": ["12", 0]}},
        "14": {"class_type": "SaveImage", "inputs": {"images": ["13", 0], "filename_prefix": prefix + "_fin"}},
    }


def _lab_hist(img, bins=6, topn=24):
    """LAB 6x6x6 直方图 top-24 归一（与 frame-qc ID 检查同族判据，抓服装/身份漂移）"""
    lab = img.convert("LAB").resize((48, 48))
    c = {}
    for (L, A, B) in lab.getdata():
        k = (min(L * bins // 256, bins - 1), min(A * bins // 256, bins - 1), min(B * bins // 256, bins - 1))
        c[k] = c.get(k, 0) + 1
    total = lab.width * lab.height
    return {k: v / total for k, v in sorted(c.items(), key=lambda x: -x[1])[:topn]}


def _lab_dist(h1, h2):
    keys = set(h1) | set(h2)
    return sum(abs(h1.get(k, 0) - h2.get(k, 0)) for k in keys) / 2


def _coverage_alpha(img):
    a = img.getchannel("A").histogram()
    return sum(a[128:]) / (img.width * img.height)


def _refgen_sheet(cid, portrait, cands, picked):
    """docs/art-review/wan-v3-refgen-<cid>.jpg：立绘 | cand0 | cand1（标注选中）"""
    import shutil as _sh
    cells = [Image.open(portrait).convert("RGB")] + [Image.open(r).convert("RGB") for r, _ in cands]
    w, h = 512, 512
    sheet = Image.new("RGB", (w * 3 + 8 * 2, h + 28), (245, 243, 240))
    from PIL import ImageDraw
    dr = ImageDraw.Draw(sheet)
    labels = [f"portrait", f"cand0{'  <-- picked' if picked == 0 else ''}", f"cand1{'  <-- picked' if picked == 1 else ''}"]
    for i, (im, lb) in enumerate(zip(cells, labels)):
        sheet.paste(im.resize((w, h), Image.Resampling.LANCZOS), (8 + i * (w + 8), 28))
        dr.text((12 + i * (w + 8), 8), lb, fill=(30, 30, 30))
    out = os.path.join(ROOT, "docs", "art-review", f"wan-v3-refgen-{cid}.jpg")
    sheet.save(out, quality=88)
    return out


def refgen(cid):
    """格斗架势参考图：Edit-2511 两候选 → LAB 直方图+覆盖度评分自动挑优 → 480 上传 wanv3_<cid>_ref.png。
    失败（OOM/超时）抛异常由调用方降级为站立立绘参考（prep_ref 兜底）。"""
    portrait = os.path.join(REV, f"{cid}-portrait.png")
    if not os.path.exists(portrait):
        raise RuntimeError(f"portrait missing: {portrait}")
    os.makedirs(REFDIR, exist_ok=True)
    cands = []
    base_hist = _lab_hist(Image.open(portrait).convert("RGB"))
    for k in range(2):
        tag = f"wanv3_{cid}_ref_cand{k}"
        upload(f"{tag}_src.png", portrait)
        try:
            wf = wf_refgen(f"{tag}_src.png", REFGEN_PROMPT, REFGEN_NEG,
                           int(time.time()) * 100 + k, f"f2v3_{cid}_ref_cand{k}")
            out = wait_done(queue_prompt(wf), timeout=1800)
            raw = os.path.join(REFDIR, f"{cid}_cand{k}_raw.png")
            fin = os.path.join(REFDIR, f"{cid}_cand{k}_fin.png")
            view_image(_save_imgs(out["9"])[0], raw)
            view_image(_save_imgs(out["14"])[0], fin)
            cands.append((raw, fin))
        finally:
            try:
                os.remove(os.path.join(INPUT_DIR, f"{tag}_src.png"))
            except OSError:
                pass
    if len(cands) < 2:
        raise RuntimeError("refgen: candidate generation failed")
    scored = []
    for k, (raw, fin) in enumerate(cands):
        d = _lab_dist(_lab_hist(Image.open(raw).convert("RGB")), base_hist)
        cov = _coverage_alpha(Image.open(fin))
        scored.append((d, cov, k))
        log(f"refgen {cid} cand{k}: lab_dist={d:.4f} coverage={cov:.1%}")
    scored.sort()
    d, cov, k = scored[0]
    raw, fin = cands[k]
    best = os.path.join(REFDIR, f"{cid}_stance.png")
    import shutil as _sh
    _sh.copy(raw, best)
    sheet = _refgen_sheet(cid, portrait, cands, k)
    log(f"refgen {cid}: picked cand{k} (lab_dist={d:.4f}, cov={cov:.1%}) -> {best}; sheet {sheet}")
    # 480 参考图（与 prep_ref 同款 bbox_fit；底色取 raw 左上角，保持与生成背景一致）
    im = Image.open(raw).convert("RGB")
    bg = im.getpixel((4, 4))
    canvas, _ = bbox_fit(im, bg, 45, bg)
    canvas.save(os.path.join(REFDIR, f"{cid}_480.png"))
    upload(f"wanv3_{cid}_ref.png", os.path.join(REFDIR, f"{cid}_480.png"))
    log(f"refgen {cid}: uploaded wanv3_{cid}_ref.png (fighting stance ref)")


def anim_plan(cid, anim):
    """返回 (dense 关键点列表, 驱动长度 L, pick 列表（L 内索引）)"""
    d = load_poses(cid)["anims"][anim]
    seq = [fr["keypoints"] for fr in d["dense"]["frames"]]
    pick = list(d["dense"]["pick"])
    n = len(seq)
    L = n if n % 8 == 1 else n + (1 - n % 8) % 8
    if L != n:
        seq = resample_dense(seq, L)
        pick = [min(L - 1, max(0, round(p * (L - 1) / (n - 1)))) for p in pick]
        # 严格单调（重采样后去重）
        dedup = []
        for p in pick:
            if not dedup or p > dedup[-1]:
                dedup.append(p)
        pick = dedup
    return seq, L, pick

# ---------- prep ----------
def prep_ref(cid):
    refdir = os.path.join(WORK, "ref")
    os.makedirs(refdir, exist_ok=True)
    local = os.path.join(refdir, f"{cid}_480.png")
    name = f"wanv3_{cid}_ref.png"
    if os.path.exists(local):
        return
    port = Image.open(os.path.join(REV, f"{cid}-portrait.png")).convert("RGB")
    corners = [port.getpixel(p) for p in ((5, 5), (1018, 5), (5, 1018), (1018, 1018))]
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    ref, _ = bbox_fit(port, bg=bg, thresh=45, canvas_bg=bg)
    ref.save(local)
    upload(name, local)
    log(f"prep {cid}: 参考立绘 → {name} (bg={bg})")

def prep_anim(cid, anim):
    safe = anim.replace(".", "_")
    d = os.path.join(WORK, cid, safe)
    fitf = os.path.join(d, "fit.json")
    if os.path.exists(fitf):
        return len(json.load(open(fitf)))
    os.makedirs(os.path.join(d, "pose"), exist_ok=True)
    seq, L, pick = anim_plan(cid, anim)
    fits, files = [], []
    for i, kp in enumerate(seq):
        canvas, fit = bbox_fit(render_skeleton(kp))
        fn = os.path.join(d, "pose", f"frame_{i:04d}.png")
        canvas.save(fn)
        fits.append(fit)
        files.append(fn)
    json.dump({"L": L, "pick": pick, "fits": fits}, open(fitf, "w"))
    for i, fn in enumerate(files):
        upload(f"wanv3_{cid}_{safe}_pose_{i:04d}.png", fn)
    log(f"prep {cid}/{anim}: dense {len(seq)}→L={L}, pick={len(pick)}, 已上传")
    return L

def prep(cid):
    prep_ref(cid)
    poses = load_poses(cid)
    for a in sorted(poses["anims"].keys()):
        prep_anim(cid, a)
    log(f"prep {cid}: 全部 {len(poses['anims'])} 动画驱动序列就绪")

# ---------- 视频工作流（节点布局：试点同款参数，干净 ID） ----------
def wan_wf(cid, safe, L, anim):
    ref_name = f"wanv3_{cid}_ref.png"
    wf = {
      "1": {"class_type": "UNETLoader", "inputs": {"unet_name": WAN_UNET, "weight_dtype": "default"}},
      "2": {"class_type": "WanAnimate2Cache", "inputs": {"model": ["1", 0], "device": "cpu", "dtype": "default"}},
      "3": {"class_type": "CLIPLoader", "inputs": {"clip_name": WAN_TEXT, "type": "wan"}},
      "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["3", 0], "text": POS_BASE}},
      "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["3", 0], "text": NEG_BASE}},
      "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["3", 0],
           "text": f"side view, the character performs {POSE_PROMPTS.get(anim, 'a dynamic attack motion')}, full body visible on a plain background"}},
      "7": {"class_type": "CLIPVisionLoader", "inputs": {"clip_name": WAN_CLIPV}},
      "12": {"class_type": "VAELoader", "inputs": {"vae_name": WAN_VAE}},
      "20": {"class_type": "LoadImage", "inputs": {"image": ref_name}},
      "21": {"class_type": "CLIPVisionEncode", "inputs": {"clip_vision": ["7", 0], "image": ["20", 0], "crop": "center"}},
      "22": {"class_type": "LoadImage", "inputs": {"image": f"wanv3_{cid}_{safe}_pose_0000.png"}},
      "23": {"class_type": "CLIPVisionEncode", "inputs": {"clip_vision": ["7", 0], "image": ["22", 0], "crop": "center"}},
    }
    # 49..L 个 pose LoadImage：节点 100+i (i=0..L-1)
    for i in range(L):
        wf[str(100 + i)] = {"class_type": "LoadImage",
                            "inputs": {"image": f"wanv3_{cid}_{safe}_pose_{i:04d}.png"}}
    # ImageBatch 链：节点 300..(300+L-2)
    prev = "100"
    for i in range(1, L):
        bid = str(300 + i - 1)
        wf[bid] = {"class_type": "ImageBatch", "inputs": {"image1": [prev, 0], "image2": [str(100 + i), 0]}}
        prev = bid
    last_batch = str(300 + L - 2)
    wf["400"] = {"class_type": "WanAnimate2ToVideo", "inputs": {
        "positive": ["4", 0], "negative": ["5", 0], "vae": ["12", 0],
        "width": W, "height": H, "length": L, "batch_size": 1,
        "video_frame_offset": 0, "pose_strength": 1.0,
        "pose_start_percent": 0.0, "pose_end_percent": 1.0,
        "reference_image_strength": 1.0,
        "reference_image": ["20", 0], "pose_video": [last_batch, 0],
        "clip_vision_output": ["21", 0], "positive_pose": ["6", 0],
        "clip_vision_output_pose": ["23", 0]}}
    wf["401"] = {"class_type": "KSampler", "inputs": {"model": ["2", 0], "seed": 0, "steps": 30, "cfg": 5.0,
        "sampler_name": "euler", "scheduler": "beta", "positive": ["400", 0], "negative": ["400", 1],
        "latent_image": ["400", 2], "denoise": 1.0}}
    wf["402"] = {"class_type": "VAEDecode", "inputs": {"samples": ["401", 0], "vae": ["12", 0]}}
    wf["403"] = {"class_type": "SaveImage", "inputs": {"images": ["402", 0],
        "filename_prefix": f"wanv3v_{cid}_{safe}"}}
    return wf

# ---------- 抠图 ----------
def cutout_batch(cid, safe, tmp, idxs, prefix):
    """批量 BiRefnet 抠图：idxs 是 tmp 里的帧号，返回 {idx: 本地 RGBA 路径}"""
    wf = {"500": {"class_type": "LoadBackgroundRemovalModel", "inputs": {"bg_removal_name": "birefnet.safetensors"}}}
    prev = None
    for j, i in enumerate(idxs):
        nid = str(501 + j)
        wf[nid] = {"class_type": "LoadImage", "inputs": {"image": f"wanv3c_{cid}_{safe}_{i:04d}.png"}}
        if prev is None:
            prev = nid
        else:
            bid = str(600 + j - 1)
            wf[bid] = {"class_type": "ImageBatch", "inputs": {"image1": [prev, 0], "image2": [nid, 0]}}
            prev = bid
    wf["700"] = {"class_type": "RemoveBackground", "inputs": {"bg_removal_model": ["500", 0], "image": [prev, 0]}}
    wf["701"] = {"class_type": "SaveImage", "inputs": {"images": ["700", 0], "filename_prefix": prefix}}
    pid = queue_prompt(wf)
    out = wait_done(pid, timeout=900)
    saved = _save_imgs(out["701"])
    res = {}
    for j, i in enumerate(idxs):
        local = os.path.join(tmp, f"cut_{i:04d}.png")
        view_image(saved[j], local)
        res[i] = local
    return res

def upload_video_frames(cid, safe, tmp, idxs):
    for i in idxs:
        upload(f"wanv3c_{cid}_{safe}_{i:04d}.png", os.path.join(tmp, f"{i:04d}.png"))

def inverse_affine(rgba, fit):
    """480×832 RGBA → 1024×1024 RGBA（逆向 prep 的逐帧仿射，回到骨架原始坐标）。
    正向：canvas = p*s + off, off = (cx - x0*s, cy - y0*s)
    采样函数（输出像素 p 读输入位置）：c = s*p + off"""
    s, x0, y0, cx, cy = fit["s"], fit["x0"], fit["y0"], fit["cx"], fit["cy"]
    A, B, C = s, 0.0, cx - x0 * s
    D, E, F = 0.0, s, cy - y0 * s
    return rgba.transform((1024, 1024), Image.AFFINE, (A, B, C, D, E, F))

# ---------- gen ----------
def gen_anim(cid, anim, attempt=0):
    safe = anim.replace(".", "_")
    outdir = os.path.join(FRAMES, cid)
    d = os.path.join(WORK, cid, safe)
    fitf = os.path.join(d, "fit.json")
    if not os.path.exists(fitf):
        raise RuntimeError("fit.json 缺失，先 prep")
    meta = json.load(open(fitf))
    L, pick, fits = meta["L"], meta["pick"], meta["fits"]
    n_final = len(pick)
    mp4 = os.path.join(ANIMATE, cid, f"{safe}.mp4")
    os.makedirs(outdir, exist_ok=True)
    have = sorted([f for f in os.listdir(outdir) if f.startswith(safe + "_") and f.endswith(".png")])
    if len(have) >= n_final:
        return True
    tmp = os.path.join(d, "tmp")
    os.makedirs(tmp, exist_ok=True)
    wf = wan_wf(cid, safe, L, anim)
    wf["401"]["inputs"]["seed"] = seed_for(cid, anim, attempt)
    t0 = time.time()
    pid = queue_prompt(wf)
    out = wait_done(pid, timeout=3000)
    imgs = _save_imgs(out["403"])
    for i, im in enumerate(imgs):
        view_image(im, os.path.join(tmp, f"{i:04d}.png"))
    # mp4 归档（不进仓库）
    os.makedirs(os.path.join(ANIMATE, cid), exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "16",
                    "-i", os.path.join(tmp, "%04d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", mp4], check=True)
    # 取 pick 帧 → 上传 → 批量抠图
    upload_video_frames(cid, safe, tmp, pick)
    cuts = cutout_batch(cid, safe, tmp, pick, f"wanv3c_{cid}_{safe}")
    for k, i in enumerate(pick):
        rgba = Image.open(cuts[i]).convert("RGBA")
        if rgba.size != (W, H):
            rgba = rgba.resize((W, H), Image.Resampling.LANCZOS)
        out1024 = inverse_affine(rgba, fits[i])
        out1024.save(os.path.join(outdir, f"{safe}_{k:02d}.png"))
    # 清理上传的视频帧（驱动帧保留，供重试）
    for i in pick:
        p = os.path.join(INPUT_DIR, f"wanv3c_{cid}_{safe}_{i:04d}.png")
        if os.path.exists(p):
            os.remove(p)
    shutil.rmtree(tmp, ignore_errors=True)
    log(f"gen {cid}/{anim}: {n_final} 帧完成，{time.time() - t0:.0f}s (att{attempt})")
    return True

def gen(cid):
    poses = load_poses(cid)
    anims = sorted(poses["anims"].keys())
    failfile = os.path.join(CK, f"v3-fail-{cid}.txt")
    order = anims
    if os.path.exists(failfile):
        prev_fails = [a.strip() for a in open(failfile) if a.strip()]
        order = [a for a in prev_fails if a in anims] + [a for a in anims if a not in prev_fails]
    fails = []
    for a in order:
        ok = False
        for att in range(3):
            try:
                ok = gen_anim(cid, a, att)
                break
            except Exception as e:
                log(f"gen {cid}/{a} att{att} 失败: {e}")
        if not ok:
            fails.append(a)
    with open(failfile, "w") as f:
        f.write("\n".join(fails))
    log(f"gen {cid}: 完成 {len(order) - len(fails)}/{len(order)}，失败 {fails}")
    return fails

# ---------- contact ----------
def contact(cid):
    poses = load_poses(cid)
    anims = sorted(poses["anims"].keys())
    outdir = os.path.join(FRAMES, cid)
    cell = 96
    per_row = 8
    rows = []
    for a in anims:
        safe = a.replace(".", "_")
        fs = sorted([f for f in os.listdir(outdir) if f.startswith(safe + "_")]) if os.path.isdir(outdir) else []
        for i in range(0, len(fs), per_row):
            rows.append(fs[i:i + per_row])
    sheet = Image.new("RGB", (per_row * cell, len(rows) * cell), (35, 35, 35))
    for r, group in enumerate(rows):
        for c, fn in enumerate(group):
            im = Image.open(os.path.join(outdir, fn)).convert("RGB")
            im = im.resize((cell, cell))
            sheet.paste(im, (c * cell, r * cell))
    sheet.save(os.path.join(REV, f"v3-{cid}.jpg"), quality=82)
    log(f"contact {cid}: 联系表 {len(rows)} 行")

# ---------- finish ----------
def finish(cid):
    poses = load_poses(cid)
    outdir = os.path.join(FRAMES, cid)
    missing = []
    for a, v in poses["anims"].items():
        safe = a.replace(".", "_")
        have = [f for f in (os.listdir(outdir) if os.path.isdir(outdir) else []) if f.startswith(safe + "_")]
        if len(have) < len(v["frames"]):
            missing.append((a, len(have), len(v["frames"])))
    if missing:
        log(f"finish {cid}: 缺帧 {len(missing)} 动画，如 {missing[:5]}")
        return False
    log(f"finish {cid}: 46 动画齐帧，跑 frame-qc（K/G/P，目标骨架 poses-v3）")
    r = subprocess.run([sys.executable, "scripts/art/frame-qc.py", "--chars", cid,
                        "--src", "art-work/frames-v3", "--poses", "poses-v3"],
                       cwd=ROOT, capture_output=True, text=True, timeout=5400)
    with open(os.path.join(CK, f"v3-qc-{cid}.log"), "w") as f:
        f.write(r.stdout + "\n--- stderr ---\n" + r.stderr)
    qtail = (r.stdout.strip().splitlines() or [""])[-1]
    log(f"finish {cid}: frame-qc rc={r.returncode} | {qtail[:200]}")
    r2 = subprocess.run([sys.executable, "scripts/art/pack-atlas.py",
                         f"art-work/poses-v3/{cid}.json", f"art-work/frames-v3/{cid}", "--v3"],
                        cwd=ROOT, capture_output=True, text=True, timeout=1800)
    log(f"finish {cid}: pack rc={r2.returncode} | {(r2.stdout.strip().splitlines() or [r2.stderr.strip()[-200:]])[-1]}")
    contact(cid)
    ok = r.returncode == 0 and r2.returncode == 0
    log(f"finish {cid}: {'✅ 全绿' if ok else '❌ 有红灯'}")
    return ok

# ---------- run（8 角色顺序 + 心跳守护） ----------
def _inbox_record(cid, h, nfr, mins, qtail):
    """INBOX 01:30 条目末尾（下一个 ## 标题前）追加一行完成记录，单独提交"""
    import datetime
    ip = os.path.join(ROOT, "INBOX.md")
    lines = open(ip, encoding="utf-8").read().splitlines(keepends=True)
    start = next((i for i, l in enumerate(lines) if "2026-11-04 01:30" in l), None)
    if start is None:
        log("run: INBOX 未找到 01:30 条目，跳过记录")
        return
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## ")), len(lines))
    rec = (f"  - ✅ {cid} 完成 {datetime.datetime.now().strftime('%H:%M')}: commit {h}, "
           f"{nfr} 帧, {mins:.0f} 分钟, {qtail}\n")
    lines.insert(end, rec)
    open(ip, "w", encoding="utf-8").write("".join(lines))
    subprocess.run(["git", "add", "INBOX.md"], cwd=ROOT, capture_output=True)
    subprocess.run(["git", "commit", "-m", f"INBOX: v3 {cid} 完成 {h}"], cwd=ROOT, capture_output=True)


def run():
    import signal as _sig
    os.makedirs(CK, exist_ok=True)
    hb = os.path.join(CK, "heartbeat")
    p = subprocess.Popen(f"while :; do touch {hb}; sleep 300; done", shell=True,
                         start_new_session=True)
    log(f"run: 心跳守护 pid={p.pid}（独立进程组，killpg 清理）")
    done, failed = [], []
    try:
        for cid in ORDER:
            t_cid = time.time()
            log(f"===== {cid} 开始 =====")
            try:
                # 01:30 规范：每个人开工前先查 INBOX（拉取对方新指示/修改要求）
                subprocess.run(["git", "pull", "--rebase", "--autostash"], cwd=ROOT,
                               capture_output=True)
                try:
                    refgen(cid)
                except Exception as e:
                    log(f"run: {cid} refgen 失败（{str(e)[:120]}），降级站立立绘参考")
                prep(cid)
                fails = gen(cid)
                if fails:
                    failed.append((cid, fails))
                    log(f"run: {cid} 有 {len(fails)} 动画失败，跳过 finish，继续下一人")
                    continue
                if finish(cid):
                    subprocess.run(["git", "pull", "--rebase", "--autostash"], cwd=ROOT,
                                   capture_output=True)
                    subprocess.run(["git", "add", f"public/assets/meilong/{cid}/",
                                    "public/assets/manifest.json", f"docs/art-review/v3-{cid}.jpg"],
                                   cwd=ROOT)
                    subprocess.run(["git", "commit", "-m",
                                    f"v3 {cid}: 46 动画全量帧（Wan2.2-Animate 驱动 + BiRefnet 抠图 + 逆仿射回 1024）"],
                                   cwd=ROOT, capture_output=True)
                    h = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT,
                                       capture_output=True, text=True).stdout.strip()
                    nfr = len([f for f in os.listdir(os.path.join(FRAMES, cid)) if f.endswith(".png")])
                    qf = os.path.join(CK, f"v3-qc-{cid}.log")
                    qtail = ""
                    if os.path.exists(qf):
                        qtail = (open(qf).read().strip().splitlines() or [""])[-1][:120]
                    try:
                        _inbox_record(cid, h, nfr, (time.time() - t_cid) / 60, qtail)
                    except Exception as e:
                        log(f"run: {cid} INBOX 记录失败: {e}")
                    done.append(cid)
                    log(f"run: {cid} 已提交 {h}")
                else:
                    failed.append((cid, ["finish 红灯"]))
            except Exception as e:
                log(f"run: {cid} 异常: {e}")
                failed.append((cid, [str(e)[:100]]))
    finally:
        for _s in (_sig.SIGTERM, _sig.SIGKILL):
            try:
                os.killpg(p.pid, _s)
            except Exception:
                break
            if _s == _sig.SIGTERM:
                time.sleep(2)
        # 验证心跳停止前进（35s 间隔两次采样）
        try:
            m1 = os.path.getmtime(hb)
            time.sleep(35)
            m2 = os.path.getmtime(hb)
            log(f"run: 心跳停跳检查 {'OK' if abs(m2 - m1) < 1 else '仍在前进，需人工检查!'}")
        except Exception:
            pass
    log(f"run: 结束。完成 {done}，失败 {failed}")

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    cid = sys.argv[2] if len(sys.argv) > 2 else None
    if cmd == "prep" and cid:
        prep(cid)
    elif cmd == "refgen" and cid:
        refgen(cid)
    elif cmd == "gen" and cid:
        gen(cid)
    elif cmd == "contact" and cid:
        contact(cid)
    elif cmd == "finish" and cid:
        finish(cid)
    elif cmd == "run":
        run()
    else:
        print(__doc__)
        sys.exit(2)

if __name__ == "__main__":
    main()
