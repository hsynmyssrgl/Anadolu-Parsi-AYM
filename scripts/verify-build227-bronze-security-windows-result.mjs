import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const applicationVersion = process.argv[2] ?? '02.08.2026.227';
const lifecyclePath = process.argv[3] ?? 'artifacts/validation/build227-bronze-security-windows-release-lifecycle.json';
const open021DevelopmentPath = process.argv[4] ?? 'artifacts/validation/windows-open021-development-launch-probe.json';
const open021PackagedPath = process.argv[5] ?? 'artifacts/validation/windows-open021-packaged-launch-probe.json';
const open022DevelopmentPath = process.argv[6] ?? 'artifacts/validation/windows-open022-development-launch-probe.json';
const open022PackagedPath = process.argv[7] ?? 'artifacts/validation/windows-open022-packaged-launch-probe.json';
const integrityPath = process.argv[8] ?? 'artifacts/validation/build227-bronze-security-source-integrity-windows.json';
const reportPath = process.argv[9] ?? 'artifacts/validation/build227-bronze-security-windows-closure-result.json';
const expectedBuild = Number(applicationVersion.split('.').at(-1));
if (!Number.isInteger(expectedBuild) || expectedBuild !== 227) throw new Error(`Build227 verifier received unexpected version: ${applicationVersion}`);
const exists = async (path) => { try { await stat(path); return true; } catch { return false; } };

const shared = [];
const open021 = [];
const open022 = [];
const add = (target, id, condition, details) => target.push({ id, status: condition ? 'PASS' : 'FAIL', ...(details === undefined ? {} : { details }) });

const integrity = await readJson(integrityPath);
add(shared, 'source-integrity', integrity.status === 'PASS', integrity.status);
const lifecycle = await readJson(lifecyclePath);
add(shared, 'lifecycle-official', lifecycle.official === true && lifecycle.diagnosticOnly === false, { official: lifecycle.official, diagnosticOnly: lifecycle.diagnosticOnly });
add(shared, 'lifecycle-version', lifecycle.applicationVersion === applicationVersion && lifecycle.build === 227, { applicationVersion: lifecycle.applicationVersion, build: lifecycle.build });
add(shared, 'short-install-root', typeof lifecycle.installationDirectory === 'string' && lifecycle.installationDirectory.length < 120, lifecycle.installationDirectory);
add(shared, 'installer-sha', /^[0-9a-f]{64}$/u.test(lifecycle.installer?.sha256 ?? ''), lifecycle.installer?.sha256);
for (const id of ['windows-installer-build', 'silent-install', 'installed-executable-found', 'uninstaller-found', 'uninstall-registry-found', 'silent-uninstall', 'lifecycle-cleanup']) {
  const row = lifecycle.steps?.find((item) => item.id === id);
  add(shared, `lifecycle-${id}`, row?.status === 'PASS', row?.status);
}
add(shared, 'no-install-residue', Array.isArray(lifecycle.residue) && lifecycle.residue.length === 0, lifecycle.residue);
for (const id of ['development-open021-launch', 'installed-open021-launch']) {
  const row = lifecycle.steps?.find((item) => item.id === id);
  add(open021, `lifecycle-${id}`, row?.status === 'PASS', row?.status);
}
for (const id of ['development-open022-launch', 'installed-open022-launch']) {
  const row = lifecycle.steps?.find((item) => item.id === id);
  add(open022, `lifecycle-${id}`, row?.status === 'PASS', row?.status);
}

const inspectLogs = async (target, label, path, evidence) => {
  add(target, `${label}-full-process-logs-declared`, Array.isArray(evidence.fullProcessLogs) && evidence.fullProcessLogs.length === 4, evidence.fullProcessLogs);
  for (const log of evidence.fullProcessLogs ?? []) add(target, `${label}-full-log-${log}`, await exists(join(dirname(path), log)), log);
};

