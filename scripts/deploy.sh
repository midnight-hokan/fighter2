#!/usr/bin/env bash
# 发布到网站：构建 → 写 dist/version.json → rsync 到网站目录 → 访问线上 version.json 确认。
# 用法：
#   DEPLOY_TARGET=user@host:/网站目录 SITE_URL=https://域名/路径/ bash scripts/deploy.sh
#   bash scripts/deploy.sh --dry-run      # 只构建和生成 version.json，不上传
# 约定：只有 `npm run check -- --upto E8` 通过的版本才允许发布（由 git hook 调用时已检查）。
set -euo pipefail
cd "$(dirname "$0")/.."
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

VERSION=$(git rev-parse --short HEAD 2>/dev/null || echo dev)
if git status --porcelain 2>/dev/null | grep -q .; then VERSION="${VERSION}+"; fi
export APP_VERSION="$VERSION"

npx vite build >/dev/null
printf '{"version":"%s","time":"%s"}\n' "$VERSION" "$(date -u +%FT%TZ)" > dist/version.json
echo "构建完成：版本 $VERSION"

if [ "$DRY" = 1 ]; then echo "（dry-run，不上传）"; exit 0; fi
: "${DEPLOY_TARGET:?请设置 DEPLOY_TARGET，例如 user@host:/data/games/fighter2}"

rsync -az --delete dist/ "$DEPLOY_TARGET/"
echo "已上传到 $DEPLOY_TARGET"

if [ -n "${SITE_URL:-}" ]; then
  sleep 1
  ONLINE=$(curl -fsS "${SITE_URL%/}/version.json?t=$(date +%s)" || true)
  if echo "$ONLINE" | grep -q "\"$VERSION\""; then
    echo "✅ 线上已是 $VERSION：$SITE_URL"
  else
    echo "❌ 线上版本不一致：$ONLINE"; exit 1
  fi
fi
