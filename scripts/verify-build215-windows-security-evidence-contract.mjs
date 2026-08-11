import { mkdir, readFile, writeFile } from 'node:fs/promises';

const files = Object.fromEntries(await Promise.all([
  ['probe', 'apps/desktop/src/main/windows-security-evidence-probe.ts'],
  ['main', 'apps/desktop/src/main/main.ts'],
  ['launch', 'scripts/windows-real-launch-test.mjs'],
  ['windowsRunner', 'scripts/run-bronze-final-windows-validation.ps1'],
  ['releaseLifecycle', 'scripts/windows-release-validation.ps1'],
  ['resultVerifier', 'scripts/verify-build215-windows-security-evidence-result.mjs'],
  ['cmd', 'BRONZE_FINAL_WINDOWS_DOGRULAMA.cmd']
].map(async ([id, path]) => [id, await readFile(path, 'utf8')])));

const checks = [];
const add = (id, condition) => checks.push({ id, status: condition ? 'PASS' : 'FAIL' });
add('probe-build-dynamic', files.probe.includes('readonly build: number') && files.probe.includes('const build = Number(input.applicationVersion.split') && files.probe.includes('    build,'));
add('probe-real-windows-only', files.probe.includes("process.platform !== 'win32'"));
add('probe-efs-required', files.probe.includes('requireWindowsEfs: true'));
add('probe-efs-directory-attribute', files.probe.includes("assertWindowsEncryptedAttribute(dirname(snapshotPath), 'EFS staging directory')"));
add('probe-efs-snapshot-attribute', files.probe.includes("assertWindowsEncryptedAttribute(snapshotPath, 'EFS SQLite snapshot')"));
add('probe-memory-only', files.probe.includes("session.protectionStatus.activeDatabase !== 'memory-only'"));
add('probe-staging-cleanup', files.probe.includes('remainingStagingFiles.length > 0'));
add('probe-dpapi-provider', files.probe.includes("input.protector.protectionId !== 'electron-safe-storage-v1'") && files.probe.includes("input.selectedStorageBackend !== 'dpapi'"));
add('probe-wrapped-key', files.probe.includes('protectedDataKey') && files.probe.includes('dataKey !== undefined'));
add('probe-ciphertext-plaintext-check', files.probe.includes('rawProtectedProbe.includes(marker)'));
add('probe-decrypt-roundtrip', files.probe.includes('input.protectedArtifacts.readText(protectedProbePath) !== marker'));
add('main-env-gated', files.main.includes("process.env.PPT_WINDOWS_SECURITY_PROBE === '1'"));
add('main-probe-in-launch-evidence', files.main.includes('windowsSecurityEvidence: windowsSecurityEvidenceReport'));
add('launch-enables-probe', files.launch.includes("PPT_WINDOWS_SECURITY_PROBE: '1'"));
add('launch-requires-efs-pass', files.launch.includes("windowsSecurity.efs?.snapshotEncryptedAttribute !== 'PASS'"));
add('launch-requires-dpapi-pass', files.launch.includes("windowsSecurity.protectedSideArtifacts?.protectionId !== 'electron-safe-storage-v1'") && files.launch.includes("selectedStorageBackend !== 'dpapi'"));
add('launch-reports-windows-security', files.launch.includes("windowsEfsRuntime: 'PASS'") && files.launch.includes("windowsSafeStorageDpapiRuntime: 'PASS'"));
add('result-verifier-dev-and-packaged', files.resultVerifier.includes("inspect('development'") && files.resultVerifier.includes("inspect('packaged'"));
add('result-verifier-build215', files.resultVerifier.includes('expectedBuild !== 215'));
add('runner-dynamic-version', files.windowsRunner.includes('$applicationVersionMatch') && files.windowsRunner.includes('$buildText = $applicationVersion.Split'));
add('runner-no-build122', !files.windowsRunner.includes('build122') && !files.windowsRunner.includes('26.07.2026.122'));
add('runner-windows-lifecycle', files.windowsRunner.includes('windows-release-validation.ps1'));
add('runner-open021-open022-evidence', files.windowsRunner.includes('open021-open022-windows-security-evidence'));
add('runner-bundles-launch-probes', files.windowsRunner.includes('windows-real-launch-probe.json') && files.windowsRunner.includes('windows-packaged-launch-probe.json'));
add('official-sandbox-stays-required', files.windowsRunner.includes('officialSandboxRequired = $true') && files.releaseLifecycle.includes('DiagnosticNoSandbox'));
add('cmd-points-official-runner', files.cmd.includes('run-bronze-final-windows-validation.ps1'));

const status = checks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL';
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build215-windows-security-evidence-contract.json', `${JSON.stringify({
  schemaVersion: 1,
  build: 215,
  status,
  checks: checks.length,
  results: checks,
  generatedAt: new Date().toISOString(),
  windowsRuntime: 'NOT_RUN',
  note: 'This contract validates the Windows evidence harness source only; it does not substitute for a real Windows execution.'
}, null, 2)}\n`);
console.log(`Build215 Windows security evidence contract: ${status} (${checks.filter((item) => item.status === 'PASS').length}/${checks.length}).`);
if (status !== 'PASS') process.exitCode = 1;
