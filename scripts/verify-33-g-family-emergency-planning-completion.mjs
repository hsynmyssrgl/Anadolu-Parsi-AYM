import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const allowedArguments = new Set(['--external', '--allow-plan-pending']);
if (process.argv.slice(2).some((argument) => !allowedArguments.has(argument))) {
  throw new Error('Unsupported 33-G completion verifier argument');
}
const external = process.argv.includes('--external');
const allowPlanPending = process.argv.includes('--allow-plan-pending');
const requirements = Object.freeze(['B5-07', 'EXT-009', 'EXT-010', 'EXT-013']);
const decision = 'DEC-218';
const canonicalLibraryRoot = 'D:\\AYM_LIBRARY\\Panthera pardus tulliana\\Anadolu Parsı Aile Yaşam Merkezi\\Bronze 04.08.2026.29\\checkpoints\\33-G_Family_Emergency_Planning';
const canonicalLocalCheckpointRoot = 'C:\\PPT\\AYM\\09_ARSIV\\KAYNAK_AGACI\\checkpoints\\33-G_Family_Emergency_Planning';
const truth = 'Bu makbuz yalnız 33-G B5-07, EXT-009, EXT-010 ve EXT-013 kapsamındaki manuel, çevrimdışı aile acil durum planı, buluşma noktası, şehir dışı irtibat, kontrol listesi ve aile üyesi safe/needs_help durum geçmişini kapatır; harita veya canlı konum sorgusu, mesaj teslimi, acil servis teması veya müdahale garantisi ve ağ çıkışı iddiası değildir.';
const evidenceTriplet = Object.freeze([
  'artifacts/validation/33-G-family-emergency-planning-boundary.json',
  'artifacts/validation/33-G-family-emergency-planning-contract.json',
  'artifacts/validation/33-G-family-emergency-planning-runtime.json'
]);
const paths = Object.freeze({
  receipt: 'artifacts/checkpoints/33-G_LIBRARY_RECEIPT.json',
  readback: 'artifacts/validation/33-G_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/33-G_RECEIPT_READBACK_VERIFICATION.json',
  persistence: 'artifacts/validation/33-G_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  inventory: 'artifacts/validation/33-G_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  closureInventory: 'artifacts/validation/33-G_LIBRARY_CLOSURE_INVENTORY_VERIFICATION.json',
  completion: 'artifacts/checkpoints/33-G_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/33-G_COMPLETION_TRANSITION_VALIDATION.json',
  boundary: evidenceTriplet[0],
  contract: evidenceTriplet[1],
  runtime: evidenceTriplet[2],
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  scope: 'config/33-g-family-emergency-planning-scope.json'
});
const proofKeys = Object.freeze([
  'receipt', 'readback', 'receiptReadback', 'persistence',
  'inventory', 'completion', 'transition', 'closureInventory'
]);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const docs = Object.fromEntries(await Promise.all(
  Object.entries(paths).map(async ([key, path]) => [key, await readJson(path)])
));
const checks = [];
const check = (passed, name) => checks.push({ name, status: passed ? 'PASS' : 'FAIL' });
const exactArray = (actual, expected) => Array.isArray(actual)
  && JSON.stringify(actual) === JSON.stringify(expected);
const exactTruth = (value) => value?.dataSource === 'manual'
  && value.offlineAvailability === 'local_only'
  && value.mapLookup === 'not_performed'
  && value.liveLocation === 'not_performed'
  && value.messageDelivery === 'not_performed'
  && value.emergencyServiceContact === 'not_performed'
  && value.emergencyServiceGuarantee === 'not_claimed'
  && value.networkEgressAdded === false;
const finalEvidence = docs.scope.validation?.finalEvidence;
const expectedValidation = finalEvidence ? Object.freeze({
  boundaryChecksPassed: finalEvidence.boundaryChecksPassed,
  contractChecksPassed: finalEvidence.contractChecksPassed,
  runtimeChecksPassed: finalEvidence.runtimeChecksPassed,
  targetedTestFilesPassed: finalEvidence.targetedTestFilesPassed,
  targetedTestsPassed: finalEvidence.targetedTestsPassed,
  fullVitestTestFilesPassed: finalEvidence.fullVitestTestFilesPassed,
  fullVitestTestsPassed: finalEvidence.fullVitestTestsPassed,
  productionWorkspaceBuildsPassed: finalEvidence.productionWorkspaceBuildsPassed,
  ppk021ExactAllowlistEntries: finalEvidence.ppk021ExactAllowlistEntries,
  ppk021UseCaseCompositionSurfaces: finalEvidence.ppk021UseCaseCompositionSurfaces,
  ppk022CapabilitySurfaces: finalEvidence.ppk022CapabilitySurfaces,
  latestDatabaseMigration: finalEvidence.latestDatabaseMigration,
  requirementChainsComplete: finalEvidence.requirementChainsComplete
}) : null;

