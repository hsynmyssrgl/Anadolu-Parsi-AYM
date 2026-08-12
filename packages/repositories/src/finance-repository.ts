import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  BankAccountType,
  BankAccountStatus,
  BankInstitutionKind,
  BankInstitutionView,
  FinanceRecordView,
  FinanceValuationView,
  LoanAccountView,
  LoanCollateralType,
  LoanInsuranceStatus,
  LoanKind,
  LoanPaymentHistoryItemView,
  LoanPaymentScheduleItemView,
  LoanRateType,
  LoanStatus,
  PaymentCardAutomaticPaymentMode,
  PaymentCardFormFactor,
  PaymentCardKind,
  PaymentCardNetwork,
  PaymentCardStatus,
  RecordPrivacy
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type BankAccountRow,
  type FinanceRecordRow,
  type FinancePolicyResourceRepositoryPort,
  type FinanceRepositoryPort,
  type FinanceValuationRow,
  type LoanAccountRow,
  type NewBankAccountRow,
  type NewLoanAccountRow,
  type NewLoanPaymentHistoryRow,
  type NewPaymentCardRow,
  type PaymentCardRow,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';

const mapRecord = (row: Record<string, unknown>): FinanceRecordRow => ({
  id: String(row.id),
  familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  title: String(row.title),
  kind: String(row.kind) as FinanceRecordView['kind'],
  amount: Number(row.amount),
  currency: String(row.currency),
  privacy: String(row.privacy) as RecordPrivacy,
  ...(row.notes ? { notes: String(row.notes) } : {}),
  occurredAt: asIsoDateTime(String(row.occurred_at)),
  ...(row.due_at ? { dueAt: asIsoDateTime(String(row.due_at)) } : {}),
  ...(row.remaining_principal !== null && row.remaining_principal !== undefined
    ? { remainingPrincipal: Number(row.remaining_principal) }
    : {}),
  ...(row.symbol ? { symbol: String(row.symbol) } : {}),
  createdAt: asIsoDateTime(String(row.created_at))
});

const mapValuation = (row: Record<string, unknown>): FinanceValuationRow => ({
  id: String(row.id),
  financeRecordId: String(row.finance_record_id),
  valueDate: asIsoDateTime(String(row.value_date)),
  unitPrice: Number(row.unit_price),
  quantity: Number(row.quantity),
  marketValue: Number(row.market_value),
  provider: String(row.provider),
  createdAt: asIsoDateTime(String(row.created_at))
});

const mapInstitution = (row: Record<string, unknown>): BankInstitutionView => ({
  institutionCode: String(row.institution_code),
  ibanProviderCode: String(row.iban_provider_code),
  officialName: String(row.official_name),
  countryCode: 'TR',
  kind: String(row.kind) as BankInstitutionKind,
  supportsCustomerAccounts: Number(row.supports_customer_accounts) === 1,
  iconKey: String(row.icon_key),
  iconSource: 'local_lettermark',
  sourceName: 'TCMB Ödeme Sistemleri Katılımcıları',
  sourceVersion: '2026',
  sourceUrl: String(row.source_url),
  sourceRetrievedAt: String(row.source_retrieved_at),
  status: 'active'
});

const maskPersistedIban = (normalizedIban: string): string => {
  const concealed = '•'.repeat(Math.max(0, normalizedIban.length - 8)).match(/.{1,4}/gu) ?? [];
  return [normalizedIban.slice(0, 4), ...concealed, normalizedIban.slice(-4)].join(' ');
};

