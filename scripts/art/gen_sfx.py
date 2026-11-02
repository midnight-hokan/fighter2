#!/usr/bin/env python3
# 真实音效生成（INBOX 2026-11-02 07:30 第 2 条）：AudioGen（facebook/audiogen-medium，1.5B LM 架构）
# 选型理由：本机无 SFX 模型；MiniMax Music 3 探测（max_duration=2.0 + 音效 caption）输出为
#   持续窄带音乐音（~1200Hz drone，非打击瞬态），不适合打击类 SFX → 用 AudioGen（SFX 专用模型）。
# 运行环境：~/sfx-env（venv，.pth 复用 comfy-env-h3 的 torch 2.14.1+cu130，不污染 ComfyUI 环境）。
# 流程：每个 SFX 生成 2.5s 片段（2 个种子）→ 瞬态 QC 择优 → 截最优窗口到目标时长
#   → 3ms 淡入淡出防爆音 → 峰值归一化 0.85 → ogg(libvorbis 96k) → public/assets/meilong/sfx/<key>.ogg
# 断点：art-work/sfx/<key>_done 存在则跳过；SEED_SALT=1 换种子簇重试。
# 用法：~/sfx-env/bin/python3 scripts/art/gen_sfx.py [key ...]
import json
import math
import os
import struct
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "art-work/sfx"
OUT = ROOT / "public/assets/meilong/sfx"
SALT = int(os.environ.get("SEED_SALT", "0"))
SR_OUT = 44100
GEN_SR = 32000  # AudioGen 输出采样率
GEN_DURATION = 2.5  # 候选片段时长

# key: (caption, 目标截取时长 s, 类别 impact|sustain)
# caption 用英文（AudioGen 训练语料英文为主），描述声音本身而非场景。
SFX = {
    "hit_light": (
        "light punch hit, crisp short impact, fast snap, small body hit, game sound effect", 0.35, "impact"),
    "hit_med": (
        "medium punch impact, solid thud with sharp crack, body hit, game sound effect", 0.40, "impact"),
    "hit_heavy": (
        "heavy powerful punch impact, deep heavy thud, big body slam, strong hit, game sound effect", 0.50, "impact"),
    "block": (
        "sharp metallic block, hard deflection clang, short metallic tap, guard impact, game sound effect", 0.30, "impact"),
    "throw": (
        "throwing whoosh followed by body impact, short whoosh then thud, game sound effect", 0.60, "impact"),
    "projectile": (
        "fast energy projectile whoosh, short rising zing, magical shot launch, game sound effect", 0.50, "impact"),
    "super": (
        "powerful super move activation, dramatic power burst with rising energy then big impact, "
        "arcade special move sound effect", 0.90, "sustain"),
    "max": (
        "intense power surge activation, surging energy build up with sharp burst, MAX mode start, "
        "game sound effect", 0.70, "sustain"),
    "stock": (
        "power gauge full, short energetic power-up chime, rising electronic arpeggio, game sound effect", 0.60, "sustain"),
    "ko": (
        "dramatic knockout impact, massive deep hit with heavy body falling, final blow, game sound effect", 1.00, "impact"),
    "round": (
        "fighting game round start, short sharp bell ding, clean single bell strike, game sound effect", 0.70, "sustain"),
    "roll": (
        "quick dash roll whoosh, very short swish movement sound, agile dodge, game sound effect", 0.30, "impact"),
    "gc": (
        "guard crush shatter, armor break crack with metallic ring, defense break impact, game sound effect", 0.45, "impact"),
    "knockdown": (
        "body knockdown, heavy impact with body hitting the ground, falling slam, game sound effect", 0.45, "impact"),
}


def ffprobe_duration(p):
    out = subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                          "-of", "csv=p=0", str(p)], capture_output=True, text=True)
    return float(out.stdout.strip())


def to_wav(path, samples, sr):
    import soundfile as sf
    Path(path).unlink(missing_ok=True)  # soundfile 0.14 对已存在 0 字节文件报 Format not recognised
    sf.write(str(path), samples, sr, format="WAV")


def to_ogg(wav, ogg):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav),
                    "-c:a", "libvorbis", "-b:a", "96k", str(ogg)], check=True)


def read_wav_mono(path, sr=22050):
    raw = WORK / "_probe.raw"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(path),
                    "-f", "s16le", "-ac", "1", "-ar", str(sr), str(raw)], check=True)
    data = raw.read_bytes()
    raw.unlink(missing_ok=True)
    n = len(data) // 2
    return list(struct.unpack(f"<{n}h", data[: n * 2]))


