#!/usr/bin/env bash
# A1 P/G 失败帧重生流水线（INBOX 2026-11-03 06:20 第二步）：
#   读 .check/regen-needed.json → 按 (角色,动画) 分组 → 删坏帧 →
#   SEED_SALT=$S gen_frames 补帧（只补被删的，好帧不动）→ cleanup --fix → 输出待复检清单
# 用法：
#   SALT=6 bash scripts/art/run-regen.sh              # 用 regen-needed.json 全量
#   SALT=6 bash scripts/art/run-regen.sh c04 st.hk    # 只重生指定角色指定动画
# 每轮重生完必须重跑 frame-qc.py 复检；≤3 轮（salt 6/7/8），仍不过 → 邻帧顶替。
set -euo pipefail
cd "$(dirname "$0")/../.."
SALT="${SALT:?用法: SALT=6 bash scripts/art/run-regen.sh [cid anim]}"
REG=".check/regen-needed.json"
PY=python3

echo "== 重生 salt=$SALT =="
if [ $# -ge 2 ]; then
  CID="$1"; ANIMS="$2"
  # 手动指定：删该动画在 regen-needed 里的失败帧（或全部帧若不在清单）
  $PY - "$CID" "$ANIMS" <<'EOF'
import json, os, sys
cid, anim = sys.argv[1], sys.argv[2]
rep = json.load(open(".check/regen-needed.json")) if os.path.exists(".check/regen-needed.json") else {"frames": []}
fdir = f"art-work/frames/{cid}"
safe = anim.replace(".", "_")
for fr in list(rep["frames"]):
    if fr["cid"] == cid and fr["frame"].startswith(safe + "_"):
        p = os.path.join(fdir, fr["frame"])
        if os.path.exists(p): os.remove(p); print("删", fr["frame"])
EOF
  gen_cmds=("$CID" "$ANIMS")
else
  # 按清单分组：列出 "cid anim" 对（去重保序）
  gen_cmds=()
  while read -r cid anim; do
    $PY - "$cid" "$anim" <<'EOF'
import json, os, sys
cid, anim = sys.argv[1], sys.argv[2]
rep = json.load(open(".check/regen-needed.json"))
fdir = f"art-work/frames/{cid}"
safe = anim.replace(".", "_")
n = 0
for fr in list(rep["frames"]):
    if fr["cid"] == cid and fr["frame"].startswith(safe + "_"):
        p = os.path.join(fdir, fr["frame"])
        if os.path.exists(p): os.remove(p); n += 1
if n: print(f"{cid}/{anim}: 删 {n} 坏帧")
EOF
    gen_cmds+=("$cid" "$anim")
  done < <($PY - <<'EOF'
import json
seen = set()
for fr in json.load(open(".check/regen-needed.json"))["frames"]:
    anim = fr["frame"].rsplit("_", 1)[0]
    key = (fr["cid"], anim)
    if key not in seen:
        seen.add(key)
        print(key[0], key[1].replace("_", "."))
EOF
  )
fi

if [ ${#gen_cmds[@]} -eq 0 ]; then
  echo "无待重生动画（清单空或手动参数无匹配帧）"
  exit 0
fi

touch .check/heartbeat
i=0
while [ $i -lt ${#gen_cmds[@]} ]; do
  cid="${gen_cmds[$i]}"; anim="${gen_cmds[$i+1]}"
  portrait="docs/art-review/${cid}-portrait.png"
  echo "--- $cid $anim (salt=$SALT) ---"
  SEED_SALT="$SALT" $PY scripts/art/gen_frames.py "$cid" "$portrait" --anim "$anim" 2>&1 | tail -3
  $PY scripts/art/cleanup-frames.py "$cid" --fix 2>&1 | tail -2
  i=$((i+2))
done
echo "== 重生完成 salt=$SALT → 重跑 frame-qc.py 复检 =="
