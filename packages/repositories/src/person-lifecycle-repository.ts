import type { FamilyId, IsoDate, IsoDateTime, PersonId } from '@ppt/core';
import type {
  PersonLifecycleOperation,
  PersonLifecycleProfile,
  PersonReferenceSummary
} from '@ppt/domain';
import type {
  PersonLifecycleRepositoryPort,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';

const mapProfile = (row: Record<string, unknown>): PersonLifecycleProfile => ({
  id: String(row.id) as PersonId,
  familyId: String(row.family_id) as FamilyId,
  displayName: String(row.display_name),
  ...(row.birth_date ? { birthDate: String(row.birth_date) as IsoDate } : {}),
  relationshipType: String(row.relationship_type),
  generation: Number(row.generation),
  branch: String(row.branch),
  status: String(row.status) as PersonLifecycleProfile['status'],
  ...(row.merged_into_person_id ? { mergedIntoPersonId: String(row.merged_into_person_id) as PersonId } : {}),
  ...(row.archived_at ? { archivedAt: String(row.archived_at) as IsoDateTime } : {}),
  ...(row.deletion_requested_at ? { deletionRequestedAt: String(row.deletion_requested_at) as IsoDateTime } : {}),
  lifecycleVersion: Number(row.lifecycle_version),
  createdAt: String(row.created_at) as IsoDateTime,
  updatedAt: String(row.updated_at) as IsoDateTime
});

const profileColumns = `id,family_id,display_name,birth_date,relationship_type,generation,branch,status,
  merged_into_person_id,archived_at,deletion_requested_at,lifecycle_version,created_at,updated_at`;

const parseOperation = (row: Record<string, unknown>): PersonLifecycleOperation => ({
  id: String(row.id),
  familyId: String(row.family_id) as FamilyId,
  personId: String(row.person_id) as PersonId,
  operationType: String(row.operation_type) as PersonLifecycleOperation['operationType'],
  status: String(row.status) as PersonLifecycleOperation['status'],
  before: JSON.parse(String(row.before_snapshot)) as PersonLifecycleProfile,
  after: JSON.parse(String(row.after_snapshot)) as PersonLifecycleProfile,
  references: JSON.parse(String(row.reference_snapshot)) as PersonReferenceSummary,
  ...(row.reason ? { reason: String(row.reason) } : {}),
  createdAt: String(row.created_at) as IsoDateTime,
  ...(row.undone_at ? { undoneAt: String(row.undone_at) as IsoDateTime } : {})
});

const referenceQueries: Readonly<Record<string, string>> = {
  relations: `SELECT COUNT(*) AS total FROM relations WHERE from_person_id=? OR to_person_id=?`,
  eventParticipants: `SELECT COUNT(*) AS total FROM events WHERE EXISTS(SELECT 1 FROM json_each(events.participant_person_ids) WHERE value=?)`,
  invitations: `SELECT COUNT(*) AS total FROM invitations WHERE person_id=?`,
  accounts: `SELECT COUNT(*) AS total FROM accounts WHERE person_id=?`,
  financeRecords: `SELECT COUNT(*) AS total FROM finance_records WHERE owner_person_id=?`,
  bankAccounts: `SELECT COUNT(*) AS total FROM bank_accounts WHERE owner_person_id=?`,
  paymentCards: `SELECT COUNT(*) AS total FROM payment_cards WHERE owner_person_id=?`,
  loanAccounts: `SELECT COUNT(*) AS total FROM loan_accounts WHERE owner_person_id=?`,
  loanPayments: `SELECT COUNT(*) AS total FROM loan_payment_history WHERE owner_person_id=?`,
  financePlanningItems: `SELECT COUNT(*) AS total FROM finance_planning_ledger WHERE owner_person_id=?`,
  financeImportBatches: `SELECT COUNT(*) AS total FROM finance_import_batches WHERE owner_person_id=?`,
  financeImportEntries: `SELECT COUNT(*) AS total FROM finance_import_entries WHERE owner_person_id=?`,
  healthRecords: `SELECT COUNT(*) AS total FROM health_records WHERE owner_person_id=?`,
  medicationPlans: `SELECT COUNT(*) AS total FROM medication_plans WHERE owner_person_id=?`,
  familyHealthHistory: `SELECT COUNT(*) AS total FROM family_health_history WHERE related_person_id=?`,
  lifeRecords: `SELECT COUNT(*) AS total FROM life_records WHERE owner_person_id=?`,
  digitalLegacyPlans: `SELECT COUNT(*) AS total FROM digital_legacy_plans WHERE owner_person_id=?`,
  householdMemberships: `SELECT COUNT(*) AS total FROM person_memberships WHERE person_id=?`,
  lifecycleOwnership: `SELECT COUNT(*) AS total FROM data_lifecycle WHERE owner_person_id=?`
};

export class SqlitePersonLifecycleRepository extends SqliteRepository implements PersonLifecycleRepositoryPort {
  public findProfile(context: RepositoryExecutionContext, personId: PersonId): RepositoryResult<PersonLifecycleProfile | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`SELECT ${profileColumns} FROM people WHERE id=?`).get(personId) as Record<string, unknown> | undefined;
      return row ? mapProfile(row) : null;
    });
  }

  public findPotentialDuplicate(
    context: RepositoryExecutionContext,
    input: Parameters<PersonLifecycleRepositoryPort['findPotentialDuplicate']>[1]
  ): RepositoryResult<PersonLifecycleProfile | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT ${profileColumns} FROM people
        WHERE family_id=? AND id<>? AND lower(trim(display_name))=lower(trim(?))
          AND birth_date IS ? AND status NOT IN ('merged','pending_deletion')
        ORDER BY id LIMIT 1
      `).get(input.familyId, input.excludePersonId, input.displayName, input.birthDate ?? null) as Record<string, unknown> | undefined;
      return row ? mapProfile(row) : null;
    });
  }

  public inspectReferences(context: RepositoryExecutionContext, personId: PersonId): RepositoryResult<PersonReferenceSummary> {
    return this.execute(context, () => {
      const counts: Record<string, number> = {};
      for (const [name, sql] of Object.entries(referenceQueries)) {
        const parameters = name === 'relations' ? [personId, personId] : [personId];
        const row = this.database(context).prepare(sql).get(...parameters) as { total: number | bigint };
        counts[name] = Number(row.total);
      }
      return { counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) };
    });
  }

  public updateProfile(
    context: RepositoryExecutionContext,
    input: Parameters<PersonLifecycleRepositoryPort['updateProfile']>[1]
  ): RepositoryResult<boolean> {
    return this.execute(context, () => Number(this.database(context).prepare(`
      UPDATE people SET
        display_name=?,birth_date=?,relationship_type=?,generation=?,branch=?,status=?,
        merged_into_person_id=?,archived_at=?,deletion_requested_at=?,lifecycle_version=?,updated_at=?
      WHERE id=? AND family_id=? AND lifecycle_version=?
    `).run(
      input.profile.displayName,
      input.profile.birthDate ?? null,
      input.profile.relationshipType,
      input.profile.generation,
      input.profile.branch,
      input.profile.status,
      input.profile.mergedIntoPersonId ?? null,
      input.profile.archivedAt ?? null,
      input.profile.deletionRequestedAt ?? null,
      input.profile.lifecycleVersion,
      input.profile.updatedAt,
      input.profile.id,
      input.profile.familyId,
      input.expectedVersion
    ).changes) === 1);
  }

  public insertOperation(context: RepositoryExecutionContext, operation: PersonLifecycleOperation): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO person_lifecycle_operations(
          id,family_id,person_id,operation_type,status,before_snapshot,after_snapshot,
          reference_snapshot,reason,created_at,undone_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        operation.id,
        operation.familyId,
        operation.personId,
        operation.operationType,
        operation.status,
        JSON.stringify(operation.before),
        JSON.stringify(operation.after),
        JSON.stringify(operation.references),
        operation.reason ?? null,
        operation.createdAt,
        operation.undoneAt ?? null
      );
    });
  }

  public findOperation(context: RepositoryExecutionContext, operationId: string): RepositoryResult<PersonLifecycleOperation | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`SELECT * FROM person_lifecycle_operations WHERE id=?`).get(operationId) as Record<string, unknown> | undefined;
      return row ? parseOperation(row) : null;
    });
  }

  public listOperationsByPerson(context: RepositoryExecutionContext, personId: PersonId): RepositoryResult<readonly PersonLifecycleOperation[]> {
    return this.execute(context, () => (this.database(context).prepare(`
      SELECT * FROM person_lifecycle_operations WHERE person_id=? ORDER BY created_at DESC,id DESC
    `).all(personId) as ReadonlyArray<Record<string, unknown>>).map(parseOperation));
  }

  public markOperationUndone(
    context: RepositoryExecutionContext,
    input: Parameters<PersonLifecycleRepositoryPort['markOperationUndone']>[1]
  ): RepositoryResult<boolean> {
    return this.execute(context, () => Number(this.database(context).prepare(`
      UPDATE person_lifecycle_operations SET status='undone',undone_at=? WHERE id=? AND status='applied'
    `).run(input.undoneAt, input.operationId).changes) === 1);
  }
}
