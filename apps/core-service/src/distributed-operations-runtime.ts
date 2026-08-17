import { createHash } from 'node:crypto';
import type {
  DistributedBackupEvidenceView,
  DistributedDiscoveryCandidateView,
  DistributedFaultEvidenceView,
  DistributedFaultScenario,
  DistributedRemoteConnectivityView,
  DistributedSyncBudgetView,
  DistributedUpdatePlanView
} from '@ppt/domain';
import {
  createDistributedDiscoveryCandidate,
  distributedRemoteConnectivity,
  isCanonicalDistributedIsoDateTime,
  isSafeDistributedIdentifier,
  planDistributedRollingUpdate,
  validateDistributedSyncBudget
} from '@ppt/domain';

export interface DistributedDiscoveryProviderPort {
  readonly configured: boolean;
  readonly productionVerified: boolean;
  readonly providerId: string;
  discover(input: {readonly clusterId: string; readonly familyId: string}): {
    readonly candidates: readonly {readonly nodeId: string; readonly addressHint: string}[];
    readonly networkUsed: boolean;
    readonly providerEvidenceSha256: string;
  };
}

export interface DistributedRelayProviderPort {
  readonly configured: boolean;
  readonly productionVerified: boolean;
  readonly providerId: string;
  connect(input: {
    readonly clusterId: string;
    readonly familyId: string;
    readonly deviceId: string;
    readonly mode: 'outbound_relay' | 'user_vpn';
    readonly outboundOnly: true;
    readonly encryptedEnvelopeOnly: true;
  }): {
    readonly connected: boolean;
    readonly connectionId?: string;
    readonly networkUsed: boolean;
    readonly providerEvidenceSha256?: string;
    readonly reason?: string;
  };
  disconnect(input: {readonly connectionId: string; readonly deviceId: string}): {
    readonly disconnected: boolean;
    readonly networkUsed: boolean;
    readonly providerEvidenceSha256?: string;
    readonly reason?: string;
  };
}

export interface DistributedClientAuthorizationPort {
  readonly configured: boolean;
  readonly productionVerified: boolean;
  readonly providerId: string;
  authorizeRead(input: {
    readonly clusterId: string;
    readonly familyId: string;
    readonly clientId: string;
    readonly deviceCertificateId: string;
    readonly policyVersion: string;
    readonly keyEpoch: number;
    readonly revocationEpoch: number;
    readonly resourceType: string;
    readonly resourceId: string;
  }): {
    readonly allowed: boolean;
    readonly decisionEvidenceSha256?: string;
    readonly networkUsed: boolean;
    readonly reason?: string;
  };
  authorizeRemoteConnection(input: {
    readonly clusterId: string;
    readonly familyId: string;
    readonly deviceId: string;
    readonly deviceCertificateId: string;
    readonly policyVersion: string;
    readonly keyEpoch: number;
    readonly revocationEpoch: number;
  }): {
    readonly allowed: boolean;
    readonly decisionEvidenceSha256?: string;
    readonly networkUsed: boolean;
    readonly reason?: string;
  };
}

export interface DistributedClusterStatePort {
  readonly productionVerified: boolean;
  current(input: {readonly clusterId: string; readonly familyId: string}): {
    readonly nodes: readonly {readonly nodeId: string; readonly role: string}[];
    readonly leaderNodeId: string;
    readonly quorumHealthy: boolean;
    readonly commitIndex: number;
    readonly evidenceSha256: string;
  };
}

export interface DistributedBackupVerificationProviderPort {
  readonly configured: boolean;
  readonly productionVerified: boolean;
  readonly providerId: string;
  verify(input: {
    readonly clusterId: string;
    readonly familyId: string;
    readonly kind: DistributedBackupEvidenceView['kind'];
    readonly manifestSha256: string;
    readonly sourceCommitIndex: number;
  }): {
    readonly verified: boolean;
    readonly immutable: boolean;
    readonly independentFromReplica: boolean;
    readonly manifestSha256: string;
    readonly storageTargetId?: string;
    readonly verifiedSizeBytes?: number;
    readonly providerEvidenceSha256?: string;
    readonly networkUsed: boolean;
    readonly reason?: string;
  };
}

export interface DistributedSignedUpdateVerifierPort {
  readonly configured: boolean;
  readonly productionVerified: boolean;
  readonly verifierId: string;
  verify(input: {
    readonly currentVersion: string;
    readonly targetVersion: string;
    readonly packageSha256: string;
  }): {
    readonly verified: boolean;
    readonly nMinusOneCompatible: boolean;
    readonly rollbackArtifactVerified: boolean;
    readonly signatureEvidenceSha256?: string;
    readonly reason?: string;
  };
}

export interface DistributedFaultInjectionPort {
  readonly syntheticOnly: true;
  readonly providerId: string;
  run(scenario: DistributedFaultScenario): {
    readonly contained: boolean;
    readonly evidenceSha256: string;
  };
}

export interface DistributedOperationsPersistencePort {
  findBackupByClientOperationId(clusterId:string,familyId:string,clientOperationId:string):DistributedBackupEvidenceView|null;
  lastBackup(clusterId: string, familyId: string): DistributedBackupEvidenceView | null;
  insertBackup(evidence: DistributedBackupEvidenceView): void;
  listBackups(clusterId: string, familyId: string, limit: number): readonly DistributedBackupEvidenceView[];
  findUpdatePlanByClientOperationId(clusterId:string,familyId:string,clientOperationId:string):DistributedUpdatePlanView|null;
  insertUpdatePlan(plan: DistributedUpdatePlanView): void;
  findFaultByClientOperationId(clusterId:string,familyId:string,clientOperationId:string):DistributedFaultEvidenceView|null;
  lastFault(clusterId: string, familyId: string): DistributedFaultEvidenceView | null;
  insertFault(evidence: DistributedFaultEvidenceView): void;
}