def analyze(samples, sr):
    """返回 (onset, score)。onset：第一个 RMS>0.3*peak 的 10ms 窗中心时刻(s)。
    score：瞬态清晰度 = peak窗RMS / 前300ms平均RMS（越高越像干净打击音）。"""
    W = int(0.01 * sr)
    n = len(samples)
    env = []
    for i in range(0, n - W, W):
        win = samples[i:i + W]
        rms = math.sqrt(sum(x * x for x in win) / len(win))
        env.append(rms)
    if not env or max(env) < 300:
        return None, 0.0
    peak = max(env)
    peak_i = env.index(peak)
    # onset
    onset_i = 0
    for i, r in enumerate(env):
        if r > 0.3 * peak:
            onset_i = i
            break
    pre = env[max(0, peak_i - 30):peak_i]  # 前 300ms
    pre_avg = (sum(pre) / len(pre)) if pre else 0.0
    score = peak / max(pre_avg, 1.0)
    onset = onset_i * W / sr
    return onset, score


def gen_all(keys, seeds=2):
    import torch
    from audiocraft.models import AudioGen
    print(f"加载 AudioGen（facebook/audiogen-medium，首次会下载 ~2.2GB）...", flush=True)
    model = AudioGen.get_pretrained("facebook/audiogen-medium", device="cuda")
    model.set_generation_params(use_sampling=True, top_k=250, temperature=1.0,
                                duration=GEN_DURATION, cfg_coef=3.0)
    ok, fail = [], []
    for key in keys:
        done = WORK / f"{key}_done"
        if done.exists():
            print(f"[skip] {key} 已完成", flush=True)
            ok.append(key)
            continue
        caption, target, kind = SFX[key]
        best = None  # (score, onset, path, seed)
        for s in range(seeds):
            seed = 1000 + SALT * 100000 + hash(key) % 997 + s * 7919
            t0 = time.time()
            torch.manual_seed(seed)
            torch.cuda.manual_seed_all(seed)
            waveforms = model.generate([caption], progress=False)
            # waveforms: [B, C, T] → waveforms[0] 是 (C, T)；soundfile 要求 (frames, channels)，
            # 直接传 (1, T) 会被当成 T 个声道 → libsndfile "Format not recognised"
            arr = waveforms[0].cpu().numpy().astype("float32")
            if arr.ndim == 2 and arr.shape[0] <= 8:
                arr = arr[0]
            wav = WORK / f"{key}_s{s}.wav"
            to_wav(wav, arr, GEN_SR)
            mono = read_wav_mono(wav, sr=16000)
            onset, score = analyze(mono, 16000)
            print(f"[gen] {key} seed={seed} onset={onset and round(onset, 3)} "
                  f"score={score:.1f} 用时 {time.time() - t0:.0f}s", flush=True)
            if onset is not None and (best is None or score > best[0]):
                best = (score, onset, wav, seed)
        if best is None:
            print(f"[fail] {key} 所有候选都无有效瞬态", flush=True)
            fail.append(key)
            continue
        score, onset, wav, seed = best
        cut = cut_window(wav, onset, target, kind)
        out_ogg = OUT / f"{key}.ogg"
        to_ogg(cut, out_ogg)
        sz = out_ogg.stat().st_size
        dur = ffprobe_duration(out_ogg)
        if dur < target * 0.6 or sz > 600 * 1024:
            print(f"[fail] {key} 截取异常 dur={dur:.2f}s size={sz//1024}KB", flush=True)
            fail.append(key)
            continue
        done.write_text(json.dumps({"seed": seed, "score": round(score, 1), "onset": round(onset, 3),
                                    "target": target, "dur": round(dur, 3), "ogg_kb": sz // 1024,
                                    "time": time.strftime("%Y-%m-%d %H:%M")}, ensure_ascii=False))
        print(f"[ok] {key} → {out_ogg.relative_to(ROOT)} ({sz//1024}KB, {dur:.2f}s)", flush=True)
        ok.append(key)
    print(f"== 完成 {len(ok)} 失败 {len(fail)}: {ok} / {fail} ==")
    if fail:
        sys.exit(1)


def cut_window(src_wav, onset, target, kind):
    """从 src_wav 截取 [onset-lead, onset-lead+target]，3ms 淡入淡出，峰值归一化 0.85。"""
    lead = 0.02 if kind == "impact" else 0.05
    start = max(0.0, onset - lead)
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src_wav),
           "-af", f"atrim=start={start:.3f}:duration={target:.3f},asetpts=PTS-STARTPTS,"
                  f"afade=t=in:d=0.003,afade=t=out:st={max(0.0, target-0.003):.3f}:d=0.003,"
                  f"loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
           "-ar", str(SR_OUT), str(src_wav.with_name(src_wav.stem + "_cut.wav"))]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[-500:])
    return src_wav.with_name(src_wav.stem + "_cut.wav")


if __name__ == "__main__":
    keys = sys.argv[1:] or list(SFX)
    WORK.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    gen_all(keys)
