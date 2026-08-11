import {
  ERROR_CODES,
  createAppError,
  ok,
  type AppError,
  type Clock,
  type Result
} from '@ppt/core';
import type { DomainEvent, EventHandler } from '@ppt/events';
import type { Logger } from '@ppt/logging';

export interface FamilyMemberCreatedPayload {
  readonly familyId: string;
  readonly personId: string;
  readonly displayName: string;
  readonly generation: number;
  readonly branch: string;
}

const isFamilyMemberCreatedPayload = (value: unknown): value is FamilyMemberCreatedPayload => {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Partial<FamilyMemberCreatedPayload>;
  return typeof payload.familyId === 'string'
    && typeof payload.personId === 'string'
    && typeof payload.displayName === 'string'
    && typeof payload.generation === 'number'
    && Number.isInteger(payload.generation)
    && typeof payload.branch === 'string';
};

const invalidPayload = (event: DomainEvent): AppError => createAppError({
  code: ERROR_CODES.CONTRACT_INVALID,
  message: 'family.member.created event payload biçimi geçersiz.',
  category: 'validation',
  correlationId: event.correlationId,
  details: { eventId: event.eventId, eventType: event.eventType }
});

export const createFamilyMemberCreatedLogHandler = (
  logger: Logger | undefined,
  clock: Clock
): EventHandler<FamilyMemberCreatedPayload> => ({
  name: 'family-member-created-structured-log-v1',
  eventType: 'family.member.created',
  handle: async (event): Promise<Result<void, AppError>> => {
    if (!isFamilyMemberCreatedPayload(event.payload)) return { ok: false, error: invalidPayload(event) };
    logger?.info({
      timestamp: clock.now(),
      service: 'desktop-main',
      process: 'event-dispatcher',
      event: 'family.member.created.handled',
      correlationId: event.correlationId,
      outcome: 'success',
      metadata: {
        eventId: event.eventId,
        personId: event.payload.personId,
        familyId: event.payload.familyId,
        generation: event.payload.generation
      }
    });
    return ok(undefined);
  }
});

export const createFamilyMemberCreatedDiagnosticHandler = (
  writeDiagnostic: (
    event: DomainEvent<FamilyMemberCreatedPayload>
  ) => Result<void, AppError> | Promise<Result<void, AppError>>
): EventHandler<FamilyMemberCreatedPayload> => ({
  name: 'family-member-created-diagnostic-v1',
  eventType: 'family.member.created',
  handle: async (event): Promise<Result<void, AppError>> => {
    if (!isFamilyMemberCreatedPayload(event.payload)) return { ok: false, error: invalidPayload(event) };
    return writeDiagnostic(event);
  }
});

export interface FamilyRelationCreatedPayload {
  readonly familyId: string;
  readonly relationId: string;
  readonly fromPersonId: string;
  readonly toPersonId: string;
  readonly relationType: 'parent' | 'spouse' | 'child' | 'sibling' | 'guardian' | 'other';
}

const isFamilyRelationCreatedPayload = (value: unknown): value is FamilyRelationCreatedPayload => {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Partial<FamilyRelationCreatedPayload>;
  return typeof payload.familyId === 'string'
    && typeof payload.relationId === 'string'
    && typeof payload.fromPersonId === 'string'
    && typeof payload.toPersonId === 'string'
    && ['parent', 'spouse', 'child', 'sibling', 'guardian', 'other'].includes(String(payload.relationType));
};

const invalidRelationPayload = (event: DomainEvent): AppError => createAppError({
  code: ERROR_CODES.CONTRACT_INVALID,
  message: 'family.relation.created event payload biçimi geçersiz.',
  category: 'validation',
  correlationId: event.correlationId,
  details: { eventId: event.eventId, eventType: event.eventType }
});

