import {
  ERROR_CODES,
  asIsoDateTime,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type Clock,
  type CorrelationId,
  type EventId,
  type FamilyId,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import type {
  AcknowledgeFamilyNotificationInput,
  CreateFamilyEventInput,
  UpdateEventInvitationInput,
  UpdateEventNotesInput,
  UpdateEventParticipantsInput,
  UpdateFamilyEventInput,
  SetFamilyEventArchivedInput,
  FamilyEventView,
  FamilyLocationView,
  FamilyNotificationView
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';

export interface TimelineApplicationActor {
  readonly userId: UserId;
  readonly roles: readonly string[];
  readonly personId?: PersonId;
}

export interface TimelineApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: TimelineApplicationActor;
  readonly correlationId: CorrelationId;
}

export type TimelineDataSensitivity = 'personal' | 'sensitive' | 'highly_sensitive';

export interface TimelinePolicyIntent {
  readonly action: 'read' | 'create' | 'update' | 'delete';
  readonly capability: 'family.read' | 'family.write';
  readonly resourceType:
    | 'event'
    | 'accessibility_preferences'
    | 'form_draft'
    | 'privacy_ownership_center'
    | 'ai_memory_record'
    | 'data_rights_request'
    | 'privacy_incident'
    | 'identity_access_center'
    | 'identity_challenge'
    | 'passkey_credential'
    | 'federated_identity_link'
    | 'temporary_verifiable_credential'
    | 'companion_sync_snapshot';
  readonly resourceId: string;
  readonly purpose: 'general' | 'ai_processing' | 'administration';
  readonly ownerPersonId?: PersonId;
  readonly targetSensitivity?: TimelineDataSensitivity;
  readonly sourceResourceId?: string;
  readonly sourceResourceMode?: 'preserve' | 'replace';
}

export interface TimelineLocationRecord {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly label: string;
  readonly address?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly kind: FamilyLocationView['kind'];
}

export interface TimelineEventRecord {
  readonly id: EventId;
  readonly familyId: FamilyId;
  readonly ownerPersonId?: PersonId;
  readonly kind: string;
  readonly title: string;
  readonly description?: string;
  readonly startAt: IsoDateTime;
  readonly locationId?: string;
  readonly locationLabel?: string;
  readonly visibility: FamilyEventView['visibility'];
  readonly participantPersonIds: readonly PersonId[];
  readonly invitationText?: string;
  readonly notes?: string;
  readonly attachmentCount: number;
  readonly aiProcessingAllowed: boolean;
  readonly recurrence: FamilyEventView['recurrence'];
  readonly reminderDays: readonly number[];
  readonly createdAt: IsoDateTime;
  readonly updatedAt?: IsoDateTime;
  readonly archivedAt?: IsoDateTime;
  /** Internal durable timeline policy provenance; never projected to renderer views. */
  readonly policyReceiptHash?: string;
  /** Exact governed location-read receipt used when the location reference was attached. */
  readonly sourceLocationReceiptHash?: string;
}

export interface TimelineNotificationStateRecord {
  readonly notificationId: string;
  readonly accountId: UserId;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly occurrenceKey: string;
  readonly acknowledgedAt?: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export interface TimelineReadModel {
  readonly locations: readonly FamilyLocationView[];
  readonly events: readonly FamilyEventView[];
  readonly notifications: readonly FamilyNotificationView[];
}

export interface TimelineQueryPort {
  load(context: TimelineApplicationContext): Promise<Result<{
    readonly locations: readonly TimelineLocationRecord[];
    readonly events: readonly TimelineEventRecord[];
  }, AppError>>;
  findVisibleById(
    context: TimelineApplicationContext,
    eventId: EventId
  ): Promise<Result<TimelineEventRecord | null, AppError>>;
  listArchived(context: TimelineApplicationContext): Promise<Result<readonly TimelineEventRecord[], AppError>>;
  listNotificationStates(
    context: TimelineApplicationContext,
    notificationIds: readonly string[]
  ): Result<readonly TimelineNotificationStateRecord[], AppError>;
}

export interface TimelineWriteScope {
  readonly occurredAt: IsoDateTime;
  findFamily(familyId: FamilyId): Result<{ readonly id: FamilyId } | null, AppError>;
  listPeople(familyId: FamilyId): Result<readonly { readonly id: PersonId }[], AppError>;
  findLocation(locationId: string): Result<TimelineLocationRecord | null, AppError>;
  findEvent(eventId: EventId): Result<TimelineEventRecord | null, AppError>;
  insertEvent(event: TimelineEventRecord): Result<void, AppError>;
  updateEvent(event: TimelineEventRecord): Result<boolean, AppError>;
  setEventArchived(eventId: EventId, archivedAt?: IsoDateTime): Result<boolean, AppError>;
  updateParticipants(eventId: EventId, participantPersonIds: readonly PersonId[], visibility: FamilyEventView['visibility']): Result<boolean, AppError>;
  updateInvitation(eventId: EventId, invitationText?: string): Result<boolean, AppError>;
  updateNotes(eventId: EventId, notes?: string): Result<boolean, AppError>;
  acknowledgeNotification(state: TimelineNotificationStateRecord): Result<void, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: IsoDateTime;
    readonly actorId: UserId;
  }): Result<string, AppError>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
}

