import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS,
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy.js';
import {
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';

const NOW='2026-08-15T14:00:00.000Z';
const participant={personId:'person-owner-34-c',role:'host',state:'local_ready',handRaised:false,pinnedLocally:false,
  signLanguageSpeakerPinnedLocally:false,revision:1,updatedAt:NOW};
const session={id:'communication-call-session-34-c',roomId:'communication-room-34-c',topology:'direct_p2p',
  requestedMediaMode:'video',state:'planned',networkState:'not_started',waitingRoomEnabled:true,meetingLocked:false,
  audioOnly:false,automaticAudioFallbackEnabled:true,backgroundEffect:'off',captionsRequested:false,
  realtimeTextRequested:false,screenShareRequested:false,localHandRaised:false,preflight:{microphone:'not_run',camera:'not_run',
    speaker:'not_run',noiseReductionRequested:true,echoCancellationRequested:true,automaticGainControlRequested:true,
    providerVerified:false,networkUsed:false},participants:[participant],revision:1,createdAt:NOW,updatedAt:NOW};
const preferences={simpleMode:false,largePersonCards:true,captionScalePercent:125,screenReaderAnnouncements:true,
  keyboardShortcuts:true,automaticAudioFallbackEnabled:true,noiseReductionRequested:true,echoCancellationRequested:true,
  automaticGainControlRequested:true,backgroundEffect:'off',revision:0,updatedAt:NOW};
const truth={localCallPlanningMetadataImplemented:true,appendOnlyLifecycleLedgerImplemented:true,optimisticRevisionRequired:true,
  accessibleCallPreferenceModelImplemented:true,localPreflightEvidenceContractImplemented:true,
  localMediaPreflightProviderConfigured:true,localMediaPreflightExecuted:false,physicalMediaDeviceFunctionalityCertified:false,
  rendererMediaDeviceAuthority:false,
  rendererNetworkAuthority:false,productionMediaProviderConfigured:false,webRtcPeerConnectionExecuted:false,sfuServiceConfigured:false,
  stunTurnServiceConfigured:false,shortLivedRelayCredentialsIssued:false,sframeMediaEncryptionExecuted:false,
  mlsMediaKeyBindingVerified:false,screenOrWindowCaptureImplemented:false,localBackgroundProcessingImplemented:false,
  liveCaptionProviderConfigured:false,realtimeTextTransportImplemented:false,callKitPushKitIntegrated:false,
  windowsCallNotificationIntegrated:false,doNotDisturbIntegrationImplemented:false,realDevicePreflightExecuted:false,
  realOneToOneCallPerformed:false,realGroupCallPerformed:false,networkUsedByCurrentImplementation:false};
const center={schemaVersion:1,centerId:'communication-calling:family-34-c:person-owner-34-c',ownerPersonId:'person-owner-34-c',
  sessions:[session],preferences,qualityObservations:[],truth,generatedAt:NOW};
const receipt={resourceType:'communication_call_session',resourceId:session.id,mutationKind:'call_create',previousRevision:0,
  revision:1,occurredAt:NOW,replayed:false,mediaTransportStarted:false,networkUsed:false};

describe('34-C realtime calling IPC boundary',()=>{
  it('accepts exactly six bounded renderer-safe operations',()=>{
    const valid=new Map<string,unknown[]>([
      [COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.getCenter,[]],
      [COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.create,[{clientOperationId:'create-call-34-c',expectedRevision:0,
        roomId:'communication-room-34-c',topology:'direct_p2p',requestedMediaMode:'video',
        invitedPersonIds:['person-invited-34-c'],waitingRoomEnabled:true,automaticAudioFallbackEnabled:true}]],
      [COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.runPreflight,[{clientOperationId:'preflight-call-34-c',expectedRevision:1,
        sessionId:session.id}]],
      [COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.updateControls,[{clientOperationId:'controls-call-34-c',expectedRevision:1,
        sessionId:session.id,audioOnly:true,meetingLocked:true,captionsRequested:true,realtimeTextRequested:true,localHandRaised:true,
        pinnedPersonId:'person-owner-34-c',backgroundEffect:'off'}]],
      [COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.advance,[{clientOperationId:'end-call-34-c',expectedRevision:1,
        sessionId:session.id,action:'end',reason:'Kullanıcı yerel çağrı planını sonlandırdı.'}]],
      [COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.setPreferences,[{clientOperationId:'preferences-call-34-c',expectedRevision:0,
        simpleMode:true,largePersonCards:true,captionScalePercent:150,screenReaderAnnouncements:true,keyboardShortcuts:true,
        automaticAudioFallbackEnabled:true,noiseReductionRequested:true,echoCancellationRequested:true,
        automaticGainControlRequested:true,backgroundEffect:'off'}]]
    ]);
    for(const [channel,args] of valid)expect(evaluateIpcIntegrationPolicy(channel,args),channel).toMatchObject({accepted:true});
    expect(evaluateIpcIntegrationPolicy(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.updateControls,[{
      clientOperationId:'clear-call-pin-34-c',expectedRevision:1,sessionId:session.id,pinnedPersonId:null,
      signLanguagePinnedPersonId:null,reactionCode:null}]).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy('communicationCalling:connect',[{}]).accepted).toBe(false);
  });

  it('rejects renderer media, network, provider, credential, path and quality authority',()=>{
    const base={clientOperationId:'create-call-34-c',expectedRevision:0,roomId:'communication-room-34-c',topology:'direct_p2p',
      requestedMediaMode:'video',invitedPersonIds:['person-invited-34-c'],waitingRoomEnabled:true,automaticAudioFallbackEnabled:true};
    for(const extra of [{accountId:'account-owner'},{familyId:'family-34-c'},{ownerPersonId:'person-owner-34-c'},
      {providerId:'renderer-webrtc'},{providerEvidenceSha256:'a'.repeat(64)},{stunUrl:'stun:example.invalid'},
      {turnCredential:'secret'},{sframeKey:'secret'},{mediaStreamId:'renderer-stream'},{screenCaptureSourceId:'screen'},
      {path:'C:\\capture.bin'},{roundTripMs:42},{token:'secret'}])
      expect(evaluateIpcIntegrationPolicy(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.create,[{...base,...extra}]).accepted).toBe(false);
    const inherited=Object.create({providerId:'hidden'}) as Record<string,unknown>;Object.assign(inherited,base);
    expect(evaluateIpcIntegrationPolicy(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.create,[inherited]).accepted).toBe(false);
    const accessor={...base};Object.defineProperty(accessor,'roomId',{get:()=>base.roomId,enumerable:true});
    expect(evaluateIpcIntegrationPolicy(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.create,[accessor]).accepted).toBe(false);
  });

  it('accepts only redacted local planning results and rejects truth overclaims or provider evidence',()=>{
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.getCenter,center).accepted).toBe(true);
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.create,receipt).accepted).toBe(true);
    for(const unsafe of [{...center,providerEvidenceSha256:'a'.repeat(64)},{...center,turnCredential:'secret'},
      {...center,truth:{...truth,webRtcPeerConnectionExecuted:true}},{...center,truth:{...truth,networkUsedByCurrentImplementation:true}},
      {...center,truth:{...truth,localMediaPreflightProviderConfigured:false,localMediaPreflightExecuted:true}},
      {...center,sessions:[{...session,preflight:{...session.preflight,providerId:'unsafe'}}]}])
      expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.getCenter,unsafe).accepted).toBe(false);
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.create,
      {...receipt,mediaTransportStarted:true}).accepted).toBe(false);
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.create,
      {...receipt,mutationKind:'call_quality_observation'}).accepted).toBe(false);
  });

  it('keeps the center read cancellable and all durable writes non-cancellable with bounded admission and rate',()=>{
    expect(resolveIpcRequestLifecyclePolicy(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.getCenter))
      .toMatchObject({cancellable:true,latestWins:true,timeoutMs:10_000});
    expect(resolveIpcRequestRatePolicy(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.getCenter))
      .toMatchObject({enabled:true,maxRequestsPerWindow:120,windowMs:60_000});
    for(const channel of Object.values(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS).filter(value=>
      value!==COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.getCenter)){
      expect(resolveIpcRequestLifecyclePolicy(channel)).toMatchObject({cancellable:false,latestWins:false,timeoutMs:0});
      expect(resolveIpcRequestRatePolicy(channel)).toMatchObject({enabled:true,maxRequestsPerWindow:16,windowMs:60_000});
      expect(resolveIpcRequestAdmissionPolicy(channel)).toMatchObject({enabled:true,maxConcurrentPerChannel:1,maxQueuedPerSender:4});
    }
  });

  it('registers and exposes only the six safe bridge methods',()=>{
    const main=readFileSync('apps/desktop/src/main/main.ts','utf8');const preload=readFileSync('apps/desktop/src/main/preload.ts','utf8');
    const globalTypes=readFileSync('apps/desktop/src/renderer/global.d.ts','utf8');
    for(const channel of Object.values(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS))expect(main+preload).toContain(channel);
    for(const method of ['getCommunicationRealtimeCallingCenter','createCommunicationCall','runCommunicationCallPreflight',
      'updateCommunicationCallControls','advanceCommunicationCall','setCommunicationCallPreferences'])
      expect(preload+globalTypes).toContain(method);
    for(const forbidden of ['recordCommunicationCallQuality','configureCommunicationMediaProvider','openCommunicationPeerConnection',
      'setCommunicationTurnCredentials','startCommunicationScreenCapture'])expect(preload+globalTypes).not.toContain(forbidden);
  });
});
