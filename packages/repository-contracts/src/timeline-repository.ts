import type { EventId, FamilyId, IsoDateTime, PersonId } from '@ppt/core';
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
  findForMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId
  ): RepositoryResult<TimelineEventRecord | null>;
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
