import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { FamilyMeetingCenterView, FamilyMeetingMutationReceiptView } from '@ppt/domain';
import {
  FAMILY_MEETING_IPC_CHANNELS,
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy,
  projectFamilyMeetingCenterIpcView,
  projectFamilyMeetingMutationIpcView
} from '../src/main/ipc-integration-policy.js';
import {
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';

const at='2026-08-15T18:00:00.000Z';
const meetingId='family-meeting-34-f';
const base={clientOperationId:'operation-34-f',expectedRevision:1,meetingId};
const truth={
  singleAndRecurringSchedulingModeled:true,agendaPreReadAttendanceReminderModeled:true,
  explicitMeetingRolesModeled:true,pollVoteAbstentionOpinionModeled:true,
  appendOnlyDecisionLedgerModeled:true,taskFollowUpCarryForwardModeled:true,
  collaborationReferencesModeled:true,transcriptConsentGateModeled:true,
  humanApprovalRequiredForAiMinutes:true,encryptedMinutesPackageImplemented:true,
  participantScopedMinutesReadImplemented:true,productionAiMinutesProviderConfigured:false,
  transcriptPayloadReadExecutedByCurrentImplementation:false,externalCalendarDeliveryExecuted:false,
  externalReminderDeliveryExecuted:false,remoteCollaborationExecuted:false,
  networkUsedByCurrentImplementation:false
} as const;
const center:FamilyMeetingCenterView={schemaVersion:1,centerId:'family-meetings-family-owner',ownerPersonId:'person-owner-34-f',
  meetings:[{id:meetingId,ownerPersonId:'person-owner-34-f',title:'Haftalık aile toplantısı',recurrenceKind:'weekly',
    recurrenceInterval:1,startsAt:at,endsAt:'2026-08-15T19:00:00.000Z',reminderMinutes:30,state:'in_progress',
    participants:[{personId:'person-owner-34-f',roles:['host','attendee'],attendance:'accepted',reminderEnabled:true,
      revision:1,updatedAt:at}],agenda:[],polls:[],decisions:[{id:'decision-34-f',statement:'Birlikte ilerle.',
      responsiblePersonIds:['person-owner-34-f'],ledgerReference:'internal-ledger-sha',recordedAt:at}],tasks:[],collaboration:[],
    minutes:{id:`${meetingId}:minutes`,state:'not_prepared',transcriptConsentVerified:false,aiSuggestionGenerated:false,
      humanApprovalRecorded:false,encryptedPackageAvailable:false,participantAccessPersonIds:[],selectedRecordingSegmentIds:[],
      revision:0,updatedAt:at,networkUsed:false,cloudUsed:false},revision:2,createdAt:at,updatedAt:at}],truth,generatedAt:at};
const receipt:FamilyMeetingMutationReceiptView={resourceType:'family_meeting',resourceId:meetingId,mutationKind:'agenda_upsert',
  previousRevision:1,revision:2,occurredAt:at,replayed:false,encryptedMinutesPackageWritten:false,
  aiProviderConfigured:false,networkUsed:false,cloudUsed:false};

describe('34-F family meeting IPC integration boundary',()=>{
  it('accepts the exact fourteen-channel input contract',()=>{
    const commands:[string,unknown[]][]=[
      [FAMILY_MEETING_IPC_CHANNELS.getCenter,[]],
      [FAMILY_MEETING_IPC_CHANNELS.getMinutes,[{meetingId}]],
      [FAMILY_MEETING_IPC_CHANNELS.create,[{clientOperationId:'create-34-f',expectedRevision:0,title:'Aile toplantısı',
        recurrenceKind:'weekly',recurrenceInterval:1,startsAt:at,endsAt:'2026-08-15T19:00:00.000Z',reminderMinutes:30,
        participantPersonIds:['person-owner-34-f']}]],
      [FAMILY_MEETING_IPC_CHANNELS.updatePlan,[{...base,title:'Yeni plan',recurrenceKind:'monthly',recurrenceInterval:1,
        startsAt:at,endsAt:'2026-08-15T19:00:00.000Z',reminderMinutes:45}]],
      [FAMILY_MEETING_IPC_CHANNELS.setState,[{...base,state:'in_progress',reason:'Toplantı başladı.'}]],
      [FAMILY_MEETING_IPC_CHANNELS.upsertParticipant,[{...base,participantPersonId:'person-guest-34-f',roles:['attendee'],
        attendance:'accepted',reminderEnabled:true}]],
      [FAMILY_MEETING_IPC_CHANNELS.upsertAgenda,[{...base,title:'Gündem',order:1,preRead:[{resourceType:'archive_item',
        resourceId:'archive-item-34-f'}],carryForwardToNextMeeting:false}]],
      [FAMILY_MEETING_IPC_CHANNELS.createPoll,[{...base,question:'Hangi gün?',options:['Cumartesi','Pazar']}]],
      [FAMILY_MEETING_IPC_CHANNELS.castVote,[{...base,pollId:'poll-34-f',optionId:'option-34-f',abstain:false}]],
      [FAMILY_MEETING_IPC_CHANNELS.recordDecision,[{...base,statement:'Cumartesi buluşulacak.',responsiblePersonIds:['person-owner-34-f']}]],
      [FAMILY_MEETING_IPC_CHANNELS.upsertTask,[{...base,title:'Hazırlığı tamamla',responsiblePersonId:'person-owner-34-f',
        dueAt:'2026-08-16T18:00:00.000Z',state:'open',carryForwardToNextMeeting:true}]],
      [FAMILY_MEETING_IPC_CHANNELS.addCollaboration,[{...base,kind:'whiteboard',resourceType:'whiteboard',resourceId:'board-34-f'}]],
      [FAMILY_MEETING_IPC_CHANNELS.prepareAiMinutes,[{...base,recordingRequestId:'recording-request-34-f'}]],
      [FAMILY_MEETING_IPC_CHANNELS.finalizeMinutes,[{...base,summary:'İnsan tarafından onaylanan tutanak.',decisions:[],tasks:[],
        participantAccessPersonIds:['person-owner-34-f'],selectedRecordingSegmentIds:[],explicitHumanApproval:true,
        machineGeneratedSource:false}]]
    ];
    expect(Object.values(FAMILY_MEETING_IPC_CHANNELS)).toHaveLength(14);
    for(const [channel,args] of commands)expect(evaluateIpcIntegrationPolicy(channel,args),channel).toEqual({accepted:true});
  });

  it('rejects renderer identity, path, secret, artifact and false approval authority',()=>{
    const valid={...base,summary:'Onaylı tutanak.',decisions:[],tasks:[],participantAccessPersonIds:['person-owner-34-f'],
      selectedRecordingSegmentIds:[],explicitHumanApproval:true,machineGeneratedSource:false};
    for(const forged of [{...valid,ownerPersonId:'forged'},{...valid,filePath:'C:/secret'},{...valid,sealedPayloadReference:'forged'},
      {...valid,providerToken:'secret'},{...valid,explicitHumanApproval:false}])
      expect(evaluateIpcIntegrationPolicy(FAMILY_MEETING_IPC_CHANNELS.finalizeMinutes,[forged]).accepted).toBe(false);
    expect(evaluateIpcIntegrationPolicy('familyMeeting:deleteLedger',[valid]).accepted).toBe(false);
  });

  it('rejects inherited, accessor-bearing and malformed nested inputs before dispatch',()=>{
    const inherited=Object.assign(Object.create({providerToken:'forged'}),{...base,state:'in_progress',reason:'Başladı.'});
    expect(evaluateIpcIntegrationPolicy(FAMILY_MEETING_IPC_CHANNELS.setState,[inherited]).accepted).toBe(false);
    const accessor={...base,state:'in_progress',reason:'Başladı.'};
    Object.defineProperty(accessor,'reason',{get:()=> 'forged',enumerable:true});
    expect(evaluateIpcIntegrationPolicy(FAMILY_MEETING_IPC_CHANNELS.setState,[accessor]).accepted).toBe(false);
    expect(evaluateIpcIntegrationPolicy(FAMILY_MEETING_IPC_CHANNELS.upsertAgenda,[{...base,title:'Gündem',order:1,
      preRead:[Object.assign(Object.create({path:'forged'}),{resourceType:'archive_item',resourceId:'archive-34-f'})],
      carryForwardToNextMeeting:false}]).accepted).toBe(false);
  });

  it('projects owner and ledger authority out before exact result validation',()=>{
    const projected=projectFamilyMeetingCenterIpcView(center);
    expect(projected).not.toHaveProperty('ownerPersonId');
    expect(projected).not.toHaveProperty('centerId');
    expect(projected.meetings[0]).not.toHaveProperty('ownerPersonId');
    expect(projected.meetings[0]?.decisions[0]).not.toHaveProperty('ledgerReference');
    expect(evaluateIpcIntegrationResultPolicy(FAMILY_MEETING_IPC_CHANNELS.getCenter,projected)).toEqual({accepted:true});
    expect(evaluateIpcIntegrationResultPolicy(FAMILY_MEETING_IPC_CHANNELS.getCenter,{...projected,ownerPersonId:'forged'}).accepted).toBe(false);
  });

  it('binds mutation result projection to the exact channel operation and no-provider truth',()=>{
    const projected=projectFamilyMeetingMutationIpcView(receipt,'agenda_upsert');
    expect(projected).not.toHaveProperty('resourceType');
    expect(evaluateIpcIntegrationResultPolicy(FAMILY_MEETING_IPC_CHANNELS.upsertAgenda,projected)).toEqual({accepted:true});
    expect(()=>projectFamilyMeetingMutationIpcView(receipt,'vote_cast')).toThrow(/does not match/u);
    for(const forged of [{...projected,networkUsed:true},{...projected,aiProviderConfigured:true},{...projected,stateFingerprint:'forged'}])
      expect(evaluateIpcIntegrationResultPolicy(FAMILY_MEETING_IPC_CHANNELS.upsertAgenda,forged).accepted).toBe(false);
  });

  it('keeps authorized minutes content bounded, local and human approved',()=>{
    const minutes={meetingId,minutesRevision:1,summary:'Onaylı tutanak.',decisions:['Karar'],tasks:['Görev'],
      participantAccessPersonIds:['person-owner-34-f'],selectedRecordingSegmentIds:[],payloadSource:'local_sealed_store',
      machineGeneratedSource:false,humanApproved:true,networkUsed:false,cloudUsed:false};
    expect(evaluateIpcIntegrationResultPolicy(FAMILY_MEETING_IPC_CHANNELS.getMinutes,minutes)).toEqual({accepted:true});
    expect(evaluateIpcIntegrationResultPolicy(FAMILY_MEETING_IPC_CHANNELS.getMinutes,{...minutes,humanApproved:false}).accepted).toBe(false);
    expect(evaluateIpcIntegrationResultPolicy(FAMILY_MEETING_IPC_CHANNELS.getMinutes,{...minutes,path:'C:/minutes'}).accepted).toBe(false);
  });

  it('keeps reads cancellable and durable writes non-cancellable with bounded admission and rate',()=>{
    expect(resolveIpcRequestLifecyclePolicy(FAMILY_MEETING_IPC_CHANNELS.getCenter))
      .toEqual({cancellable:true,latestWins:true,timeoutMs:10_000});
    expect(resolveIpcRequestLifecyclePolicy(FAMILY_MEETING_IPC_CHANNELS.finalizeMinutes))
      .toEqual({cancellable:false,latestWins:false,timeoutMs:0});
    expect(resolveIpcRequestAdmissionPolicy(FAMILY_MEETING_IPC_CHANNELS.castVote)).toMatchObject({enabled:true,
      maxConcurrentPerSender:2,maxConcurrentPerChannel:1,maxQueuedPerSender:4});
    expect(resolveIpcRequestRatePolicy(FAMILY_MEETING_IPC_CHANNELS.getMinutes))
      .toEqual({enabled:true,maxRequestsPerWindow:120,windowMs:60_000});
    expect(resolveIpcRequestRatePolicy(FAMILY_MEETING_IPC_CHANNELS.recordDecision))
      .toEqual({enabled:true,maxRequestsPerWindow:16,windowMs:60_000});
  });

  it('registers and exposes every safe bridge method exactly once',()=>{
    const main=readFileSync('apps/desktop/src/main/main.ts','utf8');
    const preload=readFileSync('apps/desktop/src/main/preload.ts','utf8');
    const globalTypes=readFileSync('apps/desktop/src/renderer/global.d.ts','utf8');
    for(const channel of Object.values(FAMILY_MEETING_IPC_CHANNELS))expect(preload.match(new RegExp(`invoke\\('${channel}'`,'gu')),channel).toHaveLength(1);
    for(const method of ['getFamilyMeetingCenter','getFamilyMeetingMinutes','createFamilyMeeting','updateFamilyMeetingPlan',
      'setFamilyMeetingState','upsertFamilyMeetingParticipant','upsertFamilyMeetingAgendaItem','createFamilyMeetingPoll',
      'castFamilyMeetingVote','recordFamilyMeetingDecision','upsertFamilyMeetingTask','addFamilyMeetingCollaboration',
      'prepareFamilyMeetingAiMinutes','finalizeFamilyMeetingMinutes']){
      expect(preload.match(new RegExp(`^  ${method}:`,'gmu')),method).toHaveLength(1);
      expect(globalTypes.match(new RegExp(`(?:^|[;\\s])${method}\\(`,'gmu')),method).toHaveLength(1);
    }
    expect(main).toContain('projectFamilyMeetingCenterIpcView(await store().getFamilyMeetingCenter())');
    expect(main).toContain("projectFamilyMeetingMutationIpcView(await store().finalizeFamilyMeetingMinutes(input),'minutes_finalize')");
  });
});
