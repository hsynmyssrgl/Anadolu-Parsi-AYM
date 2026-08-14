import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);

const output = 'artifacts/validation/33-Q-local-governed-ocr-derived-data-pipeline-runtime.json';
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

const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const [scope, inventory, registry, roadmap, plan, ledger, capabilityManifest, migrationManifest,
  ppk021Runtime, ppk022Runtime, migrationSource] = await Promise.all([
  readJson('config/33-q-local-governed-ocr-derived-data-pipeline-scope.json'),
  readJson('config/33-q-local-governed-ocr-derived-data-pipeline-inventory.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/remaining-scope-package-roadmap.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json'),
  readJson('config/32-r-ppk-022-capability-surface-manifest.json'),
  readJson('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
  readJson('artifacts/validation/32-Q-ppk-021-platform-policy-ast-gate-runtime.json'),
  readJson('artifacts/validation/32-R-ppk-022-capability-manifest-gate-runtime.json'),
  readFile(resolve(root, 'packages/database/src/family-database-migrations.ts'), 'utf8')
]);

const run = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...testFiles, '--maxWorkers=1'], {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true,
  timeout: 300_000,
  maxBuffer: 32 * 1024 * 1024,
  env: process.env
});
const combined = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
const fileMatch = combined.match(/Test Files\s+(?:\d+ failed\s+\|\s+)?(\d+) passed/u);
const testMatch = combined.match(/Tests\s+(?:\d+ failed\s+\|\s+)?(\d+) passed/u);
const filesPassed = fileMatch ? Number(fileMatch[1]) : 0;
const testsPassed = testMatch ? Number(testMatch[1]) : 0;
const migration94 = migrationManifest.migrationVersions?.find((item) => item.version === 94);
const migrationMatch = migrationSource.match(/const localGovernedOcrLedgerSql = `([\s\S]*?)`;\r?\n\r?\n(?=const [A-Za-z_$][A-Za-z0-9_$]*Sql =|export const FAMILY_DATABASE_MIGRATIONS)/u);
const migration94Sha256 = migrationMatch
  ? createHash('sha256').update(`${migrationMatch[1].replace(/\r\n/g, '\n').trim()}\n`).digest('hex')
  : '';
const roadmap33Q = roadmap.packages?.find((item) => item.step === '33-Q');
const registryItems = requirements.map((id) => registry.requirements?.find((item) => item.id === id));
const manualEvidenceNotRun = Object.entries(scope.manualEvidence ?? {})
  .filter(([key]) => key !== 'certificationClaimed')
  .every(([, value]) => value === 'NOT_RUN');
const ppk = inventory.ppkGateEvidence ?? {};
const ppk021Gate = ppk021Runtime.results?.find((item) => item.id === 'typescript-ast-production-source-gate');
const ppk022Gate = ppk022Runtime.results?.find((item) => item.id === 'ppk-022-capability-production-gate');
const ppk021Tail = ppk021Gate?.outputTail ?? '';
const ppk022Tail = ppk022Gate?.outputTail ?? '';

