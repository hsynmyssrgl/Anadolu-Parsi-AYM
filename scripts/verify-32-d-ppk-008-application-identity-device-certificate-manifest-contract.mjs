import { mkdir, readFile, writeFile } from 'node:fs/promises';

const checks = [];
const failures = [];
const check = (name, condition, details = undefined) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status, ...(details === undefined ? {} : { details }) });
  if (!condition) failures.push(name);
};

const sources = Object.fromEntries(await Promise.all(Object.entries({
  kernel: 'packages/platform-policy/src/policy-kernel.ts',
  enforcement: 'packages/platform-policy/src/policy-enforcement-point.ts',
  targetedTest: 'packages/platform-policy/application-identity-device-certificate.test.ts',
  coreMain: 'apps/core-service/src/main.ts',
  deviceIdentity: 'apps/desktop/src/main/device-identity.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  archiveRuntime: 'apps/desktop/src/main/archive-production-policy-runtime.ts',
  financeRuntime: 'apps/desktop/src/main/finance-production-policy-runtime.ts',
  healthRuntime: 'apps/desktop/src/main/health-production-policy-runtime.ts',
  lifeRuntime: 'apps/desktop/src/main/life-production-policy-runtime.ts',
  locationRuntime: 'apps/desktop/src/main/location-production-policy-runtime.ts',
  timelineRuntime: 'apps/desktop/src/main/timeline-production-policy-runtime.ts',
  repositoryContract: 'packages/repository-contracts/src/platform-policy-transaction-repository.ts',
  repository: 'packages/repositories/src/platform-policy-transaction-repository.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  main: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  decision: 'docs/decisions/DEC-189-ppk-008-application-identity-device-certificate-manifest.md',
  audit: 'docs/audit/32-D_PPK-008_UYGULAMA_KIMLIGI_CIHAZ_SERTIFIKASI_UST_KAPANIS.md'
}).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));

const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const requirement = registry.requirements.find((item) => item.id === 'PPK-008');
const scope = JSON.parse(await readFile('config/32-d-ppk-008-application-identity-device-certificate-manifest-scope.json', 'utf8'));
const productionRuntimes = [
  sources.archiveRuntime, sources.financeRuntime, sources.healthRuntime,
  sources.lifeRuntime, sources.locationRuntime, sources.timelineRuntime
];

