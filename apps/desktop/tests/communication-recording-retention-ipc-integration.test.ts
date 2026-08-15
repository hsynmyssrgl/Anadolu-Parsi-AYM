import { describe, expect, it } from 'vitest';
import {
  COMMUNICATION_RECORDING_IPC_CHANNELS,
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy.js';
import {
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';

const id='recording-request-34-d';
const common={clientOperationId:'operation-34-d',expectedRevision:1,requestId:id};
const truth={recordingDefaultOff:true,separateExplicitParticipantConsentModeled:true,lateJoinerPauseModeled:true,
  declineContinuesCallOffRecordModeled:true,futureRecordingWithdrawalModeled:true,onRecordOffRecordSegmentsModeled:true,
  perMediaRetentionModeled:true,contentFreeConsentAuditModeled:true,rendererMediaAuthority:false,
  productionRecordingProviderConfigured:false,actualAudioCaptureExecuted:false,actualVideoCaptureExecuted:false,
  actualTranscriptPersistenceExecuted:false,actualTranslationPersistenceExecuted:false,visibleRedIndicatorUatExecuted:false,
  audibleAnnouncementUatExecuted:false,e2eeRecorderRoleVerified:false,encryptedMediaVaultConfigured:false,
  mediaHashSignatureVerified:false,securePhysicalDeletionVerified:false,guardianLegalPolicyConfigured:false,
  childRecordingLegalReviewCompleted:false,networkUsedByCurrentImplementation:false};
const center={schemaVersion:1,centerId:'communication-recording:family:person',ownerPersonId:'person-owner-34-d',requests:[],truth,
  generatedAt:'2026-08-15T16:00:00.000Z'};
const receipt={resourceType:'communication_recording_request',resourceId:id,mutationKind:'participant_consent_decide',
  previousRevision:1,revision:2,occurredAt:'2026-08-15T16:00:00.000Z',replayed:false,mediaCaptureStarted:false,
  mediaArtifactCreated:false,networkUsed:false};

describe('34-D recording IPC integration boundary',()=>{
  it('accepts the exact eight-channel input contract',()=>{
    const accepted:[string,unknown[]][]=[
      [COMMUNICATION_RECORDING_IPC_CHANNELS.getCenter,[]],
      [COMMUNICATION_RECORDING_IPC_CHANNELS.createRequest,[{clientOperationId:'create-34-d',expectedRevision:0,
        callSessionId:'call-session-34-d',participantPersonIds:['person-owner-34-d','person-member-34-d'],noticeVersion:'notice-v1',
        audioDays:30,videoDays:14,transcriptDays:7,translationDays:3,persistTranscript:false,persistTranslation:false}]],
      [COMMUNICATION_RECORDING_IPC_CHANNELS.decideConsent,[{...common,decision:'grant',explicitConsent:true,
        noticeVersion:'notice-v1',ageCategory:'adult',ageAppropriateNoticeAcknowledged:true}]],
      [COMMUNICATION_RECORDING_IPC_CHANNELS.withdrawConsent,[{...common,reason:'Gelecekteki kayıt rızamı geri çekiyorum.'}]],
      [COMMUNICATION_RECORDING_IPC_CHANNELS.addLateJoiner,[{...common,participantPersonId:'person-late-34-d'}]],
      [COMMUNICATION_RECORDING_IPC_CHANNELS.setSegment,[{...common,mode:'off_record',reason:'Off-record bölümü.'}]],
      [COMMUNICATION_RECORDING_IPC_CHANNELS.updateRetention,[{...common,audioDays:30,videoDays:14,transcriptDays:7,
        translationDays:3,persistTranscript:false,persistTranslation:false,secureDeletionRequested:true}]],
      [COMMUNICATION_RECORDING_IPC_CHANNELS.requestDeletion,[{...common,reason:'Saklama ihtiyacı sona erdi.'}]]
    ];
    for(const [channel,args] of accepted)expect(evaluateIpcIntegrationPolicy(channel,args)).toEqual({accepted:true});
  });

  it('rejects renderer media authority, secrets, paths, extra keys, duplicate participants and unknown channels',()=>{
    const base={clientOperationId:'create-34-d',expectedRevision:0,callSessionId:'call-session-34-d',
      participantPersonIds:['person-owner-34-d','person-member-34-d'],noticeVersion:'notice-v1',audioDays:30,videoDays:14,
      transcriptDays:7,translationDays:3,persistTranscript:false,persistTranslation:false};
    for(const forged of [{...base,mediaStreamId:'forged'},{...base,recordingPath:'C:/secret.wav'},{...base,token:'secret'},
      {...base,participantPersonIds:['person-owner-34-d','person-owner-34-d']}])
      expect(evaluateIpcIntegrationPolicy(COMMUNICATION_RECORDING_IPC_CHANNELS.createRequest,[forged]).accepted).toBe(false);
    expect(evaluateIpcIntegrationPolicy('communicationRecording:startCapture',[base]).accepted).toBe(false);
  });

  it('rejects inherited and accessor-bearing payloads before dispatch',()=>{
    const inherited=Object.assign(Object.create({token:'forged'}),{...common,reason:'Off-record bölümü.'});
    expect(evaluateIpcIntegrationPolicy(COMMUNICATION_RECORDING_IPC_CHANNELS.requestDeletion,[inherited]).accepted).toBe(false);
    const accessor={...common,reason:'Off-record bölümü.'};Object.defineProperty(accessor,'reason',{get:()=> 'forged',enumerable:true});
    expect(evaluateIpcIntegrationPolicy(COMMUNICATION_RECORDING_IPC_CHANNELS.requestDeletion,[accessor]).accepted).toBe(false);
  });

  it('accepts only redacted center and no-capture mutation results',()=>{
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_RECORDING_IPC_CHANNELS.getCenter,center)).toEqual({accepted:true});
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_RECORDING_IPC_CHANNELS.decideConsent,receipt)).toEqual({accepted:true});
    for(const forged of [{...receipt,mediaCaptureStarted:true},{...receipt,mediaArtifactCreated:true},{...receipt,networkUsed:true},
      {...receipt,policyReceiptHash:'a'.repeat(64)}])
      expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_RECORDING_IPC_CHANNELS.decideConsent,forged).accepted).toBe(false);
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_RECORDING_IPC_CHANNELS.getCenter,{...center,mediaKey:'secret'}).accepted).toBe(false);
  });

  it('keeps reads cancellable and every durable write non-cancellable with bounded admission',()=>{
    expect(resolveIpcRequestLifecyclePolicy(COMMUNICATION_RECORDING_IPC_CHANNELS.getCenter))
      .toEqual({cancellable:true,latestWins:true,timeoutMs:10_000});
    expect(resolveIpcRequestLifecyclePolicy(COMMUNICATION_RECORDING_IPC_CHANNELS.createRequest))
      .toEqual({cancellable:false,latestWins:false,timeoutMs:0});
    expect(resolveIpcRequestAdmissionPolicy(COMMUNICATION_RECORDING_IPC_CHANNELS.decideConsent)).toMatchObject({enabled:true,
      maxConcurrentPerSender:2,maxConcurrentPerChannel:1,maxQueuedPerSender:4});
  });

  it('applies separate read and write rate limits',()=>{
    expect(resolveIpcRequestRatePolicy(COMMUNICATION_RECORDING_IPC_CHANNELS.getCenter)).toEqual({enabled:true,
      maxRequestsPerWindow:120,windowMs:60_000});
    expect(resolveIpcRequestRatePolicy(COMMUNICATION_RECORDING_IPC_CHANNELS.requestDeletion)).toEqual({enabled:true,
      maxRequestsPerWindow:12,windowMs:60_000});
  });
});
