#!/usr/bin/env node
// 统一自检：npm run check [-- --upto E8]
//   1. 校验测试文件未被改动（对照 tests.lock）
//   2. 构建
//   3. 单元测试（Vitest）+ 浏览器测试（Playwright）
//   4. 按里程碑汇总，打印状态表，写入 .check/status.json
// 退出码：带 --upto Mk 时，E1..目标 全绿才为 0；不带时，全部里程碑全绿才为 0。
// ⚠️ 本文件受 tests.lock 保护，不得修改。
import { execSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { basename } from 'node:path';

const MILESTONES = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'R1', 'R2', 'R3', 'R4', 'A1', 'A2', 'A3'];
const NAMES = {
  E1: '输入解析', E2: '普通技/防御', E3: '投技/气绝', E4: '必杀技', E5: '气槽(KOF97)', E6: '回合', E7: '电脑对手', E8: '界面/渲染',
  R1: '8人阵容', R2: '场景/音乐', R3: '街机模式', R4: '收尾交付',
  A1: '角色美术', A2: '场景美术', A3: '音乐音效',
};
const uptoArg = process.argv.indexOf('--upto');
const upto = uptoArg > 0 ? process.argv[uptoArg + 1]?.toUpperCase() : null;
if (upto && !MILESTONES.includes(upto)) { console.error(`--upto 参数无效：${upto}`); process.exit(2); }

mkdirSync('.check', { recursive: true });
const log = (...a) => console.log(...a);
// eslint-disable-next-line no-control-regex
const stripAnsi = (s) => String(s ?? '').replace(/\x1b\[[0-9;]*m/g, '');
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');

// ---------- 1. 测试完整性 ----------
log('== 1/4 校验测试文件完整性 ==');
if (!existsSync('tests.lock')) { log('❌ 缺少 tests.lock'); process.exit(1); }
const lock = JSON.parse(readFileSync('tests.lock', 'utf8'));
const tampered = [];
for (const [file, hash] of Object.entries(lock.files)) {
  if (!existsSync(file)) tampered.push(`${file}（被删除）`);
  else if (sha(file) !== hash) tampered.push(`${file}（内容被改动）`);
}
if (tampered.length) {
  log('❌ 受保护的测试/配置文件被改动，自检直接判定失败：');
  tampered.forEach(t => log('   - ' + t));
  log('   用 git checkout -- <文件> 恢复。验收标准不能改，只能改实现。');
  process.exit(1);
}
log(`✅ ${Object.keys(lock.files).length} 个受保护文件完好`);

// ---------- 2. 构建 ----------
log('== 2/4 构建 ==');
const build = spawnSync('npx', ['vite', 'build'], { encoding: 'utf8' });
if (build.status !== 0) {
  log('❌ 构建失败：');
  log((build.stdout + build.stderr).split('\n').slice(-30).join('\n'));
  writeFileSync('.check/status.json', JSON.stringify({ build: false }, null, 2));
  process.exit(1);
}
log('✅ 构建成功');

// ---------- 3. 测试 ----------
log('== 3/4 单元测试 ==');
rmSync('.check/unit.json', { force: true });
spawnSync('npx', ['vitest', 'run', '--reporter=json', '--outputFile=.check/unit.json'], { encoding: 'utf8' });
log('== 4/4 浏览器测试 ==');
rmSync('.check/e2e.json', { force: true });
const e2e = spawnSync('npx', ['playwright', 'test', '--reporter=json'], {
  encoding: 'utf8',
  env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: '.check/e2e.json' },
  maxBuffer: 64 * 1024 * 1024,
});

// ---------- 汇总 ----------
const results = []; // { m, file, title, ok, msg }
const msOf = (file) => (basename(file).match(/^([era]\d)-/i)?.[1] ?? '').toUpperCase();

if (existsSync('.check/unit.json')) {
  const u = JSON.parse(readFileSync('.check/unit.json', 'utf8'));
  for (const tr of u.testResults ?? []) {
    const m = msOf(tr.name);
    if (!tr.assertionResults?.length) {
      results.push({ m, file: tr.name, title: '(文件加载失败)', ok: false, msg: tr.message || '' });
    }
    for (const a of tr.assertionResults ?? []) {
      results.push({ m, file: tr.name, title: a.fullName || a.title, ok: a.status === 'passed', msg: (a.failureMessages ?? []).join('\n') });
    }
  }
} else {
  log('⚠️ 未生成单元测试报告');
}

let e2eFatal = '';
if (existsSync('.check/e2e.json')) {
  const p = JSON.parse(readFileSync('.check/e2e.json', 'utf8'));
  const walk = (suite, file) => {
    const f = suite.file || file;
    for (const spec of suite.specs ?? []) {
      const msg = spec.tests?.flatMap(t => t.results?.map(r => r.error?.message ?? '') ?? []).join('\n') ?? '';
      results.push({ m: msOf(f), file: f, title: spec.title, ok: !!spec.ok, msg });
    }
    for (const s of suite.suites ?? []) walk(s, f);
  };
  (p.suites ?? []).forEach(s => walk(s, s.file));
  if (p.errors?.length) e2eFatal = p.errors.map(e => e.message).join('\n');
} else {
  e2eFatal = (e2e.stdout + e2e.stderr).split('\n').slice(-20).join('\n');
}
// 浏览器测试整体崩溃（例如找不到 Chrome、预览服务器起不来）：所有浏览器测试按失败计
if (e2eFatal) {
  for (const f of Object.keys(lock.files).filter(f => f.startsWith('tests/e2e/'))) {
    if (!results.some(r => r.file.endsWith(basename(f)))) {
      results.push({ m: msOf(f), file: f, title: '(浏览器测试未能运行)', ok: false, msg: e2eFatal });
    }
  }
}

const table = MILESTONES.map(m => {
  const rs = results.filter(r => r.m === m);
  const pass = rs.filter(r => r.ok).length;
  return { m, name: NAMES[m], pass, total: rs.length, green: rs.length > 0 && pass === rs.length };
});
const current = table.find(t => !t.green)?.m ?? null;

log('\n================ 里程碑状态 ================');
for (const t of table) log(`${t.green ? '✅' : '❌'} ${t.m} ${t.name.padEnd(6, '　')} ${t.pass}/${t.total}`);
log('===========================================');

const focus = results.filter(r => !r.ok && r.m === current);
if (focus.length) {
  log(`\n当前里程碑 ${current} 未通过的测试（前 8 条）：`);
  for (const r of focus.slice(0, 8)) {
    log(`  ✗ [${basename(r.file)}] ${r.title}`);
    const first = stripAnsi(r.msg).split('\n').find(l => l.trim()) ?? '';
    if (first) log(`      ${first.trim().slice(0, 300)}`);
  }
}
if (e2eFatal && !results.some(r => r.file.includes('e2e') && r.ok)) {
  log('\n⚠️ 浏览器测试整体未能运行，原因：');
  log(stripAnsi(e2eFatal).split('\n').slice(0, 10).map(l => '   ' + l).join('\n'));
}

let commit = '';
try { commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* 无 git */ }
const status = { time: new Date().toISOString(), commit, current, milestones: table, upto };
writeFileSync('.check/status.json', JSON.stringify(status, null, 2));

const target = upto ? table.slice(0, MILESTONES.indexOf(upto) + 1) : table;
const ok = target.every(t => t.green);
log(`\n当前里程碑：${current ?? '全部完成'}`);
log(ok ? `结果：✅ 通过${upto ? `（E1–${upto}）` : '（全部）'}` : `结果：❌ 未通过${upto ? `（E1–${upto}）` : ''}`);
process.exit(ok ? 0 : 1);
