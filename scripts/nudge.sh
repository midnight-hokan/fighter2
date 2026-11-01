#!/usr/bin/env bash
# 长任务推手：如果 40 分钟内项目没有任何新提交，就执行一次"继续"命令把大炮叫醒。
# 用法（crontab，每 20 分钟一次）：
#   */20 * * * * NUDGE_CMD='<给 Hermes 发消息的命令>' /home/yuguang/projects/fighter2/scripts/nudge.sh
#
# NUDGE_CMD 需要按大炮上 Hermes 的实际用法填写，发送的消息内容建议是：
#   "继续 fighter2 长任务：读 ~/projects/fighter2/TASK.md 和 PROGRESS.md，从断点继续，不用等我确认。"
# 未设置 NUDGE_CMD 时只写日志，不执行任何操作。
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .check
LOG=.check/nudge.log
STALE_MIN=${STALE_MIN:-40}

# 全部完成就不再推
if [ -f .check/status.json ] && grep -q '"current": null' .check/status.json; then
  echo "$(date '+%F %T') 已全部完成，不推" >> "$LOG"; exit 0
fi

last=$(git log -1 --format=%ct 2>/dev/null || echo 0)
now=$(date +%s)
idle=$(( (now - last) / 60 ))
if [ "$idle" -lt "$STALE_MIN" ]; then
  echo "$(date '+%F %T') 最近 ${idle} 分钟内有提交，不推" >> "$LOG"; exit 0
fi

if [ -z "${NUDGE_CMD:-}" ]; then
  echo "$(date '+%F %T') 已 ${idle} 分钟无提交，但未设置 NUDGE_CMD" >> "$LOG"; exit 0
fi
echo "$(date '+%F %T') 已 ${idle} 分钟无提交，执行推手" >> "$LOG"
bash -c "$NUDGE_CMD" >> "$LOG" 2>&1 || echo "$(date '+%F %T') 推手命令失败" >> "$LOG"
