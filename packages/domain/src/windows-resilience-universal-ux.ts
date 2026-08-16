export const UNIVERSAL_UX_MODES = Object.freeze([
  'standard', 'easy_read', 'guest', 'child', 'senior', 'caregiver', 'kitchen_tablet'
] as const);

export type UniversalUxMode = (typeof UNIVERSAL_UX_MODES)[number];
export type UniversalSearchSource = 'inbox' | 'person' | 'event' | 'document' | 'message' | 'command';

export interface UniversalUxPreferencesView {
  readonly mode: UniversalUxMode;
  readonly favoriteRouteIds: readonly string[];
  readonly recentRouteIds: readonly string[];
  readonly dashboardCardIds: readonly string[];
  readonly quietHoursEnabled: boolean;
  readonly quietHoursStart: string;
  readonly quietHoursEnd: string;
  readonly weeklyDigestEnabled: boolean;
  readonly revision: number;
  readonly updatedAt: string;
}

/** Content may enter search ranking only after the authority provider has authorized it. */
export interface UniversalSearchCandidate {
  readonly id: string;
  readonly source: UniversalSearchSource;
  readonly title: string;
  readonly keywords: readonly string[];
  readonly routeId: string;
  readonly authorized: true;
  readonly authorizationEvidenceSha256: string;
  readonly occurredAt?: string;
}

export interface UniversalSearchResultView {
  readonly id: string;
  readonly source: UniversalSearchSource;
  readonly title: string;
  readonly routeId: string;
  readonly score: number;
  readonly authorizationFiltered: true;
  readonly authorizationEvidenceSha256: string;
}

export interface PolicyWeakeningProposalInput {
  readonly proposalId: string;
  readonly currentPolicyVersion: string;
  readonly proposedPolicyVersion: string;
  readonly explicitUserDecisionId: string;
  readonly explicitUserDecisionSha256: string;
  readonly riskAnalysisSha256: string;
  readonly rollbackPlanSha256: string;
  readonly proposedPolicyPackageSha256: string;
  readonly reason: string;
}

export interface PolicyWeakeningVerificationView {
  readonly providerId: string;
  readonly providerConfigured: boolean;
  readonly providerProductionVerified: boolean;
  readonly verified: boolean;
  readonly explicitUserDecisionSha256?: string;
  readonly riskAnalysisSha256?: string;
  readonly rollbackPlanSha256?: string;
  readonly proposedPolicyPackageSha256?: string;
  readonly providerEvidenceSha256?: string;
  readonly networkUsed: boolean | null;
}

export interface PolicyWeakeningDecisionView {
  readonly accepted: boolean;
  readonly evidenceShapeValid: boolean;
  readonly reason: string;
  readonly verificationProviderId: string;
  readonly verificationProviderProductionVerified: boolean;
  readonly verificationEvidenceSha256?: string;
  readonly networkUsed: boolean | null;
  readonly requiresNewSignedPolicyPackage: true;
  readonly automaticActivationAllowed: false;
}

export interface WindowsResilienceEvidenceObservation {
  readonly providerId: string;
  readonly providerConfigured: boolean;
  readonly providerProductionVerified: boolean;
  readonly providerEvidenceSha256: string;
  readonly observedAt: string;
  readonly networkUsed: boolean;
  readonly crashSafeTransactionSyntheticPass: boolean;
  readonly startupRecoverySyntheticPass: boolean;
  readonly installerCleanInstallRealWindowsPass: boolean;
  readonly installerUpgradeRealWindowsPass: boolean;
  readonly installerRepairRealWindowsPass: boolean;
  readonly installerUninstallDataProtectionRealWindowsPass: boolean;
  readonly peopleCount: number;
  readonly eventCount: number;
  readonly documentCount: number;
  readonly soakHours: number;
  readonly realWindowsSoak: boolean;
}

export interface WindowsResilienceEvidenceView extends WindowsResilienceEvidenceObservation {
  readonly requirementsClosed: boolean;
}

