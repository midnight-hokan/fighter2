#!/usr/bin/env python3
"""regen-idle.py — A1「动作画成待机」(I) 帧批量重生成（INBOX 2026-11-03 11:10）。

流程：
  1. 读 QC 报告里 I 失败帧清单（fails 含 'I'，排除 IDLE_EXEMPT 动画——QC 已排除）。
  2. 对每帧：PROMPT_V2（强化姿势指令）重生成（gen_frames 管线：立绘叠骨架 →
     Qwen-Image-Edit-2511 → BiRefNet 抠图），SEED_SALT 换簇最多 --max-salt 轮。
  3. 验收：gen_frames.verify 原 5 项（骨架残留/不透明/全身/高度/颜色/前伸）
     + idle_iou(新帧 vs 同角色 idle_00，脚底对齐后剪影 IoU) < 0.88（姿势必须跟上）。
  4. 通过的帧写到 .check/regen-out/<cid>/<帧名>（抠图后 RGBA，未 fix-ghost/despill）。
     调用者随后：cp 到 fixed/<cid>/ → fix-ghost --src fixed → despill --src fixed → 重跑 QC。
  5. 全部 salt 轮仍失败的帧 → 写 .check/regen-out/substitute.json（邻帧顶替清单）。

用法：
  python3 scripts/art/regen-idle.py --qc .check/frame-qc-report-fixed.json \
      --src art-work/fixed [--max-salt 1] [--only c01,c02] [--limit N] [--dry-run]

注意：
  - 不碰原帧（raw/、fixed/ 旧帧都不改），只写 regen-out/。
  - 立绘用 raw-portraits/<cid>_normal.png（定稿立绘）。
  - idle 参照用 --src 目录里的 <cid>/idle_00.png（与 I 判据同源）。
  - ComfyUI 串行（GPU 与 llama-server 共享）。每帧约 8-12s。
"""
import argparse
import json
import os
import shutil
import sys
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_frames as gf  # noqa: E402

# regen-one.py 文件名带连字符，不能用普通 import，用 importlib 加载
import importlib.util
_spec = importlib.util.spec_from_file_location(
    "regen_one", str(Path(__file__).resolve().parent / "regen-one.py"))
if _spec is None or _spec.loader is None:
    raise SystemExit("加载 regen-one.py 失败")
_regen_one = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_regen_one)
PROMPT_V2 = _regen_one.PROMPT_V2
idle_like = _regen_one.idle_like

ROOT = gf.ROOT
OUT = ROOT / ".check" / "regen-out"


def load_list(list_path, only, limit):
    """从重生清单文件读帧 → [(cid, fname, anim_json, idx)]。
    清单格式 {"frames": [{"cid", "frame", ...}]}（regen-needed.json）。
    帧名 <anim>_<idx>.png（下划线），poses JSON 键 <anim>（点号）→ anim.replace('_','.')。
    """
    data = json.load(open(list_path))
    items = []
    for f in data["frames"]:
        cid = f["cid"]
        if only and cid not in only:
            continue
        fname = f["frame"]
        base = fname[:-4]  # 去 .png
        idx_s = base.rsplit("_", 1)[1]
        anim = base[: -(len(idx_s) + 1)]
        anim_json = anim.replace("_", ".")
        items.append((cid, fname, anim_json, int(idx_s)))
    if limit:
        items = items[:limit]
    return items


