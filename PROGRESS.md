# 进度

| 里程碑 | 状态 | commit |
|---|---|---|
| E1–E8 引擎 | ✅ 完成（框架自带，已锁定） | v2 框架 bbaf422 |
| 自动发布 | ✅ 完成：post-commit 钩子（E1–E8 通过才发布）+ deploy.sh 仓库式发布 + 首页入口 + fighter2-web.service(8092) | 1d7e845 |
| R1 8人阵容 | ✅ 完成：7 个原创角色（c02–c08），平衡矩阵 36%–71% 全在 20–80，generator 与 .js 同步 | 见提交 |
| R2 场景/音乐 | ✅ 完成：6 个场景（矿井/灯廊夜市/炭湖夜渡/高炉之巅/星夜矿镇/万人坑斗场），各带专属配色+3 图层+独立 BGM，8 角色均有 stage 主场 | 见提交 |
| R3 街机模式 | ✅ 完成：createArcade 7 战随机对手+难度 easy→hard 递增，3 次接关（对手不变），通关放角色结局；选人页/标题/结算接入 | 0616736 |
| R4 收尾交付 | ✅ 完成：README 正式化（双方键位/手柄/气槽爆气紧急回避防御反击/8 角色出招表），删占位文件，src 无 TODO，deploy --dry-run 相对路径+version.json | 7855236 |

## 日志

- 框架交付：E1–E8 全绿，R1–R4 测试已写好（预期失败）。
- 自动发布：仓库式链路（rsync → 远端站点仓库 commit+push → hokan-deploy --force → 线上 version.json 校验）已通；本机 8092 预览由 fighter2-web.service 托管（v1 在 8091、8090 是 Hermes 面板，均未动）。线上 https://midnighthokan.com/games/fighter2/
- R1 初版 7 角色（炭守/钢驮/火萤/灯郎/青锋/铜首/灰雁），c02–c08 由 scripts/gen-characters.mjs 生成。
- R1 平衡调参：初版矩阵钢驮 89%、火萤 21% 超界 → 多轮调参（钢驮摔技降伤+减击倒、火萤突进/投技/必杀补强、青锋闪风突补强、铜首重弹落/超必杀降伤、灰雁飞行道具减速+灰鹤蹴改击倒+超必杀降到校验下限 200、烈岩旋风镐补强）。终版矩阵：烈岩 43% / 炭守 54% / 钢驮 71% / 火萤 36% / 灯郎 43% / 青锋 46% / 铜首 57% / 灰雁 50%，全在 20–80。所有数值改动已回写 generator，重新生成校验与 .js 字节一致。r1-roster 11/11 全绿。
- R2：stages.js 扩到 6 场景（保留 s01 废弃矿井，新增 s02 灯廊夜市/s03 炭湖夜渡/s04 高炉之巅/s05 星夜矿镇/s06 万人坑斗场），每场景 2 色天空+地面配色+≥3 图层（mountains/beams/lamps/buildings/pillars/stars/crowd）+独立 BGM（tempo 96–162，key/scale/seed 互不相同）。8 角色各加 stage 主场字段（c02–c08 在 generator 定义里，c01 手改），覆盖全部 6 场景。注意：playwright 跑 8092 的 dist/，改完源码必须先 vite build 再跑 e2e。
- INBOX P0：s06 "万人坑斗场"改名"井下斗场"（74e093f）；名称仅 stages.js 一处，c03/generator 只引用 id，README 与结局无引用。
- R3：src/ui/arcade.js 实现 createArcade（roster 洗牌去玩家、seed 确定性、难度按场次递增、report(win/lose) 状态机、3 次接关、ending() 返回角色结局）；menus.js 加街机模式入口、main.js 对战结束后按 report 结果推进（next/continue/ending 结算屏），结算屏 Enter 回标题。r3-arcade 单测 4/4 + e2e 1/1（7 战打通到结局）。
- R4：README.md 按 r4-delivery 要求正式化（KEYMAP 全键位标签+10 个系统关键词+8 角色必杀/超杀全名）；删除 _placeholder.js；src 无 TODO；deploy.sh --dry-run 通过（version.json+相对路径）。r4-delivery 单测 4/4 + e2e 3/3（8 对 AI 快打无报错、Esc 出招表、bench 中位数 <8ms）。
- 环境坑：97da7f4 引入的 node_modules 软链自指死循环（ELOOP），本地 skip-worktree + npm ci 绕过，已记 BLOCKERS.md（8485817）。
- 全量 check：E1–E8 + R1–R4 全绿，"结果：✅ 通过（全部）"。网站 https://midnighthokan.com/games/fighter2/ 已更新至 7855236。
