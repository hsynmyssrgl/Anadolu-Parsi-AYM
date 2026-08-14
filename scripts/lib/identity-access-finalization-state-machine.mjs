import { IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS } from './identity-access-external-evidence-intake.mjs';
import {
  IDENTITY_ACCESS_COMPLETION_REQUIREMENTS,
  IDENTITY_ACCESS_PASS_EVIDENCE,
  IDENTITY_ACCESS_REQUIREMENT_ACCEPTANCE
} from './identity-access-preparation-state-machine.mjs';

const SHA256 = /^[0-9a-f]{64}$/u;
const GIT_OBJECT_ID = /^[0-9a-f]{40,64}$/u;
const MANUAL_EVIDENCE_KEYS = Object.freeze([
  'liveProviderAccountTest', 'realAuthenticatorDevice', 'crossDeviceSync', 'credentialVerifierUat',
  'humanUat', 'privacyReview', 'legalReview', 'identityReview'
]);
export const IDENTITY_ACCESS_COMPLETION_CHAIN_KEYS = Object.freeze([
  'decision', 'domain', 'schema', 'migration', 'useCase', 'repository', 'policy',
  'apiOrIpc', 'ui', 'menu', 'targetedTest', 'documentation', 'evidence'
]);
export const IDENTITY_ACCESS_PREPARATION_CHANGE_PATHS = Object.freeze([
  'artifacts/checkpoints/33-P_PREPARATION_RECORD.json',
  'artifacts/checkpoints/33-P_PREPARATION_RECORD.json.sha256',
  'artifacts/validation/33-P-identity-access-external-evidence-intake.json',
  'artifacts/validation/33-P-identity-access-external-evidence-intake.json.sha256',
  'config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-inventory.json',
  'config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-scope.json',
  'config/active-governance-ledger.json',
  'config/remaining-scope-package-roadmap.json',
  'config/work-segmentation-plan.json',
  'docs/audit/33-P_IDENTITY_ACCESS_CREDENTIALS_UST_KAPANIS.md',
  'docs/decisions/DEC-227-passkeys-federated-identity-verifiable-temporary-credentials.md',
  'docs/security/THREAT_MODEL_33_P_PASSKEYS_FEDERATED_IDENTITY_VERIFIABLE_TEMPORARY_CREDENTIALS.md'
].sort());
export const IDENTITY_ACCESS_FINALIZATION_CHANGE_PATHS = Object.freeze([
  'artifacts/checkpoints/33-P_COMPLETION_RECORD.json',
  'artifacts/checkpoints/33-P_COMPLETION_RECORD.json.sha256',
  'artifacts/checkpoints/33-P_LIBRARY_RECEIPT.json',
  'artifacts/checkpoints/33-P_LIBRARY_RECEIPT.json.sha256',
  'artifacts/validation/33-P_LIBRARY_CLOSURE_INVENTORY_VERIFICATION.json',
  'artifacts/validation/33-P_LIBRARY_CLOSURE_INVENTORY_VERIFICATION.json.sha256',
  'artifacts/validation/33-P_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  'artifacts/validation/33-P_LIBRARY_FINAL_INVENTORY_VERIFICATION.json.sha256',
  'artifacts/validation/33-P_LIBRARY_READBACK_VERIFICATION.json',
  'artifacts/validation/33-P_LIBRARY_READBACK_VERIFICATION.json.sha256',
  'artifacts/validation/33-P_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  'artifacts/validation/33-P_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json.sha256',
  'artifacts/validation/33-P_RECEIPT_READBACK_VERIFICATION.json',
  'artifacts/validation/33-P_RECEIPT_READBACK_VERIFICATION.json.sha256',
  'artifacts/validation/33-P_COMPLETION_TRANSITION_VALIDATION.json',
  'artifacts/validation/33-P_COMPLETION_TRANSITION_VALIDATION.json.sha256',
  'config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-inventory.json',
  'config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-scope.json',
  'config/accepted-scope-registry.json',
  'config/active-governance-ledger.json',
  'config/remaining-scope-package-roadmap.json',
  'config/work-segmentation-plan.json',
  'docs/audit/33-P_IDENTITY_ACCESS_CREDENTIALS_UST_KAPANIS.md',
  'docs/decisions/DEC-227-passkeys-federated-identity-verifiable-temporary-credentials.md',
  'docs/security/THREAT_MODEL_33_P_PASSKEYS_FEDERATED_IDENTITY_VERIFIABLE_TEMPORARY_CREDENTIALS.md'
].sort());

