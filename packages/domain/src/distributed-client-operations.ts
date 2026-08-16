export type DistributedDiscoveryMode = 'mdns' | 'manual_ip' | 'qr';
export type DistributedFaultScenario = 'network_partition' | 'power_loss' | 'disk_full' | 'corruption' |
  'clock_skew' | 'certificate_expiry' | 'rolling_update';
export type DistributedControlPlaneKind = 'rendezvous' | 'certificate_revocation' | 'apns_wake' |
  'witness_vote' | 'health';

export interface DistributedDiscoveryCandidateView {
  readonly nodeId: string;
  readonly addressHint: string;
  readonly mode: DistributedDiscoveryMode;
  readonly trustedByDiscovery: false;
  readonly requiresMtlsPairing: true;
}

export interface DistributedRemoteConnectivityView {
  readonly enabled: boolean;
  readonly mode: 'disabled' | 'outbound_relay' | 'user_vpn';
  readonly inboundPortRequired: false;
  readonly relayCanDecryptFamilyContent: false;
  readonly deviceRevocationRequired: true;
  readonly providerConfigured: boolean;
  readonly providerProductionVerified: boolean;
  readonly connected: boolean;
  readonly providerId: string;
  readonly networkUsed: boolean | null;
  readonly reason: string;
}

export interface DistributedAppleClientView {
  readonly clientId: string;
  readonly platform: 'macos' | 'iphone' | 'ipad';
  readonly mode: 'read_only';
  readonly encryptedCacheRequired: true;
  readonly lastVerifiedSyncAt?: string;
  readonly stale: boolean;
  readonly independentSourceOfTruth: false;
  readonly coreServiceAuthorizationRequired: true;
  readonly atsExceptionAllowed: false;
  readonly secureEnclaveKeyRequired: true;
  readonly apnsPayloadContentFree: true;
  readonly pushDeliveryGuaranteed: false;
}

export interface DistributedBackupEvidenceView {
  readonly id: string;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly clusterId: string;
  readonly familyId: string;
  readonly backupSequence: number;
  readonly kind: 'local' | 'external' | 'offline' | 'offsite';
  readonly storageTargetId: string;
  readonly immutable: true;
  readonly independentFromReplica: true;
  readonly manifestSha256: string;
  readonly clusterStateEvidenceSha256: string;
  readonly sourceCommitIndex: number;
  readonly verifiedSizeBytes: number;
  readonly verifiedAt: string;
  readonly keyEpoch: number;
  readonly policyVersion: string;
  readonly providerId: string;
  readonly providerProductionVerified: boolean;
  readonly providerEvidenceSha256: string;
  readonly previousEvidenceSha256: string;
  readonly evidenceSha256: string;
  readonly restoreTested: false;
  readonly realDifferentDeviceRestoreVerified: false;
}

export interface DistributedUpdatePlanView {
  readonly id: string;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly clusterId: string;
  readonly familyId: string;
  readonly nodeOrder: readonly string[];
  readonly leaderLast: true;
  readonly nMinusOneCompatibilityRequired: true;
  readonly signedPackageRequired: true;
  readonly packageSignatureVerified: true;
  readonly rollbackRequired: true;
  readonly schemaMigrationLeaderAndQuorumOnly: true;
  readonly currentVersion: string;
  readonly targetVersion: string;
  readonly packageSha256: string;
  readonly clusterStateEvidenceSha256: string;
  readonly verifierId: string;
  readonly verifierProductionVerified: boolean;
  readonly signatureEvidenceSha256: string;
  readonly planSha256: string;
  readonly createdAt: string;
  readonly realUpdateExecuted: false;
}

export interface DistributedFaultEvidenceView {
  readonly id: string;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly clusterId: string;
  readonly familyId: string;
  readonly faultSequence: number;
  readonly scenario: DistributedFaultScenario;
  readonly syntheticOnly: true;
  readonly contained: boolean;
  readonly providerId: string;
  readonly providerEvidenceSha256: string;
  readonly previousEvidenceSha256: string;
  readonly evidenceSha256: string;
  readonly realWindowsNode: false;
  readonly createdAt: string;
}

export interface DistributedRecoveryProfileView {
  readonly profile: 'single_node' | 'three_node';
  readonly targetRpo: string;
  readonly targetRtoSeconds: number;
  readonly manualBreakGlassRequiresWarning: true;
  readonly recoveryQuorumRequired: true;
  readonly productionObjectiveOnly: true;
  readonly realDrillVerified: false;
}

export interface DistributedSyncBudgetView {
  readonly meteredNetworkAllowed: boolean;
  readonly batteryMinimumPercent: number;
  readonly uploadLimitKbps: number;
  readonly quietHoursStart: string;
  readonly quietHoursEnd: string;
  readonly metadataBeforeMedia: true;
}

