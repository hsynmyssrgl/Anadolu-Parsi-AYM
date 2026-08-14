import { IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS } from './identity-access-external-evidence-intake.mjs';

export const IDENTITY_ACCESS_COMPLETION_REQUIREMENTS = Object.freeze([
  'B2-02', 'B6-06', 'B6-07', 'EXT-070', 'EXT-071', 'EXT-072', 'EXT-073', 'EXT-074'
]);

const SHA256 = /^[0-9a-f]{64}$/u;
const GIT_OBJECT_ID = /^[0-9a-f]{40,64}$/u;
const PASS_EVIDENCE = 'PASS_SIGNED_EXTERNAL_EVIDENCE';
const ACCEPTANCE = Object.freeze({
  'B2-02': 'Kayıt, assertion, silme, birden çok anahtar, kayıp anahtar kurtarma ve audit var.',
  'B6-06': 'Yapılandırılmamış sağlayıcı görünmez; canlı hesapla test edilmeden PASS yok.',
  'B6-07': 'Windows tek ana veri kaynağı; çatışma ve cihaz iptali sözleşmesi.',
  'EXT-070': 'Tam karar-kod-ekran-test-belge-kanıt zinciri.',
  'EXT-071': 'Tam karar-kod-ekran-test-belge-kanıt zinciri.',
  'EXT-072': 'Tam karar-kod-ekran-test-belge-kanıt zinciri.',
  'EXT-073': 'Tam karar-kod-ekran-test-belge-kanıt zinciri.',
  'EXT-074': 'Tam karar-kod-ekran-test-belge-kanıt zinciri.'
});
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const validIso = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  && new Date(value).toISOString() === value;
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value, keys) => isRecord(value)
  && exact(Object.keys(value).sort(), [...keys].sort());
const add = (checks, id, condition) => checks.push(Object.freeze({ id, status: condition ? 'PASS' : 'FAIL' }));

const signerIsActive = (registry, keyId, preparedAt) => registry?.status === 'CONFIGURED'
  && Array.isArray(registry.signers) && registry.signers.some((signer) => signer?.status === 'ACTIVE'
    && signer.authority === 'independent_33p_evidence_reviewer'
    && signer.signerKeyIdSha256 === keyId
    && exact(signer.evidenceIds, IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS)
    && validIso(signer.validFrom) && validIso(signer.validUntil)
    && Date.parse(signer.validFrom) <= Date.parse(preparedAt)
    && Date.parse(signer.validUntil) > Date.parse(preparedAt));

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
  ]);

const evidenceBindingIsExact = (report, gitBinding, preparedAt) => {
  const binding = report?.evidenceBinding;
  return report?.status === 'PASS'
    && report?.closureReadiness?.status === 'READY_FOR_GOVERNED_REVIEW'
    && report.closureReadiness.requirementPassGranted === false
    && report.closureReadiness.registryMutationPerformed === false
    && report.closureReadiness.persistentReceiptWritten === false
    && isRecord(binding) && binding.sourceCommit === gitBinding.head && binding.sourceTree === gitBinding.tree
    && SHA256.test(binding.hostRefSha256) && SHA256.test(binding.signerKeyIdSha256)
    && isRecord(binding.manifest) && typeof binding.manifest.relativePath === 'string'
    && Number.isSafeInteger(binding.manifest.sizeBytes) && binding.manifest.sizeBytes > 0
    && SHA256.test(binding.manifest.sha256) && SHA256.test(binding.evidenceTreeSha256)
    && validIso(binding.generatedAt) && validIso(binding.expiresAt)
    && Date.parse(binding.generatedAt) <= Date.parse(preparedAt)
    && Date.parse(binding.expiresAt) > Date.parse(preparedAt)
    && Array.isArray(binding.files) && binding.files.length === IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS.length
    && binding.files.every((file, index) => file?.id === IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS[index]
      && typeof file.relativePath === 'string' && Number.isSafeInteger(file.sizeBytes) && file.sizeBytes > 0
      && SHA256.test(file.sha256));
};

const technicalEvidenceIsExact = (evidence, gitBinding) => evidence?.sourceCommit === gitBinding.head
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