for (const key of proofKeys) {
  const bytes = await readFile(resolve(root, paths[key]));
  const sidecarText = await readFile(resolve(root, `${paths[key]}.sha256`), 'utf8');
  const sidecarMatch = sidecarText.match(/^([0-9a-f]{64})  ([^\r\n]+)\r?\n?$/u);
  check(
    sidecarMatch?.[1] === sha256(bytes) && sidecarMatch?.[2] === paths[key].split('/').at(-1),
    `${key} sidecar binds exact local bytes and basename`
  );
}

const step = docs.plan.steps.find((item) => item.id === '33-G');
const successor = docs.plan.steps.find((item) => item.id === '33-H');
const laterLifecycle = inspectAuthorizedSuccessorLifecycle({
  plan: docs.plan,
  ledger: docs.ledger,
  predecessorId: '33-G'
});
check(docs.receipt.status === 'PASS' && docs.receipt.persistentReceiptStatus === 'PASS', 'receipt is PASS');
check(
  docs.receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE'
    && docs.receipt.libraryPath === canonicalLibraryRoot
    && docs.completion.libraryPath === canonicalLibraryRoot
    && docs.receipt.localCheckpointPath === canonicalLocalCheckpointRoot
    && docs.completion.localCheckpointPath === canonicalLocalCheckpointRoot,
  'receipt and completion bind the canonical 33-G D: and local archive paths'
);
check(docs.readback.status === 'PASS' && docs.readback.failed === 0
  && docs.readback.expected === docs.readback.matched, 'base readback is exact PASS');
check(docs.receiptReadback.status === 'PASS' && docs.receiptReadback.failed === 0,
  'receipt readback is PASS');
check(docs.persistence.status === 'PASS' && docs.persistence.failed === 0,
  'receipt persistence is PASS');
check(docs.inventory.status === 'PASS' && docs.inventory.finalExpectedFilesIncludingInventoryPair > 0,
  'final inventory is PASS');
check(docs.closureInventory.status === 'PASS'
  && docs.closureInventory.finalExpectedFilesIncludingInventoryPair
    > docs.inventory.finalExpectedFilesIncludingInventoryPair, 'closure inventory is PASS');
check(docs.completion.status === 'PASS' && docs.completion.officialStepStatus === 'COMPLETED',
  'completion record is PASS');
check(docs.transition.status === 'PASS' && docs.transition.failed === 0,
  'completion transition is PASS');
check(
  (step?.status === 'COMPLETED' && step.validationStatus === 'PASS'
    && step.persistentReceiptStatus === 'PASS' && step.completionTransitionStatus === 'PASS')
    || (allowPlanPending && docs.plan.currentStep === '33-G' && step?.status === 'IN_PROGRESS'
      && step.validationStatus === 'PENDING' && step.persistentReceiptStatus === 'PENDING'
      && step.completionTransitionStatus === 'PENDING'),
  'work plan preserves 33-G completion or the exact ledger-sealed recovery state'
);
check(successor?.status === 'PENDING' || successor?.status === 'IN_PROGRESS'
  || successor?.status === 'COMPLETED', '33-H successor is governed');
check(
  (docs.plan.currentStep === '33-G'
    && docs.ledger.libraryUploadStatus === '33-G_COMPLETED_RECEIPT_PASS'
    && docs.ledger.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_33-G_PERSISTENT_RECEIPT'
    && docs.ledger.activeMicroStep === null)
    || (laterLifecycle.planValid && laterLifecycle.ledgerValid && laterLifecycle.nextTaskValid),
  'ledger preserves 33-G completion through the governed 33-H-or-later lifecycle'
);
check(
  docs.ledger.externalLibraryAuthority33G?.step === '33-G'
    && docs.ledger.externalLibraryAuthority33G?.status === 'PASS'
    && docs.ledger.externalLibraryAuthority33G?.storageBackend === 'EXTERNAL_USB_D_DRIVE'
    && docs.ledger.externalLibraryAuthority33G?.path === canonicalLibraryRoot
    && docs.ledger.externalLibraryAuthority33G?.localCheckpointPath === canonicalLocalCheckpointRoot
    && docs.ledger.externalLibraryAuthority33G?.receipt === paths.receipt
    && docs.ledger.externalLibraryAuthority33G?.focusedCheckpointOnly === true,
  'ledger retains exact 33-G external library authority'
);
check(docs.scope.status === 'COMPLETE' && docs.scope.decision === decision
  && exactArray(docs.scope.requirements, requirements)
  && docs.scope.validation?.boundary === paths.boundary
  && docs.scope.validation?.contract === paths.contract
  && docs.scope.validation?.runtime === paths.runtime,
'scope binds exact DEC-218 requirement and evidence package');
check(exactTruth(docs.scope.truth), 'scope preserves exact manual offline no-contact truth');
check(proofKeys.every((key) => exactTruth(docs[key])),
  'all proof documents make no map, location, delivery, emergency-service, guarantee, or network claim');
