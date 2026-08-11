import type { FamilyId, IsoDate, IsoDateTime, PersonId } from '@ppt/core';

export type PersonLifecycleStatus =
  | 'active'
  | 'inactive'
  | 'deceased'
  | 'archived'
  | 'merged'
  | 'pending_deletion';

export type PersonLifecycleOperationType = 'profile_updated' | 'archived' | 'merged' | 'safe_delete_requested';
export type PersonLifecycleOperationStatus = 'applied' | 'undone';

export interface PersonLifecycleProfile {
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

export interface UpdatePersonProfileInput {
  readonly personId: PersonId;
  readonly expectedVersion: number;
  readonly displayName: string;
  readonly birthDate?: IsoDate;
  readonly relationshipType: string;
  readonly generation: number;
  readonly branch: string;
}

export interface PersonReferenceSummary {
  readonly counts: Readonly<Record<string, number>>;
  readonly total: number;
}

export interface PersonLifecycleOperation {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly personId: PersonId;
  readonly operationType: PersonLifecycleOperationType;
  readonly status: PersonLifecycleOperationStatus;
  readonly before: PersonLifecycleProfile;
  readonly after: PersonLifecycleProfile;
  readonly references: PersonReferenceSummary;
  readonly reason?: string;
  readonly createdAt: IsoDateTime;
  readonly undoneAt?: IsoDateTime;
}

export interface PersonLifecycleWorkspaceView {
  readonly profile: PersonLifecycleProfile;
  readonly operations: readonly PersonLifecycleOperation[];
}