export const evaluateIdentityAccessCompletionPreparation = ({
  scope, inventory, acceptedScopeRegistry, roadmap, workPlan, ledger, predecessorReceipt,
  trustedSignerRegistry, evidenceReport, technicalEvidence, gitBinding, preparedAt
}) => {
  const checks = [];
  const roadmap33P = roadmap?.packages?.find((item) => item.step === '33-P');
  const plan33P = workPlan?.steps?.find((item) => item.id === '33-P');
  const registryItems = IDENTITY_ACCESS_COMPLETION_REQUIREMENTS
    .map((id) => acceptedScopeRegistry?.requirements?.find((item) => item.id === id));
  add(checks, 'prepared-at-exact', validIso(preparedAt));
  add(checks, 'git-binding-clean-exact', gitBinding?.clean === true && GIT_OBJECT_ID.test(gitBinding?.head ?? '')
    && GIT_OBJECT_ID.test(gitBinding?.tree ?? '') && gitBinding?.predecessorAncestor === true);
  add(checks, 'package-identity-exact', scope?.decision === 'DEC-227' && inventory?.decision === 'DEC-227'
    && exact(scope?.requirements, IDENTITY_ACCESS_COMPLETION_REQUIREMENTS)
    && exact(inventory?.requirements, IDENTITY_ACCESS_COMPLETION_REQUIREMENTS)
    && exact(roadmap33P?.requirementIds, IDENTITY_ACCESS_COMPLETION_REQUIREMENTS));
  add(checks, 'sole-active-step-exact', scope?.status === 'IN_PROGRESS' && inventory?.status === 'IN_PROGRESS'
    && workPlan?.workflowStatus === 'IN_PROGRESS' && workPlan?.currentStep === '33-P'
    && plan33P?.status === 'IN_PROGRESS' && plan33P?.validationStatus === 'PENDING'
    && plan33P?.persistentReceiptStatus === 'PENDING' && ledger?.activeMicroStep === '33-P'
    && roadmap33P?.status === 'IN_PROGRESS'
    && workPlan?.steps?.filter((item) => item.status === 'IN_PROGRESS').length === 1);
  add(checks, 'accepted-registry-remains-open', registryItems.length === IDENTITY_ACCESS_COMPLETION_REQUIREMENTS.length
    && registryItems.every((item, index) => item && item.status !== 'COMPLETE' && item.chain?.evidence === false
      && item.acceptance === ACCEPTANCE[IDENTITY_ACCESS_COMPLETION_REQUIREMENTS[index]]));
  add(checks, 'predecessor-receipt-exact', predecessorReceipt?.step === '33-O'
    && predecessorReceipt?.decision === 'DEC-226' && predecessorReceipt?.status === 'PASS'
    && predecessorReceipt?.persistentReceiptStatus === 'PASS' && predecessorReceipt?.nextOfficialStep === '33-P'
    && predecessorReceipt?.nextOfficialDecision === 'DEC-227'
    && predecessorReceipt?.sourceCommit && gitBinding?.predecessorSourceCommit === predecessorReceipt.sourceCommit);
  add(checks, 'governed-signer-active', trustedSignerRegistryIsExact(trustedSignerRegistry)
    && evidenceBindingIsExact(evidenceReport, gitBinding, preparedAt)
    && signerIsActive(trustedSignerRegistry, evidenceReport?.evidenceBinding?.signerKeyIdSha256, preparedAt)
    && trustedSignerRegistry?.configurationTruth?.defaultSignerTrusted === false
    && trustedSignerRegistry?.configurationTruth?.selfSignedEvidenceAccepted === false
    && trustedSignerRegistry?.configurationTruth?.sourceCommitBindingRequired === true
    && trustedSignerRegistry?.configurationTruth?.activationRequiresGovernedReview === true);
  add(checks, 'external-evidence-binding-exact', evidenceBindingIsExact(evidenceReport, gitBinding, preparedAt));
  add(checks, 'technical-evidence-exact', technicalEvidenceIsExact(technicalEvidence, gitBinding));
  add(checks, 'no-existing-closure-overclaim', scope?.validation?.countsAsRequirementPass === false
    && scope?.persistentReceiptStatus === 'NOT_RUN' && inventory?.persistentReceiptStatus === 'NOT_RUN'
    && scope?.manualEvidence?.certificationClaimed === false);
  const failures = checks.filter((item) => item.status === 'FAIL');
  return Object.freeze({
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checks: Object.freeze(checks),
    passed: checks.length - failures.length,
    failed: failures.length
  });
};