export interface WindowsResilienceUniversalUxTruthView {
  readonly crashSafeTransactionFoundationPresent: true;
  readonly autosaveAndUndoFoundationPresent: true;
  readonly startupRecoveryFoundationPresent: true;
  readonly consistentErrorContractPresent: true;
  readonly policyWeakeningExplicitDecisionRequired: true;
  readonly policyWeakeningVerifiedEvidenceProviderRequired: true;
  readonly policyWeakeningNewVersionRiskRollbackRequired: true;
  readonly unifiedInboxAndAuthorizedSearchModeled: true;
  readonly universalSearchAuthorizationProviderRequired: true;
  readonly callerSuppliedSearchAuthorizationAccepted: false;
  readonly commandPaletteRecentsFavoritesModeled: true;
  readonly personalDashboardCardOrderingModeled: true;
  readonly weeklyDigestAndQuietHoursModeled: true;
  readonly familyTodayAndPersonaModesModeled: true;
  readonly offlineAndLastSyncIndicatorsModeled: true;
  readonly qrBarcodeCameraVoiceReadAloudAdaptersModeled: true;
  readonly windowsMiniPanelAndAppleWidgetContractsModeled: true;
  readonly resilienceEvidenceProviderRequired: true;
  readonly callerSuppliedResilienceClosureAccepted: false;
  readonly durableOwnerBoundPolicyReceiptRequired: true;
  readonly operationLedgerRetentionPolicyDecided: false;
  readonly productionUniversalSearchAuthorityComposed: false;
  readonly productionPolicyWeakeningVerifierComposed: false;
  readonly productionWindowsResilienceProviderComposed: false;
  readonly productionEvidenceProvidersComposed: false;
  readonly realWindowsLifecycleVerified: false;
  readonly sevenDaySoakVerified: false;
  readonly productionQrCameraVoiceProvidersConfigured: false;
  readonly appleWidgetApplicationBuilt: false;
  readonly windowsMiniPanelBuilt: false;
  readonly networkUsedByCurrentImplementation: false;
}

export const windowsResilienceUniversalUxTruth: WindowsResilienceUniversalUxTruthView = Object.freeze({
  crashSafeTransactionFoundationPresent: true,
  autosaveAndUndoFoundationPresent: true,
  startupRecoveryFoundationPresent: true,
  consistentErrorContractPresent: true,
  policyWeakeningExplicitDecisionRequired: true,
  policyWeakeningVerifiedEvidenceProviderRequired: true,
  policyWeakeningNewVersionRiskRollbackRequired: true,
  unifiedInboxAndAuthorizedSearchModeled: true,
  universalSearchAuthorizationProviderRequired: true,
  callerSuppliedSearchAuthorizationAccepted: false,
  commandPaletteRecentsFavoritesModeled: true,
  personalDashboardCardOrderingModeled: true,
  weeklyDigestAndQuietHoursModeled: true,
  familyTodayAndPersonaModesModeled: true,
  offlineAndLastSyncIndicatorsModeled: true,
  qrBarcodeCameraVoiceReadAloudAdaptersModeled: true,
  windowsMiniPanelAndAppleWidgetContractsModeled: true,
  resilienceEvidenceProviderRequired: true,
  callerSuppliedResilienceClosureAccepted: false,
  durableOwnerBoundPolicyReceiptRequired: true,
  operationLedgerRetentionPolicyDecided: false,
  productionUniversalSearchAuthorityComposed: false,
  productionPolicyWeakeningVerifierComposed: false,
  productionWindowsResilienceProviderComposed: false,
  productionEvidenceProvidersComposed: false,
  realWindowsLifecycleVerified: false,
  sevenDaySoakVerified: false,
  productionQrCameraVoiceProvidersConfigured: false,
  appleWidgetApplicationBuilt: false,
  windowsMiniPanelBuilt: false,
  networkUsedByCurrentImplementation: false
});

const SAFE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,255}$/u;
const SHA = /^[0-9a-f]{64}$/u;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/u;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const CONTROL = /[\u0000-\u001f\u007f]/u;
const SOURCES = new Set<UniversalSearchSource>(['inbox', 'person', 'event', 'document', 'message', 'command']);

export const isSafeUniversalUxIdentifier = (value: unknown): value is string =>
  typeof value === 'string' && SAFE.test(value);

export const isUniversalUxSha256 = (value: unknown): value is string =>
  typeof value === 'string' && SHA.test(value);

