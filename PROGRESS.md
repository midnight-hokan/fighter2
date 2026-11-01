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
| P0 角色身份重设 + A1 帧 | 身份数据/故事字段 ✅ 9e28b04；8 张新立绘 ✅ 9e7f9f8/35678ea；21:10 复核 c04/c05/c07 配色+性别修复+3 新立绘 ✅ f17f99c；c01 林啸 85 帧精简版新管线重做（亮底+BiRefNet+每帧质检，抠图测试过）✅ 16bfa65；c02–c08 lite 批量 85 帧/人全部完成（15:21–17:19，c04/c06/c08 缺 8 帧 SEED_SALT 换簇补齐）✅ 1825661/190222f/5e760a7/fefcef8/8fd540e/085a280/36969fb | 见提交 |
| A1 帧清理（INBOX 23:45） | ✅ 完成：c01 全帧重生 SALT 1/2/3（7520f02）85帧0问题帧0缺帧；c02–c08 cleanup-frames.py despill+scale/脚底对齐后 atlas 重打包（f47d335），A1 单测绿 | 7520f02/f47d335 |
| C2 过场美术（INBOX 20:30） | ✅ 完成：32 场景图 + 32 表情立绘全部就位（img2img 第二批重绘 + 救援裁切 + c01 底图切换修 c01_hurt 偏色），C2 3/3 绿，c01–c08 montage 视觉复验全过 | 完成 |

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
- A1 P0 22:05 完成（16bfa65）：c01 林啸 85 帧精简版按新管线重做——纯色亮底生成 + BiRefNet 抠图（birefnet.safetensors 444MB 已就位 ComfyUI models/background_removal/）+ 保存抠图前原图（art-work/raw/c01/，以后只重抠不重生成）+ 每帧 5 项质检（骨架残留 IoU<0.06 / 不透明面积 / 全身 / 主色 Δ≤75 / 高度比）。INBOX 原"高度与 idle 首帧差 >15%"对倒地/蹲踢/跳击/必杀全部误杀（实测 knockdown 774 vs 984、xuanfeng 腾空劈叉同骨架两帧 731 vs 942），放宽为"对 idle_00 比例 [0.45,1.30]"只抓 gross 漂移，其余 4 项不变。`npx playwright test tests/e2e/a1-sprites.spec.js -g 抠图` 通过（c01 中位 25.4% / p10 20.8%），游戏内截图确认身体完整、抠图干净（docs/art-review/c01-ingame-fixed.png + c01-atlas-preview.png）。坑：vite preview 服务 dist/ 不是 public/，改 public/assets 后必须 npm run build 再跑 e2e（首次测试误报 1.6% 即此因）。
- A1 批量恢复（15:21，proc_22369b94cf97）：c02–c08 按新管线各 85 帧，run-lite-frames.sh（帧级心跳 + 逐人 pack-atlas/提交，缺帧跳过提交待人工）。启动前清掉旧管线坏帧 52 张（c02 39 + c03 13）。起跑正常（c02 ~8s/帧、高度 945–967 一致、无失败），预计 ~2h。完成后需补 npm run build + 全量 check。
- 19:15 双会话检查结论（INBOX 第 9 条）：两个同时计时（75/127 min）发生在 c01 198 帧全量批期间——当时出帧管线无心跳，看门狗预检(b)心跳过期误判"无人处理"拉起续跑会话，与未退出的旧会话撞车。修复：35678ea gen_frames.py 每帧 touch 心跳 + 5ae16c6 run-lite-frames.sh 脚本级心跳守护（5min/touch，退出 trap 杀）。修复后 c01 85 帧重做（14:27–14:59 约 35min）与当前 c02–c08 批量（15:21 起）全程心跳新鲜，看门狗 */30 预检(b)正确判断"续跑进行中"未再起第二会话。复发排查：对 .check/heartbeat mtime 与看门狗 cron 日志。
- P1-6 超必杀指令验证完成（9e28b04）：8 超必杀全部标准写法（236236P×3 / 214214P×3 / 236236K×2），全仓无 6321463214/623623/214236 残留，R1 矩阵全在 20–80。P1-5 只完成一半：普通技招式名已按角色设定起（9e28b04），按流派差异化数值 + 可选"每人 1–2 特殊技"未做，按 13:50 优先级排 A2/A3 之后。
- A1 lite 批量完成（15:21–17:19，proc_22369b94cf97）：c02/c03/c05/c07 85/85 一次过提交（1825661/190222f/5e760a7/fefcef8）；c04 缺 3 帧（gc_00/cr_lk_01/denghua_00）、c06 缺 1 帧（roll_01）、c08 缺 4 帧（walkb_02/st_lk_01/cr_lk_01/j_mk_01），均 4 次未过验收（主因种子簇：骨架残留/头盔色擦边 80>80）。发现 gen_frames seed 是确定性的（crc32(anim+i) 推导），直接重跑会复现同批失败图 → 加 SEED_SALT 环境变量换簇（a17b39d）+ run-lite-retry.sh 多轮只补缺帧：round1(salt=1) 补 7 帧，c04 gc_00 仍头盔色偏差，round2(salt=2) 一次过。c04/c06/c08 pack-atlas+montage 提交（8fd540e/085a280/36969fb）。至此 8 人 ×85 帧全部到位。
- 全量 check（build 后，17:30）：E1–E8、R1–R4、A1 6/6、A2 4/4、A3 4/4、C1 5/5、C3 4/4 全绿；C2 过场美术 0/3（下一里程碑，未开工）。dist JS 96.5→126.5kB（7 个新 atlas 入库）。
- [2026-11-01] A1 帧清理收尾：c02–c08 本地清理帧（18:14–18:25 despill+脚底对齐）重打包 atlas 提交（f47d335），a1-sprites 单测 4/4 绿。
- [2026-11-01] C2 初批 32 场景图+32 表情立绘生成完毕（gen-c2.py+rescue-portraits.py 兜底 11 张），21:36 全量 check 全绿（C2 3/3）。视觉 QC（8 张 montage）：场景 6/6 抽检过（c08_end 记录本伪文字可接受）；立绘 26/32 不合格——系统性问题：无帽角色（c03/c05/c06/c07）被模型加帽、c03_angry 换绿夹克脸崩、c07_smug 变仙女、c01_hurt/c04_hurt 全身图混入半身位、c02_angry 糊图白边。根因：edit-plus+空 latent denoise=1.0 身份软约束太弱。修：gen-c2b.py img2img（定稿立绘预裁半身 768×1024→VAEEncode→Edit-2511 denoise 0.6→BiRefNet→verify_portrait QC），c02 改用初批合格露脸立绘原图做底（定稿戴面罩）。重生成 26 张进行中。
- [2026-11-01] C2 过场美术完成（cd1cd21）：第二批 img2img 重绘 24 张中 23 张 QC 通过；c01_hurt 根因=底图 c01_normal 钢蓝工作服饱和度不足（对定稿色相 0.48<0.70）img2img 继承偏色，换初批合格 c01_angry（0.808）做底一次通过；裁切改头顶→腰自然宽幅 + letterbox 768×1024（道具撑宽 bbox 硬压 3:4 会贴边）。22:34 全量 check 全绿（E1–E8/R1–R4/A1/A2/A3/C1–C3/U1，C2 3/3）。c05–c08 montage 视觉复验通过（同一人一致性/表情对应/无崩坏/无贴边全 OK；c08 normal 与 smug 区分度略低可接受）。c01 帧"绿染"核查：深色像素色相 84% 在 200–240°（蓝系，裤子本就是蓝），仅 idle_00 局部 ~0.15% 溢色（即 Claude 06:20 指的肩/手绿残影）；despill 原型 .check/despill-proto.py 已备好未上——A1 已过验收且 128px 游戏内影响极小，低优先留后续清理轮。