export interface DistributedDiscoveryDecision {
  readonly status: 'DISCOVERED' | 'NOT_CONFIGURED' | 'PROVIDER_UNVERIFIED' | 'PROVIDER_ERROR' | 'EVIDENCE_INVALID';
  readonly candidates: readonly DistributedDiscoveryCandidateView[];
  readonly providerId: string;
  readonly providerProductionVerified: boolean;
  readonly providerEvidenceSha256?: string;
  readonly networkUsed: boolean | null;
}

export interface DistributedAuthorizationDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly providerId: string;
  readonly providerProductionVerified: boolean;
  readonly decisionEvidenceSha256?: string;
  readonly networkUsed: boolean | null;
}

export interface DistributedBackupRegistrationDecision {
  readonly accepted: boolean;
  readonly reason: string;
  readonly replayed: boolean;
  readonly providerId: string;
  readonly providerProductionVerified: boolean;
  readonly networkUsed: boolean | null;
  readonly evidence?: DistributedBackupEvidenceView;
}

export interface DistributedUpdatePlanDecision {
  readonly accepted: boolean;
  readonly reason: string;
  readonly replayed: boolean;
  readonly verifierId: string;
  readonly verifierProductionVerified: boolean;
  readonly plan?: DistributedUpdatePlanView;
}

export interface DistributedFaultDecision {
  readonly accepted: boolean;
  readonly reason: string;
  readonly replayed: boolean;
  readonly evidence?: DistributedFaultEvidenceView;
}

const SHA = /^[0-9a-f]{64}$/u;
const SAFE_REASON = /^[A-Z][A-Z0-9_]{1,127}$/u;
const ZERO_SHA = '0'.repeat(64);

const safeInteger = (value: number, minimum = 0): boolean => Number.isSafeInteger(value) && value >= minimum;
const nonZeroSha=(value:string):boolean=>SHA.test(value)&&value!==ZERO_SHA;
const canonical = (value: Record<string, unknown>): string => JSON.stringify(
  Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
);
const hash = (value: Record<string, unknown>): string =>
  createHash('sha256').update(canonical(value), 'utf8').digest('hex');
const safeReason = (value: string | undefined, fallback: string): string =>
  value !== undefined && SAFE_REASON.test(value) ? value : fallback;

const isPlainDataRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.getOwnPropertySymbols(value).length !== 0) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(Object.getOwnPropertyDescriptors(value)).every(descriptor =>
    !('get' in descriptor) && !('set' in descriptor) && descriptor.enumerable === true
  );
};

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const validBackup = (value: DistributedBackupEvidenceView): boolean =>
  [value.id, value.clientOperationId, value.clusterId, value.familyId, value.storageTargetId,
    value.policyVersion, value.providerId].every(isSafeDistributedIdentifier) &&
  ['local', 'external', 'offline', 'offsite'].includes(value.kind) &&
  SHA.test(value.requestFingerprint)&&nonZeroSha(value.manifestSha256)&&
  nonZeroSha(value.clusterStateEvidenceSha256)&&nonZeroSha(value.providerEvidenceSha256)&&
  SHA.test(value.previousEvidenceSha256) && SHA.test(value.evidenceSha256) && safeInteger(value.backupSequence, 1) &&
  (value.backupSequence===1)===(value.previousEvidenceSha256===ZERO_SHA)&&
  safeInteger(value.sourceCommitIndex) && safeInteger(value.verifiedSizeBytes, 1) && safeInteger(value.keyEpoch, 1) &&
  isCanonicalDistributedIsoDateTime(value.verifiedAt) && value.immutable === true && value.independentFromReplica === true &&
  typeof value.providerProductionVerified === 'boolean' && value.restoreTested === false &&
  value.realDifferentDeviceRestoreVerified === false && hash({
    id: value.id, clientOperationId: value.clientOperationId, requestFingerprint: value.requestFingerprint,
    clusterId: value.clusterId, familyId: value.familyId, backupSequence: value.backupSequence, kind: value.kind,
    storageTargetId: value.storageTargetId, immutable: value.immutable,
    independentFromReplica: value.independentFromReplica, manifestSha256: value.manifestSha256,
    clusterStateEvidenceSha256: value.clusterStateEvidenceSha256,
    sourceCommitIndex: value.sourceCommitIndex, verifiedSizeBytes: value.verifiedSizeBytes,
    verifiedAt: value.verifiedAt, keyEpoch: value.keyEpoch, policyVersion: value.policyVersion,
    providerId: value.providerId, providerProductionVerified: value.providerProductionVerified,
    providerEvidenceSha256: value.providerEvidenceSha256, previousEvidenceSha256: value.previousEvidenceSha256,
    restoreTested: value.restoreTested, realDifferentDeviceRestoreVerified: value.realDifferentDeviceRestoreVerified
  }) === value.evidenceSha256;

