import { describe, expect, it } from 'vitest';
import {
  distributedAppleClient,
  distributedOperationsTruth,
  distributedRecoveryProfile,
  type DistributedBackupEvidenceView,
  type DistributedFaultEvidenceView,
  type DistributedUpdatePlanView
} from '@ppt/domain';
import {
  DistributedOperationsRuntime,
  denyAllDistributedClientAuthorization,
  unavailableDistributedBackupVerifier,
  unavailableDistributedClusterState,
  unavailableDistributedDiscoveryProvider,
  unavailableDistributedRelayProvider,
  unavailableDistributedUpdateVerifier,
  type DistributedBackupVerificationProviderPort,
  type DistributedClientAuthorizationPort,
  type DistributedClusterStatePort,
  type DistributedDiscoveryProviderPort,
  type DistributedFaultInjectionPort,
  type DistributedOperationsPersistencePort,
  type DistributedRelayProviderPort,
  type DistributedSignedUpdateVerifierPort
} from '../src/distributed-operations-runtime.js';

class MemoryPersistence implements DistributedOperationsPersistencePort {
  public readonly backups: DistributedBackupEvidenceView[] = [];
  public readonly updates: DistributedUpdatePlanView[] = [];
  public readonly faults: DistributedFaultEvidenceView[] = [];
  public findBackupByClientOperationId(id: string) { return this.backups.find(value => value.clientOperationId === id) ?? null; }
  public lastBackup(clusterId: string, familyId: string) {
    return [...this.backups].reverse().find(value => value.clusterId === clusterId && value.familyId === familyId) ?? null;
  }
  public insertBackup(value: DistributedBackupEvidenceView) { this.backups.push(value); }
  public listBackups(clusterId: string, familyId: string, limit: number) {
    return this.backups.filter(value => value.clusterId === clusterId && value.familyId === familyId).slice(-limit);
  }
  public findUpdatePlanByClientOperationId(id: string) { return this.updates.find(value => value.clientOperationId === id) ?? null; }
  public insertUpdatePlan(value: DistributedUpdatePlanView) { this.updates.push(value); }
  public findFaultByClientOperationId(id: string) { return this.faults.find(value => value.clientOperationId === id) ?? null; }
  public lastFault(clusterId: string, familyId: string) {
    return [...this.faults].reverse().find(value => value.clusterId === clusterId && value.familyId === familyId) ?? null;
  }
  public insertFault(value: DistributedFaultEvidenceView) { this.faults.push(value); }
}

const clusterState: DistributedClusterStatePort = {
  productionVerified: false,
  current: () => ({nodes: [{nodeId: 'leader-34-j', role: 'leader'}, {nodeId: 'follower-34-j', role: 'follower'}],
    leaderNodeId: 'leader-34-j', quorumHealthy: true, commitIndex: 12, evidenceSha256: 'c'.repeat(64)})
};
const backupVerifier: DistributedBackupVerificationProviderPort = {
  configured: true,
  productionVerified: false,
  providerId: 'test-backup-verifier',
  verify: input => ({verified: true, immutable: true, independentFromReplica: true,
    manifestSha256: input.manifestSha256, storageTargetId: 'offline-target-34-j', verifiedSizeBytes: 4096,
    providerEvidenceSha256: 'd'.repeat(64), networkUsed: false})
};
const updateVerifier: DistributedSignedUpdateVerifierPort = {
  configured: true,
  productionVerified: false,
  verifierId: 'test-update-verifier',
  verify: () => ({verified: true, signatureEvidenceSha256: 'e'.repeat(64)})
};
const authorization: DistributedClientAuthorizationPort = {
  configured: true,
  productionVerified: false,
  providerId: 'test-central-authorization',
  authorizeRead: () => ({allowed: true, decisionEvidenceSha256: 'f'.repeat(64), networkUsed: false}),
  authorizeRemoteConnection: () => ({allowed: true, decisionEvidenceSha256: 'a'.repeat(64), networkUsed: false})
};
const relay: DistributedRelayProviderPort = {
  configured: true,
  productionVerified: false,
  providerId: 'test-relay-provider',
  connect: () => ({connected: true, connectionId: 'connection-34-j', networkUsed: true,
    providerEvidenceSha256: 'b'.repeat(64)}),
  disconnect: () => ({disconnected: true, networkUsed: true, providerEvidenceSha256: 'c'.repeat(64)})
};