const definitions = [
  ['exact 14-file local Vitest process exits successfully', run.status === 0],
  ['local test result meets the exact 14/102 ratchet',
    run.status === 0 && filesPassed === 14 && testsPassed === 102
      && scope.validation?.targetedTestFileRatchet === 14 && scope.validation?.targetedTestRatchet === 102
      && inventory.validation?.targetedTestFileRatchet === 14 && inventory.validation?.targetedTestRatchet === 102
      && exact(inventory.implementedTargetedTests, testFiles)],
  ['migration 94 manifest and canonical source hash remain exact',
    migration94?.name === 'local_governed_ocr' && migration94?.checksum === migration94Sha256
      && migration94Sha256 === 'd97738a84ace5de1e56f76f0ea263e6e39a1ec21a52952ed32df6767d04a87e0'],
  ['PPK-021 runtime artifact is PASS at the exact current ratchet',
    ppk.ppk021?.status === 'PASS' && ppk021Runtime.status === 'PASS' && ppk021Gate?.status === 'PASS'
      && ppk021Tail.includes(`"scannedFiles": ${ppk.ppk021.scannedProductionFiles}`)
      && ppk021Tail.includes(`"privilegedSurfaces": ${ppk.ppk021.exactPrivilegedSurfaceCount}`)
      && ppk021Tail.includes(ppk.ppk021.exactAllowlistSha256)],
  ['PPK-022 runtime artifact is PASS at the exact current ratchet',
    ppk.ppk022?.status === 'PASS' && ppk022Runtime.status === 'PASS' && ppk022Gate?.status === 'PASS'
      && ppk022Tail.includes(`"scannedFiles": ${ppk.ppk022.scannedProductionFiles}`)
      && ppk022Tail.includes(`"capabilitySurfaces": ${ppk.ppk022.exactCapabilitySurfaceCount}`)
      && ppk022Tail.includes(ppk.ppk022.exactCapabilityManifestSha256)],
  ['PPK capability runtime preserves aggregate desktop and empty worker truth',
    capabilityManifest.applicationRuntimeCapabilities?.['windows-desktop']?.includes('ocr.process')
      && capabilityManifest.applicationRuntimeCapabilities?.['windows-desktop']?.includes('network.access')
      && exact(capabilityManifest.applicationRuntimeCapabilities?.['ocr-worker'], [])
      && scope.truth?.lowPrivilegeOcrSandboxVerified === false
      && scope.truth?.workerNetworkIsolationVerified === false],
  ['33-Q remains planned behind 33-P and accepted registry stays open',
    roadmap33Q?.status === 'PLANNED' && plan.currentStep === '33-P' && ledger.activeMicroStep === '33-P'
      && scope.status === 'PLANNED'
      && scope.localImplementationStatus === 'PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED_ACCEPTANCE_INCOMPLETE'
      && registryItems.every((item) => item?.status === 'NOT_IMPLEMENTED' && item.chain?.evidence === false)
      && scope.truth?.requirementsClosed === false
      && scope.validation?.countsAsRequirementPass === false
      && inventory.validation?.countsAsRequirementPass === false],
  ['local composition tests do not close successful production OCR acceptance',
    scope.truth?.localCentralPepUowCompositionTested === true
      && scope.truth?.localEncryptedSealedResultVaultComponentTested === true
      && scope.truth?.localDataStoreFacadeCompositionTested === true
      && scope.truth?.desktopIpcSurfaceComponentTested === true
      && scope.truth?.rendererUiComponentTested === true
      && scope.truth?.productionProviderWiredAndValidated === false
      && scope.truth?.productionOcrRuntimeExecuted === false
      && scope.truth?.maliciousFileScannerProviderAvailable === false],
  ['known high cancellation source-delete and maintenance residuals remain open',
    scope.truth?.productionConcurrentRunCancelProbeExecuted === true
      && scope.truth?.productionConcurrentRunCancelValidated === false
      && scope.truth?.archiveSourceDestroyBeforeOcrPropagationOrderingValidated === true
      && scope.truth?.archiveSourceDestroyAndOcrPropagationAtomicityValidated === false
      && scope.truth?.archiveSourceDestroyCrashWindowAutoResumeValidated === false
      && scope.truth?.sourceDeletionAutoResumeGuaranteed === false
      && scope.truth?.permissionOrConsentRevocationOcrPurgeValidated === false
      && scope.truth?.scheduledOrphanSweepProductionWiringValidated === false
      && scope.truth?.retentionExpiryPurgeValidated === false],
  ['external manual UAT legal privacy security and certification evidence remains NOT_RUN',
    manualEvidenceNotRun && scope.manualEvidence?.certificationClaimed === false
      && scope.truth?.externalOcrProviderConfigured === false
      && scope.truth?.externalProviderAvailabilityVerified === false
      && scope.truth?.crossDeviceOcrSyncPerformed === false
      && scope.truth?.physicalSecureEraseGuaranteed === false
      && scope.persistentReceiptStatus === 'NOT_RUN']
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
  automatedRuntimeStatus: failures.length ? 'FAIL' : 'LOCAL_COMPOSED_COMPONENT_MATRIX_PASS',
  countsAsRequirementPass: false,
  requirementGateStatus: 'BLOCKED_BY_33_P_AND_OPEN_TECHNICAL_EXTERNAL_MANUAL_EVIDENCE',
  activePredecessor: '33-P',
  sourceStabilizationStatus: 'STABLE_LOCAL_SNAPSHOT',
  ratchetSemantics: 'EXACT_LOCAL_SNAPSHOT_NOT_REQUIREMENT_CLOSURE',
  targetedTestFilesPassed: filesPassed,
  targetedTestsPassed: testsPassed,
  targetedTestFileRatchet: 14,
  targetedTestRatchet: 102,
  testFiles,
  migration94Sha256,
  ppkGateEvidence: ppk,
  openAcceptanceBindings: {
    activePredecessor: '33-P',
    malwareProvider: 'UNAVAILABLE_FAIL_CLOSED',
    pdfLanes: 'UNSUPPORTED_FAIL_CLOSED',
    lowPrivilegeSandbox: 'NOT_VERIFIED',
    concurrentRunCancel: 'HIGH_OPEN',
    sourceDeleteCrashAutoResume: 'HIGH_OPEN',
    permissionOrConsentRevocationPurge: 'OPEN',
    scheduledOrphanSweepAuthority: 'UNWIRED',
    retentionExpiryPurge: 'OPEN',
    fullTextIndexAndMaskedSnippet: 'NOT_IMPLEMENTED',
    realDeviceExternalAndManualEvidence: 'NOT_RUN'
  },
  checksPassed: checks.length - failures.length,
  checksFailed: failures.length,
  checks,
  process: {
    exitCode: run.status,
    signal: run.signal ?? null,
    reason: run.status === 0
      ? 'Local composed component matrix completed; requirement, external and manual evidence remain open.'
      : 'Local composed component matrix failed closed.'
  },
  generatedAt: new Date().toISOString()
};

if (!noWrite) {
  await mkdir(dirname(resolve(root, output)), { recursive: true });
  await writeFile(resolve(root, output), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
console.log(`33-Q runtime starter: ${report.status} (${report.checksPassed}/${checks.length}; ${filesPassed}/14 files; ${testsPassed}/102 tests; requirement PASS=false; write=${!noWrite}).`);
if (failures.length) {
  console.error(combined.slice(-4000));
  process.exitCode = 1;
}
