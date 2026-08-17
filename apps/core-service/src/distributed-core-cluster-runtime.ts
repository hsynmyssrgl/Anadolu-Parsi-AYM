import { createHash } from 'node:crypto';
import { win32 } from 'node:path';
import type { DistributedMutationEnvelope,DistributedNodeRole } from '@ppt/domain';

export interface MatureRaftProposalResult {
  readonly accepted:boolean;readonly majorityConfirmed:boolean;readonly commitIndex:number;
  readonly providerEvidenceSha256?:string;readonly networkUsed:boolean;readonly reason?:string;
}
export interface MatureRaftSnapshotVerificationResult {
  readonly verified:boolean;readonly providerEvidenceSha256?:string;readonly networkUsed:boolean;readonly reason?:string;
}
export interface MatureRaftProviderPort {
  readonly configured:boolean;readonly providerId:string;readonly productionVerified:boolean;
  propose(input:{readonly clusterId:string;readonly nodeId:string;readonly term:number;readonly fencingToken:number;
    readonly mutation:DistributedMutationEnvelope}):MatureRaftProposalResult;
  verifySnapshot(input:{readonly clusterId:string;readonly snapshotSha256:string;readonly snapshotIndex:number;
    readonly policyVersion:string;readonly revocationEpoch:number;readonly keyEpoch:number}):MatureRaftSnapshotVerificationResult;
}
export interface DistributedCommittedMutationRecord {
  readonly mutation:DistributedMutationEnvelope;readonly requestFingerprint:string;readonly commitIndex:number;
  readonly providerEvidenceSha256:string;readonly projectionSha256:string;readonly providerId:string;
}
export interface DistributedCorePersistencePort {
  head(clusterId:string,familyId:string):DistributedCommittedMutationRecord|null;
  entityVersion(clusterId:string,familyId:string,entityType:string,entityId:string):number;
  findByIdempotencyKey(clusterId:string,familyId:string,idempotencyKey:string):DistributedCommittedMutationRecord|null;
  findByMutationId(clusterId:string,familyId:string,mutationId:string):DistributedCommittedMutationRecord|null;
  commitAndApply(input:{readonly mutation:DistributedMutationEnvelope;readonly requestFingerprint:string;
    readonly commitIndex:number;readonly providerEvidenceSha256:string;readonly providerId:string}):
    {readonly projectionSha256:string};
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
  readonly productionConsensusVerified:false;readonly networkUsed:boolean|null;readonly replayed:boolean;
  readonly consensusCommitted:boolean;readonly locallyApplied:boolean;
}
export interface DistributedSnapshotVerificationDecision {
  readonly verified:boolean;readonly reason:string;readonly providerId:string;
  readonly providerEvidenceSha256?:string;readonly productionConsensusVerified:false;
  readonly networkUsed:boolean|null;
}

const SHA=/^[0-9a-f]{64}$/u;
const ZERO_SHA='0'.repeat(64);
const SAFE=/^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,255}$/u;
const CANONICAL_ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const safeInteger=(value:number,minimum=0):boolean=>Number.isSafeInteger(value)&&value>=minimum;
const canonicalIso=(value:string):boolean=>{
  if(!CANONICAL_ISO.test(value))return false;
  const parsed=Date.parse(value);
  return Number.isFinite(parsed)&&new Date(parsed).toISOString()===value;
};
const canonicalFlatJson=(value:Record<string,unknown>):string=>JSON.stringify(
  Object.entries(value).sort(([left],[right])=>left.localeCompare(right))
);
const hash=(value:Record<string,unknown>):string=>
  createHash('sha256').update(canonicalFlatJson(value),'utf8').digest('hex');