export type TimelineUnitOfWorkOptions =
  | Readonly<{
      policyIntent: TimelinePolicyIntent;
      governedLocationReadId?: string;
    }>
  | Readonly<{ notificationMutation: true }>;

export interface TimelineApplicationUnitOfWork {
  execute<TValue>(
    context: TimelineApplicationContext,
    operation: (scope: TimelineWriteScope) => Result<TValue, AppError>,
    options: TimelineUnitOfWorkOptions
  ): Promise<Result<TValue, AppError>>;
}

export interface CreateImportantDayIdentifiers {
  readonly eventId: EventId;
  readonly auditId: string;
  readonly outboxEventId: EventId;
}

export interface ImportantDayCreatedPayload {
  readonly familyId: string;
  readonly eventId: string;
  readonly title: string;
  readonly startAt: string;
  readonly participantCount: number;
  readonly recurrence: FamilyEventView['recurrence'];
  readonly aiProcessingAllowed: boolean;
}

const validationError = (
  correlationId: CorrelationId,
  message: string,
  details?: Readonly<Record<string, unknown>>
): AppError => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT,
  message,
  category: 'validation',
  correlationId,
  ...(details ? { details } : {})
});

const notFoundError = (
  correlationId: CorrelationId,
  message: string,
  details?: Readonly<Record<string, unknown>>
): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_NOT_FOUND,
  message,
  category: 'not_found',
  correlationId,
  ...(details ? { details } : {})
});

const trimOptional = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized || undefined;
};

const timelineSensitivityForVisibility = (
  visibility: FamilyEventView['visibility']
): TimelineDataSensitivity => visibility === 'personal'
  ? 'highly_sensitive'
  : visibility === 'selected_members' ? 'sensitive' : 'personal';

const toView = (event: TimelineEventRecord): FamilyEventView => ({
  id: event.id,
  kind: event.kind,
  title: event.title,
  ...(event.description ? { description: event.description } : {}),
  startAt: event.startAt,
  ...(event.locationId ? { locationId: event.locationId } : {}),
  ...(event.locationLabel ? { locationLabel: event.locationLabel } : {}),
  visibility: event.visibility,
  participantPersonIds: [...event.participantPersonIds],
  ...(event.invitationText ? { invitationText: event.invitationText } : {}),
  ...(event.notes ? { notes: event.notes } : {}),
  attachmentCount: event.attachmentCount,
  aiProcessingAllowed: event.aiProcessingAllowed,
  recurrence: event.recurrence,
  reminderDays: [...event.reminderDays],
  createdAt: event.createdAt,
  ...(event.updatedAt ? { updatedAt: event.updatedAt } : {}),
  ...(event.archivedAt ? { archivedAt: event.archivedAt } : {})
});

