import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type {
  HouseholdOperationItemView,
  HouseholdOperationMutationKind
} from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface HouseholdOperationsCenterKey {
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly actorPersonId: PersonId;
  readonly centerId: string;
}

export interface HouseholdOperationsCenterRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface HouseholdOperationItemRow extends HouseholdOperationItemView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
}

export interface HouseholdOperationMutationRow {
  readonly id: string;
  readonly centerId: string;
  readonly familyId: FamilyId;
  readonly itemId: string;
  readonly ownerPersonId: PersonId;
  readonly actorAccountId: string;
  readonly actorPersonId: PersonId;
  readonly mutationKind: HouseholdOperationMutationKind;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly expectedCenterRevision: number;
  readonly centerRevision: number;
  readonly expectedItemRevision: number;
  readonly itemRevision: number;
  readonly centerStateFingerprint: string;
  readonly itemStateFingerprint: string;
  readonly occurredAt: IsoDateTime;
}

export interface HouseholdOperationsCenterSnapshotRow {
  readonly center: HouseholdOperationsCenterRow | null;
  readonly items: readonly HouseholdOperationItemRow[];
}

export interface HouseholdOperationsRepositoryPort {
  loadCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: HouseholdOperationsCenterKey
  ): RepositoryResult<HouseholdOperationsCenterSnapshotRow>;
  findCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: HouseholdOperationsCenterKey
  ): RepositoryResult<HouseholdOperationsCenterRow | null>;
  findItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: HouseholdOperationsCenterKey,
    itemId: string
  ): RepositoryResult<HouseholdOperationItemRow | null>;
  findMutationByClientOperationId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: HouseholdOperationsCenterKey,
    clientOperationId: string
  ): RepositoryResult<HouseholdOperationMutationRow | null>;
  insertMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: HouseholdOperationMutationRow
  ): RepositoryResult<void>;
  insertCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: HouseholdOperationsCenterRow
  ): RepositoryResult<void>;
  saveCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: HouseholdOperationsCenterRow,
    expectedRevision: number
  ): RepositoryResult<void>;
  insertItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: HouseholdOperationItemRow
  ): RepositoryResult<void>;
  saveItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: HouseholdOperationItemRow,
    expectedRevision: number
  ): RepositoryResult<void>;
}

/** Payload-free lookup used only before central policy authorization. */
export interface HouseholdOperationsPolicyResourceRepositoryPort {
  findItemForPolicyResolution(
    context: RepositoryExecutionContext,
    itemId: string
  ): RepositoryResult<Pick<HouseholdOperationItemRow,
    'id' | 'familyId' | 'ownerPersonId' | 'revision' | 'status' | 'stateFingerprint'
  > | null>;
}
