import { describe,expect,it } from 'vitest';import { distributedAppleClient,distributedOperationsTruth,distributedRecoveryProfile,
  type DistributedBackupEvidenceView } from '@ppt/domain';import { DistributedOperationsRuntime,denyAllDistributedClientAuthorization,
  unavailableDistributedDiscoveryProvider,unavailableDistributedRelayProvider,type DistributedDiscoveryProviderPort,
  type DistributedFaultInjectionPort } from '../src/distributed-operations-runtime.js';
const runtime=(overrides:Partial<ConstructorParameters<typeof DistributedOperationsRuntime>[0]>={})=>new DistributedOperationsRuntime({
  clusterId:'cluster-34-j',familyId:'family-34-j',policyVersion:'policy-34-j',keyEpoch:4,
  discovery:unavailableDistributedDiscoveryProvider,relay:unavailableDistributedRelayProvider,
  authorization:denyAllDistributedClientAuthorization,...overrides});
describe('34-J distributed clients, connectivity, operations and disaster recovery',()=>{
  it('treats discovery as an untrusted address hint with manual fallback',()=>{expect(runtime().discover()).toEqual([]);
    const provider:DistributedDiscoveryProviderPort={configured:true,discover:()=>[{nodeId:'node-34-j',addressHint:'192.0.2.10'}]};
    expect(runtime({discovery:provider}).discover()[0]).toMatchObject({mode:'mdns',trustedByDiscovery:false,requiresMtlsPairing:true});
    expect(runtime().manualCandidate({nodeId:'node-manual-34-j',addressHint:'192.0.2.11',mode:'manual_ip'}))
      .toMatchObject({trustedByDiscovery:false,requiresMtlsPairing:true});});
  it('keeps remote and Apple access fail-closed and rejects content-bearing control-plane envelopes',()=>{const operations=runtime();
    expect(operations.remotePolicy(false,'outbound_relay')).toMatchObject({enabled:false,mode:'disabled',inboundPortRequired:false,
      relayCanDecryptFamilyContent:false,providerConfigured:false,connected:false});
    expect(operations.connectRemote({enabled:true,mode:'outbound_relay',deviceId:'device-34-j'})).toBe(false);
    expect(operations.authorizeAppleRead({clientId:'iphone-34-j',deviceCertificateId:'cert-34-j',resourceType:'health_record',resourceId:'health-34-j'})).toBe(false);
    expect(operations.validateControlPlaneEnvelope({clusterId:'cluster-34-j',nodeId:'node-34-j',healthState:'healthy',witnessVote:true})).toBe(true);
    expect(operations.validateControlPlaneEnvelope({clusterId:'cluster-34-j',messageContent:'secret'})).toBe(false);
    expect(distributedAppleClient({clientId:'iphone-34-j',platform:'iphone',stale:true})).toMatchObject({mode:'read_only',
      independentSourceOfTruth:false,coreServiceAuthorizationRequired:true,atsExceptionAllowed:false,pushDeliveryGuaranteed:false});});
  it('separates immutable backup evidence from replicas and orders rolling updates leader-last',()=>{const operations=runtime();
    const evidence:DistributedBackupEvidenceView=Object.freeze({id:'backup-34-j',kind:'offline',immutable:true,independentFromReplica:true,
      manifestSha256:'a'.repeat(64),verifiedAt:'2026-08-16T02:00:00.000Z',keyEpoch:4,policyVersion:'policy-34-j',restoreTested:true,
      realDifferentDeviceRestoreVerified:false});operations.registerBackup(evidence);expect(operations.backups()).toEqual([evidence]);
    expect(()=>operations.registerBackup(evidence)).toThrow(/immutable/);expect(()=>operations.registerBackup({...evidence,id:'backup-wrong-epoch',keyEpoch:3})).toThrow(/epoch-compatible/);
    expect(operations.rollingUpdate([{nodeId:'leader-34-j',role:'leader'},{nodeId:'follower-b',role:'follower'},{nodeId:'follower-a',role:'follower'}]))
      .toMatchObject({nodeOrder:['follower-a','follower-b','leader-34-j'],leaderLast:true,signedPackageRequired:true,rollbackRequired:true,realUpdateExecuted:false});
    expect(distributedRecoveryProfile('three_node')).toMatchObject({targetRpo:'0 committed events',targetRtoSeconds:120,realDrillVerified:false});});
  it('uses monotonic observation, bounded sync budgets and synthetic-only fault evidence',()=>{const faults:DistributedFaultInjectionPort={syntheticOnly:true,
      run:()=>({contained:true,evidenceSha256:'b'.repeat(64)})};const operations=runtime({faultInjection:faults});
    expect(operations.observeMonotonic(100)).toBe(true);expect(operations.observeMonotonic(99)).toBe(false);
    expect(operations.setSyncBudget({meteredNetworkAllowed:false,batteryMinimumPercent:30,uploadLimitKbps:1024,
      quietHoursStart:'23:00',quietHoursEnd:'07:00',metadataBeforeMedia:true})).toMatchObject({metadataBeforeMedia:true});
    expect(operations.runSyntheticFault('network_partition')).toEqual({executed:true,contained:true,realWindowsNode:false,evidenceSha256:'b'.repeat(64)});
    expect(distributedOperationsTruth).toMatchObject({productionRelayConfigured:false,appleApplicationBuilt:false,
      realWindowsFaultMatrixExecuted:false,networkUsedByCurrentImplementation:false});});
});
