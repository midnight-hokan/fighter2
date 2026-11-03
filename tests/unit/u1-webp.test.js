import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, statSync, globSync } from 'node:fs';

// U1 手机/慢网：大图都要有最新的 WebP 副本（运行时优先加载 webp，约为 PNG 的十分之一）
describe('U1 慢网加载', () => {
  it('图集、立绘、场景图、场景条带都有最新的 webp 副本（PNG 改了要重新生成：python3 scripts/assets-webp.py）', () => {
    let out = '';
    try { execSync('python3 scripts/assets-webp.py --check', { stdio: 'pipe' }); } catch (e) { out = String(e.stdout); }
    expect(out, out).toBe('');
  });

  it('webp 总体积不超过 25MB，单张图集 webp 不超过 2MB', () => {
    const files = globSync('public/assets/**/*.webp');
    const total = files.reduce((a, f) => a + statSync(f).size, 0);
    expect(total / 1e6).toBeLessThan(25);
    for (const f of files.filter(f => /\/c0\d\/atlas\.webp$/.test(f))) expect(statSync(f).size, f).toBeLessThan(2e6);
    expect(readFileSync('public/assets/webp-manifest.json', 'utf8').length).toBeGreaterThan(10);
  });
});
