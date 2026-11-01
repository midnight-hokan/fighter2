#!/usr/bin/env python3
# A3 音乐音效生成（2026-11-01）：复刻 src/render/audio.js 的算法，离线渲染成 ogg。
#   - BGM：composeBgm({tempo,key,scale,seed}) 的 32 步循环 ×10 遍（与浏览器合成音同源）
#   - SFX：SOUNDS 表里 hit/block/throw/projectile/super/ko/round/knockdown 的 tone/noise 配方
# 输出 public/assets/meilong/audio/{s01..s06,title}.ogg 和 sfx_*.ogg
import math
import struct
import subprocess
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "public" / "assets" / "meilong" / "audio"
OUT.mkdir(parents=True, exist_ok=True)
SR = 44100

SCALES = {
    "minor": [0, 2, 3, 5, 7, 8, 10],
    "major": [0, 2, 4, 5, 7, 9, 11],
    "dorian": [0, 2, 3, 5, 7, 9, 10],
    "pentatonic": [0, 3, 5, 7, 10],
}
KEYS = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


class Rng:  # mulberry32，逐位对齐 JS createRng
    def __init__(self, seed):
        self.s = seed & 0xFFFFFFFF

    def next(self):
        self.s = (self.s + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.s
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t = (t ^ (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF))) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


def compose_bgm(bgm):
    r = Rng(bgm.get("seed", 1))
    scale = SCALES.get(bgm["scale"], SCALES["minor"])
    root = 45 + KEYS.get(bgm["key"], 9)
    bass, lead = [], []
    prog = [d % len(scale) for d in (0, 0, 5, 3)]
    for bar in range(4):
        for s in range(8):
            bass.append(root + scale[prog[bar]] - 12 + (12 if s % 2 else 0))
            if r.next() < 0.7:
                lead.append(root + 12 + scale[int(r.next() * len(scale))] + (12 if r.next() < 0.2 else 0))
            else:
                lead.append(None)
    return bgm.get("tempo", 132), bass, lead


def wave_sample(wtype, phase):
    p = phase % (2 * math.pi)
    if wtype == "square":
        return 1.0 if math.sin(p) >= 0 else -1.0
    if wtype == "triangle":
        return (2 / math.pi) * math.asin(math.sin(p))
    if wtype == "sawtooth":
        return 2 * (p / (2 * math.pi)) - 1
    return math.sin(p)  # sine


def add_tone(buf, t0, f0, f1, dur, wtype, vol, delay=0.0):
    start = int((t0 + delay) * SR)
    n = int(dur * SR)
    f1 = max(20.0, f1)
    phase = 0.0
    ratio = math.log(f1 / f0) if f0 > 0 else 0.0
    for i in range(n):
        j = start + i
        if j < 0 or j >= len(buf):
            continue
        t = i / SR
        f = f0 * math.exp(ratio * (t / dur))
        phase += 2 * math.pi * f / SR
        g = vol * (0.001 / vol) ** (t / dur)
        buf[j] += wave_sample(wtype, phase) * g


def add_noise(buf, t0, dur, vol):
    start = int(t0 * SR)
    n = int(SR * dur)
    for i in range(n):
        j = start + i
        if j < 0 or j >= len(buf):
            continue
        d = (((i * 7919) % 2003) / 1001 - 1) * (1 - i / n)
        buf[j] += d * vol


def write_wav(path, buf):
    peak = max(1e-9, max(abs(x) for x in buf))
    k = 0.98 / peak if peak > 0.98 else 1.0
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b"".join(struct.pack("<h", int(max(-1, min(1, x * k)) * 32767)) for x in buf)
        w.writeframes(frames)


def to_ogg(wav, ogg, q=6):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
                    "-c:a", "libvorbis", "-q:a", str(q), str(ogg)], check=True)
    wav.unlink()
    return ogg.stat().st_size


# ---------- BGM ----------
def render_bgm(bgm, ogg, loops=10, tail=0.3):
    tempo, bass, lead = compose_bgm(bgm)
    tick = 60 / tempo / 2
    nsteps = 32 * loops
    buf = [0.0] * int((nsteps * tick + tail) * SR)
    for i in range(nsteps):
        t = i * tick
        add_tone(buf, t, midi(bass[i % 32]), midi(bass[i % 32]), 0.12, "triangle", 0.08)
        l = lead[i % 32]
        if l is not None:
            add_tone(buf, t, midi(l), midi(l), 0.1, "square", 0.035)
    # BGM 整体偏轻，渲染时提一点响度保证文件够大、听感够
    buf = [x * 3.0 for x in buf]
    wav = OUT / ("_tmp.wav")
    write_wav(wav, buf)
    return to_ogg(wav, ogg, q=6)


# ---------- SFX（对齐 SOUNDS 表）----------
SFX_RECIPES = {
    "hit": lambda b: (add_noise(b, 0, 0.08, 0.25), add_tone(b, 0, 240, 60, 0.12, "square", 0.18)),
    "block": lambda b: (add_tone(b, 0, 900, 500, 0.06, "triangle", 0.15),),
    "throw": lambda b: (add_noise(b, 0, 0.15, 0.25), add_tone(b, 0, 120, 50, 0.25, "sawtooth", 0.15)),
    "projectile": lambda b: (add_tone(b, 0, 220, 880, 0.25, "sawtooth", 0.12),),
    "super": lambda b: (add_tone(b, 0, 300, 1200, 0.5, "sawtooth", 0.15), add_tone(b, 0, 600, 2400, 0.5, "square", 0.06, 0.05)),
    "ko": lambda b: (add_noise(b, 0, 0.4, 0.3), add_tone(b, 0, 300, 40, 0.9, "sawtooth", 0.2)),
    "round": lambda b: (add_tone(b, 0, 523, 523, 0.15, "square", 0.12),),
    "knockdown": lambda b: (add_noise(b, 0, 0.2, 0.2),),
}
SFX_DUR = {"hit": 0.14, "block": 0.08, "throw": 0.28, "projectile": 0.28, "super": 0.55, "ko": 0.95, "round": 0.18, "knockdown": 0.22}


def render_sfx(name, ogg):
    buf = [0.0] * int(SFX_DUR[name] * SR)
    SFX_RECIPES[name](buf)
    wav = OUT / ("_tmp.wav")
    write_wav(wav, buf)
    return to_ogg(wav, ogg, q=5)


# 各场景 bgm 规格（与 stages.js 一致）
BGM = {
    "s01": {"tempo": 132, "key": "A", "scale": "minor", "seed": 1},
    "s02": {"tempo": 118, "key": "E", "scale": "dorian", "seed": 2},
    "s03": {"tempo": 96, "key": "C", "scale": "minor", "seed": 3},
    "s04": {"tempo": 150, "key": "D", "scale": "minor", "seed": 4},
    "s05": {"tempo": 144, "key": "G", "scale": "major", "seed": 5},
    "s06": {"tempo": 162, "key": "B", "scale": "minor", "seed": 6},
}

for sid, spec in BGM.items():
    sz = render_bgm(spec, OUT / (sid + ".ogg"))
    print(f"{sid}.ogg {sz//1024}KB")

sz = render_bgm({"tempo": 110, "key": "C", "scale": "dorian", "seed": 99}, OUT / "title.ogg", loops=12)
print(f"title.ogg {sz//1024}KB")

for name in SFX_RECIPES:
    sz = render_sfx(name, OUT / (f"sfx_{name}.ogg"))
    print(f"sfx_{name}.ogg {sz//1024}KB")
print("AUDIO DONE")
