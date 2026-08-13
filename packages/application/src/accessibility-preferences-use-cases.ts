import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type EventId,
  type FamilyId,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import {
  createDefaultAccessibilityPreferences,
  type AccessibilityPreferencesView,
  type FamilyRole,
  type UpdateAccessibilityPreferencesInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  AccessibilityPreferencesMutationRow,
  AccessibilityPreferencesRow
} from '@ppt/repository-contracts';

export interface AccessibilityPreferencesApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: {
    readonly userId: UserId;
    readonly role: FamilyRole;
    readonly personId?: PersonId;
  };
  readonly correlationId: CorrelationId;
}

export interface AccessibilityPreferencesPolicyIntent {
  readonly action: 'read' | 'create' | 'update';
  readonly capability: 'family.read' | 'family.write';
  readonly resourceType: 'accessibility_preferences';
  readonly resourceId: UserId;
  readonly purpose: 'general';
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly privacy: 'private';
  readonly sensitivity: 'personal';
}

export interface AccessibilityPreferencesWriteScope {
  readonly occurredAt: IsoDateTime;
  find(accountId: UserId): Result<AccessibilityPreferencesRow | null, AppError>;
  findMutationByClientOperationId(
    accountId: UserId,
    clientOperationId: string
  ): Result<AccessibilityPreferencesMutationRow | null, AppError>;
  insertMutation(row: AccessibilityPreferencesMutationRow): Result<void, AppError>;
  saveCurrent(row: AccessibilityPreferencesRow, expectedRevision: number): Result<boolean, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: 'accessibility_preferences';
    readonly resourceId: UserId;
    readonly occurredAt: IsoDateTime;
    readonly actorId: UserId;
  }): Result<string, AppError>;
  enqueueEvent<T>(event: DomainEvent<T>): Result<void, AppError>;
}

