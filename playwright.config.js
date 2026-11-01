import { defineConfig } from '@playwright/test';

// 大炮上默认使用系统 Chrome，并强制 WebGL 走 NVIDIA（否则会掉到 SwiftShader 软渲染）。
// 其他机器可用环境变量覆盖：CHROME_PATH=... CHROME_ARGS="--a --b"
const executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const args = process.env.CHROME_ARGS
  ? process.env.CHROME_ARGS.split(/\s+/).filter(Boolean)
  : ['--use-gl=angle', '--use-angle=gl-egl'];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90000,
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 720 },
    launchOptions: { executablePath, args },
    screenshot: 'only-on-failure',
  },
  outputDir: '.check/pw-artifacts',
  webServer: {
    command: 'npx vite preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
