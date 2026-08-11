import { mkdir, readFile, writeFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const applicationVersion = process.argv[2] ?? '02.08.2026.220';
const lifecyclePath = process.argv[3] ?? 'artifacts/validation/build220-bronze-security-windows-release-lifecycle.json';
const open021DevelopmentPath = process.argv[4] ?? 'artifacts/validation/windows-open021-development-launch-probe.json';
const open021PackagedPath = process.argv[5] ?? 'artifacts/validation/windows-open021-packaged-launch-probe.json';
const open022DevelopmentPath = process.argv[6] ?? 'artifacts/validation/windows-open022-development-launch-probe.json';
const open022PackagedPath = process.argv[7] ?? 'artifacts/validation/windows-open022-packaged-launch-probe.json';
const integrityPath = process.argv[8] ?? 'artifacts/validation/build220-bronze-security-source-integrity-windows.json';
const reportPath = process.argv[9] ?? 'artifacts/validation/build220-bronze-security-windows-closure-result.json';
const expectedBuild = Number(applicationVersion.split('.').at(-1));
if (!Number.isInteger(expectedBuild) || expectedBuild !== 220) throw new Error(`Build220 unified verifier received unexpected application version: ${applicationVersion}`);

const shared = [];
const open021 = [];
const open022 = [];
const add = (target, id, condition, details = undefined) => target.push({ id, status: condition ? 'PASS' : 'FAIL', ...(details !== undefined ? { details } : {}) });

const integrity = await readJson(integrityPath);
add(shared, 'source-integrity', integrity.status === 'PASS', integrity.status);

const lifecycle = await readJson(lifecyclePath);
add(shared, 'lifecycle-official', lifecycle.official === true && lifecycle.diagnosticOnly === false, { official: lifecycle.official, diagnosticOnly: lifecycle.diagnosticOnly });
add(shared, 'lifecycle-version', lifecycle.applicationVersion === applicationVersion && lifecycle.build === 220, { applicationVersion: lifecycle.applicationVersion, build: lifecycle.build });
add(shared, 'installer-sha', typeof lifecycle.installer?.sha256 === 'string' && /^[0-9a-f]{64}$/.test(lifecycle.installer.sha256), lifecycle.installer?.sha256);
for (const step of ['windows-installer-build','silent-install','silent-uninstall']) {
  const row = lifecycle.steps?.find((item) => item.id === step);
  add(shared, `lifecycle-${step}`, row?.status === 'PASS', row?.status);
}
for (const step of ['development-open021-launch','installed-open021-launch']) {
  const row = lifecycle.steps?.find((item) => item.id === step);
  add(open021, `lifecycle-${step}`, row?.status === 'PASS', row?.status);
}
for (const step of ['development-open022-launch','installed-open022-launch']) {
  const row = lifecycle.steps?.find((item) => item.id === step);
  add(open022, `lifecycle-${step}`, row?.status === 'PASS', row?.status);
}

const inspectOpen021 = async (label, path, mode) => {
  const evidence = await readJson(path);
  add(open021, `${label}-status`, evidence.status === 'PASS' && evidence.official === true && evidence.platform === 'win32', { status: evidence.status, official: evidence.official, platform: evidence.platform });
  add(open021, `${label}-mode`, evidence.mode === mode, evidence.mode);
  add(open021, `${label}-version`, evidence.applicationVersion === applicationVersion, evidence.applicationVersion);
  add(open021, `${label}-efs-runtime`, evidence.windowsOpen021EfsRuntime === 'PASS', evidence.windowsOpen021EfsRuntime);
  add(open021, `${label}-sandbox`, evidence.rendererSandboxPolicy === 'PASS', evidence.rendererSandboxPolicy);
  add(open021, `${label}-two-runs`, Array.isArray(evidence.runs) && evidence.runs.length === 2, Array.isArray(evidence.runs) ? evidence.runs.length : 0);
  for (const [index, run] of (evidence.runs ?? []).entries()) {
    const security = run.windowsOpen021EfsEvidence;
    add(open021, `${label}-run${index + 1}-status`, security?.status === 'PASS' && security?.platform === 'win32' && security?.build === 220, security?.status);
    add(open021, `${label}-run${index + 1}-memory-only`, security?.efs?.activeDatabase === 'memory-only', security?.efs?.activeDatabase);
    add(open021, `${label}-run${index + 1}-efs-directory`, security?.efs?.directoryEncryptedAttribute === 'PASS', security?.efs?.directoryEncryptedAttribute);
    add(open021, `${label}-run${index + 1}-efs-snapshot`, security?.efs?.snapshotEncryptedAttribute === 'PASS', security?.efs?.snapshotEncryptedAttribute);
    add(open021, `${label}-run${index + 1}-sqlite-roundtrip`, security?.efs?.snapshotSqliteRoundTrip === 'PASS', security?.efs?.snapshotSqliteRoundTrip);
    add(open021, `${label}-run${index + 1}-cleanup`, security?.efs?.stagingCleanup === 'PASS', security?.efs?.stagingCleanup);
  }
};

const inspectOpen022 = async (label, path, mode) => {
  const evidence = await readJson(path);
  add(open022, `${label}-status`, evidence.status === 'PASS' && evidence.official === true && evidence.platform === 'win32', { status: evidence.status, official: evidence.official, platform: evidence.platform });
  add(open022, `${label}-mode`, evidence.mode === mode, evidence.mode);
  add(open022, `${label}-version`, evidence.applicationVersion === applicationVersion, evidence.applicationVersion);
  add(open022, `${label}-dpapi-persistence`, evidence.dpapiCrossProcessPersistence === 'PASS', evidence.dpapiCrossProcessPersistence);
  add(open022, `${label}-safe-storage`, evidence.windowsSafeStorageDpapiRuntime === 'PASS', evidence.windowsSafeStorageDpapiRuntime);
  add(open022, `${label}-protected-side-artifact`, evidence.protectedSideArtifactWindowsRuntime === 'PASS', evidence.protectedSideArtifactWindowsRuntime);
  add(open022, `${label}-volatile-browser-crash`, evidence.volatileBrowserCrashRuntime === 'PASS', evidence.volatileBrowserCrashRuntime);
  add(open022, `${label}-sandbox`, evidence.rendererSandboxPolicy === 'PASS', evidence.rendererSandboxPolicy);
  add(open022, `${label}-two-runs`, Array.isArray(evidence.runs) && evidence.runs.length === 2, Array.isArray(evidence.runs) ? evidence.runs.length : 0);
  for (const [index, run] of (evidence.runs ?? []).entries()) {
    const startup = run.startupSecurity;
    const side = run.windowsOpen022SideArtifactEvidence;
    add(open022, `${label}-run${index + 1}-startup-dpapi`, startup?.status === 'PASS' && startup?.protectionProvider === 'windows-dpapi' && startup?.encryptionRoundTrip === 'PASS' && startup?.diagnosticOnly === false, startup);
    add(open022, `${label}-run${index + 1}-side-status`, side?.status === 'PASS' && side?.platform === 'win32' && side?.build === 220, side?.status);
    add(open022, `${label}-run${index + 1}-backend`, side?.safeStorage?.selectedBackend === 'dpapi' && side?.safeStorage?.protectionId === 'electron-safe-storage-v1', side?.safeStorage);
    add(open022, `${label}-run${index + 1}-key-envelope`, side?.keyEnvelope?.deviceWrapped === 'PASS' && side?.keyEnvelope?.noPlainDataKey === 'PASS', side?.keyEnvelope);
    add(open022, `${label}-run${index + 1}-containers`, side?.containers?.pplog === 'PASS' && side?.containers?.pptdiag === 'PASS' && side?.containers?.pptreport === 'PASS' && side?.containers?.ciphertextHidesPlaintext === 'PASS' && side?.containers?.decryptRoundTrip === 'PASS', side?.containers);
    add(open022, `${label}-run${index + 1}-startup-container`, side?.startupEvidence?.encryptedAtRest === 'PASS' && side?.startupEvidence?.decryptRoundTrip === 'PASS' && side?.startupEvidence?.protectionProvider === 'windows-dpapi', side?.startupEvidence);
    add(open022, `${label}-run${index + 1}-volatile`, side?.volatilePaths?.sessionDataUnderVolatileRoot === 'PASS' && side?.volatilePaths?.crashDumpsUnderVolatileRoot === 'PASS', side?.volatilePaths);
  }
};

await inspectOpen021('open021-development', open021DevelopmentPath, 'development');
await inspectOpen021('open021-packaged', open021PackagedPath, 'packaged');
await inspectOpen022('open022-development', open022DevelopmentPath, 'development');
await inspectOpen022('open022-packaged', open022PackagedPath, 'packaged');

const pass = (items) => items.every((item) => item.status === 'PASS');
const sharedPass = pass(shared);
const open021Pass = sharedPass && pass(open021);
const open022Pass = sharedPass && pass(open022);
const status = open021Pass && open022Pass ? 'PASS' : open021Pass || open022Pass ? 'PARTIAL' : 'FAIL';
const results = [...shared.map((x) => ({ scope: 'shared', ...x })), ...open021.map((x) => ({ scope: 'OPEN-021', ...x })), ...open022.map((x) => ({ scope: 'OPEN-022', ...x }))];
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  build: 220,
  applicationVersion,
  evidencePurpose: 'Unified OPEN-021 and OPEN-022 real Windows closure readiness',
  status,
  checks: results.length,
  passCount: results.filter((item) => item.status === 'PASS').length,
  failCount: results.filter((item) => item.status === 'FAIL').length,
  results,
  closureReadiness: {
    open021: open021Pass ? 'READY_TO_CLOSE' : 'NOT_READY',
    open022: open022Pass ? 'READY_TO_CLOSE' : 'NOT_READY',
    ledgerMutationPerformed: false
  },
  evidence: { lifecyclePath, open021DevelopmentPath, open021PackagedPath, open022DevelopmentPath, open022PackagedPath, integrityPath },
  generatedAt: new Date().toISOString(),
  limitations: [
    'READY_TO_CLOSE is valid only for evidence generated on a real Windows host from the exact Build220 source snapshot.',
    'A READY_TO_CLOSE result never mutates the master ledger automatically.',
    'OPEN-002 clean npm ci is not closed merely because npm ci is a prerequisite of this Windows run.',
    'Administrator compromise, same-user malware/debugger and live process-memory access remain outside any absolute protection claim.'
  ]
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build220 unified Windows closure result: ${status} — OPEN-021=${report.closureReadiness.open021}, OPEN-022=${report.closureReadiness.open022}.`);
if (open021Pass && open022Pass) process.exitCode = 0;
else if (open021Pass) process.exitCode = 21;
else if (open022Pass) process.exitCode = 22;
else process.exitCode = 1;