const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value, keys) => isRecord(value) && exact(Object.keys(value).sort(), [...keys].sort());
const validIso = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  && new Date(value).toISOString() === value;
const add = (checks, id, condition) => checks.push(Object.freeze({ id, status: condition ? 'PASS' : 'FAIL' }));

const trustedSignerRegistryIsExact = (registry) => exactKeys(registry, [
  'schemaVersion', 'id', 'step', 'decision', 'status', 'signers', 'configurationTruth'
]) && registry.schemaVersion === 1 && registry.id === '33-p-identity-access-external-evidence-trusted-signers'
  && registry.step === '33-P' && registry.decision === 'DEC-227' && registry.status === 'CONFIGURED'
  && Array.isArray(registry.signers) && registry.signers.length >= 1 && registry.signers.length <= 16
  && new Set(registry.signers.map((signer) => signer?.signerKeyIdSha256)).size === registry.signers.length
  && registry.signers.every((signer) => exactKeys(signer, [
    'authority', 'evidenceIds', 'signerKeyIdSha256', 'status', 'validFrom', 'validUntil'
  ]) && signer.authority === 'independent_33p_evidence_reviewer' && signer.status === 'ACTIVE'
    && SHA256.test(signer.signerKeyIdSha256) && exact(signer.evidenceIds, IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS)
    && validIso(signer.validFrom) && validIso(signer.validUntil))
  && exactKeys(registry.configurationTruth, [
    'defaultSignerTrusted', 'selfSignedEvidenceAccepted', 'sourceCommitBindingRequired',
    'activationRequiresGovernedReview'
  ]) && registry.configurationTruth.defaultSignerTrusted === false
  && registry.configurationTruth.selfSignedEvidenceAccepted === false
  && registry.configurationTruth.sourceCommitBindingRequired === true
  && registry.configurationTruth.activationRequiresGovernedReview === true;

const signerIsActive = (registry, keyId, finalizedAt) => trustedSignerRegistryIsExact(registry)
  && registry.signers.some((signer) => signer.signerKeyIdSha256 === keyId
    && Date.parse(signer.validFrom) <= Date.parse(finalizedAt)
    && Date.parse(signer.validUntil) > Date.parse(finalizedAt));

const evidenceBindingIsExact = (report, finalizedAt) => {
  const binding = report?.evidenceBinding;
  return report?.schemaVersion === 1 && report?.step === '33-P' && report?.decision === 'DEC-227'
    && report?.status === 'PASS' && report?.failed === 0
    && report?.closureReadiness?.status === 'READY_FOR_GOVERNED_REVIEW'
    && report.closureReadiness.requirementPassGranted === false
    && report.closureReadiness.registryMutationPerformed === false
    && report.closureReadiness.persistentReceiptWritten === false
    && isRecord(binding) && GIT_OBJECT_ID.test(binding.sourceCommit ?? '')
    && GIT_OBJECT_ID.test(binding.sourceTree ?? '') && SHA256.test(binding.hostRefSha256 ?? '')
    && SHA256.test(binding.signerKeyIdSha256 ?? '') && SHA256.test(binding.evidenceTreeSha256 ?? '')
    && isRecord(binding.manifest) && typeof binding.manifest.relativePath === 'string'
    && Number.isSafeInteger(binding.manifest.sizeBytes) && binding.manifest.sizeBytes > 0
    && SHA256.test(binding.manifest.sha256 ?? '')
    && Array.isArray(binding.files) && binding.files.length === IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS.length
    && binding.files.every((file, index) => file?.id === IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS[index]
      && typeof file.relativePath === 'string' && Number.isSafeInteger(file.sizeBytes) && file.sizeBytes > 0
      && SHA256.test(file.sha256 ?? ''))
    && validIso(binding.generatedAt) && validIso(binding.expiresAt)
    && Date.parse(binding.generatedAt) <= Date.parse(finalizedAt)
    && Date.parse(binding.expiresAt) > Date.parse(finalizedAt);
};

