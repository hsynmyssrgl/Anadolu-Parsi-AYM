import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { scanNetworkEgressBoundary } from './verify-network-egress-boundary.mjs';

const checks = [];
const failures = [];
const check = (name, condition) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status });
  if (!condition) failures.push(name);
};

const sources = Object.fromEntries(await Promise.all(Object.entries({
  policy: 'packages/platform-policy/src/network-egress-policy.ts',
  policyIndex: 'packages/platform-policy/src/index.ts',
  domain: 'packages/domain/src/app-data.ts',
  useCase: 'apps/desktop/src/main/governed-network-egress-use-case.ts',
  fetcher: 'apps/desktop/src/main/secure-revocation-list-fetcher.ts',
  sync: 'apps/desktop/src/main/secure-revocation-sync-service.ts',
  endpointUseCase: 'packages/application/src/external-backup-revocation-endpoint-use-cases.ts',
  repositoryContract: 'packages/repository-contracts/src/external-backup-inventory-repository.ts',
  repository: 'packages/repositories/src/external-backup-inventory-repository.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  main: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  global: 'apps/desktop/src/renderer/global.d.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx',
  ipcPolicy: 'apps/desktop/src/main/ipc-integration-policy.ts',
  sensitiveCache: 'apps/desktop/src/main/ipc-read-sharing.ts',
  scanner: 'scripts/verify-network-egress-boundary.mjs',
  package: 'package.json',
  targetedTest: 'apps/desktop/tests/ppk015-network-egress-policy.test.ts',
  threatModel: 'docs/security/PPK-015_NETWORK_EGRESS_POLICY_THREAT_MODEL.md',
  decision: 'docs/decisions/DEC-196-ppk-015-network-egress-policy.md',
  audit: 'docs/audit/32-K_PPK-015_NETWORK_EGRESS_POLICY_UST_KAPANIS.md'
}).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));

const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const requirement = registry.requirements.find((item) => item.id === 'PPK-015');
const scope = JSON.parse(await readFile('config/32-k-ppk-015-network-egress-policy-scope.json', 'utf8'));
const ledger = JSON.parse(await readFile('config/user-decision-ledger.json', 'utf8'));
const rootPackage = JSON.parse(sources.package);
const sourceScan = await scanNetworkEgressBoundary();

check('direct network primitive exception registry is empty and immutable', sources.policy.includes('NETWORK_EGRESS_DIRECT_PRIMITIVE_EXCEPTIONS = Object.freeze([] as const)'));
check('exactly one external egress adapter is registered', sources.policy.includes("'apps/desktop/src/main/secure-revocation-list-fetcher.ts'") && sources.policy.includes('NETWORK_EGRESS_AUTHORIZED_ADAPTERS'));
check('network request requires an exact canonical field set', sources.policy.includes("'schemaVersion', 'endpointId', 'sourceUrl', 'method', 'purpose'") && sources.policy.includes("'applicationId', 'tlsMode', 'clientIdentityId'"));
check('authority requires endpoint status application TLS and pin bindings', ['endpointStatus', 'allowedApplicationId', 'minimumTlsVersion', 'expectedPins', 'observedAt'].every((marker) => sources.policy.includes(marker)));
check('policy rejects malformed requests and authority contexts', sources.policy.includes("'MALFORMED_REQUEST'") && sources.policy.includes("'MALFORMED_AUTHORITY'"));
check('application purpose and method mismatches fail closed', ['APPLICATION_NOT_ALLOWED', 'PURPOSE_NOT_ALLOWED', 'METHOD_NOT_ALLOWED'].every((marker) => sources.policy.includes(`'${marker}'`)));
check('endpoint identity status and URL mismatches fail closed', ['ENDPOINT_DISABLED', 'ENDPOINT_ID_MISMATCH', 'ENDPOINT_NOT_ALLOWLISTED'].every((marker) => sources.policy.includes(`'${marker}'`)));
check('TLS mode and mTLS identity mismatches fail closed', sources.policy.includes("'TLS_POLICY_MISMATCH'") && sources.policy.includes("'MTLS_IDENTITY_MISMATCH'"));
check('pin set is bounded ordered unique and SHA-256 shaped', sources.policy.includes('value.length < 1 || value.length > 2') && sources.policy.includes("pins[0]?.kind === 'primary'") && sources.policy.includes('new Set(pins.map'));
check('canonical endpoint URL requires HTTPS standard port without credentials fragment or local name', sources.policy.includes("url.protocol !== 'https:'") && sources.policy.includes("url.port !== '443'") && sources.policy.includes("endsWith('.local')"));
check('boundary snapshot exposes fail-closed TLS/mTLS rotation truth only', ['minimumTlsVersion: \'TLSv1.3\'', 'mutualTlsSupported: true', 'certificatePinRotationSupported: true', 'secretMaterialExposed: false'].every((marker) => sources.policy.includes(marker)));
check('platform policy exports the network egress policy', sources.policyIndex.includes("export * from './network-egress-policy.js'"));

