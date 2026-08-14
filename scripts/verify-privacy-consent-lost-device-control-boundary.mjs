import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { runPlatformPolicyAstGate } from './verify-platform-policy-ast-gate.mjs';
import { runPlatformCapabilityManifestGate } from './verify-platform-capability-manifest-gate.mjs';

const readText = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const [domain, application, adapter, dataStore, main, ipcPolicy, readSharing, preload,
  declarations, renderer, applicationTest, ipcTest, scope, inventory, decision,
  threatModel, audit, rootPackage, astGate, capabilityGate] = await Promise.all([
  readText('packages/domain/src/app-data.ts'),
  readText('packages/application/src/privacy-control-use-cases.ts'),
  readText('apps/desktop/src/main/privacy-control-application-adapter.ts'),
  readText('apps/desktop/src/main/data-store.ts'),
  readText('apps/desktop/src/main/main.ts'),
  readText('apps/desktop/src/main/ipc-integration-policy.ts'),
  readText('apps/desktop/src/main/ipc-read-sharing.ts'),
  readText('apps/desktop/src/main/preload.ts'),
  readText('apps/desktop/src/renderer/global.d.ts'),
  readText('apps/desktop/src/renderer/App.tsx'),
  readText('packages/application/tests/privacy-control-use-cases.test.ts'),
  readText('apps/desktop/tests/b5-privacy-control-ipc-integration.test.ts'),
  readJson('config/33-k-privacy-consent-lost-device-control-scope.json'),
  readJson('config/33-k-privacy-consent-lost-device-control-inventory.json'),
  readText('docs/decisions/DEC-222-privacy-consent-lost-device-control-center.md'),
  readText('docs/security/THREAT_MODEL_33_K_PRIVACY_CONSENT_LOST_DEVICE_CONTROL.md'),
  readText('docs/audit/33-K_PRIVACY_CONSENT_LOST_DEVICE_CONTROL_UST_KAPANIS.md'),
  readJson('package.json'),
  runPlatformPolicyAstGate(),
  runPlatformCapabilityManifestGate()
]);

const checks = [];
const failures = [];
const check = (name, condition) => {
  const passed = Boolean(condition);
  checks.push({ name, passed });
  if (!passed) failures.push(name);
};
const channels = Object.freeze([
  'privacyControl:getCenter', 'privacyControl:setLiveLocationConsent',
  'privacyControl:shutdownLostDevice'
]);
const methods = Object.freeze([
  'getPrivacyControlCenter', 'setLiveLocationConsent', 'shutdownLostDevice'
]);

check('domain fixes bounded live-location consent and truthful result types', includesAll(domain, [
  "LIVE_LOCATION_CONSENT_PURPOSE = 'live_location_sharing'", 'defaultDenied:true',
  'visibleActiveIndicator:boolean', "scope:'local_authority_only'", 'remoteWipePerformed:false',
  'mdmOperationPerformed:false', "networkDelivery:'not_performed'"
]));
check('consent defaults deny and requires explicit 15-to-43200 minute duration', includesAll(application, [
  "effectiveStatus:'default_denied'", 'input.command.explicitConsent !== true',
  'PRIVACY_CONTROL_MINIMUM_CONSENT_MINUTES', 'PRIVACY_CONTROL_MAXIMUM_CONSENT_MINUTES',
  "action:`privacy.live_location_consent_${input.command.status}`"
]));
check('expiry and immediate revoke close the visible indicator', includesAll(application, [
  "row.status === 'revoked'", "effectiveStatus:row.endsAt ? 'expired' : 'default_denied'",
  'visibleActiveIndicator:false', "status:'revoked'"
]));
check('lost-device path requires exact target confirmation session epoch and strong auth', includesAll(application, [
  'LOST_DEVICE_SHUTDOWN_CONFIRMATION', 'requireSession', 'strongAuthentication.verify',
  'scope.account.securityEpoch !== authenticated.value.securityEpoch',
  'scope.trustedDevices.find', 'if (!target || target.revokedAt)'
]));
check('one UoW advances epoch and revokes devices leases consents plus audit', includesAll(application, [
  'this.unitOfWork.execute<LostDeviceShutdownResultView>', 'scope.advanceSecurityEpoch()',
  'scope.revokeAllTrustedDevices()', 'revokeOfflineCapabilityLease',
  "status:'revoked'", "action:'privacy.lost_device_local_authority_closed'"
]));
check('session clears only after successful UoW', application.includes('if (closed.ok) this.session.clear()'));
check('repository adapter uses central PEP and a single transaction executor', includesAll(adapter, [
  'CentralAuthorizationService', "action:'administer'", "resourceType:'privacy_control'",
  'transactionExecutor.execute', 'listByAccount', 'listForFamily', 'advanceSecurityEpoch',
  'revokeAll', 'revokeOfflineLease', 'appendAudit'
]) && !adapter.includes("actor.role === 'family_admin'"));
check('desktop composition reuses central trusted-device lease consent and audit repositories', includesAll(dataStore, [
  'RepositoryBackedPrivacyControlQueryPort', 'RepositoryBackedPrivacyControlUnitOfWork',
  'trustedDeviceRepository', 'offlineCapabilityLeaseRepository', 'aiConsentRepository',
  'auditRepository', 'RepositoryBackedStrongAuthenticationPort'
]));
check('IPC registers exactly three governed channels and exact payload validation',
  channels.every((channel) => main.includes(`'${channel}'`) && ipcPolicy.includes(`'${channel}'`))
  && includesAll(ipcPolicy, ['liveLocationConsentInput', 'lostDeviceShutdownInput',
    "value.confirmation === 'KAYIP CİHAZ YETKİLERİNİ KAPAT'"]));
