import { mkdir, readFile, writeFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const applicationVersion = process.argv[2] ?? '01.08.2026.217';
const lifecyclePath = process.argv[3] ?? 'artifacts/validation/build217-open021-windows-release-lifecycle.json';
const developmentPath = process.argv[4] ?? 'artifacts/validation/windows-open021-development-launch-probe.json';
const packagedPath = process.argv[5] ?? 'artifacts/validation/windows-open021-packaged-launch-probe.json';
const integrityPath = process.argv[6] ?? 'artifacts/validation/build217-open021-source-integrity-windows.json';
const reportPath = process.argv[7] ?? 'artifacts/validation/build217-open021-windows-closure-result.json';
const expectedBuild = Number(applicationVersion.split('.').at(-1));
if (!Number.isInteger(expectedBuild) || expectedBuild !== 217) throw new Error(`Build217 OPEN-021 verifier received unexpected application version: ${applicationVersion}`);

const checks = [];
const add = (id, condition, details = undefined) => checks.push({ id, status: condition ? 'PASS' : 'FAIL', ...(details !== undefined ? { details } : {}) });

const integrity = await readJson(integrityPath);
add('source-integrity', integrity.status === 'PASS', integrity.status);

const lifecycle = await readJson(lifecyclePath);
add('lifecycle-status', lifecycle.status === 'PASS', lifecycle.status);
add('lifecycle-official', lifecycle.official === true && lifecycle.diagnosticOnly === false, { official: lifecycle.official, diagnosticOnly: lifecycle.diagnosticOnly });
add('lifecycle-version', lifecycle.applicationVersion === applicationVersion && lifecycle.build === 217, { applicationVersion: lifecycle.applicationVersion, build: lifecycle.build });
add('installer-sha', typeof lifecycle.installer?.sha256 === 'string' && /^[0-9a-f]{64}$/.test(lifecycle.installer.sha256), lifecycle.installer?.sha256);
for (const step of ['development-open021-launch','windows-installer-build','silent-install','installed-open021-launch','silent-uninstall']) {
  const row = lifecycle.steps?.find((item) => item.id === step);
  add(`lifecycle-${step}`, row?.status === 'PASS', row?.status);
}

const inspect = async (label, path, mode) => {
  const evidence = await readJson(path);
  add(`${label}-status`, evidence.status === 'PASS' && evidence.official === true && evidence.platform === 'win32', { status: evidence.status, official: evidence.official, platform: evidence.platform });
  add(`${label}-mode`, evidence.mode === mode, evidence.mode);
  add(`${label}-version`, evidence.applicationVersion === applicationVersion, evidence.applicationVersion);
  add(`${label}-efs-runtime`, evidence.windowsOpen021EfsRuntime === 'PASS', evidence.windowsOpen021EfsRuntime);
  add(`${label}-sandbox`, evidence.rendererSandboxPolicy === 'PASS', evidence.rendererSandboxPolicy);
  add(`${label}-two-runs`, Array.isArray(evidence.runs) && evidence.runs.length === 2, Array.isArray(evidence.runs) ? evidence.runs.length : 0);
  for (const [index, run] of (evidence.runs ?? []).entries()) {
    const security = run.windowsOpen021EfsEvidence;
    add(`${label}-run${index + 1}-status`, security?.status === 'PASS' && security?.platform === 'win32', security?.status);
    add(`${label}-run${index + 1}-memory-only`, security?.efs?.activeDatabase === 'memory-only', security?.efs?.activeDatabase);
    add(`${label}-run${index + 1}-efs-directory`, security?.efs?.directoryEncryptedAttribute === 'PASS', security?.efs?.directoryEncryptedAttribute);
    add(`${label}-run${index + 1}-efs-snapshot`, security?.efs?.snapshotEncryptedAttribute === 'PASS', security?.efs?.snapshotEncryptedAttribute);
    add(`${label}-run${index + 1}-sqlite-roundtrip`, security?.efs?.snapshotSqliteRoundTrip === 'PASS', security?.efs?.snapshotSqliteRoundTrip);
    add(`${label}-run${index + 1}-cleanup`, security?.efs?.stagingCleanup === 'PASS', security?.efs?.stagingCleanup);
  }
};

await inspect('development', developmentPath, 'development');
await inspect('packaged', packagedPath, 'packaged');

const failed = checks.filter((item) => item.status !== 'PASS');
const status = failed.length === 0 ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  build: 217,
  applicationVersion,
  openWorkId: 'OPEN-021',
  status,
  checks: checks.length,
  passCount: checks.length - failed.length,
  failCount: failed.length,
  results: checks,
  closureReadiness: {
    open021: status === 'PASS' ? 'READY_TO_CLOSE' : 'NOT_READY',
    open022: 'UNCHANGED',
    ledgerMutationPerformed: false
  },
  evidence: { lifecyclePath, developmentPath, packagedPath, integrityPath },
  generatedAt: new Date().toISOString(),
  limitations: [
    'READY_TO_CLOSE is valid only when the evidence files were generated on a real Windows host from the exact Build217 source snapshot.',
    'The verifier does not close OPEN-021 in the master ledger automatically.',
    'Same-user malware, debugger/process-memory access and administrator compromise remain outside the absolute protection claim.'
  ]
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build217 OPEN-021 Windows closure result: ${status} (${report.passCount}/${checks.length}) — ${report.closureReadiness.open021}.`);
if (status !== 'PASS') process.exitCode = 1;
