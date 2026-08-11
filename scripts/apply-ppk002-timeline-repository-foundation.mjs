import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';

const root = resolve(process.cwd());
const expectedRoot = resolve('C:/PPT/AYM/06_KOD/app');
if (root !== expectedRoot) {
  throw new Error(`WORKSPACE_ROOT_MISMATCH:${root}`);
}

const staged = new Map();

const pathFor = (relativePath) => {
  const target = resolve(root, relativePath);
  const rel = relative(root, target);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`OUTSIDE_SOURCE_ROOT:${relativePath}`);
  return target;
};

const load = async (relativePath) => {
  if (staged.has(relativePath)) return staged.get(relativePath);
  const value = await readFile(pathFor(relativePath), 'utf8');
  staged.set(relativePath, value);
  return value;
};

const set = (relativePath, value) => staged.set(relativePath, value.replaceAll('\r\n', '\n'));

const replaceOnce = (value, before, after, label) => {
  if (value.includes(after)) return value;
  const first = value.indexOf(before);
  if (first < 0) throw new Error(`PATCH_ANCHOR_MISSING:${label}`);
  if (value.indexOf(before, first + before.length) >= 0) throw new Error(`PATCH_ANCHOR_NOT_UNIQUE:${label}`);
  return value.slice(0, first) + after + value.slice(first + before.length);
};

const replaceAllChecked = (value, before, after, label, minimum = 1) => {
  if (value.includes(after) && !value.includes(before)) return value;
  const count = value.split(before).length - 1;
  if (count < minimum) throw new Error(`PATCH_ANCHOR_COUNT:${label}:${count}`);
  return value.replaceAll(before, after);
};

const applicationPath = 'packages/application/src/timeline-use-cases.ts';
let application = await load(applicationPath);
application = replaceOnce(
  application,
  `export interface TimelineApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: TimelineApplicationActor;
  readonly correlationId: CorrelationId;
}
`,
  `export interface TimelineApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: TimelineApplicationActor;
  readonly correlationId: CorrelationId;
}

export type TimelineDataSensitivity = 'personal' | 'sensitive' | 'highly_sensitive';

export interface TimelinePolicyIntent {
  readonly action: 'read' | 'create' | 'update';
  readonly capability: 'family.read' | 'family.write';
  readonly resourceType: 'event';
  readonly resourceId: string;
  readonly purpose: 'general';
  readonly ownerPersonId?: PersonId;
  readonly targetSensitivity?: TimelineDataSensitivity;
  readonly sourceResourceId?: string;
  readonly sourceResourceMode?: 'preserve' | 'replace';
}
`,
  'timeline-policy-intent'
);
application = replaceOnce(
  application,
  `export interface TimelineEventRecord {
  readonly id: EventId;
  readonly familyId: FamilyId;
`,
  `export interface TimelineEventRecord {
  readonly id: EventId;
  readonly familyId: FamilyId;
  readonly ownerPersonId?: PersonId;
`,
  'timeline-owner-field'
);
application = replaceOnce(
  application,
  `  readonly archivedAt?: IsoDateTime;
}

export interface TimelineNotificationStateRecord`,
  `  readonly archivedAt?: IsoDateTime;
  /** Internal durable timeline policy provenance; never projected to renderer views. */
  readonly policyReceiptHash?: string;
  /** Exact governed location-read receipt used when the location reference was attached. */
  readonly sourceLocationReceiptHash?: string;
}

export interface TimelineNotificationStateRecord`,
  'timeline-provenance-fields'
);
application = replaceOnce(
  application,
  `export interface TimelineApplicationUnitOfWork {
  execute<TValue>(
    context: TimelineApplicationContext,
    operation: (scope: TimelineWriteScope) => Result<TValue, AppError>,
    options?: { readonly governedLocationReadId: string }
  ): Promise<Result<TValue, AppError>>;
}
`,
  `export type TimelineUnitOfWorkOptions =
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
`,
  'timeline-uow-options'
);
set(applicationPath, application);

