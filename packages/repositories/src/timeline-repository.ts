import {
  asEventId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  type EventId,
  type FamilyId,
  type IsoDateTime,
  type PersonId
} from '@ppt/core';
import type { FamilyEventView } from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult,
  type TimelineEventDataSensitivity,
  type TimelineEventPolicyResourceRecord,
  type TimelineEventPolicyResourceRepositoryPort,
  type TimelineEventRecord,
  type TimelineRepositoryPort
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const parseStringArray = (value: unknown): string[] => {
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const parseReminderDays = (value: unknown): number[] => {
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(Number).filter((item) => Number.isInteger(item) && item >= 0 && item <= 365);
  } catch {
    return [];
  }
};

const sensitivityForVisibility = (
  visibility: FamilyEventView['visibility']
): TimelineEventDataSensitivity => visibility === 'personal'
  ? 'highly_sensitive'
  : visibility === 'selected_members' ? 'sensitive' : 'personal';

const mapEvent = (row: Record<string, unknown>): TimelineEventRecord => ({
  id: asEventId(String(row.id)),
  familyId: asFamilyId(String(row.family_id)),
  ...(row.owner_person_id ? { ownerPersonId: asPersonId(String(row.owner_person_id)) } : {}),
  kind: String(row.kind),
  title: String(row.title),
  ...(row.description ? { description: String(row.description) } : {}),
  startAt: asIsoDateTime(String(row.start_at)),
  ...(row.location_id ? { locationId: String(row.location_id) } : {}),
  ...(row.location_label ? { locationLabel: String(row.location_label) } : {}),
  visibility: String(row.visibility) as FamilyEventView['visibility'],
  participantPersonIds: parseStringArray(row.participant_person_ids).map(asPersonId),
  ...(row.invitation_text ? { invitationText: String(row.invitation_text) } : {}),
  ...(row.notes ? { notes: String(row.notes) } : {}),
  attachmentCount: Number(row.attachment_count),
  aiProcessingAllowed: Number(row.ai_processing_allowed) === 1,
  recurrence: String(row.recurrence ?? 'none') as FamilyEventView['recurrence'],
  reminderDays: parseReminderDays(row.reminder_days),
  createdAt: asIsoDateTime(String(row.created_at)),
  ...(row.updated_at ? { updatedAt: asIsoDateTime(String(row.updated_at)) } : {}),
  ...(row.archived_at ? { archivedAt: asIsoDateTime(String(row.archived_at)) } : {}),
  ...(row.timeline_policy_receipt_hash ? { policyReceiptHash: String(row.timeline_policy_receipt_hash) } : {}),
  ...(row.source_location_receipt_hash ? { sourceLocationReceiptHash: String(row.source_location_receipt_hash) } : {})
});

const eventColumns = `id,family_id,owner_person_id,kind,title,description,start_at,location_id,
  location_label,visibility,participant_person_ids,invitation_text,notes,attachment_count,
  ai_processing_allowed,recurrence,reminder_days,created_at,updated_at,archived_at,
  timeline_policy_receipt_hash,source_location_receipt_hash`;

const assertTimelineSubject = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  familyId: FamilyId
): void => {
  const authorization = context.policyAuthorization;
  const request = authorization.receiptRecord.request;
  if (
    request.purpose !== 'general'
    || request.resource.familyId !== familyId
    || authorization.resourceFamilyId !== familyId
    || !authorization.subject.familyIds.includes(familyId)
  ) throw new Error('Timeline policy receipt family or purpose is invalid');
  if (
    String(context.actor.userId) !== authorization.subject.accountId
    || (context.actor.personId === undefined ? undefined : String(context.actor.personId)) !== authorization.subject.personId
  ) throw new Error('Timeline repository actor does not match the policy receipt subject');
};

const readBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  familyId: FamilyId,
  resourceId: string
) => {
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'event',
    resourceId,
    action: 'read',
    capability: 'family.read',
    correlationId: context.correlationId,
    resourceFamilyId: familyId
  });
  assertTimelineSubject(context, familyId);
  return Object.freeze({
    accountId: context.policyAuthorization.subject.accountId,
    personId: context.policyAuthorization.subject.personId ?? '',
    occurredAt: context.policyAuthorization.receiptRecord.request.occurredAt
  });
};

const writeBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  event: TimelineEventRecord,
  action: 'create' | 'update'
) => {
  if (!event.ownerPersonId) throw new Error('Timeline write requires an exact owner person');
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'event',
    resourceId: event.id,
    action,
    capability: 'family.write',
    correlationId: context.correlationId,
    resourceFamilyId: event.familyId
  });
  assertTimelineSubject(context, event.familyId);
  const request = context.policyAuthorization.receiptRecord.request;
  if (
    request.resource.ownerPersonId !== event.ownerPersonId
    || request.resource.sensitivity !== sensitivityForVisibility(event.visibility)
    || request.resource.sourceResourceId !== event.locationId
  ) throw new Error('Timeline write does not match the exact policy resource snapshot');
  if (action === 'create' && context.policyAuthorization.subject.personId !== event.ownerPersonId) {
    throw new Error('Timeline creator must be the active policy subject');
  }
  const binding = platformPolicyPersistenceBinding(context, 'event', event.id);
  if (!binding) throw new Error('Timeline write requires an active platform policy receipt binding');
  return binding;
};

const visibilitySql = `
  AND NOT EXISTS (
    SELECT 1 FROM object_permissions denied
    WHERE denied.subject_account_id=?
      AND denied.resource_type IN ('event','timeline_event')
      AND (denied.resource_id=governed_timeline_events.id OR denied.resource_id='*')
      AND denied.effect='deny'
      AND denied.purpose='general'
      AND denied.starts_at<=?
      AND (denied.ends_at IS NULL OR denied.ends_at>=?)
      AND EXISTS (SELECT 1 FROM json_each(denied.actions) action WHERE action.value='read')
  )
  AND (
    governed_timeline_events.owner_person_id=?
    OR governed_timeline_events.visibility='family'
    OR (
      governed_timeline_events.visibility='selected_members'
      AND EXISTS (
        SELECT 1 FROM json_each(governed_timeline_events.participant_person_ids) participant
        WHERE participant.value=?
      )
    )
    OR EXISTS (
      SELECT 1 FROM object_permissions allowed
      WHERE allowed.subject_account_id=?
        AND allowed.resource_type IN ('event','timeline_event')
        AND (allowed.resource_id=governed_timeline_events.id OR allowed.resource_id='*')
        AND allowed.effect='allow'
        AND allowed.purpose='general'
        AND allowed.starts_at<=?
        AND allowed.ends_at IS NOT NULL
        AND allowed.ends_at>=?
        AND EXISTS (SELECT 1 FROM json_each(allowed.actions) action WHERE action.value='read')
    )
  )`;

const visibilityParameters = (binding: ReturnType<typeof readBinding>): readonly unknown[] => [
  binding.accountId,
  binding.occurredAt,
  binding.occurredAt,
  binding.personId,
  binding.personId,
  binding.accountId,
  binding.occurredAt,
  binding.occurredAt
];