const validUpdatePlan = (value: DistributedUpdatePlanView): boolean =>
  [value.id, value.clientOperationId, value.clusterId, value.familyId, value.currentVersion,
    value.targetVersion, value.verifierId].every(isSafeDistributedIdentifier) && SHA.test(value.requestFingerprint) &&
  nonZeroSha(value.packageSha256)&&nonZeroSha(value.clusterStateEvidenceSha256)&&
  nonZeroSha(value.signatureEvidenceSha256)&&SHA.test(value.planSha256)&&
  isCanonicalDistributedIsoDateTime(value.createdAt) && value.nodeOrder.length >= 2 && value.nodeOrder.length <= 64 &&
  new Set(value.nodeOrder).size === value.nodeOrder.length && value.nodeOrder.every(isSafeDistributedIdentifier) &&
  value.leaderLast === true && value.nMinusOneCompatibilityRequired === true && value.signedPackageRequired === true &&
  value.packageSignatureVerified === true && value.rollbackRequired === true &&
  value.schemaMigrationLeaderAndQuorumOnly === true && typeof value.verifierProductionVerified === 'boolean' &&
  value.realUpdateExecuted === false &&
  hash({
    id: value.id, clientOperationId: value.clientOperationId, requestFingerprint: value.requestFingerprint,
    clusterId: value.clusterId, familyId: value.familyId, nodeOrder: value.nodeOrder,
    leaderLast: value.leaderLast, nMinusOneCompatibilityRequired: value.nMinusOneCompatibilityRequired,
    signedPackageRequired: value.signedPackageRequired, packageSignatureVerified: value.packageSignatureVerified,
    rollbackRequired: value.rollbackRequired,
    schemaMigrationLeaderAndQuorumOnly: value.schemaMigrationLeaderAndQuorumOnly,
    currentVersion: value.currentVersion, targetVersion: value.targetVersion, packageSha256: value.packageSha256,
    clusterStateEvidenceSha256: value.clusterStateEvidenceSha256, verifierId: value.verifierId,
    verifierProductionVerified: value.verifierProductionVerified,
    signatureEvidenceSha256: value.signatureEvidenceSha256, createdAt: value.createdAt,
    realUpdateExecuted: value.realUpdateExecuted
  }) === value.planSha256;

const validFault = (value: DistributedFaultEvidenceView): boolean =>
  [value.id, value.clientOperationId, value.clusterId, value.familyId, value.providerId].every(isSafeDistributedIdentifier) &&
  SHA.test(value.requestFingerprint)&&nonZeroSha(value.providerEvidenceSha256)&&
  SHA.test(value.previousEvidenceSha256) && SHA.test(value.evidenceSha256) &&
  (value.faultSequence===1)===(value.previousEvidenceSha256===ZERO_SHA)&&
  safeInteger(value.faultSequence, 1) && isCanonicalDistributedIsoDateTime(value.createdAt) &&
  ['network_partition', 'power_loss', 'disk_full', 'corruption', 'clock_skew',
    'certificate_expiry', 'rolling_update'].includes(value.scenario) &&
  value.syntheticOnly === true && typeof value.contained === 'boolean' && value.realWindowsNode === false && hash({
    id: value.id, clientOperationId: value.clientOperationId, requestFingerprint: value.requestFingerprint,
    clusterId: value.clusterId, familyId: value.familyId, faultSequence: value.faultSequence,
    scenario: value.scenario, syntheticOnly: value.syntheticOnly, contained: value.contained,
    providerId: value.providerId, providerEvidenceSha256: value.providerEvidenceSha256,
    previousEvidenceSha256: value.previousEvidenceSha256, realWindowsNode: value.realWindowsNode,
    createdAt: value.createdAt
  }) === value.evidenceSha256;

export const unavailableDistributedDiscoveryProvider: DistributedDiscoveryProviderPort = Object.freeze({
  configured: false,
  productionVerified: false,
  providerId: 'unavailable-discovery-provider',
  discover: () => ({candidates: Object.freeze([]), networkUsed: false, providerEvidenceSha256: ZERO_SHA})
});

export const unavailableDistributedRelayProvider: DistributedRelayProviderPort = Object.freeze({
  configured: false,
  productionVerified: false,
  providerId: 'unavailable-relay-provider',
  connect: () => ({connected: false, networkUsed: false, reason: 'RELAY_NOT_CONFIGURED'}),
  disconnect: () => ({disconnected: false, networkUsed: false, reason: 'RELAY_NOT_CONFIGURED'})
});

export const denyAllDistributedClientAuthorization: DistributedClientAuthorizationPort = Object.freeze({
  configured: false,
  productionVerified: false,
  providerId: 'deny-all-client-authorization',
  authorizeRead: () => ({allowed: false, networkUsed: false, reason: 'AUTHORIZATION_NOT_CONFIGURED'}),
  authorizeRemoteConnection: () => ({allowed: false, networkUsed: false, reason: 'AUTHORIZATION_NOT_CONFIGURED'})
});

export const unavailableDistributedClusterState: DistributedClusterStatePort = Object.freeze({
  productionVerified: false,
  current: () => ({nodes: Object.freeze([]), leaderNodeId: 'unavailable-leader', quorumHealthy: false,
    commitIndex: 0, evidenceSha256: ZERO_SHA})
});

export const unavailableDistributedBackupVerifier: DistributedBackupVerificationProviderPort = Object.freeze({
  configured: false,
  productionVerified: false,
  providerId: 'unavailable-backup-verifier',
  verify: (input: Parameters<DistributedBackupVerificationProviderPort['verify']>[0]) =>
    ({verified: false, immutable: false, independentFromReplica: false,
    manifestSha256: input.manifestSha256, networkUsed: false, reason: 'BACKUP_VERIFIER_NOT_CONFIGURED'})
});

export const unavailableDistributedUpdateVerifier: DistributedSignedUpdateVerifierPort = Object.freeze({
  configured: false,
  productionVerified: false,
  verifierId: 'unavailable-update-verifier',
  verify:()=>({verified:false,nMinusOneCompatible:false,rollbackArtifactVerified:false,
    reason:'UPDATE_VERIFIER_NOT_CONFIGURED'})
});

export class DistributedOperationsRuntime {
  #lastMonotonic: number | null = null;

