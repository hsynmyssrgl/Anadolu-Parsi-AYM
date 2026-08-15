import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const allowedArguments = new Set(['--external', '--allow-plan-pending']);
if (process.argv.slice(2).some((argument) => !allowedArguments.has(argument))) {
  throw new Error('Unsupported 33-J completion verifier argument');
}
const external = process.argv.includes('--external');
const allowPlanPending = process.argv.includes('--allow-plan-pending');
const requirements = Object.freeze(['B5-03', 'EXT-016']);
const decision = 'DEC-221';
const expectedEvidence = Object.freeze({
  boundaryChecksPassed: 62,
  contractChecksPassed: 16,
  runtimeChecksPassed: 12,
  targetedTestFilesPassed: 4,
  targetedTestsPassed: 24,
  fullVitestTestFilesPassed: 125,
  fullVitestTestsPassed: 1038,
  productionWorkspaceBuildsPassed: 18,
  ppk021ExactAllowlistEntries: 554,
  ppk021UseCaseCompositionSurfaces: 281,
  ppk022CapabilitySurfaces: 246,
  latestDatabaseMigration: 88,
  requirementChainsComplete: 2
});
const expectedMigrationChecksum = '8785551a6ce0facd609e374e7ba65c70d35b552e6f63a7f0b3d790bfbffa2b04';
const canonicalLibraryRoot = 'D:\\AYM_LIBRARY\\Panthera pardus tulliana\\Anadolu Pars\u0131 Aile Ya\u015fam Merkezi\\Bronze 04.08.2026.29\\checkpoints\\33-J_Family_Emergency_Card_Portability';
const canonicalLocalCheckpointRoot = 'C:\\PPT\\AYM\\09_ARSIV\\KAYNAK_AGACI\\checkpoints\\33-J_Family_Emergency_Card_Portability';
const truth = 'Bu makbuz yalnız 33-J B5-03 ve EXT-016 kapsamındaki kullanıcı yetkili, yerel ve çevrimdışı acil durum kartı yazdırma/PDF, uygulamaya özgü şifreli belge paketi ve yalnız manuel pil tasarrufu kipini kapatır; klinik doğrulama, sağlık sicili sorgusu, mesaj, acil servis, bulut veya harici teslimat, otomatik düşük pil algılama, ölçülmüş pil yüzdesi, parola şifreli PDF ya da ağ çıkışı iddiası değildir.';
const evidenceTriplet = Object.freeze([
  'artifacts/validation/33-J-family-emergency-card-portability-boundary.json',
  'artifacts/validation/33-J-family-emergency-card-portability-contract.json',
  'artifacts/validation/33-J-family-emergency-card-portability-runtime.json'
]);
const paths = Object.freeze({
  receipt: 'artifacts/checkpoints/33-J_LIBRARY_RECEIPT.json',
  readback: 'artifacts/validation/33-J_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/33-J_RECEIPT_READBACK_VERIFICATION.json',
  persistence: 'artifacts/validation/33-J_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  inventory: 'artifacts/validation/33-J_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  closureInventory: 'artifacts/validation/33-J_LIBRARY_CLOSURE_INVENTORY_VERIFICATION.json',
  completion: 'artifacts/checkpoints/33-J_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/33-J_COMPLETION_TRANSITION_VALIDATION.json',
  boundary: evidenceTriplet[0],
  contract: evidenceTriplet[1],
  runtime: evidenceTriplet[2],
  migrationManifest: 'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  predecessorReceipt: 'artifacts/checkpoints/33-I_LIBRARY_RECEIPT.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  scope: 'config/33-j-family-emergency-card-portability-scope.json'
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
  && value.medicalVerification === 'not_performed'
  && value.healthRegistryLookup === 'not_performed'
  && value.messageDelivery === 'not_performed'
  && value.emergencyServiceContact === 'not_performed'
  && value.cloudUpload === 'not_performed'
  && value.externalDelivery === 'not_performed'
  && value.localExport === 'user_authorized_only'
  && value.portablePackEncryption === 'application_specific_container'
  && value.pdfEncryption === 'not_claimed'
  && value.networkEgressAdded === false;
const exactProofTruth = (value) => exactTruth(value)
  && value.powerMode === 'manual_only'
  && value.batteryLevel === 'not_measured'
  && value.automaticLowBatteryDetection === 'not_performed'
  && value.lowBatteryClaimed === false;
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

const step = docs.plan.steps.find((item) => item.id === '33-J');
const successor = docs.plan.steps.find((item) => item.id === '33-K');
const laterLifecycle = inspectAuthorizedSuccessorLifecycle({
  plan: docs.plan,
  ledger: docs.ledger,
  predecessorId: '33-J'
});
check(docs.receipt.status === 'PASS' && docs.receipt.persistentReceiptStatus === 'PASS', 'receipt is PASS');
check(
  docs.receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE'
    && docs.receipt.libraryPath === canonicalLibraryRoot
    && docs.completion.libraryPath === canonicalLibraryRoot
    && docs.receipt.localCheckpointPath === canonicalLocalCheckpointRoot
    && docs.completion.localCheckpointPath === canonicalLocalCheckpointRoot,
  'receipt and completion bind the canonical 33-J D: and local archive paths'
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
    || (allowPlanPending && docs.plan.currentStep === '33-J' && step?.status === 'IN_PROGRESS'
      && step.validationStatus === 'PENDING' && step.persistentReceiptStatus === 'PENDING'
      && step.completionTransitionStatus === 'PENDING'),
  'work plan preserves 33-J completion or the exact ledger-sealed recovery state'
);
check(successor?.status === 'PENDING' || successor?.status === 'IN_PROGRESS'
  || successor?.status === 'COMPLETED', '33-K successor is governed');
check(
  (docs.plan.currentStep === '33-J'
    && docs.ledger.libraryUploadStatus === '33-J_COMPLETED_RECEIPT_PASS'
    && docs.ledger.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_33-J_PERSISTENT_RECEIPT'
    && docs.ledger.activeMicroStep === null)
    || (laterLifecycle.planValid && laterLifecycle.ledgerValid && laterLifecycle.nextTaskValid),
  'ledger preserves 33-J completion through the governed 33-J-or-later lifecycle'
);
check(
  docs.ledger.externalLibraryAuthority33J?.step === '33-J'
    && docs.ledger.externalLibraryAuthority33J?.status === 'PASS'
    && docs.ledger.externalLibraryAuthority33J?.storageBackend === 'EXTERNAL_USB_D_DRIVE'
    && docs.ledger.externalLibraryAuthority33J?.path === canonicalLibraryRoot
    && docs.ledger.externalLibraryAuthority33J?.localCheckpointPath === canonicalLocalCheckpointRoot
    && docs.ledger.externalLibraryAuthority33J?.receipt === paths.receipt
    && docs.ledger.externalLibraryAuthority33J?.focusedCheckpointOnly === true,
  'ledger retains exact 33-J external library authority'
);
check(docs.scope.status === 'COMPLETE' && docs.scope.decision === decision
  && exactArray(docs.scope.requirements, requirements)
  && docs.scope.validation?.boundary === paths.boundary
  && docs.scope.validation?.contract === paths.contract
  && docs.scope.validation?.runtime === paths.runtime,
'scope binds exact DEC-221 requirement and evidence package');
check(exactTruth(docs.scope.truth), 'scope preserves exact manual offline no-external-service truth');
check(proofKeys.every((key) => exactProofTruth(docs[key])),
  'all proof documents preserve exact local export, manual power, and no external-service truth');
check(
  finalEvidence?.finalClosureEvidence === true
    && Object.values(expectedValidation ?? {}).every((value) => Number.isInteger(value) && value >= 0)
    && Object.entries(expectedEvidence).every(([key, value]) => expectedValidation?.[key] === value)
    && expectedValidation.fullVitestTestFilesPassed > 0
    && expectedValidation.fullVitestTestsPassed > 0
    && expectedValidation.productionWorkspaceBuildsPassed > 0
    && docs.migrationManifest?.status === 'passed'
    && docs.migrationManifest?.migrationVersions?.find((item) => item.version === 88)?.name
      === 'b5_family_emergency_card_portability_ledger'
    && docs.migrationManifest?.migrationVersions?.find((item) => item.version === 88)?.checksum
      === expectedMigrationChecksum,
  'scope binds exact 62/16/12, 4/24, full 125/1038, builds 18/18, PPK 554/281/246, migration 88 and dynamic full/build evidence'
);
check(
  docs.boundary.status === 'PASS' && docs.boundary.checksFailed === 0
    && docs.boundary.checksPassed === expectedValidation?.boundaryChecksPassed
    && docs.contract.status === 'PASS' && docs.contract.checksFailed === 0
    && docs.contract.checksPassed === expectedValidation?.contractChecksPassed
    && docs.contract.migration88Checksum === expectedMigrationChecksum
    && docs.runtime.status === 'PASS' && docs.runtime.checksFailed === 0
    && docs.runtime.checksPassed === expectedValidation?.runtimeChecksPassed
    && docs.runtime.targetedTestFilesPassed === expectedValidation?.targetedTestFilesPassed
    && docs.runtime.targetedTestsPassed === expectedValidation?.targetedTestsPassed
    && docs.boundary.ppk021ExactAllowlistEntries === docs.contract.ppk021ExactAllowlistEntries
    && docs.contract.ppk021ExactAllowlistEntries === docs.runtime.ppk021ExactAllowlistEntries
    && docs.boundary.ppk021UseCaseCompositionSurfaces === docs.contract.ppk021UseCaseCompositionSurfaces
    && docs.contract.ppk021UseCaseCompositionSurfaces === docs.runtime.ppk021UseCaseCompositionSurfaces
    && docs.boundary.ppk022CapabilitySurfaces === docs.contract.ppk022CapabilitySurfaces
    && docs.contract.ppk022CapabilitySurfaces === docs.runtime.ppk022CapabilitySurfaces
    && docs.boundary.latestDatabaseMigration === docs.contract.latestDatabaseMigration
    && docs.contract.latestDatabaseMigration === docs.runtime.latestDatabaseMigration
    && docs.runtime.latestDatabaseMigration >= expectedValidation?.latestDatabaseMigration,
  'current successor artifacts remain green and mutually exact without rewriting the historical final vector'
);
check(proofKeys.every((key) =>
  JSON.stringify(docs[key].validation) === JSON.stringify(expectedValidation)),
'all proof documents retain the exact final evidence vector');
check(
  exactArray(docs.receipt.requirements, requirements)
    && exactArray(docs.completion.requirements, requirements)
    && exactArray(docs.transition.requirements, requirements),
  'proof documents bind exact B5-03/EXT-016 requirements'
);
check([docs.receipt, docs.completion, docs.transition].every((item) => item.decision === decision),
  'proof documents bind DEC-221');
const registryRequirements = requirements.map((id) =>
  docs.registry.requirements.find((item) => item.id === id));
check(registryRequirements.every((item) => item?.status === 'COMPLETE'
  && Object.keys(item.chain ?? {}).length === 13
  && Object.values(item.chain).every((value) => value === true)
  && evidenceTriplet.every((path) => item.evidence?.includes(path))),
'registry retains two exact COMPLETE 13-link chains and evidence triplets');
check(docs.receipt.sourceCommit === docs.completion.sourceCommit
  && /^[0-9a-f]{40}$/u.test(docs.receipt.sourceCommit), 'source commit binding is exact');
const predecessorReceiptBytes = await readFile(resolve(root, paths.predecessorReceipt));
const predecessorReceiptSidecar = await readFile(
  resolve(root, `${paths.predecessorReceipt}.sha256`), 'utf8'
);
const predecessorAncestry = spawnSync('git', [
  '-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', 'merge-base', '--is-ancestor',
  docs.predecessorReceipt.sourceCommit, docs.receipt.sourceCommit
], { cwd: root, encoding: 'utf8', windowsHide: true });
check(
  docs.predecessorReceipt.step === '33-I'
    && docs.predecessorReceipt.status === 'PASS'
    && docs.predecessorReceipt.persistentReceiptStatus === 'PASS'
    && /^[0-9a-f]{40}$/u.test(docs.predecessorReceipt.sourceCommit)
    && predecessorReceiptSidecar
      === `${sha256(predecessorReceiptBytes)}  ${paths.predecessorReceipt.split('/').at(-1)}\n`
    && predecessorAncestry.status === 0,
  '33-I receipt and sidecar bind an ancestor sourceCommit base'
);
check(proofKeys.every((key) => docs[key].predecessorStep === '33-I'
  && docs[key].predecessorReceiptPath === paths.predecessorReceipt
  && docs[key].predecessorSourceCommit === docs.predecessorReceipt.sourceCommit
  && docs[key].sourceCommitRange
    === `${docs.predecessorReceipt.sourceCommit}..${docs.receipt.sourceCommit}`
  && docs[key].migration88Checksum === expectedMigrationChecksum),
'all proof documents bind the 33-I base range and migration 88 checksum');
check(docs.receipt.nextOfficialStep === '33-K' && docs.completion.nextOfficialStep === '33-K',
  'proof documents bind the governed 33-K successor');
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
  'all 33-J proof documents bind one source commit'
);
check(
  [...proofKeys.map((key) => docs[key])].every((item) => item.mandatoryTruthSentence === truth),
  'all 33-J proof documents retain the exact mandatory truth sentence'
);

const manifestName = '33-J_CHECKPOINT_MANIFEST.json';
let manifest;
try {
  const manifestBytes = await readFile(resolve(canonicalLocalCheckpointRoot, manifestName));
  manifest = JSON.parse(manifestBytes.toString('utf8'));
  const sidecar = await readFile(resolve(canonicalLocalCheckpointRoot, `${manifestName}.sha256`), 'utf8');
  check(sidecar === `${sha256(manifestBytes)}  ${manifestName}\n`,
    'checkpoint manifest sidecar binds exact bytes');
  check(manifest.sourceCommit === docs.receipt.sourceCommit
    && manifest.predecessorStep === '33-I'
    && manifest.predecessorReceiptPath === paths.predecessorReceipt
    && manifest.predecessorSourceCommit === docs.predecessorReceipt.sourceCommit
    && manifest.sourceCommitRange
      === `${docs.predecessorReceipt.sourceCommit}..${docs.receipt.sourceCommit}`
    && manifest.migration88Checksum === expectedMigrationChecksum
    && manifest.decision === decision
    && exactArray(manifest.requirements, requirements)
    && manifest.payloadMode === 'EXACT_COMPLETE_TRACKED_SOURCE_SNAPSHOT_AT_HEAD_PLUS_REQUIRED_UNTRACKED_EVIDENCE'
    && manifest.mandatoryTruthSentence === truth,
  'manifest binds 33-I base, 33-J source, migration, DEC-221, requirements, payload mode, and truth');
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
    'config/33-j-family-emergency-card-portability-scope.json',
    'config/33-j-family-emergency-card-portability-inventory.json',
    'docs/decisions/DEC-221-family-emergency-card-portability.md',
    'docs/security/THREAT_MODEL_33_J_FAMILY_EMERGENCY_CARD_PORTABILITY.md',
    'docs/audit/33-J_FAMILY_EMERGENCY_CARD_PORTABILITY_UST_KAPANIS.md',
    ...evidenceTriplet,
    paths.predecessorReceipt,
    `${paths.predecessorReceipt}.sha256`,
    'packages/domain/src/app-data.ts',
    'packages/application/src/life-use-cases.ts',
    'packages/security/src/encryption.ts',
    'packages/repositories/src/life-repository.ts',
    'packages/database/src/family-database-migrations.ts',
    'apps/desktop/src/main/archive-vault-file-application-adapter.ts',
    'apps/desktop/src/main/life-application-adapter.ts',
    'apps/desktop/src/main/main.ts',
    'apps/desktop/src/renderer/ManagedLifePanel.tsx',
    'packages/application/tests/family-emergency-card-portability.test.ts',
    'packages/repositories/family-emergency-card-portability-repository-policy.test.ts',
    'packages/security/tests/emergency-portable-pack.test.ts',
    'apps/desktop/tests/b5-family-emergency-card-portability-ipc-integration.test.ts',
    'scripts/finalize-33-j-family-emergency-card-portability-external-receipt.mjs',
    'scripts/verify-33-j-family-emergency-card-portability-completion.mjs'
  ];
  check(requiredRestorePaths.every((path) => sourcePaths.includes(path)),
    'manifest contains the exact 33-J restore-critical source and evidence set');
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
    check(false, `${label}: 33-J checkpoint is readable: ${error instanceof Error ? error.message : String(error)}`);
  }
};

await verifyCheckpoint(canonicalLocalCheckpointRoot, 'Local archive');
if (external) await verifyCheckpoint(canonicalLibraryRoot, 'D: external archive');

const failures = checks.filter((item) => item.status === 'FAIL');
if (failures.length > 0) {
  console.error(`33-J completion verification: FAIL (${failures.length}/${checks.length}).`);
  for (const item of failures) console.error(`- ${item.name}`);
  process.exit(1);
}
console.log(`33-J completion verification: PASS (${checks.length}/${checks.length}; local archive readback included${external ? '; D: external readback included' : ''}).`);