const mutationBase=(mutation:DistributedMutationEnvelope):Omit<DistributedMutationEnvelope,'mutationHash'>=>({
  mutationId:mutation.mutationId,idempotencyKey:mutation.idempotencyKey,clusterId:mutation.clusterId,
  familyId:mutation.familyId,entityType:mutation.entityType,entityId:mutation.entityId,
  entityVersion:mutation.entityVersion,globalSequence:mutation.globalSequence,actorPersonId:mutation.actorPersonId,
  deviceId:mutation.deviceId,schemaVersion:mutation.schemaVersion,policyVersion:mutation.policyVersion,
  revocationEpoch:mutation.revocationEpoch,keyEpoch:mutation.keyEpoch,payloadSha256:mutation.payloadSha256,
  previousHash:mutation.previousHash,occurredAt:mutation.occurredAt
});
const validMutation=(mutation:DistributedMutationEnvelope):boolean=>
  [mutation.mutationId,mutation.idempotencyKey,mutation.clusterId,mutation.familyId,mutation.entityType,
    mutation.entityId,mutation.actorPersonId,mutation.deviceId,mutation.policyVersion].every(value=>SAFE.test(value))
  &&[mutation.entityVersion,mutation.globalSequence,mutation.schemaVersion,mutation.keyEpoch].every(value=>safeInteger(value,1))
  &&safeInteger(mutation.revocationEpoch)&&SHA.test(mutation.payloadSha256)&&SHA.test(mutation.previousHash)
  &&SHA.test(mutation.mutationHash)&&canonicalIso(mutation.occurredAt)
  &&hash(mutationBase(mutation))===mutation.mutationHash;
const validCommittedRecord=(record:DistributedCommittedMutationRecord):boolean=>
  validMutation(record.mutation)&&SHA.test(record.requestFingerprint)&&safeInteger(record.commitIndex,1)
  &&SHA.test(record.providerEvidenceSha256)&&record.providerEvidenceSha256!==ZERO_SHA
  &&SHA.test(record.projectionSha256)&&record.projectionSha256!==ZERO_SHA&&SAFE.test(record.providerId);
const denied=(reason:string,provider:MatureRaftProviderPort,networkUsed:boolean|null=false,
  consensusCommitted=false):DistributedCoreMutationDecision=>Object.freeze({accepted:false,reason,
  providerId:provider.providerId,productionConsensusVerified:false,networkUsed,replayed:false,
  consensusCommitted,locallyApplied:false});

export const assertLocalProjectionDatabasePath=(databasePath:string):void=>{
  if(databasePath!==databasePath.trim()||databasePath.includes('\0')) {
    throw new Error('Distributed projection database path is not canonical');
  }
  const candidate=databasePath.replaceAll('/','\\');
  const upper=candidate.toUpperCase();
  const segments=candidate.split('\\');
  if(!/^[A-Za-z]:\\/u.test(candidate)||candidate.startsWith('\\\\')||upper.startsWith('\\\\?\\')
    ||upper.startsWith('\\\\.\\')||upper.includes('\\UNC\\')||segments.includes('..')||segments.includes('.')
    ||candidate.slice(2).includes(':')||!win32.isAbsolute(candidate)||win32.normalize(candidate)!==candidate) {
    throw new Error('Distributed projection database must be a canonical absolute local Windows path');
  }
};

export const unavailableMatureRaftProvider:MatureRaftProviderPort=Object.freeze({configured:false,
  providerId:'unavailable-mature-raft-provider',productionVerified:false,propose:()=>({accepted:false,
    majorityConfirmed:false,commitIndex:0,networkUsed:false,reason:'RAFT_PROVIDER_UNAVAILABLE'}),
  verifySnapshot:()=>({verified:false,networkUsed:false,reason:'RAFT_PROVIDER_UNAVAILABLE'})});

