import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { sha256File, verifyWindowsEvidenceIntake } from './lib/windows-evidence-intake.mjs';

const applicationVersion = '01.08.2026.216';
const packageVersion = '1.8.2026-216';
const hostHash = createHash('sha256').update('BUILD216-FIXTURE-HOST').digest('hex');
const root = process.cwd();
const fixtureRoot = await mkdtemp(join(tmpdir(), 'ppt-build216-windows-intake-'));
const writeJson = async (name, value) => {
  const path = join(fixtureRoot, name);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
};

const requiredSteps = [
  'source-preflight',
  'complete-rc2-gates',
  'official-windows-lifecycle',
  'open021-open022-windows-security-evidence',
  'production-dependency-audit',
  'build-toolchain-dependency-audit'
];

try {
  const payloads = [
    ['summary', 'build216-bronze-final-windows-validation-summary.json', {
      schemaVersion: 2,
      product: 'Anadolu Parsı Aile Yaşam Merkezi',
      applicationVersion,
      packageVersion,
      build: 216,
      stage: 'Bronze RC2 Active Development',
      status: 'PASS',
      officialSandboxRequired: true,
      diagnosticResultsAcceptedAsOfficial: false,
      open021WindowsEfsRequired: true,
      open022WindowsSafeStorageDpapiRequired: true,
      packagedElectronRequired: true,
      host: { osVersion: 'Microsoft Windows NT fixture', powershellVersion: '5.1', machineNameSha256: hostHash },
      steps: requiredSteps.map((id) => ({ id, status: 'PASS', exitCode: 0 }))
    }],
    ['source-preflight', 'build216-source-preflight-windows.json', { status: 'PASS' }],
    ['rc2-validation', 'build216-rc2-validation-report-windows.json', { status: 'PASS' }],
    ['windows-release-lifecycle', 'build216-windows-release-lifecycle.json', { status: 'PASS', diagnosticMode: null, installer: { sha256: 'a'.repeat(64) } }],
    ['windows-security-evidence', 'build216-windows-security-evidence-result.json', { status: 'PASS', build: 216, applicationVersion, results: [{ id: 'fixture', status: 'PASS' }] }],
    ['development-launch-probe', 'windows-real-launch-probe.json', { status: 'PASS', mode: 'development', diagnosticMode: false, securityExceptions: [], applicationVersion, runs: [{}, {}], windowsEfsRuntime: 'PASS', windowsSafeStorageDpapiRuntime: 'PASS', protectedSideArtifactWindowsRuntime: 'PASS' }],
    ['packaged-launch-probe', 'windows-packaged-launch-probe.json', { status: 'PASS', mode: 'packaged', diagnosticMode: false, securityExceptions: [], applicationVersion, runs: [{}, {}], windowsEfsRuntime: 'PASS', windowsSafeStorageDpapiRuntime: 'PASS', protectedSideArtifactWindowsRuntime: 'PASS' }],
    ['production-dependency-audit', 'build216-production-dependency-audit.json', { status: 'PASS' }],
    ['build-toolchain-dependency-audit', 'build216-build-toolchain-dependency-audit.json', { status: 'PASS' }]
  ];
  const files = [];
  for (const [id, name, value] of payloads) {
    const path = await writeJson(name, value);
    const info = await stat(path);
    files.push({ id, relativePath: name, required: true, present: true, sizeBytes: info.size, sha256: await sha256File(path) });
  }
  const manifest = {
    schemaVersion: 1,
    product: 'Anadolu Parsı Aile Yaşam Merkezi',
    build: 216,
    applicationVersion,
    packageVersion,
    platform: 'win32',
    status: 'PASS',
    host: { machineNameSha256: hostHash, osVersion: 'Microsoft Windows NT fixture' },
    source: {
      manifestSha256: await sha256File(resolve(root, 'manifest.json')),
      sha256SumsSha256: await sha256File(resolve(root, 'SHA256SUMS.txt'))
    },
    files
  };
  const manifestPath = await writeJson('build216-windows-evidence-manifest.json', manifest);
  const verify = () => verifyWindowsEvidenceIntake({
    evidenceRoot: fixtureRoot,
    manifestPath,
    expectedBuild: 216,
    expectedApplicationVersion: applicationVersion,
    expectedPackageVersion: packageVersion,
    sourceManifestPath: resolve(root, 'manifest.json'),
    sourceSha256SumsPath: resolve(root, 'SHA256SUMS.txt')
  });
  const valid = await verify();
  const auditPath = join(fixtureRoot, 'build216-production-dependency-audit.json');
  await writeFile(auditPath, `${await readFile(auditPath, 'utf8')} `);
  const tampered = await verify();
  const checks = [
    { id: 'valid-fixture-accepted', status: valid.status === 'PASS' ? 'PASS' : 'FAIL', details: { status: valid.status, failed: valid.failed } },
    { id: 'valid-fixture-open021-ready', status: valid.closureReadiness.open021 === 'READY_TO_CLOSE' ? 'PASS' : 'FAIL', details: valid.closureReadiness },
    { id: 'valid-fixture-open022-ready', status: valid.closureReadiness.open022 === 'READY_TO_CLOSE' ? 'PASS' : 'FAIL', details: valid.closureReadiness },
    { id: 'intake-does-not-mutate-ledger', status: valid.closureReadiness.ledgerMutationPerformed === false ? 'PASS' : 'FAIL', details: valid.closureReadiness },
    { id: 'tampered-fixture-rejected', status: tampered.status === 'FAIL' ? 'PASS' : 'FAIL', details: { status: tampered.status, failed: tampered.failed } },
    { id: 'tamper-sha-detected', status: tampered.results.some((item) => item.id === 'production-dependency-audit-sha256' && item.status === 'FAIL') ? 'PASS' : 'FAIL' }
  ];
  const status = checks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL';
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/build216-windows-evidence-intake-runtime.json', `${JSON.stringify({ schemaVersion: 1, build: 216, status, checks: checks.length, results: checks, generatedAt: new Date().toISOString() }, null, 2)}\n`);
  console.log(`Build216 Windows evidence intake runtime: ${status} (${checks.filter((item) => item.status === 'PASS').length}/${checks.length}).`);
  if (status !== 'PASS') process.exitCode = 1;
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
