#!/usr/bin/env python3
# A3 音乐修复（INBOX 2026-11-02 16:05）：
#   1) s04 两段 ~2.7s 静音（14.8–17.5s、39.2–41.9s）——根因是原始 s04.wav 中段自带静音，
#      循环补齐时被拼进成片。修法：裁掉首尾静音 + 移除中段静音（两侧短交叉淡化拼接）。
#   2) 响度差 8.6dB（s02 -12.6 / s05 -21.2 LUFS）——7 首统一两遍 loudnorm 到 -16 LUFS，
#      峰值 ≤ -1dBTP（线性缩放会顶到峰值时自动退回动态模式）。
#   3) 自检：7 首 silencedetect=n=-45dB:d=1 查不到静音；ebur128 集成响度 -15 ~ -17 LUFS。
# 输入：art-work/music/<name>.wav（MiniMax Music 3 原始输出，保留不动）。
# 输出：public/assets/meilong/audio/<name>.ogg（文件名不变，stages.js/theme 零改动）。
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "art-work/music"
OUT = ROOT / "public/assets/meilong/audio"
NAMES = ["s01", "s02", "s03", "s04", "s05", "s06", "title"]
TARGET = 60.0


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"cmd failed: {' '.join(cmd[:6])}... {r.stderr[-400:]}")
    return r


def duration(p):
    out = run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
               "-of", "csv=p=0", str(p)]).stdout.strip()
    return float(out)


def silences(p, noise="-45dB", d=1.0):
    """返回 [(start, end, dur)]，按 silencedetect 输出。"""
    r = run(["ffmpeg", "-hide_banner", "-i", str(p),
             "-af", f"silencedetect=n={noise}:d={d}", "-f", "null", "-"])
    starts, ends = [], []
    for line in r.stderr.splitlines():
        m = re.search(r"silence_start:\s*([\d.]+)", line)
        if m:
            starts.append(float(m.group(1)))
        m = re.search(r"silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)", line)
        if m:
            ends.append((float(m.group(1)), float(m.group(2))))
    return list(zip(starts, [e for e, _ in ends], [d for _, d in ends]))


def ebur128(p):
    r = run(["ffmpeg", "-hide_banner", "-i", str(p), "-af", "ebur128", "-f", "null", "-"])
    txt = r.stderr
    # 取最后一个匹配：输入 wav 携带的 ComfyUI prompt 元数据里可能有干扰串
    ms = re.findall(r"I:\s+(-?[\d.]+)\s*LUFS", txt)
    i = float(ms[-1]) if ms else None
    m = re.search(r"Peak:\s+(-?[\d.]+)\s*dBFS", txt)
    tp = float(m.group(1)) if m else None
    return i, tp


def measure_loudnorm(p):
    r = run(["ffmpeg", "-hide_banner", "-i", str(p),
             "-af", "loudnorm=I=-16:TP=-1:LRA=11:print_format=json",
             "-f", "null", "-"])
    # 锚定 "input_i" 定位 loudnorm JSON 块（输入元数据 prompt 里也有大段 JSON，
    # 贪婪 \{.*\} 会把它吞进来导致解析失败）
    m = re.search(r'\{\s*"input_i".*?\}', r.stderr, re.S)
    if m is None:
        raise RuntimeError("loudnorm 测量输出里没有 JSON: " + r.stderr[-200:])
    j = json.loads(m.group(0))
    return {k: float(j["input_" + k]) for k in ("i", "tp", "lra", "thresh")}


def loudnorm2pass(src, dst, m):
    """两遍 loudnorm 到 I=-16 / TP=-1。线性缩放顶到峰值则退回动态模式。"""
    gain = -16.0 - m["i"]
    linear = (m["tp"] + gain) <= -1.05
    mode = "linear=true" if linear else "linear=false"
    a = (f"loudnorm=I=-16:TP=-1:LRA=11:measured_I={m['i']:.2f}:measured_TP={m['tp']:.2f}:"
         f"measured_LRA={m['lra']:.2f}:measured_thresh={m['thresh']:.2f}:{mode}")
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
         "-af", a, "-ar", "44100", str(dst)])
    return linear


def crossfade_join(parts, dst, d=0.6):
    """多段 wav 用 acrossfade 依次拼接（移除静音后两侧平滑过渡）。"""
    inputs = []
    for p in parts:
        inputs += ["-i", str(p)]
    fc, prev = [], "[0:a]"
    for i in range(1, len(parts)):
        out = f"[x{i}]"
        fc.append(f"{prev}[{i}:a]acrossfade=d={d}:c1=tri:c2=tri{out}")
        prev = out
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *inputs,
         "-filter_complex", ";".join(fc), "-map", prev, "-ar", "44100", str(dst)])
    return dst