const contractPath = 'packages/repository-contracts/src/timeline-repository.ts';
const contract = `import type { EventId, FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type { FamilyEventView } from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export type TimelineEventDataSensitivity = 'personal' | 'sensitive' | 'highly_sensitive';

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
  readonly policyReceiptHash?: string;
  readonly sourceLocationReceiptHash?: string;
}

export interface TimelineEventPolicyResourceRecord {
  readonly id: EventId;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly sensitivity: TimelineEventDataSensitivity;
  readonly sourceResourceId?: string;
  readonly policyReceiptHash: string;
}

export interface TimelineEventPolicyResourceRepositoryPort {
  findTimelineEventForPolicyResolution(
    context: RepositoryExecutionContext,
    eventId: EventId
  ): RepositoryResult<TimelineEventPolicyResourceRecord | null>;
}

export interface TimelineRepositoryPort {
  insert(
    context: PolicyAuthorizedRepositoryExecutionContext,
    event: TimelineEventRecord
  ): RepositoryResult<void>;
  update(
    context: PolicyAuthorizedRepositoryExecutionContext,
    event: TimelineEventRecord
  ): RepositoryResult<boolean>;
  setArchived(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId,
    archivedAt?: IsoDateTime
  ): RepositoryResult<boolean>;
  updateParticipants(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId,
    participantPersonIds: readonly PersonId[],
    visibility: FamilyEventView['visibility']
  ): RepositoryResult<boolean>;
  updateInvitation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId,
    invitationText?: string
  ): RepositoryResult<boolean>;
  updateNotes(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId,
    notes?: string
  ): RepositoryResult<boolean>;
  findById(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId
  ): RepositoryResult<TimelineEventRecord | null>;
  listByFamily(
    context: PolicyAuthorizedRepositoryExecutionContext,
    familyId: FamilyId
  ): RepositoryResult<readonly TimelineEventRecord[]>;
  listArchivedByFamily(
    context: PolicyAuthorizedRepositoryExecutionContext,
    familyId: FamilyId
  ): RepositoryResult<readonly TimelineEventRecord[]>;
}
`;
set(contractPath, contract);

