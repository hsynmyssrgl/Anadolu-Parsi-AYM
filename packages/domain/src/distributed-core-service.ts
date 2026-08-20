export type DistributedNodeRole = 'leader'|'follower'|'read_replica'|'witness'|'backup_only'|'maintenance';
export type DistributedInstallProfile = 'single_node'|'two_full_plus_witness'|'three_full_node';
export type DistributedReadConsistency = 'strong'|'bounded_stale'|'offline_read';
export type DistributedHealthState = 'healthy'|'degraded'|'unhealthy';

export interface DistributedClusterNodeView {
  readonly nodeId:string;readonly clusterId:string;readonly familyId:string;readonly role:DistributedNodeRole;
  readonly voter:boolean;readonly appleClient:false;readonly term:number;readonly fencingToken:number;
  readonly commitIndex:number;readonly appliedIndex:number;readonly replicationLag:number;readonly diskFreeBytes:number;
  readonly certificateExpiresAt:string;readonly certificateRevoked:boolean;readonly backupAgeMinutes:number;
  readonly liveness:boolean;readonly readiness:boolean;readonly safeMode:boolean;
}
export interface DistributedMutationEnvelope {
  readonly mutationId:string;readonly idempotencyKey:string;readonly clusterId:string;readonly familyId:string;
  readonly entityType:string;readonly entityId:string;readonly entityVersion:number;readonly globalSequence:number;
  readonly actorPersonId:string;readonly deviceId:string;readonly schemaVersion:number;readonly policyVersion:string;
  readonly revocationEpoch:number;readonly keyEpoch:number;readonly payloadSha256:string;readonly previousHash:string;
  readonly mutationHash:string;readonly occurredAt:string;
}
export interface DistributedClusterHealthView {
  readonly state:DistributedHealthState;readonly writable:boolean;readonly quorumHealthy:boolean;
  readonly replicationLag:number;readonly diskHealthy:boolean;readonly certificateHealthy:boolean;
  readonly backupFresh:boolean;readonly dependencyHealthy:boolean;readonly safeMode:boolean;readonly reasons:readonly string[];
}
export interface DistributedCoreTruthView {
  readonly headlessCoreServiceImplemented:true;readonly networkSharePathLexicallyRejected:true;
  readonly localVolumeIdentityVerified:false;
  readonly matureRaftProviderRequired:true;readonly customConsensusAlgorithmImplemented:false;
  readonly termAndFencingGuardImplemented:true;readonly appendOnlyMutationEnvelopeModeled:true;
  readonly durableIdempotencyRequired:true;readonly atomicLocalCommitProjectionRequired:true;
  readonly providerNetworkUseEvidenceRequired:true;readonly productionRuntimeComposed:false;
  readonly deterministicProjectionHashRequired:true;readonly encryptedLocalProjectionRequired:true;
  readonly contentAddressedChunkReplicationModeled:true;readonly verifiedSnapshotBootstrapModeled:true;
  readonly versionedHttpsWebSocketGrpcContractsModeled:true;readonly deviceMtlsAndRevocationRequired:true;
  readonly zeroTrustLanRequired:true;readonly nodeRolesModeled:true;readonly readConsistencyClassesModeled:true;
  readonly explicitConflictResolutionRequired:true;readonly healthAndWatchdogModeled:true;
  readonly familyClusterTenancyIsolationRequired:true;readonly productionRaftProviderConfigured:false;
  readonly windowsServiceHostImplemented:true;
  readonly realMultiNodeQuorumVerified:false;readonly windowsServiceHostVerified:false;
  readonly productionMtlsCertificateIssued:false;readonly networkUsedByCurrentImplementation:false;
}
export const distributedCoreTruth=Object.freeze({headlessCoreServiceImplemented:true as const,
  networkSharePathLexicallyRejected:true as const,localVolumeIdentityVerified:false as const,
  matureRaftProviderRequired:true as const,
  customConsensusAlgorithmImplemented:false as const,termAndFencingGuardImplemented:true as const,
  appendOnlyMutationEnvelopeModeled:true as const,durableIdempotencyRequired:true as const,
  atomicLocalCommitProjectionRequired:true as const,providerNetworkUseEvidenceRequired:true as const,
  productionRuntimeComposed:false as const,deterministicProjectionHashRequired:true as const,
  encryptedLocalProjectionRequired:true as const,contentAddressedChunkReplicationModeled:true as const,
  verifiedSnapshotBootstrapModeled:true as const,versionedHttpsWebSocketGrpcContractsModeled:true as const,
  deviceMtlsAndRevocationRequired:true as const,zeroTrustLanRequired:true as const,nodeRolesModeled:true as const,
  readConsistencyClassesModeled:true as const,explicitConflictResolutionRequired:true as const,
  healthAndWatchdogModeled:true as const,familyClusterTenancyIsolationRequired:true as const,
  windowsServiceHostImplemented:true as const,
  productionRaftProviderConfigured:false as const,realMultiNodeQuorumVerified:false as const,
  windowsServiceHostVerified:false as const,productionMtlsCertificateIssued:false as const,
  networkUsedByCurrentImplementation:false as const});

