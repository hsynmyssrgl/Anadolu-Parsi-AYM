import { describe, expect, it, vi } from 'vitest';
import {
  asCorrelationId,
  asEventId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  ok
} from '@ppt/core';
import type { ArchiveRelationEvidenceView, ArchiveVersionView } from '@ppt/domain';
import {
  AddArchiveItemVersionUseCase,
  AddArchiveRelationEvidenceUseCase,
  RemoveArchiveRelationEvidenceUseCase,
  type ArchiveApplicationContext,
  type ArchivePolicyIntent,
  type ArchiveUnitOfWork,
  type ArchiveWriteScope
} from '../src/index.js';

const occurredAt=asIsoDateTime('2026-08-15T12:00:00.000Z');
const context:ArchiveApplicationContext={
  familyId:asFamilyId('family-33-r'),
  actor:{userId:asUserId('account-33-r'),role:'family_admin',personId:asPersonId('person-33-r')},
  correlationId:asCorrelationId('correlation-33-r'),
  operationId:'archive-33-r-operation',
  operationFingerprint:'a'.repeat(64)
};

const evidence:ArchiveRelationEvidenceView={
  id:'evidence-33-r',relationId:'relation-33-r',archiveItemId:'archive-33-r',
  documentTitle:'Aile belgesi',documentOriginalName:'aile.pdf',documentMimeType:'application/pdf',
  evidenceDate:'2026-08-14',confidence:'high',status:'active',revision:1,createdAt:occurredAt,updatedAt:occurredAt
};

const baseScope=(overrides:Partial<ArchiveWriteScope>={}):ArchiveWriteScope=>({
  occurredAt,
  findOpenPlan:()=>ok(null),
  listVersions:()=>ok([]),
  insertRetentionPolicy:()=>ok(undefined),
  assignRetentionPolicy:()=>ok(undefined),
  markDestroyed:()=>ok(undefined),
  insertItem:()=>ok(undefined),
  insertVersion:()=>ok(undefined),
  replaceItemFile:()=>ok(undefined),
  insertRelationEvidence:()=>ok(evidence),
  removeRelationEvidence:()=>ok({...evidence,status:'removed',revision:2,updatedAt:occurredAt,removedAt:occurredAt}),
  incrementEventAttachment:()=>ok(undefined),
  appendAudit:()=>ok('audit-hash'),
  enqueueEvent:()=>ok(undefined),
  insertCategory:()=>ok(undefined),
  updateClassification:()=>ok(undefined),
  reattestLegacyOwnership:()=>ok(undefined),
  ...overrides
});

const unitOfWork=(scope:ArchiveWriteScope,intents:ArchivePolicyIntent[]):ArchiveUnitOfWork=>({
  execute:async(_context,intent,operation)=>{intents.push(intent);return operation(scope);}
});

