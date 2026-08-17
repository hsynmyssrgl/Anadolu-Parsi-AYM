import { describe,expect,it } from 'vitest';
import { automaticFailoverAvailable,automaticFailoverTopologyEligible,distributedInstallProfile,
  distributedNodeRoleAllowed,distributedReadConsistency,evaluateDistributedHealth,
  type DistributedMutationEnvelope } from '@ppt/domain';
import { DistributedCoreClusterRuntime,assertLocalProjectionDatabasePath,unavailableMatureRaftProvider,
  type DistributedCommittedMutationRecord,type DistributedCorePersistencePort,
  type MatureRaftProviderPort } from '../src/distributed-core-cluster-runtime.js';

class Persistence implements DistributedCorePersistencePort {
  public readonly records:DistributedCommittedMutationRecord[]=[];
  public readonly versions=new Map<string,number>();
  public failCommit=false;
  public head(clusterId:string,familyId:string){
    return this.records.filter(record=>record.mutation.clusterId===clusterId&&record.mutation.familyId===familyId)
      .at(-1)??null;
  }
  public entityVersion(clusterId:string,familyId:string,type:string,id:string){
    return this.versions.get([clusterId,familyId,type,id].join(':'))??0;
  }
  public findByIdempotencyKey(clusterId:string,familyId:string,idempotencyKey:string){
    return this.records.find(record=>record.mutation.clusterId===clusterId&&record.mutation.familyId===familyId
      &&record.mutation.idempotencyKey===idempotencyKey)??null;
  }
  public findByMutationId(clusterId:string,familyId:string,mutationId:string){
    return this.records.find(record=>record.mutation.clusterId===clusterId&&record.mutation.familyId===familyId
      &&record.mutation.mutationId===mutationId)??null;
  }
  public commitAndApply(input:Omit<DistributedCommittedMutationRecord,'projectionSha256'>){
    if(this.failCommit)throw new Error('synthetic local transaction failure');
    const projectionSha256='9'.repeat(64);
    this.versions.set([input.mutation.clusterId,input.mutation.familyId,input.mutation.entityType,input.mutation.entityId].join(':'),
      input.mutation.entityVersion);
    this.records.push(Object.freeze({...input,projectionSha256}));
    return {projectionSha256};
  }
}
const providerFixture=(input:Partial<MatureRaftProviderPort>={}):MatureRaftProviderPort=>({
  configured:true,providerId:'synthetic-raft-test-double',productionVerified:false,
  propose:()=>({accepted:true,majorityConfirmed:true,commitIndex:1,providerEvidenceSha256:'8'.repeat(64),networkUsed:false}),
  verifySnapshot:()=>({verified:true,providerEvidenceSha256:'6'.repeat(64),networkUsed:false}),...input
});
const input={mutationId:'mutation-34-i',idempotencyKey:'idempotency-34-i',clusterId:'cluster-34-i',familyId:'family-34-i',
  entityType:'health_record',entityId:'health-record-34-i',expectedEntityVersion:0,actorPersonId:'person-34-i',
  deviceId:'device-34-i',schemaVersion:1,policyVersion:'policy-34-i',revocationEpoch:2,keyEpoch:3,
  payloadSha256:'7'.repeat(64),occurredAt:'2026-08-16T01:30:00.000Z',term:4,fencingToken:5};
const runtime=(options:{readonly provider?:MatureRaftProviderPort;readonly persistence?:Persistence;
  readonly allowSynthetic?:boolean}={})=>new DistributedCoreClusterRuntime({clusterId:'cluster-34-i',familyId:'family-34-i',
  nodeId:'node-34-i',policyVersion:'policy-34-i',revocationEpoch:2,keyEpoch:3,
  provider:options.provider??providerFixture(),persistence:options.persistence??new Persistence(),
  allowUnverifiedProviderForTests:options.allowSynthetic??true});