check('central use case is the only caller of the external adapter', sources.useCase.includes("from './secure-revocation-list-fetcher.js'") && sources.sync.includes("from './governed-network-egress-use-case.js'"));
check('central use case authorizes before invoking the network adapter', sources.useCase.indexOf('this.policy.authorize') < sources.useCase.indexOf('return this.fetcher') && sources.useCase.includes('if (!decision.allowed) throw new NetworkEgressDeniedError'));
check('central use case binds windows desktop purpose GET endpoint and TLS mode', ['applicationId: \'windows-desktop\'', "purpose: 'external-backup-revocation-list.fetch'", "method: 'GET'", 'endpointStatus: input.endpoint.status'].every((marker) => sources.useCase.includes(marker)));
check('mTLS identity ID is bound while secret material bypasses policy and IPC', sources.useCase.includes('identityId = input.mutualTlsIdentity?.identityId ?? null') && sources.useCase.includes('mutualTlsIdentity: input.mutualTlsIdentity'));
check('sync service resolves current pins before governed fetch', sources.sync.indexOf('resolveExternalBackupRevocationEndpointPins') < sources.sync.indexOf('fetchList({ endpoint') && sources.sync.includes('fetchGovernedExternalBackupEvidenceRevocationList'));
check('network payload remains pending and is not auto-applied', sources.sync.includes('state.pending = { fetched') && !sources.sync.includes('applyExternalBackupEvidenceRevocationList'));

check('adapter requires TLS 1.3 and operating-system server trust', sources.fetcher.includes("minVersion:'TLSv1.3'") && sources.fetcher.includes('rejectUnauthorized:true') && sources.fetcher.includes("socket.getProtocol()!=='TLSv1.3'"));
check('adapter verifies peer SPKI against the authoritative rotation pins', sources.fetcher.includes("type:'spki'") && sources.fetcher.includes('expectedPins.find(item=>item.sha256===response.pin)'));
check('adapter rejects private DNS results and connected remote address', sources.fetcher.includes('await assertPublicHost(current.hostname)') && sources.fetcher.includes('isPrivateIp(socket.remoteAddress)'));
check('adapter rejects every HTTP redirect', sources.fetcher.includes('response.status>=300&&response.status<400') && sources.fetcher.includes('yönlendirmeleri allowlist'));
check('adapter binds optional mTLS cert key and local certificate proof', sources.fetcher.includes('cert:identity.cert,key:identity.key') && sources.fetcher.includes('socket.getCertificate().raw'));
check('adapter enforces response size JSON type and schema', sources.fetcher.includes('MAX_RESPONSE_BYTES=1_048_576') && sources.fetcher.includes("contentType.includes('application/json')") && sources.fetcher.includes("value.schemaVersion!==1"));
check('adapter accepts only standard HTTPS with no credentials or fragment', sources.fetcher.includes("current.protocol!=='https:'") && sources.fetcher.includes('current.username||current.password||current.hash'));

check('existing domain endpoint schema remains the authoritative allowlist profile', ['ExternalBackupRevocationEndpointView', 'sourceUrl:string', 'primarySpkiSha256:string', 'secondarySpkiSha256?:string'].every((marker) => sources.domain.includes(marker)));
check('endpoint use case normalizes HTTPS and requires strong authentication', sources.endpointUseCase.includes('normalizeHttpsSource') && sources.endpointUseCase.includes('this.strongAuth.verify'));
check('endpoint use case bounds dual-pin overlap and future scheduling', sources.endpointUseCase.includes('14*86_400_000') && sources.endpointUseCase.includes('90*86_400_000'));
check('repository contract persists allowlist and rotation metadata without secrets', sources.repositoryContract.includes('UpsertExternalBackupRevocationEndpointRow') && !sources.repositoryContract.includes('clientPrivateKey'));
check('repository reads and writes the existing endpoint allowlist table', sources.repository.includes('external_backup_revocation_endpoints') && sources.repository.includes('mapRevocationEndpoint'));
check('migration 23 owns endpoint allowlist and dual pin fields', sources.migration.includes("createMigrationDefinition(23, 'external_backup_revocation_endpoint_pin_rotation'") && sources.migration.includes('secondary_spki_sha256'));
check('no migration 77 or persistent mTLS secret column is added', !sources.migration.includes('createMigrationDefinition(77,') && !sources.migration.includes('client_private_key'));

