#!/bin/bash
# 重生 14 帧 despill 后仍 >3% 溢色的帧（视觉校准：>4% 明显绿斑必重生；
# 2-3% 在 128px 仅淡边缘色，保留。SEED_SALT=5 新种子簇：0=原始批 1=补帧 2/3/4=roll_03 链）
# 用法：bash scripts/art/fix-spill-frames.sh
# gen_frames.py 跳过已存在帧——先删目标帧再跑 --anim（同动画其余帧不动）
set -e
cd "$(dirname "$0")/../.."
touch .check/heartbeat

regen() { # $1=cid $2=逗号分隔动画 $3=要删的帧文件...
  cid=$1; anims=$2; shift 2
  for f in "$@"; do rm -f "art-work/frames/$cid/$f"; done
  echo "=== $cid: 删帧 $* → 重生成 $anims (SEED_SALT=5) ==="
  SEED_SALT=5 python3 scripts/art/gen_frames.py "$cid" "docs/art-review/${cid}-portrait.png" --anim "$anims"
  touch .check/heartbeat
}

regen c01 "st.lk" st_lk_03.png
regen c02 "cr.hk" cr_hk_06.png
regen c03 "st.mk" st_mk_04.png
regen c04 "jifenghua" jifenghua_04.png
regen c05 "jump,j.hk" jump_02.png jump_03.png j_hk_03.png
regen c07 "cr.hp,st.mk" cr_hp_07.png st_mk_04.png
regen c08 "st.lk,huiyanlong,huihe,airhit,gc" st_lk_03.png huiyanlong_07.png huihe_03.png airhit_01.png gc_03.png

# 新帧过一遍 despill（绿幕生成，需去溢色）
for c in c01 c02 c03 c04 c05 c07 c08; do
  touch .check/heartbeat
  python3 scripts/art/cleanup-frames.py "$c" --fix > .check/cleanup-fix2-$c.log 2>&1
done
echo "=== 全部完成 ==="
