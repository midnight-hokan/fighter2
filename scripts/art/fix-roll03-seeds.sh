#!/bin/bash
# roll_03 骨架残留升级链 第 1 步：换 3 轮 SEED_SALT（salt=2/3/4，各 4 种子 = 12 个新种子）
# 已试过 salt=0(原 run)/salt=1(补帧)，各 4 种子，共 8 个都挂（IoU 0.296-0.490）。
cd /home/yuguang/projects/fighter2
for salt in 2 3 4; do
  echo "=== roll_03 SEED_SALT=$salt $(date) ==="
  SEED_SALT=$salt python3 scripts/art/gen_frames.py c04 docs/art-review/c04-portrait.png --anim roll
  if [ -f art-work/frames/c04/roll_03.png ]; then
    echo "ROLL_03_PASS salt=$salt"
    break
  fi
done
echo "=== SKELETON-SEEDS DONE $(date) ==="
