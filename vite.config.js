import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

function version() {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    const hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() ? '+' : '';
    return `${hash}${dirty}`;
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version()) },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
  preview: { port: 4173, strictPort: true, host: '127.0.0.1' },
  test: { include: ['tests/unit/**/*.test.js'], environment: 'node', testTimeout: 120000 },
});