const preparationRecordIsExact = (record, evidenceReport, technicalEvidence) => exactKeys(record, [
  'schemaVersion', 'step', 'decision', 'requirements', 'status', 'evidenceSourceCommit',
  'evidenceSourceTree', 'signerKeyIdSha256', 'manifestSha256', 'evidenceTreeSha256',
  'technicalEvidence', 'persistentReceiptStatus', 'countsAsRequirementPass', 'nextOfficialStep',
  'nextOfficialDecision', 'preparedAt'
]) && record.schemaVersion === 1 && record.step === '33-P' && record.decision === 'DEC-227'
  && exact(record.requirements, IDENTITY_ACCESS_COMPLETION_REQUIREMENTS) && record.status === 'PASS'
  && record.evidenceSourceCommit === evidenceReport?.evidenceBinding?.sourceCommit
  && record.evidenceSourceTree === evidenceReport?.evidenceBinding?.sourceTree
  && record.signerKeyIdSha256 === evidenceReport?.evidenceBinding?.signerKeyIdSha256
  && record.manifestSha256 === evidenceReport?.evidenceBinding?.manifest?.sha256
  && record.evidenceTreeSha256 === evidenceReport?.evidenceBinding?.evidenceTreeSha256
  && exact(record.technicalEvidence, technicalEvidence) && record.persistentReceiptStatus === 'PENDING'
  && record.countsAsRequirementPass === false && record.nextOfficialStep === '33-Q'
  && record.nextOfficialDecision === 'DEC-228' && validIso(record.preparedAt);

const technicalEvidenceIsExact = (evidence, sourceCommit) => evidence?.sourceCommit === sourceCommit
  && evidence?.boundary?.status === 'PASS' && evidence.boundary.checksPassed === 21
  && evidence?.contract?.status === 'PASS' && evidence.contract.checksPassed === 17
  && evidence?.runtime?.status === 'PASS' && evidence.runtime.checksPassed === 24
  && evidence.runtime.targetedTestFilesPassed === 19 && evidence.runtime.targetedTestsPassed >= 116
  && evidence?.migration93Checksum === '51191e62bcf4baec07e3eab5985ef4210402cdb8b7416064519ceb082322916a'
  && evidence?.ppk021?.status === 'PASS' && evidence.ppk021.findings === 0
  && Number.isSafeInteger(evidence.ppk021.exactAllowlistEntries) && evidence.ppk021.exactAllowlistEntries > 0
  && evidence?.ppk022?.status === 'PASS' && evidence.ppk022.findings === 0
  && Number.isSafeInteger(evidence.ppk022.exactManifestSurfaces) && evidence.ppk022.exactManifestSurfaces > 0
  && Number.isSafeInteger(evidence?.fullVitest?.testFilesPassed) && evidence.fullVitest.testFilesPassed > 0
  && Number.isSafeInteger(evidence.fullVitest.testsPassed) && evidence.fullVitest.testsPassed > 0
  && evidence?.builds?.packages === true && evidence.builds.coreService === true && evidence.builds.desktop === true;

