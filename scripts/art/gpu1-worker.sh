#!/bin/bash
# GPU1 并行 worker：c06 -> c08（ComfyUI :8189）
# 与 GPU0 主 run 的分工：本 worker 只做 prep + gen（产物写各自角色目录，互不冲突）；
# finish/QC/commit 统一由 GPU0 主 run 收尾（gen 有帧文件跳过逻辑，主 run 到 c06/c08 秒过）。
cd /home/yuguang/projects/fighter2 || exit 1
export WAN_COMFY=http://localhost:8189
export WAN_COMFY_INPUT=/home/yuguang/comfy-gpu1/input
HB=.check/heartbeat-gpu1
( while :; do touch $HB; sleep 300; done ) &
HBP=$!
trap 'kill $HBP 2>/dev/null' EXIT
for CID in c06 c08; do
  echo "[$(date '+%m-%d %H:%M:%S')] GPU1: $CID 开始 prep+gen" >> .check/v3-gpu1.log
  python3 scripts/art/wan-v3.py refgen $CID >> .check/v3-gpu1.log 2>&1
  python3 scripts/art/wan-v3.py prep $CID >> .check/v3-gpu1.log 2>&1
  python3 scripts/art/wan-v3.py gen $CID >> .check/v3-gpu1.log 2>&1
  echo "[$(date '+%m-%d %H:%M:%S')] GPU1: $CID gen 退出码 $?" >> .check/v3-gpu1.log
done
echo "[$(date '+%m-%d %H:%M:%S')] GPU1 worker 结束" >> .check/v3-gpu1.log
