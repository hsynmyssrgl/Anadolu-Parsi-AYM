import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);

const output = 'artifacts/validation/33-Q-local-governed-ocr-derived-data-pipeline-contract.json';
const noWrite = process.argv.includes('--no-write');
const requirements = Object.freeze([
  'B3-04',
  ...Array.from({ length: 20 }, (_, index) => `OCR-${String(index + 1).padStart(3, '0')}`),
  'XPF-001'
]);
const testFiles = Object.freeze([
  'packages/application/tests/local-governed-ocr-use-cases.test.ts',
  'packages/repositories/local-governed-ocr-repository-policy.test.ts',
  'packages/database/transaction-async.test.ts',
  'packages/security/tests/local-ocr-security.test.ts',
  'apps/desktop/tests/local-ocr-input-adapter.test.ts',
  'apps/desktop/tests/local-ocr-worker.test.ts',
  'apps/desktop/tests/windows-media-ocr-engine-adapter.test.ts',
  'apps/desktop/tests/local-governed-ocr-runtime-adapter.test.ts',
  'apps/desktop/tests/local-governed-ocr-application-adapter.test.ts',
  'apps/desktop/tests/local-governed-ocr-production-policy-runtime.test.ts',
  'apps/desktop/tests/local-governed-ocr-ipc-integration.test.ts',
  'apps/desktop/tests/local-governed-ocr-ipc-bridge.test.ts',
  'apps/desktop/tests/local-governed-ocr-ui.test.ts',
  'apps/desktop/tests/local-governed-ocr-data-store-production.test.ts'
]);
const sourcePaths = Object.freeze({
  domain: 'packages/domain/src/local-governed-ocr.ts',
  application: 'packages/application/src/local-governed-ocr-use-cases.ts',
  repositoryContract: 'packages/repository-contracts/src/local-governed-ocr-repository.ts',
  repository: 'packages/repositories/src/local-governed-ocr-repository.ts',
  transaction: 'packages/database/src/transaction.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  security: 'packages/security/src/local-ocr-security.ts',
  input: 'apps/desktop/src/main/local-ocr-input-adapter.ts',
  engine: 'apps/desktop/src/main/local-ocr-engine-adapter.ts',
  windowsEngine: 'apps/desktop/src/main/windows-media-ocr-engine-adapter.ts',
  worker: 'apps/desktop/src/main/local-ocr-worker.ts',
  appAdapter: 'apps/desktop/src/main/local-governed-ocr-application-adapter.ts',
  policy: 'apps/desktop/src/main/timeline-production-policy-runtime.ts',
  resultVault: 'apps/desktop/src/main/local-governed-ocr-result-vault.ts',
  runtimeAdapter: 'apps/desktop/src/main/local-governed-ocr-runtime-adapter.ts',
  compositionRoot: 'apps/desktop/src/main/repository-composition-root.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  ipcPolicy: 'apps/desktop/src/main/ipc-integration-policy.ts',
  ipcLifecycle: 'apps/desktop/src/main/ipc-request-lifecycle.ts',
  main: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  rendererTypes: 'apps/desktop/src/renderer/global.d.ts',
  panel: 'apps/desktop/src/renderer/LocalGovernedOcrPanel.tsx',
  app: 'apps/desktop/src/renderer/App.tsx'
});

const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const exists = async (path) => {
  try { await access(resolve(root, path)); return true; } catch { return false; }
};
const [scope, inventory, registry, roadmap, plan, ledger, capabilityManifest, migrationManifest] = await Promise.all([
  readJson('config/33-q-local-governed-ocr-derived-data-pipeline-scope.json'),
  readJson('config/33-q-local-governed-ocr-derived-data-pipeline-inventory.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/remaining-scope-package-roadmap.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json'),
  readJson('config/32-r-ppk-022-capability-surface-manifest.json'),
  readJson('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json')
]);
const sources = Object.fromEntries(await Promise.all(
  Object.entries(sourcePaths).map(async ([key, path]) => [key, await readFile(resolve(root, path), 'utf8')])
));
const tests = Object.fromEntries(await Promise.all(
  testFiles.map(async (path) => [path, await readFile(resolve(root, path), 'utf8')])
));
const has = (key, ...markers) => markers.every((marker) => sources[key].includes(marker));
const testHas = (path, ...markers) => markers.every((marker) => tests[path].includes(marker));
const allTestsExist = (await Promise.all(testFiles.map(exists))).every(Boolean);
const registryItems = requirements.map((id) => registry.requirements?.find((item) => item.id === id));
const roadmap33Q = roadmap.packages?.find((item) => item.step === '33-Q');
const migration94 = migrationManifest.migrationVersions?.find((item) => item.version === 94);
const migrationMatch = sources.migration.match(/const localGovernedOcrLedgerSql = `([\s\S]*?)`;\r?\n\r?\n(?=const [A-Za-z_$][A-Za-z0-9_$]*Sql =|export const FAMILY_DATABASE_MIGRATIONS)/u);
const migration94Sha256 = migrationMatch
  ? createHash('sha256').update(`${migrationMatch[1].replace(/\r\n/g, '\n').trim()}\n`).digest('hex')
  : '';
