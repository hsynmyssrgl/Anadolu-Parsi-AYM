import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type { FinanceRecordView, FinanceValuationView } from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface FinanceRecordRow extends FinanceRecordView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly occurredAt: IsoDateTime;
  readonly dueAt?: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export interface FinanceValuationRow extends FinanceValuationView {
  readonly valueDate: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export interface FinanceRepositoryPort {
    listRecords(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly FinanceRecordRow[]>;
    findRecord(context: PolicyAuthorizedRepositoryExecutionContext, id: string): RepositoryResult<FinanceRecordRow | null>;
    insertRecord(context: PolicyAuthorizedRepositoryExecutionContext, row: FinanceRecordRow): RepositoryResult<void>;
    listValuations(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly FinanceValuationRow[]>;
    insertValuation(context: PolicyAuthorizedRepositoryExecutionContext, row: FinanceValuationRow): RepositoryResult<void>;
}

/**
 * Narrow pre-authorization resource lookup used only by the production PEP
 * resolver. Business finance reads and writes remain on FinanceRepositoryPort
 * and require a live policy-authorized repository context.
 */
export interface FinancePolicyResourceRepositoryPort {
  findRecordForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<FinanceRecordRow | null>;
}
