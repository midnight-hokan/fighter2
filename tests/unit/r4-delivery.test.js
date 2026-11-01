import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { KEYMAP } from '../../src/ui/controls.js';

const walk = (d) => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

describe('R4 收尾与交付', () => {
  it('README 写明双方键位、通用系统、出招表入口', () => {
    const r = readFileSync('README.md', 'utf8');
    for (const map of KEYMAP) {
      for (const code of Object.keys(map)) {
        if (code.startsWith('Arrow')) continue;
        const label = code.replace(/^Key/, '').replace(/^Numpad/, '');
        expect(r, `README 缺少 ${code}`).toContain(label);
      }
    }
    for (const w of ['小键盘', '方向键', '紧急回避', '爆气', 'MAX 超必杀', '防御反击', '出招表', '训练模式', '街机模式', '手柄']) expect(r, w).toContain(w);
  });

  it('README 列出 8 名角色及其必杀技', async () => {
    const { default: theme } = await import('../../src/theme/index.js');
    const r = readFileSync('README.md', 'utf8');
    for (const c of theme.roster) {
      expect(r, c.name).toContain(c.name);
      for (const s of c.specials) expect(r, `${c.name} ${s.name}`).toContain(s.name);
    }
  });

  it('源码中没有 TODO，占位角色文件已删除', () => {
    const left = walk('src').filter(f => /\.(js|css)$/.test(f)).filter(f => /TODO/.test(readFileSync(f, 'utf8')));
    expect(left, left.join(', ')).toEqual([]);
    expect(existsSync('src/theme/meilong/characters/_placeholder.js')).toBe(false);
  });

  it('部署脚本：--dry-run 能构建并生成 version.json，资源用相对路径', () => {
    expect(existsSync('scripts/deploy.sh')).toBe(true);
    rmSync('dist/version.json', { force: true });
    execSync('bash scripts/deploy.sh --dry-run', { stdio: 'pipe', env: { ...process.env, DEPLOY_TARGET: 'dry-run:/tmp/x' } });
    const v = JSON.parse(readFileSync('dist/version.json', 'utf8'));
    expect(v.version).toBeTruthy();
    expect(v.time).toBeTruthy();
    const html = readFileSync('dist/index.html', 'utf8');
    expect(html).not.toMatch(/(src|href)="\/assets/);
  });
});