const mapBankAccount = (row: Record<string, unknown>): BankAccountRow => {
  const normalizedIban = String(row.normalized_iban);
  return {
    id: String(row.id),
    familyId: asFamilyId(String(row.family_id)),
    ownerPersonId: asPersonId(String(row.owner_person_id)),
    institutionCode: String(row.institution_code),
    institutionOfficialName: String(row.institution_official_name),
    institutionIconKey: String(row.institution_icon_key),
    ibanMasked: maskPersistedIban(normalizedIban),
    ibanLast4: normalizedIban.slice(-4),
    ibanCountryCode: String(row.iban_country_code),
    ibanProviderCode: String(row.iban_provider_code),
    ibanStructurallyValid: true,
    institutionMatched: true,
    accountVerification: 'not_performed',
    ownershipVerification: 'not_performed',
    accountType: String(row.account_type) as BankAccountType,
    currency: String(row.currency),
    alias: String(row.alias),
    ...(row.branch ? { branch: String(row.branch) } : {}),
    ownershipBasisPoints: Number(row.ownership_basis_points),
    status: String(row.status) as BankAccountStatus,
    privacy: String(row.privacy) as RecordPrivacy,
    createdAt: asIsoDateTime(String(row.created_at))
  };
};

const mapPaymentCard = (row: Record<string, unknown>): PaymentCardRow => ({
  id: String(row.id),
  familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  institutionCode: String(row.institution_code),
  institutionOfficialName: String(row.institution_official_name),
  institutionIconKey: String(row.institution_icon_key),
  productName: String(row.product_name),
  kind: String(row.kind) as PaymentCardKind,
  network: String(row.network) as PaymentCardNetwork,
  formFactor: String(row.form_factor) as PaymentCardFormFactor,
  last4: String(row.last4),
  currency: String(row.currency),
  creditLimit: Number(row.credit_limit),
  availableLimit: Number(row.available_limit),
  currentDebt: Number(row.current_debt),
  statementBalance: Number(row.statement_balance),
  statementClosingAt: asIsoDateTime(String(row.statement_closing_at)),
  paymentDueAt: asIsoDateTime(String(row.payment_due_at)),
  activeInstallmentCount: Number(row.active_installment_count),
  installmentOutstandingAmount: Number(row.installment_outstanding_amount),
  automaticPaymentMode: String(row.automatic_payment_mode) as PaymentCardAutomaticPaymentMode,
  rewardPoints: Number(row.reward_points),
  rewardMiles: Number(row.reward_miles),
  annualFeeAmount: Number(row.annual_fee_amount),
  ...(row.annual_fee_due_at ? { annualFeeDueAt: asIsoDateTime(String(row.annual_fee_due_at)) } : {}),
  alertsEnabled: Number(row.alerts_enabled) === 1,
  utilizationAlertBasisPoints: Number(row.utilization_alert_basis_points),
  paymentDueAlertDays: Number(row.payment_due_alert_days),
  status: String(row.status) as PaymentCardStatus,
  privacy: String(row.privacy) as RecordPrivacy,
  createdAt: asIsoDateTime(String(row.created_at))
});

const mapLoanPaymentScheduleItem = (row: Record<string, unknown>): LoanPaymentScheduleItemView => ({
  sequence: Number(row.installment_sequence),
  dueAt: asIsoDateTime(String(row.due_at)),
  scheduledAmount: Number(row.scheduled_amount)
});

const mapLoanPaymentHistoryItem = (row: Record<string, unknown>): LoanPaymentHistoryItemView => ({
  id: String(row.id),
  loanId: String(row.loan_id),
  paidAt: asIsoDateTime(String(row.paid_at)),
  ...(row.scheduled_installment_sequence === null || row.scheduled_installment_sequence === undefined
    ? {}
    : { scheduledInstallmentSequence: Number(row.scheduled_installment_sequence) }),
  amount: Number(row.amount),
  principalAmount: Number(row.principal_amount),
  interestAmount: Number(row.interest_amount),
  lateFeeAmount: Number(row.late_fee_amount),
  ...(row.notes ? { notes: String(row.notes) } : {}),
  createdAt: asIsoDateTime(String(row.created_at))
});