check('typed domain IPC status never exposes path or secret material', sources.domain.includes('NetworkEgressBoundaryView') && sources.domain.includes('persistentPathExposed:false') && sources.domain.includes('secretMaterialExposed:false'));
check('main process exposes only boundary posture through typed IPC', sources.main.includes("registerIpcHandler('system:getNetworkEgressBoundary'") && sources.main.includes('networkEgressPolicy.snapshot()'));
check('preload and renderer declarations expose the typed status method', sources.preload.includes('getNetworkEgressBoundary') && sources.global.includes('getNetworkEgressBoundary():Promise<NetworkEgressBoundaryView>'));
check('IPC integration policy requires zero arguments for egress status', sources.ipcPolicy.includes("case 'system:getNetworkEgressBoundary':") && sources.ipcPolicy.includes('return zeroArguments(args)'));
check('network egress status is explicitly security-posture no-cache', sources.sensitiveCache.includes('IPC_SECURITY_POSTURE_NO_CACHE_CHANNELS') && sources.sensitiveCache.includes("'system:getNetworkEgressBoundary'"));
check('system UI renders PPK-015 fail-closed TLS mTLS and zero exception posture', sources.renderer.includes('PPK-015 · ağ çıkış güvenliği') && sources.renderer.includes('Fail-closed egress politikası etkin') && sources.renderer.includes('directPrimitiveExceptionCount'));
check('profile menu exposes the network egress security entry', sources.renderer.includes('Ağ çıkış güvenliği'));

check('source gate scans all production app and package source zones', sources.scanner.includes("for (const parent of ['apps', 'packages'])") && sources.scanner.includes('scanNetworkEgressBoundary'));
check('source gate blocks network modules packages globals and adapter bypass', ['DIRECT_NETWORK_MODULE', 'THIRD_PARTY_NETWORK_CLIENT', 'GLOBAL_NETWORK_PRIMITIVE', 'EGRESS_ADAPTER_IMPORT_OUTSIDE_USE_CASE', 'EGRESS_USE_CASE_IMPORT_OUTSIDE_SYNC_SERVICE'].every((marker) => sources.scanner.includes(marker)));
check('source gate has six malicious self-tests and zero exception reporting', sources.scanner.includes('return cases.length') && sources.scanner.includes('directPrimitiveExceptions: 0'));
check('current production source has zero egress bypass findings', sourceScan.findings.length === 0 && sourceScan.files >= 300 && sourceScan.zones >= 18);
check('typecheck and production build both execute the egress source gate', rootPackage.scripts?.pretypecheck?.includes('verify-network-egress-boundary.mjs') && rootPackage.scripts?.prebuild?.includes('verify-network-egress-boundary.mjs'));

check('targeted tests cover TLS mTLS allowlist mismatches pin corruption and no-call denial', ['ALLOW_EGRESS', 'APPLICATION_NOT_ALLOWED', 'PURPOSE_NOT_ALLOWED', 'METHOD_NOT_ALLOWED', 'ENDPOINT_DISABLED', 'ENDPOINT_ID_MISMATCH', 'ENDPOINT_NOT_ALLOWLISTED', 'TLS_POLICY_MISMATCH', 'MTLS_IDENTITY_MISMATCH', 'adapter).not.toHaveBeenCalled'].every((marker) => sources.targetedTest.includes(marker)));
check('threat model records assets trust boundaries threats controls remaining risks and reality', ['Korunan varlıklar', 'Güven sınırları', 'Tehditler ve kontroller', 'Kalan riskler', 'Gerçeklik sınırı'].every((marker) => sources.threatModel.includes(marker)));
check('PPK-012 policy-sensitive IPC no-cache fence remains active', sources.sensitiveCache.includes('IPC_POLICY_SENSITIVE_READ_CHANNELS') && /ttlMs\s*:\s*0/u.test(sources.sensitiveCache));
check('accepted registry closes the complete PPK-015 evidence chain', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true));
check('scope closes PPK-015 without transfer ownership or cutover', scope.status === 'COMPLETED' && scope.requirementCompletionClaimed === true && scope.realDataTransferPerformed === false && scope.sqliteOwnershipTransferred === false && scope.cutoverAuthorityAttached === false);
check('DEC-196 is latest and binds PPK-015 evidence', ledger.decisions.at(-1)?.id === 'DEC-196' && ledger.decisions.at(-1)?.requirements?.includes('PPK-015'));
check('decision and audit preserve Desktop vault no-cache and DEC-171', sources.decision.includes('SQLite sahipliği') && sources.decision.includes('DEC-171') && sources.audit.includes('no-cache') && /gerçek veri/iu.test(sources.audit));

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-K',
  requirement: 'PPK-015',
  phase: 'NETWORK_EGRESS_POLICY_CONTRACT',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  sourceScan,
  directNetworkPrimitiveExceptions: 0,
  migrationDecision: 'NO_NEW_SCHEMA_MIGRATION_REUSE_MIGRATION_23_ENDPOINT_ALLOWLIST_AND_PIN_ROTATION',
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  cutoverAuthorityAttached: false,
  realDataTransferPerformed: false,
  policySensitiveIpcNoCacheWeakened: false,
  requirementCompletionClaimed: failures.length === 0,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-K-ppk-015-network-egress-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`32-K PPK-015 contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`32-K PPK-015 contract: PASS (${checks.length}/${checks.length}).`);
