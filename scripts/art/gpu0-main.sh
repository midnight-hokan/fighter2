#!/bin/bash
# GPU0 主 run：c05 收尾 -> 等 GPU1 worker 结束 -> c06/c08 finish+commit（统一收尾）
cd /home/yuguang/projects/fighter2 || exit 1
HB=.check/heartbeat
( while :; do touch $HB; sleep 300; done ) &
HBP=$!
trap 'kill $HBP 2>/dev/null' EXIT
echo "[$(date '+%m-%d %H:%M:%S')] main: c05 run 启动" >> .check/v3-main.log
WAN_ONLY=c05 python3 scripts/art/wan-v3.py run >> .check/v3-main.log 2>&1
echo "[$(date '+%m-%d %H:%M:%S')] main: c05 run 退出码 $?" >> .check/v3-main.log
echo "[$(date '+%m-%d %H:%M:%S')] main: 等 GPU1 worker 结束" >> .check/v3-main.log
while pgrep -f gpu1-worker.sh >/dev/null; do sleep 60; done
echo "[$(date '+%m-%d %H:%M:%S')] worker 已结束，main 开始收尾 c06/c08" >> .check/v3-main.log
python3 scripts/art/wan-v3.py run >> .check/v3-main.log 2>&1
echo "[$(date '+%m-%d %H:%M:%S')] main: 全部结束，退出码 $?" >> .check/v3-main.log
