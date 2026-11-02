#!/usr/bin/env python3
# A3 音乐质量升级（INBOX 20:25）：MiniMax Music 3 生成 6 首场景 BGM + 标题曲，替换合成占位音。
# 走本机 ComfyUI(:8188) 原生 MiniMax Music 3 节点（blueprints/Text to Music 同款工作流）：
#   UNETLoader(dit fp16) + CLIPLoader(minimax) + VAELoader(dav)
#   → MiniMaxMusic3TextEncode(caption, 纯器乐) + ConditioningZeroOut(负向)
#   → EmptyMiniMaxMusic3LatentAudio(秒数由 encode 实际输出决定)
#   → KSampler(30 steps, euler, simple, cfg 1.7) → VAEDecodeAudioTiled → SaveAudio
# 后处理：QC（时长≥45s / RMS≥-30dB / 无整段静音）→ ffmpeg 转 ogg(96k) 覆盖
#   public/assets/meilong/audio/<name>.ogg（文件名不变，stages.js/theme 零改动）。
# 断点：art-work/music/<name>_done 存在则跳过；SEED_SALT=1 换种子簇重试。
# 用法：python3 scripts/art/gen_music.py [title s01 ...]
import json
import math
import os
import shutil
import struct
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "art-work/music"
OUT = ROOT / "public/assets/meilong/audio"
API = "http://localhost:8188"
SALT = int(os.environ.get("SEED_SALT", "0"))
POLL_TIMEOUT = int(os.environ.get("MUSIC_TIMEOUT", "1800"))

# 纯器乐、无 vocals；氛围贴场景（TASK.md R2 六场景 + 标题曲要有气势）。
TRACKS = {
    "title": {
        "caption": ("Epic fighting game title theme, 90s arcade style, heroic and powerful, "
                    "driving rhythm, electric guitar riffs, punchy drums, synth brass stabs, "
                    "anthemic, energetic, minor key, instrumental, no vocals, no singing"),
        "dur": 120, "seed": 100001,
    },
    "s01": {
        "caption": ("Dark industrial battle music, abandoned mine atmosphere, oppressive and tense, "
                    "slow heavy drums, low cello drones, metallic percussion, distant rumbling, "
                    "eerie, minor key, instrumental, no vocals, no singing"),
        "dur": 90, "seed": 100002,
    },
    "s02": {
        "caption": ("Lively night market music, festive and warm, playful melody, hand percussion, "
                    "bamboo flute, plucked strings, energetic groove, cheerful, Chinese night "
                    "bazaar vibe, instrumental, no vocals, no singing"),
        "dur": 90, "seed": 100003,
    },
    "s03": {
        "caption": ("Calm mysterious night music, quiet lake under moonlight, gentle ambient pads, "
                    "sparse soft melody, soft water lapping sounds, sparse piano, slow, serene, "
                    "minor key, instrumental, no vocals, no singing"),
        "dur": 90, "seed": 100004,
    },
    "s04": {
        "caption": ("Intense industrial battle music, blast furnace heat, aggressive driving beat, "
                    "distorted bass, hammer anvil percussion, fiery energy, fast tempo, "
                    "dangerous atmosphere, instrumental, no vocals, no singing"),
        "dur": 90, "seed": 100005,
    },
    "s05": {
        "caption": ("Quiet nostalgic night town music, starry sky, gentle acoustic guitar, "
                    "soft melodic lead, warm and peaceful, slow waltz feel, small mining "
                    "village, instrumental, no vocals, no singing"),
        "dur": 90, "seed": 100006,
    },
    "s06": {
        "caption": ("Aggressive underground arena battle music, tense confrontation, pounding war "
                    "drums, heavy bass, dark synths, clanging metal, fast tempo, intense duel "
                    "atmosphere, instrumental, no vocals, no singing"),
        "dur": 90, "seed": 100007,
    },
}


def http_json(path, data=None):
    req = urllib.request.Request(API + path,
                                 data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def http_get(path, dest):
    with urllib.request.urlopen(API + path, timeout=120) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)


