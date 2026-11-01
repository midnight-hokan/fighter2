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
