import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const reportPath = resolve(option('--report', 'artifacts/validation/build156-renderer-bridge-syntax.json'));
const globalNpmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
const ts = (await import(pathToFileURL(join(globalNpmRoot, 'typescript', 'lib', 'typescript.js')).href)).default;
const files = [
  'packages/repository-contracts/src/entity-catalog-repository.ts',
  'packages/repositories/src/entity-catalog-repository.ts',
  'apps/desktop/src/main/entity-catalog-service.ts',
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
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.ES2024,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const diagnostics = (sourceFile.parseDiagnostics ?? [])
    .filter((item) => item.category === ts.DiagnosticCategory.Error)
    .map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n'));
  results.push({ path, status: diagnostics.length ? 'FAIL' : 'PASS', diagnostics });
  failures.push(...diagnostics.map((item) => `${path}: ${item}`));
}
const mainSource = await readFile('apps/desktop/src/main/main.ts', 'utf8');
const preloadSource = await readFile('apps/desktop/src/main/preload.ts', 'utf8');
const mainChannels = [...mainSource.matchAll(/registerIpcHandler\(\s*['"]([^'"]+)/g)].map((match) => match[1]);
const preloadChannels = [...preloadSource.matchAll(/(?:ipcRenderer\.)?\binvoke(?:<[^>]+>)?\(\s*['"]([^'"]+)/g)].map((match) => match[1]);
const missingInPreload = [...new Set(mainChannels)].filter((channel) => !preloadChannels.includes(channel));
const missingInMain = [...new Set(preloadChannels)].filter((channel) => !mainChannels.includes(channel));
const duplicateMain = mainChannels.filter((channel, index) => mainChannels.indexOf(channel) !== index);
const duplicatePreload = preloadChannels.filter((channel, index) => preloadChannels.indexOf(channel) !== index && channel !== 'system:beginIpcAdaptiveBudgetMaintenanceSession');
if (new Set(mainChannels).size !== new Set(preloadChannels).size) failures.push(`IPC unique channel count mismatch: ${new Set(mainChannels).size}/${new Set(preloadChannels).size}`);
for (const channel of missingInPreload) failures.push(`Main IPC channel missing in preload: ${channel}`);
for (const channel of missingInMain) failures.push(`Preload IPC channel missing in main: ${channel}`);
for (const channel of duplicateMain) failures.push(`Duplicate main IPC channel: ${channel}`);
for (const channel of duplicatePreload) failures.push(`Duplicate preload IPC channel: ${channel}`);
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  featureBuild: 156,
  applicationVersion: '29.07.2026.156',
  packageVersion: '29.7.2026-156',
  stage: 'Bronze RC2 Active Development',
  scope: 'Build 156 searchable entity catalog repository/service and renderer/preload/main bridge syntax plus IPC parity',
  typeScriptVersion: ts.version,
  fileCount: files.length,
  channelParity: {
    status: missingInPreload.length || missingInMain.length || duplicateMain.length || duplicatePreload.length || new Set(mainChannels).size !== new Set(preloadChannels).size ? 'FAIL' : 'PASS',
    mainChannelCount: mainChannels.length,
    preloadChannelCount: preloadChannels.length,
    missingInPreload,
    missingInMain,
    duplicateMain,
    duplicatePreload
  },
  status: failures.length ? 'FAIL' : 'PASS',
  results,
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 156 catalog syntax/parity: ${report.status} — ${files.length}/${files.length} files, ${mainChannels.length}/${preloadChannels.length} IPC channels`);
if (failures.length) process.exitCode = 1;