const inspectOpen021 = async (label, path, mode) => {
  const evidence = await readJson(path);
  add(open021, `${label}-status`, evidence.status === 'PASS' && evidence.official === true && evidence.platform === 'win32', evidence.status);
  add(open021, `${label}-mode-version`, evidence.mode === mode && evidence.applicationVersion === applicationVersion, { mode: evidence.mode, applicationVersion: evidence.applicationVersion });
  add(open021, `${label}-two-runs`, evidence.runs?.length === 2, evidence.runs?.length);
  for (const [index, run] of (evidence.runs ?? []).entries()) {
    const security = run.windowsOpen021EfsEvidence;
    add(open021, `${label}-run${index + 1}-status`, security?.status === 'PASS' && security?.platform === 'win32' && security?.build === 227, security?.status);
    add(open021, `${label}-run${index + 1}-efs`, security?.efs?.protectionStatus === 'windows-efs' && security?.efs?.directoryEncryptedAttribute === 'PASS' && security?.efs?.snapshotEncryptedAttribute === 'PASS', security?.efs);
    add(open021, `${label}-run${index + 1}-roundtrip-cleanup`, security?.efs?.snapshotSqliteRoundTrip === 'PASS' && security?.efs?.stagingCleanup === 'PASS', security?.efs);
  }
  await inspectLogs(open021, label, path, evidence);
};

const inspectOpen022 = async (label, path, mode) => {
  const evidence = await readJson(path);
  add(open022, `${label}-status`, evidence.status === 'PASS' && evidence.official === true && evidence.platform === 'win32', evidence.status);
  add(open022, `${label}-mode-version`, evidence.mode === mode && evidence.applicationVersion === applicationVersion, { mode: evidence.mode, applicationVersion: evidence.applicationVersion });
  add(open022, `${label}-cross-process`, evidence.dpapiCrossProcessPersistence === 'PASS', evidence.dpapiCrossProcessPersistence);
  add(open022, `${label}-two-runs`, evidence.runs?.length === 2, evidence.runs?.length);
  for (const [index, run] of (evidence.runs ?? []).entries()) {
    const startup = run.startupSecurity;
    const side = run.windowsOpen022SideArtifactEvidence;
    add(open022, `${label}-run${index + 1}-startup`, startup?.status === 'PASS' && startup?.protectionProvider === 'windows-dpapi' && startup?.encryptionRoundTrip === 'PASS' && startup?.diagnosticOnly === false, startup);
    add(open022, `${label}-run${index + 1}-side-status`, side?.status === 'PASS' && side?.platform === 'win32' && side?.build === 227, side?.status);
    add(open022, `${label}-run${index + 1}-provider`, side?.safeStorage?.provider === 'windows-dpapi' && side?.safeStorage?.providerBasis === 'windows-current-user-dpapi-platform-contract' && side?.safeStorage?.protectionId === 'windows-dpapi-current-user-v1', side?.safeStorage);
    add(open022, `${label}-run${index + 1}-crypto`, side?.safeStorage?.encryptionAvailable === 'PASS' && side?.safeStorage?.encryptDecryptRoundTrip === 'PASS' && side?.safeStorage?.crossProcessPersistence === 'PASS', side?.safeStorage);
    add(open022, `${label}-run${index + 1}-backend-observational`, side?.safeStorage?.selectedBackend === 'unknown' ? side.safeStorage.runtimeBackendReported === false : true, side?.safeStorage);
    add(open022, `${label}-run${index + 1}-key-envelope`, side?.keyEnvelope?.deviceWrapped === 'PASS' && side?.keyEnvelope?.noPlainDataKey === 'PASS', side?.keyEnvelope);
    add(open022, `${label}-run${index + 1}-containers`, side?.containers?.pplog === 'PASS' && side?.containers?.pptdiag === 'PASS' && side?.containers?.pptreport === 'PASS' && side?.containers?.ciphertextHidesPlaintext === 'PASS' && side?.containers?.decryptRoundTrip === 'PASS', side?.containers);
    add(open022, `${label}-run${index + 1}-startup-container`, side?.startupEvidence?.encryptedAtRest === 'PASS' && side?.startupEvidence?.decryptRoundTrip === 'PASS', side?.startupEvidence);
  }
  await inspectLogs(open022, label, path, evidence);
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
const results = [...shared.map((item) => ({ scope: 'shared', ...item })), ...open021.map((item) => ({ scope: 'OPEN-021', ...item })), ...open022.map((item) => ({ scope: 'OPEN-022', ...item }))];
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  build: 227,
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
    'READY_TO_CLOSE is valid only for evidence generated on real Windows from the exact Build227 source snapshot.',
    'NOT_RUN is never treated as PASS.',
    'The verifier does not mutate the master ledger.'
  ]
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build227 Windows closure: ${status}; OPEN-021=${report.closureReadiness.open021}; OPEN-022=${report.closureReadiness.open022}.`);
if (open021Pass && open022Pass) process.exitCode = 0;
else if (open021Pass) process.exitCode = 21;
else if (open022Pass) process.exitCode = 22;
else process.exitCode = 1;