check(
  finalEvidence?.finalClosureEvidence === true
    && Object.values(expectedValidation ?? {}).every((value) => Number.isInteger(value) && value >= 0)
    && expectedValidation?.boundaryChecksPassed > 0
    && expectedValidation.contractChecksPassed > 0
    && expectedValidation.runtimeChecksPassed > 0
    && expectedValidation.targetedTestFilesPassed > 0
    && expectedValidation.targetedTestsPassed > 0
    && expectedValidation.fullVitestTestFilesPassed > 0
    && expectedValidation.fullVitestTestsPassed > 0
    && expectedValidation.productionWorkspaceBuildsPassed > 0
    && expectedValidation.requirementChainsComplete === requirements.length,
  'scope binds a positive exact final closure evidence vector'
);
check(
  docs.boundary.status === 'PASS' && docs.boundary.checksFailed === 0
    && docs.boundary.checksPassed === expectedValidation?.boundaryChecksPassed
    && docs.contract.status === 'PASS' && docs.contract.checksFailed === 0
    && docs.contract.checksPassed === expectedValidation?.contractChecksPassed
    && docs.runtime.status === 'PASS' && docs.runtime.checksFailed === 0
    && docs.runtime.checksPassed === expectedValidation?.runtimeChecksPassed
    && docs.runtime.targetedTestFilesPassed === expectedValidation?.targetedTestFilesPassed
    && docs.runtime.targetedTestsPassed === expectedValidation?.targetedTestsPassed
    && docs.boundary.ppk021ExactAllowlistEntries >= expectedValidation?.ppk021ExactAllowlistEntries
    && docs.boundary.ppk021UseCaseCompositionSurfaces >= expectedValidation?.ppk021UseCaseCompositionSurfaces
    && docs.boundary.ppk022CapabilitySurfaces >= expectedValidation?.ppk022CapabilitySurfaces
    && docs.contract.ppk021ExactAllowlistEntries === docs.boundary.ppk021ExactAllowlistEntries
    && docs.contract.ppk021UseCaseCompositionSurfaces === docs.boundary.ppk021UseCaseCompositionSurfaces
    && docs.contract.ppk022CapabilitySurfaces === docs.boundary.ppk022CapabilitySurfaces
    && docs.runtime.ppk021ExactAllowlistEntries === docs.boundary.ppk021ExactAllowlistEntries
    && docs.runtime.ppk021UseCaseCompositionSurfaces === docs.boundary.ppk021UseCaseCompositionSurfaces
    && docs.runtime.ppk022CapabilitySurfaces === docs.boundary.ppk022CapabilitySurfaces
    && docs.runtime.latestDatabaseMigration === docs.boundary.latestDatabaseMigration
    && docs.runtime.latestDatabaseMigration >= expectedValidation?.latestDatabaseMigration
    && docs.runtime.closureDatabaseMigration === expectedValidation?.latestDatabaseMigration,
  'boundary, contract, runtime, and targeted evidence bind the declared final vector'
);
check(proofKeys.every((key) =>
  JSON.stringify(docs[key].validation) === JSON.stringify(expectedValidation)),
'all proof documents retain the exact final evidence vector');
check(
  exactArray(docs.receipt.requirements, requirements)
    && exactArray(docs.completion.requirements, requirements)
    && exactArray(docs.transition.requirements, requirements),
  'proof documents bind exact B5-07/EXT-009/EXT-010/EXT-013 requirements'
);
check([docs.receipt, docs.completion, docs.transition].every((item) => item.decision === decision),
  'proof documents bind DEC-218');
const registryRequirements = requirements.map((id) =>
  docs.registry.requirements.find((item) => item.id === id));
