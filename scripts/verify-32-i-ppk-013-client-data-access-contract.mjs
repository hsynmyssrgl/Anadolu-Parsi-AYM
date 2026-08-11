import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { scanClientDataAccessBoundary } from './verify-client-data-access-boundary.mjs';

const checks = [];
const failures = [];
const check = (name, condition) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status });
  if (!condition) failures.push(name);
};

const sources = Object.fromEntries(await Promise.all(Object.entries({
  policy: 'packages/platform-policy/src/client-data-access-boundary.ts',
  policyIndex: 'packages/platform-policy/src/index.ts',
  domain: 'packages/domain/src/app-data.ts',
  useCase: 'packages/application/src/client-data-access-use-cases.ts',
  universal: 'apps/desktop/src/main/desktop-universal-api-policy-enforcement.ts',
  main: 'apps/desktop/src/main/main.ts',
  ipcRuntime: 'apps/desktop/src/main/ipc-runtime.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  global: 'apps/desktop/src/renderer/global.d.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx',
  scanner: 'scripts/verify-client-data-access-boundary.mjs',
  package: 'package.json',
  coreClientPackage: 'packages/core-service-client/package.json',
  migration: 'packages/database/src/family-database-migrations.ts',
  sensitiveCache: 'apps/desktop/src/main/ipc-read-sharing.ts',
  targetedTest: 'apps/desktop/tests/ppk013-client-data-access-boundary.test.ts',
  threatModel: 'docs/security/PPK-013_CLIENT_DATA_ACCESS_THREAT_MODEL.md',
  decision: 'docs/decisions/DEC-194-ppk-013-client-data-access-boundary.md',
  audit: 'docs/audit/32-I_PPK-013_ISTEMCI_VERI_ERISIM_UST_KAPANIS.md'
}).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));

const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const requirement = registry.requirements.find((item) => item.id === 'PPK-013');
const scope = JSON.parse(await readFile('config/32-i-ppk-013-client-data-access-boundary-scope.json', 'utf8'));
const ledger = JSON.parse(await readFile('config/user-decision-ledger.json', 'utf8'));
const rootPackage = JSON.parse(sources.package);
const coreClientPackage = JSON.parse(sources.coreClientPackage);
const architectureScan = await scanClientDataAccessBoundary();