const buildNotifications = (
  events: readonly FamilyEventView[],
  nowValue: IsoDateTime
): FamilyNotificationView[] => {
  const now = new Date(nowValue);
  const horizon = new Date(now.getTime() + 90 * 86_400_000);
  const result: FamilyNotificationView[] = [];
  for (const event of events.filter((item) => item.kind === 'important_day')) {
    let occurrence = new Date(event.startAt);
    if (Number.isNaN(occurrence.getTime())) continue;
    if (event.recurrence === 'yearly') {
      occurrence = new Date(
        now.getFullYear(),
        occurrence.getMonth(),
        occurrence.getDate(),
        occurrence.getHours(),
        occurrence.getMinutes(),
        occurrence.getSeconds(),
        occurrence.getMilliseconds()
      );
      if (occurrence < now) occurrence.setFullYear(occurrence.getFullYear() + 1);
    }
    if (occurrence < now || occurrence > horizon) continue;
    const days = Math.ceil((occurrence.getTime() - now.getTime()) / 86_400_000);
    if (!event.reminderDays.some((reminder) => days <= reminder)) continue;
    result.push({
      id: `notification-${event.id}-${occurrence.getFullYear()}`,
      title: event.title,
      body: days <= 0 ? 'Bugün' : `${days} gün sonra`,
      dueAt: occurrence.toISOString(),
      occurrenceKey: occurrence.toISOString(),
      sourceType: 'important_day',
      sourceId: event.id,
      urgency: days <= 0 ? 'today' : days <= 7 ? 'soon' : 'later'
    });
  }
  return result.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
};

export class GetTimelineReadModelUseCase {
  public constructor(
    private readonly query: TimelineQueryPort,
    private readonly clock: Clock
  ) {}

  public async execute(context: TimelineApplicationContext): Promise<Result<TimelineReadModel, AppError>> {
    const loaded = await this.query.load(context);
    if (!loaded.ok) return loaded;
    const events = loaded.value.events.map(toView);
    const notifications = buildNotifications(events, this.clock.now());
    const states = this.query.listNotificationStates(context, notifications.map((item) => item.id));
    if (!states.ok) return states;
    const stateById = new Map(states.value.map((item) => [item.notificationId, item]));
    return ok({
      locations: loaded.value.locations.map((location) => ({
        id: location.id,
        label: location.label,
        ...(location.address ? { address: location.address } : {}),
        ...(location.latitude !== undefined ? { latitude: location.latitude } : {}),
        ...(location.longitude !== undefined ? { longitude: location.longitude } : {}),
        kind: location.kind
      })),
      events,
      notifications: notifications.map((notification) => {
        const state = stateById.get(notification.id);
        return state?.acknowledgedAt ? { ...notification, acknowledgedAt: state.acknowledgedAt } : notification;
      })
    });
  }
}

export class GetImportantDayDetailsUseCase {
  public constructor(private readonly query: TimelineQueryPort) {}

  public async execute(input: {
    readonly context: TimelineApplicationContext;
    readonly eventId: EventId;
  }): Promise<Result<FamilyEventView, AppError>> {
    const event = await this.query.findVisibleById(input.context, input.eventId);
    if (!event.ok) return event;
    if (!event.value || event.value.kind !== 'important_day') {
      return err(notFoundError(input.context.correlationId, 'Önemli gün kaydı bulunamadı.', {
        eventId: input.eventId
      }));
    }
    return ok(toView(event.value));
  }
}

export class ListArchivedTimelineEventsUseCase {
  public constructor(private readonly query: TimelineQueryPort) {}

  public async execute(context: TimelineApplicationContext): Promise<Result<readonly FamilyEventView[], AppError>> {
    const result = await this.query.listArchived(context);
    return result.ok ? ok(result.value.map(toView)) : result;
  }
}

export class CreateImportantDayUseCase {
  public constructor(private readonly unitOfWork: TimelineApplicationUnitOfWork) {}