export interface AccessibilityPreferencesUnitOfWork {
  execute<T>(
    context: AccessibilityPreferencesApplicationContext,
    intent: AccessibilityPreferencesPolicyIntent,
    operation: (scope: AccessibilityPreferencesWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

export interface UpdateAccessibilityPreferencesIdentifiers {
  readonly mutationId: string;
  readonly requestFingerprint: string;
  readonly auditId: string;
  readonly outboxEventId: EventId;
}

const invalid = (context: AccessibilityPreferencesApplicationContext, message: string): AppError =>
  createAppError({
    code: ERROR_CODES.CORE_INVALID_ARGUMENT,
    message,
    category: 'validation',
    correlationId: context.correlationId
  });

const denied = (context: AccessibilityPreferencesApplicationContext, message: string): AppError =>
  createAppError({
    code: ERROR_CODES.AUTHORIZATION_DENIED,
    message,
    category: 'authorization',
    correlationId: context.correlationId
  });

const conflict = (context: AccessibilityPreferencesApplicationContext, message: string): AppError =>
  createAppError({
    code: ERROR_CODES.RESOURCE_CONFLICT,
    message,
    category: 'conflict',
    correlationId: context.correlationId
  });

const requiredCommandKeys = [
  'expectedRevision',
  'clientOperationId',
  'textScale',
  'textScalePercent',
  'highContrast',
  'reduceMotion',
  'theme',
  'density',
  'readingMode',
  'audienceProfile',
  'captionsEnabled',
  'audioMuted'
] as const;

const exactCommand = (value: unknown): value is UpdateAccessibilityPreferencesInput => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Object.keys(value).sort();
  const expected = [...requiredCommandKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) return false;
  const command = value as Record<string, unknown>;
  return Number.isSafeInteger(command.expectedRevision) && Number(command.expectedRevision) >= 0
    && typeof command.clientOperationId === 'string'
    && command.clientOperationId === command.clientOperationId.trim()
    && /^[A-Za-z0-9._:-]{8,128}$/u.test(command.clientOperationId)
    && (command.textScale === 'standard' || command.textScale === 'large' || command.textScale === 'extra-large')
    && Number.isInteger(command.textScalePercent)
    && Number(command.textScalePercent) >= 100
    && Number(command.textScalePercent) <= 225
    && typeof command.highContrast === 'boolean'
    && typeof command.reduceMotion === 'boolean'
    && (command.theme === 'system' || command.theme === 'light' || command.theme === 'dark')
    && (command.density === 'comfortable' || command.density === 'standard' || command.density === 'compact')
    && (command.readingMode === 'standard' || command.readingMode === 'easy-read')
    && (command.audienceProfile === 'youth' || command.audienceProfile === 'standard'
      || command.audienceProfile === 'senior' || command.audienceProfile === 'low-vision'
      || command.audienceProfile === 'caregiver')
    && typeof command.captionsEnabled === 'boolean'
    && typeof command.audioMuted === 'boolean';
};

const sameMutationRequest = (
  row: AccessibilityPreferencesMutationRow,
  command: UpdateAccessibilityPreferencesInput,
  fingerprint: string
): boolean => row.requestFingerprint === fingerprint
  && row.previousRevision === command.expectedRevision
  && row.textScale === command.textScale
  && row.textScalePercent === command.textScalePercent
  && row.highContrast === command.highContrast
  && row.reduceMotion === command.reduceMotion
  && row.theme === command.theme
  && row.density === command.density
  && row.readingMode === command.readingMode
  && row.audienceProfile === command.audienceProfile
  && row.captionsEnabled === command.captionsEnabled
  && row.audioMuted === command.audioMuted;

const viewFromMutation = (row: AccessibilityPreferencesMutationRow): AccessibilityPreferencesView => ({
  accountId: row.accountId,
  familyId: row.familyId,
  ownerPersonId: row.ownerPersonId,
  revision: row.revision,
  textScale: row.textScale,
  textScalePercent: row.textScalePercent,
  highContrast: row.highContrast,
  reduceMotion: row.reduceMotion,
  theme: row.theme,
  density: row.density,
  readingMode: row.readingMode,
  audienceProfile: row.audienceProfile,
  captionsEnabled: row.captionsEnabled,
  audioMuted: row.audioMuted,
  updatedAt: row.createdAt
});

const viewFromRow = (row: AccessibilityPreferencesRow): AccessibilityPreferencesView => ({
  accountId: row.accountId,
  familyId: row.familyId,
  ownerPersonId: row.ownerPersonId,
  revision: row.revision,
  textScale: row.textScale,
  textScalePercent: row.textScalePercent,
  highContrast: row.highContrast,
  reduceMotion: row.reduceMotion,
  theme: row.theme,
  density: row.density,
  readingMode: row.readingMode,
  audienceProfile: row.audienceProfile,
  captionsEnabled: row.captionsEnabled,
  audioMuted: row.audioMuted,
  updatedAt: row.updatedAt
});

const preferenceIntent = (
  context: AccessibilityPreferencesApplicationContext,
  ownerPersonId: PersonId,
  action: AccessibilityPreferencesPolicyIntent['action']
): AccessibilityPreferencesPolicyIntent => ({
  action,
  capability: action === 'read' ? 'family.read' : 'family.write',
  resourceType: 'accessibility_preferences',
  resourceId: context.actor.userId,
  purpose: 'general',
  familyId: context.familyId,
  ownerPersonId,
  privacy: 'private',
  sensitivity: 'personal'
});

const identityIsExact = (
  row: AccessibilityPreferencesRow | AccessibilityPreferencesMutationRow,
  context: AccessibilityPreferencesApplicationContext,
  ownerPersonId: PersonId
): boolean => row.accountId === context.actor.userId
  && row.familyId === context.familyId
  && row.ownerPersonId === ownerPersonId;

export class GetAccessibilityPreferencesUseCase {
  public constructor(private readonly unitOfWork: AccessibilityPreferencesUnitOfWork) {}

  public execute(
    context: AccessibilityPreferencesApplicationContext
  ): Promise<Result<AccessibilityPreferencesView, AppError>> {
    const ownerPersonId = context.actor.personId;
    if (!ownerPersonId) return Promise.resolve(err(denied(context, 'Erişilebilirlik tercihleri için kişi bağlı oturum gereklidir.')));
    return this.unitOfWork.execute(context, preferenceIntent(context, ownerPersonId, 'read'), (scope) => {
      const stored = scope.find(context.actor.userId);
      if (!stored.ok) return stored;
      if (!stored.value) {
        return ok(createDefaultAccessibilityPreferences({
          accountId: context.actor.userId,
          familyId: context.familyId,
          ownerPersonId,
          updatedAt: scope.occurredAt
        }));
      }
      if (!identityIsExact(stored.value, context, ownerPersonId)) {
        return err(denied(context, 'Erişilebilirlik tercihi hesap, aile veya kişi kapsamıyla eşleşmiyor.'));
      }
      return ok(viewFromRow(stored.value));
    });
  }
}

export class UpdateAccessibilityPreferencesUseCase {
  public constructor(private readonly unitOfWork: AccessibilityPreferencesUnitOfWork) {}

  public execute(input: {
    readonly context: AccessibilityPreferencesApplicationContext;
    readonly command: UpdateAccessibilityPreferencesInput;
    readonly identifiers: UpdateAccessibilityPreferencesIdentifiers;
  }): Promise<Result<AccessibilityPreferencesView, AppError>> {
    const ownerPersonId = input.context.actor.personId;
    if (!ownerPersonId) return Promise.resolve(err(denied(input.context, 'Erişilebilirlik tercihleri için kişi bağlı oturum gereklidir.')));
    if (!exactCommand(input.command)) {
      return Promise.resolve(err(invalid(input.context, 'Erişilebilirlik tercih güncellemesi eksik, fazla veya geçersiz alan içeriyor.')));
    }
    if (!input.identifiers.mutationId.trim() || !input.identifiers.auditId.trim()
      || !/^[0-9a-f]{64}$/u.test(input.identifiers.requestFingerprint)) {
      return Promise.resolve(err(invalid(input.context, 'İşlem, denetim veya istek parmak izi kimliği geçersiz.')));
    }
    if (input.command.expectedRevision >= 2_147_483_647) {
      return Promise.resolve(err(conflict(input.context, 'Erişilebilirlik tercih revizyon sınırına ulaştı.')));
    }

    const action = input.command.expectedRevision === 0 ? 'create' : 'update';
    return this.unitOfWork.execute(input.context, preferenceIntent(input.context, ownerPersonId, action), (scope) => {
      const replay = scope.findMutationByClientOperationId(input.context.actor.userId, input.command.clientOperationId);
      if (!replay.ok) return replay;
      if (replay.value) {
        if (!identityIsExact(replay.value, input.context, ownerPersonId)
          || !sameMutationRequest(replay.value, input.command, input.identifiers.requestFingerprint)) {
          return err(conflict(input.context, 'İşlem kimliği farklı kapsam veya istek içeriğiyle daha önce kullanılmış.'));
        }
        return ok(viewFromMutation(replay.value));
      }

      const current = scope.find(input.context.actor.userId);
      if (!current.ok) return current;
      if (current.value && !identityIsExact(current.value, input.context, ownerPersonId)) {
        return err(denied(input.context, 'Erişilebilirlik tercihi hesap, aile veya kişi kapsamıyla eşleşmiyor.'));
      }
      const actualRevision = current.value?.revision ?? 0;
      if (actualRevision !== input.command.expectedRevision) {
        return err(conflict(input.context, 'Erişilebilirlik tercih revizyonu güncel değil.'));
      }

      const revision = actualRevision + 1;
      const mutation: AccessibilityPreferencesMutationRow = {
        id: input.identifiers.mutationId,
        clientOperationId: input.command.clientOperationId,
        requestFingerprint: input.identifiers.requestFingerprint,
        familyId: input.context.familyId,
        accountId: input.context.actor.userId,
        ownerPersonId,
        previousRevision: actualRevision,
        revision,
        textScale: input.command.textScale,
        textScalePercent: input.command.textScalePercent,
        highContrast: input.command.highContrast,
        reduceMotion: input.command.reduceMotion,
        theme: input.command.theme,
        density: input.command.density,
        readingMode: input.command.readingMode,
        audienceProfile: input.command.audienceProfile,
        captionsEnabled: input.command.captionsEnabled,
        audioMuted: input.command.audioMuted,
        createdAt: scope.occurredAt
      };
      const row: AccessibilityPreferencesRow = {
        ...viewFromMutation(mutation),
        accountId: input.context.actor.userId,
        familyId: input.context.familyId,
        ownerPersonId,
        createdAt: current.value?.createdAt ?? scope.occurredAt,
        updatedAt: scope.occurredAt,
        lastMutationId: mutation.id
      };

      const mutationInserted = scope.insertMutation(mutation);
      if (!mutationInserted.ok) return mutationInserted;
      const saved = scope.saveCurrent(row, actualRevision);
      if (!saved.ok) return saved;
      if (!saved.value) return err(conflict(input.context, 'Erişilebilirlik tercih revizyonu eşzamanlı olarak değişti.'));
      const audited = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'accessibility_preferences.updated',
        resourceType: 'accessibility_preferences',
        resourceId: input.context.actor.userId,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audited.ok) return audited;
      const event: DomainEvent<{ readonly revision: number; readonly clientOperationId: string }> = {
        eventId: input.identifiers.outboxEventId,
        eventType: 'accessibility_preferences.updated',
        eventVersion: 1,
        aggregateType: 'accessibility_preferences',
        aggregateId: input.context.actor.userId,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: { revision, clientOperationId: input.command.clientOperationId }
      };
      const enqueued = scope.enqueueEvent(event);
      if (!enqueued.ok) return enqueued;
      return ok(viewFromRow(row));
    });
  }
}