  public constructor(private readonly options: {
    readonly clusterId: string;
    readonly familyId: string;
    readonly policyVersion: string;
    readonly keyEpoch: number;
    readonly revocationEpoch: number;
    readonly discovery: DistributedDiscoveryProviderPort;
    readonly relay: DistributedRelayProviderPort;
    readonly authorization: DistributedClientAuthorizationPort;
    readonly clusterState: DistributedClusterStatePort;
    readonly backupVerifier: DistributedBackupVerificationProviderPort;
    readonly updateVerifier: DistributedSignedUpdateVerifierPort;
    readonly persistence: DistributedOperationsPersistencePort;
    readonly faultInjection?: DistributedFaultInjectionPort;
    readonly allowUnverifiedProvidersForTests?: boolean;
    readonly allowSyntheticFaultProviderForTests?: boolean;
  }) {
    if (![options.clusterId, options.familyId, options.policyVersion].every(isSafeDistributedIdentifier) ||
      !safeInteger(options.keyEpoch, 1) || !safeInteger(options.revocationEpoch)) {
      throw new Error('Distributed operations identity is invalid');
    }
    const providerIds = [options.discovery.providerId, options.relay.providerId, options.authorization.providerId,
      options.backupVerifier.providerId, options.updateVerifier.verifierId,
      ...(options.faultInjection ? [options.faultInjection.providerId] : [])];
    if (!providerIds.every(isSafeDistributedIdentifier)) throw new Error('Distributed operations provider identity is invalid');
  }

  public discover(): DistributedDiscoveryDecision {
    const provider = this.options.discovery;
    if (!provider.configured) return Object.freeze({status: 'NOT_CONFIGURED', candidates: Object.freeze([]),
      providerId: provider.providerId, providerProductionVerified: provider.productionVerified, networkUsed: false});
    if (!provider.productionVerified && this.options.allowUnverifiedProvidersForTests !== true) {
      return Object.freeze({status: 'PROVIDER_UNVERIFIED', candidates: Object.freeze([]),
        providerId: provider.providerId, providerProductionVerified: false, networkUsed: false});
    }
    try {
      const result = provider.discover({clusterId: this.options.clusterId, familyId: this.options.familyId});
      if (!Array.isArray(result.candidates) || result.candidates.length > 64 || typeof result.networkUsed !== 'boolean' ||
        !nonZeroSha(result.providerEvidenceSha256)) {
        return Object.freeze({status: 'EVIDENCE_INVALID', candidates: Object.freeze([]), providerId: provider.providerId,
          providerProductionVerified: provider.productionVerified, networkUsed: typeof result.networkUsed === 'boolean' ? result.networkUsed : null});
      }
      const candidates = result.candidates.map(candidate => {
        if (!isPlainDataRecord(candidate) || !exactKeys(candidate, ['addressHint', 'nodeId']) ||
          typeof candidate.nodeId !== 'string' || typeof candidate.addressHint !== 'string') {
          throw new Error('Discovery candidate schema is invalid');
        }
        return createDistributedDiscoveryCandidate({nodeId: candidate.nodeId, addressHint: candidate.addressHint, mode: 'mdns'});
      });
      if (new Set(candidates.map(candidate => candidate.nodeId)).size !== candidates.length) throw new Error('Duplicate discovery node');
      return Object.freeze({status: 'DISCOVERED', candidates: Object.freeze(candidates), providerId: provider.providerId,
        providerProductionVerified: provider.productionVerified, providerEvidenceSha256: result.providerEvidenceSha256,
        networkUsed: result.networkUsed});
    } catch {
      return Object.freeze({status: 'PROVIDER_ERROR', candidates: Object.freeze([]), providerId: provider.providerId,
        providerProductionVerified: provider.productionVerified, networkUsed: null});
    }
  }

  public manualCandidate(input: {
    readonly nodeId: string;
    readonly addressHint: string;
    readonly mode: 'manual_ip' | 'qr';
  }): DistributedDiscoveryCandidateView {
    return createDistributedDiscoveryCandidate(input);
  }

  public remotePolicy(enabled: boolean, mode: 'outbound_relay' | 'user_vpn'): DistributedRemoteConnectivityView {
    if (typeof enabled !== 'boolean' || !['outbound_relay', 'user_vpn'].includes(mode)) {
      throw new Error('Distributed remote policy input is invalid');
    }
    return distributedRemoteConnectivity({enabled, mode, providerConfigured: this.options.relay.configured,
      providerProductionVerified: this.options.relay.productionVerified, connected: false,
      providerId: this.options.relay.providerId, networkUsed: false,
      reason: enabled ? 'CONNECTION_NOT_ATTEMPTED' : 'REMOTE_DISABLED'});
  }