  public async execute(input: {
    readonly context: TimelineApplicationContext;
    readonly command: CreateFamilyEventInput;
    readonly identifiers: CreateImportantDayIdentifiers;
  }): Promise<Result<EventId, AppError>> {
    const title = input.command.title.trim();
    if (title.length < 2 || title.length > 160) {
      return err(validationError(input.context.correlationId, 'Etkinlik başlığı 2 ile 160 karakter arasında olmalıdır.'));
    }
    const parsedStartAt = new Date(input.command.startAt);
    if (Number.isNaN(parsedStartAt.getTime())) {
      return err(validationError(input.context.correlationId, 'Geçerli bir tarih ve saat girilmelidir.'));
    }
    const visibility = input.command.visibility;
    if (!['personal', 'selected_members', 'family'].includes(visibility)) {
      return err(validationError(input.context.correlationId, 'Etkinlik görünürlüğü geçersizdir.'));
    }
    const recurrence = input.command.recurrence === 'yearly' ? 'yearly' : 'none';
    const participantIds = [...new Set(input.command.participantPersonIds.map((value) => value.trim()).filter(Boolean))]
      .map(asPersonId);
    if (visibility === 'selected_members' && participantIds.length === 0) {
      return err(validationError(input.context.correlationId, 'Seçili üyeler görünürlüğü için en az bir katılımcı seçilmelidir.'));
    }
    const reminderDays = [...new Set(input.command.reminderDays ?? [7, 1])]
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 365)
      .sort((left, right) => right - left);
    if ((input.command.reminderDays?.length ?? 0) > 0 && reminderDays.length === 0) {
      return err(validationError(input.context.correlationId, 'Hatırlatma günleri 0 ile 365 arasında tam sayı olmalıdır.'));
    }
    const description = trimOptional(input.command.description);
    const invitationText = trimOptional(input.command.invitationText);
    const notes = trimOptional(input.command.notes);
    const fallbackLocationLabel = trimOptional(input.command.locationLabel);
    if ((description?.length ?? 0) > 4_000) {
      return err(validationError(input.context.correlationId, 'Etkinlik açıklaması 4000 karakteri aşamaz.'));
    }
    if ((invitationText?.length ?? 0) > 4_000) {
      return err(validationError(input.context.correlationId, 'Davetiye metni 4000 karakteri aşamaz.'));
    }
    if ((notes?.length ?? 0) > 8_000) {
      return err(validationError(input.context.correlationId, 'Etkinlik notları 8000 karakteri aşamaz.'));
    }
    if ((fallbackLocationLabel?.length ?? 0) > 240) {
      return err(validationError(input.context.correlationId, 'Konum açıklaması 240 karakteri aşamaz.'));
    }

    return this.unitOfWork.execute(input.context, (scope) => {
      const family = scope.findFamily(input.context.familyId);
      if (!family.ok) return family;
      if (!family.value) {
        return err(notFoundError(input.context.correlationId, 'Aile kaydı bulunamadı.', {
          familyId: input.context.familyId
        }));
      }

      const people = scope.listPeople(input.context.familyId);
      if (!people.ok) return people;
      const knownPeople = new Set(people.value.map((person) => person.id));
      const unknownParticipantIds = participantIds.filter((personId) => !knownPeople.has(personId));
      if (unknownParticipantIds.length > 0) {
        return err(notFoundError(input.context.correlationId, 'Katılımcılardan biri aile kaydında bulunamadı.', {
          participantPersonIds: unknownParticipantIds
        }));
      }

      let location: TimelineLocationRecord | null = null;
      if (input.command.locationId) {
        const found = scope.findLocation(input.command.locationId);
        if (!found.ok) return found;
        if (!found.value || found.value.familyId !== input.context.familyId) {
          return err(notFoundError(input.context.correlationId, 'Seçilen konum bulunamadı.', {
            locationId: input.command.locationId
          }));
        }
        location = found.value;
      }

      const event: TimelineEventRecord = {
        id: input.identifiers.eventId,
        familyId: input.context.familyId,
        kind: 'important_day',
        title,
        ...(description ? { description } : {}),
        startAt: asIsoDateTime(parsedStartAt.toISOString()),
        ...(location ? { locationId: location.id, locationLabel: location.label } : {}),
        ...(!location && fallbackLocationLabel ? { locationLabel: fallbackLocationLabel } : {}),
        visibility,
        participantPersonIds: participantIds,
        ...(invitationText ? { invitationText } : {}),
        ...(notes ? { notes } : {}),
        attachmentCount: 0,
        aiProcessingAllowed: input.command.aiProcessingAllowed,
        recurrence,
        reminderDays,
        createdAt: scope.occurredAt
      };

      const inserted = scope.insertEvent(event);
      if (!inserted.ok) return inserted;
      const audited = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'event.created',
        resourceType: 'event',
        resourceId: event.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audited.ok) return audited;

      const queued = scope.enqueueEvent<ImportantDayCreatedPayload>({
        eventId: input.identifiers.outboxEventId,
        eventType: 'timeline.important_day.created',
        eventVersion: 1,
        aggregateType: 'event',
        aggregateId: event.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: {
          familyId: input.context.familyId,
          eventId: event.id,
          title: event.title,
          startAt: event.startAt,
          participantCount: event.participantPersonIds.length,
          recurrence: event.recurrence,
          aiProcessingAllowed: event.aiProcessingAllowed
        }
      });
      if (!queued.ok) return queued;
      return ok(event.id);
    }, {
      policyIntent: {
        action: 'create',
        capability: 'family.write',
        resourceType: 'event',
        resourceId: input.identifiers.eventId,
        purpose: 'general',
        ...(input.context.actor.personId ? { ownerPersonId: input.context.actor.personId } : {}),
        targetSensitivity: timelineSensitivityForVisibility(visibility),
        sourceResourceMode: 'replace',
        ...(input.command.locationId ? { sourceResourceId: input.command.locationId } : {})
      },
      ...(input.command.locationId ? { governedLocationReadId: input.command.locationId } : {})
    });
  }
}


