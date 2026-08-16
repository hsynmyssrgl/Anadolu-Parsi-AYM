import { describe, expect, it } from 'vitest';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId, ok, type AppError, type Result } from '@ppt/core';
import type { DomainEvent } from '@ppt/events';
import type { MemoryStudioMutationRow, MemoryStudioRecordRow, MemoryTimeCapsuleRow } from '@ppt/repository-contracts';
import {
  CreateMemoryStudioRecordUseCase,
  CreateMemoryTimeCapsuleUseCase,
  DeleteMemoryStudioRecordUseCase,
  ReviewMemoryTimeCapsuleUseCase,
  TransitionMemoryTimeCapsuleUseCase,
  type LifeApplicationContext,
  type LifePolicyIntent,
  type MemoryStudioUnitOfWork,
  type MemoryStudioWriteScope
} from '../src/index.js';

const FAMILY = asFamilyId('family-33-x');
const OWNER = asPersonId('person-owner-33-x');
const context = (accountId: string): LifeApplicationContext => ({
  familyId: FAMILY,
  actor: { userId: asUserId(accountId), role: 'family_admin', personId: OWNER },
  correlationId: asCorrelationId(`correlation-${accountId}`)
});

class MemoryScope implements MemoryStudioWriteScope {
  public occurredAt = asIsoDateTime('2026-08-15T12:00:00.000Z');
  public readonly ownerPersonId = OWNER;
  public validReferences = true;
  public readonly records = new Map<string, MemoryStudioRecordRow>();
  public readonly capsules = new Map<string, MemoryTimeCapsuleRow>();
  public readonly mutations = new Map<string, MemoryStudioMutationRow>();
  public readonly audits: unknown[] = [];
  public readonly events: DomainEvent<unknown>[] = [];
  public findRecord(id: string) { return ok(this.records.get(id) ?? null); }
  public findCapsule(id: string) { return ok(this.capsules.get(id) ?? null); }
  public findMutation(id: string) { return ok(this.mutations.get(id) ?? null); }
  public validateOwnedReferences() { return ok(this.validReferences); }
  public insertMutation(row: MemoryStudioMutationRow) { this.mutations.set(row.clientOperationId, row); return ok(undefined); }
  public insertRecord(row: MemoryStudioRecordRow) { this.records.set(row.id, row); return ok(undefined); }
  public saveRecord(row: MemoryStudioRecordRow, expectedRevision: number) {
    if (this.records.get(row.id)?.revision !== expectedRevision) throw new Error('revision');
    this.records.set(row.id, row); return ok(undefined);
  }
  public insertCapsule(row: MemoryTimeCapsuleRow) { this.capsules.set(row.id, row); return ok(undefined); }
  public saveCapsule(row: MemoryTimeCapsuleRow, expectedRevision: number) {
    if (this.capsules.get(row.id)?.revision !== expectedRevision) throw new Error('revision');
    this.capsules.set(row.id, row); return ok(undefined);
  }
  public appendAudit(value: unknown) { this.audits.push(value); return ok('audit'); }
  public enqueueEvent<T>(event: DomainEvent<T>): Result<void, AppError> { this.events.push(event as DomainEvent<unknown>); return ok(undefined); }
}

class MemoryUnit implements MemoryStudioUnitOfWork {
  public readonly scope = new MemoryScope();
  public readonly intents: LifePolicyIntent[] = [];
  public execute<T>(_context: LifeApplicationContext, intent: LifePolicyIntent,
    operation: (scope: MemoryStudioWriteScope) => Result<T, AppError>): Promise<Result<T, AppError>> {
    this.intents.push(intent); return Promise.resolve(operation(this.scope));
  }
}