const makeRuntime = (overrides: Partial<ConstructorParameters<typeof DistributedOperationsRuntime>[0]> = {}) =>
  new DistributedOperationsRuntime({
    clusterId: 'cluster-34-j', familyId: 'family-34-j', policyVersion: 'policy-34-j', keyEpoch: 4,
    revocationEpoch: 2, discovery: unavailableDistributedDiscoveryProvider, relay: unavailableDistributedRelayProvider,
    authorization: denyAllDistributedClientAuthorization, clusterState: unavailableDistributedClusterState,
    backupVerifier: unavailableDistributedBackupVerifier, updateVerifier: unavailableDistributedUpdateVerifier,
    persistence: new MemoryPersistence(), ...overrides
  });

describe('34-J distributed clients, connectivity, operations and disaster recovery', () => {
  it('treats discovery as an untrusted address hint and requires exact provider evidence', () => {
    expect(makeRuntime().discover()).toMatchObject({status: 'NOT_CONFIGURED', candidates: [], networkUsed: false});
    const provider: DistributedDiscoveryProviderPort = {configured: true, productionVerified: false,
      providerId: 'test-discovery-provider', discover: () => ({candidates: [{nodeId: 'node-34-j', addressHint: '192.0.2.10:443'}],
        networkUsed: true, providerEvidenceSha256: '1'.repeat(64)})};
    expect(makeRuntime({discovery: provider}).discover()).toMatchObject({status: 'PROVIDER_UNVERIFIED', candidates: []});
    const discovered = makeRuntime({discovery: provider, allowUnverifiedProvidersForTests: true}).discover();
    expect(discovered).toMatchObject({status: 'DISCOVERED', networkUsed: true,
      candidates: [{mode: 'mdns', trustedByDiscovery: false, requiresMtlsPairing: true}]});
    const duplicate = {...provider, discover: () => ({candidates: [{nodeId: 'node-34-j', addressHint: '192.0.2.10'},
      {nodeId: 'node-34-j', addressHint: '192.0.2.11'}], networkUsed: true, providerEvidenceSha256: '1'.repeat(64)})};
    expect(makeRuntime({discovery: duplicate, allowUnverifiedProvidersForTests: true}).discover().status).toBe('PROVIDER_ERROR');
    expect(() => makeRuntime().manualCandidate({nodeId: 'node-manual-34-j', addressHint: 'https://user@host', mode: 'qr'})).toThrow();
  });

  it('validates exact content-free control-plane variants without accessors or nested payloads', () => {
    const operations = makeRuntime();
    expect(operations.validateControlPlaneEnvelope({kind: 'health', clusterId: 'cluster-34-j', nodeId: 'node-34-j',
      occurredAt: '2026-08-16T02:00:00.000Z', healthState: 'healthy'})).toBe(true);
    expect(operations.validateControlPlaneEnvelope({kind: 'apns_wake', clusterId: 'cluster-34-j', nodeId: 'node-34-j',
      occurredAt: '2026-08-16T02:00:00.000Z', wakeTokenSha256: '2'.repeat(64)})).toBe(true);
    expect(operations.validateControlPlaneEnvelope({kind: 'health', clusterId: 'cluster-34-j', nodeId: 'node-34-j',
      occurredAt: '2026-08-16T02:00:00.000Z', healthState: {message: 'secret'}})).toBe(false);
    expect(operations.validateControlPlaneEnvelope({kind: 'health', clusterId: 'cluster-34-j', nodeId: 'node-34-j',
      occurredAt: '2026-08-16T02:00:00.000Z', healthState: 'healthy', payload: 'secret'})).toBe(false);
    const accessor = Object.defineProperty({}, 'kind', {enumerable: true, get: () => 'health'});
    expect(operations.validateControlPlaneEnvelope(accessor)).toBe(false);
  });

  it('keeps remote and Apple authorization fail-closed until verified providers return evidence', () => {
    expect(makeRuntime().remotePolicy(false, 'outbound_relay')).toMatchObject({enabled: false, mode: 'disabled',
      providerConfigured: false, connected: false, networkUsed: false});
    expect(makeRuntime({relay, authorization}).connectRemote({enabled: true, mode: 'outbound_relay',
      deviceId: 'device-34-j', deviceCertificateId: 'cert-34-j'})).toMatchObject({connected: false,
      reason: 'RELAY_PROVIDER_UNVERIFIED', networkUsed: false});
    const operations = makeRuntime({relay, authorization, allowUnverifiedProvidersForTests: true});
    expect(operations.connectRemote({enabled: true, mode: 'outbound_relay', deviceId: 'device-34-j',
      deviceCertificateId: 'cert-34-j'})).toMatchObject({connected: true, reason: 'CONNECTED', networkUsed: true});
    expect(operations.authorizeAppleRead({clientId: 'iphone-34-j', deviceCertificateId: 'cert-34-j',
      resourceType: 'health_record', resourceId: 'health-34-j'})).toMatchObject({allowed: true,
      reason: 'AUTHORIZED', decisionEvidenceSha256: 'f'.repeat(64), networkUsed: false});
    expect(makeRuntime().authorizeAppleRead({clientId: 'iphone-34-j', deviceCertificateId: 'cert-34-j',
      resourceType: 'health_record', resourceId: 'health-34-j'}).allowed).toBe(false);
    expect((operations.connectRemote as (value: unknown) => unknown)({enabled: true, mode: 'invalid',
      deviceId: 'device-34-j', deviceCertificateId: 'cert-34-j'})).toMatchObject({enabled: false,
      mode: 'disabled', reason: 'REMOTE_INPUT_INVALID'});
  });

  it('records provider-verified backups as a durable hash chain with exact replay semantics', () => {
    const persistence = new MemoryPersistence();
    const operations = makeRuntime({persistence, clusterState, backupVerifier, allowUnverifiedProvidersForTests: true});
    const input = {id: 'backup-34-j', clientOperationId: 'backup-operation-34-j', kind: 'offline' as const,
      manifestSha256: '3'.repeat(64), sourceCommitIndex: 12, verifiedAt: '2026-08-16T02:00:00.000Z'};
    const created = operations.verifyAndRegisterBackup(input);
    expect(created).toMatchObject({accepted: true, replayed: false, reason: 'BACKUP_VERIFIED_AND_RECORDED',
      networkUsed: false, evidence: {backupSequence: 1, immutable: true, independentFromReplica: true,
        restoreTested: false, clusterStateEvidenceSha256: 'c'.repeat(64),
        previousEvidenceSha256: '0'.repeat(64)}});
    expect(operations.verifyAndRegisterBackup(input)).toMatchObject({accepted: true, replayed: true, reason: 'BACKUP_REPLAYED'});
    expect(operations.verifyAndRegisterBackup({...input, manifestSha256: '4'.repeat(64)})).toMatchObject({accepted: false,
      reason: 'BACKUP_IDEMPOTENCY_MISMATCH'});
    expect(operations.backups()).toHaveLength(1);
    expect(makeRuntime({persistence, clusterState, backupVerifier}).verifyAndRegisterBackup({...input,
      id: 'backup-unverified-34-j', clientOperationId: 'backup-unverified-operation-34-j'}).reason).toBe('BACKUP_VERIFIER_UNVERIFIED');
  });

  it('creates only signed quorum-bound leader-last update plans and replays them exactly', () => {
    const persistence = new MemoryPersistence();
    const operations = makeRuntime({persistence, clusterState, updateVerifier, allowUnverifiedProvidersForTests: true});
    const input = {id: 'update-34-j', clientOperationId: 'update-operation-34-j', currentVersion: '4.8.2026-29',
      targetVersion: '4.8.2026-30', packageSha256: '5'.repeat(64), createdAt: '2026-08-16T02:00:00.000Z'};
    const created = operations.createRollingUpdatePlan(input);
    expect(created).toMatchObject({accepted: true, replayed: false, plan: {nodeOrder: ['follower-34-j', 'leader-34-j'],
      leaderLast: true, packageSignatureVerified: true, realUpdateExecuted: false}});
    expect(operations.createRollingUpdatePlan(input)).toMatchObject({accepted: true, replayed: true});
    expect(operations.createRollingUpdatePlan({...input, targetVersion: '4.8.2026-31'})).toMatchObject({accepted: false,
      reason: 'UPDATE_IDEMPOTENCY_MISMATCH'});
    const wrongLeaderState = {...clusterState, current: () => ({...clusterState.current({clusterId: 'cluster-34-j', familyId: 'family-34-j'}),
      leaderNodeId: 'different-leader'})};
    expect(makeRuntime({persistence: new MemoryPersistence(), clusterState: wrongLeaderState, updateVerifier,
      allowUnverifiedProvidersForTests: true}).createRollingUpdatePlan({...input, id: 'update-wrong-leader',
        clientOperationId: 'update-wrong-leader-operation'}).reason).toBe('CLUSTER_LEADER_ORDER_MISMATCH');
  });

  it('uses strict monotonic time, bounded sync budgets and derived Apple staleness', () => {
    const operations = makeRuntime();
    expect(operations.observeMonotonic(100)).toBe(true);
    expect(operations.observeMonotonic(100)).toBe(false);
    expect(operations.observeMonotonic(100.5)).toBe(false);
    expect(operations.setSyncBudget({meteredNetworkAllowed: false, batteryMinimumPercent: 30, uploadLimitKbps: 1024,
      quietHoursStart: '23:00', quietHoursEnd: '07:00', metadataBeforeMedia: true})).toMatchObject({metadataBeforeMedia: true});
    expect(() => operations.setSyncBudget({meteredNetworkAllowed: false, batteryMinimumPercent: 30, uploadLimitKbps: 1024,
      quietHoursStart: '07:00', quietHoursEnd: '07:00', metadataBeforeMedia: true})).toThrow();
    expect(distributedAppleClient({clientId: 'iphone-34-j', platform: 'iphone',
      lastVerifiedSyncAt: '2026-08-16T01:00:00.000Z', nowMs: Date.parse('2026-08-16T03:00:00.000Z'),
      staleAfterMs: 3_600_000})).toMatchObject({stale: true, mode: 'read_only', independentSourceOfTruth: false});
  });

  it('requires an explicit synthetic fault provider and stores content-free chained evidence', () => {
    const persistence = new MemoryPersistence();
    const faults: DistributedFaultInjectionPort = {syntheticOnly: true, providerId: 'test-fault-provider',
      run: () => ({contained: true, evidenceSha256: '6'.repeat(64)})};
    const input = {id: 'fault-34-j', clientOperationId: 'fault-operation-34-j', scenario: 'network_partition' as const,
      createdAt: '2026-08-16T02:00:00.000Z'};
    expect(makeRuntime({persistence, faultInjection: faults}).runSyntheticFault(input).reason)
      .toBe('SYNTHETIC_FAULT_PROVIDER_NOT_ALLOWED');
    const operations = makeRuntime({persistence, faultInjection: faults, allowSyntheticFaultProviderForTests: true});
    expect(operations.runSyntheticFault(input)).toMatchObject({accepted: true, replayed: false,
      evidence: {faultSequence: 1, syntheticOnly: true, realWindowsNode: false, previousEvidenceSha256: '0'.repeat(64)}});
    expect(operations.runSyntheticFault(input)).toMatchObject({accepted: true, replayed: true});
    expect(operations.runSyntheticFault({...input, scenario: 'disk_full'})).toMatchObject({accepted: false,
      reason: 'FAULT_IDEMPOTENCY_MISMATCH'});
    expect(distributedRecoveryProfile('three_node')).toMatchObject({targetRpo: '0 committed events', targetRtoSeconds: 120,
      productionObjectiveOnly: true, realDrillVerified: false});
    expect(distributedOperationsTruth).toMatchObject({durableOperationsEvidenceRequired: true,
      productionRuntimeComposed: false, productionRelayConfigured: false, appleApplicationBuilt: false,
      realWindowsFaultMatrixExecuted: false, networkUsedByCurrentProductionImplementation: false});
  });
});
