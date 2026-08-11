import { mkdir, readFile, writeFile } from 'node:fs/promises';

const reportPath = process.argv[2] ?? 'artifacts/validation/build217-open021-isolation-contract.json';
const read = (path) => readFile(path, 'utf8');
const files = Object.fromEntries(await Promise.all([
  ['cmd', 'OPEN021_WINDOWS_KAPAT.cmd'],
  ['runner', 'scripts/run-open021-windows-closure.ps1'],
  ['lifecycle', 'scripts/windows-open021-release-validation.ps1'],
  ['launch', 'scripts/windows-open021-launch-test.mjs'],
  ['result', 'scripts/verify-build217-open021-windows-result.mjs'],
  ['probe', 'apps/desktop/src/main/windows-open021-efs-evidence-probe.ts'],
  ['main', 'apps/desktop/src/main/main.ts']
].map(async ([key, path]) => [key, await read(path)])));

const checks = [];
const add = (id, condition, details = undefined) => checks.push({ id, status: condition ? 'PASS' : 'FAIL', ...(details !== undefined ? { details } : {}) });

add('cmd-build217', files.cmd.includes('Build217 / 01.08.2026.217'));
add('cmd-runner', files.cmd.includes('run-open021-windows-closure.ps1'));
add('runner-windows-only', files.runner.includes('real Windows evidence'));
add('runner-source-integrity', files.runner.includes('verify-source-integrity.mjs'));
add('runner-dependency-bootstrap', files.runner.includes('npm.cmd ci --no-audit --no-fund'));
add('runner-prereq-not-open002-close', files.runner.includes('prerequisiteNpmCiDoesNotAutoCloseOpen002'));
add('runner-official-lifecycle', files.runner.includes('windows-open021-release-validation.ps1'));
add('runner-result-verifier', files.runner.includes('verify-build217-open021-windows-result.mjs'));
add('runner-bundle', files.runner.includes('OPEN021_Windows_Kanitlari_Build217_'));
add('runner-source-binding', files.runner.includes('manifestSha256') && files.runner.includes('sha256SumsSha256'));
add('runner-excludes-full-rc2', !files.runner.includes('run-rc2-validation-gates'));
add('runner-excludes-audit', !files.runner.includes('npm-audit') && !files.runner.includes('dependency-audit'));
add('lifecycle-package-win', files.lifecycle.includes('npm.cmd run package:win --workspace @ppt/desktop'));
add('lifecycle-development-open021', files.lifecycle.includes('development-open021-launch'));
add('lifecycle-installed-open021', files.lifecycle.includes('installed-open021-launch'));
add('lifecycle-install-uninstall', files.lifecycle.includes('silent-install') && files.lifecycle.includes('silent-uninstall'));
add('launch-open021-env', files.launch.includes("PPT_WINDOWS_OPEN021_EFS_PROBE: '1'"));
add('launch-not-full-security-env', !files.launch.includes("PPT_WINDOWS_SECURITY_PROBE: '1'"));
add('launch-development-packaged', files.launch.includes("'development'") && files.launch.includes("'packaged'"));
add('launch-two-runs', files.launch.includes('runs: [firstRun, secondRun]'));
add('launch-efs-attributes', files.launch.includes('directoryEncryptedAttribute') && files.launch.includes('snapshotEncryptedAttribute'));
add('probe-efs-session', files.probe.includes('VolatileSqliteSession') && files.probe.includes('requireWindowsEfs: true'));
add('probe-memory-only', files.probe.includes("activeDatabase !== 'memory-only'"));
add('probe-efs-directory-file', files.probe.includes("assertWindowsEfsEncrypted(dirname(snapshotPath), 'OPEN-021 EFS staging directory'") && files.probe.includes("assertWindowsEfsEncrypted(snapshotPath, 'OPEN-021 EFS SQLite snapshot'") && files.probe.includes('assertWindowsEfsTreeEncrypted(dirname(snapshotPath)'));
add('probe-no-protected-side-artifact', !files.probe.includes('ProtectedSideArtifactStore') && !files.probe.includes('DeviceSecretProtector'));
add('main-open021-probe-gate', files.main.includes("PPT_WINDOWS_OPEN021_EFS_PROBE === '1'"));
add('main-open021-probe-output', files.main.includes('windowsOpen021EfsEvidence: windowsOpen021EfsEvidenceReport'));
add('result-ready-only-pass', files.result.includes("open021: status === 'PASS' ? 'READY_TO_CLOSE' : 'NOT_READY'"));
add('result-open022-unchanged', files.result.includes("open022: 'UNCHANGED'"));
add('result-no-ledger-mutation', files.result.includes('ledgerMutationPerformed: false'));

const status = checks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL';
await mkdir('artifacts/validation', { recursive: true });
await writeFile(reportPath, `${JSON.stringify({
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: '01.08.2026.217',
  build: 217,
  openWorkId: 'OPEN-021',
  status,
  checks: checks.length,
  passCount: checks.filter((item) => item.status === 'PASS').length,
  results: checks,
  generatedAt: new Date().toISOString()
}, null, 2)}\n`);
console.log(`Build217 OPEN-021 isolation contract: ${status} (${checks.filter((item) => item.status === 'PASS').length}/${checks.length}).`);
if (status !== 'PASS') process.exitCode = 1;