const repositoryPath = 'packages/repositories/src/timeline-repository.ts';
const repository = `import {
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

const eventColumns = \`id,family_id,owner_person_id,kind,title,description,start_at,location_id,
  location_label,visibility,participant_person_ids,invitation_text,notes,attachment_count,
  ai_processing_allowed,recurrence,reminder_days,created_at,updated_at,archived_at,
  timeline_policy_receipt_hash,source_location_receipt_hash\`;

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
    familyAdmin: context.policyAuthorization.subject.roles.includes('family_admin') ? 1 : 0,
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

const visibilitySql = \`
  AND NOT EXISTS (
    SELECT 1 FROM object_permissions denied
    WHERE denied.subject_account_id=?
      AND denied.resource_type='event'
      AND (denied.resource_id=governed_timeline_events.id OR denied.resource_id='*')
      AND denied.effect='deny'
      AND denied.purpose='general'
      AND denied.starts_at<=?
      AND (denied.ends_at IS NULL OR denied.ends_at>=?)
      AND EXISTS (SELECT 1 FROM json_each(denied.actions) action WHERE action.value='read')
  )
  AND (
    governed_timeline_events.owner_person_id=?
    OR ?=1
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
        AND allowed.resource_type='event'
        AND (allowed.resource_id=governed_timeline_events.id OR allowed.resource_id='*')
        AND allowed.effect='allow'
        AND allowed.purpose='general'
        AND allowed.starts_at<=?
        AND allowed.ends_at IS NOT NULL
        AND allowed.ends_at>=?
        AND EXISTS (SELECT 1 FROM json_each(allowed.actions) action WHERE action.value='read')
    )
  )\`;

const visibilityParameters = (binding: ReturnType<typeof readBinding>): readonly unknown[] => [
  binding.accountId,
  binding.occurredAt,
  binding.occurredAt,
  binding.personId,
  binding.familyAdmin,
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
      this.database(context).prepare(\`INSERT INTO events(
        id,family_id,owner_person_id,kind,title,description,start_at,location_id,location_label,
        visibility,participant_person_ids,invitation_text,notes,attachment_count,
        ai_processing_allowed,recurrence,reminder_days,created_at,updated_at,archived_at,
        timeline_policy_receipt_hash,timeline_policy_receipt_version,timeline_policy_receipt_nonce,
        timeline_policy_correlation_id,timeline_policy_resource_type,timeline_policy_resource_id,
        timeline_policy_action,timeline_policy_capability,source_location_receipt_hash
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)\`).run(
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
    return this.execute(context, () => Number(this.database(context).prepare(\`UPDATE events SET
      title=?,description=?,start_at=?,location_id=?,location_label=?,visibility=?,
      participant_person_ids=?,invitation_text=?,notes=?,ai_processing_allowed=?,recurrence=?,
      reminder_days=?,updated_at=?,timeline_policy_receipt_hash=?,timeline_policy_receipt_version=?,
      timeline_policy_receipt_nonce=?,timeline_policy_correlation_id=?,timeline_policy_resource_type=?,
      timeline_policy_resource_id=?,timeline_policy_action=?,timeline_policy_capability=?,
      source_location_receipt_hash=? WHERE id=? AND family_id=? AND owner_person_id=?\`).run(
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
      \`SELECT \${eventColumns} FROM governed_timeline_events WHERE id=? AND family_id=?\`
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
      const result = this.database(context).prepare(\`UPDATE events SET
        visibility=?,participant_person_ids=?,invitation_text=?,notes=?,archived_at=?,updated_at=?,
        timeline_policy_receipt_hash=?,timeline_policy_receipt_version=?,timeline_policy_receipt_nonce=?,
        timeline_policy_correlation_id=?,timeline_policy_resource_type=?,timeline_policy_resource_id=?,
        timeline_policy_action=?,timeline_policy_capability=?
        WHERE id=? AND family_id=? AND owner_person_id=?\`).run(
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
    return this.updatePartial(context, eventId, (event) => ({
      ...event,
      ...(archivedAt ? { archivedAt } : { archivedAt: undefined }),
      updatedAt: context.occurredAt
    }));
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
    return this.updatePartial(context, eventId, (event) => ({
      ...event,
      ...(invitationText ? { invitationText } : { invitationText: undefined }),
      updatedAt: context.occurredAt
    }));
  }

  public updateNotes(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId,
    notes?: string
  ): RepositoryResult<boolean> {
    return this.updatePartial(context, eventId, (event) => ({
      ...event,
      ...(notes ? { notes } : { notes: undefined }),
      updatedAt: context.occurredAt
    }));
  }

  public findById(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId
  ): RepositoryResult<TimelineEventRecord | null> {
    const familyId = asFamilyId(context.policyAuthorization.resourceFamilyId);
    const visibility = readBinding(context, familyId, eventId);
    return this.execute(context, () => {
      const row = this.database(context).prepare(\`SELECT \${eventColumns}
        FROM governed_timeline_events WHERE id=? AND family_id=? \${visibilitySql}\`)
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
      this.database(context).prepare(\`SELECT \${eventColumns}
        FROM governed_timeline_events WHERE family_id=? AND archived_at IS NULL \${visibilitySql}
        ORDER BY start_at DESC,id\`).all(familyId, ...visibilityParameters(visibility)) as ReadonlyArray<Record<string, unknown>>
    ).map(mapEvent));
  }

  public listArchivedByFamily(
    context: PolicyAuthorizedRepositoryExecutionContext,
    familyId: FamilyId
  ): RepositoryResult<readonly TimelineEventRecord[]> {
    const visibility = readBinding(context, familyId, '*');
    return this.execute(context, () => (
      this.database(context).prepare(\`SELECT \${eventColumns}
        FROM governed_timeline_events WHERE family_id=? AND archived_at IS NOT NULL \${visibilitySql}
        ORDER BY archived_at DESC,id\`).all(familyId, ...visibilityParameters(visibility)) as ReadonlyArray<Record<string, unknown>>
    ).map(mapEvent));
  }

  public findTimelineEventForPolicyResolution(
    context: RepositoryExecutionContext,
    eventId: EventId
  ): RepositoryResult<TimelineEventPolicyResourceRecord | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(\`SELECT id,family_id,owner_person_id,visibility,
        location_id,timeline_policy_receipt_hash FROM governed_timeline_events WHERE id=?\`)
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
`;
set(repositoryPath, repository);

