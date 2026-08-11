import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const reportArg = process.argv.indexOf('--report');
const reportPath = resolve(reportArg >= 0 ? process.argv[reportArg + 1] : 'artifacts/validation/build129-mfa-secret-protection-contract.json');
const paths = {
  rootPackage: 'package.json',
  desktopPackage: 'apps/desktop/package.json',
  appMeta: 'packages/domain/src/app-meta.ts',
  envelope: 'apps/desktop/src/main/mfa-secret-protection.ts',
  authAdapter: 'apps/desktop/src/main/auth-application-adapter.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  main: 'apps/desktop/src/main/main.ts',
  repositoryContract: 'packages/repository-contracts/src/account-repository.ts',
  repository: 'packages/repositories/src/account-repository.ts',
  mfaVerification: 'scripts/verify-mfa-trusted-device.mjs',
  migrationVerification: 'scripts/verify-mfa-secret-legacy-migration.mjs',
  runtimeVerification: 'scripts/verify-mfa-secret-protection-runtime.mjs',
  decisionRegister: 'docs/10_MASTER_DECISION_REGISTER.md',
  securityBaseline: 'docs/02_SECURITY_BASELINE.md',
  securityStandard: 'docs/14_SECURITY_PRIVACY_BACKUP_STANDARD.md',
  traceability: 'docs/07_BRONZE_REQUIREMENTS_TRACEABILITY.md',
  openItems: 'docs/06_OPEN_ITEMS_AFTER_CODING_START.md',
  adr: 'docs/adr/ADR-014-os-protected-mfa-secret.md',
  securitySummary: 'SECURITY.md',
  preflight: 'config/source-preflight-checks.json'
};
const files = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const rootPackage = JSON.parse(files.rootPackage);
const desktopPackage = JSON.parse(files.desktopPackage);
const preflight = JSON.parse(files.preflight);
const failures = [];
let assertions = 0;
const verify = (condition, message) => { assertions += 1; if (!condition) failures.push(message); };
const includes = (key, needle, message) => verify(files[key].includes(needle), message);

verify(rootPackage.version === '27.7.2026-129', `root package version=${rootPackage.version}`);
verify(desktopPackage.version === '27.7.2026-129', `desktop package version=${desktopPackage.version}`);
includes('appMeta', "version: '27.07.2026.129'", 'application version is not Build 129');
includes('appMeta', "packageVersion: '27.7.2026-129'", 'package version is not Build 129');
includes('appMeta', "stage: 'Bronze RC2 · Aktif Geliştirme · Build 129'", 'active stage is not Build 129');
verify(rootPackage.scripts?.['verify:build129:mfa-secret-protection'] === 'node scripts/verify-build129-mfa-secret-protection-contract.mjs', 'Build 129 verification command is missing');
verify(rootPackage.scripts?.['verify:mfa-secret-protection:runtime'] === 'node scripts/verify-mfa-secret-protection-runtime.mjs', 'MFA runtime verification command is missing');

includes('envelope', 'interface ProtectedMfaSecretEnvelope', 'protected MFA envelope is missing');
includes('envelope', 'readonly schemaVersion: 1;', 'MFA envelope schema version is missing');
includes('envelope', "readonly purpose: 'totp';", 'MFA envelope purpose binding is missing');
includes('envelope', 'readonly protectionId: string;', 'MFA envelope protection id is missing');
includes('envelope', 'readonly ciphertextBase64: string;', 'MFA ciphertext field is missing');
includes('envelope', 'TOTP_SECRET_PATTERN', 'TOTP secret format validation is missing');
includes('envelope', 'protector.protect(secret)', 'TOTP secret is not protected');
includes('envelope', 'protector.unprotect(envelope.ciphertextBase64)', 'TOTP secret is not unprotected');
includes('envelope', 'envelope.protectionId !== protector.protectionId', 'protection provider mismatch is not rejected');
verify(!files.envelope.includes('plaintextSecret:'), 'MFA envelope exposes a plaintext secret field');

includes('authAdapter', 'readonly mfaSecretProtector?: DeviceSecretProtector;', 'auth adapter protector dependency is missing');
includes('authAdapter', 'isProtectedMfaSecret(storedValue)', 'protected secret detection is missing');
includes('authAdapter', 'unprotectMfaSecret(protector, storedValue)', 'protected secret hydration is missing');
includes('authAdapter', 'protectMfaSecret(protector, storedValue)', 'legacy secret protection is missing');
includes('authAdapter', 'protectLegacyTwoFactorSecrets', 'legacy migration repository call is missing');
includes('authAdapter', 'expectedPlaintext', 'legacy migration compare-and-swap expectation is missing');
includes('authAdapter', 'required_protector_unavailable', 'required protection fail-closed path is missing');
includes('authAdapter', 'legacy_migration_conflict', 'legacy migration conflict refusal is missing');
includes('authAdapter', 'secret: protectedSecret.value', 'new pending TOTP secret is not stored protected');
includes('authAdapter', "category: 'security'", 'MFA protection errors are not classified as security');

