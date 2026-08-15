import { createHash } from 'node:crypto';
import type { DistributedMutationEnvelope,DistributedNodeRole } from '@ppt/domain';

export interface MatureRaftProviderPort {
  readonly configured:boolean;readonly providerId:string;readonly productionVerified:boolean;
  propose(input:{readonly clusterId:string;readonly nodeId:string;readonly term:number;readonly fencingToken:number;
    readonly mutation:DistributedMutationEnvelope}):{readonly accepted:boolean;readonly majorityConfirmed:boolean;
    readonly commitIndex:number;readonly providerEvidenceSha256?:string;readonly reason?:string};
  verifySnapshot(input:{readonly clusterId:string;readonly snapshotSha256:string;readonly snapshotIndex:number;
    readonly policyVersion:string;readonly revocationEpoch:number;readonly keyEpoch:number}):boolean;
}
export interface DistributedCorePersistencePort {
  lastMutation():DistributedMutationEnvelope|null;entityVersion(entityType:string,entityId:string):number;
  appendCommitted(mutation:DistributedMutationEnvelope,commitIndex:number,providerEvidenceSha256:string):void;
  applyDeterministicProjection(mutation:DistributedMutationEnvelope):{readonly projectionSha256:string};
}
export interface DistributedCoreMutationInput {
  readonly mutationId:string;readonly idempotencyKey:string;readonly clusterId:string;readonly familyId:string;
  readonly entityType:string;readonly entityId:string;readonly expectedEntityVersion:number;readonly actorPersonId:string;
  readonly deviceId:string;readonly schemaVersion:number;readonly policyVersion:string;readonly revocationEpoch:number;
  readonly keyEpoch:number;readonly payloadSha256:string;readonly occurredAt:string;readonly term:number;readonly fencingToken:number;
}
export interface DistributedCoreMutationDecision {
  readonly accepted:boolean;readonly reason:string;readonly mutation?:DistributedMutationEnvelope;
  readonly commitIndex?:number;readonly projectionSha256?:string;readonly providerId:string;
  readonly productionConsensusVerified:false;readonly networkUsed:boolean;
}
const SHA=/^[0-9a-f]{64}$/u;const SAFE=/^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,255}$/u;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex');
const denied=(reason:string,provider:MatureRaftProviderPort):DistributedCoreMutationDecision=>Object.freeze({accepted:false,reason,
  providerId:provider.providerId,productionConsensusVerified:false,networkUsed:provider.configured});

export const assertLocalProjectionDatabasePath=(databasePath:string):void=>{
  const normalized=databasePath.trim().replaceAll('/','\\');
  if(!/^[A-Za-z]:\\/u.test(normalized)||normalized.startsWith('\\\\')||normalized.toUpperCase().includes('\\UNC\\')
    ||normalized.includes('..\\'))throw new Error('Distributed projection database must be an absolute local Windows path');
};

export const unavailableMatureRaftProvider:MatureRaftProviderPort=Object.freeze({configured:false,
  providerId:'unavailable-mature-raft-provider',productionVerified:false,propose:()=>({accepted:false,majorityConfirmed:false,
    commitIndex:0,reason:'RAFT_PROVIDER_UNAVAILABLE'}),verifySnapshot:()=>false});

