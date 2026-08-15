import type { DistributedBackupEvidenceView,DistributedDiscoveryCandidateView,DistributedFaultScenario,
  DistributedRemoteConnectivityView,DistributedSyncBudgetView } from '@ppt/domain';
import { createDistributedDiscoveryCandidate,distributedRemoteConnectivity,planDistributedRollingUpdate,
  validateDistributedSyncBudget } from '@ppt/domain';
export interface DistributedDiscoveryProviderPort{readonly configured:boolean;discover():readonly {readonly nodeId:string;readonly addressHint:string}[];}
export interface DistributedRelayProviderPort{readonly configured:boolean;connect(input:{readonly clusterId:string;readonly deviceId:string;
  readonly outboundOnly:true;readonly encryptedEnvelopeOnly:true}):boolean;disconnect(deviceId:string):void;}
export interface DistributedClientAuthorizationPort{authorizeRead(input:{readonly clusterId:string;readonly familyId:string;readonly clientId:string;
  readonly deviceCertificateId:string;readonly policyVersion:string;readonly keyEpoch:number;readonly resourceType:string;readonly resourceId:string}):boolean;}
export interface DistributedFaultInjectionPort{readonly syntheticOnly:true;run(scenario:DistributedFaultScenario):{readonly contained:boolean;readonly evidenceSha256:string};}
export const unavailableDistributedDiscoveryProvider:DistributedDiscoveryProviderPort=Object.freeze({configured:false,discover:()=>Object.freeze([])});
export const unavailableDistributedRelayProvider:DistributedRelayProviderPort=Object.freeze({configured:false,connect:()=>false,disconnect:()=>undefined});
export const denyAllDistributedClientAuthorization:DistributedClientAuthorizationPort=Object.freeze({authorizeRead:()=>false});
const SAFE=/^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,255}$/u;const SHA=/^[0-9a-f]{64}$/u;
export class DistributedOperationsRuntime{
  #lastMonotonic=0;#backups:DistributedBackupEvidenceView[]=[];
  public constructor(private readonly options:{readonly clusterId:string;readonly familyId:string;readonly policyVersion:string;
    readonly keyEpoch:number;readonly discovery:DistributedDiscoveryProviderPort;readonly relay:DistributedRelayProviderPort;
    readonly authorization:DistributedClientAuthorizationPort;readonly faultInjection?:DistributedFaultInjectionPort}){
    if(![options.clusterId,options.familyId,options.policyVersion].every(value=>SAFE.test(value))||options.keyEpoch<1)throw new Error('Distributed operations identity is invalid');}
  public discover():readonly DistributedDiscoveryCandidateView[]{if(!this.options.discovery.configured)return Object.freeze([]);
    return Object.freeze(this.options.discovery.discover().slice(0,64).map(candidate=>createDistributedDiscoveryCandidate({...candidate,mode:'mdns'})));}
  public manualCandidate(input:{readonly nodeId:string;readonly addressHint:string;readonly mode:'manual_ip'|'qr'}):DistributedDiscoveryCandidateView{
    if(!SAFE.test(input.nodeId)||typeof input.addressHint!=='string'||input.addressHint.trim().length<2||input.addressHint.length>512)
      throw new Error('Manual discovery candidate is invalid');return createDistributedDiscoveryCandidate(input);}
  public remotePolicy(enabled:boolean,mode:'outbound_relay'|'user_vpn'):DistributedRemoteConnectivityView{return distributedRemoteConnectivity({enabled,mode});}
  public connectRemote(input:{readonly enabled:boolean;readonly mode:'outbound_relay'|'user_vpn';readonly deviceId:string}):boolean{
    if(!input.enabled||!this.options.relay.configured||!SAFE.test(input.deviceId))return false;
    return this.options.relay.connect({clusterId:this.options.clusterId,deviceId:input.deviceId,outboundOnly:true,encryptedEnvelopeOnly:true});}
  public authorizeAppleRead(input:{readonly clientId:string;readonly deviceCertificateId:string;readonly resourceType:string;
    readonly resourceId:string}):boolean{if(![input.clientId,input.deviceCertificateId,input.resourceType,input.resourceId].every(value=>SAFE.test(value)))return false;
    return this.options.authorization.authorizeRead({clusterId:this.options.clusterId,familyId:this.options.familyId,
      policyVersion:this.options.policyVersion,keyEpoch:this.options.keyEpoch,...input});}
  public validateControlPlaneEnvelope(value:unknown):boolean{if(!value||typeof value!=='object'||Array.isArray(value))return false;
    const envelope=value as Record<string,unknown>;const keys=Object.keys(envelope).sort();const allowed=['certificateRevocationEpoch','clusterId','encryptedEnvelopeSha256',
      'healthState','nodeId','wakeTokenSha256','witnessVote'];if(keys.some(key=>!allowed.includes(key)))return false;
    const serialized=JSON.stringify(envelope);return serialized.length<=4096&&!/content|message|document|photo|video|payload|plaintext|title|note/iu.test(keys.join('|'));
  }
  public registerBackup(evidence:DistributedBackupEvidenceView):void{if(!SAFE.test(evidence.id)||!SHA.test(evidence.manifestSha256)
    ||!evidence.independentFromReplica||evidence.keyEpoch!==this.options.keyEpoch||evidence.policyVersion!==this.options.policyVersion)
    throw new Error('Backup evidence is not independent or epoch-compatible');if(this.#backups.some(item=>item.id===evidence.id))throw new Error('Backup evidence is immutable');
    this.#backups.push(Object.freeze(evidence));}
  public backups():readonly DistributedBackupEvidenceView[]{return Object.freeze([...this.#backups]);}
  public rollingUpdate(nodes:readonly {readonly nodeId:string;readonly role:string}[]){return planDistributedRollingUpdate(nodes);}
  public observeMonotonic(timestamp:number):boolean{if(!Number.isFinite(timestamp)||timestamp<this.#lastMonotonic)return false;this.#lastMonotonic=timestamp;return true;}
  public setSyncBudget(input:DistributedSyncBudgetView):DistributedSyncBudgetView{if(!validateDistributedSyncBudget(input))throw new Error('Distributed sync budget is invalid');
    return Object.freeze({...input});}
  public runSyntheticFault(scenario:DistributedFaultScenario){const provider=this.options.faultInjection;if(!provider)return Object.freeze({executed:false,
    contained:false,realWindowsNode:false,evidenceSha256:null});const result=provider.run(scenario);return Object.freeze({executed:true,contained:result.contained,
      realWindowsNode:false,evidenceSha256:SHA.test(result.evidenceSha256)?result.evidenceSha256:null});}
}