export interface DistributedOperationsTruthView {
  readonly discoveryIsAddressHintNotTrust: true;
  readonly manualDiscoveryFallbackModeled: true;
  readonly exactContentFreeControlPlaneSchemaRequired: true;
  readonly remoteConnectivityDefaultDisabled: true;
  readonly outboundOnlyRelayOrUserVpnRequired: true;
  readonly controlPlaneContentProhibited: true;
  readonly providerNetworkUseEvidenceRequired: true;
  readonly productionProviderVerificationRequired: true;
  readonly durableOperationsEvidenceRequired: true;
  readonly appleClientsReadOnly: true;
  readonly coreServiceDenialCannotBeBypassed: true;
  readonly contentFreeWakeRequired: true;
  readonly atsExceptionsProhibited: true;
  readonly localFirstObservabilityContentFree: true;
  readonly replicaIsNotBackup: true;
  readonly immutableOfflineOffsiteBackupModeled: true;
  readonly breakGlassRecoveryModeled: true;
  readonly rollingUpdateOrderingModeled: true;
  readonly monotonicTimeRequired: true;
  readonly adaptiveSyncBudgetModeled: true;
  readonly faultInjectionMatrixModeled: true;
  readonly productionRuntimeComposed: false;
  readonly productionDiscoveryProviderConfigured: false;
  readonly productionRelayConfigured: false;
  readonly productionBackupVerifierConfigured: false;
  readonly productionUpdateVerifierConfigured: false;
  readonly appleApplicationBuilt: false;
  readonly realWindowsFaultMatrixExecuted: false;
  readonly realDifferentDeviceRestoreVerified: false;
  readonly networkUsedByCurrentProductionImplementation: false;
}

