import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { MEMORY_STUDIO_IPC_CHANNELS,evaluateIpcIntegrationPolicy,evaluateIpcIntegrationResultPolicy } from '../src/main/ipc-integration-policy.js';
import { resolveIpcRequestAdmissionPolicy,resolveIpcRequestLifecyclePolicy,resolveIpcRequestRatePolicy } from '../src/main/ipc-request-lifecycle.js';

const NOW='2026-08-15T12:00:00.000Z';
const receipt={resourceType:'memory_studio_record',resourceId:'record-33-x',mutationKind:'record_create',previousRevision:0,
  revision:1,occurredAt:NOW,replayed:false,networkUsed:false,cloudUsed:false,externalDeliveryPerformed:'not_performed'};
const center={schemaVersion:1,centerId:'memory-studio:family:person',ownerPersonId:'person-owner',records:[{id:'record-33-x',
  ownerPersonId:'person-owner',kind:'recipe',status:'active',title:'Aile tarifi',summary:'Yerel kullanıcı açıklaması',
  archiveItemIds:[],personIds:[],manualFaceGroupingApproved:false,revision:1,createdAt:NOW,updatedAt:NOW}],capsules:[],
  truth:{localOnly:true,linkedArchiveContentRemainsProtected:true,newBinaryPayloadStored:false,transcriptionPerformed:false,
    faceRecognitionPerformed:false,duplicateDetectionPerformed:false,documentaryRendered:false,printableBookRendered:false,
    printingPerformed:false,networkUsed:false,cloudUsed:false,manualCurationOnly:true,manualFaceGroupingOnly:true,
    minimumCapsuleApprovals:2,waitingPeriodEnforced:true,externalDeliveryPerformed:'not_performed'},generatedAt:NOW};

describe('33-X memory studio IPC boundary',()=>{
  it('accepts the six exact renderer commands and rejects unknown or extra authority fields',()=>{
    expect(evaluateIpcIntegrationPolicy(MEMORY_STUDIO_IPC_CHANNELS.getCenter,[]).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy(MEMORY_STUDIO_IPC_CHANNELS.createRecord,[{clientOperationId:'operation-33-x',recordId:'record-33-x',
      kind:'recipe',title:'Aile tarifi',summary:'Yerel açıklama'}]).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy(MEMORY_STUDIO_IPC_CHANNELS.deleteRecord,[{clientOperationId:'operation-delete-33-x',
      recordId:'record-33-x',expectedRevision:1}]).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy(MEMORY_STUDIO_IPC_CHANNELS.createCapsule,[{clientOperationId:'operation-capsule-33-x',
      capsuleId:'capsule-33-x',title:'Geleceğe mesaj',memoryRecordIds:['record-33-x'],unlockAt:'2026-08-23T12:00:00.000Z'}]).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy(MEMORY_STUDIO_IPC_CHANNELS.reviewCapsule,[{clientOperationId:'operation-review-33-x',
      capsuleId:'capsule-33-x',expectedRevision:1,decision:'approve'}]).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy(MEMORY_STUDIO_IPC_CHANNELS.transitionCapsule,[{clientOperationId:'operation-transition-33-x',
      capsuleId:'capsule-33-x',expectedRevision:2,transition:'seal'}]).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy('memoryStudio:future',[]).accepted).toBe(false);
    expect(evaluateIpcIntegrationPolicy(MEMORY_STUDIO_IPC_CHANNELS.createRecord,[{clientOperationId:'operation-33-x',recordId:'record-33-x',
      kind:'recipe',title:'Aile tarifi',policyReceipt:'forged'}])).toMatchObject({accepted:false});
  });

  it('rejects paths, secrets, prototypes and oversized manual text recursively',()=>{
    const base={clientOperationId:'operation-33-x',recordId:'record-33-x',kind:'letter',title:'Mektup'};
    for(const extra of [{path:'C:\\secret.txt'},{token:'secret-token'},{summary:'x'.repeat(2001)}])
      expect(evaluateIpcIntegrationPolicy(MEMORY_STUDIO_IPC_CHANNELS.createRecord,[{...base,...extra}]).accepted).toBe(false);
    const polluted=Object.create({admin:true}) as Record<string,unknown>;Object.assign(polluted,base);
    expect(evaluateIpcIntegrationPolicy(MEMORY_STUDIO_IPC_CHANNELS.createRecord,[polluted]).accepted).toBe(false);
  });

  it('accepts exact safe center and receipt results but rejects leaked hashes or receipt authority',()=>{
    expect(evaluateIpcIntegrationResultPolicy(MEMORY_STUDIO_IPC_CHANNELS.getCenter,center).accepted).toBe(true);
    expect(evaluateIpcIntegrationResultPolicy(MEMORY_STUDIO_IPC_CHANNELS.createRecord,receipt).accepted).toBe(true);
    expect(evaluateIpcIntegrationResultPolicy(MEMORY_STUDIO_IPC_CHANNELS.getCenter,{...center,policyReceiptHash:'a'.repeat(64)}).accepted).toBe(false);
    expect(evaluateIpcIntegrationResultPolicy(MEMORY_STUDIO_IPC_CHANNELS.createRecord,{...receipt,stateFingerprint:'b'.repeat(64)}).accepted).toBe(false);
  });

  it('keeps reads cancellable and every durable mutation non-cancellable and rate bounded',()=>{
    expect(resolveIpcRequestLifecyclePolicy(MEMORY_STUDIO_IPC_CHANNELS.getCenter)).toMatchObject({cancellable:true,latestWins:true,timeoutMs:10_000});
    for(const channel of Object.values(MEMORY_STUDIO_IPC_CHANNELS).filter(value=>value!==MEMORY_STUDIO_IPC_CHANNELS.getCenter)){
      expect(resolveIpcRequestLifecyclePolicy(channel)).toMatchObject({cancellable:false,latestWins:false,timeoutMs:0});
      expect(resolveIpcRequestRatePolicy(channel)).toMatchObject({enabled:true,maxRequestsPerWindow:12,windowMs:60_000});
      expect(resolveIpcRequestAdmissionPolicy(channel)).toMatchObject({enabled:true,maxConcurrentPerChannel:1,maxQueuedPerSender:4});
    }
  });

  it('registers and exposes only the six safe bridge methods',()=>{
    const main=readFileSync('apps/desktop/src/main/main.ts','utf8');const preload=readFileSync('apps/desktop/src/main/preload.ts','utf8');
    const globalTypes=readFileSync('apps/desktop/src/renderer/global.d.ts','utf8');
    for(const channel of Object.values(MEMORY_STUDIO_IPC_CHANNELS))expect(main+preload).toContain(channel);
    for(const method of ['getMemoryStudioCenter','createMemoryStudioRecord','deleteMemoryStudioRecord','createMemoryTimeCapsule',
      'reviewMemoryTimeCapsule','transitionMemoryTimeCapsule'])expect(preload+globalTypes).toContain(method);
    for(const forbidden of ['getMemoryStudioPolicyReceipt','readMemoryStudioArchiveBytes','memoryStudioStateFingerprint'])
      expect(preload+globalTypes).not.toContain(forbidden);
  });
});
