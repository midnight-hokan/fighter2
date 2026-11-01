#!/usr/bin/env node
// 生成 tests.lock（受保护文件的 sha256）。
// ⚠️ 只有光哥 / 框架作者可以运行。大炮不得运行本脚本，不得修改 tests.lock。
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap(n => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const files = [
  ...walk('tests'),
  'scripts/check.mjs',
  'scripts/lock-tests.mjs',
  'playwright.config.js',
  'vite.config.js',
].sort();

const out = { note: '受保护文件清单，由 npm run lock-tests 生成。大炮不得修改。', files: {} };
for (const f of files) out.files[f] = createHash('sha256').update(readFileSync(f)).digest('hex');
writeFileSync('tests.lock', JSON.stringify(out, null, 2) + '\n');
console.log(`已锁定 ${files.length} 个文件`);