export interface TimelineMutationIdentifiers {
  readonly auditId: string;
  readonly outboxEventId: EventId;
}

const ensureImportantDay = (
  scope: TimelineWriteScope,
  context: TimelineApplicationContext,
  eventId: EventId
): Result<TimelineEventRecord, AppError> => {
  const event = scope.findEvent(eventId);
  if (!event.ok) return event;
  if (!event.value || event.value.familyId !== context.familyId || event.value.kind !== 'important_day') {
    return err(notFoundError(context.correlationId, 'Önemli gün kaydı bulunamadı.', { eventId }));
  }
  return ok(event.value);
};

const normalizeEventMutation = (
  context: TimelineApplicationContext,
  command: UpdateFamilyEventInput
): Result<{
  title:string;
  description?:string;
  startAt:IsoDateTime;
  locationLabel?:string;
  visibility:FamilyEventView['visibility'];
  participantPersonIds:PersonId[];
  invitationText?:string;
  notes?:string;
  aiProcessingAllowed:boolean;
  recurrence:FamilyEventView['recurrence'];
  reminderDays:number[];
}, AppError> => {
  const title=command.title.trim();
  if(title.length<2||title.length>160)return err(validationError(context.correlationId,'Etkinlik başlığı 2 ile 160 karakter arasında olmalıdır.'));
  const parsed=new Date(command.startAt);
  if(Number.isNaN(parsed.getTime()))return err(validationError(context.correlationId,'Geçerli bir tarih ve saat girilmelidir.'));
  if(!['personal','selected_members','family'].includes(command.visibility))return err(validationError(context.correlationId,'Etkinlik görünürlüğü geçersizdir.'));
  const participantPersonIds=[...new Set(command.participantPersonIds.map(value=>value.trim()).filter(Boolean))].map(asPersonId);
  if(command.visibility==='selected_members'&&participantPersonIds.length===0)return err(validationError(context.correlationId,'Seçili üyeler görünürlüğü için en az bir katılımcı seçilmelidir.'));
  const description=trimOptional(command.description);
  const invitationText=trimOptional(command.invitationText);
  const notes=trimOptional(command.notes);
  const locationLabel=trimOptional(command.locationLabel);
  if((description?.length??0)>4000)return err(validationError(context.correlationId,'Etkinlik açıklaması 4000 karakteri aşamaz.'));
  if((invitationText?.length??0)>4000)return err(validationError(context.correlationId,'Davetiye metni 4000 karakteri aşamaz.'));
  if((notes?.length??0)>8000)return err(validationError(context.correlationId,'Etkinlik notları 8000 karakteri aşamaz.'));
  if((locationLabel?.length??0)>240)return err(validationError(context.correlationId,'Konum açıklaması 240 karakteri aşamaz.'));
  const reminderDays=[...new Set(command.reminderDays)].filter(value=>Number.isInteger(value)&&value>=0&&value<=365).sort((left,right)=>right-left);
  if(command.reminderDays.length>0&&reminderDays.length===0)return err(validationError(context.correlationId,'Hatırlatma günleri 0 ile 365 arasında tam sayı olmalıdır.'));
  return ok({
    title,
    ...(description?{description}:{}),
    startAt:asIsoDateTime(parsed.toISOString()),
    ...(locationLabel?{locationLabel}:{}),
    visibility:command.visibility,
    participantPersonIds,
    ...(invitationText?{invitationText}:{}),
    ...(notes?{notes}:{}),
    aiProcessingAllowed:command.aiProcessingAllowed,
    recurrence:command.recurrence==='yearly'?'yearly':'none',
    reminderDays
  });
};

