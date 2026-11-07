#!/usr/bin/env python3
# 双卡并行补跑 v3 剩余角色：c06/c08 -> GPU1(8189)。断点续跑，跳过已提交角色。
# 用法: ~/latentsync-env/bin/python scripts/art/wan-v3-parallel.py
import os, sys, time, subprocess

ROOT = os.path.expanduser("~/projects/fighter2")
PY = os.path.expanduser("~/latentsync-env/bin/python")
SCRIPT = "scripts/art/wan-v3.py"
CK = os.path.join(ROOT, ".check")
HB = os.path.join(CK, "heartbeat")
CHARS = os.environ.get("WAN_ONLY", "c06,c08").split(",")

def log(msg):
    line = f"[{time.strftime('%m-%d %H:%M:%S')}] parallel(gpu1): {msg}"
    print(line, flush=True)
    with open(os.path.join(CK, "v3-frames.log"), "a") as f:
        f.write(line + "\n")

hb_proc = subprocess.Popen(f"while :; do touch {HB}; sleep 300; done", shell=True,
                           start_new_session=True)
try:
    for cid in CHARS:
        r = subprocess.run(["git", "ls-files", f"docs/art-review/v3-{cid}.jpg"],
                           cwd=ROOT, capture_output=True)
        if r.stdout.strip():
            log(f"{cid} 已提交（联系表在 git），跳过")
            continue
        env = dict(os.environ, WAN_COMFY="http://127.0.0.1:8189",
                   WAN_ONLY=cid, WAN_DONE_HOOK="0")
        t0 = time.time()
        log(f"run {cid} 开始（8189/GPU1）")
        r = subprocess.run([PY, SCRIPT, "run"], cwd=ROOT, env=env)
        log(f"run {cid} 退出码 {r.returncode}，用时 {(time.time()-t0)/60:.0f} 分钟")
        # finish 阶段红灯（帧 QC/打包失败）或异常 → 不提交，留给主线/人工
        ok = os.path.exists(os.path.join(ROOT, "public/assets/meilong", cid, "atlas.webp")) or \
             os.path.exists(os.path.join(ROOT, "public/assets/meilong", cid, "atlas.png"))
        sheet = os.path.join(ROOT, "docs/art-review", f"v3-{cid}.jpg")
        if r.returncode == 0 and os.path.exists(sheet) and ok:
            subprocess.run(["git", "pull", "--rebase", "--autostash"], cwd=ROOT,
                           capture_output=True)
            subprocess.run(["git", "add", f"public/assets/meilong/{cid}/",
                            "public/assets/manifest.json", sheet], cwd=ROOT)
            subprocess.run(["git", "commit", "-m",
                            f"v3 {cid}: 46 动画全量帧（Wan2.2-Animate 驱动，GPU1 并行）"],
                           cwd=ROOT, capture_output=True)
            h = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT,
                               capture_output=True, text=True).stdout.strip()
            log(f"{cid} 已提交 {h}")
        else:
            log(f"{cid} 未达提交条件（rc={r.returncode} sheet={os.path.exists(sheet)} atlas={ok}），跳过提交")
finally:
    import signal
    for s in (signal.SIGTERM, signal.SIGKILL):
        try:
            os.killpg(hb_proc.pid, s)
        except Exception:
            break
        time.sleep(2)
log("parallel 结束")
