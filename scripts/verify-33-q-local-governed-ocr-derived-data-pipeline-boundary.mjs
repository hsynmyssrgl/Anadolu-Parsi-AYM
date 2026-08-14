import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);

const output = 'artifacts/validation/33-Q-local-governed-ocr-derived-data-pipeline-boundary.json';
const noWrite = process.argv.includes('--no-write');
const requirements = Object.freeze([
  'B3-04',
  ...Array.from({ length: 20 }, (_, index) => `OCR-${String(index + 1).padStart(3, '0')}`),
  'XPF-001'
]);
const dependencies = Object.freeze(['33-O', '33-P', 'PPK-016', 'PPK-019', 'PPK-022']);
const sharedAcceptance = 'Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez.';
const acceptance = Object.freeze({
  'B3-04': 'Desteklenen belgelerde yerel indeks; ham belge dışarı gönderilmez.',
  'OCR-001': 'Kaynakta provider, use-case, schema, UI ve test zinciri bulunmalıdır.',
  ...Object.fromEntries(requirements.slice(2).map((id) => [id, sharedAcceptance]))
});
const governancePaths = Object.freeze([
  'config/33-q-local-governed-ocr-derived-data-pipeline-scope.json',
  'config/33-q-local-governed-ocr-derived-data-pipeline-inventory.json',
  'docs/decisions/DEC-228-local-governed-ocr-derived-data-pipeline.md',
  'docs/security/THREAT_MODEL_33_Q_LOCAL_GOVERNED_OCR_DERIVED_DATA_PIPELINE.md',
  'scripts/verify-33-q-local-governed-ocr-derived-data-pipeline-boundary.mjs',
  'scripts/verify-33-q-local-governed-ocr-derived-data-pipeline-contract.mjs',
  'scripts/verify-33-q-local-governed-ocr-derived-data-pipeline-runtime.mjs'
]);
const localSourcePaths = Object.freeze([
  'packages/domain/src/local-governed-ocr.ts',
  'packages/application/src/local-governed-ocr-use-cases.ts',
  'packages/repository-contracts/src/local-governed-ocr-repository.ts',
  'packages/repositories/src/local-governed-ocr-repository.ts',
  'packages/database/src/transaction.ts',
  'packages/database/src/family-database-migrations.ts',
  'packages/security/src/local-ocr-security.ts',
  'apps/desktop/src/main/local-ocr-input-adapter.ts',
  'apps/desktop/src/main/local-ocr-engine-adapter.ts',
  'apps/desktop/src/main/windows-media-ocr-engine-adapter.ts',
  'apps/desktop/src/main/local-ocr-worker.ts',
  'apps/desktop/src/main/local-governed-ocr-application-adapter.ts',
  'apps/desktop/src/main/timeline-production-policy-runtime.ts',
  'apps/desktop/src/main/local-governed-ocr-result-vault.ts',
  'apps/desktop/src/main/local-governed-ocr-runtime-adapter.ts',
  'apps/desktop/src/main/repository-composition-root.ts',
  'apps/desktop/src/main/data-store.ts',
  'apps/desktop/src/main/ipc-integration-policy.ts',
  'apps/desktop/src/main/ipc-request-lifecycle.ts',
  'apps/desktop/src/main/main.ts',
  'apps/desktop/src/main/preload.ts',
  'apps/desktop/src/renderer/global.d.ts',
  'apps/desktop/src/renderer/LocalGovernedOcrPanel.tsx',
  'apps/desktop/src/renderer/App.tsx',
  'apps/desktop/src/renderer/styles.css'
]);

const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const exists = async (path) => {
  try { await access(resolve(root, path)); return true; } catch { return false; }
};
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const allFalseExceptDocumentation = (chain) => Object.entries(chain ?? {})
  .every(([key, value]) => key === 'documentation' ? value === true : value === false);

