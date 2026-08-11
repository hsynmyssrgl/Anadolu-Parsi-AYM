import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { scanVersionedCoreServiceApiBoundary } from './verify-versioned-core-service-api-boundary.mjs';

const checks = [];
const failures = [];
const check = (name, condition) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status });
  if (!condition) failures.push(name);
};

const sources = Object.fromEntries(await Promise.all(Object.entries({
  policy: 'packages/platform-policy/src/versioned-core-service-api-boundary.ts',
  policyIndex: 'packages/platform-policy/src/index.ts',
  useCase: 'apps/core-service/src/versioned-core-service-api-use-case.ts',
  contracts: 'packages/core-service-contracts/src/index.ts',
  client: 'packages/core-service-client/src/local-admin-client.ts',
  runtime: 'apps/core-service/src/core-service-runtime.ts',
  dispatcher: 'apps/core-service/src/core-service-method-dispatcher.ts',
  server: 'apps/core-service/src/local-admin-server.ts',
  adapter: 'apps/desktop/src/main/core-service-application-adapter.ts',
  startup: 'apps/desktop/src/main/core-service-startup-connection.ts',
  main: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  global: 'apps/desktop/src/renderer/global.d.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx',
  scanner: 'scripts/verify-versioned-core-service-api-boundary.mjs',
  package: 'package.json',
  migration: 'packages/database/src/family-database-migrations.ts',
  sensitiveCache: 'apps/desktop/src/main/ipc-read-sharing.ts',
  ppk013Scanner: 'scripts/verify-client-data-access-boundary.mjs',
  targetedTest: 'apps/core-service/tests/ppk014-versioned-core-service-api-boundary.test.ts',
  threatModel: 'docs/security/PPK-014_VERSIONED_CORE_SERVICE_API_THREAT_MODEL.md',
  decision: 'docs/decisions/DEC-195-ppk-014-versioned-core-service-api-boundary.md',
  audit: 'docs/audit/32-J_PPK-014_SURUMLU_CORE_SERVICE_API_UST_KAPANIS.md'
}).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));

const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const requirement = registry.requirements.find((item) => item.id === 'PPK-014');
const scope = JSON.parse(await readFile('config/32-j-ppk-014-versioned-core-service-api-scope.json', 'utf8'));
const ledger = JSON.parse(await readFile('config/user-decision-ledger.json', 'utf8'));
const rootPackage = JSON.parse(sources.package);
const sourceScan = await scanVersionedCoreServiceApiBoundary();

check('direct Core Service import exception registry is empty and frozen', sources.policy.includes('VERSIONED_CORE_SERVICE_API_DIRECT_IMPORT_EXCEPTIONS = Object.freeze([] as const)'));
check('request envelope uses an exact canonical field set', sources.policy.includes("'protocolVersion', 'apiVersion', 'clientApplicationId', 'requestId', 'issuedAt'") && sources.policy.includes("'method', 'authenticationToken', 'payload'"));
check('malformed and protocol mismatches fail closed', sources.policy.includes("'MALFORMED_ENVELOPE'") && sources.policy.includes("'PROTOCOL_VERSION_MISMATCH'"));
check('client application and API version mismatches fail closed', sources.policy.includes("'CLIENT_APPLICATION_NOT_ALLOWED'") && sources.policy.includes("'API_VERSION_MISMATCH'"));
check('method allowlist mismatch fails closed', sources.policy.includes("'METHOD_NOT_ALLOWED'") && sources.policy.includes('supportedMethods.includes(request.method)'));
check('freshness rejects exact expiry and excessive future skew', sources.policy.includes('now - issuedAt >= authoritativeContext.maximumRequestAgeMs') && sources.policy.includes("'REQUEST_EXPIRED'") && sources.policy.includes("'REQUEST_FROM_FUTURE'"));
check('replay and replay-state capacity both fail closed', sources.policy.includes("'REPLAY_DETECTED'") && sources.policy.includes("'REPLAY_STATE_CAPACITY_EXCEEDED'") && sources.policy.includes('#replayExpirations.size >= authoritativeContext.maximumReplayEntries'));
check('accepted request IDs are recorded only after all bindings pass', sources.policy.indexOf('this.#replayExpirations.set(') > sources.policy.indexOf('supportedMethods.includes(request.method)'));
check('boundary snapshot declares fail-closed exact versioned protection', ['exactEnvelopeRequired: true','applicationVersionBindingRequired: true','freshnessRequired: true',"replayProtection: 'in-memory-per-process-fail-closed'",'directCoreServiceImportAllowed: false'].every((marker) => sources.policy.includes(marker)));
check('platform policy exports the versioned boundary', sources.policyIndex.includes("export * from './versioned-core-service-api-boundary.js'"));
check('application use case stops operation after any denial', sources.useCase.includes('class EnforceVersionedCoreServiceApiUseCase') && sources.useCase.includes('this.#policy.authorize') && sources.useCase.includes('if (!decision.allowed) throw new VersionedCoreServiceApiDeniedError'));

