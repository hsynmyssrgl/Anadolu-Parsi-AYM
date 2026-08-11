import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const out = process.argv[2] ?? 'artifacts/validation/build177-security-center-menu-syntax.json';
const checks = [];
const check = (name, condition, error) => checks.push({ name, status: condition ? 'PASS' : 'FAIL', ...(condition || !error ? {} : { error }) });
const run = (name, args) => { const result = spawnSync(process.execPath, args, { encoding: 'utf8' }); check(name, result.status === 0, `${result.stdout}\n${result.stderr}`.trim()); };
run('package source controlled TypeScript', ['scripts/verify-package-source-types.mjs']);
run('desktop main controlled TypeScript', ['scripts/verify-desktop-main-source-types.mjs']);
const require = createRequire(import.meta.url);
const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
const ts = require(join(globalRoot, 'typescript'));
for (const [name, path, kind] of [
  ['security center helper TypeScript syntax', 'apps/desktop/src/renderer/security-center-navigation.ts', ts.ScriptKind.TS],
  ['renderer TSX syntax', 'apps/desktop/src/renderer/App.tsx', ts.ScriptKind.TSX]
]) {
  const source = await readFile(path, 'utf8');
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.ES2024, true, kind);
  const diagnostics = sourceFile.parseDiagnostics ?? [];
  check(name, diagnostics.length === 0, diagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));
}
const app = await readFile('apps/desktop/src/renderer/App.tsx', 'utf8');
const systemStart = app.indexOf('function SystemManagementScreen');
const systemEnd = app.indexOf('function PlaceholderScreen', systemStart);
const systemChunk = app.slice(systemStart, systemEnd);
const securityStart = app.indexOf('function SettingsSecurity');
const securityEnd = app.indexOf('function AddMemberModal', securityStart);
const securityChunk = app.slice(securityStart, securityEnd);
check('system component has no removed security props', !/\b(auth|accessibility|onAccessibilityChange|onFamilyDataChanged)\b/.test(systemChunk.split('\n')[0]));
check('system component has no nested security component', !systemChunk.includes('<SettingsSecurity'));
check('security component declares accessibility prop', securityChunk.split('\n')[0].includes('accessibility:AccessibilityPreferences'));
check('security component declares accessibility change callback', securityChunk.split('\n')[0].includes('onAccessibilityChange:(next:AccessibilityPreferences)=>void'));
check('security component receives family refresh callback', securityChunk.split('\n')[0].includes('onFamilyDataChanged:()=>Promise<void>'));
check('security route passes all required props', app.includes('<SettingsSecurity auth={auth} accessibility={accessibility} onAccessibilityChange={setAccessibility} onFamilyDataChanged={refreshFamilyData}/>'));
const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', build: 177, status: failures.length ? 'FAIL' : 'PASS', checks: checks.length, passed: checks.length - failures.length, failures, scenarios: checks, generatedAt: new Date().toISOString() };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) { console.error(JSON.stringify(report, null, 2)); process.exit(1); }
console.log(`Build 177 security center menu syntax: PASS (${checks.length}/${checks.length})`);