export const createFamilyRelationCreatedLogHandler = (
  logger: Logger | undefined,
  clock: Clock
): EventHandler<FamilyRelationCreatedPayload> => ({
  name: 'family-relation-created-structured-log-v1',
  eventType: 'family.relation.created',
  handle: async (event): Promise<Result<void, AppError>> => {
    if (!isFamilyRelationCreatedPayload(event.payload)) return { ok: false, error: invalidRelationPayload(event) };
    logger?.info({
      timestamp: clock.now(),
      service: 'desktop-main',
      process: 'event-dispatcher',
      event: 'family.relation.created.handled',
      correlationId: event.correlationId,
      outcome: 'success',
      metadata: {
        eventId: event.eventId,
        relationId: event.payload.relationId,
        familyId: event.payload.familyId,
        relationType: event.payload.relationType
      }
    });
    return ok(undefined);
  }
});

export const createFamilyRelationCreatedDiagnosticHandler = (
  writeDiagnostic: (
    event: DomainEvent<FamilyRelationCreatedPayload>
  ) => Result<void, AppError> | Promise<Result<void, AppError>>
): EventHandler<FamilyRelationCreatedPayload> => ({
  name: 'family-relation-created-diagnostic-v1',
  eventType: 'family.relation.created',
  handle: async (event): Promise<Result<void, AppError>> => {
    if (!isFamilyRelationCreatedPayload(event.payload)) return { ok: false, error: invalidRelationPayload(event) };
    return writeDiagnostic(event);
  }
});

export interface ImportantDayCreatedPayload {
  readonly familyId: string;
  readonly eventId: string;
  readonly title: string;
  readonly startAt: string;
  readonly participantCount: number;
  readonly recurrence: 'none' | 'yearly';
  readonly aiProcessingAllowed: boolean;
}

const isImportantDayCreatedPayload = (value: unknown): value is ImportantDayCreatedPayload => {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Partial<ImportantDayCreatedPayload>;
  return typeof payload.familyId === 'string'
    && typeof payload.eventId === 'string'
    && typeof payload.title === 'string'
    && typeof payload.startAt === 'string'
    && typeof payload.participantCount === 'number'
    && Number.isInteger(payload.participantCount)
    && ['none', 'yearly'].includes(String(payload.recurrence))
    && typeof payload.aiProcessingAllowed === 'boolean';
};

const invalidImportantDayPayload = (event: DomainEvent): AppError => createAppError({
  code: ERROR_CODES.CONTRACT_INVALID,
  message: 'timeline.important_day.created event payload biçimi geçersiz.',
  category: 'validation',
  correlationId: event.correlationId,
  details: { eventId: event.eventId, eventType: event.eventType }
});

export const createImportantDayCreatedLogHandler = (
  logger: Logger | undefined,
  clock: Clock
): EventHandler<ImportantDayCreatedPayload> => ({
  name: 'important-day-created-structured-log-v1',
  eventType: 'timeline.important_day.created',
  handle: async (event): Promise<Result<void, AppError>> => {
    if (!isImportantDayCreatedPayload(event.payload)) {
      return { ok: false, error: invalidImportantDayPayload(event) };
    }
    logger?.info({
      timestamp: clock.now(),
      service: 'desktop-main',
      process: 'event-dispatcher',
      event: 'timeline.important_day.created.handled',
      correlationId: event.correlationId,
      outcome: 'success',
      metadata: {
        eventId: event.eventId,
        timelineEventId: event.payload.eventId,
        familyId: event.payload.familyId,
        participantCount: event.payload.participantCount,
        recurrence: event.payload.recurrence,
        aiProcessingAllowed: event.payload.aiProcessingAllowed
      }
    });
    return ok(undefined);
  }
});

export const createImportantDayCreatedDiagnosticHandler = (
  writeDiagnostic: (
    event: DomainEvent<ImportantDayCreatedPayload>
  ) => Result<void, AppError> | Promise<Result<void, AppError>>
): EventHandler<ImportantDayCreatedPayload> => ({
  name: 'important-day-created-diagnostic-v1',
  eventType: 'timeline.important_day.created',
  handle: async (event): Promise<Result<void, AppError>> => {
    if (!isImportantDayCreatedPayload(event.payload)) {
      return { ok: false, error: invalidImportantDayPayload(event) };
    }
    return writeDiagnostic(event);
  }
});
