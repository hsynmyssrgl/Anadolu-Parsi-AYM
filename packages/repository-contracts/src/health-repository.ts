import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type {
  FamilyHealthHistoryView,
  HealthCareAccessGrantView,
  HealthCareAccessScope,
  HealthCareEntryView,
  HealthCareMutationKind,
  HealthRecordView,
  MedicationPlanView
} from '@ppt/domain';
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

export interface HealthCareCenterKey {
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly ownerPersonId: PersonId;
  readonly centerId: string;
}

export interface HealthCareCenterRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface HealthCareEntryRow extends HealthCareEntryView {
  readonly familyId: FamilyId;
  readonly recordedByAccountId: string;
  readonly recordedByPersonId: PersonId;
  readonly mutationId: string;
}

export interface HealthCareAccessGrantRow extends HealthCareAccessGrantView {
  readonly familyId: FamilyId;
  readonly mutationId: string;
}

export interface HealthCareMutationRow {
  readonly id: string;
  readonly centerId: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly actorAccountId: string;
  readonly actorPersonId: PersonId;
  readonly mutationKind: HealthCareMutationKind;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly expectedRevision: number;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly targetId: string;
  readonly occurredAt: IsoDateTime;
}

export interface HealthCareCenterSnapshotRow {
  readonly center: HealthCareCenterRow | null;
  readonly entries: readonly HealthCareEntryRow[];
  readonly grants: readonly HealthCareAccessGrantRow[];
  readonly visibleScopes: readonly HealthCareAccessScope[];
  readonly canRecord: boolean;
  readonly truncated: boolean;
}

export interface HealthRepositoryPort {
    listHealthRecords(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly HealthRecordRow[]>;
    insertHealthRecord(context: PolicyAuthorizedRepositoryExecutionContext, row: HealthRecordRow): RepositoryResult<void>;
    listMedicationPlans(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly MedicationPlanRow[]>;
    insertMedicationPlan(context: PolicyAuthorizedRepositoryExecutionContext, row: MedicationPlanRow): RepositoryResult<void>;
    listFamilyHealthHistory(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly FamilyHealthHistoryRow[]>;
    insertFamilyHealthHistory(context: PolicyAuthorizedRepositoryExecutionContext, row: FamilyHealthHistoryRow): RepositoryResult<void>;
    loadHealthCareCenter(context: PolicyAuthorizedRepositoryExecutionContext, key: HealthCareCenterKey): RepositoryResult<HealthCareCenterSnapshotRow>;
    findHealthCareCenter(context: PolicyAuthorizedRepositoryExecutionContext, key: HealthCareCenterKey): RepositoryResult<HealthCareCenterRow | null>;
    findHealthCareMutationByClientOperationId(context: PolicyAuthorizedRepositoryExecutionContext, key: HealthCareCenterKey, clientOperationId: string): RepositoryResult<HealthCareMutationRow | null>;
    insertHealthCareMutation(context: PolicyAuthorizedRepositoryExecutionContext, row: HealthCareMutationRow): RepositoryResult<void>;
    insertHealthCareCenter(context: PolicyAuthorizedRepositoryExecutionContext, row: HealthCareCenterRow): RepositoryResult<void>;
    saveHealthCareCenter(context: PolicyAuthorizedRepositoryExecutionContext, row: HealthCareCenterRow, expectedRevision: number): RepositoryResult<void>;
    insertHealthCareEntry(context: PolicyAuthorizedRepositoryExecutionContext, row: HealthCareEntryRow): RepositoryResult<void>;
    findHealthCareAccessGrant(context: PolicyAuthorizedRepositoryExecutionContext, key: HealthCareCenterKey, grantId: string): RepositoryResult<HealthCareAccessGrantRow | null>;
    findActiveHealthCareAccessGrantForActor(context: PolicyAuthorizedRepositoryExecutionContext, key: HealthCareCenterKey, occurredAt: IsoDateTime): RepositoryResult<HealthCareAccessGrantRow | null>;
    upsertHealthCareAccessGrant(context: PolicyAuthorizedRepositoryExecutionContext, row: HealthCareAccessGrantRow, expectedRevision: number | null): RepositoryResult<void>;
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
  findHealthCareCenterForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<HealthCareCenterRow | null>;
}
