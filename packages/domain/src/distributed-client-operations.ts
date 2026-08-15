export type DistributedDiscoveryMode='mdns'|'manual_ip'|'qr';
export type DistributedFaultScenario='network_partition'|'power_loss'|'disk_full'|'corruption'|'clock_skew'|'certificate_expiry'|'rolling_update';
export interface DistributedDiscoveryCandidateView{readonly nodeId:string;readonly addressHint:string;readonly mode:DistributedDiscoveryMode;
  readonly trustedByDiscovery:false;readonly requiresMtlsPairing:true;}
export interface DistributedRemoteConnectivityView{readonly enabled:boolean;readonly mode:'disabled'|'outbound_relay'|'user_vpn';
  readonly inboundPortRequired:false;readonly relayCanDecryptFamilyContent:false;readonly deviceRevocationRequired:true;
  readonly providerConfigured:false;readonly connected:false;}
export interface DistributedAppleClientView{readonly clientId:string;readonly platform:'macos'|'iphone'|'ipad';readonly mode:'read_only';
  readonly encryptedCacheRequired:true;readonly lastVerifiedSyncAt?:string;readonly stale:boolean;readonly independentSourceOfTruth:false;
  readonly coreServiceAuthorizationRequired:true;readonly atsExceptionAllowed:false;readonly secureEnclaveKeyRequired:true;
  readonly apnsPayloadContentFree:true;readonly pushDeliveryGuaranteed:false;}
export interface DistributedBackupEvidenceView{readonly id:string;readonly kind:'local'|'external'|'offline'|'offsite';readonly immutable:boolean;
  readonly independentFromReplica:true;readonly manifestSha256:string;readonly verifiedAt:string;readonly keyEpoch:number;
  readonly policyVersion:string;readonly restoreTested:boolean;readonly realDifferentDeviceRestoreVerified:false;}
export interface DistributedRecoveryProfileView{readonly profile:'single_node'|'three_node';readonly targetRpo:string;readonly targetRtoSeconds:number;
  readonly manualBreakGlassRequiresWarning:true;readonly recoveryQuorumRequired:true;readonly realDrillVerified:false;}
export interface DistributedRollingUpdatePlanView{readonly nodeOrder:readonly string[];readonly leaderLast:true;readonly nMinusOneCompatibilityRequired:true;
  readonly signedPackageRequired:true;readonly rollbackRequired:true;readonly schemaMigrationLeaderAndQuorumOnly:true;
  readonly realUpdateExecuted:false;}
export interface DistributedSyncBudgetView{readonly meteredNetworkAllowed:boolean;readonly batteryMinimumPercent:number;readonly uploadLimitKbps:number;
  readonly quietHoursStart:string;readonly quietHoursEnd:string;readonly metadataBeforeMedia:true;}
export interface DistributedOperationsTruthView{readonly discoveryIsAddressHintNotTrust:true;readonly manualDiscoveryFallbackModeled:true;
  readonly remoteConnectivityDefaultDisabled:true;readonly outboundOnlyRelayOrUserVpnRequired:true;readonly controlPlaneContentProhibited:true;
  readonly appleClientsReadOnly:true;readonly coreServiceDenialCannotBeBypassed:true;readonly contentFreeWakeRequired:true;
  readonly atsExceptionsProhibited:true;readonly localFirstObservabilityContentFree:true;readonly replicaIsNotBackup:true;
  readonly immutableOfflineOffsiteBackupModeled:true;readonly breakGlassRecoveryModeled:true;readonly rollingUpdateOrderingModeled:true;
  readonly monotonicTimeRequired:true;readonly adaptiveSyncBudgetModeled:true;readonly faultInjectionMatrixModeled:true;
  readonly productionDiscoveryProviderConfigured:false;readonly productionRelayConfigured:false;readonly appleApplicationBuilt:false;
  readonly realWindowsFaultMatrixExecuted:false;readonly realDifferentDeviceRestoreVerified:false;readonly networkUsedByCurrentImplementation:false;}