  public connectRemote(input: {
    readonly enabled: boolean;
    readonly mode: 'outbound_relay' | 'user_vpn';
    readonly deviceId: string;
    readonly deviceCertificateId: string;
  }): DistributedRemoteConnectivityView {
    const provider = this.options.relay;
    if (typeof input.enabled !== 'boolean' || !['outbound_relay', 'user_vpn'].includes(input.mode)) {
      return distributedRemoteConnectivity({enabled: false, mode: 'outbound_relay', providerConfigured: provider.configured,
        providerProductionVerified: provider.productionVerified, connected: false, providerId: provider.providerId,
        networkUsed: false, reason: 'REMOTE_INPUT_INVALID'});
    }
    const base = {enabled: input.enabled, mode: input.mode, providerConfigured: provider.configured,
      providerProductionVerified: provider.productionVerified, connected: false, providerId: provider.providerId};
    if (!input.enabled) return distributedRemoteConnectivity({...base, networkUsed: false, reason: 'REMOTE_DISABLED'});
    if (![input.deviceId, input.deviceCertificateId].every(isSafeDistributedIdentifier)) {
      return distributedRemoteConnectivity({...base, networkUsed: false, reason: 'REMOTE_INPUT_INVALID'});
    }
    if (!provider.configured) return distributedRemoteConnectivity({...base, networkUsed: false, reason: 'RELAY_NOT_CONFIGURED'});
    if (!provider.productionVerified && this.options.allowUnverifiedProvidersForTests !== true) {
      return distributedRemoteConnectivity({...base, networkUsed: false, reason: 'RELAY_PROVIDER_UNVERIFIED'});
    }
    if (!this.options.authorization.configured || (!this.options.authorization.productionVerified &&
      this.options.allowUnverifiedProvidersForTests !== true)) {
      return distributedRemoteConnectivity({...base, networkUsed: false, reason: 'AUTHORIZATION_PROVIDER_UNVERIFIED'});
    }
    try {
      const authorization = this.options.authorization.authorizeRemoteConnection({clusterId: this.options.clusterId,
        familyId: this.options.familyId, deviceId: input.deviceId, deviceCertificateId: input.deviceCertificateId,
        policyVersion: this.options.policyVersion, keyEpoch: this.options.keyEpoch, revocationEpoch: this.options.revocationEpoch});
      if (typeof authorization.networkUsed !== 'boolean'||!authorization.decisionEvidenceSha256
        ||!nonZeroSha(authorization.decisionEvidenceSha256)||authorization.allowed!==true) {
        return distributedRemoteConnectivity({...base, networkUsed: typeof authorization.networkUsed === 'boolean' ?
          authorization.networkUsed : null, reason: safeReason(authorization.reason, 'REMOTE_AUTHORIZATION_DENIED')});
      }
      const result = provider.connect({clusterId: this.options.clusterId, familyId: this.options.familyId,
        deviceId: input.deviceId, mode: input.mode, outboundOnly: true, encryptedEnvelopeOnly: true});
      if (typeof result.networkUsed!=='boolean'||typeof result.connected!=='boolean'||!result.providerEvidenceSha256
        ||!nonZeroSha(result.providerEvidenceSha256)||(result.connected&&(!result.connectionId
          ||!isSafeDistributedIdentifier(result.connectionId)))) {
        return distributedRemoteConnectivity({...base, networkUsed: typeof result.networkUsed === 'boolean' ?
          result.networkUsed || authorization.networkUsed : null, reason: 'RELAY_EVIDENCE_INVALID'});
      }
      return distributedRemoteConnectivity({...base, connected: result.connected,
        networkUsed: result.networkUsed || authorization.networkUsed,
        reason: result.connected ? 'CONNECTED' : safeReason(result.reason, 'CONNECTION_REJECTED')});
    } catch {
      return distributedRemoteConnectivity({...base, networkUsed: null, reason: 'RELAY_PROVIDER_ERROR'});
    }
  }

  public disconnectRemote(input: {readonly connectionId: string; readonly deviceId: string}): DistributedRemoteConnectivityView {
    const provider = this.options.relay;
    const base = {enabled: false, mode: 'outbound_relay' as const, providerConfigured: provider.configured,
      providerProductionVerified: provider.productionVerified, connected: false, providerId: provider.providerId};
    if (![input.connectionId, input.deviceId].every(isSafeDistributedIdentifier) || !provider.configured ||
      (!provider.productionVerified && this.options.allowUnverifiedProvidersForTests !== true)) {
      return distributedRemoteConnectivity({...base, networkUsed: false, reason: 'DISCONNECT_INPUT_OR_PROVIDER_INVALID'});
    }
    try {
      const result = provider.disconnect(input);
      const evidenceValid=typeof result.networkUsed==='boolean'&&typeof result.disconnected==='boolean'
        &&!!result.providerEvidenceSha256&&nonZeroSha(result.providerEvidenceSha256);
      return distributedRemoteConnectivity({...base, networkUsed: evidenceValid ? result.networkUsed : null,
        reason: evidenceValid && result.disconnected ? 'DISCONNECTED' : safeReason(result.reason, 'DISCONNECT_FAILED')});
    } catch {
      return distributedRemoteConnectivity({...base, networkUsed: null, reason: 'RELAY_PROVIDER_ERROR'});
    }
  }

  public authorizeAppleRead(input: {
    readonly clientId: string;
    readonly deviceCertificateId: string;
    readonly resourceType: string;
    readonly resourceId: string;
  }): DistributedAuthorizationDecision {
    const provider = this.options.authorization;
    const base = {providerId: provider.providerId, providerProductionVerified: provider.productionVerified};
    if (![input.clientId, input.deviceCertificateId, input.resourceType, input.resourceId].every(isSafeDistributedIdentifier)) {
      return Object.freeze({allowed: false, reason: 'AUTHORIZATION_INPUT_INVALID', ...base, networkUsed: false});
    }
    if (!provider.configured || (!provider.productionVerified && this.options.allowUnverifiedProvidersForTests !== true)) {
      return Object.freeze({allowed: false, reason: 'AUTHORIZATION_PROVIDER_UNVERIFIED', ...base, networkUsed: false});
    }
    try {
      const result = provider.authorizeRead({clusterId: this.options.clusterId, familyId: this.options.familyId,
        policyVersion: this.options.policyVersion, keyEpoch: this.options.keyEpoch, revocationEpoch: this.options.revocationEpoch,
        ...input});
      if (typeof result.allowed !== 'boolean' || typeof result.networkUsed !== 'boolean' ||
        !result.decisionEvidenceSha256||!nonZeroSha(result.decisionEvidenceSha256)) {
        return Object.freeze({allowed: false, reason: 'AUTHORIZATION_EVIDENCE_INVALID', ...base,
          networkUsed: typeof result.networkUsed === 'boolean' ? result.networkUsed : null});
      }
      return Object.freeze({allowed: result.allowed, reason: result.allowed ? 'AUTHORIZED' :
        safeReason(result.reason, 'AUTHORIZATION_DENIED'), ...base,
        decisionEvidenceSha256: result.decisionEvidenceSha256, networkUsed: result.networkUsed});
    } catch {
      return Object.freeze({allowed: false, reason: 'AUTHORIZATION_PROVIDER_ERROR', ...base, networkUsed: null});
    }
  }

