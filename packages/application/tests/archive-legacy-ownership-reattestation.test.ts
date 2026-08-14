import { describe, expect, it, vi } from 'vitest';
import {
  ERROR_CODES,
  asCorrelationId,
  asEventId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok
} from '@ppt/core';
import {
  ReattestLegacyArchiveOwnershipUseCase,
  type ArchiveApplicationContext,
  type ArchivePolicyIntent,
  type ArchiveUnitOfWork,
  type ArchiveWriteScope,
  type StrongAuthenticationPort
} from '../src/index.js';
import { archiveLegacyOwnershipReattestationConfirmation } from '@ppt/domain';

const context:ArchiveApplicationContext={
  familyId:asFamilyId('family-archive-reattest'),
  actor:{userId:asUserId('account-archive-reattest'),role:'family_admin',personId:asPersonId('person-archive-reattest')},
  correlationId:asCorrelationId('corr-archive-reattest'),
  operationId:'archive-reattest-operation',
  operationFingerprint:'a'.repeat(64)
};
const itemId='legacy-archive-item';
const occurredAt=asIsoDateTime('2026-08-14T18:00:00.000Z');

const scope=(overrides:Partial<ArchiveWriteScope>={}):ArchiveWriteScope=>({
  occurredAt,
  findOpenPlan:()=>ok(null),
  insertRetentionPolicy:()=>ok(undefined),
  assignRetentionPolicy:()=>ok(undefined),
  markDestroyed:()=>ok(undefined),
  insertItem:()=>ok(undefined),
  insertVersion:()=>ok(undefined),
  incrementEventAttachment:()=>ok(undefined),
  appendAudit:()=>ok('audit-hash'),
  enqueueEvent:()=>ok(undefined),
  insertCategory:()=>ok(undefined),
  updateClassification:()=>ok(undefined),
  reattestLegacyOwnership:()=>ok(undefined),
  ...overrides
});

describe('legacy archive ownership reattestation',()=>{
  it('requires exact confirmation, family administrator person binding and strong authentication before the UoW',async()=>{
    const execute=vi.fn<ArchiveUnitOfWork['execute']>();
    const verify=vi.fn<StrongAuthenticationPort['verify']>(()=>ok(undefined));
    const useCase=new ReattestLegacyArchiveOwnershipUseCase({execute} as ArchiveUnitOfWork,{verify});
    const base={context,identifiers:{auditId:'audit-reattest',outboxEventId:asEventId('event-reattest')}};
    const wrongConfirmation=await useCase.execute({...base,command:{itemId,password:'correct horse battery staple',confirmation:'YANLIŞ'}});
    expect(wrongConfirmation.ok).toBe(false);
    expect(verify).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    const member=await useCase.execute({...base,context:{...context,actor:{...context.actor,role:'adult_member'}},command:{itemId,password:'correct horse battery staple',confirmation:archiveLegacyOwnershipReattestationConfirmation(itemId)}});
    expect(member.ok).toBe(false);
    expect(verify).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('propagates strong authentication failure without opening the policy transaction',async()=>{
    const execute=vi.fn<ArchiveUnitOfWork['execute']>();
    const authenticationError=createAppError({code:ERROR_CODES.AUTH_INVALID_CREDENTIALS,message:'Parola doğrulanamadı.',category:'authentication',correlationId:context.correlationId});
    const verify=vi.fn<StrongAuthenticationPort['verify']>(()=>err(authenticationError));
    const useCase=new ReattestLegacyArchiveOwnershipUseCase({execute} as ArchiveUnitOfWork,{verify});
    const result=await useCase.execute({context,command:{itemId,password:'wrong',confirmation:archiveLegacyOwnershipReattestationConfirmation(itemId)},identifiers:{auditId:'audit-reattest',outboxEventId:asEventId('event-reattest')}});
    expect(result).toEqual(err(authenticationError));
    expect(execute).not.toHaveBeenCalled();
  });

  it('uses the actor-only reattestation intent and emits content-minimized audit and outbox evidence',async()=>{
    let capturedIntent:ArchivePolicyIntent|undefined;
    const reattestLegacyOwnership=vi.fn<ArchiveWriteScope['reattestLegacyOwnership']>(()=>ok(undefined));
    const appendAudit=vi.fn<ArchiveWriteScope['appendAudit']>(()=>ok('audit-hash'));
    const enqueueEvent=vi.fn<ArchiveWriteScope['enqueueEvent']>(()=>ok(undefined));
    const unit:ArchiveUnitOfWork={execute:async(_context,intent,operation)=>{capturedIntent=intent;return operation(scope({reattestLegacyOwnership,appendAudit,enqueueEvent}));}};
    const verify=vi.fn<StrongAuthenticationPort['verify']>(()=>ok(undefined));
    const useCase=new ReattestLegacyArchiveOwnershipUseCase(unit,{verify});
    const result=await useCase.execute({context,command:{itemId,password:'correct horse battery staple',code:'123456',confirmation:archiveLegacyOwnershipReattestationConfirmation(itemId)},identifiers:{auditId:'audit-reattest',outboxEventId:asEventId('event-reattest')}});
    expect(result).toEqual(ok({itemId,ownershipBinding:'verified_actor',reattestedAt:occurredAt}));
    expect(capturedIntent).toEqual({action:'update',capability:'archive.write',resourceType:'archive_item',resourceId:itemId,purpose:'archive',ownershipReattestation:{kind:'legacy_ownerless_to_actor',ownerPersonId:context.actor.personId}});
    expect(reattestLegacyOwnership).toHaveBeenCalledWith(itemId,context.actor.personId);
    expect(appendAudit).toHaveBeenCalledWith(expect.objectContaining({action:'archive.legacy_ownership_reattested',resourceId:itemId}));
    expect(enqueueEvent).toHaveBeenCalledWith(expect.objectContaining({eventType:'archive.legacy_ownership_reattested',payload:{itemId,ownershipBinding:'verified_actor',confirmationVersion:1}}));
  });
});