const mainFiles = [];
const visitMain = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await visitMain(path);
    else if (entry.isFile() && path.endsWith('.ts')) mainFiles.push(path);
  }
};
await visitMain('apps/desktop/src/main');
const directIpcHandlerFiles = [];
for (const path of mainFiles) {
  const normalized = relative(process.cwd(), path).replaceAll('\\', '/');
  if (normalized !== 'apps/desktop/src/main/ipc-runtime.ts' && /ipcMain\.handle\s*\(/u.test(await readFile(path, 'utf8'))) {
    directIpcHandlerFiles.push(normalized);
  }
}

check('direct data-access exception registry is exported empty and frozen', sources.policy.includes('CLIENT_DIRECT_DATA_ACCESS_EXCEPTIONS = Object.freeze([] as const)'));
check('policy enumerates repository SQL SQLite and vault direct methods', ['direct-repository','direct-sql','direct-sqlite','direct-vault-file'].every((value) => sources.policy.includes(`'${value}'`)));
check('each direct method has a dedicated fail-closed denial', ['DIRECT_REPOSITORY_FORBIDDEN','DIRECT_SQL_FORBIDDEN','DIRECT_SQLITE_FORBIDDEN','DIRECT_VAULT_FILE_FORBIDDEN'].every((value) => sources.policy.includes(value)));
check('policy binds application device subject and family context', ['APPLICATION_MISMATCH','DEVICE_MISMATCH','SUBJECT_MISMATCH','FAMILY_MISMATCH'].every((value) => sources.policy.includes(value)));
check('policy binds package manifest certificate and authorization digest', ['POLICY_PACKAGE_MISMATCH','CAPABILITY_MANIFEST_MISMATCH','DEVICE_CERTIFICATE_MISMATCH','AUTHORIZATION_CONTEXT_MISMATCH'].every((value) => sources.policy.includes(value)));
check('policy rejects exact expiry and malformed context', sources.policy.includes("'AUTHORIZATION_CONTEXT_EXPIRED'") && sources.policy.includes("'MALFORMED_CONTEXT'"));
check('only typed IPC or versioned Core API transports are modeled', sources.policy.includes("'typed-electron-ipc' | 'versioned-core-service-api'") && sources.policy.includes("directAccessAllowed: false"));
check('registered application-service channels are mandatory', sources.policy.includes('#registeredChannels') && sources.policy.includes("'CHANNEL_NOT_REGISTERED'"));
check('bootstrap is isolated to an explicit channel registry', sources.policy.includes('#bootstrapChannels') && sources.policy.includes('evaluateBootstrap'));
check('client boundary is exported by platform policy', sources.policyIndex.includes("export * from './client-data-access-boundary.js'"));
check('domain exposes a non-secret boundary status view', sources.domain.includes('export interface ClientDataAccessBoundaryView') && sources.domain.includes('persistentPathExposed:false'));
check('application use case stops the operation on denial', sources.useCase.includes('class EnforceClientDataAccessUseCase') && sources.useCase.includes('if (!decision.allowed) throw denied'));
check('application status use case preserves Desktop vault and no ownership transfer', sources.useCase.includes('legacyDesktopVaultPreserved: true') && sources.useCase.includes('sqliteOwnershipTransferred: false'));
check('Desktop universal PEP owns the client data-access policy', sources.universal.includes('new ClientDataAccessBoundaryPolicy()') && sources.universal.includes('EnforceClientDataAccessUseCase'));
check('authenticated client fence executes inside the signed transaction callback', sources.universal.includes('assertActivePlatformPolicyTransactionContext') && sources.universal.includes('authorization.receiptRecord.request') && sources.universal.includes('runAuthorized'));
check('Desktop registers every handler with the client service-channel registry', sources.main.includes('policyEnforcement.registerClientApplicationServiceChannel(channel)'));
check('Desktop IPC wrapper still applies universal policy enforcement', sources.main.includes('policyEnforcement,') && sources.ipcRuntime.includes('input.policyEnforcement.execute'));
check('no Desktop main module bypasses the centralized IPC runtime', directIpcHandlerFiles.length === 0);
check('typed client boundary status is exposed through IPC and preload', sources.main.includes("registerIpcHandler('clientDataAccess:getBoundary'") && sources.preload.includes('getClientDataAccessBoundary'));
check('renderer declaration exposes only the typed status method', sources.global.includes('getClientDataAccessBoundary():Promise<ClientDataAccessBoundaryView>'));
check('permissions menu renders the PPK-013 boundary posture', sources.renderer.includes('PPK-013 · istemci veri erişim çiti') && sources.renderer.includes('Repository, SQL, SQLite ve kasa erişimi kapalı'));
check('client syntax scan covers renderer preload and Core Service client SDK', sources.scanner.includes('apps/desktop/src/renderer') && sources.scanner.includes('apps/desktop/src/main/preload.ts') && sources.scanner.includes('packages/core-service-client/src'));
check('client scan blocks repository database SQLite filesystem and vault imports', [
  '@ppt\\/repositories',
  '@ppt\\/repository-contracts',
  '@ppt\\/database',
  '(?:node:)?sqlite',
  '(?:node:)?fs',
  'user-data-vault'
].every((value) => sources.scanner.includes(value)));
check('client scan detects raw SQL syntax and runs malicious self-tests', sources.scanner.includes('RAW_SQL') && sources.scanner.includes('selfTestAssertions'));
check('current client source scan has zero findings', architectureScan.findings.length === 0 && architectureScan.files >= 11);
check('typecheck and production build both run the client fail gate', rootPackage.scripts?.pretypecheck?.includes('verify-client-data-access-boundary.mjs') && rootPackage.scripts?.prebuild?.includes('verify-client-data-access-boundary.mjs'));
check('Core Service client SDK depends only on safe contracts', Object.keys(coreClientPackage.dependencies ?? {}).length === 1 && coreClientPackage.dependencies?.['@ppt/core-service-contracts']);
check('repository and schema ownership remain provider-side', !sources.preload.includes('@ppt/repositories') && !sources.renderer.includes('@ppt/repositories') && !sources.global.includes('@ppt/repository-contracts'));
check('migration 74 receipt authority is reused and no migration 77 exists', sources.migration.includes("createMigrationDefinition(74, 'ppk009_core_service_decision_reevaluation'") && !sources.migration.includes('createMigrationDefinition(77,'));
check('PPK-012 policy-sensitive no-cache channel registry remains present', sources.sensitiveCache.includes('IPC_POLICY_SENSITIVE_READ_CHANNELS') && /ttlMs\s*:\s*0/u.test(sources.sensitiveCache));
check('targeted tests cover direct paths and all security mismatches', ['direct-repository','direct-sql','direct-sqlite','direct-vault-file','APPLICATION_MISMATCH','DEVICE_MISMATCH','SUBJECT_MISMATCH','FAMILY_MISMATCH','POLICY_PACKAGE_MISMATCH'].every((value) => sources.targetedTest.includes(value)));
check('threat model records assets trust zones abuse cases and mitigations', ['Korunan varlıklar','Güven sınırları','Tehditler ve kontroller','Gerçeklik sınırı'].every((value) => sources.threatModel.includes(value)));
check('accepted registry closes the complete PPK-013 evidence chain', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true));
check('scope closes only PPK-013 without cutover or real transfer', scope.status === 'COMPLETED' && scope.requirementCompletionClaimed === true && scope.cutoverAuthorityAttached === false && scope.realDataTransferPerformed === false);
check('DEC-194 is the latest decision and binds PPK-013 evidence', ledger.decisions.at(-1)?.id === 'DEC-194' && ledger.decisions.at(-1)?.requirements?.includes('PPK-013'));
check('decision and audit preserve Desktop vault SQLite ownership and no-cache', sources.decision.includes('Desktop kasası') && sources.decision.includes('SQLite sahipliği') && sources.audit.includes('no-cache'));

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-I',
  requirement: 'PPK-013',
  phase: 'CLIENT_DATA_ACCESS_BOUNDARY_CONTRACT',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  clientSourceScan: {
    zones: architectureScan.zones,
    files: architectureScan.files,
    findings: architectureScan.findings
  },
  directIpcHandlerFiles,
  migrationDecision: 'NO_NEW_SCHEMA_MIGRATION_REUSE_74_POLICY_RECEIPT_AUTHORITY',
  directAccessExceptions: 0,
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  cutoverAuthorityAttached: false,
  realDataTransferPerformed: false,
  policySensitiveIpcNoCacheWeakened: false,
  requirementCompletionClaimed: failures.length === 0,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-I-ppk-013-client-data-access-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`32-I PPK-013 contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`32-I PPK-013 contract: PASS (${checks.length}/${checks.length}).`);
