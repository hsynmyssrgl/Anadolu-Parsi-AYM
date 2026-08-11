import { mkdir, readFile, writeFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const applicationVersion = process.argv[2] ?? '01.08.2026.215';
const developmentPath = process.argv[3] ?? 'artifacts/validation/windows-real-launch-probe.json';
const packagedPath = process.argv[4] ?? 'artifacts/validation/windows-packaged-launch-probe.json';
const reportPath = process.argv[5] ?? 'artifacts/validation/build215-windows-security-evidence-result.json';
const expectedBuild = Number(applicationVersion.split('.').at(-1));
if (!Number.isInteger(expectedBuild) || expectedBuild !== 215) throw new Error(`Build215 evidence verifier received unexpected application version: ${applicationVersion}`);

const checks = [];
const add = (id, condition, details = undefined) => {
  checks.push({ id, status: condition ? 'PASS' : 'FAIL', ...(details ? { details } : {}) });
};

const inspect = async (label, path, mode) => {
  const evidence = await readJson(path);
  add(`${label}-status`, evidence.status === 'PASS', evidence.status);
  add(`${label}-mode`, evidence.mode === mode, evidence.mode);
  add(`${label}-version`, evidence.applicationVersion === applicationVersion, evidence.applicationVersion);
  add(`${label}-dpapi-persistence`, evidence.dpapiCrossProcessPersistence === 'PASS', evidence.dpapiCrossProcessPersistence);
  add(`${label}-sandbox`, evidence.rendererSandboxPolicy === 'PASS', evidence.rendererSandboxPolicy);
  add(`${label}-efs`, evidence.windowsEfsRuntime === 'PASS', evidence.windowsEfsRuntime);
  add(`${label}-safe-storage-dpapi`, evidence.windowsSafeStorageDpapiRuntime === 'PASS', evidence.windowsSafeStorageDpapiRuntime);
  add(`${label}-protected-side-artifact`, evidence.protectedSideArtifactWindowsRuntime === 'PASS', evidence.protectedSideArtifactWindowsRuntime);
  add(`${label}-two-runs`, Array.isArray(evidence.runs) && evidence.runs.length === 2, Array.isArray(evidence.runs) ? evidence.runs.length : 0);
  for (const [index, run] of (evidence.runs ?? []).entries()) {
    const security = run.windowsSecurityEvidence;
    add(`${label}-run${index + 1}-security-status`, security?.status === 'PASS', security?.status);
    add(`${label}-run${index + 1}-efs`, security?.efs?.status === 'PASS' && security?.efs?.snapshotEncryptedAttribute === 'PASS', security?.efs);
    add(`${label}-run${index + 1}-dpapi`, security?.protectedSideArtifacts?.protectionId === 'electron-safe-storage-v1' && security?.protectedSideArtifacts?.selectedStorageBackend === 'dpapi' && security?.protectedSideArtifacts?.decryptRoundTrip === 'PASS', security?.protectedSideArtifacts);
    add(`${label}-run${index + 1}-no-plaintext`, security?.protectedSideArtifacts?.ciphertextHidesProbePlaintext === 'PASS', security?.protectedSideArtifacts?.ciphertextHidesProbePlaintext);
  }
};

await inspect('development', developmentPath, 'development');
await inspect('packaged', packagedPath, 'packaged');
const status = checks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL';
await mkdir('artifacts/validation', { recursive: true });
await writeFile(reportPath, `${JSON.stringify({
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  build: 215,
  applicationVersion,
  status,
  checks: checks.length,
  results: checks,
  evidence: { developmentPath, packagedPath },
  generatedAt: new Date().toISOString(),
  limitations: [
    'PASS is valid only when the input launch probes were generated on a real Windows host by the official non-diagnostic lifecycle.',
    'Same-user malware, debugger/process-memory access and administrator compromise remain outside the absolute protection claim.'
  ]
}, null, 2)}\n`);
console.log(`Build215 Windows security evidence result: ${status} (${checks.filter((item) => item.status === 'PASS').length}/${checks.length}).`);
if (status !== 'PASS') process.exitCode = 1;
