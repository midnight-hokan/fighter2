// 浏览器测试辅助（受保护，不得修改）
import { deflateSync } from 'node:zlib';

export function trackErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

export async function openTestMode(page) {
  await page.goto('/?test=1');
  await page.waitForFunction(() => !!window.__game);
}

export async function startFromMenu(page, { modeSteps = 0 } = {}) {
  await page.goto('/');
  await page.getByTestId('title-screen').waitFor();
  await page.keyboard.press('Enter');
  await page.getByTestId('select-screen').waitFor();
  for (let i = 0; i < modeSteps; i++) await page.keyboard.press('KeyE');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.isRunning());
}

// 画布像素统计。region 用逻辑坐标（384×224），按高清画布的倍数换算成像素区域
export async function canvasStats(page, region) {
  return page.evaluate((r) => {
    const c = document.getElementById('scene');
    const ctx = c.getContext('2d');
    const k = c.width / 384;
    const { x = 0, y = 0, w = 384, h = 224 } = r ?? {};
    const d = ctx.getImageData(Math.round(x * k), Math.round(y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))).data;
    let sum = 0, sum2 = 0, rs = 0, gs = 0, bs = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      sum += l; sum2 += l * l; rs += d[i]; gs += d[i + 1]; bs += d[i + 2];
    }
    return { variance: sum2 / n - (sum / n) ** 2, mean: [rs / n, gs / n, bs / n], width: c.width, height: c.height, logical: [c.width / k, c.height / k], k };
  }, region);
}

// 生成纯色 PNG（用于精灵图测试）
export function solidPng(width, height, [r, g, b, a = 255]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const row = Buffer.alloc(1 + width * 4);
  for (let x = 0; x < width; x++) row.set([r, g, b, a], 1 + x * 4);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