export const isCanonicalUniversalUxIsoDateTime = (value: unknown): value is string => {
  if (typeof value !== 'string' || !ISO.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
};

export const isSafeUniversalUxText = (value: unknown, minimum: number, maximum: number): value is string =>
  typeof value === 'string' && value === value.trim() && value === value.normalize('NFKC') &&
  value.length >= minimum && value.length <= maximum && !CONTROL.test(value);

const validUniqueIds = (values: unknown, maximum: number): values is readonly string[] =>
  Array.isArray(values) && values.length <= maximum && values.every(isSafeUniversalUxIdentifier) &&
  new Set(values).size === values.length;

const validUniqueTexts = (values: unknown, maximum: number): values is readonly string[] =>
  Array.isArray(values) && values.length <= maximum && values.every(value => isSafeUniversalUxText(value, 1, 128)) &&
  new Set(values).size === values.length;

export const isUniversalUxPreferencesView = (value: unknown): value is UniversalUxPreferencesView => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<UniversalUxPreferencesView>;
  if (Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).sort().join(',') !== [
      'dashboardCardIds', 'favoriteRouteIds', 'mode', 'quietHoursEnabled', 'quietHoursEnd',
      'quietHoursStart', 'recentRouteIds', 'revision', 'updatedAt', 'weeklyDigestEnabled'
    ].sort().join(',')) return false;
  return UNIVERSAL_UX_MODES.includes(item.mode as UniversalUxMode) &&
    validUniqueIds(item.favoriteRouteIds, 64) && validUniqueIds(item.recentRouteIds, 64) &&
    validUniqueIds(item.dashboardCardIds, 32) && typeof item.quietHoursEnabled === 'boolean' &&
    typeof item.quietHoursStart === 'string' && TIME.test(item.quietHoursStart) &&
    typeof item.quietHoursEnd === 'string' && TIME.test(item.quietHoursEnd) &&
    (!item.quietHoursEnabled || item.quietHoursStart !== item.quietHoursEnd) &&
    typeof item.weeklyDigestEnabled === 'boolean' && Number.isSafeInteger(item.revision) &&
    (item.revision ?? 0) >= 1 && isCanonicalUniversalUxIsoDateTime(item.updatedAt);
};

export const evaluatePolicyWeakening = (
  input: PolicyWeakeningProposalInput,
  verification: PolicyWeakeningVerificationView
): PolicyWeakeningDecisionView => {
  const evidenceShapeValid = [input.proposalId, input.currentPolicyVersion, input.proposedPolicyVersion,
    input.explicitUserDecisionId].every(isSafeUniversalUxIdentifier) &&
    input.currentPolicyVersion !== input.proposedPolicyVersion &&
    [input.explicitUserDecisionSha256, input.riskAnalysisSha256, input.rollbackPlanSha256,
      input.proposedPolicyPackageSha256].every(isUniversalUxSha256) && isSafeUniversalUxText(input.reason, 10, 2000);
  const verificationExact = evidenceShapeValid && verification.providerConfigured === true &&
    verification.providerProductionVerified === true && verification.verified === true &&
    isSafeUniversalUxIdentifier(verification.providerId) &&
    verification.explicitUserDecisionSha256 === input.explicitUserDecisionSha256 &&
    verification.riskAnalysisSha256 === input.riskAnalysisSha256 &&
    verification.rollbackPlanSha256 === input.rollbackPlanSha256 &&
    verification.proposedPolicyPackageSha256 === input.proposedPolicyPackageSha256 &&
    isUniversalUxSha256(verification.providerEvidenceSha256) && typeof verification.networkUsed === 'boolean';
  return Object.freeze({
    accepted: verificationExact,
    evidenceShapeValid,
    reason: verificationExact ? 'VERIFIED_EXPLICIT_DECISION_RISK_ROLLBACK_AND_SIGNED_PACKAGE' :
      evidenceShapeValid ? 'POLICY_WEAKENING_VERIFICATION_REQUIRED' : 'POLICY_WEAKENING_EVIDENCE_INCOMPLETE',
    verificationProviderId: isSafeUniversalUxIdentifier(verification.providerId) ? verification.providerId : 'invalid-provider',
    verificationProviderProductionVerified: verification.providerProductionVerified === true,
    ...(isUniversalUxSha256(verification.providerEvidenceSha256) ?
      {verificationEvidenceSha256: verification.providerEvidenceSha256} : {}),
    networkUsed: typeof verification.networkUsed === 'boolean' ? verification.networkUsed : null,
    requiresNewSignedPolicyPackage: true,
    automaticActivationAllowed: false
  });
};

