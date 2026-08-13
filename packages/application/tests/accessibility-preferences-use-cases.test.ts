import { describe, expect, it } from 'vitest';
import {
  ERROR_CODES,
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type EventId,
  type PersonId,
  type Result
} from '@ppt/core';
import type { UpdateAccessibilityPreferencesInput } from '@ppt/domain';
import type {
  AccessibilityPreferencesMutationRow,
  AccessibilityPreferencesRow
} from '@ppt/repository-contracts';
import {
  GetAccessibilityPreferencesUseCase,
  UpdateAccessibilityPreferencesUseCase,
  type AccessibilityPreferencesApplicationContext,
  type AccessibilityPreferencesPolicyIntent,
  type AccessibilityPreferencesUnitOfWork,
  type AccessibilityPreferencesWriteScope
} from '../src/accessibility-preferences-use-cases.js';

const NOW = asIsoDateTime('2026-08-14T08:00:00.000Z');
const ACCOUNT = asUserId('account-1');
const PERSON = 'person-1' as PersonId;
const context: AccessibilityPreferencesApplicationContext = {
  familyId: asFamilyId('family-1'),
  actor: { userId: ACCOUNT, role: 'family_admin', personId: PERSON },
  correlationId: asCorrelationId('accessibility-preferences-test')
};
const command: UpdateAccessibilityPreferencesInput = {
  expectedRevision: 0,
  clientOperationId: 'accessibility-op-0001',
  textScale: 'large',
  textScalePercent: 150,
  highContrast: true,
  reduceMotion: true,
  theme: 'dark',
  density: 'comfortable',
  readingMode: 'easy-read',
  audienceProfile: 'low-vision',
  captionsEnabled: true,
  audioMuted: true
};
const identifiers = {
  mutationId: 'accessibility-mutation-1',
  requestFingerprint: 'a'.repeat(64),
  auditId: 'accessibility-audit-1',
  outboxEventId: 'accessibility-event-1' as EventId
};

class Unit implements AccessibilityPreferencesUnitOfWork {
  public row: AccessibilityPreferencesRow | null = null;
  public mutations: AccessibilityPreferencesMutationRow[] = [];
  public intents: AccessibilityPreferencesPolicyIntent[] = [];
  public auditCount = 0;
  public eventCount = 0;
  public saveResult = true;
  public auditFailure = false;

