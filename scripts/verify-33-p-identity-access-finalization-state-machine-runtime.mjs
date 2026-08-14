import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS } from './lib/identity-access-external-evidence-intake.mjs';
import {
  IDENTITY_ACCESS_COMPLETION_REQUIREMENTS,
  buildIdentityAccessPreparedState
} from './lib/identity-access-preparation-state-machine.mjs';
import {
  IDENTITY_ACCESS_FINALIZATION_CHANGE_PATHS,
  IDENTITY_ACCESS_PREPARATION_CHANGE_PATHS,
  buildIdentityAccessFinalState,
  evaluateIdentityAccessReceiptFinalization
} from './lib/identity-access-finalization-state-machine.mjs';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
if (process.argv.slice(2).some((argument) => argument !== '--no-write')) {
  throw new Error('Unsupported 33-P finalization runtime argument');
}
const noWrite = process.argv.includes('--no-write');
const output = resolve(root, 'artifacts/validation/33-P-identity-access-finalization-state-machine-runtime.json');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const [scope, inventory, acceptedScopeRegistry, roadmap, workPlan, ledger, predecessorReceipt] = await Promise.all([
  readJson('config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-scope.json'),
  readJson('config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-inventory.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/remaining-scope-package-roadmap.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json'),
  readJson('artifacts/checkpoints/33-O_LIBRARY_RECEIPT.json')
]);

const EVIDENCE_HEAD = 'a'.repeat(40);
const EVIDENCE_TREE = 'b'.repeat(40);
const FINALIZER_HEAD = '9'.repeat(40);
const FINALIZER_TREE = '8'.repeat(40);
const KEY = 'c'.repeat(64);
const PREPARED_AT = '2026-08-14T12:00:00.000Z';
const FINALIZED_AT = '2026-08-14T13:00:00.000Z';
const evidenceFiles = IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS.map((id, index) => ({
  id, relativePath: `${id}.json`, sizeBytes: 100 + index,
  sha256: index.toString(16).padStart(64, '0')
}));
const evidenceReport = {
  schemaVersion: 1,
  step: '33-P',
  decision: 'DEC-227',
  status: 'PASS',
  checks: 35,
  passed: 35,
  failed: 0,
  results: [],
  evidenceBinding: {
    sourceCommit: EVIDENCE_HEAD,
    sourceTree: EVIDENCE_TREE,
    hostRefSha256: 'e'.repeat(64),
    signerKeyIdSha256: KEY,
    manifest: { relativePath: 'manifest.json', sizeBytes: 500, sha256: 'f'.repeat(64) },
    files: evidenceFiles,
    evidenceTreeSha256: '1'.repeat(64),
    generatedAt: '2026-08-14T11:00:00.000Z',
    expiresAt: '2026-08-21T11:00:00.000Z'
  },
  closureReadiness: {
    status: 'READY_FOR_GOVERNED_REVIEW',
    requirementPassGranted: false,
    registryMutationPerformed: false,
    persistentReceiptWritten: false
  }
};
const trustedSignerRegistry = {
  schemaVersion: 1,
  id: '33-p-identity-access-external-evidence-trusted-signers',
  step: '33-P',
  decision: 'DEC-227',
  status: 'CONFIGURED',
  signers: [{
    authority: 'independent_33p_evidence_reviewer',
    evidenceIds: IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS,
    signerKeyIdSha256: KEY,
    status: 'ACTIVE',
    validFrom: '2026-08-13T12:00:00.000Z',
    validUntil: '2026-09-13T12:00:00.000Z'
  }],
  configurationTruth: {
    defaultSignerTrusted: false,
    selfSignedEvidenceAccepted: false,
    sourceCommitBindingRequired: true,
    activationRequiresGovernedReview: true
  }
};
const technicalEvidence = {
  sourceCommit: EVIDENCE_HEAD,
  boundary: { status: 'PASS', checksPassed: 21 },
  contract: { status: 'PASS', checksPassed: 17 },
  runtime: { status: 'PASS', checksPassed: 24, targetedTestFilesPassed: 19, targetedTestsPassed: 116 },
  migration93Checksum: '51191e62bcf4baec07e3eab5985ef4210402cdb8b7416064519ceb082322916a',
  ppk021: { status: 'PASS', findings: 0, exactAllowlistEntries: 682 },
  ppk022: { status: 'PASS', findings: 0, exactManifestSurfaces: 339 },
  fullVitest: { testFilesPassed: 170, testsPassed: 1338 },
  builds: { packages: true, coreService: true, desktop: true }
};
const prepared = buildIdentityAccessPreparedState({
  scope, inventory, acceptedScopeRegistry, roadmap, workPlan, ledger, predecessorReceipt,
  trustedSignerRegistry, evidenceReport, technicalEvidence,
  gitBinding: {
    clean: true,
    head: EVIDENCE_HEAD,
    tree: EVIDENCE_TREE,
    predecessorAncestor: true,
    predecessorSourceCommit: predecessorReceipt.sourceCommit
  },
  preparedAt: PREPARED_AT
});
const base = {
  scope: prepared.scope,
  inventory: prepared.inventory,
  acceptedScopeRegistry: prepared.acceptedScopeRegistry,
  roadmap: prepared.roadmap,
  workPlan: prepared.workPlan,
  ledger: prepared.ledger,
  predecessorReceipt,
  trustedSignerRegistry,
  evidenceReport,
  preparationRecord: prepared.preparationRecord,
  gitBinding: {
    clean: true,
    head: FINALIZER_HEAD,
    tree: FINALIZER_TREE,
    evidenceSourceCommit: EVIDENCE_HEAD,
    evidenceSourceAncestor: true,
    predecessorSourceCommit: predecessorReceipt.sourceCommit,
    predecessorAncestor: true,
    remoteHeadsEqual: true,
    changedPathsSinceEvidence: IDENTITY_ACCESS_PREPARATION_CHANGE_PATHS
  },
  finalizedAt: FINALIZED_AT
};
const checks = [];
const check = (id, condition) => checks.push({ id, status: condition ? 'PASS' : 'FAIL' });

