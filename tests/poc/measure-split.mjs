// v3 图集分包 PoC：实测加载耗时（首屏 vs 按需）。
// 用法：node tests/poc/measure-split.mjs
// 起一个临时静态服务器（docs/poc-split，端口 8099），playwright 冷缓存跑 3 次取中位数。
// 场景：baseline（单体图集）/ 首屏 core / 按需 skill / 按需 express，HD(256px) + SD(160px) 各一套。
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 8099;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', 'docs/poc-split'], { stdio: 'ignore' });
await sleep(800);

let browser;
try {
  browser = await chromium.launch();
} catch {
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
}
async function measure(file) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/`); // 同源，避免 CORS
  const r = await page.evaluate(async (f) => {
    const t0 = performance.now();
    const buf = await (await fetch(f)).arrayBuffer();
    const t1 = performance.now();
    const bmp = await createImageBitmap(new Blob([buf], { type: 'image/webp' }));
    const t2 = performance.now();
    const { bytes, w, h } = { bytes: buf.byteLength, w: bmp.width, h: bmp.height };
    bmp.close();
    return { bytes, fetchMs: t1 - t0, decodeMs: t2 - t1, w, h, ram: w * h * 4 };
  }, file);
  await ctx.close();
  return r;
}

const scenarios = [
  ['baseline-hd  单体图集 330帧', '/c04/baseline-hd.webp'],
  ['首屏-hd      core 188帧    ', '/c04/hd/c04-core.webp'],
  ['按需-hd      skill 118帧   ', '/c04/hd/c04-skill.webp'],
  ['按需-hd      express 24帧  ', '/c04/hd/c04-express.webp'],
  ['baseline-sd  单体图集 330帧', '/c04/baseline-sd.webp'],
  ['首屏-sd      core 188帧    ', '/c04/sd/c04-core.webp'],
  ['按需-sd      skill 118帧   ', '/c04/sd/c04-skill.webp'],
  ['按需-sd      express 24帧  ', '/c04/sd/c04-express.webp'],
];

const out = [];
for (const [label, file] of scenarios) {
  const runs = [];
  for (let i = 0; i < 3; i++) runs.push(await measure(`http://127.0.0.1:${PORT}${file}`));
  const med = (xs) => xs.sort((a, b) => a - b)[1];
  const m = {
    label,
    KB: Math.round(med(runs.map((r) => r.bytes)) / 1024),
    fetch_ms: +med(runs.map((r) => r.fetchMs)).toFixed(1),
    decode_ms: +med(runs.map((r) => r.decodeMs)).toFixed(1),
    total_ms: +med(runs.map((r) => r.fetchMs + r.decodeMs)).toFixed(1),
    ram_MB: +(med(runs.map((r) => r.ram)) / 1048576).toFixed(1),
    dims: `${runs[0].w}x${runs[0].h}`,
  };
  out.push(m);
  console.log(`${m.label}: ${m.KB}KB  fetch=${m.fetch_ms}ms  decode=${m.decode_ms}ms  总=${m.total_ms}ms  解码后内存=${m.ram_MB}MB (${m.dims})`);
}
await browser.close();
srv.kill();
console.log('\nJSON:');
console.log(JSON.stringify(out, null, 2));