export class DistributedCoreClusterRuntime {
  #role:DistributedNodeRole='maintenance';#term=0;#fencingToken=0;#quorumHealthy=false;#safeMode=true;
  #isLeader():boolean{switch(this.#role){case 'leader':return true;default:return false;}}
  #advanceFence():void{this.#fencingToken=this.#fencingToken<Number.MAX_SAFE_INTEGER?this.#fencingToken+1:this.#fencingToken;}
  public constructor(private readonly options:{readonly clusterId:string;readonly familyId:string;readonly nodeId:string;
    readonly policyVersion:string;readonly revocationEpoch:number;readonly keyEpoch:number;
    readonly provider:MatureRaftProviderPort;readonly persistence:DistributedCorePersistencePort;
    readonly allowUnverifiedProviderForTests?:boolean}){
    for(const value of [options.clusterId,options.familyId,options.nodeId,options.policyVersion,options.provider.providerId]) {
      if(!SAFE.test(value))throw new Error('Distributed core identity is invalid');
    }
    if(!safeInteger(options.revocationEpoch)||!safeInteger(options.keyEpoch,1)) {
      throw new Error('Distributed core epoch is invalid');
    }
  }
  public assumeRole(input:{readonly role:DistributedNodeRole;readonly term:number;readonly fencingToken:number;
    readonly quorumHealthy:boolean}):void{
    if(!safeInteger(input.term)||!safeInteger(input.fencingToken,1)
      ||input.term<this.#term||input.fencingToken<=this.#fencingToken) {
      throw new Error('Stale or invalid leader term or fencing token');
    }
    this.#role=input.role;this.#term=input.term;this.#fencingToken=input.fencingToken;
    this.#quorumHealthy=input.quorumHealthy;this.#safeMode=this.#isLeader()?!input.quorumHealthy:false;
  }
  public loseQuorum():void{this.#quorumHealthy=false;this.#safeMode=true;this.#advanceFence();}
  public enterSafeMode():void{this.#safeMode=true;this.#advanceFence();}
  public state(){return Object.freeze({role:this.#role,term:this.#term,fencingToken:this.#fencingToken,
    quorumHealthy:this.#quorumHealthy,safeMode:this.#safeMode,writable:this.#isLeader()&&this.#quorumHealthy&&!this.#safeMode,
    raftProviderConfigured:this.options.provider.configured,
    providerProductionVerified:this.options.provider.productionVerified,
    syntheticProviderAllowed:this.options.allowUnverifiedProviderForTests===true,
    productionConsensusVerified:false as const});}
  public propose(input:DistributedCoreMutationInput):DistributedCoreMutationDecision{
    const provider=this.options.provider;
    if(!this.#validMutationInput(input))return denied('MUTATION_INVALID',provider);
    if(input.clusterId!==this.options.clusterId||input.familyId!==this.options.familyId) {
      return denied('TENANCY_MISMATCH',provider);
    }
    if(input.policyVersion!==this.options.policyVersion||input.revocationEpoch!==this.options.revocationEpoch
      ||input.keyEpoch!==this.options.keyEpoch)return denied('POLICY_OR_KEY_EPOCH_MISMATCH',provider);
    const requestFingerprint=this.#requestFingerprint(input);
    let replay:DistributedCommittedMutationRecord|null;
    let reusedMutation:DistributedCommittedMutationRecord|null;
    try {
      replay=this.options.persistence.findByIdempotencyKey(input.clusterId,input.familyId,input.idempotencyKey);
      reusedMutation=this.options.persistence.findByMutationId(input.clusterId,input.familyId,input.mutationId);
    } catch {
      this.enterSafeMode();return denied('PERSISTENCE_READ_FAILED',provider);
    }
    if(replay){
      if(replay.mutation.clusterId!==input.clusterId||replay.mutation.familyId!==input.familyId
        ||replay.requestFingerprint!==requestFingerprint)return denied('IDEMPOTENCY_KEY_REUSED',provider);
      if(!validCommittedRecord(replay)){this.enterSafeMode();return denied('PERSISTED_REPLAY_INVALID',provider);}
      return Object.freeze({accepted:true,reason:'REPLAYED_COMMITTED',mutation:replay.mutation,
        commitIndex:replay.commitIndex,projectionSha256:replay.projectionSha256,providerId:replay.providerId,
        productionConsensusVerified:false,networkUsed:false,replayed:true,consensusCommitted:true,locallyApplied:true});
    }
    if(reusedMutation)return denied('MUTATION_ID_REUSED',provider);
    if(!provider.configured)return denied('RAFT_PROVIDER_UNAVAILABLE',provider);
    if(!provider.productionVerified&&this.options.allowUnverifiedProviderForTests!==true) {
      return denied('RAFT_PROVIDER_UNVERIFIED',provider);
    }
    if(!this.#isLeader()||this.#safeMode||!this.#quorumHealthy)return denied('LEADER_NOT_WRITABLE',provider);
    if(input.term!==this.#term||input.fencingToken!==this.#fencingToken)return denied('STALE_FENCING_TOKEN',provider);
    let currentVersion:number;
    let previousRecord:DistributedCommittedMutationRecord|null;
    try {
      currentVersion=this.options.persistence.entityVersion(input.clusterId,input.familyId,input.entityType,input.entityId);
      previousRecord=this.options.persistence.head(input.clusterId,input.familyId);
    } catch {
      this.enterSafeMode();return denied('PERSISTENCE_READ_FAILED',provider);
    }
    if(!safeInteger(currentVersion)||currentVersion!==input.expectedEntityVersion) {
      return denied('ENTITY_VERSION_CONFLICT',provider);
    }
    if(previousRecord&&(!validCommittedRecord(previousRecord)
      ||previousRecord.mutation.clusterId!==input.clusterId||previousRecord.mutation.familyId!==input.familyId)) {
      this.enterSafeMode();return denied('PREVIOUS_CHAIN_INVALID',provider);
    }
    const previous=previousRecord?.mutation;
    const base=Object.freeze({mutationId:input.mutationId,idempotencyKey:input.idempotencyKey,
      clusterId:input.clusterId,familyId:input.familyId,entityType:input.entityType,entityId:input.entityId,
      entityVersion:currentVersion+1,globalSequence:(previous?.globalSequence??0)+1,actorPersonId:input.actorPersonId,
      deviceId:input.deviceId,schemaVersion:input.schemaVersion,policyVersion:input.policyVersion,
      revocationEpoch:input.revocationEpoch,keyEpoch:input.keyEpoch,payloadSha256:input.payloadSha256,
      previousHash:previous?.mutationHash??'0'.repeat(64),occurredAt:input.occurredAt});
    const mutation:DistributedMutationEnvelope=Object.freeze({...base,mutationHash:hash(base)});
    let proposed:MatureRaftProposalResult;
    try {
      proposed=provider.propose({clusterId:this.options.clusterId,nodeId:this.options.nodeId,term:this.#term,
        fencingToken:this.#fencingToken,mutation});
    } catch {
      this.enterSafeMode();return denied('RAFT_PROVIDER_ERROR',provider,null);
    }
    if(typeof proposed.networkUsed!=='boolean'||typeof proposed.accepted!=='boolean'
      ||typeof proposed.majorityConfirmed!=='boolean'||proposed.accepted!==proposed.majorityConfirmed) {
      this.enterSafeMode();return denied('RAFT_PROVIDER_EVIDENCE_INVALID',provider,null);
    }
    if(proposed.accepted!==true)return denied('MAJORITY_NOT_CONFIRMED',provider,proposed.networkUsed);
    if(!safeInteger(proposed.commitIndex,1)||!proposed.providerEvidenceSha256
      ||!SHA.test(proposed.providerEvidenceSha256)||proposed.providerEvidenceSha256===ZERO_SHA
      ||proposed.commitIndex<=(previousRecord?.commitIndex??0)) {
      this.enterSafeMode();return denied('RAFT_PROVIDER_EVIDENCE_INVALID',provider,proposed.networkUsed);
    }
    let projection:{readonly projectionSha256:string};
    try {
      projection=this.options.persistence.commitAndApply({mutation,requestFingerprint,commitIndex:proposed.commitIndex,
        providerEvidenceSha256:proposed.providerEvidenceSha256,providerId:provider.providerId});
    } catch {
      this.enterSafeMode();return denied('COMMITTED_LOCAL_APPLY_FAILED',provider,proposed.networkUsed,true);
    }
    if(!SHA.test(projection.projectionSha256)||projection.projectionSha256===ZERO_SHA){
      this.enterSafeMode();return denied('COMMITTED_LOCAL_PROJECTION_INVALID',provider,proposed.networkUsed,true);
    }
    return Object.freeze({accepted:true,reason:'COMMITTED',mutation,commitIndex:proposed.commitIndex,
      projectionSha256:projection.projectionSha256,providerId:provider.providerId,productionConsensusVerified:false,
      networkUsed:proposed.networkUsed,replayed:false,consensusCommitted:true,locallyApplied:true});
  }
  public verifyBootstrapSnapshot(input:{readonly snapshotSha256:string;readonly snapshotIndex:number;
    readonly policyVersion:string;readonly revocationEpoch:number;readonly keyEpoch:number}):
    DistributedSnapshotVerificationDecision{
    const provider=this.options.provider;
    if(!provider.configured)return Object.freeze({verified:false,reason:'RAFT_PROVIDER_UNAVAILABLE',
      providerId:provider.providerId,productionConsensusVerified:false,networkUsed:false});
    if(!provider.productionVerified&&this.options.allowUnverifiedProviderForTests!==true) {
      return Object.freeze({verified:false,reason:'RAFT_PROVIDER_UNVERIFIED',providerId:provider.providerId,
        productionConsensusVerified:false,networkUsed:false});
    }
    if(!SHA.test(input.snapshotSha256)||input.snapshotSha256===ZERO_SHA||!safeInteger(input.snapshotIndex,1)
      ||input.policyVersion!==this.options.policyVersion||input.revocationEpoch!==this.options.revocationEpoch
      ||input.keyEpoch!==this.options.keyEpoch) {
      return Object.freeze({verified:false,reason:'SNAPSHOT_INPUT_INVALID',providerId:provider.providerId,
        productionConsensusVerified:false,networkUsed:false});
    }
    let verified:MatureRaftSnapshotVerificationResult;
    try {
      verified=provider.verifySnapshot({clusterId:this.options.clusterId,...input});
    } catch {
      this.enterSafeMode();return Object.freeze({verified:false,reason:'RAFT_PROVIDER_ERROR',
        providerId:provider.providerId,productionConsensusVerified:false,networkUsed:null});
    }
    if(typeof verified.networkUsed!=='boolean'||verified.verified!==true
      ||!verified.providerEvidenceSha256||!SHA.test(verified.providerEvidenceSha256)
      ||verified.providerEvidenceSha256===ZERO_SHA) {
      return Object.freeze({verified:false,reason:verified.verified===false?'SNAPSHOT_NOT_VERIFIED':'SNAPSHOT_PROVIDER_EVIDENCE_INVALID',
        providerId:provider.providerId,productionConsensusVerified:false,
        networkUsed:typeof verified.networkUsed==='boolean'?verified.networkUsed:null});
    }
    return Object.freeze({verified:true,reason:'SNAPSHOT_VERIFIED',providerId:provider.providerId,
      providerEvidenceSha256:verified.providerEvidenceSha256,productionConsensusVerified:false,
      networkUsed:verified.networkUsed});
  }
  #validMutationInput(input:DistributedCoreMutationInput):boolean{
    return [input.mutationId,input.idempotencyKey,input.clusterId,input.familyId,input.entityType,input.entityId,
      input.actorPersonId,input.deviceId,input.policyVersion].every(value=>SAFE.test(value))
      &&safeInteger(input.expectedEntityVersion)&&safeInteger(input.schemaVersion,1)
      &&safeInteger(input.revocationEpoch)&&safeInteger(input.keyEpoch,1)&&safeInteger(input.term)
      &&safeInteger(input.fencingToken,1)&&SHA.test(input.payloadSha256)&&canonicalIso(input.occurredAt);
  }
  #requestFingerprint(input:DistributedCoreMutationInput):string{
    return hash({mutationId:input.mutationId,idempotencyKey:input.idempotencyKey,clusterId:input.clusterId,
      familyId:input.familyId,entityType:input.entityType,entityId:input.entityId,
      expectedEntityVersion:input.expectedEntityVersion,actorPersonId:input.actorPersonId,deviceId:input.deviceId,
      schemaVersion:input.schemaVersion,policyVersion:input.policyVersion,revocationEpoch:input.revocationEpoch,
      keyEpoch:input.keyEpoch,payloadSha256:input.payloadSha256,occurredAt:input.occurredAt});
  }
}