def frame_pose(cid, anim_json, idx):
    """读 pose JSON 的 frame 描述 + 骨架图路径。"""
    data = json.load(open(gf.POSES / (cid + ".json")))
    anims = data["anims"]
    # anim_json 形如 "st.hp"，直接查
    if anim_json not in anims:
        # 可能键名不同，尝试下划线
        raise KeyError(f"{cid}.anims 无 '{anim_json}'（可用键 {list(anims)[:8]}...）")
    frame = anims[anim_json]["frames"][idx]
    safe = anim_json.replace(".", "_")
    pose = gf.POSE_IMG / cid / f"{safe}_{idx:02d}.png"
    return frame, str(pose), data.get("style", "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", default=".check/regen-needed.json",
                    help="重生清单 JSON（regen-needed.json 格式）")
    ap.add_argument("--src", default="art-work/fixed", help="帧目录根（含 <cid>/idle_00.png）")
    ap.add_argument("--max-salt", type=int, default=1, help="SEED_SALT 最多换簇轮数（0=只初始）")
    ap.add_argument("--only", default="", help="只处理指定角色，逗号分隔（c01,c02）")
    ap.add_argument("--limit", type=int, default=0, help="只处理前 N 帧（调试）")
    ap.add_argument("--dry-run", action="store_true", help="只打印清单不生成")
    args = ap.parse_args()

    only = set(args.only.split(",")) if args.only else None
    src = Path(args.src)
    items = load_list(args.list, only, args.limit)
    print(f"== 待重生成 {len(items)} 帧（max_salt={args.max_salt}）==", flush=True)
    for cid, fname, anim, idx in items[:20]:
        print(f"  {cid}/{fname} ({anim} #{idx})", flush=True)
    if len(items) > 20:
        print(f"  ... 共 {len(items)}", flush=True)
    if args.dry_run:
        print("== dry-run，不生成 ==", flush=True)
        return

    OUT.mkdir(parents=True, exist_ok=True)
    ok_list, sub_list = [], []
    # 每角色缓存立绘 stats + idle 参照 + 参照高度
    cache = {}

    def char_ctx(cid):
        if cid not in cache:
            portrait = ROOT / "art-work" / "c2" / "raw-portraits" / f"{cid}_normal.png"
            if not portrait.exists():
                # 回退：找 c2/raw-portraits 下该角色任意立绘
                cands = sorted((ROOT / "art-work" / "c2" / "raw-portraits").glob(f"{cid}_*.png"))
                if not cands:
                    raise SystemExit(f"立绘缺失 {portrait}")
                portrait = cands[0]
            pstats = gf.portrait_stats(str(portrait))
            idle = gf.FRAMES / cid / "idle_00.png"
            idle_src = src / cid / "idle_00.png"
            idle_path = idle_src if idle_src.exists() else idle
            import numpy as np
            from PIL import Image
            idle_arr = np.array(Image.open(idle_path).convert("RGBA"))
            a = idle_arr[:, :, 3]
            ys, xs = np.where(a > 200)
            ref_h = int(ys.max() - ys.min() + 1) if len(ys) else None
            cache[cid] = {"portrait": str(portrait), "pstats": pstats,
                          "idle": idle_arr, "ref_h": ref_h}
        return cache[cid]

    HB = ROOT / ".check" / "heartbeat"
    for n, (cid, fname, anim, idx) in enumerate(items):
        HB.parent.mkdir(exist_ok=True)
        HB.touch()
        ctx = char_ctx(cid)
        frame, pose_path, desc = frame_pose(cid, anim, idx)
        if not Path(pose_path).exists():
            print(f"SKIP {cid}/{fname}: 骨架图缺失 {pose_path}", flush=True)
            sub_list.append({"cid": cid, "fname": fname, "reason": "pose_missing"})
            continue
        safe = anim.replace(".", "_")
        out = OUT / cid / fname
        out.parent.mkdir(parents=True, exist_ok=True)
        good = False
        for salt in range(args.max_salt + 1):
            seed = (20261101 + int(cid[1:]) * 100000
                    + zlib.crc32(f"{anim}_{idx}".encode()) % 90000
                    + salt * 7919 + 1000) & 0x7FFFFFFF
            try:
                overlay = gf.upload_overlay(ctx["portrait"], pose_path, cid, anim, idx)
                prompt = PROMPT_V2.format(desc=desc, hint=gf.POSE_HINTS.get(anim, ""),
                                          frame_desc=gf.describe_frame(frame))
                raw_p = f"f2raw_{cid}_{safe}_{idx:02d}"
                fin_p = f"f2fin_{cid}_{safe}_{idx:02d}"
                found, dt = gf.run(gf.wf(overlay, prompt, seed, cid, safe, idx),
                                   [raw_p, fin_p])
                raw_src, fin_src = found[raw_p], found[fin_p]
                # 验收：原 5 项 + idle_iou
                ok, why, bh = gf.verify(raw_src, fin_src, pose_path, ctx["pstats"],
                                        ctx["ref_h"], "loose", anim_name=anim)
                if ok:
                    import numpy as np
                    from PIL import Image
                    fimg = np.array(Image.open(fin_src).convert("RGBA"))
                    iou = idle_like(fimg, ctx["idle"])
                    if iou is not None and iou > 0.88:
                        ok = False
                        why = [f"idle_iou {iou:.3f}>0.88（姿势没跟上）"]
                if ok:
                    shutil.copy(fin_src, out)
                    print(f"OK {n+1}/{len(items)} {cid}/{fname} salt={salt} ({dt:.0f}s)", flush=True)
                    ok_list.append({"cid": cid, "fname": fname, "salt": salt})
                    good = True
                    break
                else:
                    print(f"bad {cid}/{fname} salt={salt} [{'; '.join(why)}]", flush=True)
            except Exception as e:
                print(f"err {cid}/{fname} salt={salt}: {str(e)[:150]}", flush=True)
        if not good:
            sub_list.append({"cid": cid, "fname": fname, "reason": "regen_fail"})
            print(f"SUB {cid}/{fname}（{args.max_salt+1} 轮未过，待邻帧顶替）", flush=True)

    # 写清单
    (OUT / "ok.json").write_text(json.dumps(ok_list, ensure_ascii=False, indent=1))
    (OUT / "substitute.json").write_text(json.dumps(sub_list, ensure_ascii=False, indent=1))
    print(f"\n== DONE 重生成成功 {len(ok_list)}/{len(items)}，待顶替 {len(sub_list)} ==", flush=True)
    print(f"输出：{OUT}/<cid>/*.png + ok.json + substitute.json", flush=True)
    if sub_list:
        print("待顶替：", flush=True)
        for s in sub_list[:30]:
            print(f"  {s['cid']}/{s['fname']} ({s['reason']})", flush=True)


if __name__ == "__main__":
    main()
