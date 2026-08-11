import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
const out = process.argv[2] ?? 'artifacts/validation/build181-revocation-sync-durability-syntax.json';
const require = createRequire(import.meta.url);
const ts = require(join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'typescript'));
const checks = [];
const check = (name, ok, detail) => checks.push({ name, status: ok ? 'PASS' : 'FAIL', ...(detail ? { detail } : {}) });
for (const path of ['apps/desktop/src/main/secure-revocation-sync-state.ts', 'apps/desktop/src/main/secure-revocation-sync-service.ts', 'apps/desktop/src/main/main.ts', 'apps/desktop/src/renderer/App.tsx', 'packages/domain/src/app-data.ts']) {
  const source = await readFile(path, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, jsx: ts.JsxEmit.ReactJSX, strict: true }, reportDiagnostics: true, fileName: path });
  const errors = (result.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error);
  check(`${path} transpiles`, errors.length === 0, errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, ' ')).join('; '));
}
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const activeBuild = Number.parseInt(packageJson.version.split('-').at(-1) ?? '', 10);
check('package version preserves Build 181 or later continuity', Number.isInteger(activeBuild) && activeBuild >= 181);
const preflight = JSON.parse(await readFile('config/source-preflight-checks.json', 'utf8'));
check('preflight configuration parses', Array.isArray(preflight.checks));
const failures = checks.filter(item => item.status === 'FAIL');
const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', build: activeBuild, baselineBuild: 181, status: failures.length ? 'FAIL' : 'PASS', checks: checks.length, passed: checks.length - failures.length, failures, scenarios: checks, generatedAt: new Date().toISOString() };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) { console.error(JSON.stringify(report, null, 2)); process.exit(1); }
console.log(`Build 181 revocation sync durability syntax: PASS (${checks.length}/${checks.length})`);
