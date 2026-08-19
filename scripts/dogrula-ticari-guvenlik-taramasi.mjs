import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const reportPath = 'artifacts/validation/ticari-guvenlik-taramasi.json';
const maximumTextFileBytes = 5 * 1024 * 1024;
const allowedEnvironmentFiles = new Set(['.env.example']);
const allowedPrivateKeyFixtures = new Set([
  'scripts/dogrula-ticari-guvenlik-taramasi.mjs',
  'scripts/verify-device-secret-protector-runtime.mjs',
  'scripts/verify-software-supply-chain-boundary.mjs'
]);
const patterns = Object.freeze([
  { id: 'PRIVATE_KEY', expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gu },
  { id: 'AWS_ACCESS_KEY', expression: /AKIA[0-9A-Z]{16}/gu },
  { id: 'GOOGLE_API_KEY', expression: /AIza[0-9A-Za-z_-]{35}/gu },
  { id: 'GITHUB_TOKEN', expression: /gh[pousr]_[0-9A-Za-z]{36,}/gu },
  { id: 'SLACK_TOKEN', expression: /xox[baprs]-[0-9A-Za-z-]{10,}/gu },
  { id: 'OPENAI_API_KEY', expression: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/gu }
]);

const git = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  windowsHide: true
});
if (git.status !== 0) throw new Error(`Git dosya envanteri okunamadi: ${git.stderr || git.stdout}`);

const paths = [...new Set(git.stdout.split('\0').filter(Boolean))].sort((left, right) => left.localeCompare(right, 'en'));
const findings = [];
let scannedTextFiles = 0;
let skippedBinaryFiles = 0;
let skippedOversizeFiles = 0;

for (const path of paths) {
  const normalized = path.replaceAll('\\', '/');
  const baseName = normalized.split('/').at(-1) ?? '';
  if ((baseName === '.env' || baseName.startsWith('.env.')) && !allowedEnvironmentFiles.has(normalized)) {
    findings.push({ path: normalized, rule: 'TRACKED_ENV_FILE', line: 1 });
  }
  let bytes;
  try {
    bytes = await readFile(normalized);
  } catch {
    continue;
  }
  if (bytes.length > maximumTextFileBytes) {
    skippedOversizeFiles += 1;
    continue;
  }
  if (bytes.includes(0)) {
    skippedBinaryFiles += 1;
    continue;
  }
  scannedTextFiles += 1;
  const text = bytes.toString('utf8');
  for (const { id, expression } of patterns) {
    expression.lastIndex = 0;
    for (const match of text.matchAll(expression)) {
      if (id === 'PRIVATE_KEY' && allowedPrivateKeyFixtures.has(normalized)) continue;
      const line = text.slice(0, match.index).split('\n').length;
      findings.push({ path: normalized, rule: id, line });
    }
  }
}

const selfTests = {
  privateKeyDetected: patterns[0].expression.test('-----BEGIN PRIVATE KEY-----'),
  awsKeyDetected: patterns[1].expression.test(`AKIA${'1'.repeat(16)}`),
  githubTokenDetected: patterns[3].expression.test(`ghp_${'a'.repeat(40)}`),
  exampleEnvironmentAllowed: allowedEnvironmentFiles.has('.env.example'),
  realEnvironmentDenied: !allowedEnvironmentFiles.has('.env.production')
};
const selfTestsPassed = Object.values(selfTests).every(Boolean);
const report = {
  schemaVersion: 1,
  id: 'PARSYUVA-AYM-TICARI-GUVENLIK-TARAMASI-V1',
  status: findings.length === 0 && selfTestsPassed ? 'PASS' : 'FAIL',
  scannedFiles: paths.length,
  scannedTextFiles,
  skippedBinaryFiles,
  skippedOversizeFiles,
  maximumTextFileBytes,
  secretFindingCount: findings.length,
  findings,
  selfTests,
  externalSecurityReviewImplied: false,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Ticari guvenlik taramasi: ${report.status} (${scannedTextFiles} metin dosyasi / ${findings.length} bulgu).`);
if (report.status !== 'PASS') process.exitCode = 1;