export class UpdateFamilyEventUseCase {
  public constructor(private readonly unitOfWork:TimelineApplicationUnitOfWork){}
  public async execute(input:{readonly context:TimelineApplicationContext;readonly command:UpdateFamilyEventInput;readonly identifiers:TimelineMutationIdentifiers}):Promise<Result<void,AppError>>{
    const normalized=normalizeEventMutation(input.context,input.command);
    if(!normalized.ok)return normalized;
    const eventId=input.command.eventId as EventId;
    return this.unitOfWork.execute(input.context,scope=>{
      const existing=scope.findEvent(eventId);
      if(!existing.ok)return existing;
      if(!existing.value||existing.value.familyId!==input.context.familyId)return err(notFoundError(input.context.correlationId,'Zaman tüneli kaydı bulunamadı.',{eventId}));
      const people=scope.listPeople(input.context.familyId);
      if(!people.ok)return people;
      const known=new Set(people.value.map(person=>person.id));
      const unknown=normalized.value.participantPersonIds.filter(personId=>!known.has(personId));
      if(unknown.length)return err(notFoundError(input.context.correlationId,'Katılımcılardan biri aile kaydında bulunamadı.',{participantPersonIds:unknown}));
      let location:TimelineLocationRecord|null=null;
      if(input.command.locationId){
        const found=scope.findLocation(input.command.locationId);
        if(!found.ok)return found;
        if(!found.value||found.value.familyId!==input.context.familyId)return err(notFoundError(input.context.correlationId,'Seçilen konum bulunamadı.',{locationId:input.command.locationId}));
        location=found.value;
      }
      const {locationId:_oldLocationId,locationLabel:_oldLocationLabel,...eventBase}=existing.value;
      const updated:TimelineEventRecord={
        ...eventBase,
        ...normalized.value,
        ...(location?{locationId:location.id,locationLabel:location.label}:{}),
        updatedAt:scope.occurredAt
      };
      const saved=scope.updateEvent(updated);
      if(!saved.ok)return saved;
      if(!saved.value)return err(notFoundError(input.context.correlationId,'Zaman tüneli kaydı bulunamadı.',{eventId}));
      const audit=scope.appendAudit({id:input.identifiers.auditId,action:'event.updated',resourceType:'event',resourceId:eventId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId});
      if(!audit.ok)return audit;
      return scope.enqueueEvent({eventId:input.identifiers.outboxEventId,eventType:'timeline.event.updated',eventVersion:1,aggregateType:'event',aggregateId:eventId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId,correlationId:input.context.correlationId,payload:{eventId,title:updated.title,startAt:updated.startAt}});
    }, {
      policyIntent: {
        action: 'update', capability: 'family.write', resourceType: 'event', resourceId: eventId,
        purpose: 'general', targetSensitivity: timelineSensitivityForVisibility(normalized.value.visibility),
        sourceResourceMode: 'replace',
        ...(input.command.locationId ? { sourceResourceId: input.command.locationId } : {})
      },
      ...(input.command.locationId ? { governedLocationReadId: input.command.locationId } : {})
    });
  }
}