export const distributedOperationsTruth=Object.freeze({discoveryIsAddressHintNotTrust:true as const,manualDiscoveryFallbackModeled:true as const,
  remoteConnectivityDefaultDisabled:true as const,outboundOnlyRelayOrUserVpnRequired:true as const,controlPlaneContentProhibited:true as const,
  appleClientsReadOnly:true as const,coreServiceDenialCannotBeBypassed:true as const,contentFreeWakeRequired:true as const,
  atsExceptionsProhibited:true as const,localFirstObservabilityContentFree:true as const,replicaIsNotBackup:true as const,
  immutableOfflineOffsiteBackupModeled:true as const,breakGlassRecoveryModeled:true as const,rollingUpdateOrderingModeled:true as const,
  monotonicTimeRequired:true as const,adaptiveSyncBudgetModeled:true as const,faultInjectionMatrixModeled:true as const,
  productionDiscoveryProviderConfigured:false as const,productionRelayConfigured:false as const,appleApplicationBuilt:false as const,
  realWindowsFaultMatrixExecuted:false as const,realDifferentDeviceRestoreVerified:false as const,networkUsedByCurrentImplementation:false as const});
export const createDistributedDiscoveryCandidate=(input:{readonly nodeId:string;readonly addressHint:string;readonly mode:DistributedDiscoveryMode}):DistributedDiscoveryCandidateView=>
  Object.freeze({...input,trustedByDiscovery:false,requiresMtlsPairing:true});
export const distributedRemoteConnectivity=(input:{readonly enabled:boolean;readonly mode:'outbound_relay'|'user_vpn'}):DistributedRemoteConnectivityView=>
  Object.freeze({enabled:input.enabled,mode:input.enabled?input.mode:'disabled',inboundPortRequired:false,relayCanDecryptFamilyContent:false,
    deviceRevocationRequired:true,providerConfigured:false,connected:false});
export const distributedAppleClient=(input:{readonly clientId:string;readonly platform:DistributedAppleClientView['platform'];readonly lastVerifiedSyncAt?:string;
  readonly stale:boolean}):DistributedAppleClientView=>Object.freeze({...input,mode:'read_only',encryptedCacheRequired:true,independentSourceOfTruth:false,
    coreServiceAuthorizationRequired:true,atsExceptionAllowed:false,secureEnclaveKeyRequired:true,apnsPayloadContentFree:true,pushDeliveryGuaranteed:false});
export const distributedRecoveryProfile=(profile:'single_node'|'three_node'):DistributedRecoveryProfileView=>Object.freeze({profile,
  targetRpo:profile==='three_node'?'0 committed events':'last verified backup',targetRtoSeconds:profile==='three_node'?120:3600,
  manualBreakGlassRequiresWarning:true,recoveryQuorumRequired:true,realDrillVerified:false});
const isDistributedLeaderRole=(value:string):boolean=>{switch(value){case 'leader':return true;default:return false;}};
export const planDistributedRollingUpdate=(nodes:readonly {readonly nodeId:string;readonly role:string}[]):DistributedRollingUpdatePlanView=>{
  const followers=nodes.filter(node=>!isDistributedLeaderRole(node.role)).map(node=>node.nodeId).sort();
  const leaders=nodes.filter(node=>isDistributedLeaderRole(node.role)).map(node=>node.nodeId).sort();
  if(leaders.length!==1)throw new Error('Rolling update requires exactly one leader');return Object.freeze({nodeOrder:Object.freeze([...followers,...leaders]),
    leaderLast:true,nMinusOneCompatibilityRequired:true,signedPackageRequired:true,rollbackRequired:true,schemaMigrationLeaderAndQuorumOnly:true,
    realUpdateExecuted:false});};
export const validateDistributedSyncBudget=(input:DistributedSyncBudgetView):boolean=>Number.isInteger(input.batteryMinimumPercent)
  &&input.batteryMinimumPercent>=10&&input.batteryMinimumPercent<=100&&Number.isInteger(input.uploadLimitKbps)&&input.uploadLimitKbps>=64
  &&input.uploadLimitKbps<=1_000_000&&/^([01]\d|2[0-3]):[0-5]\d$/u.test(input.quietHoursStart)
  &&/^([01]\d|2[0-3]):[0-5]\d$/u.test(input.quietHoursEnd)&&input.metadataBeforeMedia===true;
