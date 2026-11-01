#!/usr/bin/env python3
# VLM 定位脸部 bbox（INBOX 07:25 C2 表情区分度前置）：
# 用 llama-server 的 Qwen3.8-27B（带 mmproj 视觉）逐张问脸部框，
# 输出 .check/face-bboxes.json：{cid/expr: {x,y,w,h} 或 null}。
# 断点续跑：已有非空结果的跳过；null 的保留（后续手工兜底）。

import base64
import json
import re
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API = "http://127.0.0.1:30000/v1/chat/completions"
OUT = ROOT / ".check/face-bboxes.json"
CHARS = ["c02", "c03", "c04", "c05", "c06", "c07", "c08"]
EXPR = ["normal", "angry", "smug", "hurt"]

PROMPT = (
    "You are a bounding-box annotator. The image is a 768x1024 pixel character "
    "portrait (facing right). Locate the visible FACE of the person.\n"
    "Face region = from the forehead (below the hairline) down to the chin, "
    "including eyes, brows, nose, mouth and cheeks. Exclude hair, hat and beard outline only if outside the face area.\n"
    "Reply with ONLY one line of JSON: {\"x\": <left>, \"y\": <top>, \"w\": <width>, \"h\": <height>} "
    "with integer pixel coordinates. No other text."
)

data = json.loads(OUT.read_text()) if OUT.exists() else {}


def ask(im_path):
    b64 = base64.b64encode(im_path.read_bytes()).decode()
    body = json.dumps({
        "model": "/home/yuguang/models/Qwen3.8-27B-Q8_0.gguf",
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": PROMPT},
            {"type": "image_url", "image_url": {"url": "data:image/png;base64," + b64}},
        ]}],
        "temperature": 0,
        "max_tokens": 600,
    }).encode()
    last = ""
    for _ in range(3):
        req = urllib.request.Request(API, data=body, headers={"Content-Type": "application/json"})
        j = json.load(urllib.request.urlopen(req, timeout=300))
        msg = j["choices"][0]["message"]
        last = (msg.get("content") or "") + " " + (msg.get("reasoning_content") or "")
        if parse(last):
            return last
    return last


def parse(out):
    m = re.search(r"\{[^{}]*\}", out)
    if not m:
        return None
    try:
        d = json.loads(m.group(0))
        x, y, w, h = int(d["x"]), int(d["y"]), int(d["w"]), int(d["h"])
    except Exception:
        return None
    if not (0 < w < 768 and 0 < h < 1024 and 0 <= x and 0 <= y):
        return None
    if not (w >= 40 and h >= 40 and x + w <= 768 and y + h <= 1024):
        return None
    return {"x": x, "y": y, "w": w, "h": h}


def main():
    n_new = n_skip = n_fail = 0
    for cid in CHARS:
        for e in EXPR:
            key = cid + "/" + e
            if key in data and data[key]:
                n_skip += 1
                continue
            p = ROOT / "public/assets/meilong/portraits" / cid / (e + ".png")
            try:
                box = parse(ask(p))
            except Exception as ex:
                box = None
                print("ERR", key, str(ex)[:120], flush=True)
            data[key] = box
            n_new += 1 if box else 0
            n_fail += 0 if box else 1
            OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1))  # 逐条落盘，防崩全丢
            (ROOT / ".check/heartbeat").touch()
            print(("ok " if box else "FAIL ") + key + " " + json.dumps(box), flush=True)
            time.sleep(0.5)

    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print("done new=%d skip=%d fail=%d" % (n_new, n_skip, n_fail))


if __name__ == "__main__":
    main()