describe('34-I distributed core consensus and tenancy foundation',()=>{
  it('models topology eligibility without claiming automatic failover availability',()=>{
    expect(distributedInstallProfile(1,0)).toBe('single_node');
    expect(distributedInstallProfile(2,1)).toBe('two_full_plus_witness');
    expect(distributedInstallProfile(3,0)).toBe('three_full_node');
    expect(distributedInstallProfile(2,0)).toBeNull();
    expect(distributedInstallProfile(2.5,0)).toBeNull();
    expect(distributedInstallProfile(Number.NaN,0)).toBeNull();
    expect(automaticFailoverTopologyEligible('two_full_plus_witness')).toBe(true);
    expect(automaticFailoverAvailable('two_full_plus_witness',
      {providerConfigured:true,quorumHealthy:true,realMultiNodeVerified:false})).toBe(false);
    expect(automaticFailoverAvailable('two_full_plus_witness',
      {providerConfigured:true,quorumHealthy:true,realMultiNodeVerified:true})).toBe(true);
    expect(distributedNodeRoleAllowed('leader',{appleClient:true,fullDataNode:true})).toBe(false);
    expect(distributedNodeRoleAllowed('witness',{appleClient:false,fullDataNode:false})).toBe(true);
    expect(distributedReadConsistency('thumbnail')).toBe('bounded_stale');
    expect(distributedReadConsistency('offline_help')).toBe('offline_read');
    expect(distributedReadConsistency('unknown_future_resource')).toBe('strong');
    expect(distributedReadConsistency('unhealthy_note')).toBe('strong');
  });

  it('fails closed without a provider, with an unverified provider, stale fencing or lost quorum',()=>{
    const unavailable=runtime({provider:unavailableMatureRaftProvider});
    unavailable.assumeRole({role:'leader',term:4,fencingToken:5,quorumHealthy:true});
    expect(unavailable.propose(input)).toMatchObject({accepted:false,reason:'RAFT_PROVIDER_UNAVAILABLE',
      productionConsensusVerified:false,networkUsed:false,consensusCommitted:false});
    const unverified=runtime({allowSynthetic:false});
    unverified.assumeRole({role:'leader',term:4,fencingToken:5,quorumHealthy:true});
    expect(unverified.propose(input)).toMatchObject({accepted:false,reason:'RAFT_PROVIDER_UNVERIFIED'});
    const active=runtime();active.assumeRole({role:'leader',term:4,fencingToken:5,quorumHealthy:true});
    expect(active.propose({...input,fencingToken:4})).toMatchObject({accepted:false,reason:'STALE_FENCING_TOKEN'});
    active.loseQuorum();
    expect(active.propose({...input,fencingToken:6})).toMatchObject({accepted:false,reason:'LEADER_NOT_WRITABLE'});
    expect(()=>runtime().assumeRole({role:'leader',term:Number.NaN,fencingToken:5,quorumHealthy:true}))
      .toThrow(/invalid leader term/);
  });

  it('commits majority-confirmed exact-tenant envelopes and durably replays exact idempotency',()=>{
    const persistence=new Persistence();let proposalCalls=0;
    const active=runtime({persistence,provider:providerFixture({propose:()=>{proposalCalls+=1;return {accepted:true,
      majorityConfirmed:true,commitIndex:1,providerEvidenceSha256:'8'.repeat(64),networkUsed:false};}})});
    active.assumeRole({role:'leader',term:4,fencingToken:5,quorumHealthy:true});
    const accepted=active.propose(input);
    expect(accepted).toMatchObject({accepted:true,reason:'COMMITTED',commitIndex:1,projectionSha256:'9'.repeat(64),
      replayed:false,consensusCommitted:true,locallyApplied:true,networkUsed:false});
    expect(persistence.records[0]?.mutation).toMatchObject({globalSequence:1,entityVersion:1,
      previousHash:'0'.repeat(64),policyVersion:'policy-34-i',revocationEpoch:2,keyEpoch:3});
    expect(active.propose(input)).toMatchObject({accepted:true,reason:'REPLAYED_COMMITTED',replayed:true,
      networkUsed:false,consensusCommitted:true,locallyApplied:true});
    expect(proposalCalls).toBe(1);
    expect(active.propose({...input,payloadSha256:'6'.repeat(64)}))
      .toMatchObject({accepted:false,reason:'IDEMPOTENCY_KEY_REUSED'});
    expect(active.propose({...input,idempotencyKey:'idempotency-other-34-i'}))
      .toMatchObject({accepted:false,reason:'MUTATION_ID_REUSED'});
    expect(active.propose({...input,mutationId:'mutation-next-34-i',idempotencyKey:'idempotency-next-34-i',
      expectedEntityVersion:1,payloadSha256:'6'.repeat(64),occurredAt:'2026-08-16T01:31:00.000Z'}))
      .toMatchObject({accepted:false,reason:'RAFT_PROVIDER_EVIDENCE_INVALID'});
    expect(active.state()).toMatchObject({safeMode:true,writable:false});
    const otherTenant=new DistributedCoreClusterRuntime({clusterId:'cluster-34-i',familyId:'family-other-34-i',
      nodeId:'node-other-34-i',policyVersion:'policy-34-i',revocationEpoch:2,keyEpoch:3,
      provider:providerFixture(),persistence,allowUnverifiedProviderForTests:true});
    otherTenant.assumeRole({role:'leader',term:4,fencingToken:5,quorumHealthy:true});
    expect(otherTenant.propose({...input,familyId:'family-other-34-i',entityId:'health-other-34-i'}))
      .toMatchObject({accepted:true,reason:'COMMITTED',replayed:false});
  });

  it('rejects malformed tenant, epoch, timestamp, numeric and provider evidence inputs',()=>{
    const active=runtime();active.assumeRole({role:'leader',term:4,fencingToken:5,quorumHealthy:true});
    expect(active.propose({...input,familyId:'other-family-34-i'})).toMatchObject({reason:'TENANCY_MISMATCH'});
    expect(active.propose({...input,keyEpoch:4})).toMatchObject({reason:'POLICY_OR_KEY_EPOCH_MISMATCH'});
    expect(active.propose({...input,schemaVersion:Number.NaN})).toMatchObject({reason:'MUTATION_INVALID'});
    expect(active.propose({...input,term:4.5})).toMatchObject({reason:'MUTATION_INVALID'});
    expect(active.propose({...input,occurredAt:'2026-08-16 01:30:00Z'})).toMatchObject({reason:'MUTATION_INVALID'});
    const forged=runtime({provider:providerFixture({propose:()=>({accepted:true,majorityConfirmed:true,
      commitIndex:Number.NaN,providerEvidenceSha256:'x'.repeat(64),networkUsed:false})})});
    forged.assumeRole({role:'leader',term:4,fencingToken:5,quorumHealthy:true});
    expect(forged.propose(input)).toMatchObject({accepted:false,reason:'RAFT_PROVIDER_EVIDENCE_INVALID'});
    expect(forged.state()).toMatchObject({safeMode:true,writable:false});
    const malformedBoolean=runtime({provider:providerFixture({propose:()=>({accepted:'yes' as unknown as boolean,
      majorityConfirmed:true,commitIndex:1,providerEvidenceSha256:'8'.repeat(64),networkUsed:false})})});
    malformedBoolean.assumeRole({role:'leader',term:4,fencingToken:5,quorumHealthy:true});
    expect(malformedBoolean.propose(input)).toMatchObject({reason:'RAFT_PROVIDER_EVIDENCE_INVALID'});
    const rejected=runtime({provider:providerFixture({propose:()=>({accepted:false,majorityConfirmed:false,
      commitIndex:0,networkUsed:false,reason:'provider secret detail'})})});
    rejected.assumeRole({role:'leader',term:4,fencingToken:5,quorumHealthy:true});
    expect(rejected.propose(input)).toMatchObject({reason:'MAJORITY_NOT_CONFIRMED'});
  });

  it('distinguishes a consensus commit from failed atomic local application',()=>{
    const persistence=new Persistence();persistence.failCommit=true;
    const active=runtime({persistence});active.assumeRole({role:'leader',term:4,fencingToken:5,quorumHealthy:true});
    expect(active.propose(input)).toMatchObject({accepted:false,reason:'COMMITTED_LOCAL_APPLY_FAILED',
      consensusCommitted:true,locallyApplied:false,networkUsed:false});
    expect(persistence.records).toHaveLength(0);
    expect(active.state()).toMatchObject({safeMode:true,writable:false});
  });

  it('requires exact snapshot evidence and reports provider-error network truth as indeterminate',()=>{
    const active=runtime();active.assumeRole({role:'leader',term:4,fencingToken:5,quorumHealthy:true});
    expect(active.verifyBootstrapSnapshot({snapshotSha256:'6'.repeat(64),snapshotIndex:1,
      policyVersion:'policy-34-i',revocationEpoch:2,keyEpoch:3})).toMatchObject({
        verified:true,reason:'SNAPSHOT_VERIFIED',providerEvidenceSha256:'6'.repeat(64),networkUsed:false
      });
    expect(active.verifyBootstrapSnapshot({snapshotSha256:'x'.repeat(64),snapshotIndex:1,
      policyVersion:'policy-34-i',revocationEpoch:2,keyEpoch:3})).toMatchObject({
        verified:false,reason:'SNAPSHOT_INPUT_INVALID',networkUsed:false
      });
    const throwing=runtime({provider:providerFixture({verifySnapshot:()=>{throw new Error('synthetic provider failure');}})});
    expect(throwing.verifyBootstrapSnapshot({snapshotSha256:'6'.repeat(64),snapshotIndex:1,
      policyVersion:'policy-34-i',revocationEpoch:2,keyEpoch:3})).toMatchObject({
        verified:false,reason:'RAFT_PROVIDER_ERROR',networkUsed:null
      });
    const rejected=runtime({provider:providerFixture({verifySnapshot:()=>({verified:false,networkUsed:false,
      reason:'provider secret detail'})})});
    expect(rejected.verifyBootstrapSnapshot({snapshotSha256:'6'.repeat(64),snapshotIndex:1,
      policyVersion:'policy-34-i',revocationEpoch:2,keyEpoch:3})).toMatchObject({
        verified:false,reason:'SNAPSHOT_NOT_VERIFIED',networkUsed:false
      });
  });

  it('rejects non-canonical projection paths and blocks unhealthy leaders from writes',()=>{
    expect(()=>assertLocalProjectionDatabasePath('C:\\AYM\\family.db')).not.toThrow();
    for(const path of ['\\\\server\\share\\family.db','\\\\?\\C:\\AYM\\family.db','C:\\AYM\\..\\family.db',
      'C:\\AYM\\family.db:stream','C:family.db',' C:\\AYM\\family.db']) {
      expect(()=>assertLocalProjectionDatabasePath(path)).toThrow();
    }
    const node={nodeId:'node',clusterId:'cluster',familyId:'family',role:'leader' as const,voter:true,appleClient:false as const,
      term:1,fencingToken:1,commitIndex:10,appliedIndex:10,replicationLag:0,diskFreeBytes:4*1024*1024*1024,
      certificateExpiresAt:'2026-08-18T01:00:00.000Z',certificateRevoked:false,backupAgeMinutes:10,
      liveness:true,readiness:true,safeMode:false};
    expect(evaluateDistributedHealth(node,{quorumHealthy:true,dependencyHealthy:true,
      nowMs:Date.parse('2026-08-16T01:00:00.000Z')})).toMatchObject({state:'healthy',writable:true});
    expect(evaluateDistributedHealth({...node,certificateRevoked:true},{quorumHealthy:true,dependencyHealthy:true,
      nowMs:Date.parse('2026-08-16T01:00:00.000Z')})).toMatchObject({state:'unhealthy',writable:false});
    const invalid=evaluateDistributedHealth({...node,replicationLag:Number.NaN},{quorumHealthy:true,
      dependencyHealthy:true,nowMs:Date.parse('2026-08-16T01:00:00.000Z')});
    expect(invalid).toMatchObject({state:'unhealthy',writable:false});
    expect(invalid.reasons).toContain('NODE_STATE_INVALID');
  });
});
