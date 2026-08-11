import type {
  FamilyBranch,
  Household,
  PersonMembership,
  PersonMembershipStatus
} from '@ppt/domain';
import type {
  FamilyBranchId,
  FamilyId,
  HouseholdId,
  IsoDateTime,
  MembershipId,
  PersonId
} from '@ppt/core';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface MembershipIntervalQuery {
  readonly personId: PersonId;
  readonly householdId: HouseholdId;
  readonly familyBranchId?: FamilyBranchId;
  readonly validFrom: IsoDateTime;
  readonly validUntil?: IsoDateTime;
  readonly excludeMembershipId?: MembershipId;
}

export interface HouseholdMembershipRepositoryPort {
  insertHousehold(context: RepositoryExecutionContext, household: Household): RepositoryResult<void>;
  findHousehold(context: RepositoryExecutionContext, householdId: HouseholdId): RepositoryResult<Household | null>;
  listHouseholds(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<readonly Household[]>;

  insertBranch(context: RepositoryExecutionContext, branch: FamilyBranch): RepositoryResult<void>;
  findBranch(context: RepositoryExecutionContext, branchId: FamilyBranchId): RepositoryResult<FamilyBranch | null>;
  listBranches(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<readonly FamilyBranch[]>;

  insertMembership(context: RepositoryExecutionContext, membership: PersonMembership): RepositoryResult<void>;
  findMembership(context: RepositoryExecutionContext, membershipId: MembershipId): RepositoryResult<PersonMembership | null>;
  listMembershipsByPerson(context: RepositoryExecutionContext, personId: PersonId): RepositoryResult<readonly PersonMembership[]>;
  listMembershipsByFamily(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<readonly PersonMembership[]>;
  hasOverlappingMembership(context: RepositoryExecutionContext, query: MembershipIntervalQuery): RepositoryResult<boolean>;
  updateMembershipStatus(context: RepositoryExecutionContext, input: {
    readonly membershipId: MembershipId;
    readonly status: PersonMembershipStatus;
    readonly validUntil?: IsoDateTime;
    readonly updatedAt: IsoDateTime;
  }): RepositoryResult<boolean>;
}