const migrationSql = `const timelineEventPolicyReceiptFenceSql = \`ALTER TABLE events
ADD COLUMN owner_person_id TEXT REFERENCES people(id) ON DELETE RESTRICT;
ALTER TABLE events
ADD COLUMN timeline_policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  timeline_policy_receipt_hash IS NULL OR
  (length(timeline_policy_receipt_hash)=64 AND timeline_policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE events ADD COLUMN timeline_policy_receipt_version INTEGER CHECK(timeline_policy_receipt_version IS NULL OR timeline_policy_receipt_version=1);
ALTER TABLE events ADD COLUMN timeline_policy_receipt_nonce TEXT;
ALTER TABLE events ADD COLUMN timeline_policy_correlation_id TEXT;
ALTER TABLE events ADD COLUMN timeline_policy_resource_type TEXT;
ALTER TABLE events ADD COLUMN timeline_policy_resource_id TEXT;
ALTER TABLE events ADD COLUMN timeline_policy_action TEXT;
ALTER TABLE events ADD COLUMN timeline_policy_capability TEXT;
ALTER TABLE events
ADD COLUMN source_location_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  source_location_receipt_hash IS NULL OR
  (length(source_location_receipt_hash)=64 AND source_location_receipt_hash NOT GLOB '*[^0-9a-f]*')
);

CREATE UNIQUE INDEX idx_events_timeline_policy_receipt
ON events(timeline_policy_receipt_hash) WHERE timeline_policy_receipt_hash IS NOT NULL;
CREATE INDEX idx_events_family_owner_visibility
ON events(family_id,owner_person_id,visibility,archived_at,start_at DESC,id);

CREATE VIEW governed_timeline_events AS
SELECT event.*
FROM events event
JOIN platform_policy_transaction_receipts receipt
  ON receipt.receipt_hash=event.timeline_policy_receipt_hash
 AND receipt.receipt_version=event.timeline_policy_receipt_version
 AND receipt.nonce=event.timeline_policy_receipt_nonce
 AND receipt.correlation_id=event.timeline_policy_correlation_id
 AND receipt.resource_type=event.timeline_policy_resource_type
 AND receipt.resource_id=event.timeline_policy_resource_id
 AND receipt.action=event.timeline_policy_action
 AND receipt.capability=event.timeline_policy_capability
JOIN platform_policy_database_fences fence
  ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
JOIN platform_policy_journal_projection_outbox projection
  ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
JOIN people owner
  ON owner.id=event.owner_person_id AND owner.family_id=event.family_id AND owner.status='active'
WHERE receipt.fence_name='timeline-event-write'
  AND receipt.resource_type='event'
  AND receipt.resource_id=event.id
  AND receipt.action IN ('create','update')
  AND receipt.capability='family.write'
  AND json_extract(receipt.record_json,'$.request.resource.familyId')=event.family_id
  AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=event.owner_person_id
  AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE event.visibility
    WHEN 'personal' THEN 'highly_sensitive'
    WHEN 'selected_members' THEN 'sensitive'
    WHEN 'family' THEN 'personal'
  END
  AND json_extract(receipt.record_json,'$.request.purpose')='general'
  AND (
    (event.location_id IS NULL AND event.source_location_receipt_hash IS NULL
      AND json_type(receipt.record_json,'$.request.resource.sourceResourceId') IS NULL)
    OR (
      event.location_id IS NOT NULL
      AND json_extract(receipt.record_json,'$.request.resource.sourceResourceId')=event.location_id
      AND EXISTS(
        SELECT 1 FROM platform_policy_transaction_receipts source_receipt
        JOIN platform_policy_database_fences source_fence
          ON source_fence.fence_name=source_receipt.fence_name
         AND source_fence.epoch=source_receipt.fence_epoch AND source_fence.writable=1
        JOIN platform_policy_journal_projection_outbox source_projection
          ON source_projection.receipt_hash=source_receipt.receipt_hash
         AND source_projection.record_json=source_receipt.record_json
        WHERE source_receipt.receipt_hash=event.source_location_receipt_hash
          AND source_receipt.fence_name='location-write'
          AND source_receipt.resource_type='location'
          AND source_receipt.resource_id=event.location_id
          AND source_receipt.action='read'
          AND source_receipt.capability='location.read'
          AND json_extract(source_receipt.record_json,'$.request.resource.familyId')=event.family_id
          AND json_extract(source_receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive'
          AND json_extract(source_receipt.record_json,'$.request.purpose')='general'
      )
    )
  )
  AND NOT EXISTS(
    SELECT 1 FROM data_lifecycle lifecycle
    WHERE lifecycle.resource_type IN ('event','timeline_event')
      AND lifecycle.resource_id=event.id AND lifecycle.state<>'active'
  );

CREATE TRIGGER trg_timeline_event_policy_insert
BEFORE INSERT ON events
WHEN COALESCE(NEW.owner_person_id,'')<>''
  OR COALESCE(NEW.timeline_policy_receipt_hash,'')<>''
  OR COALESCE(NEW.source_location_receipt_hash,'')<>''
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM platform_policy_transaction_receipts receipt
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
    JOIN accounts actor
      ON actor.id=json_extract(receipt.record_json,'$.request.subject.accountId')
     AND actor.person_id=NEW.owner_person_id AND actor.status='active'
    JOIN people owner
      ON owner.id=NEW.owner_person_id AND owner.family_id=NEW.family_id AND owner.status='active'
    WHERE receipt.receipt_hash=NEW.timeline_policy_receipt_hash
      AND receipt.receipt_version=NEW.timeline_policy_receipt_version
      AND receipt.nonce=NEW.timeline_policy_receipt_nonce
      AND receipt.correlation_id=NEW.timeline_policy_correlation_id
      AND receipt.resource_type=NEW.timeline_policy_resource_type
      AND receipt.resource_id=NEW.timeline_policy_resource_id
      AND receipt.action=NEW.timeline_policy_action
      AND receipt.capability=NEW.timeline_policy_capability
      AND receipt.fence_name='timeline-event-write'
      AND receipt.resource_type='event' AND receipt.resource_id=NEW.id
      AND receipt.action='create' AND receipt.capability='family.write'
      AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
      AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
      AND json_extract(receipt.record_json,'$.request.subject.personId')=NEW.owner_person_id
      AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.visibility
        WHEN 'personal' THEN 'highly_sensitive'
        WHEN 'selected_members' THEN 'sensitive'
        WHEN 'family' THEN 'personal'
      END
      AND json_extract(receipt.record_json,'$.request.purpose')='general'
      AND (
        (NEW.location_id IS NULL AND NEW.source_location_receipt_hash IS NULL
          AND json_type(receipt.record_json,'$.request.resource.sourceResourceId') IS NULL)
        OR (
          NEW.location_id IS NOT NULL
          AND json_extract(receipt.record_json,'$.request.resource.sourceResourceId')=NEW.location_id
          AND EXISTS(
            SELECT 1 FROM platform_policy_transaction_receipts source_receipt
            JOIN platform_policy_database_fences source_fence
              ON source_fence.fence_name=source_receipt.fence_name
             AND source_fence.epoch=source_receipt.fence_epoch AND source_fence.writable=1
            JOIN platform_policy_journal_projection_outbox source_projection
              ON source_projection.receipt_hash=source_receipt.receipt_hash
             AND source_projection.record_json=source_receipt.record_json
            WHERE source_receipt.receipt_hash=NEW.source_location_receipt_hash
              AND source_receipt.fence_name='location-write'
              AND source_receipt.resource_type='location'
              AND source_receipt.resource_id=NEW.location_id
              AND source_receipt.action='read' AND source_receipt.capability='location.read'
              AND json_extract(source_receipt.record_json,'$.request.resource.familyId')=NEW.family_id
              AND json_extract(source_receipt.record_json,'$.request.subject.accountId')=json_extract(receipt.record_json,'$.request.subject.accountId')
              AND json_extract(source_receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive'
              AND json_extract(source_receipt.record_json,'$.request.purpose')='general'
          )
        )
      )
  ) THEN RAISE(ABORT,'timeline event insert requires an exact durable event policy receipt') END;
END;

CREATE TRIGGER trg_timeline_event_policy_update
BEFORE UPDATE OF kind,title,description,start_at,location_id,location_label,visibility,
  participant_person_ids,invitation_text,notes,ai_processing_allowed,recurrence,
  reminder_days,updated_at,archived_at ON events
WHEN COALESCE(OLD.timeline_policy_receipt_hash,'')<>''
  OR COALESCE(NEW.owner_person_id,'')<>''
  OR COALESCE(NEW.timeline_policy_receipt_hash,'')<>''
BEGIN
  SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.family_id IS NOT OLD.family_id
    OR NEW.owner_person_id IS NOT OLD.owner_person_id
    THEN RAISE(ABORT,'timeline event identity and owner are immutable') END;
  SELECT CASE WHEN NEW.timeline_policy_receipt_hash IS OLD.timeline_policy_receipt_hash
    OR NOT EXISTS(
      SELECT 1 FROM platform_policy_transaction_receipts receipt
      JOIN platform_policy_database_fences fence
        ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
      JOIN platform_policy_journal_projection_outbox projection
        ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
      JOIN people owner
        ON owner.id=NEW.owner_person_id AND owner.family_id=NEW.family_id AND owner.status='active'
      WHERE receipt.receipt_hash=NEW.timeline_policy_receipt_hash
        AND receipt.receipt_version=NEW.timeline_policy_receipt_version
        AND receipt.nonce=NEW.timeline_policy_receipt_nonce
        AND receipt.correlation_id=NEW.timeline_policy_correlation_id
        AND receipt.resource_type=NEW.timeline_policy_resource_type
        AND receipt.resource_id=NEW.timeline_policy_resource_id
        AND receipt.action=NEW.timeline_policy_action
        AND receipt.capability=NEW.timeline_policy_capability
        AND receipt.fence_name='timeline-event-write'
        AND receipt.resource_type='event' AND receipt.resource_id=NEW.id
        AND receipt.action='update' AND receipt.capability='family.write'
        AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
        AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
        AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.visibility
          WHEN 'personal' THEN 'highly_sensitive'
          WHEN 'selected_members' THEN 'sensitive'
          WHEN 'family' THEN 'personal'
        END
        AND json_extract(receipt.record_json,'$.request.purpose')='general'
        AND (
          (NEW.location_id IS NULL AND NEW.source_location_receipt_hash IS NULL
            AND json_type(receipt.record_json,'$.request.resource.sourceResourceId') IS NULL)
          OR (
            NEW.location_id IS NOT NULL
            AND json_extract(receipt.record_json,'$.request.resource.sourceResourceId')=NEW.location_id
            AND EXISTS(
              SELECT 1 FROM platform_policy_transaction_receipts source_receipt
              JOIN platform_policy_database_fences source_fence
                ON source_fence.fence_name=source_receipt.fence_name
               AND source_fence.epoch=source_receipt.fence_epoch AND source_fence.writable=1
              JOIN platform_policy_journal_projection_outbox source_projection
                ON source_projection.receipt_hash=source_receipt.receipt_hash
               AND source_projection.record_json=source_receipt.record_json
              WHERE source_receipt.receipt_hash=NEW.source_location_receipt_hash
                AND source_receipt.fence_name='location-write'
                AND source_receipt.resource_type='location'
                AND source_receipt.resource_id=NEW.location_id
                AND source_receipt.action='read' AND source_receipt.capability='location.read'
                AND json_extract(source_receipt.record_json,'$.request.resource.familyId')=NEW.family_id
                AND json_extract(source_receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive'
                AND json_extract(source_receipt.record_json,'$.request.purpose')='general'
                AND (
                  (NEW.location_id IS OLD.location_id AND NEW.source_location_receipt_hash IS OLD.source_location_receipt_hash)
                  OR (
                    NEW.source_location_receipt_hash IS NOT OLD.source_location_receipt_hash
                    AND json_extract(source_receipt.record_json,'$.request.subject.accountId')=json_extract(receipt.record_json,'$.request.subject.accountId')
                  )
                )
            )
          )
        )
    ) THEN RAISE(ABORT,'timeline event update requires a fresh exact durable event policy receipt') END;
END;

CREATE TRIGGER trg_timeline_event_policy_delete
BEFORE DELETE ON events
WHEN OLD.timeline_policy_receipt_hash IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'GOVERNED_TIMELINE_EVENT_DELETION_WORKFLOW_REQUIRED');
END;

UPDATE database_metadata
SET value='REVISION-LOCAL-PPK-002-TIMELINE-EVENT-POLICY-RECEIPT-FENCE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
\`;

`;

