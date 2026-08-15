import { describe,expect,it } from 'vitest';
import { automaticFailoverAvailable,distributedInstallProfile,distributedNodeRoleAllowed,distributedReadConsistency,
  evaluateDistributedHealth,type DistributedMutationEnvelope } from '@ppt/domain';
import { DistributedCoreClusterRuntime,assertLocalProjectionDatabasePath,unavailableMatureRaftProvider,
  type DistributedCorePersistencePort,type MatureRaftProviderPort } from '../src/distributed-core-cluster-runtime.js';
class Persistence implements DistributedCorePersistencePort{public log:DistributedMutationEnvelope[]=[];public versions=new Map<string,number>();
  public lastMutation(){return this.log.at(-1)??null;}public entityVersion(type:string,id:string){return this.versions.get(`${type}:${id}`)??0;}
  public appendCommitted(mutation:DistributedMutationEnvelope){this.log.push(mutation);}
  public applyDeterministicProjection(mutation:DistributedMutationEnvelope){this.versions.set(`${mutation.entityType}:${mutation.entityId}`,mutation.entityVersion);
    return {projectionSha256:'9'.repeat(64)};}}
const provider:MatureRaftProviderPort=Object.freeze({configured:true,providerId:'synthetic-raft-test-double',productionVerified:false,
  propose:()=>({accepted:true,majorityConfirmed:true,commitIndex:1,providerEvidenceSha256:'8'.repeat(64)}),verifySnapshot:()=>true});
const input={mutationId:'mutation-34-i',idempotencyKey:'idempotency-34-i',clusterId:'cluster-34-i',familyId:'family-34-i',
  entityType:'health_record',entityId:'health-record-34-i',expectedEntityVersion:0,actorPersonId:'person-34-i',deviceId:'device-34-i',
  schemaVersion:1,policyVersion:'policy-34-i',revocationEpoch:2,keyEpoch:3,payloadSha256:'7'.repeat(64),
  occurredAt:'2026-08-16T01:30:00.000Z',term:4,fencingToken:5};
const runtime=(raft:MatureRaftProviderPort=provider)=>new DistributedCoreClusterRuntime({clusterId:'cluster-34-i',familyId:'family-34-i',
  nodeId:'node-34-i',policyVersion:'policy-34-i',revocationEpoch:2,keyEpoch:3,provider:raft,persistence:new Persistence()});
describe('34-I distributed core consensus and tenancy foundation',()=>{
  it('models honest deployment profiles, node roles and read consistency',()=>{
    expect(distributedInstallProfile(1,0)).toBe('single_node');expect(automaticFailoverAvailable('single_node')).toBe(false);
    expect(distributedInstallProfile(2,1)).toBe('two_full_plus_witness');expect(automaticFailoverAvailable('two_full_plus_witness')).toBe(true);
    expect(distributedInstallProfile(3,0)).toBe('three_full_node');expect(distributedInstallProfile(2,0)).toBeNull();
    expect(distributedNodeRoleAllowed('leader',{appleClient:true,fullDataNode:true})).toBe(false);
    expect(distributedNodeRoleAllowed('witness',{appleClient:false,fullDataNode:false})).toBe(true);
    expect(distributedReadConsistency('health_record')).toBe('strong');expect(distributedReadConsistency('thumbnail')).toBe('bounded_stale');
  });
  it('fails closed without a mature Raft provider and on stale fencing or lost quorum',()=>{const unavailable=runtime(unavailableMatureRaftProvider);
    unavailable.assumeRole({role:'leader',term:4,fencingToken:5,quorumHealthy:true});
    expect(unavailable.propose(input)).toMatchObject({accepted:false,reason:'RAFT_PROVIDER_UNAVAILABLE',productionConsensusVerified:false,networkUsed:false});
    const active=runtime();active.assumeRole({role:'leader',term:4,fencingToken:5,quorumHealthy:true});
    expect(active.propose({...input,fencingToken:4})).toMatchObject({accepted:false,reason:'STALE_FENCING_TOKEN'});
    active.loseQuorum();expect(active.propose({...input,fencingToken:6})).toMatchObject({accepted:false,reason:'LEADER_NOT_WRITABLE'});
  });
  it('commits only majority-confirmed exact-tenant envelopes and applies deterministic projections',()=>{const persistence=new Persistence();
    const active=new DistributedCoreClusterRuntime({clusterId:'cluster-34-i',familyId:'family-34-i',nodeId:'node-34-i',
      policyVersion:'policy-34-i',revocationEpoch:2,keyEpoch:3,provider,persistence});active.assumeRole({role:'leader',term:4,fencingToken:5,quorumHealthy:true});
    const accepted=active.propose(input);expect(accepted).toMatchObject({accepted:true,reason:'COMMITTED',commitIndex:1,
      projectionSha256:'9'.repeat(64),providerId:'synthetic-raft-test-double',productionConsensusVerified:false,networkUsed:true});
    expect(persistence.log[0]).toMatchObject({globalSequence:1,entityVersion:1,previousHash:'0'.repeat(64),policyVersion:'policy-34-i',revocationEpoch:2,keyEpoch:3});
    expect(active.propose({...input,mutationId:'mutation-tenant-34-i',idempotencyKey:'idempotency-tenant-34-i',familyId:'other-family-34-i',expectedEntityVersion:1}))
      .toMatchObject({accepted:false,reason:'TENANCY_MISMATCH'});
    expect(active.verifyBootstrapSnapshot({snapshotSha256:'6'.repeat(64),snapshotIndex:1,policyVersion:'policy-34-i',revocationEpoch:2,keyEpoch:3})).toBe(true);
  });
  it('rejects network-share projection paths and classifies unhealthy nodes without restart claims',()=>{
    expect(()=>assertLocalProjectionDatabasePath('C:\\AYM\\family.db')).not.toThrow();
    expect(()=>assertLocalProjectionDatabasePath('\\\\server\\share\\family.db')).toThrow(/absolute local Windows path/);
    const health=evaluateDistributedHealth({nodeId:'node',clusterId:'cluster',familyId:'family',role:'leader',voter:true,appleClient:false,
      term:1,fencingToken:1,commitIndex:10,appliedIndex:5,replicationLag:2_000,diskFreeBytes:1_000,certificateExpiresAt:'2026-08-16T01:00:00.000Z',
      certificateRevoked:true,backupAgeMinutes:2_000,liveness:true,readiness:false,safeMode:true},{quorumHealthy:false,dependencyHealthy:false,
      nowMs:Date.parse('2026-08-16T01:00:00.000Z'),certificateExpiryMs:Date.parse('2026-08-16T01:00:00.000Z')});
    expect(health).toMatchObject({state:'unhealthy',writable:false,safeMode:true});expect(health.reasons).toContain('QUORUM_UNAVAILABLE');
  });
});
