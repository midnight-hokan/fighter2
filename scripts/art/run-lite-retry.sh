#!/usr/bin/env bash
# A1 lite 帧重试（2026-11-01）：批量后 c04/c06/c08 共 8 帧 4 次未过验收。
# 失败主因是种子簇（骨架残留/配色擦边），gen_frames 已加 SEED_SALT 换簇重抽。
# 流程：最多 3 轮（salt=1/2/3），每轮只重跑仍有缺帧的动画；
#   全齐后 pack-atlas + montage + git 提交（同 run-lite-frames.sh 的提交段）。
# 心跳守护同批量脚本，防看门狗误判。
set -u
cd ~/projects/fighter2

declare -A NAME=( [c04]=严正 [c06]=方萤 [c08]=沈清 )
HB=.check/heartbeat
touch "$HB"
( while :; do touch "$HB"; sleep 300; done ) &
HB_PID=$!
trap 'kill "$HB_PID" 2>/dev/null' EXIT INT TERM

# 输出某角色仍有缺帧的动画名（逗号分隔），无缺帧则输出空
anim_todo() {
python3 - "$1" <<'PY'
import json, sys, os
cid = sys.argv[1]
d = json.load(open(f"art-work/poses/{cid}.json"))
todo = sorted({n for n, a in d["anims"].items() for i in range(len(a["frames"]))
               if not os.path.exists(f"art-work/frames/{cid}/{n.replace('.','_')}_{i:02d}.png")})
print(",".join(todo))
PY
}

for salt in 1 2 3; do
  echo ""
  echo "########## RETRY ROUND $salt $(date '+%F %T') ##########"
  all_done=1
  for c in c04 c06 c08; do
    todo=$(anim_todo "$c")
    if [ -z "$todo" ]; then
      echo "$c 全部齐全，跳过"
      continue
    fi
    all_done=0
    echo "$c 待补动画: $todo"
    SEED_SALT=$salt python3 scripts/art/gen_frames.py "$c" "docs/art-review/$c-portrait.png" --anim "$todo" \
      || echo "WARN $c round$salt gen_frames 非零退出"
  done
  [ "$all_done" = 1 ] && { echo "全部齐全（round $salt 后）"; break; }
done

echo ""
DONE=""
for c in c04 c06 c08; do
  if [ -z "$(anim_todo "$c")" ]; then
    python3 scripts/art/pack-atlas.py "art-work/poses/$c.json" "art-work/frames/$c" \
      || { echo "FAIL $c pack-atlas"; continue; }
    python3 scripts/art/montage-frames.py "$c" || echo "WARN $c montage 失败"
    git add "public/assets/meilong/$c" public/assets/manifest.json "docs/art-review/$c-frames.png" 2>/dev/null
    git commit -q -m "A1 精简版 $c ${NAME[$c]} 缺帧重试补齐 pack-atlas 提交（SEED_SALT 换簇重抽）" \
      && echo "COMMITTED $c" || echo "WARN $c 提交失败"
    DONE="$DONE $c"
  else
    echo "FAIL $c 仍有缺帧，留待人工: $(anim_todo "$c")"
  fi
done
echo ""
echo "=== LITE_RETRY_DONE $(date '+%F %T') ==="
echo "补齐提交:$DONE"
