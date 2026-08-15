import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CHILD_EDUCATION_COORDINATION_IPC_CHANNELS,
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy.js';
import {
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';
import { resolveIpcReadSharingPolicy } from '../src/main/ipc-read-sharing.js';

const NOW='2026-08-15T16:00:00.000Z';
const CHILD='person-child-33-u';
const ITEM='child-education-item-33-u';
const item={
  id:ITEM,childPersonId:CHILD,kind:'homework',area:'schoolwork',title:'Matematik ödevi',status:'active',
  visibility:'child_and_selected_guardians',privacyExplanationCode:'owner_and_explicit_permission',revision:1,
  subjectLabel:'Matematik',dueAt:'2026-08-20T15:00:00.000Z',createdAt:NOW,updatedAt:NOW
} as const;
const center={
  schemaVersion:1,centerId:`child-education-center:family-33-u:${CHILD}`,childPersonId:CHILD,ageBand:'teen',viewMode:'teen_standard',
  items:[item],countsByArea:{schoolwork:1,events_access:0,activities:0,money_goals:0},
  truth:{localOnly:true,childDataClassEnforced:true,aiProcessingAllowed:false,externalSharingAllowed:false,
    schoolPortalSync:'not_configured',teacherMessaging:'not_performed',liveTransportTracking:'not_performed',
    pickupCredentialIssuance:'managed_separately_in_identity_center',allowancePaymentExecution:'not_performed',
    certificateVerification:'not_performed',healthDataDuplicated:false,ageAppropriatePresentation:'derived_from_local_birth_date'},
  generatedAt:NOW
} as const;
const receipt={itemId:ITEM,childPersonId:CHILD,mutationKind:'item_create',previousRevision:0,revision:1,
  occurredAt:NOW,replayed:false,localOnly:true,externalAction:'not_performed'} as const;

describe('33-U child education coordination IPC boundary',()=>{
  it('accepts exact child-scoped reads and bounded education mutations',()=>{
    expect(evaluateIpcIntegrationPolicy(CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.getCenter,[{childPersonId:CHILD}]))
      .toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy(CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.createItem,[{
      clientOperationId:'operation-child-create-33-u',itemId:ITEM,childPersonId:CHILD,kind:'homework',
      title:item.title,visibility:item.visibility,status:'active',subjectLabel:'Matematik',dueAt:item.dueAt
    }])).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy(CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.updateItem,[{
      clientOperationId:'operation-child-update-33-u',itemId:ITEM,childPersonId:CHILD,expectedRevision:1,
      status:'submitted',note:'Yerel olarak teslim edildi işaretlendi.'
    }])).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy(CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.deleteItem,[{
      clientOperationId:'operation-child-delete-33-u',itemId:ITEM,childPersonId:CHILD,expectedRevision:2,
      reason:'Kullanıcı yerel kaydı kaldırdı.'
    }])).toEqual({accepted:true});
  });

  it('rejects renderer authority, secrets, cross-kind fields and unknown channels',()=>{
    for(const forbidden of [
      {accountId:'forged-account'},{familyId:'forged-family'},{policyReceiptHash:'a'.repeat(64)},
      {sourcePath:'C:\\private\\school.json'},{schoolPortalToken:'secret'},{pickupCode:'9271'}
    ]) expect(evaluateIpcIntegrationPolicy(CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.createItem,[{
      clientOperationId:'operation-child-forged-33-u',itemId:ITEM,childPersonId:CHILD,kind:'book',
      title:'Yerel kitap',visibility:'family_coordination',...forbidden
    }])).toMatchObject({accepted:false});
    expect(evaluateIpcIntegrationPolicy(CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.createItem,[{
      clientOperationId:'operation-child-cross-kind-33-u',itemId:ITEM,childPersonId:CHILD,kind:'homework',
      title:'Ödev',visibility:'family_coordination',subjectLabel:'Matematik',amountMinor:1_000,currency:'TRY'
    }])).toMatchObject({accepted:false});
    expect(evaluateIpcIntegrationPolicy('childEducation:future',[]))
      .toMatchObject({accepted:false,reason:'UNKNOWN_IPC_CHANNEL'});
  });

  it('accepts safe views and rejects authority, AI, sharing and external-action overclaims',()=>{
    expect(evaluateIpcIntegrationResultPolicy(CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.getCenter,center))
      .toEqual({accepted:true});
    expect(evaluateIpcIntegrationResultPolicy(CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.createItem,receipt))
      .toEqual({accepted:true});
    for(const forged of [
      {...center,accountId:'private-account'},
      {...center,items:[{...item,policyReceiptHash:'a'.repeat(64)}]},
      {...center,truth:{...center.truth,aiProcessingAllowed:true}},
      {...center,truth:{...center.truth,externalSharingAllowed:true}},
      {...receipt,externalAction:'performed'},
      {...receipt,stateFingerprint:'b'.repeat(64)}
    ]) expect(evaluateIpcIntegrationResultPolicy(
      'mutationKind' in forged?CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.createItem:CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.getCenter,
      forged
    )).toMatchObject({accepted:false});
  });

  it('keeps reads non-cacheable and serializes durable writes with explicit limits',()=>{
    const read=CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.getCenter;
    expect(resolveIpcRequestLifecyclePolicy(read)).toEqual({cancellable:true,latestWins:true,timeoutMs:10_000});
    expect(resolveIpcReadSharingPolicy(read).enabled).toBe(false);
    expect(resolveIpcRequestRatePolicy(read)).toEqual({enabled:true,maxRequestsPerWindow:60,windowMs:60_000});
    for(const channel of [
      CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.createItem,
      CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.updateItem,
      CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.deleteItem
    ]){
      expect(resolveIpcRequestLifecyclePolicy(channel)).toEqual({cancellable:false,latestWins:false,timeoutMs:0});
      expect(resolveIpcRequestRatePolicy(channel)).toEqual({enabled:true,maxRequestsPerWindow:16,windowMs:60_000});
      expect(resolveIpcRequestAdmissionPolicy(channel)).toMatchObject({enabled:true,maxConcurrentPerChannel:1});
    }
  });

  it('pins four main, preload and renderer methods without policy authority',()=>{
    const main=readFileSync('apps/desktop/src/main/main.ts','utf8');
    const preload=readFileSync('apps/desktop/src/main/preload.ts','utf8');
    const globalTypes=readFileSync('apps/desktop/src/renderer/global.d.ts','utf8');
    for(const [name,channel] of Object.entries(CHILD_EDUCATION_COORDINATION_IPC_CHANNELS)){
      expect(main).toContain(`CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.${name}`);
      expect(preload).toContain(`invoke('${channel}'`);
    }
    for(const method of ['getChildEducationCenter','createChildEducationItem','updateChildEducationItem','deleteChildEducationItem'])
      expect(globalTypes).toContain(method);
    expect(preload).not.toContain('childEducationPolicyReceipt');
    expect(globalTypes).not.toContain('ChildEducationPolicyReceipt');
  });
});