export const searchUniversalUx = (
  query: string,
  candidates: readonly UniversalSearchCandidate[],
  limit = 20
): readonly UniversalSearchResultView[] => {
  const normalizedQuery = typeof query === 'string' ? query.normalize('NFKC').trim() : '';
  if (!isSafeUniversalUxText(normalizedQuery, 1, 256) || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
    !Array.isArray(candidates) || candidates.length > 500) throw new Error('Universal search input is invalid');
  const ids = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || candidate.authorized !== true || !isSafeUniversalUxIdentifier(candidate.id) ||
      !SOURCES.has(candidate.source) || !isSafeUniversalUxText(candidate.title, 1, 256) ||
      !validUniqueTexts(candidate.keywords, 32) ||
      !isSafeUniversalUxIdentifier(candidate.routeId) || !isUniversalUxSha256(candidate.authorizationEvidenceSha256) ||
      (candidate.occurredAt !== undefined && !isCanonicalUniversalUxIsoDateTime(candidate.occurredAt)) || ids.has(candidate.id)) {
      throw new Error('Universal search authorization evidence is invalid');
    }
    ids.add(candidate.id);
  }
  const terms = normalizedQuery.toLocaleLowerCase('tr-TR').split(/\s+/u).filter(Boolean);
  return Object.freeze(candidates.map(candidate => {
    const haystack = [candidate.title, ...candidate.keywords].join(' ').toLocaleLowerCase('tr-TR');
    const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
    return {candidate, score};
  }).filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || left.candidate.title.localeCompare(right.candidate.title, 'tr'))
    .slice(0, limit).map(({candidate, score}) => Object.freeze({
      id: candidate.id,
      source: candidate.source,
      title: candidate.title,
      routeId: candidate.routeId,
      score,
      authorizationFiltered: true as const,
      authorizationEvidenceSha256: candidate.authorizationEvidenceSha256
    })));
};

export const assessWindowsResilienceEvidence = (
  input: WindowsResilienceEvidenceObservation
): WindowsResilienceEvidenceView => {
  const booleanFields = [input.providerConfigured, input.providerProductionVerified, input.networkUsed,
    input.crashSafeTransactionSyntheticPass, input.startupRecoverySyntheticPass,
    input.installerCleanInstallRealWindowsPass, input.installerUpgradeRealWindowsPass,
    input.installerRepairRealWindowsPass, input.installerUninstallDataProtectionRealWindowsPass,
    input.realWindowsSoak];
  const countsValid = Number.isSafeInteger(input.peopleCount) && input.peopleCount >= 0 && input.peopleCount <= 1_000_000 &&
    Number.isSafeInteger(input.eventCount) && input.eventCount >= 0 && input.eventCount <= 10_000_000 &&
    Number.isSafeInteger(input.documentCount) && input.documentCount >= 0 && input.documentCount <= 1_000_000 &&
    Number.isSafeInteger(input.soakHours) && input.soakHours >= 0 && input.soakHours <= 8_760;
  if (!isSafeUniversalUxIdentifier(input.providerId) || !isUniversalUxSha256(input.providerEvidenceSha256) ||
    !isCanonicalUniversalUxIsoDateTime(input.observedAt) || booleanFields.some(value => typeof value !== 'boolean') ||
    !countsValid) throw new Error('Windows resilience evidence observation is invalid');
  const requirementsClosed = input.providerConfigured && input.providerProductionVerified &&
    input.crashSafeTransactionSyntheticPass && input.startupRecoverySyntheticPass &&
    input.installerCleanInstallRealWindowsPass && input.installerUpgradeRealWindowsPass &&
    input.installerRepairRealWindowsPass && input.installerUninstallDataProtectionRealWindowsPass &&
    input.peopleCount >= 10_000 && input.eventCount >= 100_000 && input.documentCount >= 10_000 &&
    input.soakHours >= 168 && input.realWindowsSoak;
  return Object.freeze({...input, requirementsClosed});
};