const mapLoanAccount = (
  row: Record<string, unknown>,
  paymentSchedule: readonly LoanPaymentScheduleItemView[],
  paymentHistory: readonly LoanPaymentHistoryItemView[]
): LoanAccountRow => ({
  id: String(row.id),
  familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  institutionCode: String(row.institution_code),
  institutionOfficialName: String(row.institution_official_name),
  institutionIconKey: String(row.institution_icon_key),
  title: String(row.title),
  kind: String(row.kind) as LoanKind,
  rateType: String(row.rate_type) as LoanRateType,
  annualRateBasisPoints: Number(row.annual_rate_basis_points),
  termMonths: Number(row.term_months),
  currency: String(row.currency),
  originalPrincipal: Number(row.original_principal),
  installmentAmount: Number(row.installment_amount),
  remainingPrincipal: Number(row.remaining_principal),
  disbursedAt: asIsoDateTime(String(row.disbursed_at)),
  firstPaymentAt: asIsoDateTime(String(row.first_payment_at)),
  maturityAt: asIsoDateTime(String(row.maturity_at)),
  earlySettlementAmount: Number(row.early_settlement_amount),
  ...(row.early_settlement_quoted_at ? { earlySettlementQuotedAt: asIsoDateTime(String(row.early_settlement_quoted_at)) } : {}),
  overdueInstallmentCount: Number(row.overdue_installment_count),
  overdueAmount: Number(row.overdue_amount),
  daysPastDue: Number(row.days_past_due),
  insuranceStatus: String(row.insurance_status) as LoanInsuranceStatus,
  ...(row.insurance_provider ? { insuranceProvider: String(row.insurance_provider) } : {}),
  ...(row.insurance_policy_reference ? { insurancePolicyReference: String(row.insurance_policy_reference) } : {}),
  insurancePremiumAmount: Number(row.insurance_premium_amount),
  ...(row.insurance_ends_at ? { insuranceEndsAt: asIsoDateTime(String(row.insurance_ends_at)) } : {}),
  collateralType: String(row.collateral_type) as LoanCollateralType,
  ...(row.collateral_description ? { collateralDescription: String(row.collateral_description) } : {}),
  collateralEstimatedValue: Number(row.collateral_estimated_value),
  status: String(row.status) as LoanStatus,
  privacy: String(row.privacy) as RecordPrivacy,
  dataSource: 'manual',
  bankVerification: 'not_performed',
  paymentExecution: 'not_performed',
  paymentSchedule: Object.freeze([...paymentSchedule]),
  paymentHistory: Object.freeze([...paymentHistory]),
  createdAt: asIsoDateTime(String(row.created_at))
});

const assertCollectionRead = (context: PolicyAuthorizedRepositoryExecutionContext): void => {
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'finance_record',
    resourceId: '*',
    action: 'read',
    capability: 'finance.read',
    correlationId: context.correlationId
  });
};

const assertBankCatalogAccess = (context: PolicyAuthorizedRepositoryExecutionContext): void => {
  const authorization = context.policyAuthorization;
  if (
    authorization.resourceType !== 'finance_record'
    || !(
      (authorization.action === 'read' && authorization.capability === 'finance.read')
      || (authorization.action === 'create' && authorization.capability === 'finance.write')
    )
  ) throw new Error('Bank institution catalog access requires a governed finance authorization');
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: authorization.resourceType,
    resourceId: authorization.resourceId,
    action: authorization.action,
    capability: authorization.capability,
    correlationId: context.correlationId
  });
};

const assertRecordAccess = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  resourceId: string
): void => {
  const action = context.policyAuthorization.action;
  if (action !== 'read' && action !== 'update') {
    throw new Error('Finance record lookup requires a read or update policy authorization');
  }
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'finance_record',
    resourceId,
    action,
    capability: action === 'read' ? 'finance.read' : 'finance.write',
    correlationId: context.correlationId
  });
};

const financeWriteBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  resourceId: string,
  action: 'create' | 'update'
) => {
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'finance_record',
    resourceId,
    action,
    capability: 'finance.write',
    correlationId: context.correlationId
  });
  const binding = platformPolicyPersistenceBinding(context, 'finance_record', resourceId);
  if (!binding) throw new Error('Finance write requires an active platform policy receipt binding');
  return binding;
};