def clean(name, src):
    """裁首尾静音 + 移除中段静音（≥1s）。返回处理后 wav。"""
    out = WORK / f"_fix_{name}_clean.wav"
    s = duration(src)
    sil = silences(src, d=1.0)
    head = None
    if sil and sil[0][0] < 0.05:
        head = sil[0][1]  # 首部静音 → 从其结束处起
    tail = None
    if sil and sil[-1][1] > s - 0.05:
        tail = sil[-1][0]  # 尾部静音 → 到其开始处止
    mids = [x for x in sil if (head is None or x[0] > head + 0.1) and (tail is None or x[1] < tail - 0.1)]
    a, b = (head or 0.0), (tail if tail is not None else duration(src))
    # 分段：[a, m0.start] + [m0.end, m1.start] + ...
    segs, cur = [], a
    for st, en, _ in mids:
        if en > st + 0.8:  # 只处理 ≥0.8s 的真静音，短间隙保留
            segs.append((cur, st))
            cur = en
    segs.append((cur, b))
    segs = [(x, y) for x, y in segs if y - x > 0.3]
    if len(segs) == 1 and segs[0][0] < 0.02:
        return src  # 无需处理
    parts = []
    for i, (x, y) in enumerate(segs):
        p = WORK / f"_fix_{name}_seg{i}.wav"
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
             "-af", f"atrim={x:.3f}:{y:.3f},asetpts=PTS-STARTPTS", "-ar", "44100", str(p)])
        parts.append(p)
    if len(parts) == 1:
        return parts[0]
    return crossfade_join(parts, out, d=0.6)


def pad_to_60s(wav, target=TARGET, fade=1.5):
    D = duration(wav)
    if D >= target - 0.05:
        return wav
    xfade = 2.0
    n = 2
    while n * D - (n - 1) * xfade < target + 1e-6:
        n += 1
    inputs = []
    for _ in range(n):
        inputs += ["-i", str(wav)]
    fc, prev = [], "[0:a]"
    for i in range(1, n):
        out = f"[x{i}]"
        fc.append(f"{prev}[{i}:a]acrossfade=d={xfade}:c1=tri:c2=tri{out}")
        prev = out
    fc.append(f"{prev}atrim=0:{target},asetpts=PTS-STARTPTS,"
              f"afade=t=in:d={fade},afade=t=out:st={target - fade}:d={fade}[o]")
    dst = WORK / f"_fix_{wav.stem}_pad.wav"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *inputs,
         "-filter_complex", ";".join(fc), "-map", "[o]", "-ar", "44100", str(dst)])
    return dst


def main():
    only = sys.argv[1:] or NAMES
    ok, fail = [], []
    for name in only:
        src = WORK / f"{name}.wav"
        if not src.exists():
            fail.append((name, "缺原始 wav"))
            continue
        try:
            cleaned = clean(name, src)
            padded = pad_to_60s(cleaned)
            m = measure_loudnorm(padded)
            dst_wav = WORK / f"_fix_{name}_norm.wav"
            linear = loudnorm2pass(padded, dst_wav, m)
            dst_ogg = OUT / f"{name}.ogg"
            run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(dst_wav),
                 "-map_metadata", "-1", "-c:a", "libvorbis", "-b:a", "96k", str(dst_ogg)])
            # ---- QC ----
            d = duration(dst_ogg)
            sil = silences(dst_ogg, d=1.0)
            i, tp = ebur128(dst_ogg)
            sz = dst_ogg.stat().st_size
            problems = []
            if sil:
                problems.append(f"静音 {sil}")
            if i is None or not (-17.0 <= i <= -15.0):
                problems.append(f"响度 {i}")
            if tp is not None and tp > -1.0:
                problems.append(f"峰值 {tp}")
            if not (200 * 1024 < sz < 8 * 1024 * 1024):
                problems.append(f"大小 {sz//1024}KB")
            if d < 20:
                problems.append(f"时长 {d:.1f}s")
            if problems:
                fail.append((name, " ".join(problems)))
                print(f"[fail] {name}: {' '.join(problems)}", flush=True)
            else:
                ok.append(name)
                print(f"[ok] {name}: {d:.1f}s I={i} LUFS TP={tp} dBTP "
                      f"{'linear' if linear else 'dynamic'} {sz//1024}KB", flush=True)
        except Exception as e:
            fail.append((name, str(e)[:120]))
            print(f"[fail] {name}: {e}", flush=True)
    print(f"== 修复完成 {len(ok)} 失败 {len(fail)}: {ok} / {[f[0] for f in fail]} ==")
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
