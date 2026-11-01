# 大炮长任务：《煤龙拳》v2（超级街霸2X 风格 + KOF97 气槽）

项目路径：`~/projects/fighter2`。这是 v1（`~/projects/fighter`）之后的全新版本，2D 像素风，8 名角色。

**引擎已经写完并锁定**（E1–E8 全绿）：输入解析、帧数据、防御、投技、气绝、必杀技、KOF97 气槽（爆气/MAX 超必杀/回避/防御反击）、回合、电脑对手、渲染、界面全部可用。
你的工作是**填内容**：R1 → R2 → R3 → R4，直到 `npm run check` 全部变绿。

全程自动推进：实现 → 自检 → 修复 → 提交 → 下一个里程碑。**不要等光哥确认再继续。**
角色、名字、招式名、美术全部原创，不得使用街霸、拳皇的任何名称和素材。

---

## 一、开工前（只做一次）

```bash
cd ~/projects/fighter2
git init -q 2>/dev/null; git add -A; git commit -qm "v2 框架" 2>/dev/null
npm config set registry https://registry.npmmirror.com
npm ci
npm run check -- --upto E8
```

最后一条必须输出 `结果：✅ 通过（E1–E8）`。这是基线。
基线不通过：把完整输出写进 `BLOCKERS.md`，在 TG 汇报，**不要改测试或配置去绕过**。

然后装好自动发布（见第七节），再开始 R1。

## 二、绝对不能动的文件

`tests/` 下所有文件、`tests.lock`、`scripts/check.mjs`、`scripts/lock-tests.mjs`、`playwright.config.js`、`vite.config.js`。
自检第一步会校验哈希，改了直接判定失败。不要运行 `npm run lock-tests`。

`src/engine/` 是锁定的引擎，**原则上不改**。确实要改（比如发现引擎 bug），commit message 写清楚原因，且 E1–E8 必须仍然全绿。

## 三、里程碑

| 里程碑 | 内容 | 要改的文件 | 验收测试 |
|---|---|---|---|
| R1 8人阵容 | 把 c02–c08 七个占位角色换成原创角色 | `src/theme/meilong/characters/c02.js`…`c08.js`，删除 `_placeholder.js` | `tests/unit/r1-roster.test.js` |
| R2 场景/音乐 | 至少 4 个场景，每个角色有主场 | `src/theme/meilong/stages.js`，每个角色加 `stage` 字段；需要新的背景元素就扩充 `src/render/stage.js` | `tests/unit/r2-stages.test.js`、`tests/e2e/r2-stages.spec.js` |
| R3 街机模式 | 一人打 7 场、难度递增、接关、结局 | 新建 `src/ui/arcade.js`，改 `src/ui/menus.js`、`src/main.js`（搜索【R3】） | `tests/unit/r3-arcade.test.js`、`tests/e2e/r3-arcade.spec.js` |
| R4 收尾交付 | 正式 README、清 TODO、性能 | `README.md`、全项目 | `tests/unit/r4-delivery.test.js`、`tests/e2e/r4-delivery.spec.js` |

**动手前必读**：`docs/角色数据格式.md`、示例角色 `src/theme/meilong/characters/c01.js`、对应测试文件。测试就是需求。

### R1 要点

- 7 名新角色流派要拉开：至少要有 1 个蓄力型（`charge`，≥2 个蓄力必杀 `[4]6P` / `[2]8K`）、1 个投技型（`grappler`，有 `360` 指令投），全队至少 6 种 archetype，至少 3 人有飞行道具
- 每人 ≥3 个必杀技、≥1 个超必杀；各角色必杀技的输入组合不能雷同，招式名全队唯一
- 主题是"煤龙拳"：矿工、煤、火、地下、工业风，可以自由发挥，但都要原创
- 平衡：测试会让困难电脑每两人互打 4 场，**每个角色总胜率要在 20%–80%**，而且电脑要能用出每个角色的必杀和超必杀。跑不过就调数值（伤害、帧数、血量），不要改测试
- 写完一个角色就 `npx vitest run tests/unit/r1-roster.test.js` 看校验，别攒到最后

### R2 要点

- 每个场景：不同的天空/地面配色、≥3 层背景（`mountains beams lamps buildings pillars stars crowd`）、独立的 bgm（tempo 90–180，互不相同）
- 8 个角色的 `stage` 至少用到 4 个不同场景

### R3 要点

- `createArcade({ roster, player, seed })` 接口见 `tests/unit/r3-arcade.test.js` 顶部注释
- 前 2 场简单、中间普通、最后 2 场困难
- 输了显示"继续？"，Enter 接关（同一个对手重打）
- 结局画面 `data-testid="ending"` 显示该角色的 `ending` 文字，Enter 回标题
- `window.__game.arcade()` 和 `window.__game.arcadeWin()` 是测试接口，见 e2e 测试顶部注释