  public validateControlPlaneEnvelope(value: unknown): boolean {
    if (!isPlainDataRecord(value) || typeof value.kind !== 'string') return false;
    const common = ['clusterId', 'kind', 'nodeId', 'occurredAt'];
    const specific: Record<string, readonly string[]> = {
      rendezvous: ['encryptedEnvelopeSha256'], certificate_revocation: ['certificateRevocationEpoch'],
      apns_wake: ['wakeTokenSha256'], witness_vote: ['witnessVote'], health: ['healthState']
    };
    const kindKeys = specific[value.kind];
    if (!kindKeys || !exactKeys(value, [...common, ...kindKeys]) || typeof value.clusterId !== 'string' ||
      typeof value.nodeId !== 'string' || typeof value.occurredAt !== 'string' ||
      !isSafeDistributedIdentifier(value.clusterId)||value.clusterId!==this.options.clusterId
      ||!isSafeDistributedIdentifier(value.nodeId) ||
      !isCanonicalDistributedIsoDateTime(value.occurredAt)) return false;
    switch (value.kind) {
      case 'rendezvous': return typeof value.encryptedEnvelopeSha256==='string'&&nonZeroSha(value.encryptedEnvelopeSha256);
      case 'certificate_revocation': return typeof value.certificateRevocationEpoch === 'number' &&
        safeInteger(value.certificateRevocationEpoch)&&value.certificateRevocationEpoch>=this.options.revocationEpoch;
      case 'apns_wake': return typeof value.wakeTokenSha256==='string'&&nonZeroSha(value.wakeTokenSha256);
      case 'witness_vote': return typeof value.witnessVote === 'boolean';
      case 'health': return typeof value.healthState === 'string' && ['healthy', 'degraded', 'unhealthy'].includes(value.healthState);
      default: return false;
    }
  }

  public verifyAndRegisterBackup(input: {
    readonly id: string;
    readonly clientOperationId: string;
    readonly kind: DistributedBackupEvidenceView['kind'];
    readonly manifestSha256: string;
    readonly sourceCommitIndex: number;
    readonly verifiedAt: string;
  }): DistributedBackupRegistrationDecision {
    const provider = this.options.backupVerifier;
    const baseDecision = {providerId: provider.providerId, providerProductionVerified: provider.productionVerified};
    if (![input.id, input.clientOperationId].every(isSafeDistributedIdentifier) ||
      !['local', 'external', 'offline', 'offsite'].includes(input.kind) || !SHA.test(input.manifestSha256) ||
      !safeInteger(input.sourceCommitIndex,1)||input.manifestSha256===ZERO_SHA
      ||!isCanonicalDistributedIsoDateTime(input.verifiedAt)) {
      return Object.freeze({accepted: false, reason: 'BACKUP_INPUT_INVALID', replayed: false, ...baseDecision, networkUsed: false});
    }
    const requestFingerprint = hash({...input, clusterId: this.options.clusterId, familyId: this.options.familyId,
      policyVersion: this.options.policyVersion, keyEpoch: this.options.keyEpoch});
    try {
      const replay=this.options.persistence.findBackupByClientOperationId(this.options.clusterId,this.options.familyId,
        input.clientOperationId);
      if (replay) {
        if (!validBackup(replay) || replay.requestFingerprint !== requestFingerprint || replay.id !== input.id ||
          replay.clusterId !== this.options.clusterId || replay.familyId !== this.options.familyId) {
          return Object.freeze({accepted: false, reason: 'BACKUP_IDEMPOTENCY_MISMATCH', replayed: false,
            ...baseDecision, networkUsed: false});
        }
        return Object.freeze({accepted: true, reason: 'BACKUP_REPLAYED', replayed: true, providerId: replay.providerId,
          providerProductionVerified: replay.providerProductionVerified, networkUsed: false, evidence: replay});
      }
    } catch {
      return Object.freeze({accepted: false, reason: 'BACKUP_PERSISTENCE_READ_FAILED', replayed: false,
        ...baseDecision, networkUsed: false});
    }
    if (!provider.configured) return Object.freeze({accepted: false, reason: 'BACKUP_VERIFIER_NOT_CONFIGURED',
      replayed: false, ...baseDecision, networkUsed: false});
    if (!provider.productionVerified && this.options.allowUnverifiedProvidersForTests !== true) {
      return Object.freeze({accepted: false, reason: 'BACKUP_VERIFIER_UNVERIFIED', replayed: false,
        ...baseDecision, networkUsed: false});
    }
    let clusterState: ReturnType<DistributedClusterStatePort['current']>;
    try {
      clusterState = this.options.clusterState.current({clusterId: this.options.clusterId, familyId: this.options.familyId});
    } catch {
      return Object.freeze({accepted: false, reason: 'CLUSTER_STATE_UNAVAILABLE', replayed: false,
        ...baseDecision, networkUsed: false});
    }
    if ((!this.options.clusterState.productionVerified && this.options.allowUnverifiedProvidersForTests !== true) ||
      !safeInteger(clusterState.commitIndex) || input.sourceCommitIndex > clusterState.commitIndex ||
      !nonZeroSha(clusterState.evidenceSha256)) {
      return Object.freeze({accepted: false, reason: 'CLUSTER_STATE_UNVERIFIED', replayed: false,
        ...baseDecision, networkUsed: false});
    }
    try {
      const verified = provider.verify({clusterId: this.options.clusterId, familyId: this.options.familyId,
        kind: input.kind, manifestSha256: input.manifestSha256, sourceCommitIndex: input.sourceCommitIndex});
      if (typeof verified.networkUsed !== 'boolean' || verified.verified !== true || verified.immutable !== true ||
        verified.independentFromReplica !== true || verified.manifestSha256 !== input.manifestSha256 ||
        !verified.storageTargetId || !isSafeDistributedIdentifier(verified.storageTargetId) ||
        !safeInteger(verified.verifiedSizeBytes ?? -1, 1) || !verified.providerEvidenceSha256 ||
        !nonZeroSha(verified.providerEvidenceSha256)) {
        return Object.freeze({accepted: false, reason: safeReason(verified.reason, 'BACKUP_EVIDENCE_INVALID'),
          replayed: false, ...baseDecision, networkUsed: verified.networkUsed});
      }
      const previous = this.options.persistence.lastBackup(this.options.clusterId, this.options.familyId);
      if (previous && (!validBackup(previous) || previous.clusterId !== this.options.clusterId ||
        previous.familyId !== this.options.familyId)) {
        return Object.freeze({accepted: false, reason: 'BACKUP_CHAIN_INVALID', replayed: false,
          ...baseDecision, networkUsed: verified.networkUsed});
      }
      const evidenceBase = {
        id: input.id, clientOperationId: input.clientOperationId, requestFingerprint,
        clusterId: this.options.clusterId, familyId: this.options.familyId,
        backupSequence: (previous?.backupSequence ?? 0) + 1, kind: input.kind,
        storageTargetId: verified.storageTargetId, immutable: true as const, independentFromReplica: true as const,
        manifestSha256: input.manifestSha256, clusterStateEvidenceSha256: clusterState.evidenceSha256,
        sourceCommitIndex: input.sourceCommitIndex,
        verifiedSizeBytes: verified.verifiedSizeBytes!, verifiedAt: input.verifiedAt, keyEpoch: this.options.keyEpoch,
        policyVersion: this.options.policyVersion, providerId: provider.providerId,
        providerProductionVerified: provider.productionVerified, providerEvidenceSha256: verified.providerEvidenceSha256,
        previousEvidenceSha256: previous?.evidenceSha256 ?? ZERO_SHA, restoreTested: false as const,
        realDifferentDeviceRestoreVerified: false as const
      };
      const evidence = Object.freeze({...evidenceBase, evidenceSha256: hash(evidenceBase)});
      this.options.persistence.insertBackup(evidence);
      return Object.freeze({accepted: true, reason: 'BACKUP_VERIFIED_AND_RECORDED', replayed: false,
        ...baseDecision, networkUsed: verified.networkUsed, evidence});
    } catch {
      return Object.freeze({accepted: false, reason: 'BACKUP_PROVIDER_OR_PERSISTENCE_ERROR', replayed: false,
        ...baseDecision, networkUsed: null});
    }
  }

