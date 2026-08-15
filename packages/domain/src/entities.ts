import type {
  AttachmentId,
  EventId,
  FamilyId,
  MembershipId,
  PersonId,
  UserId
} from './types.js';

export type Sensitivity = 'normal' | 'private' | 'highly_sensitive';
export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'ended';
export type TimelineVisibility = 'personal' | 'selected_members' | 'family';

export interface Family {
  id: FamilyId;
  name: string;
  createdAt: string;
}

export interface Person {
  id: PersonId;
  displayName: string;
  birthDate?: string;
  deathDate?: string;
}

export interface FamilyMembership {
  id: MembershipId;
  familyId: FamilyId;
  personId: PersonId;
  userId?: UserId;
  branchIds: string[];
  relationshipType: string;
  roles: string[];
  status: MembershipStatus;
  validFrom: string;
  validUntil?: string;
}

export interface GeoLocation {
  label: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export type AttachmentKind =
  | 'photo'
  | 'video'
  | 'audio'
  | 'invitation'
  | 'document'
  | 'receipt'
  | 'other';

export interface AttachmentReference {
  id: AttachmentId;
  kind: AttachmentKind;
  fileName: string;
  contentHash: string;
  ownerPersonId?: PersonId;
  sensitivity: Sensitivity;
}

export type TimelineEventKind =
  | 'birth'
  | 'education'
  | 'employment'
  | 'marriage'
  | 'important_day'
  | 'health'
  | 'financial'
  | 'residence'
  | 'travel'
  | 'family_meeting'
  | 'communication_file_sharing'
  | 'other';

export interface TimelineEvent {
  id: EventId;
  familyId: FamilyId;
  kind: TimelineEventKind;
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  participantPersonIds: PersonId[];
  ownerPersonId?: PersonId;
  visibility: TimelineVisibility;
  allowedPersonIds: PersonId[];
  location?: GeoLocation;
  attachmentIds: AttachmentId[];
  sensitivity: Sensitivity;
  aiProcessingAllowed: boolean;
  createdBy: UserId;
  createdAt: string;
}

export interface ImportantDayDetails {
  eventId: EventId;
  invitationText?: string;
  organizerNotes?: string;
  giftNotes?: string;
  expenseSummaryMinor?: number;
  currency?: string;
  memoryNotes: string[];
}

export interface AuditEvent {
  id: string;
  actorUserId: UserId;
  action: string;
  resourceType: string;
  resourceId: string;
  occurredAt: string;
  reason?: string;
}
