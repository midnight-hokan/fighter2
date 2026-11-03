#!/usr/bin/env bash
# 发布到网站：构建 → 写 dist/version.json → rsync 到网站目录 → 访问线上 version.json 确认。
# 用法：
#   DEPLOY_TARGET=user@host:/网站目录 SITE_URL=https://域名/路径/ bash scripts/deploy.sh
#   bash scripts/deploy.sh --dry-run      # 只构建和生成 version.json，不上传
# 约定：只有 `npm run check -- --upto E8` 通过的版本才允许发布（由 git hook 调用时已检查）。
#
# 仓库式发布（midnighthokan.com 专用）：
#   该站的 /var/www 每次站点部署都会整体原子替换，直接 rsync 上去会被冲掉。
#   所以设 SITE_REPO=<远端站点仓库路径> 后，rsync 目标是仓库的 public 子目录，
#   然后在远端 git commit+push，并强制跑一次站点部署（hokan-deploy --force）。
set -euo pipefail
cd "$(dirname "$0")/.."
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

VERSION=$(git rev-parse --short HEAD 2>/dev/null || echo dev)
if git status --porcelain 2>/dev/null | grep -q .; then VERSION="${VERSION}+"; fi
export APP_VERSION="$VERSION"

# 大图生成/更新 WebP 副本（运行时优先加载，体积约十分之一）；只有 PNG 内容变了才重新生成
python3 scripts/assets-webp.py
npx vite build >/dev/null
printf '{"version":"%s","time":"%s"}\n' "$VERSION" "$(date -u +%FT%TZ)" > dist/version.json
echo "构建完成：版本 $VERSION"

if [ "$DRY" = 1 ]; then echo "（dry-run，不上传）"; exit 0; fi
: "${DEPLOY_TARGET:?请设置 DEPLOY_TARGET，例如 user@host:/data/games/fighter2}"

rsync -az --delete dist/ "$DEPLOY_TARGET/"
echo "已上传到 $DEPLOY_TARGET"

# 仓库式发布：把 rsync 上去的产物在远端站点仓库里 commit+push，并触发站点部署
if [ -n "${SITE_REPO:-}" ]; then
  HOST=${DEPLOY_TARGET%%:*}
  REMOTE_PATH=${DEPLOY_TARGET#*:}
  case "$REMOTE_PATH" in
    "$SITE_REPO"/*) SUB=${REMOTE_PATH#"$SITE_REPO"/} ;;
    *) echo "❌ DEPLOY_TARGET 不在 SITE_REPO 内（$SITE_REPO）"; exit 1 ;;
  esac
  echo "仓库式发布：$HOST:$SITE_REPO/$SUB"
  ssh "$HOST" "set -e; cd '$SITE_REPO'; git add '$SUB'; \
    if ! git diff --cached --quiet; then git commit -qm 'games: fighter2 v$VERSION'; fi; \
    git push -q origin HEAD; \
    /usr/local/bin/hokan-deploy --force" | tail -3
fi

if [ -n "${SITE_URL:-}" ]; then
  sleep 1
  ONLINE=$(curl -fsS "${SITE_URL%/}/version.json?t=$(date +%s)" || true)
  if echo "$ONLINE" | grep -q "\"$VERSION\""; then
    echo "✅ 线上已是 $VERSION：$SITE_URL"
  else
    echo "❌ 线上版本不一致：$ONLINE"; exit 1
  fi
fi
