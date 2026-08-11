import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};

const reportPath = resolve(option('--report', 'artifacts/validation/build137-renderer-bridge-syntax.json'));
const globalTypeScriptPath = '/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js';
const require = createRequire(import.meta.url);
const ts = require(globalTypeScriptPath);
const files = [
  'apps/desktop/src/renderer/App.tsx',
  'apps/desktop/src/renderer/global.d.ts',
  'apps/desktop/src/main/preload.ts'
];
const failures = [];
const results = [];

const formatDiagnostic = (diagnostic) => {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  if (!diagnostic.file || diagnostic.start === undefined) return message;
  const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return `${diagnostic.file.fileName}:${position.line + 1}:${position.character + 1} ${message}`;
};

for (const path of files) {
  const source = await readFile(path, 'utf8');
  const isTsx = path.endsWith('.tsx');
  const scriptKind = isTsx ? ts.ScriptKind.TSX : path.endsWith('.d.ts') ? ts.ScriptKind.TS : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.ES2022, true, scriptKind);
  const diagnostics = (sourceFile.parseDiagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  const formatted = diagnostics.map(formatDiagnostic);
  results.push({ path, language: isTsx ? 'TSX' : 'TypeScript', status: formatted.length === 0 ? 'PASS' : 'FAIL', diagnostics: formatted });
  failures.push(...formatted.map((failure) => `${path}: ${failure}`));
}

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  featureBuild: 137,
  applicationVersion: '28.07.2026.137',
  packageVersion: '28.7.2026-137',
  stage: 'Bronze RC2 Active Development',
  scope: 'Build 137 renderer, preload and global bridge syntax validation without dependency installation',
  typeScriptVersion: ts.version,
  fileCount: files.length,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  results,
  failures,
  generatedAt: new Date().toISOString()
};

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 137 renderer/preload/global syntax: ${report.status} — ${files.length}/${files.length} files`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
