import type { FamilyId, IsoDate, IsoDateTime, PersonId } from '@ppt/core';
import type {
  ChildEducationItemView,
  ChildEducationMutationKind,
  ChildEducationVisibility
} from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface ChildEducationCenterKey {
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly actorPersonId: PersonId;
  readonly childPersonId: PersonId;
  readonly centerId: string;
}

export interface ChildEducationChildRow {
  readonly id: PersonId;
  readonly familyId: FamilyId;
  readonly status: 'active' | 'inactive' | 'deceased';
  readonly birthDate?: IsoDate;
}

export interface ChildEducationItemRow extends ChildEducationItemView {
  readonly familyId: FamilyId;
  readonly childPersonId: PersonId;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
}

export interface ChildEducationMutationRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly childPersonId: PersonId;
  readonly itemId: string;
  readonly actorAccountId: string;
  readonly actorPersonId: PersonId;
  readonly mutationKind: ChildEducationMutationKind;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly expectedRevision: number;
  readonly revision: number;
  readonly itemStateFingerprint: string;
  readonly occurredAt: IsoDateTime;
}

export interface ChildEducationCenterSnapshotRow {
  readonly child: ChildEducationChildRow;
  readonly items: readonly ChildEducationItemRow[];
}

export interface ChildEducationCoordinationRepositoryPort {
  loadCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: ChildEducationCenterKey
  ): RepositoryResult<ChildEducationCenterSnapshotRow>;
  findItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: ChildEducationCenterKey,
    itemId: string
  ): RepositoryResult<ChildEducationItemRow | null>;
  findMutationByClientOperationId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: ChildEducationCenterKey,
    clientOperationId: string
  ): RepositoryResult<ChildEducationMutationRow | null>;
  insertMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: ChildEducationMutationRow
  ): RepositoryResult<void>;
  insertItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: ChildEducationItemRow
  ): RepositoryResult<void>;
  saveItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: ChildEducationItemRow,
    expectedRevision: number
  ): RepositoryResult<void>;
}

/** Payload-free lookup used only before central policy authorization. */
export interface ChildEducationPolicyResourceRepositoryPort {
  findItemForPolicyResolution(
    context: RepositoryExecutionContext,
    itemId: string
  ): RepositoryResult<Pick<ChildEducationItemRow,
    'id' | 'familyId' | 'childPersonId' | 'revision' | 'status' | 'visibility' | 'stateFingerprint'
  > | null>;
}

export const childEducationVisibilityPrivacy = (
  visibility: ChildEducationVisibility
): 'family' | 'selected_members' | 'private' => visibility === 'family_coordination'
  ? 'family'
  : visibility === 'child_and_selected_guardians'
    ? 'selected_members'
    : 'private';
