# 卡点记录

（格式：日期 · 里程碑 · 测试名 · 报错原文 · 试过的办法 · 当前状态）

2026-11-01 · R3 · （环境问题，非代码 bug）· node_modules 软链自指死循环 ·
`ls node_modules/` → "Too many levels of symbolic links"（ELOOP）；`npx vitest` 找不到本地依赖。
97da7f4 提交的 `node_modules -> ../fighter2/node_modules` 从仓库根目录解析就是指向自己。
试过的办法：`git update-index --skip-worktree node_modules` + 删除软链 + `npm ci`（40 包，vitest/playwright 恢复）。
当前状态：✅ 已解决——上游 7a930b6 已 `git rm node_modules` 并加入 .gitignore；本地已清 skip-worktree、`npm ci` 恢复，pull 正常。

- [2026-11-01 19:5x] 旧身份（烈岩等 8 人）的帧/立绘/图集全部作废（INBOX 19:30 角色身份重设）。批量帧生成已停（c01/c02 已完成、c03 到 69 帧时 kill）。本地已删旧 c01 图集与旧 montage，manifest 还原为 {}。
- 当前在跑：身份数据重设（c01–c08 煤矿岗位）→ 8 张新立绘 → A1 先做 c01 林啸。
- [2026-11-01 09:58 UTC cron] 看门狗让位规则 + ComfyUI filename_prefix 竞态坑：见 .check/note-tg-gen.md。帧生成期间不要并行生成或提交。
