#!/usr/bin/env python3
# 快速对比 10 步 vs 20 步在困难帧上的验收通过率
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_frames  # 复用 upload_overlay / wf / run / verify
from gen_frames import upload_overlay, run, verify

cid = "c02"
portrait = Path.home() / "projects/fighter2/docs/art-review/c02-portrait.png"
data = __import__("json").load(open(Path.home() / "projects/fighter2/art-work/poses/c02.json"))
tests = [("st.hp", 2), ("ko", 2), ("walkf", 0), ("chongtianshan", 4)]
desc = "中年矿工，体格敦实，穿厚皮褂，护目镜推在额头上，暖棕肤色"

for anim, idx in tests:
    safe = anim.replace(".", "_")
    pose = gen_frames.POSE_IMG / cid / (safe + "_" + format(idx, "02d") + ".png")
    overlay = upload_overlay(portrait, pose, cid, anim, idx)
    prompt = gen_frames.PROMPT_TMPL.format(
        desc=desc, hint=gen_frames.POSE_HINTS.get(anim, ""),
        frame_desc=__import__("pose_text", fromlist=["describe_frame"]).describe_frame(data["anims"][anim]["frames"][idx]))
    for steps in (10, 20):
        seed = 20261101 + 12345
        out = Path("/tmp/step_test_%s_%s_%dsteps.png" % (safe, idx, steps))
        try:
            if out.exists(): out.unlink()
            w = gen_frames.wf(overlay, prompt, seed, "f2_step_test")
            w["7"]["inputs"]["steps"] = steps
            dt = run(w, out)
            good, why = verify(out, pose)
            print("steps=%d %s_%02d: %s (%.0fs) %s" % (steps, safe, idx, "PASS" if good else "FAIL", dt, why), flush=True)
        except Exception as e:
            print("steps=%d %s_%02d: ERR %s" % (steps, safe, idx, str(e)[:150]), flush=True)
print("STEP_TEST_DONE")