const governedPaths = [
  'config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-scope.json',
  'config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-inventory.json',
  'config/accepted-scope-registry.json',
  'config/remaining-scope-package-roadmap.json',
  'config/work-segmentation-plan.json',
  'config/active-governance-ledger.json'
];
const beforeCliFailure = await Promise.all(governedPaths.map((path) => readFile(resolve(root, path))));
const missingEvidenceRun = spawnSync(process.execPath, [
  'scripts/finalize-33-p-passkeys-federated-identity-verifiable-temporary-credentials-external-receipt.mjs'
], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
const afterCliFailure = await Promise.all(governedPaths.map((path) => readFile(resolve(root, path))));
check('finalizer-rejects-missing-evidence-before-state-write', missingEvidenceRun.status !== 0
  && `${missingEvidenceRun.stdout ?? ''}\n${missingEvidenceRun.stderr ?? ''}`.includes(
    '33-P finalizer requires exactly one value for --evidence-root')
  && beforeCliFailure.every((bytes, index) => bytes.equals(afterCliFailure[index])));
const beforeCompletionFailure = await Promise.all(governedPaths.map((path) => readFile(resolve(root, path))));
const missingReceiptRun = spawnSync(process.execPath, [
  'scripts/verify-33-p-passkeys-federated-identity-verifiable-temporary-credentials-completion.mjs'
], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
const afterCompletionFailure = await Promise.all(governedPaths.map((path) => readFile(resolve(root, path))));
check('completion-verifier-rejects-missing-receipt-without-state-write', missingReceiptRun.status !== 0
  && `${missingReceiptRun.stdout ?? ''}\n${missingReceiptRun.stderr ?? ''}`.includes('33-P_LIBRARY_RECEIPT.json')
  && beforeCompletionFailure.every((bytes, index) => bytes.equals(afterCompletionFailure[index])));

const accepted = evaluateIdentityAccessReceiptFinalization(base);
check('exact-prepared-finalization-passes', accepted.status === 'PASS' && accepted.failed === 0);
const finalState = buildIdentityAccessFinalState({
  ...base,
  receiptPath: 'artifacts/checkpoints/33-P_LIBRARY_RECEIPT.json',
  proofPaths: ['artifacts/checkpoints/33-P_LIBRARY_RECEIPT.json'],
  completionEvidencePaths: ['docs/decisions/DEC-227-passkeys-federated-identity-verifiable-temporary-credentials.md'],
  localCheckpointPath: 'C:/checkpoint/33-P',
  libraryCheckpointPath: 'D:/library/33-P'
});
check('final-state-completes-exact-chains-without-successor-activation',
  finalState.scope.status === 'COMPLETE' && finalState.scope.validation.countsAsRequirementPass === true
  && finalState.scope.persistentReceiptStatus === 'PASS'
  && finalState.inventory.status === 'COMPLETE'
  && finalState.workPlan.currentStep === null
  && finalState.workPlan.steps.find((item) => item.id === '33-P')?.status === 'COMPLETED'
  && finalState.ledger.activeMicroStep === null
  && finalState.roadmap.packages.find((item) => item.step === '33-Q')?.status === 'READY_NEXT'
  && IDENTITY_ACCESS_FINALIZATION_CHANGE_PATHS.length === 25
  && IDENTITY_ACCESS_FINALIZATION_CHANGE_PATHS.includes('config/accepted-scope-registry.json')
  && IDENTITY_ACCESS_FINALIZATION_CHANGE_PATHS.includes('artifacts/checkpoints/33-P_LIBRARY_RECEIPT.json')
  && IDENTITY_ACCESS_COMPLETION_REQUIREMENTS.every((id) => {
    const item = finalState.acceptedScopeRegistry.requirements.find((candidate) => candidate.id === id);
    return item?.status === 'COMPLETE' && Object.keys(item.chain).length === 13
      && Object.values(item.chain).every(Boolean)
      && item.evidence.includes('artifacts/checkpoints/33-P_LIBRARY_RECEIPT.json');
  })
  && IDENTITY_ACCESS_COMPLETION_REQUIREMENTS.every((id) => prepared.acceptedScopeRegistry.requirements
    .find((item) => item.id === id)?.status !== 'COMPLETE'));

const expired = evaluateIdentityAccessReceiptFinalization({
  ...base,
  finalizedAt: '2026-08-22T12:00:00.000Z'
});
check('expired-signed-evidence-rejected', expired.status === 'FAIL'
  && expired.checks.some((item) => item.id === 'signed-evidence-current-and-active' && item.status === 'FAIL'));
const foreignSigner = evaluateIdentityAccessReceiptFinalization({
  ...base,
  trustedSignerRegistry: {
    ...trustedSignerRegistry,
    signers: trustedSignerRegistry.signers.map((signer) => ({
      ...signer,
      signerKeyIdSha256: '7'.repeat(64)
    }))
  }
});
check('foreign-signer-rejected', foreignSigner.status === 'FAIL'
  && foreignSigner.checks.some((item) => item.id === 'signed-evidence-current-and-active' && item.status === 'FAIL'));
const sourceDrift = evaluateIdentityAccessReceiptFinalization({
  ...base,
  gitBinding: {
    ...base.gitBinding,
    changedPathsSinceEvidence: [...IDENTITY_ACCESS_PREPARATION_CHANGE_PATHS, 'packages/domain/src/unreviewed.ts']
  }
});
check('post-evidence-source-drift-rejected', sourceDrift.status === 'FAIL'
  && sourceDrift.checks.some((item) => item.id === 'git-descendant-and-preparation-diff-exact' && item.status === 'FAIL'));
const completedRegistry = structuredClone(base.acceptedScopeRegistry);
completedRegistry.requirements.find((item) => item.id === 'B2-02').status = 'COMPLETE';
const registryOverclaim = evaluateIdentityAccessReceiptFinalization({ ...base, acceptedScopeRegistry: completedRegistry });
check('pre-finalized-registry-overclaim-rejected', registryOverclaim.status === 'FAIL'
  && registryOverclaim.checks.some((item) => item.id === 'accepted-registry-still-open-before-atomic-finalization'
    && item.status === 'FAIL'));
const successorActiveRoadmap = structuredClone(base.roadmap);
successorActiveRoadmap.packages.find((item) => item.step === '33-Q').status = 'IN_PROGRESS';
const successorActive = evaluateIdentityAccessReceiptFinalization({ ...base, roadmap: successorActiveRoadmap });
check('premature-successor-activation-rejected', successorActive.status === 'FAIL'
  && successorActive.checks.some((item) => item.id === 'successor-declared-not-active' && item.status === 'FAIL'));
const nonActive = evaluateIdentityAccessReceiptFinalization({
  ...base,
  workPlan: { ...base.workPlan, currentStep: null }
});
check('non-active-receipt-step-rejected', nonActive.status === 'FAIL'
  && nonActive.checks.some((item) => item.id === 'sole-active-receipt-pending-step' && item.status === 'FAIL'));

const failures = checks.filter((item) => item.status !== 'PASS');
const report = {
  schemaVersion: 1,
  step: '33-P',
  decision: 'DEC-227',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checks: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  results: checks,
  actualExternalEvidenceStatus: 'NOT_RUN',
  actualPreparationStatus: 'NOT_RUN',
  actualFinalizationStatus: 'NOT_RUN',
  registryMutationPerformed: false,
  persistentReceiptWritten: false,
  generatedAt: new Date().toISOString()
};
if (!noWrite) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
console.log(`33-P finalization state machine runtime: ${report.status} (${report.passed}/${report.checks}; actual finalization NOT_RUN).`);
if (failures.length > 0) process.exitCode = 1;