check('contracts define canonical API protocol application and safety limits', ['CORE_SERVICE_APPLICATION_API_VERSION','CORE_SERVICE_APPLICATION_ID','CORE_SERVICE_LOCAL_ADMIN_CLIENT_APPLICATION_ID','CORE_SERVICE_API_MAXIMUM_REQUEST_AGE_MS','CORE_SERVICE_API_MAXIMUM_FUTURE_SKEW_MS','CORE_SERVICE_API_MAXIMUM_REPLAY_ENTRIES'].every((marker) => sources.contracts.includes(marker)));
check('request contract binds API client identity and issue time', ['readonly apiVersion:', 'readonly clientApplicationId:', 'readonly issuedAt:'].every((marker) => sources.contracts.includes(marker)));
check('response contract binds API and Core Service application identity', sources.contracts.match(/readonly apiVersion:/gu)?.length >= 3 && sources.contracts.match(/readonly serverApplicationId:/gu)?.length >= 2);
check('canonical failure codes include version identity freshness and replay denials', ['API_VERSION_MISMATCH','CLIENT_APPLICATION_NOT_ALLOWED','REPLAY_DETECTED','REQUEST_EXPIRED'].every((marker) => sources.contracts.includes(`'${marker}'`)) && sources.contracts.includes('CORE_SERVICE_LOCAL_ADMIN_ERROR_CODES'));
check('safe boundary status statically forbids path secret and cutover authority', sources.contracts.includes('CoreServiceApiBoundaryStatusContract') && ['readonly persistentPathExposed: false','readonly secretMaterialExposed: false','readonly cutoverAuthorityAttached: false'].every((marker) => sources.contracts.includes(marker)));
check('boundary status is a required typed Core Service method', sources.contracts.includes("readonly 'client-api-boundary.status'") && sources.contracts.includes("'client-api-boundary.status',"));

check('client emits API version application identity and issue time', sources.client.includes('apiVersion: this.#apiVersion') && sources.client.includes('clientApplicationId: this.#clientApplicationId') && sources.client.includes('issuedAt: this.#clock()'));
check('client validates exact response fields version server identity and request identity', sources.client.includes('isExactResponse') && sources.client.includes("['protocolVersion', 'apiVersion', 'serverApplicationId', 'requestId', 'ok', 'result']") && sources.client.includes('parsed.requestId !== requestId'));
check('client rejects response error codes outside the canonical registry', sources.client.includes('CORE_SERVICE_LOCAL_ADMIN_ERROR_CODES.includes'));
check('client exposes only the typed boundary-status request wrapper', sources.client.includes("this.request('client-api-boundary.status', {})"));

check('server authenticates before invoking the versioned API policy', sources.server.indexOf('timingSafeEqual(actual, this.#expectedTokenDigest)') < sources.server.indexOf('this.#apiBoundary.execute('));
check('server resolves signed client application version from Core runtime', sources.server.includes('applicationApiVersionFor(CORE_SERVICE_LOCAL_ADMIN_CLIENT_APPLICATION_ID)'));
check('server binds canonical method freshness and replay limits', ['CORE_SERVICE_REQUIRED_DESKTOP_METHODS','CORE_SERVICE_API_MAXIMUM_REQUEST_AGE_MS','CORE_SERVICE_API_MAXIMUM_FUTURE_SKEW_MS','CORE_SERVICE_API_MAXIMUM_REPLAY_ENTRIES'].every((marker) => sources.server.includes(marker)));
check('server maps every policy denial to a typed fail-closed response', ['API_VERSION_MISMATCH','CLIENT_APPLICATION_NOT_ALLOWED','METHOD_NOT_ALLOWED','REPLAY_DETECTED','REQUEST_EXPIRED','REQUEST_FROM_FUTURE','MALFORMED_ENVELOPE','PROTOCOL_VERSION_MISMATCH','REPLAY_STATE_CAPACITY_EXCEEDED'].every((marker) => sources.server.includes(`${marker}:`)));
check('dispatcher exposes boundary status through the central method map', sources.dispatcher.includes("typedMethod === 'client-api-boundary.status'") && sources.dispatcher.includes('this.#runtime.clientApiBoundaryStatus()'));
check('runtime reports exact fail-closed zero-exception safety truth', sources.runtime.includes('clientApiBoundaryStatus(): CoreServiceApiBoundaryStatusContract') && ['directCoreServiceImportAllowed: false','directImportExceptionCount: 0','persistentPathExposed: false','secretMaterialExposed: false','cutoverAuthorityAttached: false'].every((marker) => sources.runtime.includes(marker)));
check('runtime application version comes from the signed policy package', sources.runtime.includes('this.#kernel.applicationVersionFor(applicationId)'));

