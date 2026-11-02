#!/bin/bash
# 补缺帧（2026-11-02）：c04×13 + c05×2(cr_lp_02+st_hk_02) + c08×1 = 16 帧
# SEED_SALT=1 跳新种子簇——原失败 run 用 salt=0，同 salt 会复现同样的坏图，必须跳簇。
# 注意：攻击动画用点号名（st.hk/cr.lp/cr.hk → 文件名 st_hk/cr_lp/cr_hk）。
# gen_frames.py 每帧最多 4 次重试（aseed = seed + attempt*1000003）。
cd /home/yuguang/projects/fighter2
export SEED_SALT=1
echo "=== [1/3] c04 (13 帧) $(date) ==="
python3 scripts/art/gen_frames.py c04 docs/art-review/c04-portrait.png --anim walkf,jump,crblock,dizzy,roll,st.hk,cr.hk,denghua,shanguang,huaying
echo "=== [2/3] c05 (cr_lp_02 + st_hk_02) $(date) ==="
python3 scripts/art/gen_frames.py c05 docs/art-review/c05-portrait.png --anim cr.lp,st.hk
echo "=== [3/3] c08 (cr_hk_07) $(date) ==="
python3 scripts/art/gen_frames.py c08 docs/art-review/c08-portrait.png --anim cr.hk
echo "=== FILL DONE $(date) ==="