includes('repositoryContract', 'export interface ProtectLegacyTwoFactorSecretsInput', 'legacy migration repository input is missing');
includes('repositoryContract', 'protectLegacyTwoFactorSecrets', 'legacy migration repository port is missing');
includes('repository', "predicates.push('totp_secret=?')", 'active TOTP expected-value predicate is missing');
includes('repository', "predicates.push('pending_totp_secret=?')", 'pending TOTP expected-value predicate is missing');
includes('repository', 'result.changes === 1', 'atomic migration success check is missing');
includes('repository', "assignments.join(',')", 'atomic multi-field migration statement is missing');

includes('dataStore', 'mfaSecretProtector?: DeviceSecretProtector;', 'data store MFA protector option is missing');
includes('dataStore', 'mfaSecretProtector: options.mfaSecretProtector', 'data store does not compose MFA protector');
includes('main', 'const osSecretProtector = new ElectronSafeStorageDeviceSecretProtector', 'shared OS protector composition is missing');
includes('main', 'deviceSecretProtector: osSecretProtector', 'device identity no longer uses shared protector');
includes('main', 'mfaSecretProtector: osSecretProtector', 'MFA does not use OS protector in production');
includes('main', "app.isPackaged || process.platform === 'win32'", 'packaged/Windows protection requirement is missing');

includes('mfaVerification', 'mfaSecretProtector', 'MFA integration verification does not use protected storage');
includes('mfaVerification', 'assert.notEqual(row.pending_totp_secret, setup.secret)', 'integration verification does not reject plaintext persistence');
includes('migrationVerification', 'assert.equal(plaintext, setup.secret)', 'legacy test does not establish plaintext baseline');
includes('migrationVerification', 'assert.notEqual(protectedValue, setup.secret)', 'legacy test does not prove migration');
includes('migrationVerification', 'migrated.enableTwoFactor', 'legacy migration does not prove behavior remains usable');
includes('runtimeVerification', 'assert.equal(protectedValue.includes(secret), false)', 'runtime test does not prove plaintext non-disclosure');
includes('runtimeVerification', 'assert.throws', 'runtime refusal paths are not covered');

includes('decisionRegister', '### DEC-043 — İşletim sistemi korumalı TOTP MFA sırrı', 'DEC-043 is missing');
includes('securityBaseline', 'TOTP sırları veritabanında açık tutulmaz', 'security baseline is not updated');
includes('securityStandard', 'Aktif ve bekleyen TOTP sırlarının', 'security standard is not updated');
includes('traceability', 'TOTP sırrının OS korumalı saklanması', 'traceability is not updated');
includes('openItems', 'TOTP sırrı oluşturma ve legacy migration kanıtı', 'real Windows MFA migration proof is not tracked');
includes('adr', '# ADR-014 — İşletim Sistemi Korumalı MFA Sırrı', 'ADR-014 is missing');
includes('securitySummary', 'TOTP MFA sırları açık veritabanı metni olarak saklanmaz', 'security summary is not updated');

const decisionIds = [...files.decisionRegister.matchAll(/^### (DEC-\d{3})/gmu)].map((match) => match[1]);
verify(decisionIds.length === 43, `expected 43 decisions, found ${decisionIds.length}`);
verify(new Set(decisionIds).size === decisionIds.length, 'decision ids are not unique');
verify(decisionIds.at(-1) === 'DEC-043', `latest decision is ${decisionIds.at(-1)}`);
const preflightCheck = preflight.checks?.find((check) => check.id === 'build129-mfa-secret-protection');
verify(Boolean(preflightCheck) && !preflight.checks?.some((check) => check.id === 'build128-device-identity-protection'), 'active source preflight must include Build 129 and exclude the stale Build 128 version-specific gate');
verify(preflightCheck?.script === 'scripts/verify-build129-mfa-secret-protection-contract.mjs', 'Build 129 preflight script mismatch');

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  build: 129,
  applicationVersion: '27.07.2026.129',
  packageVersion: '27.7.2026-129',
  stage: 'Bronze RC2 Active Development',
  scope: 'OS-protected TOTP MFA secret envelope, new-write protection, transaction-bound legacy migration and fail-closed composition',
  assertions,
  failures,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 129 MFA secret protection contract: ${report.status} (${assertions} assertions)`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
