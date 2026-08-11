import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const reportPath = resolve(option('--report', 'artifacts/validation/build148-renderer-bridge-syntax.json'));
const ts = (await import(pathToFileURL(join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'typescript', 'lib', 'typescript.js')).href)).default;
const files = [
  'apps/desktop/src/renderer/App.tsx',
  'apps/desktop/src/renderer/global.d.ts',
  'apps/desktop/src/main/preload.ts',
  'apps/desktop/src/main/main.ts',
  'apps/desktop/src/main/ipc-integration-policy.ts'
];
const results = [];
const failures = [];
for (const path of files) {
  const source = await readFile(path, 'utf8');
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.ES2024, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const diagnostics = (sourceFile.parseDiagnostics ?? [])
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  results.push({ path, status: diagnostics.length ? 'FAIL' : 'PASS', diagnostics });
  failures.push(...diagnostics.map((diagnostic) => `${path}: ${diagnostic}`));
}
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  featureBuild: 148,
  packageVersion: pkg.version,
  stage: 'Bronze RC2 Active Development',
  scope: 'Build 148 renderer, preload, global API, Electron main and channel-specific IPC policy syntax without dependency installation',
  typeScriptVersion: ts.version,
  fileCount: files.length,
  status: failures.length ? 'FAIL' : 'PASS',
  results,
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 148 renderer/preload/global/main/policy syntax: ${report.status} — ${files.length}/${files.length} files`);
if (failures.length) process.exitCode = 1;
