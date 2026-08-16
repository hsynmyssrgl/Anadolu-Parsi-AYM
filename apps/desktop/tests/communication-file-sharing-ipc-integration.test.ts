import { describe, expect, it } from 'vitest';
import {
  COMMUNICATION_FILE_SHARING_IPC_CHANNELS,
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy.js';
import {
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';

const occurredAt='2026-08-16T08:00:00.000Z';
const operation={clientOperationId:'operation-file-sharing-0001',expectedRevision:0} as const;
const apply=(command:Record<string,unknown>)=>evaluateIpcIntegrationPolicy(
  COMMUNICATION_FILE_SHARING_IPC_CHANNELS.apply,[{...operation,command}]);
const rendererCommands:readonly Record<string,unknown>[]=[
  {kind:'add_comment',fileId:'file-0001',commentId:'comment-0001',body:'Aile yorumu'},
  {kind:'grant_access',fileId:'file-0001',grantId:'grant-0001',personId:'person-0002',mode:'preview_only',
    startsAt:occurredAt,endsAt:'2026-08-16T09:00:00.000Z'},
  {kind:'revoke_share',fileId:'file-0001'},
  {kind:'link_archive',fileId:'file-0001',archiveItemId:'archive-0001'},
  {kind:'update_album',fileId:'file-0001',albumId:'album-0001',selectedForStory:true,
    likedByPersonIds:['person-0001','person-0002']},
  {kind:'set_notifications',quietHoursEnabled:true,quietHoursStart:'22:00',quietHoursEnd:'07:00',
    nonEmergencyDigestEnabled:true,roomOverrides:[{roomId:'room-0001',muted:true}],
    personOverrides:[{personId:'person-0002',muted:false}]},
  {kind:'announce_emergency',announcementId:'announcement-0001',title:'Aile içi acil duyuru'},
  {kind:'acknowledge_emergency',announcementId:'announcement-0001'},
  {kind:'request_remote_assistance',sessionId:'remote-0001',helperPersonId:'person-0002',
    allowedControls:['annotate','pointer'],endsAt:'2026-08-16T08:15:00.000Z'},
  {kind:'grant_remote_assistance',sessionId:'remote-0001',explicitSingleUseConsent:true},
  {kind:'revoke_remote_assistance',sessionId:'remote-0001'},
  {kind:'plan_co_watch',sessionId:'watch-0001',mediaReference:'local-media-reference',narrationEnabled:true},
  {kind:'prepare_voice_action',actionId:'voice-0001',action:'call',targetReference:'person-0002'},
  {kind:'confirm_voice_action',actionId:'voice-0001',explicitConfirmation:true}
];

const truth=Object.freeze({
  e2eeEnvelopeMetadataRequired:true,
  resumableChunkAndFullHashVerificationModeled:true,
  versionCommentRelationAndSingleArchiveCopyModeled:true,
  timeBoundPreviewAndDownloadGrantsModeled:true,
  localMalwareQuarantineGateModeled:true,
  albumSelectionLikesAndStoryTransferModeled:true,
  externalLinksDefaultClosed:true,
  externalLinksRequireExpiryAndAccessCode:true,
  quietHoursAndNonEmergencyDigestModeled:true,
  emergencyAnnouncementNotEmergencyService:true,
  remoteAssistanceSingleUseConsentRequired:true,
  remoteAssistanceSensitiveDesktopHidden:true,
  voiceActionConfirmationRequired:true,
  productionFileTransportConfigured:false,
  productionMalwareScannerConfigured:false,
  remoteAssistanceTransportConfigured:false,
  sharePlayAdapterConfigured:false,
  voiceExecutionProviderConfigured:false,
  networkUsedByCurrentImplementation:false
});
const center={schemaVersion:1,files:[{id:'file-0001',roomId:'room-0001',displayName:'Aile belgesi.pdf',
  mimeType:'application/pdf',totalBytes:4_096,totalChunks:1,verifiedChunkCount:1,state:'scan_required',
  scanState:'provider_unavailable',versionCount:1,comments:[{id:'comment-0001',authorPersonId:'person-0001',
    body:'Yerel yorum',createdAt:occurredAt}],accessGrants:[],selectedForStory:false,likedByPersonIds:[],
  externalLinkEnabled:false,externalLinkAccessCodeRequired:true,revision:1,createdAt:occurredAt,updatedAt:occurredAt}],
  notificationProfile:{quietHoursEnabled:true,quietHoursStart:'22:00',quietHoursEnd:'07:00',
    nonEmergencyDigestEnabled:true,roomOverrides:[{roomId:'room-0001',muted:false}],personOverrides:[]},
  emergencyAnnouncements:[{id:'announcement-0001',title:'Aile içi acil duyuru',createdByPersonId:'person-0001',
    acknowledgedPersonIds:['person-0001'],emergencyServiceGuaranteed:false,localDeliveryOnly:true,createdAt:occurredAt}],
  remoteAssistance:[{id:'remote-0001',requesterPersonId:'person-0001',helperPersonId:'person-0002',
    state:'consent_pending',singleUseConsent:true,visibleIndicatorRequired:true,secureDesktopAndPasswordsHidden:true,
    allowedControls:['pointer'],endsAt:'2026-08-16T08:15:00.000Z',remoteTransportConfigured:false}],
  coWatchSessions:[{id:'watch-0001',mediaReference:'local-media-reference',narrationEnabled:true,
    state:'local_plan',sharePlayAdapterConfigured:false}],
  voiceActions:[{id:'voice-0001',action:'call',targetReference:'person-0002',state:'confirmation_required',
    executedExternally:false}],truth,revision:1,generatedAt:occurredAt};
const receipt={commandKind:'add_comment',previousRevision:0,revision:1,occurredAt,replayed:false,
  externalOperationPerformed:false,networkUsed:false};
const preview={schemaVersion:1,fileId:'file-0001',displayName:'Plan.txt',mimeType:'text/plain',text:'Aile planı\nSatır 2',
  totalBytes:20,scanState:'clean',accessMode:'owner',renderingMode:'escaped_plain_text',truncated:false,
  payloadSource:'local_protected_payload',networkUsed:false,cloudUsed:false};

describe('34-G communication file-sharing IPC boundary',()=>{
  it('accepts the four exact channels and every renderer-authorized command',()=>{
    expect(evaluateIpcIntegrationPolicy(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.getCenter,[])).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.getSafePreview,[{fileId:'file-0001'}]))
      .toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.selectAndPrepare,[{
      ...operation,roomId:'room-0001'}])).toEqual({accepted:true});
    for(const command of rendererCommands)expect(apply(command),String(command.kind)).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy('communicationFileSharing:future',[])).toMatchObject({accepted:false,
      reason:'UNKNOWN_IPC_CHANNEL'});
  });

  it('rejects renderer bytes, paths, sealed references, hashes and main-only commands',()=>{
    for(const forbidden of [
      {kind:'prepare_file',fileId:'file-0001'},
      {kind:'record_chunk',fileId:'file-0001'},
      {kind:'set_scan',fileId:'file-0001'},
      {kind:'add_version',fileId:'file-0001'}
    ])expect(apply(forbidden)).toMatchObject({accepted:false});
    for(const [field,value] of [
      ['rawBytes',[1,2,3]],['sourcePath','C:\\private\\family.pdf'],['sealedPayloadReference','secret-ref'],
      ['fullContentSha256','a'.repeat(64)],['providerEvidenceSha256','b'.repeat(64)],['familyId','family-forged'],
      ['accountId','account-forged'],['ownerPersonId','person-forged']
    ] as const)expect(evaluateIpcIntegrationPolicy(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.selectAndPrepare,[{
      ...operation,roomId:'room-0001',[field]:value}]),field).toMatchObject({accepted:false});
  });

  it('rejects inherited, accessor, prototype-key and nested secret objects before dispatch',()=>{
    const base={...operation,roomId:'room-0001'};
    const inherited=Object.assign(Object.create({familyId:'family-forged'}) as Record<string,unknown>,base);
    expect(evaluateIpcIntegrationPolicy(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.selectAndPrepare,[inherited]))
      .toMatchObject({accepted:false});
    const accessor={...base} as Record<string,unknown>;
    Object.defineProperty(accessor,'rawBytes',{enumerable:true,get:()=>[1,2,3]});
    expect(evaluateIpcIntegrationPolicy(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.selectAndPrepare,[accessor]))
      .toMatchObject({accepted:false,reason:'ACCESSOR_FIELD_PROHIBITED'});
    const prototypeKey={...base} as Record<string,unknown>;
    Object.defineProperty(prototypeKey,'__proto__',{enumerable:true,value:'forged'});
    expect(evaluateIpcIntegrationPolicy(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.selectAndPrepare,[prototypeKey]))
      .toMatchObject({accepted:false,reason:'PROTOTYPE_FIELD_PROHIBITED'});
    expect(apply({...rendererCommands[0],metadata:{password:'secret'}})).toMatchObject({accepted:false});
  });

  it('accepts exact renderer-safe results and rejects nested authority or truth drift',()=>{
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.getCenter,center))
      .toEqual({accepted:true});
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.apply,receipt))
      .toEqual({accepted:true});
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.getSafePreview,preview))
      .toEqual({accepted:true});
    for(const unsafe of [{...preview,sourcePath:'C:\\private\\plan.txt'},{...preview,fullContentSha256:'a'.repeat(64)},
      {...preview,text:'safe\u202eevil'}])expect(evaluateIpcIntegrationResultPolicy(
        COMMUNICATION_FILE_SHARING_IPC_CHANNELS.getSafePreview,unsafe)).toMatchObject({accepted:false});
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.selectAndPrepare,{canceled:true}))
      .toEqual({accepted:true});
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.getCenter,{
      ...center,notificationProfile:{...center.notificationProfile,sourcePath:'C:\\private\\profile.json'}}))
      .toMatchObject({accepted:false});
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.getCenter,{
      ...center,remoteAssistance:[{...center.remoteAssistance[0],receipt:{id:'forged'}}]}))
      .toMatchObject({accepted:false});
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.getCenter,{
      ...center,truth:{...truth,productionFileTransportConfigured:true}})).toMatchObject({accepted:false});
  });

  it('pins read/write cancellation, admission and rate limits',()=>{
    expect(resolveIpcRequestLifecyclePolicy(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.getCenter))
      .toEqual({cancellable:true,latestWins:true,timeoutMs:10_000});
    for(const channel of [COMMUNICATION_FILE_SHARING_IPC_CHANNELS.selectAndPrepare,
      COMMUNICATION_FILE_SHARING_IPC_CHANNELS.apply]){
      expect(resolveIpcRequestLifecyclePolicy(channel)).toEqual({cancellable:false,latestWins:false,timeoutMs:0});
      expect(resolveIpcRequestRatePolicy(channel)).toEqual({enabled:true,maxRequestsPerWindow:16,windowMs:60_000});
      expect(resolveIpcRequestAdmissionPolicy(channel)).toEqual({enabled:true,priority:'interactive',priorityWeight:100,
        maxConcurrentPerSender:2,maxConcurrentPerChannel:1,maxQueuedPerSender:4,queueTimeoutMs:2_500});
    }
    for(const channel of [COMMUNICATION_FILE_SHARING_IPC_CHANNELS.getCenter,
      COMMUNICATION_FILE_SHARING_IPC_CHANNELS.getSafePreview]){
      expect(resolveIpcRequestLifecyclePolicy(channel)).toEqual({cancellable:true,latestWins:true,timeoutMs:10_000});
      expect(resolveIpcRequestRatePolicy(channel)).toEqual({enabled:true,maxRequestsPerWindow:120,windowMs:60_000});
    }
  });
});