export class SetFamilyEventArchivedUseCase {
  public constructor(private readonly unitOfWork:TimelineApplicationUnitOfWork){}
  public async execute(input:{readonly context:TimelineApplicationContext;readonly command:SetFamilyEventArchivedInput;readonly identifiers:TimelineMutationIdentifiers}):Promise<Result<void,AppError>>{
    const eventId=input.command.eventId as EventId;
    return this.unitOfWork.execute(input.context,scope=>{
      const existing=scope.findEvent(eventId);
      if(!existing.ok)return existing;
      if(!existing.value||existing.value.familyId!==input.context.familyId)return err(notFoundError(input.context.correlationId,'Zaman tüneli kaydı bulunamadı.',{eventId}));
      const archivedAt=input.command.archived?scope.occurredAt:undefined;
      const changed=scope.setEventArchived(eventId,archivedAt);
      if(!changed.ok)return changed;
      if(!changed.value)return err(notFoundError(input.context.correlationId,'Zaman tüneli kaydı bulunamadı.',{eventId}));
      const action=input.command.archived?'event.archived':'event.restored';
      const audit=scope.appendAudit({id:input.identifiers.auditId,action,resourceType:'event',resourceId:eventId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId});
      if(!audit.ok)return audit;
      return scope.enqueueEvent({eventId:input.identifiers.outboxEventId,eventType:`timeline.${action}`,eventVersion:1,aggregateType:'event',aggregateId:eventId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId,correlationId:input.context.correlationId,payload:{eventId,archived:input.command.archived}});
    }, { policyIntent: {
      action: 'update', capability: 'family.write', resourceType: 'event', resourceId: eventId,
      purpose: 'general', sourceResourceMode: 'preserve'
    } });
  }
}

export class UpdateImportantDayParticipantsUseCase {
  public constructor(private readonly unitOfWork: TimelineApplicationUnitOfWork) {}
  public async execute(input: { readonly context: TimelineApplicationContext; readonly command: UpdateEventParticipantsInput; readonly identifiers: TimelineMutationIdentifiers }): Promise<Result<void, AppError>> {
    const participantIds = [...new Set(input.command.participantPersonIds.map((value) => value.trim()).filter(Boolean))].map(asPersonId);
    const eventId = input.command.eventId as EventId;
    return this.unitOfWork.execute(input.context, (scope) => {
      const event = ensureImportantDay(scope, input.context, eventId);
      if (!event.ok) return event;
      const visibility = input.command.visibility ?? event.value.visibility;
      if (!['personal', 'selected_members', 'family'].includes(visibility)) return err(validationError(input.context.correlationId, 'Etkinlik görünürlüğü geçersizdir.'));
      if (visibility === 'selected_members' && participantIds.length === 0) return err(validationError(input.context.correlationId, 'Seçili üyeler görünürlüğü için en az bir katılımcı seçilmelidir.'));
      const people = scope.listPeople(input.context.familyId);
      if (!people.ok) return people;
      const known = new Set(people.value.map((person) => person.id));
      const missing = participantIds.filter((personId) => !known.has(personId));
      if (missing.length > 0) return err(notFoundError(input.context.correlationId, 'Katılımcılardan biri aile kaydında bulunamadı.', { participantPersonIds: missing }));
      const updated = scope.updateParticipants(eventId, participantIds, visibility);
      if (!updated.ok) return updated;
      if (!updated.value) return err(notFoundError(input.context.correlationId, 'Önemli gün kaydı bulunamadı.'));
      const audit = scope.appendAudit({ id: input.identifiers.auditId, action: 'event.participants.updated', resourceType: 'event', resourceId: eventId, occurredAt: scope.occurredAt, actorId: input.context.actor.userId });
      if (!audit.ok) return audit;
      return scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'timeline.participants.updated',
        eventVersion: 1,
        aggregateType: 'event',
        aggregateId: eventId,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: { eventId, participantPersonIds: participantIds, visibility }
      });
    }, { policyIntent: {
      action: 'update', capability: 'family.write', resourceType: 'event', resourceId: eventId,
      purpose: 'general', sourceResourceMode: 'preserve',
      ...(input.command.visibility
        ? { targetSensitivity: timelineSensitivityForVisibility(input.command.visibility) }
        : {})
    } });
  }
}

