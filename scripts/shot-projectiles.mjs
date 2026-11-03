#!/usr/bin/env node
// 生成飞行道具"飞行中"游戏截图拼图：docs/art-review/projectiles.png
// 每个道具：test 模式下触发对应必杀 → 道具飞出后截一帧 → 拼 2×3 图。
// 用法：npm run build 后 node scripts/shot-projectiles.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = 'docs/art-review/projectiles.png';
const SHOTS = [
  { file: 'c01_helmet', label: '林啸 · 矿灯帽', p1: 'c01', move: 'meiyan' },
  { file: 'c02_rope', label: '罗铮 · 救生绳', p1: 'c02', move: 'baokong' },
  { file: 'c02_flare', label: '罗铮 · 信号弹', p1: 'c02', move: 'tanshui' },
  { file: 'c05_banner', label: '苏红 · 安全生产横幅', p1: 'c05', move: 'daiteng' },
  { file: 'c06_lamp', label: '方萤 · 矿灯', p1: 'c06', move: 'jifengdan' },
  { file: 'c08_needle', label: '沈清 · 银针（程序化）', p1: 'c08', move: 'huiyan' },
];

const executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const args = process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(/\s+/).filter(Boolean) : ['--use-gl=angle', '--use-angle=gl-egl'];

const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
try {
  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    try { await fetch('http://127.0.0.1:4174/'); up = true; } catch { await wait(500); }
  }
  if (!up) throw new Error('预览服务器未能启动');
  const browser = await chromium.launch({ executablePath, args });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.goto('http://127.0.0.1:4174/?test=1');
  await page.waitForFunction(() => window.__game);
  await page.evaluate(() => window.__game.assetsReady?.());
  mkdirSync('docs/art-review', { recursive: true });
  const report = [];
  for (const s of SHOTS) {
    const r = await page.evaluate(({ p1, move }) => {
      const g = window.__game;
      g.reset({ p1, p2: 'c03', p1x: 150, p2x: 500 });
      g.input(0, { special: move }, 1);
      let st = g.step(1), tries = 0;
      while (tries < 90 && (st.projectiles.length === 0 || tries < 6)) { st = g.step(1); tries++; }
      return { flying: st.projectiles.length, px: st.projectiles[0] ? Math.round(st.projectiles[0].x) : null, item: g.renderInfo().stats.itemProjectiles ?? 0 };
    }, s);
    await page.screenshot({ path: `/tmp/projshot_${s.file}.png` });
    report.push({ ...s, ...r, ok: r.flying > 0 });
    console.log(`${s.file}: flying=${r.flying} x=${r.px} itemStat=${r.item}`, r.flying > 0 ? 'OK' : '!! 没飞出道具');
  }
  await browser.close();
  const bad = report.filter(r => !r.ok);
  if (bad.length) throw new Error(`${bad.length} 个道具没截到飞行帧：${bad.map(b => b.file).join(', ')}`);
  console.log('6 张飞行截图完成，待拼图 →', OUT);
} finally {
  server.kill();
}