export const evaluateIdentityAccessReceiptFinalization = ({
  scope, inventory, acceptedScopeRegistry, roadmap, workPlan, ledger, predecessorReceipt,
  trustedSignerRegistry, evidenceReport, preparationRecord, gitBinding, finalizedAt
}) => {
  const checks = [];
  const plan33P = workPlan?.steps?.find((item) => item.id === '33-P');
  const roadmap33P = roadmap?.packages?.find((item) => item.step === '33-P');
  const roadmap33Q = roadmap?.packages?.find((item) => item.step === '33-Q');
  const technicalEvidence = preparationRecord?.technicalEvidence;
  const registryItems = IDENTITY_ACCESS_COMPLETION_REQUIREMENTS
    .map((id) => acceptedScopeRegistry?.requirements?.find((item) => item.id === id));
  add(checks, 'finalized-at-exact', validIso(finalizedAt));
  add(checks, 'package-identity-exact', scope?.decision === 'DEC-227' && inventory?.decision === 'DEC-227'
    && exact(scope?.requirements, IDENTITY_ACCESS_COMPLETION_REQUIREMENTS)
    && exact(inventory?.requirements, IDENTITY_ACCESS_COMPLETION_REQUIREMENTS)
    && exact(roadmap33P?.requirementIds, IDENTITY_ACCESS_COMPLETION_REQUIREMENTS));
  add(checks, 'prepared-state-exact', scope?.status === 'VALIDATED_RECEIPT_PENDING'
    && scope?.governancePhase === 'VALIDATED_EXTERNAL_EVIDENCE_RECEIPT_PENDING'
    && inventory?.status === 'VALIDATED_RECEIPT_PENDING' && scope?.persistentReceiptStatus === 'PENDING'
    && inventory?.persistentReceiptStatus === 'PENDING' && scope?.validation?.status === 'VALIDATED_RECEIPT_PENDING'
    && scope.validation.actualExternalEvidenceIntake === IDENTITY_ACCESS_PASS_EVIDENCE
    && scope.validation.countsAsRequirementPass === false && scope.validation.persistentReceipt === 'PENDING'
    && exact(scope.validation.evidenceBinding, evidenceReport?.evidenceBinding)
    && exact(scope.validation.finalTechnicalEvidence, technicalEvidence)
    && MANUAL_EVIDENCE_KEYS.every((key) => scope?.manualEvidence?.[key] === IDENTITY_ACCESS_PASS_EVIDENCE)
    && scope?.manualEvidence?.certificationClaimed === false);
  add(checks, 'prepared-truth-exact', scope?.truth?.governedExternalEvidenceSignerConfigured === true
    && scope?.truth?.actualExternalEvidenceIntakeStatus === IDENTITY_ACCESS_PASS_EVIDENCE
    && scope?.truth?.networkReadyProviderConfigurationObserved === true
    && scope?.truth?.appleProtectedClientAuthenticationConfigured === true
    && scope?.truth?.providerExchangePerformed === true && scope?.truth?.providerAvailabilityVerified === true
    && scope?.truth?.liveProviderAccountTestPerformed === true
    && scope?.truth?.realAuthenticatorDeviceTestPerformed === true
    && scope?.truth?.companionRecipientKeyConfigurationObserved === true
    && scope?.truth?.crossDeviceSyncPerformed === true && scope?.truth?.externalQrIssuerTrustConfigured === true
    && scope?.truth?.identityCertificationClaimed === false && scope?.truth?.legalCertificationClaimed === false
    && scope?.truth?.privacyCertificationClaimed === false);
  add(checks, 'sole-active-receipt-pending-step', workPlan?.workflowStatus === 'IN_PROGRESS'
    && workPlan?.currentStep === '33-P' && plan33P?.status === 'IN_PROGRESS'
    && plan33P?.validationStatus === 'PASS' && plan33P?.persistentReceiptStatus === 'PENDING'
    && plan33P?.completionTransitionStatus === 'PENDING' && ledger?.activeMicroStep === '33-P'
    && ledger?.postflightStatus === 'PENDING_33_P_PERSISTENT_RECEIPT'
    && ledger?.libraryUploadStatus === '33-P_VALIDATED_RECEIPT_PENDING'
    && roadmap33P?.status === 'VALIDATED_AWAITING_RECEIPT'
    && workPlan?.steps?.filter((item) => item.status === 'IN_PROGRESS').length === 1);
  add(checks, 'successor-declared-not-active', roadmap33Q?.decision === 'DEC-228'
    && exact(roadmap33Q?.dependsOn, ['33-O', '33-P', 'PPK-016', 'PPK-019', 'PPK-022'])
    && ['PLANNED', 'PLANNED_NEXT'].includes(roadmap33Q?.status) && workPlan?.currentStep !== '33-Q');
  add(checks, 'accepted-registry-still-open-before-atomic-finalization',
    registryItems.length === IDENTITY_ACCESS_COMPLETION_REQUIREMENTS.length
    && registryItems.every((item, index) => item && item.status !== 'COMPLETE'
      && exact(Object.keys(item.chain ?? {}).sort(), [...IDENTITY_ACCESS_COMPLETION_CHAIN_KEYS].sort())
      && item.chain.evidence === false
      && item.acceptance === IDENTITY_ACCESS_REQUIREMENT_ACCEPTANCE[IDENTITY_ACCESS_COMPLETION_REQUIREMENTS[index]]));
  add(checks, 'predecessor-receipt-exact', predecessorReceipt?.step === '33-O'
    && predecessorReceipt?.decision === 'DEC-226' && predecessorReceipt?.status === 'PASS'
    && predecessorReceipt?.persistentReceiptStatus === 'PASS' && predecessorReceipt?.nextOfficialStep === '33-P'
    && predecessorReceipt?.nextOfficialDecision === 'DEC-227'
    && predecessorReceipt?.sourceCommit === gitBinding?.predecessorSourceCommit);
  add(checks, 'signed-evidence-current-and-active', evidenceBindingIsExact(evidenceReport, finalizedAt)
    && signerIsActive(trustedSignerRegistry, evidenceReport?.evidenceBinding?.signerKeyIdSha256, finalizedAt));
  add(checks, 'preparation-record-and-technical-evidence-exact',
    preparationRecordIsExact(preparationRecord, evidenceReport, technicalEvidence)
    && technicalEvidenceIsExact(technicalEvidence, evidenceReport?.evidenceBinding?.sourceCommit)
    && Date.parse(preparationRecord?.preparedAt ?? '') <= Date.parse(finalizedAt));
  add(checks, 'git-descendant-and-preparation-diff-exact', gitBinding?.clean === true
    && GIT_OBJECT_ID.test(gitBinding?.head ?? '') && GIT_OBJECT_ID.test(gitBinding?.tree ?? '')
    && gitBinding?.evidenceSourceAncestor === true && gitBinding?.predecessorAncestor === true
    && gitBinding?.remoteHeadsEqual === true
    && gitBinding?.evidenceSourceCommit === evidenceReport?.evidenceBinding?.sourceCommit
    && exact([...(gitBinding?.changedPathsSinceEvidence ?? [])].sort(), IDENTITY_ACCESS_PREPARATION_CHANGE_PATHS));
  add(checks, 'no-existing-completion-overclaim', scope?.validation?.countsAsRequirementPass === false
    && scope?.persistentReceiptStatus === 'PENDING' && inventory?.persistentReceiptStatus === 'PENDING'
    && !scope?.persistentReceiptPath && !inventory?.completedAt);
  const failures = checks.filter((item) => item.status === 'FAIL');
  return Object.freeze({
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checks: Object.freeze(checks),
    passed: checks.length - failures.length,
    failed: failures.length
  });
};

