import { mkdir, readFile, writeFile } from 'node:fs/promises';

const sources = Object.fromEntries(await Promise.all([
  ['probe', 'apps/desktop/src/main/windows-security-evidence-probe.ts'],
  ['launch', 'scripts/windows-real-launch-test.mjs'],
  ['runner', 'scripts/run-bronze-final-windows-validation.ps1'],
  ['result', 'scripts/verify-build216-windows-security-evidence-result.mjs'],
  ['intakeLib', 'scripts/lib/windows-evidence-intake.mjs'],
  ['intakeCli', 'scripts/verify-build216-windows-evidence-intake.mjs'],
  ['intakeRuntime', 'scripts/verify-build216-windows-evidence-intake-runtime.mjs'],
  ['boundary', 'scripts/create-build216-validation-boundary.mjs'],
  ['cmd', 'BRONZE_FINAL_WINDOWS_DOGRULAMA.cmd']
].map(async ([id, path]) => [id, await readFile(path, 'utf8')])));

const checks = [];
const add = (id, condition) => checks.push({ id, status: condition ? 'PASS' : 'FAIL' });
add('probe-build-derived-from-version', sources.probe.includes("const build = Number(input.applicationVersion.split('.').at(-1))") && sources.probe.includes('build,'));
add('probe-no-build215-hardcode', !sources.probe.includes('readonly build: 215') && !sources.probe.includes('build: 215,'));
add('launch-build-derived-from-version', sources.launch.includes("const expectedBuild = Number(probe.applicationVersion?.split('.').at(-1))"));
add('runner-calls-build216-result', sources.runner.includes('verify-build216-windows-security-evidence-result.mjs'));
add('runner-source-manifest-binding', sources.runner.includes('$sourceManifestPath') && sources.runner.includes('manifestSha256'));
add('runner-source-sha-sums-binding', sources.runner.includes('$sourceSha256SumsPath') && sources.runner.includes('sha256SumsSha256'));
add('runner-evidence-manifest', sources.runner.includes('$prefix-windows-evidence-manifest.json') && sources.runner.includes('$manifestFiles'));
add('runner-evidence-file-sha', sources.runner.includes('Get-FileHash -LiteralPath $spec.path -Algorithm SHA256'));
add('runner-bundle-sha', sources.runner.includes('$bundleShaPath') && sources.runner.includes('Get-FileHash -LiteralPath $bundlePath'));
add('runner-required-summary', sources.runner.includes('id = "summary"') && sources.runner.includes('required = $true'));
add('runner-required-source-preflight', sources.runner.includes('id = "source-preflight"'));
add('runner-required-release-lifecycle', sources.runner.includes('id = "windows-release-lifecycle"'));
add('runner-required-security-result', sources.runner.includes('id = "windows-security-evidence"'));
add('runner-required-dev-packaged', sources.runner.includes('id = "development-launch-probe"') && sources.runner.includes('id = "packaged-launch-probe"'));
add('runner-required-audits', sources.runner.includes('id = "production-dependency-audit"') && sources.runner.includes('id = "build-toolchain-dependency-audit"'));
add('intake-verifies-source-manifest', sources.intakeLib.includes('source-manifest-binding'));
add('intake-verifies-source-sha-sums', sources.intakeLib.includes('source-sha256sums-binding'));
add('intake-verifies-size-and-sha', sources.intakeLib.includes("`${id}-size`") && sources.intakeLib.includes("`${id}-sha256`"));
add('intake-requires-summary-pass', sources.intakeLib.includes("'summary-status'"));
add('intake-requires-official-sandbox', sources.intakeLib.includes("'summary-official-sandbox'"));
add('intake-requires-windows-lifecycle', sources.intakeLib.includes("'windows-lifecycle-pass'") && sources.intakeLib.includes("'windows-lifecycle-official'"));
add('intake-requires-installer-evidence', sources.intakeLib.includes("'windows-lifecycle-installer'"));
add('intake-requires-security-all-pass', sources.intakeLib.includes("'security-result-all-checks-pass'"));
add('intake-requires-dev-packaged-official', sources.intakeLib.includes("'development-launch-probe'",) && sources.intakeLib.includes("'packaged-launch-probe'"));
add('intake-requires-efs-dpapi-side-artifact', sources.intakeLib.includes("`${id}-efs`") && sources.intakeLib.includes("`${id}-dpapi`") && sources.intakeLib.includes("`${id}-protected-side-artifact`"));
add('intake-requires-audits-pass', sources.intakeLib.includes("'production-audit-pass'") && sources.intakeLib.includes("'build-tool-audit-pass'"));
add('intake-no-ledger-mutation', sources.intakeLib.includes('ledgerMutationPerformed: false'));
add('cli-build216-pinned', sources.intakeCli.includes("applicationVersion !== '01.08.2026.216'") && sources.intakeCli.includes('expectedBuild: 216'));
add('runtime-valid-fixture', sources.intakeRuntime.includes('valid-fixture-accepted'));
add('runtime-tamper-rejection', sources.intakeRuntime.includes('tampered-fixture-rejected') && sources.intakeRuntime.includes('tamper-sha-detected'));
add('boundary-windows-not-run', sources.boundary.includes("['windows-runtime', 'NOT_RUN'"));
add('boundary-closure-in-progress', sources.boundary.includes("['open021-closure', 'IN_PROGRESS'") && sources.boundary.includes("['open022-closure', 'IN_PROGRESS'"));
add('cmd-still-official-runner', sources.cmd.includes('run-bronze-final-windows-validation.ps1'));

const status = checks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL';
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build216-windows-evidence-intake-contract.json', `${JSON.stringify({ schemaVersion: 1, build: 216, status, checks: checks.length, results: checks, windowsRuntime: 'NOT_RUN', generatedAt: new Date().toISOString() }, null, 2)}\n`);
console.log(`Build216 Windows evidence intake contract: ${status} (${checks.filter((item) => item.status === 'PASS').length}/${checks.length}).`);
if (status !== 'PASS') process.exitCode = 1;
