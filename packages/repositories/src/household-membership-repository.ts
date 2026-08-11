import type {
  FamilyBranch,
  Household,
  PersonMembership
} from '@ppt/domain';
import type {
  FamilyBranchId,
  FamilyId,
  HouseholdId,
  IsoDateTime,
  MembershipId,
  PersonId
} from '@ppt/core';
import type {
  HouseholdMembershipRepositoryPort,
  MembershipIntervalQuery,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';

const mapHousehold = (row: Record<string, unknown>): Household => ({
  id: String(row.id) as HouseholdId,
  familyId: String(row.family_id) as FamilyId,
  name: String(row.name),
  kind: String(row.kind) as Household['kind'],
  status: String(row.status) as Household['status'],
  createdAt: String(row.created_at) as IsoDateTime,
  updatedAt: String(row.updated_at) as IsoDateTime
});

const mapBranch = (row: Record<string, unknown>): FamilyBranch => ({
  id: String(row.id) as FamilyBranchId,
  familyId: String(row.family_id) as FamilyId,
  ...(row.household_id ? { householdId: String(row.household_id) as HouseholdId } : {}),
  ...(row.parent_branch_id ? { parentBranchId: String(row.parent_branch_id) as FamilyBranchId } : {}),
  name: String(row.name),
  status: String(row.status) as FamilyBranch['status'],
  createdAt: String(row.created_at) as IsoDateTime,
  updatedAt: String(row.updated_at) as IsoDateTime
});

const mapMembership = (row: Record<string, unknown>): PersonMembership => ({
  id: String(row.id) as MembershipId,
  personId: String(row.person_id) as PersonId,
  householdId: String(row.household_id) as HouseholdId,
  ...(row.family_branch_id ? { familyBranchId: String(row.family_branch_id) as FamilyBranchId } : {}),
  role: String(row.role) as PersonMembership['role'],
  status: String(row.status) as PersonMembership['status'],
  validFrom: String(row.valid_from) as IsoDateTime,
  ...(row.valid_until ? { validUntil: String(row.valid_until) as IsoDateTime } : {}),
  createdAt: String(row.created_at) as IsoDateTime,
  updatedAt: String(row.updated_at) as IsoDateTime
});

export class SqliteHouseholdMembershipRepository extends SqliteRepository implements HouseholdMembershipRepositoryPort {
  public insertHousehold(context: RepositoryExecutionContext, household: Household): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO households(id,family_id,name,kind,status,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?)
      `).run(
        household.id,
        household.familyId,
        household.name,
        household.kind,
        household.status,
        household.createdAt,
        household.updatedAt
      );
    });
  }

  public findHousehold(context: RepositoryExecutionContext, householdId: HouseholdId): RepositoryResult<Household | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,family_id,name,kind,status,created_at,updated_at
        FROM households WHERE id=?
      `).get(householdId) as Record<string, unknown> | undefined;
      return row ? mapHousehold(row) : null;
    });
  }

  public listHouseholds(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<readonly Household[]> {
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,family_id,name,kind,status,created_at,updated_at
        FROM households WHERE family_id=?
        ORDER BY status,name COLLATE NOCASE,id
      `).all(familyId) as ReadonlyArray<Record<string, unknown>>
    ).map(mapHousehold));
  }

  public insertBranch(context: RepositoryExecutionContext, branch: FamilyBranch): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO family_branches(
          id,family_id,household_id,parent_branch_id,name,status,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?)
      `).run(
        branch.id,
        branch.familyId,
        branch.householdId ?? null,
        branch.parentBranchId ?? null,
        branch.name,
        branch.status,
        branch.createdAt,
        branch.updatedAt
      );
    });
  }

  public findBranch(context: RepositoryExecutionContext, branchId: FamilyBranchId): RepositoryResult<FamilyBranch | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,family_id,household_id,parent_branch_id,name,status,created_at,updated_at
        FROM family_branches WHERE id=?
      `).get(branchId) as Record<string, unknown> | undefined;
      return row ? mapBranch(row) : null;
    });
  }

  public listBranches(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<readonly FamilyBranch[]> {
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,family_id,household_id,parent_branch_id,name,status,created_at,updated_at
        FROM family_branches WHERE family_id=?
        ORDER BY status,name COLLATE NOCASE,id
      `).all(familyId) as ReadonlyArray<Record<string, unknown>>
    ).map(mapBranch));
  }

  public insertMembership(context: RepositoryExecutionContext, membership: PersonMembership): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO person_memberships(
          id,person_id,household_id,family_branch_id,role,status,
          valid_from,valid_until,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?)
      `).run(
        membership.id,
        membership.personId,
        membership.householdId,
        membership.familyBranchId ?? null,
        membership.role,
        membership.status,
        membership.validFrom,
        membership.validUntil ?? null,
        membership.createdAt,
        membership.updatedAt
      );
    });
  }

  public findMembership(context: RepositoryExecutionContext, membershipId: MembershipId): RepositoryResult<PersonMembership | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,person_id,household_id,family_branch_id,role,status,
               valid_from,valid_until,created_at,updated_at
        FROM person_memberships WHERE id=?
      `).get(membershipId) as Record<string, unknown> | undefined;
      return row ? mapMembership(row) : null;
    });
  }

  public listMembershipsByPerson(context: RepositoryExecutionContext, personId: PersonId): RepositoryResult<readonly PersonMembership[]> {
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,person_id,household_id,family_branch_id,role,status,
               valid_from,valid_until,created_at,updated_at
        FROM person_memberships WHERE person_id=?
        ORDER BY valid_from DESC,id
      `).all(personId) as ReadonlyArray<Record<string, unknown>>
    ).map(mapMembership));
  }

  public listMembershipsByFamily(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<readonly PersonMembership[]> {
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT membership.id,membership.person_id,membership.household_id,membership.family_branch_id,
               membership.role,membership.status,membership.valid_from,membership.valid_until,
               membership.created_at,membership.updated_at
        FROM person_memberships AS membership
        INNER JOIN households AS household ON household.id=membership.household_id
        WHERE household.family_id=?
        ORDER BY membership.valid_from DESC,membership.id
      `).all(familyId) as ReadonlyArray<Record<string, unknown>>
    ).map(mapMembership));
  }

  public hasOverlappingMembership(context: RepositoryExecutionContext, query: MembershipIntervalQuery): RepositoryResult<boolean> {
    return this.execute(context, () => Boolean(this.database(context).prepare(`
      SELECT 1 FROM person_memberships
      WHERE person_id=?
        AND household_id=?
        AND family_branch_id IS ?
        AND (? IS NULL OR id<>?)
        AND COALESCE(valid_until,'9999-12-31T23:59:59.999Z')>?
        AND COALESCE(?,'9999-12-31T23:59:59.999Z')>valid_from
      LIMIT 1
    `).get(
      query.personId,
      query.householdId,
      query.familyBranchId ?? null,
      query.excludeMembershipId ?? null,
      query.excludeMembershipId ?? null,
      query.validFrom,
      query.validUntil ?? null
    )));
  }

  public updateMembershipStatus(
    context: RepositoryExecutionContext,
    input: Parameters<HouseholdMembershipRepositoryPort['updateMembershipStatus']>[1]
  ): RepositoryResult<boolean> {
    return this.execute(context, () => Number(this.database(context).prepare(`
      UPDATE person_memberships
      SET status=?,valid_until=?,updated_at=?
      WHERE id=?
    `).run(
      input.status,
      input.validUntil ?? null,
      input.updatedAt,
      input.membershipId
    ).changes) === 1);
  }
}
