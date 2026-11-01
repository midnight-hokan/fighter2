#!/usr/bin/env bash
# A1 精简版(--lite)动作帧批量驱动（2026-11-01）：c02–c08，85 帧/人
# 流程：export-poses --lite（8 人 pose JSON，style 自动同步）→ 逐人：
#   render-poses 骨架图 → gen_frames 出帧（--desc 自动读 pose JSON 的 style）
#   → 校验帧齐全 → pack-atlas → montage-frames 拼图 → git 提交（post-commit 自动发布）
# c01 林啸 198 帧完整版已单独提交，此处不重跑。
# 可断点续跑：gen_frames 跳过已存在帧；缺帧的角色跳过提交、留待人工。
set -u
cd ~/projects/fighter2

declare -A NAME=( [c02]=罗铮 [c03]=雷钧 [c04]=严正 [c05]=苏红 [c06]=方萤 [c07]=霍兰 [c08]=沈清 )
MARKER=.check/lite-frames.marker
echo "=== LITE_FRAMES_START $(date '+%F %T') ==="

# 心跳守护：本脚本运行期间每 5 分钟 touch .check/heartbeat。
# 看门狗预检 (b) 靠心跳新鲜（mtime<600s）判断"有人活着/另有续跑在进行"，
# 长批量帧期间保持心跳新鲜，看门狗就不会另起续跑撞车（TASK.md 第4/10节）。
# 脚本退出（正常/INT/TERM）时 trap 杀掉守护，避免残留心跳让看门狗长期误判。
HB=.check/heartbeat
touch "$HB"
( while :; do touch "$HB"; sleep 300; done ) &
HB_PID=$!
trap 'kill "$HB_PID" 2>/dev/null' EXIT INT TERM

# 0) ComfyUI 探活（8188）
ok=0
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8188/system_stats >/dev/null 2>&1; then ok=1; echo "ComfyUI 8188 OK"; break; fi
  echo "ComfyUI 未就绪，等 10s ($i/30)"; sleep 10
done
[ "$ok" = 1 ] || { echo "FATAL: ComfyUI 不可用"; echo "$(date '+%F %T') LITE_FRAMES_FATAL comfyui" > "$MARKER"; exit 1; }

# 1) 导出 lite pose JSON
node scripts/art/export-poses.mjs art-work/poses --lite || { echo "FATAL: export-poses 失败"; exit 1; }

DONE=""
for c in c02 c03 c04 c05 c06 c07 c08; do
  echo ""
  echo "########## $c ${NAME[$c]} $(date '+%F %T') ##########"
  python3 scripts/art/render-poses.py "art-work/poses/$c.json" "art-work/pose-img/$c" || { echo "FAIL $c render-poses"; continue; }
  python3 scripts/art/gen_frames.py "$c" "docs/art-review/$c-portrait.png" --all || echo "WARN $c gen_frames 非零退出（部分帧可能失败）"
  # 帧齐全校验：pose JSON 里每一帧都必须存在
  missing=$(python3 - "$c" <<'PY'
import json, sys, os
cid = sys.argv[1]
d = json.load(open(f"art-work/poses/{cid}.json"))
miss = [f"art-work/frames/{cid}/{n.replace('.','_')}_{i:02d}.png"
        for n, a in d["anims"].items() for i in range(len(a["frames"]))
        if not os.path.exists(f"art-work/frames/{cid}/{n.replace('.','_')}_{i:02d}.png")]
print(len(miss), miss[:3])
PY
)
  mcount=$(echo "$missing" | awk '{print $1}')
  if [ "$mcount" != "0" ]; then
    echo "FAIL $c 缺 $mcount 帧（如 $(echo "$missing" | cut -d' ' -f2-)），跳过提交待人工"
    continue
  fi
  python3 scripts/art/pack-atlas.py "art-work/poses/$c.json" "art-work/frames/$c" || { echo "FAIL $c pack-atlas"; continue; }
  python3 scripts/art/montage-frames.py "$c" || echo "WARN $c montage 失败"
  git add "public/assets/meilong/$c" public/assets/manifest.json "docs/art-review/$c-frames.png" scripts/art/montage-frames.py 2>/dev/null
  git commit -q -m "A1 精简版 $c ${NAME[$c]} 85 帧 pack-atlas 提交 + art-review 对比图（--lite 管线，desc 自动读 style）" \
    && echo "COMMITTED $c" || echo "WARN $c 提交失败"
  DONE="$DONE $c"
  echo "$(date '+%F %T') LITE_PROGRESS done:$DONE" > "$MARKER"
done

echo ""
echo "=== LITE_FRAMES_DONE $(date '+%F %T') ==="
echo "完成:$DONE"
echo "$(date '+%F %T') LITE_FRAMES_DONE completed:$DONE" > "$MARKER"