### R4 要点

- `README.md` 改成正式玩家说明：双方键位、手柄、通用系统（紧急回避、爆气、MAX 超必杀、防御反击）、出招表入口（Esc）、训练模式、街机模式、8 名角色及其必杀技
- `src/` 里不能有 `TODO`；占位文件已删除
- 8 名角色任意组合每帧中位数 < 8ms

## 四、每轮循环

```
1. 读 PROGRESS.md、BLOCKERS.md、git log，确定当前里程碑
2. 读要改的文件和对应测试
3. 实现（终端命令里顺手 touch .check/heartbeat，看门狗靠它判断你还活着）
4. npm run check -- --upto R<n>
5. 失败 → 看输出里"未通过的测试"，修复，回到 4（同一个失败最多 5 次）
6. 通过 → git add -A && git commit -m "R<n>: <一句话>"
7. 更新 PROGRESS.md，单独提交
8. TG 汇报（第六节），不等回复，进入下一个里程碑
```

R1 体量最大，可以每完成 1–2 个角色就提交一次（`R1: 加入 c03 xxx`），提交会自动触发网站更新，光哥能边做边试玩。

## 五、诚实规则（最重要）

- **只有 `npm run check` 的输出能证明完成。** 汇报"完成"必须附上它最后 20 行原文和 commit hash，没有一律视为未完成。
- **不准声称做过没做的事。** 没跑的测试不能说通过，没改的文件不能说改了，没提交的不能说提交了，网站没更新不能说已上线（以 `.check/deploy.log` 为准）。
- 卡住：同一个测试 5 次不过，把测试名、报错原文、试过的办法写进 `BLOCKERS.md`，换思路再试；仍不行就先做下一个里程碑（R3、R4 不依赖 R2 的场景数量），最后回头处理。

## 六、进度汇报（不阻塞）

每完成一个里程碑，往 TG 发：里程碑和一句话内容、commit hash、`npm run check -- --upto R<n> 2>&1 | tail -20` 原文、网站上的版本号（`curl -s $SITE_URL/version.json`）、截图（`npm run shot`，发 `.check/shot.png`）。发完继续。

## 七、自动发布到网站

光哥直接在网站上测试，所以**每次提交后自动发布**，但只发布引擎自检通过（E1–E8 全绿）的版本：

1. 先查清楚 v1 现在是怎么上线到 midnighthokan.com 的（看 `~/projects/fighter` 的 git hooks、脚本、crontab，以及网站那台机器的 Caddy 配置和网站目录）。v2 用同样的方式，发布到**新的子路径**（例如 v1 是 `/fighter/` 就用 `/fighter2/`），不要覆盖 v1。
2. 写 `~/.fighter2-deploy.env`：
   ```
   DEPLOY_TARGET=<用户>@<主机>:<网站目录>/fighter2
   SITE_URL=https://midnighthokan.com/<路径>/
   ```
3. 手动跑一次 `set -a; . ~/.fighter2-deploy.env; set +a; bash scripts/deploy.sh`，必须输出 `✅ 线上已是 <版本>`
4. 装钩子：`ln -sf ../../scripts/post-commit.sh .git/hooks/post-commit`
5. 在网站首页（v1 的入口旁边）加一个 v2 的入口链接
6. 本机预览服务：`npm run serve` 用 8092 端口（8091 是 v1 的服务，8090 是 Hermes 面板，都不要动）。可以照 v1 的 `fighter-web.service` 做一个 `fighter2-web.service`

做完第 3 步后在 TG 汇报网址。之后每次提交，`.check/deploy.log` 会记录发布结果。

## 八、崩溃续跑

被中断后第一件事：读 `PROGRESS.md`、`BLOCKERS.md`、`git log --oneline | head -20`，跑一次 `npm run check` 看真实状态，从断点继续。以 `npm run check` 输出为准，不以记忆为准。每完成一小步就提交。

## 九、最终交付

`npm run check` 输出 `结果：✅ 通过（全部）` 后：确认网站已是最新版本，TG 发交付报告（每个里程碑的 commit hash、check 最后 20 行、网站地址和版本号、BLOCKERS.md 里没解决的问题、已知缺陷）。然后等光哥试玩反馈。

## 附：美术

光哥会用本地模型生成精灵图，接入规格见 `docs/精灵图规格.md`。没有精灵图的角色自动用火柴人占位，**你不需要做美术**，但写角色时 `style` 字段要写清楚外观（光哥会拿它当提示词）。