  public backups(limit = 100): readonly DistributedBackupEvidenceView[] {
    if (!safeInteger(limit, 1) || limit > 256) throw new Error('Backup list limit is invalid');
    const values = this.options.persistence.listBackups(this.options.clusterId, this.options.familyId, limit);
    if (!Array.isArray(values) || values.length > limit || values.some(value => !validBackup(value) ||
      value.clusterId !== this.options.clusterId || value.familyId !== this.options.familyId)) {
      throw new Error('Persisted backup evidence is invalid');
    }
    return Object.freeze([...values]);
  }

  public createRollingUpdatePlan(input: {
    readonly id: string;
    readonly clientOperationId: string;
    readonly currentVersion: string;
    readonly targetVersion: string;
    readonly packageSha256: string;
    readonly createdAt: string;
  }): DistributedUpdatePlanDecision {
    const verifier = this.options.updateVerifier;
    const baseDecision = {verifierId: verifier.verifierId, verifierProductionVerified: verifier.productionVerified};
    if (![input.id, input.clientOperationId, input.currentVersion, input.targetVersion].every(isSafeDistributedIdentifier) ||
      input.currentVersion === input.targetVersion || !SHA.test(input.packageSha256) ||
      !isCanonicalDistributedIsoDateTime(input.createdAt)) {
      return Object.freeze({accepted: false, reason: 'UPDATE_INPUT_INVALID', replayed: false, ...baseDecision});
    }
    const requestFingerprint = hash({...input, clusterId: this.options.clusterId, familyId: this.options.familyId});
    try {
      const replay=this.options.persistence.findUpdatePlanByClientOperationId(this.options.clusterId,this.options.familyId,
        input.clientOperationId);
      if (replay) {
        if (!validUpdatePlan(replay) || replay.requestFingerprint !== requestFingerprint || replay.id !== input.id ||
          replay.clusterId !== this.options.clusterId || replay.familyId !== this.options.familyId) {
          return Object.freeze({accepted: false, reason: 'UPDATE_IDEMPOTENCY_MISMATCH', replayed: false, ...baseDecision});
        }
        return Object.freeze({accepted: true, reason: 'UPDATE_PLAN_REPLAYED', replayed: true,
          verifierId: replay.verifierId, verifierProductionVerified: replay.verifierProductionVerified, plan: replay});
      }
    } catch {
      return Object.freeze({accepted: false, reason: 'UPDATE_PERSISTENCE_READ_FAILED', replayed: false, ...baseDecision});
    }
    if (!verifier.configured || (!verifier.productionVerified && this.options.allowUnverifiedProvidersForTests !== true)) {
      return Object.freeze({accepted: false, reason: verifier.configured ? 'UPDATE_VERIFIER_UNVERIFIED' :
        'UPDATE_VERIFIER_NOT_CONFIGURED', replayed: false, ...baseDecision});
    }
    try {
      const clusterState = this.options.clusterState.current({clusterId: this.options.clusterId, familyId: this.options.familyId});
      if ((!this.options.clusterState.productionVerified && this.options.allowUnverifiedProvidersForTests !== true) ||
        !clusterState.quorumHealthy||!nonZeroSha(clusterState.evidenceSha256) ||
        !isSafeDistributedIdentifier(clusterState.leaderNodeId) || !safeInteger(clusterState.commitIndex)) {
        return Object.freeze({accepted: false, reason: 'CLUSTER_STATE_UNVERIFIED', replayed: false, ...baseDecision});
      }
      const signature = verifier.verify({currentVersion: input.currentVersion, targetVersion: input.targetVersion,
        packageSha256: input.packageSha256});
      if (signature.verified!==true||signature.nMinusOneCompatible!==true||signature.rollbackArtifactVerified!==true
        ||!signature.signatureEvidenceSha256||!nonZeroSha(signature.signatureEvidenceSha256)) {
        return Object.freeze({accepted: false, reason: safeReason(signature.reason, 'UPDATE_SIGNATURE_INVALID'),
          replayed: false, ...baseDecision});
      }
      const ordered = planDistributedRollingUpdate({nodes: clusterState.nodes, currentVersion: input.currentVersion,
        targetVersion: input.targetVersion, packageSha256: input.packageSha256,
        packageSignatureVerified: true, quorumHealthy: clusterState.quorumHealthy});
      if (ordered.nodeOrder.at(-1) !== clusterState.leaderNodeId) {
        return Object.freeze({accepted: false, reason: 'CLUSTER_LEADER_ORDER_MISMATCH', replayed: false, ...baseDecision});
      }
      const planBase = {
        id: input.id, clientOperationId: input.clientOperationId, requestFingerprint,
        clusterId: this.options.clusterId, familyId: this.options.familyId, ...ordered,
        clusterStateEvidenceSha256: clusterState.evidenceSha256, verifierId: verifier.verifierId,
        verifierProductionVerified: verifier.productionVerified, signatureEvidenceSha256: signature.signatureEvidenceSha256,
        createdAt: input.createdAt
      };
      const plan = Object.freeze({...planBase, planSha256: hash(planBase)});
      this.options.persistence.insertUpdatePlan(plan);
      return Object.freeze({accepted: true, reason: 'UPDATE_PLAN_VERIFIED_AND_RECORDED', replayed: false,
        ...baseDecision, plan});
    } catch {
      return Object.freeze({accepted: false, reason: 'UPDATE_PROVIDER_OR_PERSISTENCE_ERROR', replayed: false, ...baseDecision});
    }
  }

