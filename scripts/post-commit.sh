#!/usr/bin/env bash
# git post-commit 钩子（安装：ln -sf ../../scripts/post-commit.sh .git/hooks/post-commit）
# 每次提交后在后台：推送到 GitHub → 跑 E1–E8 自检 → 通过才发布到网站。日志在 .check/deploy.log。
# 需要在 ~/.fighter2-deploy.env 里写 DEPLOY_TARGET 和 SITE_URL。
cd "$(git rev-parse --show-toplevel)" || exit 0
mkdir -p .check
(
  set -a; [ -f ~/.fighter2-deploy.env ] && . ~/.fighter2-deploy.env; set +a
  echo "== $(date '+%F %T') 提交 $(git rev-parse --short HEAD)"
  # 先推到 GitHub（不论自检结果），Claude 通过仓库看进度
  # 推送被拒（Claude 同时推了新提交）时，先 rebase 到远端最新再推一次
  if git push -q origin HEAD 2>&1; then echo "已推送到 GitHub"
  elif git pull -q --rebase --autostash origin "$(git rev-parse --abbrev-ref HEAD)" 2>&1 && git push -q origin HEAD 2>&1; then echo "远端有新提交，已 rebase 后推送"
  else echo "推送 GitHub 失败（rebase 也没成功，需手动处理）"; fi
  if npm run check -- --upto E8 > .check/deploy-check.log 2>&1; then
    bash scripts/deploy.sh
  else
    echo "引擎自检未通过，不发布（见 .check/deploy-check.log）"
  fi
) >> .check/deploy.log 2>&1 &
