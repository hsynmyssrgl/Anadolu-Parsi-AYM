import type {
  FamilyBranchId,
  FamilyId,
  HouseholdId,
  IsoDateTime,
  MembershipId,
  PersonId
} from '@ppt/core';

export type HouseholdKind = 'primary' | 'shared' | 'extended' | 'other';
export type HouseholdStatus = 'active' | 'archived';
export type FamilyBranchStatus = 'active' | 'archived';
export type PersonMembershipRole = 'resident' | 'member' | 'guardian' | 'dependent' | 'other';
export type PersonMembershipStatus = 'active' | 'suspended' | 'ended';

export interface Household {
  readonly id: HouseholdId;
  readonly familyId: FamilyId;
  readonly name: string;
  readonly kind: HouseholdKind;
  readonly status: HouseholdStatus;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface FamilyBranch {
  readonly id: FamilyBranchId;
  readonly familyId: FamilyId;
  readonly householdId?: HouseholdId;
  readonly parentBranchId?: FamilyBranchId;
  readonly name: string;
  readonly status: FamilyBranchStatus;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface PersonMembership {
  readonly id: MembershipId;
  readonly personId: PersonId;
  readonly householdId: HouseholdId;
  readonly familyBranchId?: FamilyBranchId;
  readonly role: PersonMembershipRole;
  readonly status: PersonMembershipStatus;
  readonly validFrom: IsoDateTime;
  readonly validUntil?: IsoDateTime;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface CreateHouseholdInput {
  readonly name: string;
  readonly kind: HouseholdKind;
}

export interface CreateFamilyBranchInput {
  readonly name: string;
  readonly householdId?: HouseholdId;
  readonly parentBranchId?: FamilyBranchId;
}

export interface AssignPersonMembershipInput {
  readonly personId: PersonId;
  readonly householdId: HouseholdId;
  readonly familyBranchId?: FamilyBranchId;
  readonly role: PersonMembershipRole;
  readonly validFrom: IsoDateTime;
  readonly validUntil?: IsoDateTime;
}

export interface HouseholdMembershipWorkspaceView {
  readonly households: readonly Household[];
  readonly branches: readonly FamilyBranch[];
  readonly memberships: readonly PersonMembership[];
}