const migrationPath = 'packages/database/src/family-database-migrations.ts';
let migrations = await load(migrationPath);
if (!migrations.includes('const timelineEventPolicyReceiptFenceSql =')) {
  migrations = replaceOnce(
    migrations,
    'export const FAMILY_DATABASE_MIGRATIONS = Object.freeze([',
    migrationSql + 'export const FAMILY_DATABASE_MIGRATIONS = Object.freeze([',
    'timeline-migration-sql'
  );
}
migrations = replaceOnce(
  migrations,
  `  createMigrationDefinition(66, 'location_policy_receipt_fence', locationPolicyReceiptFenceSql)
]);`,
  `  createMigrationDefinition(66, 'location_policy_receipt_fence', locationPolicyReceiptFenceSql),
  createMigrationDefinition(67, 'local_ppk002_timeline_event_policy_receipt_fence', timelineEventPolicyReceiptFenceSql)
]);`,
  'timeline-migration-registration'
);
set(migrationPath, migrations);

const bootstrapPath = 'packages/repositories/src/bootstrap-repository.ts';
let bootstrap = await load(bootstrapPath);
bootstrap = replaceOnce(
  bootstrap,
  `      if (Number(row.total) > 0) return false;

      this.database(context).prepare('INSERT INTO families (id,name,created_at) VALUES (?,?,?)')`,
  `      if (Number(row.total) > 0) return false;
      if (seed.events.length > 0) {
        throw new Error('Bootstrap timeline events require a governed per-event policy receipt workflow');
      }

      this.database(context).prepare('INSERT INTO families (id,name,created_at) VALUES (?,?,?)')`,
  'bootstrap-event-fail-closed'
);
set(bootstrapPath, bootstrap);