export class SqliteFinanceRepository extends SqliteRepository implements FinanceRepositoryPort, FinancePolicyResourceRepositoryPort {
  public listRecords(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly FinanceRecordRow[]> {
    assertCollectionRead(context);
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,family_id,owner_person_id,title,kind,amount,currency,privacy,notes,
               occurred_at,due_at,remaining_principal,symbol,created_at
        FROM finance_records
        WHERE NOT EXISTS (
          SELECT 1 FROM data_lifecycle dl
          WHERE dl.resource_type='finance_record'
            AND dl.resource_id=finance_records.id
            AND dl.state<>'active'
        )
        ORDER BY occurred_at DESC,id
      `).all() as Array<Record<string, unknown>>
    ).map(mapRecord));
  }

  public findRecord(
    context: PolicyAuthorizedRepositoryExecutionContext,
    id: string
  ): RepositoryResult<FinanceRecordRow | null> {
    assertRecordAccess(context, id);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,family_id,owner_person_id,title,kind,amount,currency,privacy,notes,
               occurred_at,due_at,remaining_principal,symbol,created_at
        FROM finance_records
        WHERE id=?
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle dl
            WHERE dl.resource_type='finance_record'
              AND dl.resource_id=finance_records.id
              AND dl.state<>'active'
          )
      `).get(id) as Record<string, unknown> | undefined;
      return row ? mapRecord(row) : null;
    });
  }

  public findRecordForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<FinanceRecordRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,family_id,owner_person_id,title,kind,amount,currency,privacy,notes,
               occurred_at,due_at,remaining_principal,symbol,created_at
        FROM finance_records
        WHERE id=?
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle dl
            WHERE dl.resource_type='finance_record'
              AND dl.resource_id=finance_records.id
              AND dl.state<>'active'
          )
      `).get(id) as Record<string, unknown> | undefined;
      return row ? mapRecord(row) : null;
    });
  }

  public insertRecord(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: FinanceRecordRow
  ): RepositoryResult<void> {
    const policy = financeWriteBinding(context, row.id, 'create');
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO finance_records(
          id,family_id,owner_person_id,title,kind,amount,currency,privacy,notes,
          occurred_at,due_at,remaining_principal,symbol,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        row.id,
        row.familyId,
        row.ownerPersonId,
        row.title,
        row.kind,
        row.amount,
        row.currency,
        row.privacy,
        row.notes ?? null,
        row.occurredAt,
        row.dueAt ?? null,
        row.remainingPrincipal ?? null,
        row.symbol ?? null,
        row.createdAt,
        policy.receiptHash,
        policy.receiptVersion,
        policy.nonce,
        context.correlationId,
        policy.resourceType,
        policy.resourceId,
        policy.action,
        policy.capability
      );
      this.database(context).prepare(`
        INSERT OR IGNORE INTO data_lifecycle(
          resource_type,resource_id,owner_person_id,privacy,state,updated_at
        ) VALUES('finance_record',?,?,?,'active',?)
      `).run(row.id, row.ownerPersonId, row.privacy, row.createdAt);
    });
  }

  public listValuations(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly FinanceValuationRow[]> {
    assertCollectionRead(context);
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,finance_record_id,value_date,unit_price,quantity,market_value,provider,created_at
        FROM finance_valuations
        WHERE EXISTS (
          SELECT 1 FROM finance_records fr
          WHERE fr.id=finance_valuations.finance_record_id
            AND NOT EXISTS (
              SELECT 1 FROM data_lifecycle dl
              WHERE dl.resource_type='finance_record'
                AND dl.resource_id=fr.id
                AND dl.state<>'active'
            )
        )
        ORDER BY value_date DESC,id
      `).all() as Array<Record<string, unknown>>
    ).map(mapValuation));
  }

  public insertValuation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: FinanceValuationRow
  ): RepositoryResult<void> {
    const policy = financeWriteBinding(context, row.financeRecordId, 'update');
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO finance_valuations(
          id,finance_record_id,value_date,unit_price,quantity,market_value,provider,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        row.id,
        row.financeRecordId,
        row.valueDate,
        row.unitPrice,
        row.quantity,
        row.marketValue,
        row.provider,
        row.createdAt,
        policy.receiptHash,
        policy.receiptVersion,
        policy.nonce,
        context.correlationId,
        policy.resourceType,
        policy.resourceId,
        policy.action,
        policy.capability
      );
    });
  }

  public listBankInstitutions(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly BankInstitutionView[]> {
    assertCollectionRead(context);
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT institution_code,iban_provider_code,official_name,kind,supports_customer_accounts,
               icon_key,source_url,source_retrieved_at
        FROM bank_institutions
        WHERE country_code='TR' AND status='active'
        ORDER BY official_name COLLATE NOCASE,institution_code
      `).all() as Array<Record<string, unknown>>
    ).map(mapInstitution));
  }

  public findBankInstitution(
    context: PolicyAuthorizedRepositoryExecutionContext,
    institutionCode: string
  ): RepositoryResult<BankInstitutionView | null> {
    assertBankCatalogAccess(context);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT institution_code,iban_provider_code,official_name,kind,supports_customer_accounts,
               icon_key,source_url,source_retrieved_at
        FROM bank_institutions
        WHERE institution_code=? AND country_code='TR' AND status='active'
      `).get(institutionCode) as Record<string, unknown> | undefined;
      return row ? mapInstitution(row) : null;
    });
  }

  public listBankAccounts(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly BankAccountRow[]> {
    assertCollectionRead(context);
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT account.id,account.family_id,account.owner_person_id,account.institution_code,
               institution.official_name AS institution_official_name,
               institution.icon_key AS institution_icon_key,
               account.normalized_iban,account.iban_country_code,account.iban_provider_code,
               account.account_type,account.currency,account.alias,account.branch,
               account.ownership_basis_points,account.status,account.privacy,account.created_at
        FROM bank_accounts account
        JOIN bank_institutions institution ON institution.institution_code=account.institution_code
        ORDER BY account.created_at DESC,account.id
      `).all() as Array<Record<string, unknown>>
    ).map(mapBankAccount));
  }

  public insertBankAccount(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: NewBankAccountRow
  ): RepositoryResult<void> {
    const policy = financeWriteBinding(context, row.id, 'create');
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO bank_accounts(
          id,family_id,owner_person_id,institution_code,normalized_iban,iban_country_code,
          iban_provider_code,account_type,currency,alias,branch,ownership_basis_points,status,
          privacy,structural_validation,account_verification,ownership_verification,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,
          policy_resource_type,policy_resource_id,policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'valid','not_performed','not_performed',?,?,?,?,?,?,?,?,?)
      `).run(
        row.id,
        row.familyId,
        row.ownerPersonId,
        row.institutionCode,
        row.normalizedIban,
        row.ibanCountryCode,
        row.ibanProviderCode,
        row.accountType,
        row.currency,
        row.alias,
        row.branch ?? null,
        row.ownershipBasisPoints,
        row.status,
        row.privacy,
        row.createdAt,
        policy.receiptHash,
        policy.receiptVersion,
        policy.nonce,
        context.correlationId,
        policy.resourceType,
        policy.resourceId,
        policy.action,
        policy.capability
      );
    });
  }

  public listPaymentCards(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly PaymentCardRow[]> {
    assertCollectionRead(context);
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT card.id,card.family_id,card.owner_person_id,card.institution_code,
               institution.official_name AS institution_official_name,
               institution.icon_key AS institution_icon_key,
               card.product_name,card.kind,card.network,card.form_factor,card.last4,card.currency,
               card.credit_limit,card.available_limit,card.current_debt,card.statement_balance,
               card.statement_closing_at,card.payment_due_at,card.active_installment_count,
               card.installment_outstanding_amount,card.automatic_payment_mode,
               card.reward_points,card.reward_miles,card.annual_fee_amount,card.annual_fee_due_at,
               card.alerts_enabled,card.utilization_alert_basis_points,card.payment_due_alert_days,
               card.status,card.privacy,card.created_at
        FROM payment_cards card
        JOIN bank_institutions institution ON institution.institution_code=card.institution_code
        ORDER BY card.created_at DESC,card.id
      `).all() as Array<Record<string, unknown>>
    ).map(mapPaymentCard));
  }

  public insertPaymentCard(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: NewPaymentCardRow
  ): RepositoryResult<void> {
    const policy = financeWriteBinding(context, row.id, 'create');
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO payment_cards(
          id,family_id,owner_person_id,institution_code,product_name,kind,network,form_factor,
          last4,currency,credit_limit,available_limit,current_debt,statement_balance,
          statement_closing_at,payment_due_at,active_installment_count,
          installment_outstanding_amount,automatic_payment_mode,reward_points,reward_miles,
          annual_fee_amount,annual_fee_due_at,alerts_enabled,utilization_alert_basis_points,
          payment_due_alert_days,status,privacy,created_at,policy_receipt_hash,
          policy_receipt_version,policy_receipt_nonce,policy_correlation_id,policy_resource_type,
          policy_resource_id,policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        row.id,
        row.familyId,
        row.ownerPersonId,
        row.institutionCode,
        row.productName,
        row.kind,
        row.network,
        row.formFactor,
        row.last4,
        row.currency,
        row.creditLimit,
        row.availableLimit,
        row.currentDebt,
        row.statementBalance,
        row.statementClosingAt,
        row.paymentDueAt,
        row.activeInstallmentCount,
        row.installmentOutstandingAmount,
        row.automaticPaymentMode,
        row.rewardPoints,
        row.rewardMiles,
        row.annualFeeAmount,
        row.annualFeeDueAt ?? null,
        row.alertsEnabled ? 1 : 0,
        row.utilizationAlertBasisPoints,
        row.paymentDueAlertDays,
        row.status,
        row.privacy,
        row.createdAt,
        policy.receiptHash,
        policy.receiptVersion,
        policy.nonce,
        context.correlationId,
        policy.resourceType,
        policy.resourceId,
        policy.action,
        policy.capability
      );
    });
  }

  public listLoanAccounts(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly LoanAccountRow[]> {
    assertCollectionRead(context);
    return this.execute(context, () => {
      const database = this.database(context);
      const loans = database.prepare(`
        SELECT loan.id,loan.family_id,loan.owner_person_id,loan.institution_code,
               institution.official_name AS institution_official_name,
               institution.icon_key AS institution_icon_key,
               loan.title,loan.kind,loan.rate_type,loan.annual_rate_basis_points,
               loan.term_months,loan.currency,loan.original_principal,loan.installment_amount,
               loan.remaining_principal,loan.disbursed_at,loan.first_payment_at,loan.maturity_at,
               loan.early_settlement_amount,loan.early_settlement_quoted_at,
               loan.overdue_installment_count,loan.overdue_amount,loan.days_past_due,
               loan.insurance_status,loan.insurance_provider,loan.insurance_policy_reference,
               loan.insurance_premium_amount,loan.insurance_ends_at,loan.collateral_type,
               loan.collateral_description,loan.collateral_estimated_value,loan.status,
               loan.privacy,loan.created_at
        FROM loan_accounts loan
        JOIN bank_institutions institution ON institution.institution_code=loan.institution_code
        ORDER BY loan.created_at DESC,loan.id
      `).all() as Array<Record<string, unknown>>;
      const schedule = database.prepare(`
        SELECT installment_sequence,due_at,scheduled_amount
        FROM loan_payment_schedule
        WHERE loan_id=?
        ORDER BY installment_sequence
      `);
      const history = database.prepare(`
        SELECT id,loan_id,paid_at,scheduled_installment_sequence,amount,principal_amount,
               interest_amount,late_fee_amount,notes,created_at
        FROM loan_payment_history
        WHERE loan_id=?
        ORDER BY paid_at DESC,created_at DESC,id
      `);
      return loans.map((loan) => mapLoanAccount(
        loan,
        (schedule.all(String(loan.id)) as Array<Record<string, unknown>>).map(mapLoanPaymentScheduleItem),
        (history.all(String(loan.id)) as Array<Record<string, unknown>>).map(mapLoanPaymentHistoryItem)
      ));
    });
  }

  public findLoanAccount(
    context: PolicyAuthorizedRepositoryExecutionContext,
    id: string
  ): RepositoryResult<LoanAccountRow | null> {
    assertRecordAccess(context, id);
    return this.execute(context, () => {
      const database = this.database(context);
      const loan = database.prepare(`
        SELECT loan.id,loan.family_id,loan.owner_person_id,loan.institution_code,
               institution.official_name AS institution_official_name,
               institution.icon_key AS institution_icon_key,
               loan.title,loan.kind,loan.rate_type,loan.annual_rate_basis_points,
               loan.term_months,loan.currency,loan.original_principal,loan.installment_amount,
               loan.remaining_principal,loan.disbursed_at,loan.first_payment_at,loan.maturity_at,
               loan.early_settlement_amount,loan.early_settlement_quoted_at,
               loan.overdue_installment_count,loan.overdue_amount,loan.days_past_due,
               loan.insurance_status,loan.insurance_provider,loan.insurance_policy_reference,
               loan.insurance_premium_amount,loan.insurance_ends_at,loan.collateral_type,
               loan.collateral_description,loan.collateral_estimated_value,loan.status,
               loan.privacy,loan.created_at
        FROM loan_accounts loan
        JOIN bank_institutions institution ON institution.institution_code=loan.institution_code
        WHERE loan.id=?
      `).get(id) as Record<string, unknown> | undefined;
      if (!loan) return null;
      const schedule = database.prepare(`
        SELECT installment_sequence,due_at,scheduled_amount
        FROM loan_payment_schedule WHERE loan_id=? ORDER BY installment_sequence
      `).all(id) as Array<Record<string, unknown>>;
      const history = database.prepare(`
        SELECT id,loan_id,paid_at,scheduled_installment_sequence,amount,principal_amount,
               interest_amount,late_fee_amount,notes,created_at
        FROM loan_payment_history WHERE loan_id=? ORDER BY paid_at DESC,created_at DESC,id
      `).all(id) as Array<Record<string, unknown>>;
      return mapLoanAccount(loan, schedule.map(mapLoanPaymentScheduleItem), history.map(mapLoanPaymentHistoryItem));
    });
  }

  public findLoanAccountForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<LoanAccountRow | null> {
    return this.execute(context, () => {
      const database = this.database(context);
      const loan = database.prepare(`
        SELECT loan.id,loan.family_id,loan.owner_person_id,loan.institution_code,
               institution.official_name AS institution_official_name,
               institution.icon_key AS institution_icon_key,
               loan.title,loan.kind,loan.rate_type,loan.annual_rate_basis_points,
               loan.term_months,loan.currency,loan.original_principal,loan.installment_amount,
               loan.remaining_principal,loan.disbursed_at,loan.first_payment_at,loan.maturity_at,
               loan.early_settlement_amount,loan.early_settlement_quoted_at,
               loan.overdue_installment_count,loan.overdue_amount,loan.days_past_due,
               loan.insurance_status,loan.insurance_provider,loan.insurance_policy_reference,
               loan.insurance_premium_amount,loan.insurance_ends_at,loan.collateral_type,
               loan.collateral_description,loan.collateral_estimated_value,loan.status,
               loan.privacy,loan.created_at
        FROM loan_accounts loan
        JOIN bank_institutions institution ON institution.institution_code=loan.institution_code
        WHERE loan.id=?
      `).get(id) as Record<string, unknown> | undefined;
      if (!loan) return null;
      const schedule = database.prepare(`
        SELECT installment_sequence,due_at,scheduled_amount
        FROM loan_payment_schedule WHERE loan_id=? ORDER BY installment_sequence
      `).all(id) as Array<Record<string, unknown>>;
      const history = database.prepare(`
        SELECT id,loan_id,paid_at,scheduled_installment_sequence,amount,principal_amount,
               interest_amount,late_fee_amount,notes,created_at
        FROM loan_payment_history WHERE loan_id=? ORDER BY paid_at DESC,created_at DESC,id
      `).all(id) as Array<Record<string, unknown>>;
      return mapLoanAccount(loan, schedule.map(mapLoanPaymentScheduleItem), history.map(mapLoanPaymentHistoryItem));
    });
  }

  public insertLoanAccount(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: NewLoanAccountRow
  ): RepositoryResult<void> {
    const policy = financeWriteBinding(context, row.id, 'create');
    return this.execute(context, () => {
      const database = this.database(context);
      database.prepare(`
        INSERT INTO loan_accounts(
          id,family_id,owner_person_id,institution_code,title,kind,rate_type,
          annual_rate_basis_points,term_months,currency,original_principal,
          installment_amount,remaining_principal,disbursed_at,first_payment_at,maturity_at,
          early_settlement_amount,early_settlement_quoted_at,overdue_installment_count,
          overdue_amount,days_past_due,insurance_status,insurance_provider,
          insurance_policy_reference,insurance_premium_amount,insurance_ends_at,
          collateral_type,collateral_description,collateral_estimated_value,status,privacy,
          created_at,policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,policy_action,
          policy_capability
        ) VALUES(${Array.from({ length: 40 }, () => '?').join(',')})
      `).run(
        row.id,
        row.familyId,
        row.ownerPersonId,
        row.institutionCode,
        row.title,
        row.kind,
        row.rateType,
        row.annualRateBasisPoints,
        row.termMonths,
        row.currency,
        row.originalPrincipal,
        row.installmentAmount,
        row.remainingPrincipal,
        row.disbursedAt,
        row.firstPaymentAt,
        row.maturityAt,
        row.earlySettlementAmount,
        row.earlySettlementQuotedAt ?? null,
        row.overdueInstallmentCount,
        row.overdueAmount,
        row.daysPastDue,
        row.insuranceStatus,
        row.insuranceProvider ?? null,
        row.insurancePolicyReference ?? null,
        row.insurancePremiumAmount,
        row.insuranceEndsAt ?? null,
        row.collateralType,
        row.collateralDescription ?? null,
        row.collateralEstimatedValue,
        row.status,
        row.privacy,
        row.createdAt,
        policy.receiptHash,
        policy.receiptVersion,
        policy.nonce,
        context.correlationId,
        policy.resourceType,
        policy.resourceId,
        policy.action,
        policy.capability
      );
      const insertSchedule = database.prepare(`
        INSERT INTO loan_payment_schedule(loan_id,installment_sequence,due_at,scheduled_amount)
        VALUES(?,?,?,?)
      `);
      for (const installment of row.paymentSchedule) {
        insertSchedule.run(row.id, installment.sequence, installment.dueAt, installment.scheduledAmount);
      }
    });
  }

  public insertLoanPayment(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: NewLoanPaymentHistoryRow
  ): RepositoryResult<void> {
    const policy = financeWriteBinding(context, row.loanId, 'update');
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO loan_payment_history(
          id,loan_id,family_id,owner_person_id,paid_at,scheduled_installment_sequence,
          amount,principal_amount,interest_amount,late_fee_amount,notes,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,policy_action,
          policy_capability
        ) VALUES(${Array.from({ length: 20 }, () => '?').join(',')})
      `).run(
        row.id,
        row.loanId,
        row.familyId,
        row.ownerPersonId,
        row.paidAt,
        row.scheduledInstallmentSequence ?? null,
        row.amount,
        row.principalAmount,
        row.interestAmount,
        row.lateFeeAmount,
        row.notes ?? null,
        row.createdAt,
        policy.receiptHash,
        policy.receiptVersion,
        policy.nonce,
        context.correlationId,
        policy.resourceType,
        policy.resourceId,
        policy.action,
        policy.capability
      );
    });
  }
}