const safeCount=(value:number):boolean=>Number.isSafeInteger(value)&&value>=0;
export const distributedInstallProfile=(fullNodes:number,witnesses:number):DistributedInstallProfile|null=>
  !safeCount(fullNodes)||!safeCount(witnesses)?null:
    fullNodes===1&&witnesses===0?'single_node':fullNodes===2&&witnesses===1?'two_full_plus_witness':
      fullNodes>=3&&witnesses===0?'three_full_node':null;
export const automaticFailoverTopologyEligible=(profile:DistributedInstallProfile):boolean=>profile!=='single_node';
export const automaticFailoverAvailable=(profile:DistributedInstallProfile,input:{readonly providerConfigured:boolean;
  readonly quorumHealthy:boolean;readonly realMultiNodeVerified:boolean}):boolean=>
  automaticFailoverTopologyEligible(profile)&&input.providerConfigured&&input.quorumHealthy&&input.realMultiNodeVerified;
const boundedStaleResources=new Set(['thumbnail','thumbnail_metadata','summary','summary_metadata','preview','preview_metadata']);
const offlineReadResources=new Set(['offline_help','local_help','cached_reference']);
export const distributedReadConsistency=(resourceType:string):DistributedReadConsistency=>{
  const normalized=resourceType.trim().toLowerCase();
  if(boundedStaleResources.has(normalized))return 'bounded_stale';
  if(offlineReadResources.has(normalized))return 'offline_read';
  return 'strong';
};
export const distributedNodeRoleAllowed=(role:DistributedNodeRole,input:{readonly appleClient:boolean;readonly fullDataNode:boolean}):boolean=>
  !input.appleClient&&(input.fullDataNode?!['witness'].includes(role):['witness','backup_only','maintenance'].includes(role));
const isDistributedLeaderRole=(value:DistributedNodeRole):boolean=>{switch(value){case 'leader':return true;default:return false;}};
export const evaluateDistributedHealth=(node:DistributedClusterNodeView,input:{readonly quorumHealthy:boolean;
  readonly dependencyHealthy:boolean;readonly nowMs:number}):DistributedClusterHealthView=>{
  const certificateExpiryMs=Date.parse(node.certificateExpiresAt);
  const numericState=[node.term,node.fencingToken,node.commitIndex,node.appliedIndex,node.replicationLag,node.diskFreeBytes,
    node.backupAgeMinutes,input.nowMs];
  const nodeStateValid=numericState.every(value=>Number.isSafeInteger(value)&&value>=0)
    &&node.appliedIndex<=node.commitIndex&&Number.isFinite(certificateExpiryMs);
  const reasons:string[]=[];if(!nodeStateValid)reasons.push('NODE_STATE_INVALID');
  if(!node.liveness)reasons.push('LIVENESS_FAILED');if(!node.readiness)reasons.push('READINESS_FAILED');
  if(!input.quorumHealthy)reasons.push('QUORUM_UNAVAILABLE');if(node.replicationLag>1000)reasons.push('REPLICATION_LAG_HIGH');
  if(node.diskFreeBytes<2*1024*1024*1024)reasons.push('DISK_LOW');if(node.certificateRevoked||certificateExpiryMs-input.nowMs<86_400_000)reasons.push('CERTIFICATE_UNHEALTHY');
  if(node.backupAgeMinutes>24*60)reasons.push('BACKUP_STALE');if(!input.dependencyHealthy)reasons.push('DEPENDENCY_UNHEALTHY');
  if(node.safeMode)reasons.push('SAFE_MODE');const unhealthy=reasons.some(reason=>
    ['NODE_STATE_INVALID','LIVENESS_FAILED','QUORUM_UNAVAILABLE','CERTIFICATE_UNHEALTHY'].includes(reason));
  const operationallyWritable=nodeStateValid&&node.liveness&&node.readiness&&input.quorumHealthy
    &&node.replicationLag<=1000&&node.diskFreeBytes>=2*1024*1024*1024&&!node.certificateRevoked
    &&certificateExpiryMs-input.nowMs>=86_400_000&&input.dependencyHealthy&&!node.safeMode;
  return Object.freeze({state:unhealthy?'unhealthy':reasons.length?'degraded':'healthy',writable:isDistributedLeaderRole(node.role)&&operationallyWritable,
    quorumHealthy:input.quorumHealthy,replicationLag:node.replicationLag,diskHealthy:node.diskFreeBytes>=2*1024*1024*1024,
    certificateHealthy:!node.certificateRevoked&&certificateExpiryMs-input.nowMs>=86_400_000,backupFresh:node.backupAgeMinutes<=24*60,
    dependencyHealthy:input.dependencyHealthy,safeMode:node.safeMode,reasons:Object.freeze(reasons)});
};
