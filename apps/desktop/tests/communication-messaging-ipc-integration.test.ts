import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COMMUNICATION_MESSAGING_IPC_CHANNELS,
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy.js';
import {
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';

const NOW='2026-08-15T12:00:00.000Z';
const message={
  id:'comm-message-34-b',roomId:'comm-room-34-b',senderPersonId:'person-owner-34-b',contentKind:'text',
  contentMime:'text/plain',payloadSizeBytes:128,state:'sealed_local',deliveryState:'transport_not_configured',
  silent:false,pinned:false,bookmarked:false,edited:false,deleted:false,revision:1,createdAt:NOW,updatedAt:NOW,
  sealedPayloadStoredOutsideDatabase:true,plaintextPersistedInDatabase:false
};
const presence={
  personId:'person-owner-34-b',status:'offline',publicAvailability:'unavailable',audience:'nobody',
  lastSeenShared:false,typingIndicatorsEnabled:false,readReceiptsEnabled:false,activeDeviceDisclosed:false,
  preciseActivityDisclosed:false,emergencyReachabilityEnabled:false,revision:0,updatedAt:NOW
};
const truth={
  appendOnlyMessageEventLedgerImplemented:true,sealedPayloadReferenceOnlyInDatabase:true,
  offlineOutboxMetadataImplemented:true,localRetryStateMachineImplemented:true,
  replyQuoteThreadReactionPinBookmarkMetadataImplemented:true,editDeleteRestoreHistoryImplemented:true,
  scheduledAndSilentMetadataImplemented:true,privacyPreservingPresenceImplemented:true,
  defaultPresenceIsAvailabilityOnly:true,activeDeviceDisclosureDefaultDenied:true,
  exactActivityDisclosureDefaultDenied:true,contentSearchImplemented:false,relayDeliveryImplemented:false,
  deliveryReceiptFromRemoteImplemented:false,messageSignatureVerificationImplemented:false,
  automaticPhysicalSecureEraseGuaranteed:false,backupDeletionPropagationGuaranteed:false,
  calendarPresenceSyncImplemented:false,productionMlsPayloadProviderConfigured:false,
  realMessageExchangePerformed:false,networkUsedByCurrentImplementation:false
};
const center={schemaVersion:1,centerId:'communication-messaging:family-34-b:person-owner-34-b',
  ownerPersonId:'person-owner-34-b',messages:[message],presence,retentionPolicies:[{
    roomId:'comm-room-34-b',mode:'duration',durationDays:30,legalHoldReasonRecorded:false,
    automaticDeletionScheduled:false,physicalSecureEraseGuaranteed:false,backupPropagationGuaranteed:false,
    revision:1,updatedAt:NOW
  }],truth,generatedAt:NOW};
const receipt={resourceType:'communication_message',resourceId:'comm-message-34-b',mutationKind:'message_create',
  previousRevision:0,revision:1,occurredAt:NOW,replayed:false,payloadSealedLocally:true,
  remoteDeliveryPerformed:false,networkUsed:false};

describe('34-B communication messaging IPC boundary',()=>{
  it('accepts exactly ten bounded renderer-safe operations',()=>{
    const valid=new Map<string,unknown[]>([
      [COMMUNICATION_MESSAGING_IPC_CHANNELS.getCenter,[]],
      [COMMUNICATION_MESSAGING_IPC_CHANNELS.search,[{roomId:'comm-room-34-b',contentKind:'text',limit:50}]],
      [COMMUNICATION_MESSAGING_IPC_CHANNELS.getContent,[{messageId:'comm-message-34-b'}]],
      [COMMUNICATION_MESSAGING_IPC_CHANNELS.create,[{clientOperationId:'create-message-34-b',expectedRevision:0,
        roomId:'comm-room-34-b',contentKind:'text',contentMime:'text/plain',text:'Şifreli yerel mesaj',silent:true}]],
      [COMMUNICATION_MESSAGING_IPC_CHANNELS.edit,[{clientOperationId:'edit-message-34-b',expectedRevision:1,
        messageId:'comm-message-34-b',text:'Düzeltilmiş yerel mesaj',reason:'Yazım düzeltildi.'}]],
      [COMMUNICATION_MESSAGING_IPC_CHANNELS.setLifecycle,[{clientOperationId:'delete-message-34-b',expectedRevision:2,
        messageId:'comm-message-34-b',action:'delete',reason:'Kullanıcı sildi.'}]],
      [COMMUNICATION_MESSAGING_IPC_CHANNELS.annotate,[{clientOperationId:'pin-message-34-b',expectedRevision:2,
        messageId:'comm-message-34-b',pinned:true}]],
      [COMMUNICATION_MESSAGING_IPC_CHANNELS.updateDelivery,[{clientOperationId:'queue-message-34-b',expectedRevision:2,
        messageId:'comm-message-34-b',action:'queue_offline'}]],
      [COMMUNICATION_MESSAGING_IPC_CHANNELS.setPresence,[{clientOperationId:'presence-message-34-b',expectedRevision:0,
        status:'invisible',audience:'nobody',lastSeenShared:false,typingIndicatorsEnabled:false,
        readReceiptsEnabled:false,emergencyReachabilityEnabled:false}]],
      [COMMUNICATION_MESSAGING_IPC_CHANNELS.setRetentionPolicy,[{clientOperationId:'retention-message-34-b',expectedRevision:0,
        roomId:'comm-room-34-b',mode:'duration',durationDays:30,reason:'Yerel saklama kararı.'}]]
    ]);
    for(const [channel,args] of valid)expect(evaluateIpcIntegrationPolicy(channel,args),channel).toMatchObject({accepted:true});
    expect(evaluateIpcIntegrationPolicy('communicationMessaging:sendRemote',[{}]).accepted).toBe(false);
  });

  it('rejects renderer authority, unknown fields, unsafe objects and unissued attachment handles',()=>{
    const base={clientOperationId:'create-message-34-b',expectedRevision:0,roomId:'comm-room-34-b',
      contentKind:'text',contentMime:'text/plain',text:'Yerel mesaj'};
    for(const extra of [{accountId:'account-owner'},{familyId:'family-34-b'},{ownerPersonId:'person-owner'},
      {sealedPayloadReference:'vault-item'},{payloadSha256:'a'.repeat(64)},{path:'C:\\secret.txt'},
      {relayUrl:'https://relay.invalid'},{token:'secret'},{opaqueAttachmentHandle:'renderer-issued'}]){
      expect(evaluateIpcIntegrationPolicy(COMMUNICATION_MESSAGING_IPC_CHANNELS.create,[{...base,...extra}]).accepted).toBe(false);
    }
    expect(evaluateIpcIntegrationPolicy(COMMUNICATION_MESSAGING_IPC_CHANNELS.create,[{
      ...base,contentKind:'photo',contentMime:'image/jpeg',opaqueAttachmentHandle:'renderer-issued'
    }]).accepted).toBe(false);
    const inherited=Object.create({token:'secret'}) as Record<string,unknown>;Object.assign(inherited,base);
    expect(evaluateIpcIntegrationPolicy(COMMUNICATION_MESSAGING_IPC_CHANNELS.create,[inherited]).accepted).toBe(false);
    const accessor={...base};Object.defineProperty(accessor,'text',{get:()=> 'secret',enumerable:true});
    expect(evaluateIpcIntegrationPolicy(COMMUNICATION_MESSAGING_IPC_CHANNELS.create,[accessor]).accepted).toBe(false);
  });

  it('accepts only redacted metadata, bounded local plaintext and content-free receipts',()=>{
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_MESSAGING_IPC_CHANNELS.getCenter,center).accepted).toBe(true);
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_MESSAGING_IPC_CHANNELS.search,[message]).accepted).toBe(true);
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_MESSAGING_IPC_CHANNELS.getContent,{
      messageId:message.id,revision:1,contentKind:'text',contentMime:'text/plain',text:'Şifreli yerel mesaj',
      payloadSource:'local_sealed_store',networkUsed:false,cloudUsed:false
    }).accepted).toBe(true);
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_MESSAGING_IPC_CHANNELS.create,receipt).accepted).toBe(true);
    for(const unsafe of [{...center,policyReceiptHash:'a'.repeat(64)},{...center,sealedPayloadReference:'vault-item'},
      {...center,relayDelivered:true},{...center,networkUsed:true}]){
      expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_MESSAGING_IPC_CHANNELS.getCenter,unsafe).accepted).toBe(false);
    }
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_MESSAGING_IPC_CHANNELS.getContent,{
      messageId:message.id,revision:1,contentKind:'text',contentMime:'text/plain',text:'x'.repeat(32_769),
      payloadSource:'local_sealed_store',networkUsed:false,cloudUsed:false
    }).accepted).toBe(false);
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_MESSAGING_IPC_CHANNELS.create,
      {...receipt,remoteDeliveryPerformed:true}).accepted).toBe(false);
  });

  it('keeps reads cancellable and durable writes non-cancellable with bounded admission and rate',()=>{
    for(const channel of [COMMUNICATION_MESSAGING_IPC_CHANNELS.getCenter,COMMUNICATION_MESSAGING_IPC_CHANNELS.search,
      COMMUNICATION_MESSAGING_IPC_CHANNELS.getContent]){
      expect(resolveIpcRequestLifecyclePolicy(channel)).toMatchObject({cancellable:true,latestWins:true,timeoutMs:10_000});
      expect(resolveIpcRequestRatePolicy(channel)).toMatchObject({enabled:true,maxRequestsPerWindow:120,windowMs:60_000});
    }
    for(const channel of Object.values(COMMUNICATION_MESSAGING_IPC_CHANNELS).filter(value=>![
      COMMUNICATION_MESSAGING_IPC_CHANNELS.getCenter,COMMUNICATION_MESSAGING_IPC_CHANNELS.search,
      COMMUNICATION_MESSAGING_IPC_CHANNELS.getContent].includes(value))){
      expect(resolveIpcRequestLifecyclePolicy(channel)).toMatchObject({cancellable:false,latestWins:false,timeoutMs:0});
      expect(resolveIpcRequestRatePolicy(channel)).toMatchObject({enabled:true,maxRequestsPerWindow:24,windowMs:60_000});
      expect(resolveIpcRequestAdmissionPolicy(channel)).toMatchObject({enabled:true,maxConcurrentPerChannel:1,maxQueuedPerSender:4});
    }
  });

  it('registers and exposes only the safe messaging bridge',()=>{
    const main=readFileSync('apps/desktop/src/main/main.ts','utf8');
    const preload=readFileSync('apps/desktop/src/main/preload.ts','utf8');
    const globalTypes=readFileSync('apps/desktop/src/renderer/global.d.ts','utf8');
    for(const channel of Object.values(COMMUNICATION_MESSAGING_IPC_CHANNELS))expect(main+preload).toContain(channel);
    for(const method of ['getCommunicationMessagingCenter','searchCommunicationMessages','getCommunicationMessageContent',
      'createCommunicationMessage','editCommunicationMessage','setCommunicationMessageLifecycle','annotateCommunicationMessage',
      'updateCommunicationDelivery','setCommunicationPresence','setCommunicationRetentionPolicy']){
      expect(preload+globalTypes).toContain(method);
    }
    for(const forbidden of ['sendCommunicationMessageToRelay','setCommunicationMessageVaultPath','readCommunicationPayloadReference',
      'configureCommunicationDeliveryProvider'])expect(preload+globalTypes).not.toContain(forbidden);
  });
});
