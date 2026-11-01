#!/usr/bin/env node
// 生成一张对战截图：npm run shot [-- 输出路径 [p1角色id p2角色id]]   默认 .check/shot.png
// 用于进度汇报。需要先 npm run build。
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const out = process.argv[2] || '.check/shot.png';
const [p1, p2] = [process.argv[3], process.argv[4]];
mkdirSync('.check', { recursive: true });
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://127.0.0.1:4174/?test=1');
  await page.waitForFunction(() => window.__game);
  await page.evaluate(() => window.__game.assetsReady?.());
  await page.evaluate(([a, b]) => {
    const g = window.__game;
    const ids = g.roster();
    g.reset({ p1: a || ids[0], p2: b || ids[1], p1x: 350, p2x: 418 });
    g.input(0, { right: true }, 8);
    g.input(0, { hp: true }, 1);
    g.input(1, { mk: true }, 1);
    g.step(14);
  }, [p1, p2]);
  await page.screenshot({ path: out });
  await browser.close();
  console.log(`截图已保存：${out}`);
} finally {
  server.kill();
}