def workflow(name, tr):
    seed = tr["seed"] + SALT * 1000000
    return {
        "1": {"class_type": "UNETLoader", "inputs": {
            "unet_name": "minimax_music3_dit_fp16.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {
            "clip_name": "minimax_music3_text_encoder_pruned_int8_convrot.safetensors",
            "type": "minimax"}},
        "3": {"class_type": "VAELoader", "inputs": {
            "vae_name": "minimax_music3_dav.safetensors"}},
        "4": {"class_type": "MiniMaxMusic3TextEncode", "inputs": {
            "clip": ["2", 0], "caption": tr["caption"], "lyrics": "",
            "seed": seed, "max_duration": tr["dur"], "cfg_scale": 1.7, "top_k": 50}},
        "5": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["4", 0]}},
        "6": {"class_type": "EmptyMiniMaxMusic3LatentAudio",
              "inputs": {"seconds": ["4", 1], "batch_size": 1}},
        "7": {"class_type": "KSampler", "inputs": {
            "model": ["1", 0], "positive": ["4", 0], "negative": ["5", 0],
            "latent_image": ["6", 0], "seed": seed, "steps": 30, "cfg": 1.7,
            "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAEDecodeAudioTiled", "inputs": {
            "samples": ["7", 0], "vae": ["3", 0], "tile_size": 1536, "overlap": 64}},
        "9": {"class_type": "SaveAudio", "inputs": {
            "audio": ["8", 0], "filename_prefix": f"fighter2/{name}"}},
    }


def ffprobe_duration(path):
    out = subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    return float(out.stdout.strip())


def rms_db(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path),
                          "-af", "volumedetect", "-f", "null", "-"],
                         capture_output=True, text=True)
    for line in out.stderr.splitlines():
        if "mean_volume" in line:
            return float(line.split(":")[1].strip().split(" dB")[0])
    return None


def check_silence(path, max_silent_s=6.0):
    """扫 PCM：最长连续 |samp|<1/1000 的时长。用 ffmpeg 解码成 raw s16。"""
    raw = WORK / "_probe.raw"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(path),
                    "-f", "s16le", "-ac", "1", "-ar", "22050", str(raw)], check=True)
    data = raw.read_bytes()
    raw.unlink(missing_ok=True)
    n = len(data) // 2
    if n == 0:
        return 0.0
    samples = struct.unpack(f"<{n}h", data[: n * 2])
    worst = cur = 0
    for s in samples:
        cur = cur + 1 if abs(s) < 1000 else 0
        worst = max(worst, cur)
    return worst / 22050.0


def pad_to_60s(wav, target=60.0, fade=1.5):
    """把 18–60s 的自然曲目交叉淡化循环延长到恰好 target 秒（BGM 循环文件）。
    返回新 wav 路径。首尾各 fade 秒淡入淡出，保证游戏 loop 接缝平滑。"""
    D = ffprobe_duration(wav)
    if D >= target - 0.05:
        return wav
    xfade = 2.0
    N = 2
    while N * D - (N - 1) * xfade < target + 1e-6:
        N += 1
    inputs = []
    for _ in range(N):
        inputs += ["-i", str(wav)]
    fc = []
    prev = "[0:a]"
    for i in range(1, N):
        out = f"[x{i}]"
        fc.append(f"{prev}[{i}:a]acrossfade=d={xfade}:c1=tri:c2=tri{out}")
        prev = out
    fc.append(f"{prev}atrim=0:{target},asetpts=PTS-STARTPTS,"
              f"afade=t=in:d={fade},afade=t=out:st={target - fade}:d={fade}[o]")
    out_wav = wav.with_name(f"{wav.stem}_pad.wav")
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *inputs,
           "-filter_complex", ";".join(fc), "-map", "[o]", "-ar", "44100", str(out_wav)]
    subprocess.run(cmd, check=True)
    return out_wav


def to_ogg(wav, ogg):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav),
                    "-c:a", "libvorbis", "-b:a", "96k", str(ogg)], check=True)