export class UpdateImportantDayInvitationUseCase {
  public constructor(private readonly unitOfWork: TimelineApplicationUnitOfWork) {}
  public async execute(input: { readonly context: TimelineApplicationContext; readonly command: UpdateEventInvitationInput; readonly identifiers: TimelineMutationIdentifiers }): Promise<Result<void, AppError>> {
    const invitationText = trimOptional(input.command.invitationText);
    if ((invitationText?.length ?? 0) > 4_000) return err(validationError(input.context.correlationId, 'Davetiye metni 4000 karakteri aşamaz.'));
    const eventId = input.command.eventId as EventId;
    return this.unitOfWork.execute(input.context, (scope) => {
      const event = ensureImportantDay(scope, input.context, eventId);
      if (!event.ok) return event;
      const updated = scope.updateInvitation(eventId, invitationText);
      if (!updated.ok) return updated;
      if (!updated.value) return err(notFoundError(input.context.correlationId, 'Önemli gün kaydı bulunamadı.'));
      const audit = scope.appendAudit({ id: input.identifiers.auditId, action: 'event.invitation.updated', resourceType: 'event', resourceId: eventId, occurredAt: scope.occurredAt, actorId: input.context.actor.userId });
      if (!audit.ok) return audit;
      return scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'timeline.invitation.updated',
        eventVersion: 1,
        aggregateType: 'event',
        aggregateId: eventId,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: { eventId, invitationText: invitationText ?? null }
      });
    }, { policyIntent: {
      action: 'update', capability: 'family.write', resourceType: 'event', resourceId: eventId,
      purpose: 'general', sourceResourceMode: 'preserve'
    } });
  }
}

export class UpdateImportantDayNotesUseCase {
  public constructor(private readonly unitOfWork: TimelineApplicationUnitOfWork) {}
  public async execute(input: { readonly context: TimelineApplicationContext; readonly command: UpdateEventNotesInput; readonly identifiers: TimelineMutationIdentifiers }): Promise<Result<void, AppError>> {
    const notes = trimOptional(input.command.notes);
    if ((notes?.length ?? 0) > 8_000) return err(validationError(input.context.correlationId, 'Etkinlik notları 8000 karakteri aşamaz.'));
    const eventId = input.command.eventId as EventId;
    return this.unitOfWork.execute(input.context, (scope) => {
      const event = ensureImportantDay(scope, input.context, eventId);
      if (!event.ok) return event;
      const updated = scope.updateNotes(eventId, notes);
      if (!updated.ok) return updated;
      if (!updated.value) return err(notFoundError(input.context.correlationId, 'Önemli gün kaydı bulunamadı.'));
      const audit = scope.appendAudit({ id: input.identifiers.auditId, action: 'event.notes.updated', resourceType: 'event', resourceId: eventId, occurredAt: scope.occurredAt, actorId: input.context.actor.userId });
      if (!audit.ok) return audit;
      return scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'timeline.notes.updated',
        eventVersion: 1,
        aggregateType: 'event',
        aggregateId: eventId,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: { eventId, notesPresent: Boolean(notes) }
      });
    }, { policyIntent: {
      action: 'update', capability: 'family.write', resourceType: 'event', resourceId: eventId,
      purpose: 'general', sourceResourceMode: 'preserve'
    } });
  }
}

export class AcknowledgeTimelineNotificationUseCase {
  public constructor(private readonly query: TimelineQueryPort, private readonly unitOfWork: TimelineApplicationUnitOfWork, private readonly clock: Clock) {}
  public async execute(input: { readonly context: TimelineApplicationContext; readonly command: AcknowledgeFamilyNotificationInput; readonly identifiers: TimelineMutationIdentifiers }): Promise<Result<void, AppError>> {
    const loaded = await this.query.load(input.context);
    if (!loaded.ok) return loaded;
    const notification = buildNotifications(loaded.value.events.map(toView), this.clock.now()).find((item) => item.id === input.command.notificationId);
    if (!notification) return err(notFoundError(input.context.correlationId, 'Bildirim kaydı bulunamadı.', { notificationId: input.command.notificationId }));
    return this.unitOfWork.execute(input.context, (scope) => {
      const saved = scope.acknowledgeNotification({
        notificationId: notification.id,
        accountId: input.context.actor.userId,
        sourceType: notification.sourceType,
        sourceId: notification.sourceId,
        occurrenceKey: notification.occurrenceKey,
        acknowledgedAt: scope.occurredAt,
        createdAt: scope.occurredAt
      });
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({ id: input.identifiers.auditId, action: 'notification.acknowledged', resourceType: 'timeline_notification', resourceId: notification.id, occurredAt: scope.occurredAt, actorId: input.context.actor.userId });
      if (!audit.ok) return audit;
      return scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'timeline.notification.acknowledged',
        eventVersion: 1,
        aggregateType: 'timeline_notification',
        aggregateId: notification.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: { notificationId: notification.id, sourceId: notification.sourceId, occurrenceKey: notification.occurrenceKey }
      });
    }, { notificationMutation: true });
  }
}