export const buildIdentityAccessPreparedState = (input) => {
  const evaluation = evaluateIdentityAccessCompletionPreparation(input);
  if (evaluation.status !== 'PASS') {
    throw new Error(`33-P preparation rejected: ${evaluation.checks.filter((item) => item.status === 'FAIL').map((item) => item.id).join(', ')}`);
  }
  const scope = structuredClone(input.scope);
  const inventory = structuredClone(input.inventory);
  const acceptedScopeRegistry = structuredClone(input.acceptedScopeRegistry);
  const roadmap = structuredClone(input.roadmap);
  const workPlan = structuredClone(input.workPlan);
  const ledger = structuredClone(input.ledger);
  const evidencePath = 'artifacts/validation/33-P-identity-access-external-evidence-intake.json';
  const preparationPath = 'artifacts/checkpoints/33-P_PREPARATION_RECORD.json';
  const manualEvidence = Object.fromEntries([
    'liveProviderAccountTest', 'realAuthenticatorDevice', 'crossDeviceSync', 'credentialVerifierUat',
    'humanUat', 'privacyReview', 'legalReview', 'identityReview'
  ].map((key) => [key, PASS_EVIDENCE]));
  manualEvidence.certificationClaimed = false;
  scope.status = 'VALIDATED_RECEIPT_PENDING';
  scope.governancePhase = 'VALIDATED_EXTERNAL_EVIDENCE_RECEIPT_PENDING';
  scope.localImplementationChain = {
    ...scope.localImplementationChain,
    acceptanceComplete: true,
    manualEvidenceComplete: true,
    closureEvidenceComplete: false
  };
  scope.manualEvidence = manualEvidence;
  Object.assign(scope.truth, {
    governedExternalEvidenceSignerConfigured: true,
    actualExternalEvidenceIntakeStatus: PASS_EVIDENCE,
    networkReadyProviderConfigurationObserved: true,
    appleProtectedClientAuthenticationConfigured: true,
    providerExchangePerformed: true,
    providerAvailabilityVerified: true,
    liveProviderAccountTestPerformed: true,
    realAuthenticatorDeviceTestPerformed: true,
    companionRecipientKeyConfigurationObserved: true,
    crossDeviceSyncPerformed: true,
    externalQrIssuerTrustConfigured: true
  });
  scope.validation = {
    ...scope.validation,
    status: 'VALIDATED_RECEIPT_PENDING',
    actualExternalEvidenceIntake: PASS_EVIDENCE,
    evidenceBinding: structuredClone(input.evidenceReport.evidenceBinding),
    finalTechnicalEvidence: structuredClone(input.technicalEvidence),
    countsAsRequirementPass: false,
    persistentReceipt: 'PENDING',
    preparedAt: input.preparedAt
  };
  scope.persistentReceiptStatus = 'PENDING';
  scope.completionBlockers = [
    'Persistent local and D: receipt, source protection and Git remote equality are pending.'
  ];
  inventory.status = 'VALIDATED_RECEIPT_PENDING';
  inventory.persistentReceiptStatus = 'PENDING';
  inventory.openBlockers = [
    'Persistent local and D: receipt, source protection and Git remote equality are pending.'
  ];
  for (const path of [evidencePath, preparationPath]) {
    if (!inventory.evidenceOutputs.includes(path)) inventory.evidenceOutputs.push(path);
  }
  const plan33P = workPlan.steps.find((item) => item.id === '33-P');
  plan33P.validationStatus = 'PASS';
  for (const path of [evidencePath, preparationPath]) {
    if (!plan33P.localEvidence.includes(path)) plan33P.localEvidence.push(path);
  }
  workPlan.updatedAt = input.preparedAt;
  workPlan.segmentationNote = '33-P signed external evidence is validated; registry closure and official completion remain receipt-pending.';
  ledger.postflightStatus = 'PENDING_33_P_PERSISTENT_RECEIPT';
  ledger.libraryUploadStatus = '33-P_VALIDATED_RECEIPT_PENDING';
  ledger.nextOfficialTask = '33-P_PERSISTENT_RECEIPT_AND_SOURCE_PROTECTION';
  ledger.updatedAt = input.preparedAt;
  roadmap.packages.find((item) => item.step === '33-P').status = 'VALIDATED_AWAITING_RECEIPT';
  roadmap.updatedAt = input.preparedAt;
  const preparationRecord = Object.freeze({
    schemaVersion: 1,
    step: '33-P',
    decision: 'DEC-227',
    requirements: IDENTITY_ACCESS_COMPLETION_REQUIREMENTS,
    status: 'PASS',
    evidenceSourceCommit: input.evidenceReport.evidenceBinding.sourceCommit,
    evidenceSourceTree: input.evidenceReport.evidenceBinding.sourceTree,
    signerKeyIdSha256: input.evidenceReport.evidenceBinding.signerKeyIdSha256,
    manifestSha256: input.evidenceReport.evidenceBinding.manifest.sha256,
    evidenceTreeSha256: input.evidenceReport.evidenceBinding.evidenceTreeSha256,
    technicalEvidence: structuredClone(input.technicalEvidence),
    persistentReceiptStatus: 'PENDING',
    countsAsRequirementPass: false,
    nextOfficialStep: '33-Q',
    nextOfficialDecision: 'DEC-228',
    preparedAt: input.preparedAt
  });
  return Object.freeze({
    evaluation,
    scope,
    inventory,
    acceptedScopeRegistry,
    roadmap,
    workPlan,
    ledger,
    preparationRecord
  });
};