const localOcrPreloadChannels = [...sources.preload.matchAll(/invoke\('(localOcr:[^']+)'/gu)].map((match) => match[1]);

const definitions = [
  ['snapshot remains planned partial and behind active 33-P',
    scope.status === 'PLANNED' && scope.localImplementationStatus === 'PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED_ACCEPTANCE_INCOMPLETE'
      && inventory.implementationStatus === 'PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED_ACCEPTANCE_INCOMPLETE'
      && roadmap33Q?.status === 'PLANNED' && plan.currentStep === '33-P' && ledger.activeMicroStep === '33-P'
      && scope.truth?.requirementsClosed === false && scope.validation?.countsAsRequirementPass === false],
  ['accepted registry remains exact open atomic closure authority',
    exact(scope.requirements, requirements) && exact(inventory.requirements, requirements)
      && registryItems.every((item) => item?.status === 'NOT_IMPLEMENTED' && item.chain?.evidence === false)],
  ['implemented targeted inventory is the exact 14-file local snapshot',
    allTestsExist && exact(inventory.implementedTargetedTests, testFiles)
      && scope.validation?.targetedTestFileRatchet === 14 && scope.validation?.targetedTestRatchet === 102
      && inventory.validation?.targetedTestFileRatchet === 14 && inventory.validation?.targetedTestRatchet === 102],
  ['domain and application contracts bind limits local execution and no low-privilege overclaim',
    has('domain', 'LOCAL_GOVERNED_OCR_MAX_SOURCE_BYTES = 16 * 1_024 * 1_024',
      'LOCAL_GOVERNED_OCR_MAX_RESULT_CHARACTERS = 250_000', 'LOCAL_GOVERNED_OCR_MAX_PAGES = 50',
      "executionScope: 'bounded_child_process'", 'lowPrivilegeSandboxVerified: false',
      'sourceDeletionAutoResumeGuaranteed: false')
      && has('application', 'LocalGovernedOcrRuntimePort', 'runAndSeal', 'purgeSealedResult',
        "executionScope: 'bounded_child_process'", 'lowPrivilegeSandboxVerified: false')
      && has('repositoryContract', 'LocalGovernedOcrRepositoryPort', 'LocalGovernedOcrSourceDeletionBatch')],
  ['repository and migration bind metadata lineage retention and immutable source-delete child ledger',
    migration94?.name === 'local_governed_ocr' && migration94?.checksum === migration94Sha256
      && migration94Sha256 === 'd97738a84ace5de1e56f76f0ea263e6e39a1ec21a52952ed32df6767d04a87e0'
      && has('migration', 'local_governed_ocr_jobs', 'local_governed_ocr_mutations',
        'local_governed_ocr_source_deletion_items', 'trg_33q_source_deletion_item_insert', 'trg_33q_mutation_delete')
      && has('repository', 'SqliteLocalGovernedOcrRepository', 'assertPolicyAuthorizedRepositoryContext',
        'public propagateSourceDeletion', 'itemMutationId')
      && testHas(testFiles[1], 'repository-derived immutable item ledgers', 'expired unreferenced mutation metadata')],
  ['central PEP UoW keeps ocr_process and sensitive_processing separate and leases exact runtime authority',
    has('policy', "intent.purpose === 'ocr_process'", "'sensitive_processing'", "capability: 'archive.ocr'")
      && has('appAdapter', 'RepositoryBackedLocalGovernedOcrUnitOfWork',
        'Local OCR run authority is not bound to every exact central receipt',
        'Local OCR orphan sweep requires a distinct maintenance authorization', 'finally')
      && has('transaction', 'class SqliteTransactionExecutor implements TransactionExecutor, AsyncTransactionExecutor', 'finally')
      && testHas(testFiles[8], 'leases the exact run source only after every receipt and revokes it on every exit path',
        'revokes the runtime lease on rollback', 'cancellationRuntimeCalls')
      && testHas(testFiles[2], 'rejects overlapping sync or async use', 'rolls back an application error')],
  ['security and worker are local bounded child-process components with PDF malware and low privilege fail-closed',
    has('security', 'LOCAL_OCR_MAX_INPUT_BYTES = 16 * 1024 * 1024', 'LOCAL_OCR_MAX_PAGES = 50',
      'LOCAL_OCR_MAX_IMAGE_PIXELS = 40_000_000', 'LOCAL_OCR_MAX_TEXT_CHARACTERS = 250_000',
      'processSeparated: true', 'lowPrivilegeSandboxVerified: false')
      && has('worker', "executionBoundary !== 'bounded-child-process'", 'lowPrivilegeSandboxVerified !== false')
      && has('windowsEngine', "throw new LocalOcrSecurityError('UNSUPPORTED_MEDIA')", 'processSeparated=$true', 'lowPrivilegeSandboxVerified=$false')
      && testHas(testFiles[5], 'malware scanner is not configured', 'caps concurrent jobs at one')
      && testHas(testFiles[6], 'without claiming a low-privilege sandbox', 'fails closed for PDF')],
  ['sealed result vault is owner-bound encrypted quota-limited and does not claim scheduled maintenance wiring',
    has('resultVault', 'class LocalGovernedOcrResultVault', 'LOCAL_GOVERNED_OCR_RESULT_VAULT_MAX_FILES = 1_024',
      'LOCAL_GOVERNED_OCR_RESULT_VAULT_MAX_BYTES = 256 * 1024 * 1024', 'NO_OVERWRITE_CONFLICT')
      && has('runtimeAdapter', 'class MainLocalGovernedOcrRuntimeAdapter', 'createWindowsLocalGovernedOcrRuntimeAdapter',
        "operation: 'orphan_sweep'", "executionScope: 'bounded_child_process'", 'lowPrivilegeSandboxVerified: false')
      && testHas(testFiles[7], 'hard-link', 'orphan', 'cursor')
      && scope.truth?.scheduledOrphanSweepProductionWiringValidated === false
      && scope.truth?.retentionExpiryPurgeValidated === false],
  ['DataStore production facade composes PEP UoW vault runtime and hashes corrected text metadata',
    has('compositionRoot', 'SqliteLocalGovernedOcrRepository', 'localGovernedOcrRepository')
      && has('dataStore', 'createLocalGovernedOcrProductionPolicyEnforcementPointResolver',
        'createWindowsLocalGovernedOcrRuntimeAdapter', 'new LocalGovernedOcrResultVault',
        'failClosedLocalGovernedOcrRuntime', 'correctedTextSha256', '#propagateLocalGovernedOcrArchiveDeletion')
      && testHas(testFiles[13], 'fails closed without central policy', 'no malware provider', 'source deletion with the same operation id')
      && scope.truth?.localDataStoreFacadeCompositionTested === true
      && scope.truth?.productionProviderWiredAndValidated === false],
  ['desktop exposes exactly nine safe renderer OCR methods and keeps source deletion main-only',
    exact(localOcrPreloadChannels, [
      'localOcr:getCenter', 'localOcr:getResult', 'localOcr:create', 'localOcr:run', 'localOcr:cancel',
      'localOcr:correct', 'localOcr:rerun', 'localOcr:delete', 'localOcr:setEnabled'
    ])
      && has('rendererTypes', 'getLocalGovernedOcrCenter', 'setLocalGovernedOcrEnabled')
      && !sources.preload.includes('propagateLocalGovernedOcrSourceDeletion')
      && has('ipcPolicy', "executionScope: 'bounded_child_process'", 'sourceContentExposedToRenderer !== false')
      && sources.ipcPolicy.includes('sourceDeletionAutoResumeGuaranteed !== false')
      && testHas(testFiles[10], 'main-only', 'source')
      && testHas(testFiles[11], 'nine', 'bridge')],
  ['Archive UI uses the safe bridge with explicit reveal idempotent retry and no remote truth claim',
    has('panel', 'function LocalGovernedOcrPanel', 'getLocalGovernedOcrCenter',
      'onClick={() => void readResult()}', 'clientOperationId', 'expectedRevision')
      && has('app', "import { LocalGovernedOcrPanel }", '<LocalGovernedOcrPanel')
      && testHas(testFiles[12], 'mutation identity and original CAS revision stable across a failed retry', 'offline', 'PDF')
      && scope.truth?.rendererUiComponentTested === true
      && scope.truth?.rendererQueuedCancelOnlyTruthDisclosed === true
      && scope.plannedModel?.searchAndUserControl?.runningConcurrentCancelSupported === false
      && scope.truth?.productionUiEndToEndValidated === false],
  ['source-deletion ordering is fail-honest while crash auto-resume and atomic propagation remain false',
    scope.truth?.sourceDeletionBatchPersistenceValidated === true
      && scope.truth?.archiveSourceDestroyBeforeOcrPropagationOrderingValidated === true
      && scope.truth?.archiveSourceDestroyAndOcrPropagationAtomicityValidated === false
      && scope.truth?.archiveSourceDestroyCrashWindowAutoResumeValidated === false
      && scope.truth?.sourceDeletionAutoResumeGuaranteed === false
      && scope.truth?.permissionOrConsentRevocationOcrPurgeValidated === false
      && scope.plannedModel?.deletion?.ocrOwnerRegistration === 'PARTIAL_LOCAL_METADATA_OWNER_REGISTERED_GUARANTEED_PROPAGATION_FALSE'],
  ['capability manifest grants aggregate desktop OCR only and no separate worker or sandbox claim',
    capabilityManifest.defaultDecision === 'DENY'
      && capabilityManifest.applicationRuntimeCapabilities?.['windows-desktop']?.includes('ocr.process')
      && capabilityManifest.applicationRuntimeCapabilities?.['windows-desktop']?.includes('network.access')
      && exact(capabilityManifest.applicationRuntimeCapabilities?.['ocr-worker'], [])
      && scope.truth?.lowPrivilegeOcrSandboxVerified === false
      && scope.truth?.workerNetworkIsolationVerified === false],
  ['all open acceptance and no-claim truth stays false',
    scope.truth?.productionConcurrentRunCancelProbeExecuted === true
      && scope.truth?.productionConcurrentRunCancelValidated === false
      && scope.truth?.maliciousFileScannerProviderAvailable === false
      && scope.truth?.externalOcrProviderConfigured === false
      && scope.truth?.rawDocumentEgressPerformed === false
      && scope.truth?.ocrTextAutomaticallySentToAi === false
      && scope.truth?.crossDeviceOcrSyncPerformed === false
      && scope.truth?.physicalSecureEraseGuaranteed === false
      && scope.truth?.externalCopyDestructionGuaranteed === false]
];

const checks = definitions.map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
const failures = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 3,
  step: '33-Q',
  decision: 'DEC-228',
  requirements,
  status: failures.length ? 'FAIL' : 'PASS',
  governanceState: 'PLANNED',
  implementationStatus: 'PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED_ACCEPTANCE_INCOMPLETE',
  automatedContractStatus: failures.length ? 'FAIL' : 'LOCAL_COMPOSED_SOURCE_PASS',
  countsAsRequirementPass: false,
  activePredecessor: '33-P',
  localTargetedTestFiles: testFiles,
  targetedTestRatchet: { files: 14, tests: 102 },
  migration94Sha256,
  checksPassed: checks.length - failures.length,
  checksFailed: failures.length,
  checks,
  generatedAt: new Date().toISOString()
};

if (!noWrite) {
  await mkdir(dirname(resolve(root, output)), { recursive: true });
  await writeFile(resolve(root, output), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
console.log(`33-Q contract starter: ${report.status} (${report.checksPassed}/${checks.length}; partial composed; requirement PASS=false; write=${!noWrite}).`);
if (failures.length) {
  console.error(`Failed checks: ${failures.map((item) => item.name).join(' | ')}`);
  process.exitCode = 1;
}