  public observeMonotonic(timestamp: number): boolean {
    if (!safeInteger(timestamp) || (this.#lastMonotonic !== null && timestamp <= this.#lastMonotonic)) return false;
    this.#lastMonotonic = timestamp;
    return true;
  }

  public setSyncBudget(input: DistributedSyncBudgetView): DistributedSyncBudgetView {
    if (!validateDistributedSyncBudget(input)) throw new Error('Distributed sync budget is invalid');
    return Object.freeze({...input});
  }

  public runSyntheticFault(input: {
    readonly id: string;
    readonly clientOperationId: string;
    readonly scenario: DistributedFaultScenario;
    readonly createdAt: string;
  }): DistributedFaultDecision {
    if (![input.id, input.clientOperationId].every(isSafeDistributedIdentifier) ||
      !['network_partition', 'power_loss', 'disk_full', 'corruption', 'clock_skew',
        'certificate_expiry', 'rolling_update'].includes(input.scenario) ||
      !isCanonicalDistributedIsoDateTime(input.createdAt)) {
      return Object.freeze({accepted: false, reason: 'FAULT_INPUT_INVALID', replayed: false});
    }
    const requestFingerprint = hash({...input, clusterId: this.options.clusterId, familyId: this.options.familyId});
    try {
      const replay=this.options.persistence.findFaultByClientOperationId(this.options.clusterId,this.options.familyId,
        input.clientOperationId);
      if (replay) {
        if (!validFault(replay) || replay.requestFingerprint !== requestFingerprint || replay.id !== input.id ||
          replay.clusterId !== this.options.clusterId || replay.familyId !== this.options.familyId) {
          return Object.freeze({accepted: false, reason: 'FAULT_IDEMPOTENCY_MISMATCH', replayed: false});
        }
        return Object.freeze({accepted: true, reason: 'FAULT_EVIDENCE_REPLAYED', replayed: true, evidence: replay});
      }
    } catch {
      return Object.freeze({accepted: false, reason: 'FAULT_PERSISTENCE_READ_FAILED', replayed: false});
    }
    const provider = this.options.faultInjection;
    if (!provider || provider.syntheticOnly !== true || this.options.allowSyntheticFaultProviderForTests !== true) {
      return Object.freeze({accepted: false, reason: 'SYNTHETIC_FAULT_PROVIDER_NOT_ALLOWED', replayed: false});
    }
    try {
      const result = provider.run(input.scenario);
      if (typeof result.contained!=='boolean'||!nonZeroSha(result.evidenceSha256) ||
        !isSafeDistributedIdentifier(provider.providerId)) {
        return Object.freeze({accepted: false, reason: 'FAULT_PROVIDER_EVIDENCE_INVALID', replayed: false});
      }
      const previous = this.options.persistence.lastFault(this.options.clusterId, this.options.familyId);
      if (previous && (!validFault(previous) || previous.clusterId !== this.options.clusterId ||
        previous.familyId !== this.options.familyId)) {
        return Object.freeze({accepted: false, reason: 'FAULT_CHAIN_INVALID', replayed: false});
      }
      const evidenceBase = {
        id: input.id, clientOperationId: input.clientOperationId, requestFingerprint,
        clusterId: this.options.clusterId, familyId: this.options.familyId,
        faultSequence: (previous?.faultSequence ?? 0) + 1, scenario: input.scenario,
        syntheticOnly: true as const, contained: result.contained, providerId: provider.providerId,
        providerEvidenceSha256: result.evidenceSha256, previousEvidenceSha256: previous?.evidenceSha256 ?? ZERO_SHA,
        realWindowsNode: false as const, createdAt: input.createdAt
      };
      const evidence = Object.freeze({...evidenceBase, evidenceSha256: hash(evidenceBase)});
      this.options.persistence.insertFault(evidence);
      return Object.freeze({accepted: true, reason: 'SYNTHETIC_FAULT_EVIDENCE_RECORDED', replayed: false, evidence});
    } catch {
      return Object.freeze({accepted: false, reason: 'FAULT_PROVIDER_OR_PERSISTENCE_ERROR', replayed: false});
    }
  }
}
