import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type {
  BankAccountView,
  BankInstitutionView,
  FinancePlanningLedgerItemView,
  FinanceRecordView,
  FinanceValuationView,
  LoanAccountView,
  LoanPaymentHistoryItemView,
  PaymentCardView
} from '@ppt/domain';
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

export interface BankAccountRow extends BankAccountView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly createdAt: IsoDateTime;
}

export interface NewBankAccountRow extends BankAccountRow {
  readonly normalizedIban: string;
}

export interface PaymentCardRow extends PaymentCardView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly statementClosingAt: IsoDateTime;
  readonly paymentDueAt: IsoDateTime;
  readonly annualFeeDueAt?: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export type NewPaymentCardRow = PaymentCardRow;

export interface LoanAccountRow extends LoanAccountView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly disbursedAt: IsoDateTime;
  readonly firstPaymentAt: IsoDateTime;
  readonly maturityAt: IsoDateTime;
  readonly earlySettlementQuotedAt?: IsoDateTime;
  readonly insuranceEndsAt?: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export type NewLoanAccountRow = LoanAccountRow;

export interface LoanPaymentHistoryRow extends LoanPaymentHistoryItemView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly paidAt: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export type NewLoanPaymentHistoryRow = LoanPaymentHistoryRow;

export type FinancePlanningLedgerItemRow = FinancePlanningLedgerItemView & {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly createdAt: IsoDateTime;
};

export type NewFinancePlanningLedgerItemRow = FinancePlanningLedgerItemRow;

export interface FinanceRepositoryPort {
    listRecords(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly FinanceRecordRow[]>;
    findRecord(context: PolicyAuthorizedRepositoryExecutionContext, id: string): RepositoryResult<FinanceRecordRow | null>;
    insertRecord(context: PolicyAuthorizedRepositoryExecutionContext, row: FinanceRecordRow): RepositoryResult<void>;
    listValuations(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly FinanceValuationRow[]>;
    insertValuation(context: PolicyAuthorizedRepositoryExecutionContext, row: FinanceValuationRow): RepositoryResult<void>;
    listBankInstitutions(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly BankInstitutionView[]>;
    findBankInstitution(context: PolicyAuthorizedRepositoryExecutionContext, institutionCode: string): RepositoryResult<BankInstitutionView | null>;
    listBankAccounts(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly BankAccountRow[]>;
    insertBankAccount(context: PolicyAuthorizedRepositoryExecutionContext, row: NewBankAccountRow): RepositoryResult<void>;
    listPaymentCards(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly PaymentCardRow[]>;
    insertPaymentCard(context: PolicyAuthorizedRepositoryExecutionContext, row: NewPaymentCardRow): RepositoryResult<void>;
    listLoanAccounts(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly LoanAccountRow[]>;
    findLoanAccount(context: PolicyAuthorizedRepositoryExecutionContext, id: string): RepositoryResult<LoanAccountRow | null>;
    insertLoanAccount(context: PolicyAuthorizedRepositoryExecutionContext, row: NewLoanAccountRow): RepositoryResult<void>;
    insertLoanPayment(context: PolicyAuthorizedRepositoryExecutionContext, row: NewLoanPaymentHistoryRow): RepositoryResult<void>;
    listPlanningItems(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly FinancePlanningLedgerItemRow[]>;
    findPlanningItem(context: PolicyAuthorizedRepositoryExecutionContext, id: string): RepositoryResult<FinancePlanningLedgerItemRow | null>;
    insertPlanningItem(context: PolicyAuthorizedRepositoryExecutionContext, row: NewFinancePlanningLedgerItemRow): RepositoryResult<void>;
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
  findLoanAccountForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<LoanAccountRow | null>;
  findPlanningItemForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<FinancePlanningLedgerItemRow | null>;
}
