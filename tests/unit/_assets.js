// 资源检查辅助（受保护，不得修改）
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const pub = (p) => `public/${p}`;
export const exists = (p) => existsSync(pub(p));
export const size = (p) => statSync(pub(p)).size;
export const sha = (p) => createHash('sha256').update(readFileSync(pub(p))).digest('hex');

// 读 PNG 文件头里的宽高
export function pngSize(p) {
  const b = readFileSync(pub(p));
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(`${p} 不是 PNG`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

// 读 PNG / JPEG / WebP 的宽高（V2 高清美术允许 jpg/webp 以控制体积）
export function imageSize(p) {
  const b = readFileSync(pub(p));
  if (b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
    throw new Error(`${p} JPEG 读不到尺寸`);
  }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const fmt = b.toString('ascii', 12, 16);
    if (fmt === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (fmt === 'VP8L') { const v = b.readUInt32LE(21); return { width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 }; }
    if (fmt === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  }
  throw new Error(`${p} 不是 PNG/JPEG/WebP`);
}
