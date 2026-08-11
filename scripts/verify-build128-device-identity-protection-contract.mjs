import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const reportPath = resolve(process.argv[2] ?? 'artifacts/validation/build128-device-identity-protection-contract.json');
const paths = {
  rootPackage: 'package.json',
  desktopPackage: 'apps/desktop/package.json',
  appMeta: 'packages/domain/src/app-meta.ts',
  protector: 'apps/desktop/src/main/device-secret-protector.ts',
  identity: 'apps/desktop/src/main/device-identity.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  main: 'apps/desktop/src/main/main.ts',
  sourceTypecheck: 'scripts/verify-desktop-main-source-types.mjs',
  decisionRegister: 'docs/10_MASTER_DECISION_REGISTER.md',
  securityBaseline: 'docs/02_SECURITY_BASELINE.md',
  securityStandard: 'docs/14_SECURITY_PRIVACY_BACKUP_STANDARD.md',
  traceability: 'docs/07_BRONZE_REQUIREMENTS_TRACEABILITY.md',
  openItems: 'docs/06_OPEN_ITEMS_AFTER_CODING_START.md',
  adr: 'docs/adr/ADR-013-os-protected-device-identity-secret.md',
  securitySummary: 'SECURITY.md',
  preflight: 'config/source-preflight-checks.json'
};
const files = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const rootPackage = JSON.parse(files.rootPackage);
const desktopPackage = JSON.parse(files.desktopPackage);
const preflight = JSON.parse(files.preflight);
const failures = [];
let assertions = 0;
const verify = (condition, message) => {
  assertions += 1;
  if (!condition) failures.push(message);
};
const includes = (file, needle, message) => verify(files[file].includes(needle), message);

verify(rootPackage.version === '27.7.2026-128', `root package version=${rootPackage.version}`);
verify(desktopPackage.version === '27.7.2026-128', `desktop package version=${desktopPackage.version}`);
includes('appMeta', "version: '27.07.2026.128'", 'application version is not Build 128');
includes('appMeta', "packageVersion: '27.7.2026-128'", 'package version is not Build 128');
includes('appMeta', "stage: 'Bronze RC2 · Aktif Geliştirme · Build 128'", 'active stage is not Build 128');
verify(rootPackage.scripts?.['verify:build128:device-identity-protection'] === 'node scripts/verify-build128-device-identity-protection-contract.mjs', 'Build 128 verification command is missing');

includes('protector', 'export interface DeviceSecretProtector', 'device secret protector port is missing');
includes('protector', "public readonly protectionId = 'electron-safe-storage-v1'", 'safeStorage protection id is missing');
includes('protector', 'isEncryptionAvailable()', 'safeStorage availability check is missing');
includes('protector', "backend !== 'basic_text'", 'unsafe Linux basic_text backend is not rejected');
includes('protector', 'encryptString(secret)', 'safeStorage encryption call is missing');
includes('protector', 'decryptString(Buffer.from(protectedBase64', 'safeStorage decryption call is missing');
includes('protector', 'protectedBase64.length % 4 !== 0', 'protected payload base64 validation is missing');

includes('identity', 'interface ProtectedDeviceIdentityEnvelope', 'protected device identity envelope is missing');
includes('identity', 'readonly schemaVersion: 2;', 'device identity envelope schema v2 is missing');
includes('identity', "readonly encoding: 'base64';", 'device identity envelope encoding contract is missing');
includes('identity', "readonly identity: Omit<DeviceIdentityMaterial, 'privateKeyPem'>;", 'public envelope must omit private key');
includes('identity', 'readonly privateKeyCiphertextBase64: string;', 'encrypted private key payload is missing');
includes('identity', 'verifyDeviceProof(identity.publicKeyPem, createDeviceProof(identity, challenge))', 'private/public key match verification is missing');
includes('identity', '#loadAndMigrateIfNeeded()', 'legacy identity migration path is missing');
includes('identity', 'this.#writeProtectedIdentity(identity, protector, true)', 'legacy plaintext identity is not migrated');
includes('identity', "throw new Error('Açık cihaz kimliği güvenli depolamaya taşınamadı", 'required protection migration is not fail-closed');
includes('identity', "throw new Error('Cihaz kimliği oluşturulamadı; işletim sistemi sırrı koruması zorunludur.", 'new identity creation is not fail-closed');
includes('identity', '.migration-backup', 'migration rollback file is missing');
includes('identity', 'renameSync(this.filePath, this.#migrationBackupPath)', 'atomic migration backup step is missing');
includes('identity', 'renameSync(temporaryPath, this.filePath)', 'atomic protected identity commit is missing');
includes('identity', 'rmSync(this.#migrationBackupPath, { force: true })', 'successful migration cleanup is missing');
includes('identity', 'privateKeyCiphertextBase64: protector.protect(identity.privateKeyPem)', 'private key is not protected before persistence');