const readerReplacements = [
  ['packages/repositories/src/automation-repository.ts', 'FROM events', 'FROM governed_timeline_events'],
  ['packages/repositories/src/ai-consent-repository.ts', 'FROM events', 'FROM governed_timeline_events'],
  ['packages/repositories/src/dashboard-repository.ts', 'FROM events e', 'FROM governed_timeline_events e'],
  ['packages/repositories/src/entity-catalog-repository.ts', 'FROM events', 'FROM governed_timeline_events'],
  ['packages/repositories/src/genealogy-repository.ts', 'FROM events', 'FROM governed_timeline_events'],
  ['packages/repositories/src/large-family-read-model-repository.ts', 'FROM events e', 'FROM governed_timeline_events e'],
  ['packages/repositories/src/report-repository.ts', 'FROM events', 'FROM governed_timeline_events']
];
for (const [relativePath, before, after] of readerReplacements) {
  let value = await load(relativePath);
  value = replaceAllChecked(value, before, after, `governed-reader:${relativePath}`);
  set(relativePath, value);
}

for (const [relativePath, value] of staged) {
  await writeFile(pathFor(relativePath), value.endsWith('\n') ? value : value + '\n', 'utf8');
}

console.log(`PPK-002 timeline repository foundation applied (${staged.size} files; migration 67; no file deletion).`);