  public async execute<T>(
    _context: AccessibilityPreferencesApplicationContext,
    intent: AccessibilityPreferencesPolicyIntent,
    operation: (scope: AccessibilityPreferencesWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    this.intents.push(intent);
    return operation({
      occurredAt: NOW,
      find: () => ok(this.row),
      findMutationByClientOperationId: (_accountId, operationId) =>
        ok(this.mutations.find((item) => item.clientOperationId === operationId) ?? null),
      insertMutation: (row) => { this.mutations.push(row); return ok(undefined); },
      saveCurrent: (row) => { if (this.saveResult) this.row = row; return ok(this.saveResult); },
      appendAudit: () => {
        if (this.auditFailure) return err(createAppError({
          code: ERROR_CODES.RESOURCE_CONFLICT,
          message: 'audit failed',
          category: 'conflict',
          correlationId: context.correlationId
        }));
        this.auditCount += 1;
        return ok('audit-hash');
      },
      enqueueEvent: () => { this.eventCount += 1; return ok(undefined); }
    });
  }
}

describe('33-M accessibility preferences application', () => {
  it('returns a conservative default only when no persisted row exists', async () => {
    const unit = new Unit();
    const result = await new GetAccessibilityPreferencesUseCase(unit).execute(context);
    expect(result.ok && result.value).toMatchObject({
      accountId: ACCOUNT,
      familyId: context.familyId,
      ownerPersonId: PERSON,
      revision: 0,
      textScale: 'standard',
      textScalePercent: 100,
      captionsEnabled: true,
      audioMuted: false,
      updatedAt: NOW
    });
    expect(unit.intents[0]).toEqual({
      action: 'read',
      capability: 'family.read',
      resourceType: 'accessibility_preferences',
      resourceId: ACCOUNT,
      purpose: 'general',
      familyId: context.familyId,
      ownerPersonId: PERSON,
      privacy: 'private',
      sensitivity: 'personal'
    });
    expect(unit.mutations).toHaveLength(0);
  });

  it('writes mutation, optimistic current row, content-free audit and outbox in one UoW', async () => {
    const unit = new Unit();
    const result = await new UpdateAccessibilityPreferencesUseCase(unit).execute({ context, command, identifiers });
    expect(result.ok && result.value).toMatchObject({ revision: 1, textScale: 'large', textScalePercent: 150 });
    expect(unit.intents[0]).toMatchObject({ action: 'create', capability: 'family.write' });
    expect(unit.mutations).toHaveLength(1);
    expect(unit.row).toMatchObject({ revision: 1, lastMutationId: identifiers.mutationId });
    expect(unit.auditCount).toBe(1);
    expect(unit.eventCount).toBe(1);
  });

  it('replays an exact operation idempotently and rejects payload reuse', async () => {
    const unit = new Unit();
    const useCase = new UpdateAccessibilityPreferencesUseCase(unit);
    const first = await useCase.execute({ context, command, identifiers });
    expect(first.ok).toBe(true);
    const replay = await useCase.execute({ context, command, identifiers });
    expect(replay.ok && replay.value.revision).toBe(1);
    expect(unit.mutations).toHaveLength(1);
    expect(unit.auditCount).toBe(1);
    expect(unit.eventCount).toBe(1);

    const mismatch = await useCase.execute({
      context,
      command: { ...command, textScalePercent: 175 },
      identifiers
    });
    expect(mismatch.ok).toBe(false);
    expect(!mismatch.ok && mismatch.error.code).toBe(ERROR_CODES.RESOURCE_CONFLICT);
  });

  it('fails closed for exact validation, stale revision, foreign identity and downstream failure', async () => {
    const invalidUnit = new Unit();
    const invalidResult = await new UpdateAccessibilityPreferencesUseCase(invalidUnit).execute({
      context,
      command: { ...command, textScalePercent: 99, extra: true } as UpdateAccessibilityPreferencesInput,
      identifiers
    });
    expect(invalidResult.ok).toBe(false);
    expect(invalidUnit.intents).toHaveLength(0);

    const staleUnit = new Unit();
    staleUnit.row = {
      accountId: ACCOUNT,
      familyId: context.familyId,
      ownerPersonId: PERSON,
      revision: 1,
      textScale: 'standard', textScalePercent: 100, highContrast: false, reduceMotion: false,
      theme: 'system', density: 'standard', readingMode: 'standard', audienceProfile: 'standard',
      captionsEnabled: true, audioMuted: false, createdAt: NOW, updatedAt: NOW, lastMutationId: 'prior'
    };
    const stale = await new UpdateAccessibilityPreferencesUseCase(staleUnit).execute({ context, command, identifiers });
    expect(stale.ok).toBe(false);
    expect(!stale.ok && stale.error.code).toBe(ERROR_CODES.RESOURCE_CONFLICT);

    const foreignUnit = new Unit();
    foreignUnit.row = { ...staleUnit.row, ownerPersonId: 'foreign-person' as PersonId };
    const foreign = await new GetAccessibilityPreferencesUseCase(foreignUnit).execute(context);
    expect(foreign.ok).toBe(false);
    expect(!foreign.ok && foreign.error.code).toBe(ERROR_CODES.AUTHORIZATION_DENIED);

    const failingUnit = new Unit();
    failingUnit.auditFailure = true;
    const failed = await new UpdateAccessibilityPreferencesUseCase(failingUnit).execute({ context, command, identifiers });
    expect(failed.ok).toBe(false);
    expect(failingUnit.eventCount).toBe(0);
  });
});