const protectedWriterStart = files.identity.indexOf('const envelope: ProtectedDeviceIdentityEnvelope');
const protectedWriterEnd = files.identity.indexOf('this.#writePayload(envelope', protectedWriterStart);
const protectedWriter = protectedWriterStart >= 0 && protectedWriterEnd > protectedWriterStart
  ? files.identity.slice(protectedWriterStart, protectedWriterEnd)
  : '';
verify(protectedWriter.length > 0, 'protected envelope writer could not be inspected');
verify(!/identity:\s*\{[^}]*privateKeyPem/su.test(protectedWriter), 'private key leaked into public identity metadata');

includes('dataStore', 'deviceSecretProtector?: DeviceSecretProtector;', 'data store protector dependency is missing');
includes('dataStore', 'options.deviceSecretProtector', 'data store does not pass protector to identity provider');
includes('main', 'safeStorage, shell', 'Electron safeStorage import is missing');
includes('main', 'new ElectronSafeStorageDeviceSecretProtector(', 'production safeStorage adapter is not composed');
includes('main', "app.isPackaged || process.platform === 'win32'", 'packaged/Windows protection requirement is missing');
includes('sourceTypecheck', 'export const safeStorage:', 'controlled Electron type shell does not cover safeStorage');

includes('decisionRegister', '### DEC-042 — İşletim sistemi korumalı cihaz kimliği sırrı', 'DEC-042 is missing');
includes('decisionRegister', 'Windows tarafında bu', 'DEC-042 Windows protection detail is missing');
includes('securityBaseline', 'Windows DPAPI', 'security baseline is not updated');
includes('securityStandard', 'Electron `safeStorage`', 'security standard is not updated');
includes('traceability', 'Cihaz özel anahtarının OS korumalı saklanması', 'requirements traceability is not updated');
includes('openItems', 'Gerçek Windows ortamında `safeStorage`/DPAPI', 'real Windows proof remains untracked');
includes('adr', '# ADR-013 — İşletim Sistemi Korumalı Cihaz Kimliği Sırrı', 'ADR-013 is missing');
includes('securitySummary', 'Electron `safeStorage` ve Windows DPAPI', 'external security summary is not updated');

const decisionIds = [...files.decisionRegister.matchAll(/^### (DEC-\d{3})/gmu)].map((match) => match[1]);
verify(decisionIds.length === 42, `expected 42 decisions, found ${decisionIds.length}`);
verify(new Set(decisionIds).size === decisionIds.length, 'decision ids are not unique');
verify(decisionIds.at(-1) === 'DEC-042', `latest decision is ${decisionIds.at(-1)}`);
const preflightCheck = preflight.checks?.find((check) => check.id === 'build128-device-identity-protection');
verify(Boolean(preflightCheck), 'Build 128 check is missing from source preflight');
verify(preflightCheck?.script === 'scripts/verify-build128-device-identity-protection-contract.mjs', 'Build 128 preflight script mismatch');

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  build: 128,
  applicationVersion: '27.07.2026.128',
  packageVersion: '27.7.2026-128',
  stage: 'Bronze RC2 Active Development',
  scope: 'Electron safeStorage / Windows DPAPI device identity private-key envelope, legacy migration, key-pair validation and fail-closed composition',
  assertions,
  failures,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 128 device identity protection contract: ${report.status} (${assertions} assertions)`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