export class DistributedCoreClusterRuntime {
  #role:DistributedNodeRole='maintenance';#term=0;#fencingToken=0;#quorumHealthy=false;#safeMode=true;
  #isLeader():boolean{switch(this.#role){case 'leader':return true;default:return false;}}
  public constructor(private readonly options:{readonly clusterId:string;readonly familyId:string;readonly nodeId:string;
    readonly policyVersion:string;readonly revocationEpoch:number;readonly keyEpoch:number;
    readonly provider:MatureRaftProviderPort;readonly persistence:DistributedCorePersistencePort}){
    for(const value of [options.clusterId,options.familyId,options.nodeId,options.policyVersion])if(!SAFE.test(value))throw new Error('Distributed core identity is invalid');
    if(options.revocationEpoch<0||options.keyEpoch<1)throw new Error('Distributed core epoch is invalid');}
  public assumeRole(input:{readonly role:DistributedNodeRole;readonly term:number;readonly fencingToken:number;
    readonly quorumHealthy:boolean}):void{if(input.term<this.#term||input.fencingToken<=this.#fencingToken)
      throw new Error('Stale leader term or fencing token');this.#role=input.role;this.#term=input.term;
    this.#fencingToken=input.fencingToken;this.#quorumHealthy=input.quorumHealthy;
    this.#safeMode=this.#isLeader()?!input.quorumHealthy:false;}
  public loseQuorum():void{this.#quorumHealthy=false;this.#safeMode=true;this.#fencingToken+=1;}
  public enterSafeMode():void{this.#safeMode=true;this.#fencingToken+=1;}
  public state(){return Object.freeze({role:this.#role,term:this.#term,fencingToken:this.#fencingToken,
    quorumHealthy:this.#quorumHealthy,safeMode:this.#safeMode,writable:this.#isLeader()&&this.#quorumHealthy&&!this.#safeMode,
    raftProviderConfigured:this.options.provider.configured,productionConsensusVerified:false as const});}
  public propose(input:DistributedCoreMutationInput):DistributedCoreMutationDecision{
    const provider=this.options.provider;if(!provider.configured)return denied('RAFT_PROVIDER_UNAVAILABLE',provider);
    if(!this.#isLeader()||this.#safeMode||!this.#quorumHealthy)return denied('LEADER_NOT_WRITABLE',provider);
    if(input.term!==this.#term||input.fencingToken!==this.#fencingToken)return denied('STALE_FENCING_TOKEN',provider);
    if(input.clusterId!==this.options.clusterId||input.familyId!==this.options.familyId)return denied('TENANCY_MISMATCH',provider);
    if(input.policyVersion!==this.options.policyVersion||input.revocationEpoch!==this.options.revocationEpoch
      ||input.keyEpoch!==this.options.keyEpoch)return denied('POLICY_OR_KEY_EPOCH_MISMATCH',provider);
    if(![input.mutationId,input.idempotencyKey,input.entityType,input.entityId,input.actorPersonId,input.deviceId].every(value=>SAFE.test(value))
      ||!SHA.test(input.payloadSha256)||input.schemaVersion<1||input.expectedEntityVersion<0)return denied('MUTATION_INVALID',provider);
    const currentVersion=this.options.persistence.entityVersion(input.entityType,input.entityId);
    if(currentVersion!==input.expectedEntityVersion)return denied('ENTITY_VERSION_CONFLICT',provider);
    const previous=this.options.persistence.lastMutation();const base=Object.freeze({mutationId:input.mutationId,
      idempotencyKey:input.idempotencyKey,clusterId:input.clusterId,familyId:input.familyId,entityType:input.entityType,
      entityId:input.entityId,entityVersion:currentVersion+1,globalSequence:(previous?.globalSequence??0)+1,
      actorPersonId:input.actorPersonId,deviceId:input.deviceId,schemaVersion:input.schemaVersion,policyVersion:input.policyVersion,
      revocationEpoch:input.revocationEpoch,keyEpoch:input.keyEpoch,payloadSha256:input.payloadSha256,
      previousHash:previous?.mutationHash??'0'.repeat(64),occurredAt:input.occurredAt});
    const mutation:DistributedMutationEnvelope=Object.freeze({...base,mutationHash:hash(base)});
    const proposed=provider.propose({clusterId:this.options.clusterId,nodeId:this.options.nodeId,term:this.#term,
      fencingToken:this.#fencingToken,mutation});
    if(!proposed.accepted||!proposed.majorityConfirmed||!proposed.providerEvidenceSha256||!SHA.test(proposed.providerEvidenceSha256))
      return denied(proposed.reason??'MAJORITY_NOT_CONFIRMED',provider);
    this.options.persistence.appendCommitted(mutation,proposed.commitIndex,proposed.providerEvidenceSha256);
    const projection=this.options.persistence.applyDeterministicProjection(mutation);
    if(!SHA.test(projection.projectionSha256)){this.enterSafeMode();return denied('PROJECTION_HASH_INVALID',provider);}
    return Object.freeze({accepted:true,reason:'COMMITTED',mutation,commitIndex:proposed.commitIndex,
      projectionSha256:projection.projectionSha256,providerId:provider.providerId,productionConsensusVerified:false,
      networkUsed:true});}
  public verifyBootstrapSnapshot(input:{readonly snapshotSha256:string;readonly snapshotIndex:number;
    readonly policyVersion:string;readonly revocationEpoch:number;readonly keyEpoch:number}):boolean{
    return this.options.provider.configured&&SHA.test(input.snapshotSha256)&&input.snapshotIndex>=0
      &&input.policyVersion===this.options.policyVersion&&input.revocationEpoch===this.options.revocationEpoch
      &&input.keyEpoch===this.options.keyEpoch&&this.options.provider.verifySnapshot({clusterId:this.options.clusterId,...input});}
}
