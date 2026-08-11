import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const reportPath = process.argv[2] ?? 'artifacts/validation/build218-open022-result-runtime.json';
const root = process.cwd();
const tempRoot = await mkdtemp(join(tmpdir(), 'ppt-build218-open022-'));
const evidenceRoot = join(tempRoot, 'evidence');
await mkdir(evidenceRoot, { recursive: true });
const writeJson = (name, value) => writeFile(join(evidenceRoot, name), `${JSON.stringify(value, null, 2)}\n`);

const side = {
  schemaVersion: 1, build: 218, status: 'PASS', platform: 'win32', applicationVersion: '01.08.2026.218',
  safeStorage: { status: 'PASS', selectedBackend: 'dpapi', protectionId: 'electron-safe-storage-v1', encryptionAvailable: 'PASS' },
  keyEnvelope: { status: 'PASS', deviceWrapped: 'PASS', noPlainDataKey: 'PASS' },
  containers: { pplog: 'PASS', pptdiag: 'PASS', pptreport: 'PASS', ciphertextHidesPlaintext: 'PASS', decryptRoundTrip: 'PASS' },
  startupEvidence: { status: 'PASS', encryptedAtRest: 'PASS', decryptRoundTrip: 'PASS', protectionProvider: 'windows-dpapi' },
  volatilePaths: { status: 'PASS', sessionDataUnderVolatileRoot: 'PASS', crashDumpsUnderVolatileRoot: 'PASS' }
};
const startup = { status: 'PASS', protectionProvider: 'windows-dpapi', encryptionRoundTrip: 'PASS', diagnosticOnly: false };
const run = { status: 'PASS', applicationVersion: '01.08.2026.218', startupSecurity: startup, windowsOpen022SideArtifactEvidence: side };
const launch = (mode) => ({ schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', applicationVersion: '01.08.2026.218', mode, status: 'PASS', platform: 'win32', official: true, sameUserDataAcrossRuns: true, dpapiCrossProcessPersistence: 'PASS', windowsSafeStorageDpapiRuntime: 'PASS', protectedSideArtifactWindowsRuntime: 'PASS', volatileBrowserCrashRuntime: 'PASS', rendererSandboxPolicy: 'PASS', runs: [run, run] });
const lifecycle = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', applicationVersion: '01.08.2026.218', packageVersion: '1.8.2026-218', build: 218, openWorkId: 'OPEN-022', status: 'PASS', official: true, diagnosticOnly: false, installer: { sha256: 'b'.repeat(64) }, steps: ['windows-installer-build','development-open022-launch','silent-install','installed-open022-launch','silent-uninstall'].map((id) => ({ id, status: 'PASS', exitCode: 0 })) };
const integrity = { schemaVersion: 1, status: 'PASS' };
await writeJson('lifecycle.json', lifecycle); await writeJson('development.json', launch('development')); await writeJson('packaged.json', launch('packaged')); await writeJson('integrity.json', integrity);

const verifier = resolve(root, 'scripts/verify-build218-open022-windows-result.mjs');
const invoke = (outName) => spawnSync(process.execPath, [verifier, '01.08.2026.218', join(evidenceRoot,'lifecycle.json'), join(evidenceRoot,'development.json'), join(evidenceRoot,'packaged.json'), join(evidenceRoot,'integrity.json'), join(evidenceRoot,outName)], { cwd: root, encoding: 'utf8' });
const valid = invoke('valid-result.json');
const validResult = JSON.parse(await readFile(join(evidenceRoot,'valid-result.json'),'utf8'));
const tampered = launch('packaged');
tampered.runs = JSON.parse(JSON.stringify(tampered.runs));
tampered.runs[1].windowsOpen022SideArtifactEvidence.containers.pptdiag = 'FAIL';
await writeJson('packaged.json', tampered);
const invalid = invoke('tampered-result.json');
const invalidResult = JSON.parse(await readFile(join(evidenceRoot,'tampered-result.json'),'utf8'));
const checks = [
  { id: 'valid-process-pass', status: valid.status === 0 ? 'PASS' : 'FAIL', details: valid.stderr },
  { id: 'valid-result-pass', status: validResult.status === 'PASS' ? 'PASS' : 'FAIL', details: validResult.status },
  { id: 'valid-ready-to-close', status: validResult.closureReadiness.open022 === 'READY_TO_CLOSE' ? 'PASS' : 'FAIL', details: validResult.closureReadiness },
  { id: 'valid-open021-unchanged', status: validResult.closureReadiness.open021 === 'UNCHANGED' ? 'PASS' : 'FAIL', details: validResult.closureReadiness },
  { id: 'tamper-process-fail', status: invalid.status !== 0 ? 'PASS' : 'FAIL', details: invalid.stdout },
  { id: 'tamper-result-fail', status: invalidResult.status === 'FAIL' ? 'PASS' : 'FAIL', details: invalidResult.status },
  { id: 'tamper-not-ready', status: invalidResult.closureReadiness.open022 === 'NOT_READY' ? 'PASS' : 'FAIL', details: invalidResult.closureReadiness }
];
const status = checks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL';
await mkdir('artifacts/validation', { recursive: true });
await writeFile(reportPath, `${JSON.stringify({ schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', applicationVersion: '01.08.2026.218', build: 218, openWorkId: 'OPEN-022', status, checks: checks.length, passCount: checks.filter((item) => item.status === 'PASS').length, results: checks, generatedAt: new Date().toISOString() }, null, 2)}\n`);
await rm(tempRoot, { recursive: true, force: true });
console.log(`Build218 OPEN-022 result runtime: ${status} (${checks.filter((item) => item.status === 'PASS').length}/${checks.length}).`);
if (status !== 'PASS') process.exitCode = 1;
