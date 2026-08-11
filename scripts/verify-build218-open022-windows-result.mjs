import { mkdir, readFile, writeFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const applicationVersion = process.argv[2] ?? '01.08.2026.218';
const lifecyclePath = process.argv[3] ?? 'artifacts/validation/build218-open022-windows-release-lifecycle.json';
const developmentPath = process.argv[4] ?? 'artifacts/validation/windows-open022-development-launch-probe.json';
const packagedPath = process.argv[5] ?? 'artifacts/validation/windows-open022-packaged-launch-probe.json';
const integrityPath = process.argv[6] ?? 'artifacts/validation/build218-open022-source-integrity-windows.json';
const reportPath = process.argv[7] ?? 'artifacts/validation/build218-open022-windows-closure-result.json';
const expectedBuild = Number(applicationVersion.split('.').at(-1));
if (!Number.isInteger(expectedBuild) || expectedBuild !== 218) throw new Error(`Build218 OPEN-022 verifier received unexpected application version: ${applicationVersion}`);

const checks = [];
const add = (id, condition, details = undefined) => checks.push({ id, status: condition ? 'PASS' : 'FAIL', ...(details !== undefined ? { details } : {}) });

const integrity = await readJson(integrityPath);
add('source-integrity', integrity.status === 'PASS', integrity.status);

const lifecycle = await readJson(lifecyclePath);
add('lifecycle-status', lifecycle.status === 'PASS', lifecycle.status);
add('lifecycle-official', lifecycle.official === true && lifecycle.diagnosticOnly === false, { official: lifecycle.official, diagnosticOnly: lifecycle.diagnosticOnly });
add('lifecycle-version', lifecycle.applicationVersion === applicationVersion && lifecycle.build === 218, { applicationVersion: lifecycle.applicationVersion, build: lifecycle.build });
add('installer-sha', typeof lifecycle.installer?.sha256 === 'string' && /^[0-9a-f]{64}$/.test(lifecycle.installer.sha256), lifecycle.installer?.sha256);
for (const step of ['development-open022-launch','windows-installer-build','silent-install','installed-open022-launch','silent-uninstall']) {
  const row = lifecycle.steps?.find((item) => item.id === step);
  add(`lifecycle-${step}`, row?.status === 'PASS', row?.status);
}

const inspect = async (label, path, mode) => {
  const evidence = await readJson(path);
  add(`${label}-status`, evidence.status === 'PASS' && evidence.official === true && evidence.platform === 'win32', { status: evidence.status, official: evidence.official, platform: evidence.platform });
  add(`${label}-mode`, evidence.mode === mode, evidence.mode);
  add(`${label}-version`, evidence.applicationVersion === applicationVersion, evidence.applicationVersion);
  add(`${label}-dpapi-persistence`, evidence.dpapiCrossProcessPersistence === 'PASS', evidence.dpapiCrossProcessPersistence);
  add(`${label}-safe-storage`, evidence.windowsSafeStorageDpapiRuntime === 'PASS', evidence.windowsSafeStorageDpapiRuntime);
  add(`${label}-protected-side-artifact`, evidence.protectedSideArtifactWindowsRuntime === 'PASS', evidence.protectedSideArtifactWindowsRuntime);
  add(`${label}-volatile-browser-crash`, evidence.volatileBrowserCrashRuntime === 'PASS', evidence.volatileBrowserCrashRuntime);
  add(`${label}-sandbox`, evidence.rendererSandboxPolicy === 'PASS', evidence.rendererSandboxPolicy);
  add(`${label}-two-runs`, Array.isArray(evidence.runs) && evidence.runs.length === 2, Array.isArray(evidence.runs) ? evidence.runs.length : 0);
  for (const [index, run] of (evidence.runs ?? []).entries()) {
    const startup = run.startupSecurity;
    const side = run.windowsOpen022SideArtifactEvidence;
    add(`${label}-run${index + 1}-startup-dpapi`, startup?.status === 'PASS' && startup?.protectionProvider === 'windows-dpapi' && startup?.encryptionRoundTrip === 'PASS' && startup?.diagnosticOnly === false, startup);
    add(`${label}-run${index + 1}-side-status`, side?.status === 'PASS' && side?.platform === 'win32' && side?.build === 218, side?.status);
    add(`${label}-run${index + 1}-backend`, side?.safeStorage?.selectedBackend === 'dpapi' && side?.safeStorage?.protectionId === 'electron-safe-storage-v1', side?.safeStorage);
    add(`${label}-run${index + 1}-key-envelope`, side?.keyEnvelope?.deviceWrapped === 'PASS' && side?.keyEnvelope?.noPlainDataKey === 'PASS', side?.keyEnvelope);
    add(`${label}-run${index + 1}-containers`, side?.containers?.pplog === 'PASS' && side?.containers?.pptdiag === 'PASS' && side?.containers?.pptreport === 'PASS' && side?.containers?.ciphertextHidesPlaintext === 'PASS' && side?.containers?.decryptRoundTrip === 'PASS', side?.containers);
    add(`${label}-run${index + 1}-startup-encrypted`, side?.startupEvidence?.encryptedAtRest === 'PASS' && side?.startupEvidence?.decryptRoundTrip === 'PASS' && side?.startupEvidence?.protectionProvider === 'windows-dpapi', side?.startupEvidence);
    add(`${label}-run${index + 1}-volatile`, side?.volatilePaths?.sessionDataUnderVolatileRoot === 'PASS' && side?.volatilePaths?.crashDumpsUnderVolatileRoot === 'PASS', side?.volatilePaths);
  }
};

await inspect('development', developmentPath, 'development');
await inspect('packaged', packagedPath, 'packaged');
const status = checks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  build: 218,
  applicationVersion,
  openWorkId: 'OPEN-022',
  status,
  checks: checks.length,
  passCount: checks.filter((item) => item.status === 'PASS').length,
  results: checks,
  evidence: { lifecyclePath, developmentPath, packagedPath, integrityPath },
  closureReadiness: {
    open022: status === 'PASS' ? 'READY_TO_CLOSE' : 'NOT_READY',
    open021: 'UNCHANGED',
    ledgerMutationPerformed: false
  },
  generatedAt: new Date().toISOString(),
  limitations: [
    'PASS is valid only when the input launch probes were generated on a real Windows host by the official non-diagnostic lifecycle.',
    'The stable key-envelope protectionId remains electron-safe-storage-v1; Windows DPAPI is proven separately by safeStorage selected backend and startup protectionProvider.',
    'Same-user malware, debugger/process-memory access and administrator compromise remain outside the absolute protection claim.'
  ]
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build218 OPEN-022 Windows closure result: ${status} (${report.passCount}/${checks.length}) — ${report.closureReadiness.open022}.`);
if (status !== 'PASS') process.exitCode = 1;