const [scope, inventory, registry, roadmap, plan, ledger, pkg, capabilityManifest, ppk021Scope,
  ppk021Inventory, ppk022Scope, ppk022Inventory, migrationManifest, migrationSource, decision, threat] = await Promise.all([
  readJson('config/33-q-local-governed-ocr-derived-data-pipeline-scope.json'),
  readJson('config/33-q-local-governed-ocr-derived-data-pipeline-inventory.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/remaining-scope-package-roadmap.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json'),
  readJson('package.json'),
  readJson('config/32-r-ppk-022-capability-surface-manifest.json'),
  readJson('config/32-q-ppk-021-platform-policy-ast-gate-scope.json'),
  readJson('config/32-q-ppk-021-platform-policy-ast-gate-inventory.json'),
  readJson('config/32-r-ppk-022-capability-manifest-gate-scope.json'),
  readJson('config/32-r-ppk-022-capability-manifest-gate-inventory.json'),
  readJson('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
  readFile(resolve(root, 'packages/database/src/family-database-migrations.ts'), 'utf8'),
  readFile(resolve(root, 'docs/decisions/DEC-228-local-governed-ocr-derived-data-pipeline.md'), 'utf8'),
  readFile(resolve(root, 'docs/security/THREAT_MODEL_33_Q_LOCAL_GOVERNED_OCR_DERIVED_DATA_PIPELINE.md'), 'utf8')
]);

const roadmap33Q = roadmap.packages?.find((item) => item.step === '33-Q');
const registryItems = requirements.map((id) => registry.requirements?.find((item) => item.id === id));
const migration94 = migrationManifest.migrationVersions?.find((item) => item.version === 94);
const migrationMatch = migrationSource.match(/const localGovernedOcrLedgerSql = `([\s\S]*?)`;\r?\n\r?\n(?=const [A-Za-z_$][A-Za-z0-9_$]*Sql =|export const FAMILY_DATABASE_MIGRATIONS)/u);
const migration94Sha256 = migrationMatch
  ? createHash('sha256').update(`${migrationMatch[1].replace(/\r\n/g, '\n').trim()}\n`).digest('hex')
  : '';
const ppk = inventory.ppkGateEvidence ?? {};
const governancePathsExist = (await Promise.all(governancePaths.map(exists))).every(Boolean);
const localSourcePathsExist = (await Promise.all(localSourcePaths.map(exists))).every(Boolean);
const manualEvidenceNotRun = Object.entries(scope.manualEvidence ?? {})
  .filter(([key]) => key !== 'certificationClaimed')
  .every(([, value]) => value === 'NOT_RUN');
const no33QLifecycleOrClosureCommand = !Object.keys(pkg.scripts ?? {}).some((name) =>
  /^(?:activate|prepare|finalize):33-q$|^verify:33-q:(?:completion|targeted|runtime|boundary|contract)$/u.test(name));

const definitions = [
  ['exact 22-item accepted chain remains open in the atomic registry',
    exact(scope.requirements, requirements) && exact(inventory.requirements, requirements)
      && registryItems.every((item, index) => item?.status === 'NOT_IMPLEMENTED'
        && item.title === scope.canonicalRequirementTitles?.[requirements[index]]
        && item.acceptance === acceptance[requirements[index]]
        && allFalseExceptDocumentation(item.chain))],
  ['roadmap retains exact planned DEC-228 dependency and leverage',
    roadmap33Q?.decision === 'DEC-228' && roadmap33Q?.title === 'Local governed OCR and derived-data pipeline'
      && roadmap33Q?.status === 'PLANNED' && roadmap33Q?.risk === 'VERY_HIGH'
      && exact(roadmap33Q?.dependsOn, dependencies) && exact(roadmap33Q?.requirementIds, requirements)
      && roadmap33Q?.leverage === 'Uses the encrypted archive vault, capability gates, consent, derived-policy inheritance, deletion propagation, content-free audit and worker isolation.'],
  ['33-P remains active and no 33-Q activation or closure mutation exists',
    plan.workflowStatus === 'IN_PROGRESS' && plan.currentStep === '33-P'
      && plan.steps?.find((item) => item.id === '33-P')?.status === 'IN_PROGRESS'
      && plan.steps?.find((item) => item.id === '33-Q') === undefined
      && ledger.activeMicroStep === '33-P'
      && ledger.nextOfficialTask === '33-P_DEC-227_IMPLEMENTATION_VALIDATION_AND_RECEIPT'
      && no33QLifecycleOrClosureCommand],
  ['governance truth is partial composed but never requirement PASS',
    scope.status === 'PLANNED' && scope.governancePhase === 'LOCAL_IMPLEMENTATION_STARTED'
      && scope.localImplementationStatus === 'PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED_ACCEPTANCE_INCOMPLETE'
      && inventory.status === 'PLANNED'
      && inventory.implementationStatus === 'PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED_ACCEPTANCE_INCOMPLETE'
      && scope.truth?.requirementsClosed === false && scope.validation?.countsAsRequirementPass === false
      && inventory.countsAsRequirementPass === false && inventory.validation?.countsAsRequirementPass === false
      && scope.persistentReceiptStatus === 'NOT_RUN' && inventory.persistentReceiptStatus === 'NOT_RUN'],
  ['all governance and partial production source surfaces exist', governancePathsExist && localSourcePathsExist],
  ['migration 94 canonical definition and manifest are exact',
    migration94?.name === 'local_governed_ocr' && migration94?.checksum === migration94Sha256
      && migration94Sha256 === '08fef61dc21062134716dfae8e78c2256eb5da275eedaf1fe3502a3c2450cb65'
      && scope.plannedModel?.resultAndStorage?.migration94Sha256 === migration94Sha256],
  ['PPK-021 and PPK-022 ratchets match the final declared local snapshot',
    ppk.ppk021?.status === 'PASS' && ppk.ppk022?.status === 'PASS'
      && ppk021Scope.boundaries?.scannedProductionFiles === ppk.ppk021.scannedProductionFiles
      && ppk021Scope.boundaries?.exactPrivilegedSurfaceCount === ppk.ppk021.exactPrivilegedSurfaceCount
      && ppk021Scope.boundaries?.exactAllowlistSha256 === ppk.ppk021.exactAllowlistSha256
      && ppk021Inventory.engine?.findings === 0
      && ppk022Scope.boundaries?.scannedProductionFiles === ppk.ppk022.scannedProductionFiles
      && ppk022Scope.boundaries?.exactCapabilitySurfaceCount === ppk.ppk022.exactCapabilitySurfaceCount
      && ppk022Scope.boundaries?.exactCapabilityManifestSha256 === ppk.ppk022.exactCapabilityManifestSha256
      && ppk022Inventory.engine?.findings === 0
      && capabilityManifest.scannedProductionFiles === ppk.ppk022.scannedProductionFiles
      && capabilityManifest.exactCapabilitySurfaceCount === ppk.ppk022.exactCapabilitySurfaceCount],
  ['capability truth does not manufacture a separate low-privilege worker identity',
    capabilityManifest.defaultDecision === 'DENY'
      && capabilityManifest.applicationRuntimeCapabilities?.['windows-desktop']?.includes('ocr.process')
      && capabilityManifest.applicationRuntimeCapabilities?.['windows-desktop']?.includes('network.access')
      && exact(capabilityManifest.applicationRuntimeCapabilities?.['ocr-worker'], [])
      && exact(inventory.reuseTruth?.ocrWorkerRuntimeCapabilities, [])
      && scope.truth?.lowPrivilegeOcrSandboxVerified === false
      && scope.truth?.workerNetworkIsolationVerified === false],
  ['local composition markers are recorded separately from acceptance',
    scope.truth?.localCentralPepUowCompositionTested === true
      && scope.truth?.localRuntimeAuthorityLeaseTested === true
      && scope.truth?.localEncryptedSealedResultVaultComponentTested === true
      && scope.truth?.localDataStoreFacadeCompositionTested === true
      && scope.truth?.desktopIpcSurfaceComponentTested === true
      && scope.truth?.rendererUiComponentTested === true
      && scope.truth?.productionProviderWiredAndValidated === false
      && scope.truth?.productionIpcEndToEndValidated === false
      && scope.truth?.productionUiEndToEndValidated === false],
  ['current sealed-result authorization retention and orphan reconciliation are validated while broader residuals remain open',
    scope.truth?.localMaliciousDocumentFailClosedMatrixImplemented === true
      && scope.truth?.maliciousFileScannerProviderAvailable === false
      && scope.truth?.productionConcurrentRunCancelProbeExecuted === true
      && scope.truth?.productionConcurrentRunCancelValidated === true
      && scope.truth?.archiveSourceDestroyAndOcrPropagationAtomicityValidated === false
      && scope.truth?.archiveSourceDestroyCrashWindowAutoResumeValidated === true
      && scope.truth?.sourceDeletionAutoResumeGuaranteed === true
      && scope.truth?.permissionOrConsentRevocationOcrPurgeValidated === true
      && scope.truth?.scheduledOrphanSweepProductionWiringValidated === true
      && scope.truth?.retentionExpiryPurgeValidated === true
      && scope.truth?.legacyArchiveOwnershipReattestationAvailable === false],
  ['manual external and certification evidence remains fail-closed',
    manualEvidenceNotRun && scope.manualEvidence?.certificationClaimed === false
      && scope.truth?.rawDocumentEgressPerformed === false
      && scope.truth?.externalOcrProviderConfigured === false
      && scope.truth?.externalProviderAvailabilityVerified === false
      && scope.truth?.physicalSecureEraseGuaranteed === false
      && scope.truth?.externalCopyDestructionGuaranteed === false],
  ['decision and threat model preserve partial and no-claim markers',
    decision.includes('15 dosya / 128 test PASS')
      && decision.includes('PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED / ACCEPTANCE_INCOMPLETE')
      && decision.includes('- Requirement PASS: `false`')
      && decision.includes('- Persistent receipt: `NOT_RUN`')
      && decision.includes('requirement `PASS`')
      && threat.includes('15 dosya / 128 test PASS')
      && threat.includes('iki fazlı run/cancel local kanıtı `PASS`')
      && threat.includes('authenticated restart auto-resume')]
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
  governancePhase: 'LOCAL_IMPLEMENTATION_STARTED',
  implementationStatus: 'PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED_ACCEPTANCE_INCOMPLETE',
  countsAsRequirementPass: false,
  requirementGateStatus: 'BLOCKED_BY_33_P_AND_OPEN_TECHNICAL_EXTERNAL_MANUAL_EVIDENCE',
  activePredecessor: '33-P',
  targetedTestRatchet: { files: 15, tests: 128 },
  migration94Sha256,
  ppkGateEvidence: ppk,
  checksPassed: checks.length - failures.length,
  checksFailed: failures.length,
  checks,
  generatedAt: new Date().toISOString()
};

if (!noWrite) {
  await mkdir(dirname(resolve(root, output)), { recursive: true });
  await writeFile(resolve(root, output), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
console.log(`33-Q boundary starter: ${report.status} (${report.checksPassed}/${checks.length}; partial composed; requirement PASS=false; write=${!noWrite}).`);
if (failures.length) {
  console.error(`Failed checks: ${failures.map((item) => item.name).join(' | ')}`);
  process.exitCode = 1;
}