check('typed preload and renderer declarations expose all three methods',
  [preload, declarations].every((source) => methods.every((method) => source.includes(method))));
check('shutdown invalidates read sharing and seals local authority holders', includesAll(readSharing, [
  'MUTATION_ACTION_PATTERN', 'shutdown'
]) && includesAll(main, [
  'financeImportFileSessions.clear()', 'emergencyCardExportReauthenticationGuard.clearAll()',
  "offlineSensitiveCache.lock('REVOKED')", 'sealUserDataSession()'
]));
check('UI exposes visible consent status revoke and exact lost-device confirmation', includesAll(renderer, [
  'Gizlilik, süreli rıza ve kayıp cihaz kapatma merkezi', 'Derhal iptal et',
  'KAYIP CİHAZ YETKİLERİNİ KAPAT', 'uzaktan silme, MDM veya ağ üzerinden teslim garantisi vermez'
]));
check('no remote wipe MDM send upload or delivery IPC exists',
  !/privacyControl:(?:wipe|mdm|deliver|send|upload)/iu.test(`${main}\n${preload}`));
check('tests cover default deny bounded consent atomic closure and no remote claim', includesAll(applicationTest, [
  'default deny', 'requires explicit bounded consent', 'closes account authority in one UoW',
  'remoteWipePerformed:false', 'networkDelivery:\'not_performed\''
]) && includesAll(ipcTest, ['governed center channels', 'binds central PEP/UoW', 'makes no remote claim']));
check('scope inventory and documents bind DEC-222 and Migration 88 reuse',
  scope.decision === 'DEC-222' && scope.requirements?.join(',') === 'B5-06,EXT-039'
  && scope.reuse?.latestDatabaseMigration === 88 && scope.reuse?.newMigrationRequired === false
  && inventory.requirements?.join(',') === 'B5-06,EXT-039'
  && inventory.latestDatabaseMigration === 88 && inventory.networkChannels?.length === 0
  && [decision, threatModel, audit].every((source) => source.includes('DEC-222')));
check('truth consistently excludes remote wipe MDM network delivery and location transmission',
  scope.truth?.remoteWipePerformed === false && scope.truth?.mdmOperationPerformed === false
  && scope.truth?.networkDelivery === 'not_performed'
  && scope.truth?.networkDeliveryGuaranteed === false
  && scope.truth?.locationTransmissionPerformed === false);
check('PPK-021 exact successor ratchet is green', astGate.status === 'PASS'
  && astGate.privilegedSurfaces === 692 && astGate.exactAllowlistEntries === 692
  && astGate.surfaceCounts?.USE_CASE_COMPOSITION === 333
  && astGate.directRoleAuthorizationBypasses === 0 && astGate.findings.length === 0);
check('PPK-022 exact successor ratchet is green', capabilityGate.status === 'PASS'
  && capabilityGate.capabilitySurfaces === 345 && capabilityGate.exactManifestSurfaces === 345
  && capabilityGate.findings.length === 0);
check('root lifecycle executes boundary before typecheck and build', ['pretypecheck', 'prebuild'].every((name) =>
  rootPackage.scripts?.[name]?.includes('verify-privacy-consent-lost-device-control-boundary.mjs')));

const report = Object.freeze({
  schemaVersion: 1, step: '33-K', requirements: Object.freeze(['B5-06', 'EXT-039']),
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: checks.filter((item) => item.passed).length,
  checksFailed: failures.length, checks: Object.freeze(checks), failures: Object.freeze(failures),
  latestDatabaseMigration: 88, ipcChannels: channels.length, networkChannels: 0,
  scope: 'local_authority_only', remoteWipePerformed: false, mdmOperationPerformed: false,
  networkDelivery: 'not_performed', locationTransmissionPerformed: false,
  ppk021ExactAllowlistEntries: astGate.exactAllowlistEntries,
  ppk021UseCaseCompositionSurfaces: astGate.surfaceCounts?.USE_CASE_COMPOSITION,
  ppk022CapabilitySurfaces: capabilityGate.exactManifestSurfaces,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/33-K-privacy-consent-lost-device-control-boundary.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`Privacy consent lost-device control boundary: ${report.status} (${report.checksPassed}/${checks.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