export const distributedOperationsTruth: DistributedOperationsTruthView = Object.freeze({
  discoveryIsAddressHintNotTrust: true,
  manualDiscoveryFallbackModeled: true,
  exactContentFreeControlPlaneSchemaRequired: true,
  remoteConnectivityDefaultDisabled: true,
  outboundOnlyRelayOrUserVpnRequired: true,
  controlPlaneContentProhibited: true,
  providerNetworkUseEvidenceRequired: true,
  productionProviderVerificationRequired: true,
  durableOperationsEvidenceRequired: true,
  appleClientsReadOnly: true,
  coreServiceDenialCannotBeBypassed: true,
  contentFreeWakeRequired: true,
  atsExceptionsProhibited: true,
  localFirstObservabilityContentFree: true,
  replicaIsNotBackup: true,
  immutableOfflineOffsiteBackupModeled: true,
  breakGlassRecoveryModeled: true,
  rollingUpdateOrderingModeled: true,
  monotonicTimeRequired: true,
  adaptiveSyncBudgetModeled: true,
  faultInjectionMatrixModeled: true,
  productionRuntimeComposed: false,
  productionDiscoveryProviderConfigured: false,
  productionRelayConfigured: false,
  productionBackupVerifierConfigured: false,
  productionUpdateVerifierConfigured: false,
  appleApplicationBuilt: false,
  realWindowsFaultMatrixExecuted: false,
  realDifferentDeviceRestoreVerified: false,
  networkUsedByCurrentProductionImplementation: false
});

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,255}$/u;
const CANONICAL_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export const isCanonicalDistributedIsoDateTime = (value: string): boolean => {
  if (!CANONICAL_ISO.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
};

export const isSafeDistributedIdentifier = (value: string): boolean => SAFE_ID.test(value);

export const isSafeDistributedAddressHint = (value: string): boolean => value === value.trim() && value.length >= 2 &&
  value.length <= 253 && /^[\x21-\x7e]+$/u.test(value) && !/[\\/@?#%]/u.test(value);

export const createDistributedDiscoveryCandidate = (input: {
  readonly nodeId: string;
  readonly addressHint: string;
  readonly mode: DistributedDiscoveryMode;
}): DistributedDiscoveryCandidateView => {
  if (!isSafeDistributedIdentifier(input.nodeId) || !isSafeDistributedAddressHint(input.addressHint) ||
    !['mdns', 'manual_ip', 'qr'].includes(input.mode)) {
    throw new Error('Distributed discovery candidate is invalid');
  }
  return Object.freeze({...input, trustedByDiscovery: false, requiresMtlsPairing: true});
};

export const distributedRemoteConnectivity = (input: {
  readonly enabled: boolean;
  readonly mode: 'outbound_relay' | 'user_vpn';
  readonly providerConfigured: boolean;
  readonly providerProductionVerified: boolean;
  readonly connected: boolean;
  readonly providerId: string;
  readonly networkUsed: boolean | null;
  readonly reason: string;
}): DistributedRemoteConnectivityView => Object.freeze({
  enabled: input.enabled,
  mode: input.enabled ? input.mode : 'disabled',
  inboundPortRequired: false,
  relayCanDecryptFamilyContent: false,
  deviceRevocationRequired: true,
  providerConfigured: input.providerConfigured,
  providerProductionVerified: input.providerProductionVerified,
  connected: input.enabled && input.connected,
  providerId: input.providerId,
  networkUsed: input.networkUsed,
  reason: input.reason
});

export const distributedAppleClient = (input: {
  readonly clientId: string;
  readonly platform: DistributedAppleClientView['platform'];
  readonly lastVerifiedSyncAt?: string;
  readonly nowMs: number;
  readonly staleAfterMs: number;
}): DistributedAppleClientView => {
  if (!isSafeDistributedIdentifier(input.clientId) || !Number.isSafeInteger(input.nowMs) || input.nowMs < 0 ||
    !Number.isSafeInteger(input.staleAfterMs) || input.staleAfterMs < 1 ||
    !['macos', 'iphone', 'ipad'].includes(input.platform) ||
    (input.lastVerifiedSyncAt !== undefined && !isCanonicalDistributedIsoDateTime(input.lastVerifiedSyncAt))) {
    throw new Error('Distributed Apple client view input is invalid');
  }
  const lastSyncMs = input.lastVerifiedSyncAt === undefined ? null : Date.parse(input.lastVerifiedSyncAt);
  return Object.freeze({
    clientId: input.clientId,
    platform: input.platform,
    mode: 'read_only',
    encryptedCacheRequired: true,
    ...(input.lastVerifiedSyncAt === undefined ? {} : {lastVerifiedSyncAt: input.lastVerifiedSyncAt}),
    stale: lastSyncMs === null || lastSyncMs > input.nowMs || input.nowMs - lastSyncMs > input.staleAfterMs,
    independentSourceOfTruth: false,
    coreServiceAuthorizationRequired: true,
    atsExceptionAllowed: false,
    secureEnclaveKeyRequired: true,
    apnsPayloadContentFree: true,
    pushDeliveryGuaranteed: false
  });
};

export const distributedRecoveryProfile = (profile: 'single_node' | 'three_node'): DistributedRecoveryProfileView =>
  Object.freeze({
    profile,
    targetRpo: profile === 'three_node' ? '0 committed events' : 'last verified backup',
    targetRtoSeconds: profile === 'three_node' ? 120 : 3600,
    manualBreakGlassRequiresWarning: true,
    recoveryQuorumRequired: true,
    productionObjectiveOnly: true,
    realDrillVerified: false
  });

const isDistributedLeaderRole = (value: string): boolean => value === 'leader';
const UPDATE_ROLES = new Set(['leader', 'follower', 'read_replica', 'witness', 'backup_only', 'maintenance']);

export const planDistributedRollingUpdate = (input: {
  readonly nodes: readonly {readonly nodeId: string; readonly role: string}[];
  readonly currentVersion: string;
  readonly targetVersion: string;
  readonly packageSha256: string;
  readonly packageSignatureVerified: boolean;
  readonly quorumHealthy: boolean;
}): Pick<DistributedUpdatePlanView, 'nodeOrder' | 'leaderLast' | 'nMinusOneCompatibilityRequired' |
  'signedPackageRequired' | 'packageSignatureVerified' | 'rollbackRequired' |
  'schemaMigrationLeaderAndQuorumOnly' | 'currentVersion' | 'targetVersion' | 'packageSha256' |
  'realUpdateExecuted'> => {
  if (input.nodes.length < 2 || input.nodes.length > 64 || !input.packageSignatureVerified || !input.quorumHealthy ||
    !isSafeDistributedIdentifier(input.currentVersion) || !isSafeDistributedIdentifier(input.targetVersion) ||
    input.currentVersion === input.targetVersion || !/^[0-9a-f]{64}$/u.test(input.packageSha256)) {
    throw new Error('Rolling update preconditions are not satisfied');
  }
  const ids = input.nodes.map(node => node.nodeId);
  if (new Set(ids).size !== ids.length || input.nodes.some(node =>
    !isSafeDistributedIdentifier(node.nodeId) || !UPDATE_ROLES.has(node.role))) {
    throw new Error('Rolling update node inventory is invalid');
  }
  const followers = input.nodes.filter(node => !isDistributedLeaderRole(node.role)).map(node => node.nodeId).sort();
  const leaders = input.nodes.filter(node => isDistributedLeaderRole(node.role)).map(node => node.nodeId);
  if (leaders.length !== 1) throw new Error('Rolling update requires exactly one leader');
  return Object.freeze({
    nodeOrder: Object.freeze([...followers, leaders[0]!]),
    leaderLast: true,
    nMinusOneCompatibilityRequired: true,
    signedPackageRequired: true,
    packageSignatureVerified: true,
    rollbackRequired: true,
    schemaMigrationLeaderAndQuorumOnly: true,
    currentVersion: input.currentVersion,
    targetVersion: input.targetVersion,
    packageSha256: input.packageSha256,
    realUpdateExecuted: false
  });
};

export const validateDistributedSyncBudget = (input: DistributedSyncBudgetView): boolean =>
  typeof input.meteredNetworkAllowed === 'boolean' && Number.isSafeInteger(input.batteryMinimumPercent) &&
  input.batteryMinimumPercent >= 10 && input.batteryMinimumPercent <= 100 &&
  Number.isSafeInteger(input.uploadLimitKbps) && input.uploadLimitKbps >= 64 && input.uploadLimitKbps <= 1_000_000 &&
  /^([01]\d|2[0-3]):[0-5]\d$/u.test(input.quietHoursStart) &&
  /^([01]\d|2[0-3]):[0-5]\d$/u.test(input.quietHoursEnd) &&
  input.quietHoursStart !== input.quietHoursEnd && input.metadataBeforeMedia === true;
