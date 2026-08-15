import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { inspectNetworkEgressStaticRatchet, scanNetworkEgressBoundary } from './verify-network-egress-boundary.mjs';

const checks = [];
const failures = [];
const check = (name, condition, detail = undefined) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status, ...(detail === undefined ? {} : { detail }) });
  if (!condition) failures.push(name);
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));

const paths = Object.freeze({
  policy: 'packages/platform-policy/src/network-egress-policy.ts',
  policyIndex: 'packages/platform-policy/src/index.ts',
  domain: 'packages/domain/src/app-data.ts',
  revocationUseCase: 'apps/desktop/src/main/governed-network-egress-use-case.ts',
  revocationFetcher: 'apps/desktop/src/main/secure-revocation-list-fetcher.ts',
  revocationSync: 'apps/desktop/src/main/secure-revocation-sync-service.ts',
  oidcAdapter: 'apps/desktop/src/main/secure-oidc-network-adapter.ts',
  oidcFingerprint: 'apps/desktop/src/main/oidc-provider-configuration-fingerprint.ts',
  main: 'apps/desktop/src/main/main.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx',
  ipcPolicy: 'apps/desktop/src/main/ipc-integration-policy.ts',
  sensitiveCache: 'apps/desktop/src/main/ipc-read-sharing.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  scanner: 'scripts/verify-network-egress-boundary.mjs',
  package: 'package.json',
  policyTest: 'apps/desktop/tests/ppk015-network-egress-policy.test.ts',
  oidcTest: 'apps/desktop/tests/secure-oidc-network-adapter.test.ts',
  historicalScope: 'config/32-k-ppk-015-network-egress-policy-scope.json',
  historicalDecision: 'docs/decisions/DEC-196-ppk-015-network-egress-policy.md',
  historicalAudit: 'docs/audit/32-K_PPK-015_NETWORK_EGRESS_POLICY_UST_KAPANIS.md',
  historicalIndex: 'artifacts/manifests/ALL_DOCUMENTS_INDEX.json',
  currentRatchet: 'config/ppk-015-network-egress-current-ratchet.json',
  currentNote: 'docs/current/PPK-015_NETWORK_EGRESS_CURRENT_RATCHET.md'
});
const bytes = Object.fromEntries(await Promise.all(Object.entries(paths)
  .map(async ([key, path]) => [key, await readFile(path)])));
