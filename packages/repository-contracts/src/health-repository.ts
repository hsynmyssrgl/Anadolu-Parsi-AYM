import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type { FamilyHealthHistoryView, HealthRecordView, MedicationPlanView } from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface HealthRecordRow extends HealthRecordView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly occurredAt: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export interface MedicationPlanRow extends MedicationPlanView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly startsAt: IsoDateTime;
  readonly endsAt?: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export interface FamilyHealthHistoryRow extends FamilyHealthHistoryView {
  readonly familyId: FamilyId;
  readonly relatedPersonId: PersonId;
  readonly diagnosedAt?: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export interface HealthRepositoryPort {
    listHealthRecords(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly HealthRecordRow[]>;
    insertHealthRecord(context: PolicyAuthorizedRepositoryExecutionContext, row: HealthRecordRow): RepositoryResult<void>;
    listMedicationPlans(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly MedicationPlanRow[]>;
    insertMedicationPlan(context: PolicyAuthorizedRepositoryExecutionContext, row: MedicationPlanRow): RepositoryResult<void>;
    listFamilyHealthHistory(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly FamilyHealthHistoryRow[]>;
    insertFamilyHealthHistory(context: PolicyAuthorizedRepositoryExecutionContext, row: FamilyHealthHistoryRow): RepositoryResult<void>;
}

/**
 * Narrow pre-authorization lookups used only by the production health PEP
 * resolver. Business health reads and writes remain on HealthRepositoryPort
 * and require a live policy-authorized repository context.
 */
export interface HealthPolicyResourceRepositoryPort {
  findHealthRecordForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<HealthRecordRow | null>;
  findMedicationPlanForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<MedicationPlanRow | null>;
  findFamilyHealthHistoryForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<FamilyHealthHistoryRow | null>;
}