def main():
    names = sys.argv[1:] or list(TRACKS)
    WORK.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    ok, fail = [], []
    for name in names:
        pad_only = False
        if name.startswith("pad:"):
            pad_only, name = True, name[4:]
        tr = TRACKS[name]
        done = WORK / f"{name}_done"
        if done.exists():
            print(f"[skip] {name} 已完成（{done.name} 存在）")
            continue
        t0 = time.time()
        padded = False
        if not pad_only:
            print(f"[gen] {name} seed={tr['seed'] + SALT * 1000000} max_duration={tr['dur']}s", flush=True)
            res = http_json("/prompt", {"prompt": workflow(name, tr)})
            pid = res["prompt_id"]
            hist = None
            while time.time() - t0 < POLL_TIMEOUT:
                try:
                    h = http_json(f"/history/{pid}")
                except Exception:
                    h = {}
                if pid in h:
                    hist = h[pid]
                    break
                time.sleep(5)
            if hist is None:
                print(f"[fail] {name} 超时 {POLL_TIMEOUT}s", flush=True)
                fail.append(name)
                continue
            if "status" in hist and hist["status"].get("status_str") != "success":
                msgs = hist.get("status", {}).get("messages", [])
                print(f"[fail] {name} ComfyUI 报错: {json.dumps(msgs, ensure_ascii=False)[:500]}", flush=True)
                fail.append(name)
                continue
            # 找 SaveAudio 输出
            audio_file = None
            for node_out in hist["outputs"].values():
                if "audio" in node_out and isinstance(node_out["audio"], list):
                    audio_file = node_out["audio"][0]
                    break
            if audio_file is None:
                print(f"[fail] {name} 未找到音频输出: {json.dumps(hist['outputs'], ensure_ascii=False)[:300]}", flush=True)
                fail.append(name)
                continue
            url = "/view?" + urllib.parse.urlencode(audio_file)
            wav = WORK / f"{name}.wav"
            http_get(url, wav)
        else:
            wav = WORK / f"{name}.wav"
            if not wav.exists():
                print(f"[fail] pad:{name} 找不到 {wav}", flush=True)
                fail.append(name)
                continue
            print(f"[pad] {name} 直接延长已有 wav", flush=True)
        dur = ffprobe_duration(wav)
        if dur < 18:
            print(f"[fail] {name} 时长过短 {dur:.1f}s < 18s，无法延长", flush=True)
            fail.append(name)
            continue
        if dur < 60 - 0.05:
            print(f"[pad] {name} {dur:.1f}s < 60s，交叉淡化循环延长到 60s", flush=True)
            wav = pad_to_60s(wav)
            dur = ffprobe_duration(wav)
            padded = True
        rms = rms_db(wav)
        silent = check_silence(wav)
        print(f"[qc] {name} 时长={dur:.1f}s rms={rms}dB 最长静音={silent:.1f}s "
              f"大小={wav.stat().st_size // 1024}KB padded={padded}", flush=True)
        if dur < 45 or dur > 121:
            print(f"[fail] {name} 时长异常 {dur:.1f}s", flush=True)
            fail.append(name)
            continue
        if rms is None or rms < -30:
            print(f"[fail] {name} RMS 过低 {rms}dB（疑似静音/糊声）", flush=True)
            fail.append(name)
            continue
        if silent > max(6.0, dur * 0.15):
            print(f"[fail] {name} 存在 {silent:.1f}s 长静音段", flush=True)
            fail.append(name)
            continue
        ogg = OUT / f"{name}.ogg"
        to_ogg(wav, ogg)
        size = ogg.stat().st_size
        print(f"[ok] {name} → {ogg.relative_to(ROOT)} ({size // 1024}KB) 用时 {time.time() - t0:.0f}s", flush=True)
        done.write_text(json.dumps({"seed": tr["seed"] + SALT * 1000000, "duration": dur,
                                    "rms_db": rms, "padded": padded, "wav": str(wav),
                                    "ogg_kb": size // 1024,
                                    "time": time.strftime("%Y-%m-%d %H:%M")}, ensure_ascii=False))
        ok.append(name)
    print(f"== 完成 {len(ok)} 失败 {len(fail)}: {ok} / {fail} ==")
    if fail:
        sys.exit(1)


if __name__ == "__main__":
    main()