export const buildIdentityAccessFinalState = (input) => {
  const evaluation = evaluateIdentityAccessReceiptFinalization(input);
  if (evaluation.status !== 'PASS') {
    throw new Error(`33-P finalization rejected: ${evaluation.checks
      .filter((item) => item.status === 'FAIL').map((item) => item.id).join(', ')}`);
  }
  const scope = structuredClone(input.scope);
  const inventory = structuredClone(input.inventory);
  const acceptedScopeRegistry = structuredClone(input.acceptedScopeRegistry);
  const roadmap = structuredClone(input.roadmap);
  const workPlan = structuredClone(input.workPlan);
  const ledger = structuredClone(input.ledger);
  const evidence = [...new Set([
    ...(input.completionEvidencePaths ?? []), ...(input.proofPaths ?? [])
  ])].sort();
  if (evidence.length === 0 || !evidence.every((path) => typeof path === 'string' && path.length > 0)) {
    throw new Error('33-P finalization requires bounded completion evidence paths');
  }
  for (const id of IDENTITY_ACCESS_COMPLETION_REQUIREMENTS) {
    const item = acceptedScopeRegistry.requirements.find((candidate) => candidate.id === id);
    item.status = 'COMPLETE';
    item.chain = Object.fromEntries(IDENTITY_ACCESS_COMPLETION_CHAIN_KEYS.map((key) => [key, true]));
    item.evidence = [...evidence];
  }
  scope.status = 'COMPLETE';
  scope.governancePhase = 'COMPLETED_SIGNED_EXTERNAL_EVIDENCE_RECEIPT_PASS';
  scope.validation = {
    ...scope.validation,
    status: 'PASS',
    countsAsRequirementPass: true,
    persistentReceipt: 'PASS',
    finalizationSourceCommit: input.gitBinding.head,
    finalizedAt: input.finalizedAt
  };
  scope.persistentReceiptStatus = 'PASS';
  scope.persistentReceiptPath = input.receiptPath;
  scope.completedAt = input.finalizedAt;
  scope.completionBlockers = [];
  inventory.status = 'COMPLETE';
  inventory.persistentReceiptStatus = 'PASS';
  inventory.completedAt = input.finalizedAt;
  inventory.openBlockers = [];
  for (const path of [...evidence, ...input.proofPaths]) {
    if (!inventory.evidenceOutputs.includes(path)) inventory.evidenceOutputs.push(path);
  }
  const plan33P = workPlan.steps.find((item) => item.id === '33-P');
  Object.assign(plan33P, {
    status: 'COMPLETED', validationStatus: 'PASS', persistentReceiptStatus: 'PASS',
    persistentReceiptPath: input.receiptPath, completionTransitionStatus: 'PASS'
  });
  for (const path of [...evidence, ...input.proofPaths]) {
    if (!plan33P.localEvidence.includes(path)) plan33P.localEvidence.push(path);
  }
  workPlan.currentStep = null;
  workPlan.workflowStatus = 'COMPLETED';
  workPlan.updatedAt = input.finalizedAt;
  workPlan.segmentationNote = '33-P is immutable COMPLETED/PASS with exact local and D: receipt. 33-Q / DEC-228 remains a separately activated successor.';
  ledger.libraryUploadStatus = '33-P_COMPLETED_RECEIPT_PASS';
  ledger.nextOfficialTask = '33-Q_DEC-228_ACTIVATION';
  ledger.activeMicroStep = null;
  ledger.postflightStatus = 'PASS';
  ledger.externalLibraryAuthority33P = {
    step: '33-P', status: 'PASS', storageBackend: 'EXTERNAL_USB_D_DRIVE',
    path: input.libraryCheckpointPath, localCheckpointPath: input.localCheckpointPath,
    receipt: input.receiptPath, focusedCheckpointOnly: true
  };
  ledger.updatedAt = input.finalizedAt;
  const roadmap33P = roadmap.packages.find((item) => item.step === '33-P');
  const roadmap33Q = roadmap.packages.find((item) => item.step === '33-Q');
  roadmap33P.status = 'COMPLETED';
  roadmap33Q.status = 'READY_NEXT';
  roadmap.completedRequirementCount = (roadmap.completedRequirementCount ?? 0)
    + IDENTITY_ACCESS_COMPLETION_REQUIREMENTS.length;
  roadmap.remainingRequirementCount = Math.max(0, (roadmap.remainingRequirementCount ?? 0)
    - IDENTITY_ACCESS_COMPLETION_REQUIREMENTS.length);
  roadmap.updatedAt = input.finalizedAt;
  return Object.freeze({
    evaluation, scope, inventory, acceptedScopeRegistry, roadmap, workPlan, ledger
  });
};
