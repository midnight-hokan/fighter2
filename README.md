# 煤龙拳 v2（开发版）

2D 像素格斗游戏，玩法参照超级街霸2X，气槽系统参照 KOF97 ADVANCED。纯网页，浏览器直接玩。

```bash
npm ci
npm run dev          # 开发服务器
npm run check        # 全部自检（E1–E8 引擎、R1–R4 内容）
npm run shot         # 对战截图
npm run deploy       # 发布到网站（需要 DEPLOY_TARGET / SITE_URL）
```

`?test=1` 进入测试模式（`window.__game` 调试接口）。F1 显示判定框，F2 切换训练假人，M 静音，Esc 出招表。

键位：P1 WASD 移动，U I O 轻/中/重拳，J K L 轻/中/重脚；P2 方向键移动，小键盘 7 8 9 拳、4 5 6 脚。

文档：`docs/角色数据格式.md`、`docs/精灵图规格.md`。任务说明：`TASK.md`。

（R4 时由大炮改写为正式玩家说明。）