describe('33-X memory studio and local time capsule use cases', () => {
  it('creates a metadata-only local memory record and replays idempotently', async () => {
    const unit = new MemoryUnit(); const useCase = new CreateMemoryStudioRecordUseCase(unit);
    const command = { clientOperationId: 'operation-record-33-x', recordId: 'record-33-x', kind: 'voice_story' as const,
      title: 'Aile hikâyesi', summary: 'Kullanıcı tarafından yazılmış kısa açıklama.', archiveItemIds: ['archive-33-x'] };
    expect(await useCase.execute({ context: context('account-owner-33-x'), command })).toMatchObject({ ok: true,
      value: { revision: 1, replayed: false, networkUsed: false, cloudUsed: false, externalDeliveryPerformed: 'not_performed' } });
    expect(await useCase.execute({ context: context('account-owner-33-x'), command })).toMatchObject({ ok: true, value: { replayed: true } });
    expect(unit.scope.records.get('record-33-x')).toMatchObject({ archiveItemIds: ['archive-33-x'], status: 'active' });
    expect(JSON.stringify(unit.scope.events)).not.toContain('Kullanıcı tarafından');
  });

  it('requires explicit manual grouping and exact same-owner references', async () => {
    const unit = new MemoryUnit(); const useCase = new CreateMemoryStudioRecordUseCase(unit);
    expect(await useCase.execute({ context: context('account-owner-33-x'), command: { clientOperationId: 'operation-face-33-x',
      recordId: 'face-group-33-x', kind: 'face_group', title: 'Aile grubu', archiveItemIds: ['archive-face-33-x'],
      personIds: ['person-relative-33-x'] } })).toMatchObject({ ok: false, error: { category: 'authorization' } });
    unit.scope.validReferences = false;
    expect(await useCase.execute({ context: context('account-owner-33-x'), command: { clientOperationId: 'operation-foreign-33-x',
      recordId: 'foreign-record-33-x', kind: 'photo_book', title: 'Yabancı kaynak', archiveItemIds: ['archive-foreign-33-x'] } }))
      .toMatchObject({ ok: false, error: { category: 'authorization' } });
  });

  it('rejects non-canonical commands, extra fields and overlong identifiers before persistence', async () => {
    const unit = new MemoryUnit(); const useCase = new CreateMemoryStudioRecordUseCase(unit);
    expect(await useCase.execute({ context: context('account-owner-33-x'), command: {
      clientOperationId: 'operation-extra-33-x', recordId: 'record-extra-33-x', kind: 'recipe', title: 'Aile tarifi',
      summary: 'Yerel tarif', policyReceipt: 'forged'
    } as never })).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(await useCase.execute({ context: context('account-owner-33-x'), command: {
      clientOperationId: `x${'a'.repeat(160)}`, recordId: 'record-long-33-x', kind: 'recipe', title: 'Aile tarifi',
      summary: 'Yerel tarif'
    } })).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(await useCase.execute({ context: context('account-owner-33-x'), command: {
      clientOperationId: 'operation-date-33-x', recordId: 'record-date-33-x', kind: 'on_this_day', title: 'Bugün',
      summary: 'Yerel anı', eventDate: '2026-08-15T12:00:00Z'
    } })).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(await useCase.execute({ context: context('account-owner-33-x'), command: {
      clientOperationId: 'operation-false-face-33-x', recordId: 'record-false-face-33-x', kind: 'recipe',
      title: 'Tarif', summary: 'Yerel tarif', manualFaceGroupingApproved: true
    } })).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(unit.scope.mutations).toHaveLength(0);
  });

  it('replays a canonical capsule create after the relative creation window has elapsed', async () => {
    const unit = new MemoryUnit(); const useCase = new CreateMemoryTimeCapsuleUseCase(unit);
    const command = { clientOperationId: 'operation-aging-replay-33-x', capsuleId: 'capsule-aging-replay-33-x',
      title: 'Geleceğe not', memoryRecordIds: ['record-33-x'], unlockAt: '2026-08-23T12:00:00.000Z' };
    expect(await useCase.execute({ context: context('account-owner-33-x'), command })).toMatchObject({ ok: true,
      value: { revision: 1, replayed: false } });
    unit.scope.occurredAt = asIsoDateTime('2026-09-01T12:00:00.000Z');
    expect(await useCase.execute({ context: context('account-owner-33-x'), command: {
      unlockAt: command.unlockAt, memoryRecordIds: ['record-33-x'], title: command.title,
      capsuleId: command.capsuleId, clientOperationId: command.clientOperationId
    } })).toMatchObject({ ok: true, value: { revision: 1, replayed: true } });
    expect(unit.scope.mutations).toHaveLength(1);
  });

  it('allows only the approving account to revoke its own approval', async () => {
    const unit = new MemoryUnit(); const create = new CreateMemoryTimeCapsuleUseCase(unit);
    await create.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-revoke-capsule-create',
      capsuleId: 'capsule-revoke-33-x', title: 'Onay geri alma', memoryRecordIds: ['record-33-x'],
      unlockAt: '2026-08-23T12:00:00.000Z' } });
    const review = new ReviewMemoryTimeCapsuleUseCase(unit);
    await review.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-revoke-approve-a',
      capsuleId: 'capsule-revoke-33-x', expectedRevision: 1, decision: 'approve' } });
    expect(await review.execute({ context: context('account-b-33-x'), command: { clientOperationId: 'operation-revoke-wrong-account',
      capsuleId: 'capsule-revoke-33-x', expectedRevision: 2, decision: 'revoke_approval' } }))
      .toMatchObject({ ok: false, error: { category: 'conflict' } });
    expect(await review.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-revoke-own-account',
      capsuleId: 'capsule-revoke-33-x', expectedRevision: 2, decision: 'revoke_approval' } }))
      .toMatchObject({ ok: true, value: { revision: 3, mutationKind: 'capsule_revoke_approval' } });
    expect(unit.scope.capsules.get('capsule-revoke-33-x')?.approvals).toEqual([]);
  });

  it('rejects clock rollback and revalidates linked sources before seal and release', async () => {
    const unit = new MemoryUnit(); const create = new CreateMemoryTimeCapsuleUseCase(unit);
    await create.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-revalidate-create',
      capsuleId: 'capsule-revalidate-33-x', title: 'Kaynak doğrulama', memoryRecordIds: ['record-33-x'],
      unlockAt: '2026-08-23T12:00:00.000Z' } });
    const review = new ReviewMemoryTimeCapsuleUseCase(unit);
    await review.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-revalidate-approve-a',
      capsuleId: 'capsule-revalidate-33-x', expectedRevision: 1, decision: 'approve' } });
    await review.execute({ context: context('account-b-33-x'), command: { clientOperationId: 'operation-revalidate-approve-b',
      capsuleId: 'capsule-revalidate-33-x', expectedRevision: 2, decision: 'approve' } });
    const transition = new TransitionMemoryTimeCapsuleUseCase(unit);
    unit.scope.validReferences = false;
    expect(await transition.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-revalidate-seal-deny',
      capsuleId: 'capsule-revalidate-33-x', expectedRevision: 3, transition: 'seal' } }))
      .toMatchObject({ ok: false, error: { category: 'authorization' } });
    unit.scope.validReferences = true; unit.scope.occurredAt = asIsoDateTime('2026-08-14T12:00:00.000Z');
    expect(await transition.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-clock-rollback-deny',
      capsuleId: 'capsule-revalidate-33-x', expectedRevision: 3, transition: 'seal' } }))
      .toMatchObject({ ok: false, error: { category: 'conflict' } });
    unit.scope.occurredAt = asIsoDateTime('2026-08-15T12:00:00.000Z');
    expect(await transition.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-revalidate-seal',
      capsuleId: 'capsule-revalidate-33-x', expectedRevision: 3, transition: 'seal' } })).toMatchObject({ ok: true });
    unit.scope.validReferences = false; unit.scope.occurredAt = asIsoDateTime('2026-08-23T12:00:00.000Z');
    expect(await transition.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-revalidate-release-deny',
      capsuleId: 'capsule-revalidate-33-x', expectedRevision: 4, transition: 'release' } }))
      .toMatchObject({ ok: false, error: { category: 'authorization' } });
  });

  it('requires two distinct accounts and the waiting period before local release', async () => {
    const unit = new MemoryUnit(); const create = new CreateMemoryTimeCapsuleUseCase(unit);
    expect(await create.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-capsule-33-x',
      capsuleId: 'capsule-33-x', title: 'Geleceğe mesaj', memoryRecordIds: ['record-33-x'], unlockAt: '2026-08-23T12:00:00.000Z' } }))
      .toMatchObject({ ok: true, value: { revision: 1 } });
    const review = new ReviewMemoryTimeCapsuleUseCase(unit);
    await review.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-approve-a-33-x',
      capsuleId: 'capsule-33-x', expectedRevision: 1, decision: 'approve' } });
    expect(await new TransitionMemoryTimeCapsuleUseCase(unit).execute({ context: context('account-a-33-x'), command: {
      clientOperationId: 'operation-early-seal-33-x', capsuleId: 'capsule-33-x', expectedRevision: 2, transition: 'seal' } }))
      .toMatchObject({ ok: false, error: { category: 'authorization' } });
    await review.execute({ context: context('account-b-33-x'), command: { clientOperationId: 'operation-approve-b-33-x',
      capsuleId: 'capsule-33-x', expectedRevision: 2, decision: 'approve' } });
    const transition = new TransitionMemoryTimeCapsuleUseCase(unit);
    expect(await transition.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-seal-33-x',
      capsuleId: 'capsule-33-x', expectedRevision: 3, transition: 'seal' } })).toMatchObject({ ok: true, value: { revision: 4 } });
    expect(await transition.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-early-release-33-x',
      capsuleId: 'capsule-33-x', expectedRevision: 4, transition: 'release' } })).toMatchObject({ ok: false, error: { category: 'authorization' } });
    unit.scope.occurredAt = asIsoDateTime('2026-08-23T12:00:00.000Z');
    expect(await transition.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-release-33-x',
      capsuleId: 'capsule-33-x', expectedRevision: 4, transition: 'release' } })).toMatchObject({ ok: true, value: { revision: 5 } });
  });

  it('allows a bounded local release rollback without external delivery', async () => {
    const unit = new MemoryUnit(); const create = new CreateMemoryTimeCapsuleUseCase(unit);
    await create.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-capsule-rollback',
      capsuleId: 'capsule-rollback-33-x', title: 'Geri alınabilir kapsül', archiveItemIds: ['archive-33-x'],
      unlockAt: '2026-08-23T12:00:00.000Z' } });
    const review = new ReviewMemoryTimeCapsuleUseCase(unit);
    await review.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-rollback-approve-a',
      capsuleId: 'capsule-rollback-33-x', expectedRevision: 1, decision: 'approve' } });
    await review.execute({ context: context('account-b-33-x'), command: { clientOperationId: 'operation-rollback-approve-b',
      capsuleId: 'capsule-rollback-33-x', expectedRevision: 2, decision: 'approve' } });
    const transition = new TransitionMemoryTimeCapsuleUseCase(unit);
    await transition.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-rollback-seal',
      capsuleId: 'capsule-rollback-33-x', expectedRevision: 3, transition: 'seal' } });
    unit.scope.occurredAt = asIsoDateTime('2026-08-23T12:00:00.000Z');
    await transition.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-rollback-release',
      capsuleId: 'capsule-rollback-33-x', expectedRevision: 4, transition: 'release' } });
    unit.scope.occurredAt = asIsoDateTime('2026-08-24T11:59:59.000Z');
    expect(await transition.execute({ context: context('account-a-33-x'), command: { clientOperationId: 'operation-rollback-final',
      capsuleId: 'capsule-rollback-33-x', expectedRevision: 5, transition: 'rollback' } })).toMatchObject({ ok: true,
      value: { mutationKind: 'capsule_rollback', externalDeliveryPerformed: 'not_performed' } });
  });

  it('tombstones a record and preserves append-only mutation evidence', async () => {
    const unit = new MemoryUnit(); await new CreateMemoryStudioRecordUseCase(unit).execute({ context: context('account-owner-33-x'), command: {
      clientOperationId: 'operation-create-delete-33-x', recordId: 'record-delete-33-x', kind: 'recipe', title: 'Tarif',
      summary: 'Aile tarifi kullanıcı tarafından girildi.' } });
    expect(await new DeleteMemoryStudioRecordUseCase(unit).execute({ context: context('account-owner-33-x'), command: {
      clientOperationId: 'operation-delete-33-x', recordId: 'record-delete-33-x', expectedRevision: 1 } }))
      .toMatchObject({ ok: true, value: { mutationKind: 'record_delete', revision: 2 } });
    expect(unit.scope.records.get('record-delete-33-x')).toMatchObject({ status: 'deleted', revision: 2 });
    expect(unit.scope.mutations).toHaveLength(2);
  });
});
