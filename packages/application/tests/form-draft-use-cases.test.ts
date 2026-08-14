import { describe, expect, it } from 'vitest';
import {
  ERROR_CODES, asCorrelationId, asFamilyId, asIsoDateTime, asUserId, ok,
  type AppError, type EventId, type PersonId, type Result
} from '@ppt/core';
import type { SaveFormDraftInput, UndoFormDraftInput } from '@ppt/domain';
import type { FormDraftMutationRow, FormDraftRow } from '@ppt/repository-contracts';
import {
  GetFormDraftWorkspaceUseCase, SaveFormDraftUseCase, UndoFormDraftUseCase,
  type FormDraftApplicationContext, type FormDraftPolicyIntent,
  type FormDraftUnitOfWork, type FormDraftWriteScope
} from '../src/form-draft-use-cases.js';

const NOW = asIsoDateTime('2026-08-14T09:00:00.000Z');
const ACCOUNT = asUserId('account-1');
const PERSON = 'person-1' as PersonId;
const context: FormDraftApplicationContext = {
  familyId: asFamilyId('family-1'), actor: { userId: ACCOUNT, role: 'family_admin', personId: PERSON },
  correlationId: asCorrelationId('form-draft-test')
};
const ids = (suffix: string) => ({
  mutationId: `form-draft-mutation-${suffix}`, requestFingerprint: suffix.repeat(64).slice(0, 64),
  auditId: `form-draft-audit-${suffix}`,
  outboxEventId: `form-draft-event-${suffix}` as EventId
});

class Unit implements FormDraftUnitOfWork {
  public row: FormDraftRow | null = null;
  public mutations: FormDraftMutationRow[] = [];
  public intents: FormDraftPolicyIntent[] = [];
  public auditActions: string[] = [];
  public events: string[] = [];
  public async execute<T>(_context: FormDraftApplicationContext, intent: FormDraftPolicyIntent, operation: (scope: FormDraftWriteScope) => Result<T, AppError>): Promise<Result<T, AppError>> {
    this.intents.push(intent);
    return operation({
      occurredAt: NOW,
      find: () => ok(this.row),
      findMutationByClientOperationId: (_account, formKey, operationId) => ok(this.mutations.find((item) => item.formKey === formKey && item.clientOperationId === operationId) ?? null),
      findMutationByRevision: (_account, formKey, revision) => ok(this.mutations.find((item) => item.formKey === formKey && item.revision === revision) ?? null),
      listMutations: (_account, formKey, limit) => ok(this.mutations.filter((item) => item.formKey === formKey).sort((left, right) => right.revision - left.revision).slice(0, limit)),
      insertMutation: (row) => { this.mutations.push(row); return ok(undefined); },
      saveCurrent: (row) => { this.row = row; return ok(true); },
      appendAudit: (audit) => { this.auditActions.push(audit.action); return ok('audit-hash'); },
      enqueueEvent: (event) => { this.events.push(event.eventType); return ok(undefined); }
    });
  }
}

describe('33-N governed form draft application', () => {
  it('saves canonical object state under a central form_draft policy intent', async () => {
    const unit = new Unit();
    const command: SaveFormDraftInput = { formKey: 'profile.edit', expectedRevision: 0, clientOperationId: 'draft-op-0001', payload: { z: 1, nested: { b: true, a: 'x' } } };
    const result = await new SaveFormDraftUseCase(unit).execute({ context, command, identifiers: ids('a') });
    expect(result.ok && result.value).toMatchObject({ resourceId: 'form_draft/account-1/profile.edit', revision: 1, payloadJson: '{"nested":{"a":"x","b":true},"z":1}' });
    expect(unit.intents[0]).toMatchObject({ action: 'create', capability: 'family.write', resourceType: 'form_draft', resourceId: 'form_draft/account-1/profile.edit' });
    expect(unit.mutations).toHaveLength(1);
    expect(unit.auditActions).toEqual(['form_draft.saved']);
    expect(unit.events).toEqual(['form_draft.saved']);
  });

  it('restores exactly the immediately prior immutable revision and exposes the new current snapshot', async () => {
    const unit = new Unit();
    const save = new SaveFormDraftUseCase(unit);
    await save.execute({ context, command: { formKey: 'profile.edit', expectedRevision: 0, clientOperationId: 'draft-op-0001', payload: { name: 'first' } }, identifiers: ids('a') });
    await save.execute({ context, command: { formKey: 'profile.edit', expectedRevision: 1, clientOperationId: 'draft-op-0002', payload: { name: 'second' } }, identifiers: ids('b') });
    const command: UndoFormDraftInput = { formKey: 'profile.edit', expectedRevision: 2, clientOperationId: 'draft-op-undo1' };
    const result = await new UndoFormDraftUseCase(unit).execute({ context, command, identifiers: ids('c') });
    expect(result.ok && result.value).toMatchObject({ revision: 3, payloadJson: '{"name":"first"}' });
    expect(unit.mutations[2]).toMatchObject({ operation: 'undo', previousRevision: 2, revision: 3, restoredFromRevision: 1, payloadFingerprint: unit.mutations[0]!.payloadFingerprint });
    expect(await new GetFormDraftWorkspaceUseCase(unit).execute({ context, formKey: 'profile.edit' })).toMatchObject({
      ok: true,
      value: {
        current: { revision: 3 },
        history: [
          { operation: 'undo', revision: 3, restoredFromRevision: 1 },
          { operation: 'save', revision: 2 },
          { operation: 'save', revision: 1 }
        ]
      }
    });
  });

  it('rejects nested banking secret fields before policy execution and rejects stale revisions', async () => {
    const rejected = new Unit();
    const secret = await new SaveFormDraftUseCase(rejected).execute({
      context,
      command: { formKey: 'payment.form', expectedRevision: 0, clientOperationId: 'draft-op-secret', payload: { section: [{ safe: true, bank_password: 'never' }] } },
      identifiers: ids('d')
    });
    expect(secret.ok).toBe(false);
    expect(rejected.intents).toHaveLength(0);

    const unit = new Unit();
    await new SaveFormDraftUseCase(unit).execute({ context, command: { formKey: 'profile.edit', expectedRevision: 0, clientOperationId: 'draft-op-0001', payload: {} }, identifiers: ids('a') });
    const stale = await new SaveFormDraftUseCase(unit).execute({ context, command: { formKey: 'profile.edit', expectedRevision: 0, clientOperationId: 'draft-op-stale', payload: {} }, identifiers: ids('e') });
    expect(stale.ok).toBe(false);
    expect(!stale.ok && stale.error.code).toBe(ERROR_CODES.RESOURCE_CONFLICT);
  });
});