const sources = Object.fromEntries(Object.entries(bytes).map(([key, value]) => [key, value.toString('utf8')]));
const historicalScope = JSON.parse(sources.historicalScope);
const historicalIndex = JSON.parse(sources.historicalIndex);
const ratchet = JSON.parse(sources.currentRatchet);
const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const requirement = registry.requirements.find((item) => item.id === 'PPK-015');
const ledger = JSON.parse(await readFile('config/user-decision-ledger.json', 'utf8'));
const decision = ledger.decisions.find((item) => item.id === 'DEC-196');
const rootPackage = JSON.parse(sources.package);
const sourceScan = await scanNetworkEgressBoundary();
const staticRatchet = inspectNetworkEgressStaticRatchet();
const migrationEntries = [...sources.migration.matchAll(/createMigrationDefinition\((\d+),\s*'([^']+)'/gu)]
  .map((match) => ({ version: Number(match[1]), name: match[2] }));
const latestMigration = Math.max(...migrationEntries.map(({ version }) => version));

check('historical 32-K scope bytes remain immutable', sha256(bytes.historicalScope) === ratchet.historicalClosure.scopeSha256);
check('historical DEC-196 bytes remain immutable', sha256(bytes.historicalDecision) === ratchet.historicalClosure.decisionSha256);
check('historical 32-K audit bytes remain immutable', sha256(bytes.historicalAudit) === ratchet.historicalClosure.auditSha256);
check('historical document index independently anchors all three closure hashes', [
  ['historicalScope', paths.historicalScope, ratchet.historicalClosure.scopeSha256],
  ['historicalDecision', paths.historicalDecision, ratchet.historicalClosure.decisionSha256],
  ['historicalAudit', paths.historicalAudit, ratchet.historicalClosure.auditSha256]
].every(([key, path, expected]) => {
  const entry = historicalIndex.documents?.find((item) => item.path === path);
  return entry?.classification === 'ACTIVE_REFERENCE' && entry.sha256 === expected && entry.bytes === bytes[key].byteLength;
}));
check('historical scope records the original single revocation adapter truth', historicalScope.boundaries?.singleAuthorizedExternalEgressAdapter === true
  && historicalScope.authorizedAdapter === ratchet.historicalClosure.authorizedAdapter);
check('historical scope records no migration 77 added by 32-K', historicalScope.schemaDecision?.includes('migration 77 eklenmez')
  && ratchet.historicalClosure.latestMigrationAtClosure === 76 && ratchet.historicalClosure.packageOwnedMigrationAdded === false);
check('historical scope preserves no transfer ownership or cutover truth', historicalScope.status === 'COMPLETED'
  && historicalScope.realDataTransferPerformed === false && historicalScope.sqliteOwnershipTransferred === false
  && historicalScope.cutoverAuthorityAttached === false && historicalScope.requirementCompletionClaimed === true);
check('DEC-196 remains an active registered PPK-015 decision', decision?.status === 'ACTIVE'
  && decision.requirements?.includes('PPK-015') && decision.document === paths.historicalDecision);
check('DEC-196 is historical and is not required to remain the latest ledger entry', ledger.decisions.indexOf(decision) >= 0
  && ledger.decisions.indexOf(decision) < ledger.decisions.length - 1 && ledger.decisions.at(-1)?.id !== 'DEC-196');
check('later migration 77 is explicitly owned by PPK-016 rather than PPK-015', migrationEntries.some(({ version, name }) => version === 77 && name === 'ppk016_derived_data_policy_inheritance')
  && !migrationEntries.some(({ name }) => /(?:ppk015|network_egress)/iu.test(name)));
check('migration 23 remains the revocation allowlist schema owner', migrationEntries.some(({ version, name }) => version === 23 && name === 'external_backup_revocation_endpoint_pin_rotation'));
check('current migration truth is recorded separately from historical 32-K', latestMigration === ratchet.currentBoundary.latestDatabaseMigration
  && latestMigration >= ratchet.historicalClosure.latestMigrationAtClosure);

check('current ratchet declares a successor boundary without rewriting closure', ratchet.schemaVersion === 1
  && ratchet.requirement === 'PPK-015' && ratchet.status === 'CURRENT_RATCHET'
  && ratchet.historicalClosure.decisionId === 'DEC-196' && ratchet.historicalClosure.evidenceRewritten === false);
check('current policy keeps the direct primitive exception registry empty', sources.policy.includes('NETWORK_EGRESS_DIRECT_PRIMITIVE_EXCEPTIONS = Object.freeze([] as const)')
  && ratchet.currentBoundary.directPrimitiveExceptionCount === 0);
check('current policy registers the exact two adapters', ratchet.currentBoundary.authorizedAdapters.length === 2
  && ratchet.currentBoundary.authorizedAdapters.every((path) => sources.policy.includes(`'${path}'`))
  && sources.policy.includes('authorizedAdapterCount: 2'));
check('current policy registers the exact three purposes', ratchet.currentBoundary.authorizedPurposes.length === 3
  && ratchet.currentBoundary.authorizedPurposes.every((purpose) => sources.policy.includes(`'${purpose}'`)));
check('purpose and method bindings are exact', includesAll(sources.policy, [
  "'external-backup-revocation-list.fetch': 'GET'", "'oidc.token.exchange': 'POST'", "'oidc.jwks.fetch': 'GET'"
]));
check('policy continues to bind exact request authority TLS and pins', includesAll(sources.policy, [
  'MALFORMED_REQUEST', 'MALFORMED_AUTHORITY', 'APPLICATION_NOT_ALLOWED', 'PURPOSE_NOT_ALLOWED', 'METHOD_NOT_ALLOWED',
  'ENDPOINT_DISABLED', 'ENDPOINT_ID_MISMATCH', 'ENDPOINT_NOT_ALLOWLISTED', 'TLS_POLICY_MISMATCH', 'CERTIFICATE_PIN_SET_INVALID'
]));
check('platform policy and typed domain publish the current inventory', sources.policyIndex.includes("export * from './network-egress-policy.js'")
  && includesAll(sources.domain, ['NetworkEgressBoundaryView', 'oidc.token.exchange', 'oidc.jwks.fetch', 'authorizedAdapterCount:2']));

check('revocation egress remains use-case governed', sources.revocationUseCase.indexOf('this.policy.authorize') < sources.revocationUseCase.indexOf('return this.fetcher')
  && sources.revocationSync.includes("from './governed-network-egress-use-case.js'"));
check('revocation adapter retains TLS trust DNS connected-address and SPKI checks', includesAll(sources.revocationFetcher, [
  "minVersion:'TLSv1.3'", 'rejectUnauthorized:true', 'await assertPublicHost(current.hostname)', 'isPrivateIp(socket.remoteAddress)', "type:'spki'"
]));
check('revocation payload remains pending rather than automatically applied', sources.revocationSync.includes('state.pending = { fetched')
  && !sources.revocationSync.includes('applyExternalBackupEvidenceRevocationList'));

check('OIDC transport uses only the dedicated HTTPS DNS adapter', includesAll(sources.oidcAdapter, [
  "from 'node:dns/promises'", "from 'node:https'", "from 'node:net'", 'class NodeHttpsOidcTransport'
]));
check('OIDC transport requires TLS 1.3 OS trust and selected-connected exact public address', includesAll(sources.oidcAdapter, [
  "minVersion: 'TLSv1.3'", "maxVersion: 'TLSv1.3'", 'rejectUnauthorized: true',
  'isPrivateOrReservedOidcAddress', 'isSameOidcAddress(selected.address, socket.remoteAddress)'
]));
check('OIDC transport rejects redirects encoding type spoof and oversized bodies', includesAll(sources.oidcAdapter, [
  'OIDC HTTPS redirect reddedildi.', "split(';', 1)[0]?.trim() !== 'application/json'", "!['', 'identity'].includes", 'maximumResponseBytes'
]));
check('OIDC transport zeroizes bounded token and response buffers', includesAll(sources.oidcAdapter, [
  'zeroizeChunks', 'body.fill(0)', 'response?.body.fill(0)', 'OIDC network islemi zaman asimina ugradi.'
]));
check('OIDC policy authorization happens before transport execution', sources.oidcAdapter.indexOf('this.#policy.authorize')
  < sources.oidcAdapter.indexOf('this.#transport.execute'));
check('OIDC provider visibility requires complete network-ready profiles', includesAll(sources.oidcAdapter, [
  'networkReadyOidcProviderRegistrations', "value.clientAuthenticationMode !== 'public_pkce'", "configuration.providerId === 'apple'"
]));
check('OIDC client fingerprint binds auth mode and both endpoint pin sets', includesAll(sources.oidcFingerprint, [
  'oidc-client-configuration-v2', 'clientAuthenticationMode', 'tokenEndpointPins', 'jwksEndpointPins', 'primary', 'secondary'
]));
check('main visibility and provisioning use only the secure network-ready registrations', includesAll(sources.main, [
  'new SecureOidcNetworkAdapter', 'secureOidcNetworkAdapter.networkReadyProviderRegistrations()',
  'clientConfigurationSha256})', "provider==='apple'||clientAuthenticationMode!=='public_pkce'"
]));
check('main has no direct electron network fetch or raw client secret path', !sources.main.includes('net.fetch')
  && !sources.main.includes('client_secret') && !sources.main.includes('PPT_OIDC_CLIENT_SECRET'));

check('typed IPC remains posture-only and no-cache', sources.main.includes("registerIpcHandler('system:getNetworkEgressBoundary'")
  && sources.ipcPolicy.includes("case 'system:getNetworkEgressBoundary':")
  && sources.sensitiveCache.includes("'system:getNetworkEgressBoundary'"));
check('system UI states revocation OIDC token and JWKS allowlist truth', includesAll(sources.renderer, [
  'PPK-015', 'OIDC token', 'JWKS', 'directPrimitiveExceptionCount'
]));

check('source gate scans the exact current production inventory', sourceScan.zones === ratchet.currentBoundary.productionSourceZones
  && sourceScan.files === ratchet.currentBoundary.scannedFiles
  && sourceScan.sourceInventorySha256 === ratchet.currentBoundary.sourceInventorySha256,
  `${sourceScan.zones}/${sourceScan.files}/${sourceScan.sourceInventorySha256}`);
check('source gate keeps exact current malicious self-test and zero finding ratchets', staticRatchet.selfTestAssertions === ratchet.currentBoundary.maliciousSelfTests
  && sourceScan.findings.length === ratchet.currentBoundary.findings && sourceScan.findings.length === 0);
check('authorized adapter and purpose inventory hash is exact', ratchet.currentBoundary.authorizedInventorySha256
  === staticRatchet.authorizedInventorySha256
  && staticRatchet.authorizedExternalEgressAdapters === ratchet.currentBoundary.authorizedAdapterCount
  && staticRatchet.authorizedExternalEgressAdapters === ratchet.currentBoundary.authorizedAdapters.length
  && staticRatchet.authorizedEgressPurposeCount === ratchet.currentBoundary.authorizedPurposeCount
  && staticRatchet.authorizedEgressPurposeCount === ratchet.currentBoundary.authorizedPurposes.length
  && staticRatchet.localOnlyTransportFiles === ratchet.currentBoundary.localOnlyTransportFiles);
check('scanner exposes the current hash and count evidence', includesAll(sources.scanner, [
  'sourceInventorySha256', 'authorizedInventorySha256', 'authorizedEgressPurposeCount', 'selfTestAssertions'
]));
check('typecheck and build both execute the source gate', rootPackage.scripts?.pretypecheck?.includes('verify-network-egress-boundary.mjs')
  && rootPackage.scripts?.prebuild?.includes('verify-network-egress-boundary.mjs'));

check('targeted policy tests cover current POST GET inventory and fail-closed mismatches', includesAll(sources.policyTest, [
  'oidc.token.exchange', 'oidc.jwks.fetch', 'MALFORMED_AUTHORITY', 'adapter).not.toHaveBeenCalled'
]));
check('targeted OIDC tests cover pins scope DNS TLS redirect abort and zeroization', includesAll(sources.oidcTest, [
  'pin rotation sets', 'unknown or escalated scope', 'mixed DNS', 'TLS downgrade', 'midstream abort', 'bounded deadline'
]));
check('current note explicitly separates historical closure from successor truth', includesAll(sources.currentNote, [
  'DEC-196', 'migration 76', 'migration 77', 'migration 107', '2 adapter', '3 purpose', 'historical', 'current ratchet'
]));
check('accepted registry remains complete without claiming a new closure decision', requirement?.status === 'COMPLETE'
  && Object.values(requirement.chain ?? {}).every((value) => value === true));
check('current ratchet preserves no real request transfer ownership or cutover claims', ratchet.truth.realNetworkRequestPerformed === false
  && ratchet.truth.realDataTransferPerformed === false && ratchet.truth.sqliteOwnershipTransferred === false
  && ratchet.truth.cutoverAuthorityAttached === false && ratchet.truth.providerDeliveryGuaranteed === false);

const report = {
  schemaVersion: 2,
  release: 'Bronze 04.08.2026.29',
  step: '32-K-current-ratchet',
  requirement: 'PPK-015',
  phase: 'NETWORK_EGRESS_HISTORICAL_CLOSURE_AND_CURRENT_RATCHET',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  historicalClosure: {
    decisionId: 'DEC-196',
    latestMigrationAtClosure: ratchet.historicalClosure.latestMigrationAtClosure,
    evidenceRewritten: false
  },
  currentRatchet: {
    latestDatabaseMigration: latestMigration,
    sourceScan,
    authorizedAdapters: ratchet.currentBoundary.authorizedAdapters,
    authorizedPurposes: ratchet.currentBoundary.authorizedPurposes,
    authorizedInventorySha256: ratchet.currentBoundary.authorizedInventorySha256
  },
  directNetworkPrimitiveExceptions: 0,
  realNetworkRequestPerformed: false,
  realDataTransferPerformed: false,
  sqliteOwnershipTransferred: false,
  cutoverAuthorityAttached: false,
  requirementCompletionClaimed: failures.length === 0,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-K-ppk-015-network-egress-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`32-K PPK-015 historical/current contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`32-K PPK-015 historical/current contract: PASS (${checks.length}/${checks.length}).`);
