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
  readonly headlessCoreServiceImplemented:true;readonly networkShareDatabaseOpenProhibited:true;
  readonly matureRaftProviderRequired:true;readonly customConsensusAlgorithmImplemented:false;
  readonly termAndFencingGuardImplemented:true;readonly appendOnlyMutationEnvelopeModeled:true;
  readonly deterministicProjectionHashRequired:true;readonly encryptedLocalProjectionRequired:true;
  readonly contentAddressedChunkReplicationModeled:true;readonly verifiedSnapshotBootstrapModeled:true;
  readonly versionedHttpsWebSocketGrpcContractsModeled:true;readonly deviceMtlsAndRevocationRequired:true;
  readonly zeroTrustLanRequired:true;readonly nodeRolesModeled:true;readonly readConsistencyClassesModeled:true;
  readonly explicitConflictResolutionRequired:true;readonly healthAndWatchdogModeled:true;
  readonly familyClusterTenancyIsolationRequired:true;readonly productionRaftProviderConfigured:false;
  readonly realMultiNodeQuorumVerified:false;readonly windowsServiceHostVerified:false;
  readonly productionMtlsCertificateIssued:false;readonly networkUsedByCurrentImplementation:false;
}
export const distributedCoreTruth=Object.freeze({headlessCoreServiceImplemented:true as const,
  networkShareDatabaseOpenProhibited:true as const,matureRaftProviderRequired:true as const,
  customConsensusAlgorithmImplemented:false as const,termAndFencingGuardImplemented:true as const,
  appendOnlyMutationEnvelopeModeled:true as const,deterministicProjectionHashRequired:true as const,
  encryptedLocalProjectionRequired:true as const,contentAddressedChunkReplicationModeled:true as const,
  verifiedSnapshotBootstrapModeled:true as const,versionedHttpsWebSocketGrpcContractsModeled:true as const,
  deviceMtlsAndRevocationRequired:true as const,zeroTrustLanRequired:true as const,nodeRolesModeled:true as const,
  readConsistencyClassesModeled:true as const,explicitConflictResolutionRequired:true as const,
  healthAndWatchdogModeled:true as const,familyClusterTenancyIsolationRequired:true as const,
  productionRaftProviderConfigured:false as const,realMultiNodeQuorumVerified:false as const,
  windowsServiceHostVerified:false as const,productionMtlsCertificateIssued:false as const,
  networkUsedByCurrentImplementation:false as const});

export const distributedInstallProfile=(fullNodes:number,witnesses:number):DistributedInstallProfile|null=>
  fullNodes===1&&witnesses===0?'single_node':fullNodes===2&&witnesses===1?'two_full_plus_witness':
    fullNodes>=3&&witnesses===0?'three_full_node':null;
export const automaticFailoverAvailable=(profile:DistributedInstallProfile):boolean=>profile!=='single_node';
export const distributedReadConsistency=(resourceType:string):DistributedReadConsistency=>
  /finance|health|policy|permission|security|credential|consent/iu.test(resourceType)?'strong':
    /thumbnail|summary|preview/iu.test(resourceType)?'bounded_stale':'offline_read';
export const distributedNodeRoleAllowed=(role:DistributedNodeRole,input:{readonly appleClient:boolean;readonly fullDataNode:boolean}):boolean=>
  !input.appleClient&&(input.fullDataNode?!['witness'].includes(role):['witness','backup_only','maintenance'].includes(role));
const isDistributedLeaderRole=(value:DistributedNodeRole):boolean=>{switch(value){case 'leader':return true;default:return false;}};
export const evaluateDistributedHealth=(node:DistributedClusterNodeView,input:{readonly quorumHealthy:boolean;
  readonly dependencyHealthy:boolean;readonly nowMs:number;readonly certificateExpiryMs:number}):DistributedClusterHealthView=>{
  const reasons:string[]=[];if(!node.liveness)reasons.push('LIVENESS_FAILED');if(!node.readiness)reasons.push('READINESS_FAILED');
  if(!input.quorumHealthy)reasons.push('QUORUM_UNAVAILABLE');if(node.replicationLag>1000)reasons.push('REPLICATION_LAG_HIGH');
  if(node.diskFreeBytes<2*1024*1024*1024)reasons.push('DISK_LOW');if(node.certificateRevoked||input.certificateExpiryMs-input.nowMs<86_400_000)reasons.push('CERTIFICATE_UNHEALTHY');
  if(node.backupAgeMinutes>24*60)reasons.push('BACKUP_STALE');if(!input.dependencyHealthy)reasons.push('DEPENDENCY_UNHEALTHY');
  if(node.safeMode)reasons.push('SAFE_MODE');const unhealthy=reasons.some(reason=>['LIVENESS_FAILED','QUORUM_UNAVAILABLE','CERTIFICATE_UNHEALTHY'].includes(reason));
  return Object.freeze({state:unhealthy?'unhealthy':reasons.length?'degraded':'healthy',writable:isDistributedLeaderRole(node.role)&&input.quorumHealthy&&!node.safeMode,
    quorumHealthy:input.quorumHealthy,replicationLag:node.replicationLag,diskHealthy:node.diskFreeBytes>=2*1024*1024*1024,
    certificateHealthy:!node.certificateRevoked&&input.certificateExpiryMs-input.nowMs>=86_400_000,backupFresh:node.backupAgeMinutes<=24*60,
    dependencyHealthy:input.dependencyHealthy,safeMode:node.safeMode,reasons:Object.freeze(reasons)});
};
