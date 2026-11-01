# 卡点记录

（格式：日期 · 里程碑 · 测试名 · 报错原文 · 试过的办法 · 当前状态）

2026-11-01 · R3 · （环境问题，非代码 bug）· node_modules 软链自指死循环 ·
`ls node_modules/` → "Too many levels of symbolic links"（ELOOP）；`npx vitest` 找不到本地依赖。
97da7f4 提交的 `node_modules -> ../fighter2/node_modules` 从仓库根目录解析就是指向自己。
试过的办法：`git update-index --skip-worktree node_modules` + 删除软链 + `npm ci`（40 包，vitest/playwright 恢复），本地已可正常跑测试；skip-worktree 是本地的，不影响仓库。
当前状态：本地已绕过；请确认这个软链的意图（是不是想指向别的目录？），若是失误建议 `git rm node_modules` 并加进 .gitignore，避免下轮 pull 再炸。