check('closed application identity vocabulary is exported', sources.kernel.includes('export const PLATFORM_APPLICATION_IDS'));
check('application vocabulary contains every required Windows Apple service and worker identity', [
  'windows-desktop','windows-core-service','windows-cluster-agent','macos-companion','ios-companion',
  'ipados-companion','watchos-companion','visionos-companion','ocr-worker','ai-worker',
  'translation-worker','communication-service','backup-worker','signed-plugin'
].every((value) => sources.kernel.includes(`'${value}'`)));
check('application identity manifest has an explicit schema', sources.kernel.includes('export interface PlatformApplicationIdentityManifest'));
check('manifest binds application id and version', sources.kernel.includes('readonly applicationId: PlatformApplicationId') && sources.kernel.includes('readonly applicationVersion: string'));
check('manifest binds canonical capability set', sources.kernel.includes('readonly capabilities: readonly PlatformCapability[]'));
check('manifest binds certificate requirement', sources.kernel.includes('readonly deviceCertificateRequired: boolean'));
check('manifest publishes SHA-256 binding', sources.kernel.includes('readonly capabilityManifestSha256: string'));
check('manifest hash canonicalizes capabilities', sources.kernel.includes('platformCapabilityManifestHash') && sources.kernel.includes('capabilities: [...input.capabilities].sort()'));
check('duplicate certificate registrations fail kernel construction', sources.kernel.includes('certificateRequired.size !==') && sources.targetedTest.includes('duplicate or unknown certificate application registrations'));
check('unknown application registrations fail kernel construction', sources.kernel.includes('platformApplicationIdSet.has(applicationId)'));
check('signed policy package carries application manifests', sources.kernel.includes('readonly applicationManifests:') && sources.kernel.includes('applicationManifests: this.#config.applicationManifests'));
check('device certificate has an explicit closed issuer', sources.kernel.includes("readonly issuer: 'trusted-device-registry'"));
check('device certificate binds device and application identity', sources.kernel.includes('export interface PlatformDeviceCertificate') && sources.kernel.includes('readonly deviceId: string'));
check('device certificate binds public-key fingerprint', sources.kernel.includes('readonly publicKeyFingerprintSha256: string'));
check('device certificate binds capability manifest', sources.kernel.includes('readonly capabilityManifestSha256: string'));
check('device certificate binds issue and expiry times', sources.kernel.includes('readonly issuedAt: string') && sources.kernel.includes('readonly expiresAt: string'));
check('certificate hash covers only the canonical certificate payload', sources.kernel.includes('certificateSha256: sha256(payload)'));
check('certificate verification checks exact device and application', sources.kernel.includes('certificate.deviceId === expected.deviceId') && sources.kernel.includes('certificate.applicationId === expected.applicationId'));
check('certificate verification checks manifest and lifetime', sources.kernel.includes('certificate.capabilityManifestSha256 === expected.capabilityManifestSha256') && sources.kernel.includes('occurredAt <= Date.parse(certificate.expiresAt)'));
check('strict kernel denies missing or mismatched manifest', sources.kernel.includes("return deny('APPLICATION_MANIFEST_MISMATCH')"));
check('strict kernel denies invalid certificate', sources.kernel.includes("return deny('DEVICE_CERTIFICATE_INVALID')"));
check('PEP mints certificate only from trusted authority facts', sources.enforcement.includes('devicePublicKeyFingerprintSha256') && sources.enforcement.includes('createPlatformDeviceCertificate({'));
check('PEP rejects certificate not bound to signed manifest', sources.enforcement.includes('Device certificate is invalid or not bound to the application manifest'));
check('strict request carries manifest and complete certificate', sources.enforcement.includes('capabilityManifestSha256: authority.capabilityManifestSha256') && sources.enforcement.includes('deviceCertificate: authority.deviceCertificate'));
check('decision and receipt verification bind manifest and certificate hashes', sources.enforcement.includes('authorization.decision.capabilityManifestSha256') && sources.enforcement.includes('authorization.decision.deviceCertificateSha256'));
check('active transaction context revalidates both identity hashes', sources.enforcement.includes('context.capabilityManifestSha256 !== context.receiptRecord.capabilityManifestSha256') && sources.enforcement.includes('context.deviceCertificateSha256 !== context.receiptRecord.deviceCertificateSha256'));
check('Core Service registers all fourteen production identities', (sources.coreMain.match(/'not-deployed'/gu) ?? []).length === 12 && sources.coreMain.includes('deviceCertificateRequiredApplications'));
check('Desktop device identity remains Ed25519 proof capable', sources.deviceIdentity.includes('createDeviceProof') && sources.deviceIdentity.includes('verifyDeviceProof'));
check('all production policy resolvers source trusted device fingerprint and trust time', productionRuntimes.every((value) => value.includes('devicePublicKeyFingerprintSha256: device.fingerprint') && value.includes('deviceCertificateIssuedAt: device.trustedAt')));
check('universal Desktop authority sources the protected device identity', sources.dataStore.includes('devicePublicKeyFingerprintSha256: device.fingerprint') && sources.dataStore.includes('deviceCertificateIssuedAt: device.createdAt'));
check('repository contract preserves migration-73 historical compatibility', sources.repositoryContract.includes('historical rows created before migration 73'));
check('repository persists and compares both identity bindings', sources.repository.includes('capability_manifest_sha256,device_certificate_sha256') && sources.repository.includes('record.deviceCertificateSha256 !== authorization.deviceCertificateSha256'));
check('migration 73 adds both columns and exact JSON trigger', sources.migration.includes("createMigrationDefinition(73, 'ppk008_application_identity_device_certificate_manifest'") && sources.migration.includes('trg_ppk008_platform_application_identity_insert') && sources.migration.includes("$.receipt.decision.deviceCertificateSha256"));
check('scope registry evidence UI menu confinement and no-cutover truth are closed', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true) && scope.status === 'COMPLETED' && scope.requirementCompletionClaimed === true && sources.main.includes('universalApiPolicyEnforcement().execute') && sources.preload.includes("contextBridge.exposeInMainWorld('pardus'") && sources.decision.includes('DEC-171') && sources.audit.includes('Gerçek veri taşınmamıştır'));

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-D',
  requirement: 'PPK-008',
  phase: 'APPLICATION_IDENTITY_DEVICE_CERTIFICATE_MANIFEST_CONTRACT',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  cutoverAuthorityAttached: false,
  realDataTransferPerformed: false,
  requirementCompletionClaimed: failures.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-D-ppk-008-application-identity-device-certificate-manifest-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`32-D PPK-008 contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`32-D PPK-008 contract: PASS (${checks.length}/${checks.length}).`);