describe('33-R archive relation evidence and media lifecycle',()=>{
  it('persists relation, document, date and confidence under the exact archive update intent',async()=>{
    const intents:ArchivePolicyIntent[]=[];
    const insertRelationEvidence=vi.fn<ArchiveWriteScope['insertRelationEvidence']>(()=>ok(evidence));
    const appendAudit=vi.fn<ArchiveWriteScope['appendAudit']>(()=>ok('audit-hash'));
    const enqueueEvent=vi.fn<ArchiveWriteScope['enqueueEvent']>(()=>ok(undefined));
    const useCase=new AddArchiveRelationEvidenceUseCase(unitOfWork(baseScope({insertRelationEvidence,appendAudit,enqueueEvent}),intents));
    const result=await useCase.execute({context,command:{relationId:' relation-33-r ',archiveItemId:' archive-33-r ',evidenceDate:'2026-08-14',confidence:'high'},identifiers:{evidenceId:evidence.id,mutationId:'mutation-33-r',auditId:'audit-33-r',outboxEventId:asEventId('event-33-r')}});
    expect(result).toEqual(ok(evidence));
    expect(intents).toEqual([{action:'update',capability:'archive.write',resourceType:'archive_item',resourceId:'archive-33-r',purpose:'archive'}]);
    expect(insertRelationEvidence).toHaveBeenCalledWith(expect.objectContaining({evidenceId:evidence.id,relationId:'relation-33-r',archiveItemId:'archive-33-r',evidenceDate:'2026-08-14',confidence:'high',clientOperationId:context.operationId,requestFingerprint:context.operationFingerprint}));
    expect(appendAudit).toHaveBeenCalledWith(expect.objectContaining({action:'archive.relation_evidence_created',resourceType:'archive_item',resourceId:'archive-33-r'}));
    expect(enqueueEvent).toHaveBeenCalledWith(expect.objectContaining({eventType:'archive.relation_evidence.created',payload:{evidenceId:evidence.id,revision:1,status:'active'}}));
  });

  it('rejects future evidence and missing stable operation identity before persistence',async()=>{
    const insertRelationEvidence=vi.fn<ArchiveWriteScope['insertRelationEvidence']>();
    const useCase=new AddArchiveRelationEvidenceUseCase(unitOfWork(baseScope({insertRelationEvidence}),[]));
    const future=await useCase.execute({context,command:{relationId:'relation-33-r',archiveItemId:'archive-33-r',evidenceDate:'2026-08-16',confidence:'medium'},identifiers:{evidenceId:'evidence-future',mutationId:'mutation-future',auditId:'audit-future',outboxEventId:asEventId('event-future')}});
    expect(future.ok).toBe(false);
    expect(insertRelationEvidence).not.toHaveBeenCalled();
    const invalidIdentity=await useCase.execute({context:{...context,operationFingerprint:undefined},command:{relationId:'relation-33-r',archiveItemId:'archive-33-r',evidenceDate:'2026-08-14',confidence:'medium'},identifiers:{evidenceId:'evidence-no-id',mutationId:'mutation-no-id',auditId:'audit-no-id',outboxEventId:asEventId('event-no-id')}});
    expect(invalidIdentity.ok).toBe(false);
  });

  it('logically removes evidence with optimistic revision while retaining a removed view',async()=>{
    const intents:ArchivePolicyIntent[]=[];
    const removed={...evidence,status:'removed' as const,revision:2,updatedAt:occurredAt,removedAt:occurredAt};
    const removeRelationEvidence=vi.fn<ArchiveWriteScope['removeRelationEvidence']>(()=>ok(removed));
    const useCase=new RemoveArchiveRelationEvidenceUseCase(unitOfWork(baseScope({removeRelationEvidence}),intents));
    const result=await useCase.execute({context,command:{evidenceId:evidence.id,archiveItemId:evidence.archiveItemId,expectedRevision:1},identifiers:{mutationId:'mutation-remove',auditId:'audit-remove',outboxEventId:asEventId('event-remove')}});
    expect(result).toEqual(ok(removed));
    expect(removeRelationEvidence).toHaveBeenCalledWith(expect.objectContaining({evidenceId:evidence.id,archiveItemId:evidence.archiveItemId,expectedRevision:1,clientOperationId:context.operationId}));
    expect(intents[0]).toMatchObject({action:'update',resourceType:'archive_item',resourceId:evidence.archiveItemId});
  });

  it('adds version two, atomically replaces current file metadata and emits content-minimized evidence',async()=>{
    const intents:ArchivePolicyIntent[]=[];
    const previous:ArchiveVersionView&{storedName:string}={id:'version-1',archiveItemId:'archive-33-r',versionNo:1,originalName:'old.pdf',storedName:'old.enc',mimeType:'application/pdf',sizeBytes:10,sha256:'b'.repeat(64),createdAt:occurredAt};
    const insertVersion=vi.fn<ArchiveWriteScope['insertVersion']>(()=>ok(undefined));
    const replaceItemFile=vi.fn<ArchiveWriteScope['replaceItemFile']>(()=>ok(undefined));
    const enqueueEvent=vi.fn<ArchiveWriteScope['enqueueEvent']>(()=>ok(undefined));
    const scope=baseScope({findOpenPlan:()=>ok({storedName:'old.enc',sha256:previous.sha256,originalName:previous.originalName,mimeType:previous.mimeType,sizeBytes:previous.sizeBytes,sensitivity:'personal'}),listVersions:()=>ok([previous]),insertVersion,replaceItemFile,enqueueEvent});
    const result=await new AddArchiveItemVersionUseCase(unitOfWork(scope,intents)).execute({context,command:{itemId:'archive-33-r',originalName:'new.pdf',storedName:'new.enc',mimeType:'application/pdf',sizeBytes:42,sha256:'c'.repeat(64),note:'Düzeltilmiş belge'},identifiers:{versionId:'version-2',auditId:'audit-version',outboxEventId:asEventId('event-version')}});
    expect(result.ok).toBe(true);
    if(!result.ok)return;
    expect(result.value).toMatchObject({id:'version-2',versionNo:2,note:'Düzeltilmiş belge'});
    expect(insertVersion).toHaveBeenCalledWith(expect.objectContaining({id:'version-2',storedName:'new.enc',versionNo:2}));
    expect(replaceItemFile).toHaveBeenCalledWith({itemId:'archive-33-r',originalName:'new.pdf',storedName:'new.enc',mimeType:'application/pdf',sizeBytes:42,sha256:'c'.repeat(64)});
    expect(enqueueEvent).toHaveBeenCalledWith(expect.objectContaining({eventType:'archive.item.version_added',payload:{versionId:'version-2',versionNo:2}}));
    expect(JSON.stringify(enqueueEvent.mock.calls)).not.toContain('new.enc');
    expect(intents[0]).toEqual({action:'update',capability:'archive.write',resourceType:'archive_item',resourceId:'archive-33-r',purpose:'archive'});
  });

  it('rejects duplicate content without inserting a new version or replacing current metadata',async()=>{
    const sha='d'.repeat(64);
    const insertVersion=vi.fn<ArchiveWriteScope['insertVersion']>();
    const replaceItemFile=vi.fn<ArchiveWriteScope['replaceItemFile']>();
    const scope=baseScope({findOpenPlan:()=>ok({storedName:'old.enc',sha256:sha,originalName:'old.pdf',mimeType:'application/pdf',sizeBytes:10,sensitivity:'personal'}),listVersions:()=>ok([{id:'version-1',archiveItemId:'archive-33-r',versionNo:1,originalName:'old.pdf',storedName:'old.enc',mimeType:'application/pdf',sizeBytes:10,sha256:sha,createdAt:occurredAt}]),insertVersion,replaceItemFile});
    const result=await new AddArchiveItemVersionUseCase(unitOfWork(scope,[])).execute({context,command:{itemId:'archive-33-r',originalName:'same.pdf',storedName:'same.enc',mimeType:'application/pdf',sizeBytes:10,sha256:sha},identifiers:{versionId:'version-2',auditId:'audit-version',outboxEventId:asEventId('event-version')}});
    expect(result.ok).toBe(false);
    expect(insertVersion).not.toHaveBeenCalled();
    expect(replaceItemFile).not.toHaveBeenCalled();
  });
});