export class SqliteTimelineRepository extends SqliteRepository implements
  TimelineRepositoryPort,
  TimelineEventPolicyResourceRepositoryPort {
  public insert(
    context: PolicyAuthorizedRepositoryExecutionContext,
    event: TimelineEventRecord
  ): RepositoryResult<void> {
    const policy = writeBinding(context, event, 'create');
    return this.execute(context, () => {
      this.database(context).prepare(`INSERT INTO events(
        id,family_id,owner_person_id,kind,title,description,start_at,location_id,location_label,
        visibility,participant_person_ids,invitation_text,notes,attachment_count,
        ai_processing_allowed,recurrence,reminder_days,created_at,updated_at,archived_at,
        timeline_policy_receipt_hash,timeline_policy_receipt_version,timeline_policy_receipt_nonce,
        timeline_policy_correlation_id,timeline_policy_resource_type,timeline_policy_resource_id,
        timeline_policy_action,timeline_policy_capability,source_location_receipt_hash
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        event.id,event.familyId,event.ownerPersonId,event.kind,event.title,event.description ?? null,
        event.startAt,event.locationId ?? null,event.locationLabel ?? null,event.visibility,
        JSON.stringify(event.participantPersonIds),event.invitationText ?? null,event.notes ?? null,
        event.attachmentCount,event.aiProcessingAllowed ? 1 : 0,event.recurrence,
        JSON.stringify(event.reminderDays),event.createdAt,event.updatedAt ?? event.createdAt,
        event.archivedAt ?? null,policy.receiptHash,policy.receiptVersion,policy.nonce,
        context.correlationId,policy.resourceType,policy.resourceId,policy.action,policy.capability,
        event.sourceLocationReceiptHash ?? null
      );
    });
  }

  public update(
    context: PolicyAuthorizedRepositoryExecutionContext,
    event: TimelineEventRecord
  ): RepositoryResult<boolean> {
    const policy = writeBinding(context, event, 'update');
    return this.execute(context, () => Number(this.database(context).prepare(`UPDATE events SET
      title=?,description=?,start_at=?,location_id=?,location_label=?,visibility=?,
      participant_person_ids=?,invitation_text=?,notes=?,ai_processing_allowed=?,recurrence=?,
      reminder_days=?,updated_at=?,timeline_policy_receipt_hash=?,timeline_policy_receipt_version=?,
      timeline_policy_receipt_nonce=?,timeline_policy_correlation_id=?,timeline_policy_resource_type=?,
      timeline_policy_resource_id=?,timeline_policy_action=?,timeline_policy_capability=?,
      source_location_receipt_hash=? WHERE id=? AND family_id=? AND owner_person_id=?`).run(
        event.title,event.description ?? null,event.startAt,event.locationId ?? null,
        event.locationLabel ?? null,event.visibility,JSON.stringify(event.participantPersonIds),
        event.invitationText ?? null,event.notes ?? null,event.aiProcessingAllowed ? 1 : 0,
        event.recurrence,JSON.stringify(event.reminderDays),event.updatedAt ?? event.createdAt,
        policy.receiptHash,policy.receiptVersion,policy.nonce,context.correlationId,
        policy.resourceType,policy.resourceId,policy.action,policy.capability,
        event.sourceLocationReceiptHash ?? null,event.id,event.familyId,event.ownerPersonId
      ).changes) === 1);
  }

  private currentForMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId
  ): TimelineEventRecord | null {
    const familyId = asFamilyId(context.policyAuthorization.resourceFamilyId);
    const row = this.database(context).prepare(
      `SELECT ${eventColumns} FROM governed_timeline_events WHERE id=? AND family_id=?`
    ).get(eventId, familyId) as Record<string, unknown> | undefined;
    return row ? mapEvent(row) : null;
  }

  private updatePartial(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId,
    update: (event: TimelineEventRecord) => TimelineEventRecord
  ): RepositoryResult<boolean> {
    return this.execute(context, () => {
      const current = this.currentForMutation(context, eventId);
      if (!current) return false;
      const event = update(current);
      const policy = writeBinding(context, event, 'update');
      const result = this.database(context).prepare(`UPDATE events SET
        visibility=?,participant_person_ids=?,invitation_text=?,notes=?,archived_at=?,updated_at=?,
        timeline_policy_receipt_hash=?,timeline_policy_receipt_version=?,timeline_policy_receipt_nonce=?,
        timeline_policy_correlation_id=?,timeline_policy_resource_type=?,timeline_policy_resource_id=?,
        timeline_policy_action=?,timeline_policy_capability=?
        WHERE id=? AND family_id=? AND owner_person_id=?`).run(
          event.visibility,JSON.stringify(event.participantPersonIds),event.invitationText ?? null,
          event.notes ?? null,event.archivedAt ?? null,event.updatedAt ?? context.occurredAt,
          policy.receiptHash,policy.receiptVersion,policy.nonce,context.correlationId,
          policy.resourceType,policy.resourceId,policy.action,policy.capability,
          event.id,event.familyId,event.ownerPersonId
        );
      return Number(result.changes) === 1;
    });
  }

  public setArchived(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId,
    archivedAt?: IsoDateTime
  ): RepositoryResult<boolean> {
    return this.updatePartial(context, eventId, (event) => {
      const { archivedAt: _previousArchivedAt, ...withoutArchivedAt } = event;
      return archivedAt
        ? { ...withoutArchivedAt, archivedAt, updatedAt: context.occurredAt }
        : { ...withoutArchivedAt, updatedAt: context.occurredAt };
    });
  }

  public updateParticipants(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId,
    participantPersonIds: readonly PersonId[],
    visibility: FamilyEventView['visibility']
  ): RepositoryResult<boolean> {
    return this.updatePartial(context, eventId, (event) => ({
      ...event,
      participantPersonIds,
      visibility,
      updatedAt: context.occurredAt
    }));
  }

  public updateInvitation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId,
    invitationText?: string
  ): RepositoryResult<boolean> {
    return this.updatePartial(context, eventId, (event) => {
      const { invitationText: _previousInvitationText, ...withoutInvitationText } = event;
      return invitationText
        ? { ...withoutInvitationText, invitationText, updatedAt: context.occurredAt }
        : { ...withoutInvitationText, updatedAt: context.occurredAt };
    });
  }

  public updateNotes(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId,
    notes?: string
  ): RepositoryResult<boolean> {
    return this.updatePartial(context, eventId, (event) => {
      const { notes: _previousNotes, ...withoutNotes } = event;
      return notes
        ? { ...withoutNotes, notes, updatedAt: context.occurredAt }
        : { ...withoutNotes, updatedAt: context.occurredAt };
    });
  }

  public findForMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId
  ): RepositoryResult<TimelineEventRecord | null> {
    const familyId = asFamilyId(context.policyAuthorization.resourceFamilyId);
    assertPolicyAuthorizedRepositoryContext(context, {
      resourceType: 'event', resourceId: eventId, action: 'update', capability: 'family.write',
      correlationId: context.correlationId, resourceFamilyId: familyId
    });
    assertTimelineSubject(context, familyId);
    return this.execute(context, () => {
      const row = this.database(context).prepare(
        `SELECT ${eventColumns} FROM governed_timeline_events WHERE id=? AND family_id=?`
      ).get(eventId, familyId) as Record<string, unknown> | undefined;
      return row ? mapEvent(row) : null;
    });
  }

  public findById(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId
  ): RepositoryResult<TimelineEventRecord | null> {
    const familyId = asFamilyId(context.policyAuthorization.resourceFamilyId);
    const visibility = readBinding(context, familyId, eventId);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`SELECT ${eventColumns}
        FROM governed_timeline_events WHERE id=? AND family_id=? ${visibilitySql}`)
        .get(eventId, familyId, ...visibilityParameters(visibility)) as Record<string, unknown> | undefined;
      return row ? mapEvent(row) : null;
    });
  }

  public listByFamily(
    context: PolicyAuthorizedRepositoryExecutionContext,
    familyId: FamilyId
  ): RepositoryResult<readonly TimelineEventRecord[]> {
    const visibility = readBinding(context, familyId, '*');
    return this.execute(context, () => (
      this.database(context).prepare(`SELECT ${eventColumns}
        FROM governed_timeline_events WHERE family_id=? AND archived_at IS NULL ${visibilitySql}
        ORDER BY start_at DESC,id`).all(familyId, ...visibilityParameters(visibility)) as ReadonlyArray<Record<string, unknown>>
    ).map(mapEvent));
  }

  public listArchivedByFamily(
    context: PolicyAuthorizedRepositoryExecutionContext,
    familyId: FamilyId
  ): RepositoryResult<readonly TimelineEventRecord[]> {
    const visibility = readBinding(context, familyId, '*');
    return this.execute(context, () => (
      this.database(context).prepare(`SELECT ${eventColumns}
        FROM governed_timeline_events WHERE family_id=? AND archived_at IS NOT NULL ${visibilitySql}
        ORDER BY archived_at DESC,id`).all(familyId, ...visibilityParameters(visibility)) as ReadonlyArray<Record<string, unknown>>
    ).map(mapEvent));
  }

  public findTimelineEventForPolicyResolution(
    context: RepositoryExecutionContext,
    eventId: EventId
  ): RepositoryResult<TimelineEventPolicyResourceRecord | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`SELECT id,family_id,owner_person_id,visibility,
        location_id,timeline_policy_receipt_hash FROM governed_timeline_events WHERE id=?`)
        .get(eventId) as Record<string, unknown> | undefined;
      if (!row?.owner_person_id || !row.timeline_policy_receipt_hash) return null;
      const visibility = String(row.visibility) as FamilyEventView['visibility'];
      return {
        id: asEventId(String(row.id)),
        familyId: asFamilyId(String(row.family_id)),
        ownerPersonId: asPersonId(String(row.owner_person_id)),
        sensitivity: sensitivityForVisibility(visibility),
        ...(row.location_id ? { sourceResourceId: String(row.location_id) } : {}),
        policyReceiptHash: String(row.timeline_policy_receipt_hash)
      };
    });
  }
}
