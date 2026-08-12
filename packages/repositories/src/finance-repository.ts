import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  BankAccountType,
  BankAccountStatus,
  BankInstitutionKind,
  BankInstitutionView,
  FinanceRecordView,
  FinanceValuationView,
  RecordPrivacy
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type BankAccountRow,
  type FinanceRecordRow,
  type FinancePolicyResourceRepositoryPort,
  type FinanceRepositoryPort,
  type FinanceValuationRow,
  type NewBankAccountRow,
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
}