check('Desktop adapter is the single typed Core Service client boundary', sources.adapter.includes('new CoreServiceLocalAdminClient({') && sources.adapter.includes('getApiBoundaryStatus(): Promise<CoreServiceApiBoundaryStatusContract>'));
check('Desktop startup fetches and exactly verifies the API boundary', sources.startup.includes('adapter.getApiBoundaryStatus()') && sources.startup.includes('exactKeys(apiBoundary') && sources.startup.includes("'API_BOUNDARY_MISMATCH'"));
check('Desktop startup binds server and allowed client identities', sources.startup.includes('CORE_SERVICE_APPLICATION_ID') && sources.startup.includes('CORE_SERVICE_LOCAL_ADMIN_CLIENT_APPLICATION_ID'));
check('typed IPC preload and renderer declarations expose only safe boundary status', sources.main.includes("registerIpcHandler('system:getCoreServiceApiBoundary'") && sources.preload.includes('getCoreServiceApiBoundary') && sources.global.includes('getCoreServiceApiBoundary():Promise<CoreServiceApiBoundaryStatusContract>'));
check('System menu renders the PPK-014 status posture', sources.renderer.includes('PPK-014 Core API') && sources.renderer.includes('Sürümlü zarf · uygulama bağı · freshness · replay koruması'));

check('non-Core application syntax gate scans production source with malicious self-tests', sources.scanner.includes('apps') && sources.scanner.includes("entry.name !== 'core-service'") && sources.scanner.includes('selfTestAssertions') && sources.scanner.includes('directImportExceptions: 0'));
check('source gate blocks internals SDK bypass and direct socket primitive', ['CORE_SERVICE_INTERNAL_IMPORT','CORE_SERVICE_CLIENT_OUTSIDE_ADAPTER','CORE_SERVICE_CLIENT_SYMBOL_OUTSIDE_ADAPTER','DIRECT_CORE_SERVICE_SOCKET_PRIMITIVE'].every((marker) => sources.scanner.includes(marker)));
check('current non-Core application source has zero bypass findings', sourceScan.findings.length === 0 && sourceScan.files >= 100 && sourceScan.zones >= 1);
check('typecheck and production build both execute PPK-013 and PPK-014 source gates', rootPackage.scripts?.pretypecheck?.includes('verify-client-data-access-boundary.mjs') && rootPackage.scripts?.pretypecheck?.includes('verify-versioned-core-service-api-boundary.mjs') && rootPackage.scripts?.prebuild?.includes('verify-client-data-access-boundary.mjs') && rootPackage.scripts?.prebuild?.includes('verify-versioned-core-service-api-boundary.mjs'));

check('targeted tests cover every envelope mismatch freshness replay and runtime path', ['MALFORMED_ENVELOPE','PROTOCOL_VERSION_MISMATCH','CLIENT_APPLICATION_NOT_ALLOWED','API_VERSION_MISMATCH','METHOD_NOT_ALLOWED','REQUEST_EXPIRED','REQUEST_FROM_FUTURE','REPLAY_DETECTED','REPLAY_STATE_CAPACITY_EXCEEDED','apiBoundaryStatus'].every((marker) => sources.targetedTest.includes(marker)));
check('threat model records assets trust boundaries threats controls and reality limit', ['Korunan varlıklar','Güven sınırları','Tehditler ve kontroller','Kalan riskler','Gerçeklik sınırı'].every((marker) => sources.threatModel.includes(marker)));
check('no schema migration 77 is added and policy receipt migration 74 remains', !sources.migration.includes('createMigrationDefinition(77,') && sources.migration.includes("createMigrationDefinition(74, 'ppk009_core_service_decision_reevaluation'"));
check('PPK-013 direct data-access source gate remains active', sources.ppk013Scanner.includes('CLIENT_DIRECT_DATA_ACCESS_EXCEPTIONS') || sources.ppk013Scanner.includes('FORBIDDEN_DATA_IMPORT'));
check('PPK-012 policy-sensitive IPC no-cache fence remains active', sources.sensitiveCache.includes('IPC_POLICY_SENSITIVE_READ_CHANNELS') && /ttlMs\s*:\s*0/u.test(sources.sensitiveCache));

check('accepted registry closes the complete PPK-014 evidence chain', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true));
check('scope closes PPK-014 without transfer ownership or cutover', scope.status === 'COMPLETED' && scope.requirementCompletionClaimed === true && scope.realDataTransferPerformed === false && scope.sqliteOwnershipTransferred === false && scope.cutoverAuthorityAttached === false);
check('DEC-195 is latest and binds PPK-014 evidence', ledger.decisions.at(-1)?.id === 'DEC-195' && ledger.decisions.at(-1)?.requirements?.includes('PPK-014'));
check('decision and audit preserve Desktop vault no-cache and DEC-171', sources.decision.includes('SQLite sahipliği') && sources.decision.includes('DEC-171') && sources.audit.includes('no-cache') && /gerçek veri/iu.test(sources.audit));

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-J',
  requirement: 'PPK-014',
  phase: 'VERSIONED_CORE_SERVICE_API_BOUNDARY_CONTRACT',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  sourceScan,
  directCoreServiceImportExceptions: 0,
  migrationDecision: 'NO_NEW_SCHEMA_MIGRATION_REUSE_EXISTING_VERSIONED_CONTRACTS',
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  cutoverAuthorityAttached: false,
  realDataTransferPerformed: false,
  policySensitiveIpcNoCacheWeakened: false,
  requirementCompletionClaimed: failures.length === 0,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-J-ppk-014-versioned-core-service-api-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`32-J PPK-014 contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`32-J PPK-014 contract: PASS (${checks.length}/${checks.length}).`);