check(registryRequirements.every((item) => item?.status === 'COMPLETE'
  && Object.keys(item.chain ?? {}).length === 13
  && Object.values(item.chain).every((value) => value === true)
  && evidenceTriplet.every((path) => item.evidence?.includes(path))),
'registry retains four exact COMPLETE 13-link chains and evidence triplets');
check(docs.receipt.sourceCommit === docs.completion.sourceCommit
  && /^[0-9a-f]{40}$/u.test(docs.receipt.sourceCommit), 'source commit binding is exact');
check(docs.receipt.nextOfficialStep === '33-H' && docs.completion.nextOfficialStep === '33-H',
  'proof documents bind the governed 33-H successor');
check(docs.receipt.officialCompletionClaimed === true
  && docs.receipt.requirementCompletionClaimed === true
  && docs.completion.officialCompletionClaimed === true
  && docs.completion.requirementCompletionClaimed === true,
  'receipt and completion truthfully claim completed requirements');
check([docs.receipt, docs.completion, docs.transition].every((item) => item.newBuildIssued === false),
  'no new build is claimed');
check(
  [docs.receipt, docs.completion, docs.transition].every((item) =>
    item.currentAuthoritativeSourceExternalProtectionStatus
      === 'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE'),
  'separate source protection refresh remains explicit'
);
check(
  [...proofKeys.map((key) => docs[key])].every((item) => item.sourceCommit === docs.receipt.sourceCommit),
  'all 33-G proof documents bind one source commit'
);
check(
  [...proofKeys.map((key) => docs[key])].every((item) => item.mandatoryTruthSentence === truth),
  'all 33-G proof documents retain the exact mandatory truth sentence'
);

const manifestName = '33-G_CHECKPOINT_MANIFEST.json';
let manifest;
try {
  const manifestBytes = await readFile(resolve(canonicalLocalCheckpointRoot, manifestName));
  manifest = JSON.parse(manifestBytes.toString('utf8'));
  const sidecar = await readFile(resolve(canonicalLocalCheckpointRoot, `${manifestName}.sha256`), 'utf8');
  check(sidecar === `${sha256(manifestBytes)}  ${manifestName}\n`,
    'checkpoint manifest sidecar binds exact bytes');
  check(manifest.sourceCommit === docs.receipt.sourceCommit
    && manifest.decision === decision
    && exactArray(manifest.requirements, requirements)
    && manifest.payloadMode === 'EXACT_COMPLETE_TRACKED_SOURCE_SNAPSHOT_AT_HEAD_PLUS_REQUIRED_UNTRACKED_EVIDENCE'
    && manifest.mandatoryTruthSentence === truth,
  'manifest binds source commit, DEC-218, requirements, payload mode, and truth');
  check(JSON.stringify(manifest.validation) === JSON.stringify(expectedValidation),
    'manifest binds the exact final evidence vector');
  check(manifest.payloadCount === manifest.payload?.length
    && manifest.trackedSourceFileCount > 0
    && manifest.supplementalEvidenceFileCount
      === manifest.payloadCount - manifest.trackedSourceFileCount,
  'manifest payload counts are internally exact');
  const sourcePaths = manifest.payload.map((item) => item.sourcePath);
  const packagePaths = manifest.payload.map((item) => item.packagePath);
  check(new Set(sourcePaths).size === sourcePaths.length
    && new Set(packagePaths).size === packagePaths.length
    && manifest.payload.every((item) => item.packagePath === `payload/${item.sourcePath}`),
  'manifest payload paths are unique exact source-relative restore paths');
  const tree = spawnSync('git', [
    '-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', 'ls-tree', '-r', manifest.sourceCommit
  ], { cwd: root, encoding: 'utf8', windowsHide: true });
  const trackedEntries = tree.status === 0
    ? tree.stdout.trim().split(/\r?\n/u).filter(Boolean).map((line) => {
      const match = line.match(/^(\d{6}) blob ([0-9a-f]+)\t(.+)$/u);
      return match ? { gitMode: match[1], gitObjectId: match[2], sourcePath: match[3] } : null;
    })
    : [];
  const trackedEntryByPath = new Map(trackedEntries
    .filter((item) => item !== null)
    .map((item) => [item.sourcePath, item]));
  const trackedPaths = [...trackedEntryByPath.keys()].sort();
  check(tree.status === 0
    && trackedEntries.every((item) => item !== null
      && (item.gitMode === '100644' || item.gitMode === '100755'))
    && trackedPaths.length === manifest.trackedSourceFileCount
    && trackedPaths.every((path) => sourcePaths.includes(path)),
  'manifest covers the exact tracked source tree at its bound commit');
  check(manifest.trackedEntryPolicy === 'REGULAR_BLOBS_ONLY_100644_OR_100755'
    && manifest.payload.every((item) => {
      const tracked = trackedEntryByPath.get(item.sourcePath);
      return tracked
        ? item.sourceClassification === 'TRACKED_HEAD'
          && item.gitMode === tracked.gitMode
          && item.gitObjectId === tracked.gitObjectId
        : item.sourceClassification === 'SUPPLEMENTAL_REQUIRED_EVIDENCE'
          && item.gitMode === undefined
          && item.gitObjectId === undefined;
    }),
  'manifest binds every tracked path to its exact Git mode/object and classifies supplemental evidence');
  const payloadBindings = await Promise.all(manifest.payload.map(async (item) => {
    const bytes = await readFile(resolve(canonicalLocalCheckpointRoot, item.packagePath));
    return bytes.length === item.sizeBytes && sha256(bytes) === item.sha256;
  }));
  check(payloadBindings.every(Boolean), 'local manifest payload SHA-256 and size bindings pass');
  const requiredRestorePaths = [
    'config/33-g-family-emergency-planning-scope.json',
    'config/33-g-family-emergency-planning-inventory.json',
    'docs/decisions/DEC-218-family-emergency-planning.md',
    ...evidenceTriplet,
    'packages/domain/src/app-data.ts',
    'packages/application/src/life-use-cases.ts',
    'packages/repositories/src/life-repository.ts',
    'packages/database/src/family-database-migrations.ts',
    'apps/desktop/src/renderer/ManagedLifePanel.tsx',
    'scripts/finalize-33-g-family-emergency-planning-external-receipt.mjs',
    'scripts/verify-33-g-family-emergency-planning-completion.mjs'
  ];
  check(requiredRestorePaths.every((path) => sourcePaths.includes(path)),
    'manifest contains the exact 33-G restore-critical source and evidence set');
} catch (error) {
  check(false, `local checkpoint manifest is readable and exact: ${error instanceof Error ? error.message : String(error)}`);
}

