# 进度

| 里程碑 | 状态 | commit |
|---|---|---|
| E1–E8 引擎 | ✅ 完成（框架自带，已锁定） | v2 框架 bbaf422 |
| 自动发布 | ✅ 完成：post-commit 钩子（E1–E8 通过才发布）+ deploy.sh 仓库式发布 + 首页入口 + fighter2-web.service(8092) | 1d7e845 |
| R1 8人阵容 | ✅ 完成：7 个原创角色（c02–c08），平衡矩阵 36%–71% 全在 20–80，generator 与 .js 同步 | 见提交 |
| R2 场景/音乐 | ✅ 完成：6 个场景（矿井/灯廊夜市/炭湖夜渡/高炉之巅/星夜矿镇/万人坑斗场），各带专属配色+3 图层+独立 BGM，8 角色均有 stage 主场 | 见提交 |
| R3 街机模式 | ✅ 完成：createArcade 7 战随机对手+难度 easy→hard 递增，3 次接关（对手不变），通关放角色结局；选人页/标题/结算接入 | 0616736 |
| R4 收尾交付 | ✅ 完成：README 正式化（双方键位/手柄/气槽爆气紧急回避防御反击/8 角色出招表），删占位文件，src 无 TODO，deploy --dry-run 相对路径+version.json | 7855236 |
| P1-2 出招指令规范化 | ✅ 完成：425P/425K/624K→421/41236/214，c08 超 214236P→214214P，README 同步，R1 全绿 | 7939765 |
| P1-3 招式命名去重复 | ✅ 完成：5 超必杀去"X龙"+火萤 3 招去撞名，id 不变，README 同步，R1/R4 全绿 | 1e6c4d2 |
| P0 角色身份重设 + A1 帧 | 身份数据/故事字段 ✅ 9e28b04；8 张新立绘 ✅ 9e7f9f8/35678ea；21:10 复核 c04/c05/c07 配色+性别修复+3 新立绘 ✅ f17f99c；c01 林啸 198 帧 pack-atlas ✅ 已提交；c02–c08 按 --lite（85 帧/人）批量后台跑（心跳守护 5ae16c6） | 见提交 |

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
- P1-2 出招指令规范化（7939765）：425P→421P（钢驮碎落/铜首重弹落）、425K→41236K（青锋飞花）、425K→214K（灰雁灰鹤蹴）、624K→214K（铜首重坑踹）；顺手把 c08 超必杀 214236P 统一为 214214P（P1-6 标准清单）。改生成器后重新生成，招式描述随指令修正（"下后上"类错误描述一并纠正）。R1 平衡矩阵 36/50/68/32/39/43/57/75 全在 20–80。
- P1-3 招式命名去重复（1e6c4d2）：地火龙→地火钻、灯花龙→灯花澜、疾风龙→疾风贯针、铜首龙→顶梁破石、灰雁龙→灰雁龙卷；火萤 灯花蹴→萤火蹴、疾风花→窜火踢、花影旋→火灵旋（"灯影"→"火灵"）。"疾风"归青锋、"灯花"归灯郎。招式 id 全部未动（A1 精灵图按 id 对应）。
- 看门狗：fighter2-watchdog cron（*/30 * * * *，job 1ca6d359ae41）已装，预检 is_processing/心跳 10 分钟/status null+INBOX 全✅（全完成则自删除），续跑走 TASK.md 第 8+10 节。
- A1–A3 美术/音乐框架（Claude 6a51015）：A1 精灵图集/A2 场景图片层/A3 音乐音效验收测试已锁定；scripts/art 流水线（export-poses→render-poses→出帧→抠图→pack-atlas）；场景 kind:'image' 视差图层；音频文件播放（失败回退合成音）。优先级：A1→A2→A3 先于剩余 P1（P1-5 普通技差异化、P1-6 超必杀指令统一排到 A3 后）。
- P0 角色身份重设（INBOX 19:30–19:58）：8 人改为黑岭煤矿岗位（林啸/罗铮/雷钧/严正/苏红/方萤/霍兰/沈清），只换身份外形不动玩法（流派/招式 id/指令/帧数据/平衡全保留）。改动：name/title/style/colors/ending + 新增 intro/story 字段（docs/故事设定.md）+ 全部招式 name/desc 按定名表（19:45）+ 普通技按角色改名；c07 霍兰最终版=澡堂管理员（19:58，食堂大厨作废）。街机：第 1 战开场白 intro+story（Enter 跳过）、横幅带对手身份、第七战固定沈清（玩家选沈清则对林啸，theme.finalBoss）。旧身份帧 527 张已删，art-work/poses 8 个 json 的 name/style/colors 同步。9e28b04 后 check E1–E8+R1–R4+A2+A3 全绿（A1 待新立绘）。8 张定稿立绘视觉 QC 选优 9e7f9f8（c01=00007 c02=00006 c03=00006 c04=00007 c05=00006 c06=00007 c07=00005 c08=00007）。c01 198 帧生成中（gen_frames 管线 v2，立绘+骨架线→Edit-2511→程序化验收→rembg）。
- A1 c01 林啸 198 帧全帧完成：pack-atlas → public/assets/meilong/c01/atlas.png（2048×1664，40 动画）+ docs/art-review/c01-frames.png 对比图（idle/walkf/st.hp/cr.hk/4 必杀各 2–3 帧）已提交。c02–c08 按 INBOX 20:05 用 `--lite`（85 帧/人）批量跑；c07 霍兰立绘已按"新立绘复核"重出（澡堂管理员、无违规内容）。
- A1 21:10 复核（f17f99c）：c04 严正（亮黄反光马甲 #f0c020+卡其，保白帽）/c05 苏红（红短夹克 #c0392b+深色长裤，style 补"女性"）/c07 霍兰（深绿防水胶围裙 #356e46+白，style 补"中年女性"）配色+性别修正。3 张新定稿立绘 c04#10/c05#13/c07#12（vision 挑定：全身+性别正确+道具齐全；c05 选"一手持喇叭+举拳"而非双手握喇叭，更贴格斗架势）。8 人 primary 互不撞车。
- A1 lite 批量启动（5ae16c6 + 后台运行中）：run-lite-frames.sh 加心跳守护（批量运行期间每 5min touch .check/heartbeat，退出 trap 杀守护），防看门狗预检(b)心跳过期误判"无人处理"而另起续跑撞车。c02–c08 各 85 帧，逐人 pack-atlas+提交（post-commit 自动发布），可断点续跑（gen_frames 跳过已存在帧，缺帧跳过提交待人工）。后台 session 跑，完成自动通知。
