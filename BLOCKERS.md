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
- [2026-11-03 00:57 UTC cron 00:30 轮] 让行轮：①杀掉僵尸心跳守护 PID 1391314（Nov02 23:28 起的 60s touch 死循环，曾把预检 (b) 永久打成 FRESH，已 SIGKILL）；②发现 TG 会话 d0126e 的后台 worker PID 1397578（frame-qc.py 全量 8 人质检，00:46 起，约 01:00–01:05 跑完，即 INBOX 06:20 第一步）。接管/让行判据与 s2/s3 步骤见 .check/note-cron-0030.md。
- [2026-11-03 02:05 UTC cron 02:00 轮] 让行轮：worker PID 1397578 已死并产出第一轮全量报告（frame-qc-report.json 01:38:45，1632 帧）；TG 会话 20261103_01432 于 01:51 跑 despill 后 01:52:23 启动第二轮 QC 复验（PID 1402118，c01–c03 蒙太奇已出，预计 c08 约 02:12–02:15），该会话 01:53 迭代预算用尽 idle、worker 仍活。无代码改动、无 commit、未动 heartbeat。s2 修复脚本（despill-frames.py / fix-frames-qc.py）已写好未提交未验证。三分支接管判据（owner 复活→继续让行 / 产物齐→按报告 s2/s3 / 产物缺→重跑 QC）见 .check/note-cron-0200.md。
