#!/usr/bin/env python3
# 角色语音生成（全本地，不依赖外网）：
#   参考音（8 段不同人声，来源见 REFMAP）
#   → 本地 Whisper :30001 转写参考音得到 prompt_text（保证音文一致）
#   → CosyVoice2 :30003 零样本克隆，逐句合成（22050Hz WAV）
#   → ffmpeg 转 OGG（libopus 48k 单声道）
#   → public/assets/meilong/voice/<char>_<line>.ogg
# 8 角色 × 4 句（intro/special/super/ko）= 32 个文件。
# 运行：python3 scripts/art/gen_voice.py
import base64
import io
import json
import os
import re
import struct
import subprocess
import sys
import urllib.request
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REFS = os.path.join(ROOT, "art-work", "voice", "refs")
OUT = os.path.join(ROOT, "public", "assets", "meilong", "voice")
COSYVOICE = "http://localhost:30003/tts"
WHISPER = "http://localhost:30001/v1/audio/transcriptions"

# 角色 → 参考音（refs/ 下文件）。音色依据 F0 中值挑选，8 人互不重复：
#   男：c01 马成甫 102Hz / c02 李宣东 111Hz / c03 张振峰 166Hz / c04 CosyVoice 官方男声 153Hz
#   女：c05 TTS-instruct 女声 297Hz / c06 CosyVoice 官方女声 271Hz / c07 方奕 214Hz / c08 TTS-clone 女声 259Hz
REFMAP = {
    "c01": "asr_第4组_马成甫.wav",
    "c02": "asr_第2组_李宣东.wav",
    "c03": "asr_第7组_张振峰.wav",
    "c04": "cv_ref16k.wav",
    "c05": "ttsA_ref.wav",
    "c06": "cv_zero.wav",
    "c07": "asr_第9组_方奕.wav",
    "c08": "ttsB_ref.wav",
}

LINES = {
    "c01": {"intro": "我爸那盏灯，该我来接了。", "special": "矿灯光弹！", "super": "全速截割！", "ko": "灯……还没灭呢。"},
    "c02": {"intro": "我的本事是从险区里带人出来，不是在擂台上表演。不过，今天破个例。", "special": "抛救生绳！", "super": "生命通道！", "ko": "这点伤，还能再扛一个。"},
    "c03": {"intro": "来，让我看看你的接线牢不牢。", "special": "电缆缠摔！", "super": "高压送电！", "ko": "哼，线路还是你强。"},
    "c04": {"intro": "你这个站位，已经构成违章了。", "special": "隐患排查！", "super": "一票否决！", "ko": "这条违章……我认了。"},
    "c05": {"intro": "这一场，我要上头版。", "special": "喇叭声波！", "super": "全矿广播！", "ko": "这条……上不了头版了。"},
    "c06": {"intro": "你的灯，是我充的电。", "special": "充电冲刺！", "super": "万灯齐明！", "ko": "灯……灭了。"},
    "c07": {"intro": "洗干净了没？没洗干净的，别想上我的擂台。", "special": "蒸汽冲天！", "super": "开闸放水！", "ko": "水都凉了，还打什么。"},
    "c08": {"intro": "放松。只是例行检查。", "special": "银针连射！", "super": "妙手回春！", "ko": "这一下，超出诊疗范围了。"},
}


def sh(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"cmd failed: {cmd}\n{r.stderr[-500:]}")
    return r.stdout


def whisper_text(wav_path):
    """本地 Whisper 转写（multipart POST）"""
    boundary = uuid.uuid4().hex
    data = open(wav_path, "rb").read()
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="language"\r\n\r\nzh\r\n'
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{os.path.basename(wav_path)}"\r\n'
        f"Content-Type: audio/wav\r\n\r\n".encode() + data + f"\r\n--{boundary}--\r\n".encode()
    )
    req = urllib.request.Request(WHISPER, data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())["text"].strip()


def tts(text, prompt_text, wav_path):
    """CosyVoice2 零样本克隆，返回 22050Hz WAV bytes"""
    b64 = base64.b64encode(open(wav_path, "rb").read()).decode()
    payload = json.dumps({"text": text, "prompt_text": prompt_text, "prompt_wav": b64}).encode()
    req = urllib.request.Request(COSYVOICE, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        out = json.loads(r.read())
    return base64.b64decode(out["audio_base64"])


def wav2ogg(wav_bytes, ogg_path):
    tmp = ogg_path + ".wav"
    with open(tmp, "wb") as f:
        f.write(wav_bytes)
    sh(f"ffmpeg -y -v error -i {tmp} -c:a libopus -b:a 48k -ac 1 -ar 24000 {ogg_path}")
    os.remove(tmp)


def main():
    os.makedirs(OUT, exist_ok=True)
    # 1) 转写 8 段参考音 → prompt_text
    prompts = {}
    for cid, ref in REFMAP.items():
        p = os.path.join(REFS, ref)
        if not os.path.exists(p):
            sys.exit(f"缺参考音: {p}")
        text = whisper_text(p)
        text = re.sub(r"\s+", "", text)
        prompts[cid] = text
        print(f"[ref] {cid} <- {ref}: {text[:40]}")
    # 2) 逐角色 × 4 句合成 → OGG
    n = 0
    for cid, lines in LINES.items():
        ref = os.path.join(REFS, REFMAP[cid])
        for line, text in lines.items():
            dst = os.path.join(OUT, f"{cid}_{line}.ogg")
            wav = tts(text, prompts[cid], ref)
            wav2ogg(wav, dst)
            n += 1
            print(f"[gen {n:2d}/32] {cid}_{line}  ({os.path.getsize(dst)} bytes)")
    # 3) 校验
    missing = [f"{c}_{l}.ogg" for c in LINES for l in LINES[c]
               if not os.path.exists(os.path.join(OUT, f"{c}_{l}.ogg"))]
    if missing:
        sys.exit("缺文件: " + ", ".join(missing))
    print("OK 32 个语音文件已生成")


if __name__ == "__main__":
    main()
