import type { FamilyId, IsoDate, IsoDateTime, PersonId, UserId } from '@ppt/core';
import type { PersonLifecycleStatus } from './person-lifecycle.js';

export type DataRepairIssueKind = 'duplicate_person' | 'broken_relation' | 'inconsistent_family_link';
export type DataRepairIssueSeverity = 'warning' | 'critical';
export type DataRepairResolution =
  | 'merge_duplicate_person'
  | 'remove_broken_relation'
  | 'align_relation_family'
  | 'remove_cross_family_relation'
  | 'end_inconsistent_membership';
export type DataRepairOperationStatus = 'previewed' | 'applied' | 'undone';

export interface DataRepairIssue {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly kind: DataRepairIssueKind;
  readonly severity: DataRepairIssueSeverity;
  readonly entityType: 'person' | 'relation' | 'person_membership';
  readonly primaryEntityId: string;
  readonly relatedEntityId?: string;
  readonly summary: string;
  readonly suggestedResolution: DataRepairResolution;
  readonly revisionToken: string;
  readonly repairable: boolean;
}

export interface DataRepairPersonSnapshot {
  readonly id: PersonId;
  readonly familyId: FamilyId;
  readonly displayName: string;
  readonly birthDate?: IsoDate;
  readonly relationshipType: string;
  readonly generation: number;
  readonly branch: string;
  readonly status: PersonLifecycleStatus;
  readonly mergedIntoPersonId?: PersonId;
  readonly archivedAt?: IsoDateTime;
  readonly deletionRequestedAt?: IsoDateTime;
  readonly lifecycleVersion: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface DataRepairRelationSnapshot {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly fromPersonId: PersonId;
  readonly toPersonId: PersonId;
  readonly relationType: string;
}

export interface DataRepairMembershipSnapshot {
  readonly id: string;
  readonly personId: PersonId;
  readonly householdId: string;
  readonly familyBranchId?: string;
  readonly role: string;
  readonly status: 'active' | 'suspended' | 'ended';
  readonly validFrom: IsoDateTime;
  readonly validUntil?: IsoDateTime;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export type DataRepairEntitySnapshot =
  | { readonly entityType: 'person'; readonly row: DataRepairPersonSnapshot }
  | { readonly entityType: 'relation'; readonly row: DataRepairRelationSnapshot | null }
  | { readonly entityType: 'person_membership'; readonly row: DataRepairMembershipSnapshot };

export interface DataRepairOperation {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly issueId: string;
  readonly issueKind: DataRepairIssueKind;
  readonly resolution: DataRepairResolution;
  readonly status: DataRepairOperationStatus;
  readonly revisionToken: string;
  readonly beforeSnapshot: DataRepairEntitySnapshot;
  readonly afterSnapshot: DataRepairEntitySnapshot;
  readonly reason: string;
  readonly createdBy: UserId;
  readonly createdAt: IsoDateTime;
  readonly appliedAt?: IsoDateTime;
  readonly undoneAt?: IsoDateTime;
}

export interface DataRepairWorkspaceView {
  readonly issues: readonly DataRepairIssue[];
  readonly operations: readonly DataRepairOperation[];
}
