import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const out = process.argv[2] ?? 'artifacts/validation/build175-maintenance-recovery-security-epoch-syntax.json';
const temp = resolve('.tmp/build175-security-epoch-syntax');
const scriptFiles = [
  'scripts/verify-build175-maintenance-recovery-security-epoch-contract.mjs',
  'scripts/verify-build175-maintenance-recovery-security-epoch-runtime.mjs',
  'scripts/verify-build175-maintenance-recovery-security-epoch-syntax.mjs'
];
const sourceFiles = [
  'packages/application/src/security-epoch.ts',
  'packages/application/src/auth-use-cases.ts',
  'packages/database/src/family-database-migrations.ts',
  'packages/repositories/src/account-repository.ts',
  'packages/repositories/src/trusted-device-repository.ts',
  'apps/desktop/src/main/main.ts',
  'apps/desktop/src/main/data-store.ts',
  'apps/desktop/src/renderer/App.tsx'
];
const sourceText = Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => [file, await readFile(file, 'utf8')])));
const checks = [];
const run = (name, fn) => {
  try { fn(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error instanceof Error ? error.message : String(error) }); }
};
for (const file of scriptFiles) run(`node syntax ${file}`, () => execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }));
await rm(temp, { recursive: true, force: true });
await mkdir(temp, { recursive: true });
run('pure security epoch TypeScript compile', () => execFileSync('tsc', ['packages/application/src/security-epoch.ts', '--target', 'ES2024', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--strict', '--skipLibCheck', '--outDir', temp], { stdio: 'pipe' }));
for (const file of sourceFiles) {
  run(`source present ${file}`, () => {
    const value = sourceText[file];
    if (!value.trim()) throw new Error('Source file is empty.');
    if (value.includes('\u0000')) throw new Error('Unexpected NUL byte.');
  });
}
const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', build: 175, status: failures.length ? 'FAIL' : 'PASS', checks: checks.length, fileCount: scriptFiles.length + sourceFiles.length, passed: checks.length - failures.length, failures, generatedAt: new Date().toISOString() };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) { console.error(JSON.stringify(report, null, 2)); process.exit(1); }
console.log(`Build 175 security epoch syntax: PASS (${checks.length}/${checks.length})`);