const verifyCheckpoint = async (checkpointRoot, label) => {
  const files = [];
  const visit = async (directory, prefix = '') => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Symbolic link forbidden: ${path}`);
      if (entry.isDirectory()) await visit(join(directory, entry.name), path);
      else if (entry.isFile()) files.push(path);
      else throw new Error(`Special filesystem entry forbidden: ${path}`);
    }
  };
  try {
    await visit(checkpointRoot);
    const expectedNames = [
      ...docs.closureInventory.filesBeforeInventory.map((item) => item.path),
      paths.closureInventory,
      `${paths.closureInventory}.sha256`
    ].sort();
    check(JSON.stringify(files.sort()) === JSON.stringify(expectedNames),
      `${label}: exact recursive file set`);
    const bound = await Promise.all(docs.closureInventory.filesBeforeInventory.map(async (item) => {
      const bytes = await readFile(resolve(checkpointRoot, item.path));
      return bytes.length === item.sizeBytes && sha256(bytes) === item.sha256;
    }));
    check(bound.every(Boolean), `${label}: closure inventory SHA-256 and size readback`);
    for (const key of proofKeys) {
      for (const path of [paths[key], `${paths[key]}.sha256`]) {
        const [local, archived] = await Promise.all([
          readFile(resolve(root, path)),
          readFile(resolve(checkpointRoot, path))
        ]);
        check(local.length === archived.length && sha256(local) === sha256(archived),
          `${label}: ${key} pair exact bytes: ${path}`);
      }
    }
  } catch (error) {
    check(false, `${label}: 33-G checkpoint is readable: ${error instanceof Error ? error.message : String(error)}`);
  }
};

await verifyCheckpoint(canonicalLocalCheckpointRoot, 'Local archive');
if (external) await verifyCheckpoint(canonicalLibraryRoot, 'D: external archive');

const failures = checks.filter((item) => item.status === 'FAIL');
if (failures.length > 0) {
  console.error(`33-G completion verification: FAIL (${failures.length}/${checks.length}).`);
  for (const item of failures) console.error(`- ${item.name}`);
  process.exit(1);
}
console.log(`33-G completion verification: PASS (${checks.length}/${checks.length}; local archive readback included${external ? '; D: external readback included' : ''}).`);
