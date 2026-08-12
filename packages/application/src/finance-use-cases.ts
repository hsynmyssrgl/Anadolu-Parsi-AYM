import {
  ERROR_CODES,
  asIsoDateTime,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type EventId,
  type FamilyId,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import type {
  BankAccountView,
  BankInstitutionView,
  CreateBankAccountInput,
  CreateFinanceRecordInput,
  CreateFinanceValuationInput,
  CreateLoanAccountInput,
  CreatePaymentCardInput,
  FamilyRole,
  FinanceRecordView,
  FinanceValuationView,
  IbanStructuralValidationView,
  LoanAccountView,
  LoanPaymentHistoryItemView,
  PaymentCardView,
  RecordLoanPaymentInput,
  RecordPrivacy
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type { AuthorizationAction } from '@ppt/security';
import {
  inspectBankAccountDataContract,
  inspectLoanAccountDataContract,
  inspectLoanPaymentDataContract,
  inspectPaymentCardDataContract,
  inspectProhibitedBankingSecrets,
  maskIban,
  normalizeIban,
  validateIbanStructure
} from './banking-security.js';

export interface FinanceApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: {
    readonly userId: UserId;
    readonly role: FamilyRole;
    readonly personId?: PersonId;
  };
  readonly correlationId: CorrelationId;
}

export interface FinancePolicyIntent {
  readonly action: 'read' | 'create' | 'update';
  readonly capability: 'finance.read' | 'finance.write';
  readonly resourceType: 'finance_record';
  readonly resourceId: string;
  readonly purpose: 'finance';
  readonly ownerPersonId?: PersonId;
  readonly privacy?: RecordPrivacy;
}

export interface FinanceQueryPort {
  listRecords(context: FinanceApplicationContext): Promise<Result<readonly FinanceRecordView[], AppError>>;
  listValuations(context: FinanceApplicationContext): Promise<Result<readonly FinanceValuationView[], AppError>>;
  listBankInstitutions(context: FinanceApplicationContext): Promise<Result<readonly BankInstitutionView[], AppError>>;
  listBankAccounts(context: FinanceApplicationContext): Promise<Result<readonly BankAccountView[], AppError>>;
  listPaymentCards(context: FinanceApplicationContext): Promise<Result<readonly PaymentCardView[], AppError>>;
  listLoanAccounts(context: FinanceApplicationContext): Promise<Result<readonly LoanAccountView[], AppError>>;
  validateIban(context: FinanceApplicationContext, iban: string): Promise<Result<IbanStructuralValidationView, AppError>>;
}

export interface FinanceWriteScope {
  readonly occurredAt: IsoDateTime;
  findPerson(id: PersonId): Result<{ id: PersonId } | null, AppError>;
  findRecord(id: string): Result<(FinanceRecordView & { ownerPersonId: PersonId }) | null, AppError>;
  findLoanAccount(id: string): Result<(LoanAccountView & { ownerPersonId: PersonId }) | null, AppError>;
  findBankInstitution(institutionCode: string): Result<BankInstitutionView | null, AppError>;
  authorize(input: {
    action: AuthorizationAction;
    resourceType: 'finance_record' | 'finance_valuation';
    resourceId: string;
    ownerPersonId: PersonId;
    privacy: RecordPrivacy;
  }): Result<boolean, AppError>;
  insertRecord(row: FinanceRecordView & {
    familyId: FamilyId;
    ownerPersonId: PersonId;
    occurredAt: IsoDateTime;
    dueAt?: IsoDateTime;
    createdAt: IsoDateTime;
  }): Result<void, AppError>;
  insertValuation(row: FinanceValuationView & {
    valueDate: IsoDateTime;
    createdAt: IsoDateTime;
  }): Result<void, AppError>;
  insertBankAccount(row: BankAccountView & {
    familyId: FamilyId;
    ownerPersonId: PersonId;
    normalizedIban: string;
    createdAt: IsoDateTime;
  }): Result<void, AppError>;
  insertPaymentCard(row: PaymentCardView & {
    familyId: FamilyId;
    ownerPersonId: PersonId;
    statementClosingAt: IsoDateTime;
    paymentDueAt: IsoDateTime;
    annualFeeDueAt?: IsoDateTime;
    createdAt: IsoDateTime;
  }): Result<void, AppError>;
  insertLoanAccount(row: LoanAccountView & {
    familyId: FamilyId;
    ownerPersonId: PersonId;
    disbursedAt: IsoDateTime;
    firstPaymentAt: IsoDateTime;
    maturityAt: IsoDateTime;
    earlySettlementQuotedAt?: IsoDateTime;
    insuranceEndsAt?: IsoDateTime;
    createdAt: IsoDateTime;
  }): Result<void, AppError>;
  insertLoanPayment(row: LoanPaymentHistoryItemView & {
    familyId: FamilyId;
    ownerPersonId: PersonId;
    paidAt: IsoDateTime;
    createdAt: IsoDateTime;
  }): Result<void, AppError>;
  appendAudit(input: {
    id: string;
    action: string;
    resourceType: string;
    resourceId: string;
    occurredAt: IsoDateTime;
    actorId: UserId;
  }): Result<string, AppError>;
  enqueueEvent<T>(event: DomainEvent<T>): Result<void, AppError>;
}

export interface FinanceUnitOfWork {
  execute<T>(
    context: FinanceApplicationContext,
    intent: FinancePolicyIntent,
    operation: (scope: FinanceWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

const invalid = (context: FinanceApplicationContext, message: string) => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT,
  message,
  category: 'validation',
  correlationId: context.correlationId
});

const denied = (context: FinanceApplicationContext) => createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message: 'Bu finans işlemi için yetkiniz bulunmuyor.',
  category: 'authorization',
  correlationId: context.correlationId
});

const missing = (context: FinanceApplicationContext, message: string) => createAppError({
  code: ERROR_CODES.RESOURCE_NOT_FOUND,
  message,
  category: 'not_found',
  correlationId: context.correlationId
});

const date = (
  value: string,
  context: FinanceApplicationContext,
  label: string
): Result<IsoDateTime, AppError> => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? err(invalid(context, `${label} geçersiz.`))
    : ok(asIsoDateTime(parsed.toISOString()));
};

export class ListFinanceRecordsUseCase {
  public constructor(private readonly query: FinanceQueryPort) {}
  public execute(context: FinanceApplicationContext) { return this.query.listRecords(context); }
}

export class ListFinanceValuationsUseCase {
  public constructor(private readonly query: FinanceQueryPort) {}
  public execute(context: FinanceApplicationContext) { return this.query.listValuations(context); }
}

export class ListBankInstitutionsUseCase {
  public constructor(private readonly query: FinanceQueryPort) {}
  public execute(context: FinanceApplicationContext) { return this.query.listBankInstitutions(context); }
}

export class ListBankAccountsUseCase {
  public constructor(private readonly query: FinanceQueryPort) {}
  public execute(context: FinanceApplicationContext) { return this.query.listBankAccounts(context); }
}

export class ListPaymentCardsUseCase {
  public constructor(private readonly query: FinanceQueryPort) {}
  public execute(context: FinanceApplicationContext) { return this.query.listPaymentCards(context); }
}

export class ListLoanAccountsUseCase {
  public constructor(private readonly query: FinanceQueryPort) {}
  public execute(context: FinanceApplicationContext) { return this.query.listLoanAccounts(context); }
}

export class ValidateIbanUseCase {
  public constructor(private readonly query: FinanceQueryPort) {}
  public execute(input: { context: FinanceApplicationContext; iban: string }) {
    return this.query.validateIban(input.context, input.iban);
  }
}

export class CreateFinanceRecordUseCase {
  public constructor(private readonly unitOfWork: FinanceUnitOfWork) {}

  public async execute(input: {
    context: FinanceApplicationContext;
    command: CreateFinanceRecordInput;
    identifiers: { recordId: string; auditId: string; outboxEventId: EventId };
  }): Promise<Result<FinanceRecordView, AppError>> {
    const bankingSecretInspection = inspectProhibitedBankingSecrets(input.command, [
      'title',
      'notes',
      'symbol'
    ]);
    if (bankingSecretInspection.prohibitedFields.length > 0 || bankingSecretInspection.panLikeValueDetected) {
      return err(invalid(input.context, 'Tam PAN, CVV/CVC, PIN ve internet bankacılığı parolası finans kaydında kabul edilmez.'));
    }
    const title = input.command.title.trim();
    if (title.length < 2) return err(invalid(input.context, 'Finans kaydı başlığı en az 2 karakter olmalıdır.'));
    if (!Number.isFinite(input.command.amount) || input.command.amount < 0) {
      return err(invalid(input.context, 'Tutar geçersiz.'));
    }
    if (
      input.command.remainingPrincipal !== undefined
      && (!Number.isFinite(input.command.remainingPrincipal) || input.command.remainingPrincipal < 0)
    ) return err(invalid(input.context, 'Kalan anapara geçersiz.'));

    const occurred = date(input.command.occurredAt, input.context, 'İşlem tarihi');
    if (!occurred.ok) return occurred;
    const due = input.command.dueAt ? date(input.command.dueAt, input.context, 'Vade tarihi') : undefined;
    if (due && !due.ok) return due;
    const ownerPersonId = asPersonId(input.command.ownerPersonId);
    const intent: FinancePolicyIntent = {
      action: 'create',
      capability: 'finance.write',
      resourceType: 'finance_record',
      resourceId: input.identifiers.recordId,
      purpose: 'finance',
      ownerPersonId,
      privacy: input.command.privacy
    };

    return this.unitOfWork.execute(input.context, intent, (scope) => {
      const person = scope.findPerson(ownerPersonId);
      if (!person.ok) return person;
      if (!person.value) return err(missing(input.context, 'Finans kaydının bağlanacağı aile üyesi bulunamadı.'));
      const authorization = scope.authorize({
        action: 'create',
        resourceType: 'finance_record',
        resourceId: input.identifiers.recordId,
        ownerPersonId,
        privacy: input.command.privacy
      });
      if (!authorization.ok) return authorization;
      if (!authorization.value) return err(denied(input.context));

      const record = {
        id: input.identifiers.recordId,
        familyId: input.context.familyId,
        ownerPersonId,
        title,
        kind: input.command.kind,
        amount: input.command.amount,
        currency: input.command.currency.trim().toUpperCase() || 'TRY',
        privacy: input.command.privacy,
        ...(input.command.notes?.trim() ? { notes: input.command.notes.trim() } : {}),
        occurredAt: occurred.value,
        ...(due?.ok ? { dueAt: due.value } : {}),
        ...(input.command.remainingPrincipal !== undefined
          ? { remainingPrincipal: input.command.remainingPrincipal }
          : {}),
        ...(input.command.symbol?.trim() ? { symbol: input.command.symbol.trim().toUpperCase() } : {}),
        createdAt: scope.occurredAt
      };
      const saved = scope.insertRecord(record);
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'finance.created',
        resourceType: 'finance_record',
        resourceId: record.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audit.ok) return audit;
      const event = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'finance.record.created',
        eventVersion: 1,
        aggregateType: 'finance_record',
        aggregateId: record.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: {
          recordId: record.id,
          ownerPersonId,
          kind: record.kind,
          amount: record.amount,
          currency: record.currency
        }
      });
      return event.ok ? ok(record) : event;
    });
  }
}

const bankAccountContractError = (
  context: FinanceApplicationContext,
  command: CreateBankAccountInput
): AppError | undefined => {
  const inspection = inspectBankAccountDataContract(command);
  if (inspection.prohibitedFields.length > 0 || inspection.panLikeValueDetected) {
    return invalid(context, 'Tam PAN, CVV/CVC, PIN ve internet bankacılığı parolası banka hesabı sözleşmesinde kesinlikle kabul edilmez.');
  }
  if (inspection.unknownFields.length > 0) {
    return invalid(context, 'Banka hesabı sözleşmesinde tanımsız alan bulunuyor.');
  }
  return undefined;
};

export class CreateBankAccountUseCase {
  public constructor(private readonly unitOfWork: FinanceUnitOfWork) {}

  public async execute(input: {
    context: FinanceApplicationContext;
    command: CreateBankAccountInput;
    identifiers: { accountId: string; auditId: string; outboxEventId: EventId };
  }): Promise<Result<BankAccountView, AppError>> {
    const contractError = bankAccountContractError(input.context, input.command);
    if (contractError) return err(contractError);
    const alias = input.command.alias.trim();
    const branch = input.command.branch?.trim();
    const institutionCode = input.command.institutionCode.trim();
    const currency = input.command.currency.trim().toUpperCase();
    if (alias.length < 2 || alias.length > 100) return err(invalid(input.context, 'Hesap adı 2-100 karakter olmalıdır.'));
    if (branch && branch.length > 120) return err(invalid(input.context, 'Şube bilgisi en fazla 120 karakter olabilir.'));
    if (!/^\d{4}$/u.test(institutionCode)) return err(invalid(input.context, 'TCMB kurum kodu dört rakam olmalıdır.'));
    if (!/^[A-Z]{3}$/u.test(currency)) return err(invalid(input.context, 'Para birimi üç büyük harfli ISO kodu olmalıdır.'));
    if (!['checking','savings','time_deposit','participation','investment','other'].includes(input.command.accountType)) {
      return err(invalid(input.context, 'Banka hesabı türü geçersiz.'));
    }
    if (!['active','inactive','closed'].includes(input.command.status)) return err(invalid(input.context, 'Banka hesabı durumu geçersiz.'));
    if (!['private','selected_members','family'].includes(input.command.privacy)) return err(invalid(input.context, 'Banka hesabı gizlilik düzeyi geçersiz.'));
    if (!Number.isInteger(input.command.ownershipBasisPoints) || input.command.ownershipBasisPoints < 1 || input.command.ownershipBasisPoints > 10_000) {
      return err(invalid(input.context, 'Sahiplik oranı 1-10.000 baz puan arasında olmalıdır.'));
    }
    if (typeof input.command.iban !== 'string' || input.command.iban.length > 64) return err(invalid(input.context, 'IBAN girdisi geçersiz.'));
    const ownerPersonId = asPersonId(input.command.ownerPersonId);
    const intent: FinancePolicyIntent = {
      action: 'create',
      capability: 'finance.write',
      resourceType: 'finance_record',
      resourceId: input.identifiers.accountId,
      purpose: 'finance',
      ownerPersonId,
      privacy: input.command.privacy
    };

    return this.unitOfWork.execute(input.context, intent, (scope) => {
      const person = scope.findPerson(ownerPersonId);
      if (!person.ok) return person;
      if (!person.value) return err(missing(input.context, 'Banka hesabının bağlanacağı aile üyesi bulunamadı.'));
      const institution = scope.findBankInstitution(institutionCode);
      if (!institution.ok) return institution;
      if (!institution.value || institution.value.status !== 'active' || !institution.value.supportsCustomerAccounts) {
        return err(missing(input.context, 'Seçilen etkin banka kurumu katalogda bulunamadı.'));
      }
      const ibanValidation = validateIbanStructure(input.command.iban, [institution.value]);
      if (!ibanValidation.structurallyValid || ibanValidation.institutionCode !== institutionCode) {
        return err(invalid(input.context, 'IBAN ülke, uzunluk, MOD 97-10, Türkiye rezerv alanı ve TCMB kurum kodu kontrollerinden geçemedi.'));
      }
      const authorization = scope.authorize({
        action: 'create',
        resourceType: 'finance_record',
        resourceId: input.identifiers.accountId,
        ownerPersonId,
        privacy: input.command.privacy
      });
      if (!authorization.ok) return authorization;
      if (!authorization.value) return err(denied(input.context));

      const normalizedIban = normalizeIban(input.command.iban);
      const account: BankAccountView & {
        familyId: FamilyId;
        ownerPersonId: PersonId;
        normalizedIban: string;
        createdAt: IsoDateTime;
      } = {
        id: input.identifiers.accountId,
        familyId: input.context.familyId,
        ownerPersonId,
        institutionCode,
        institutionOfficialName: institution.value.officialName,
        institutionIconKey: institution.value.iconKey,
        normalizedIban,
        ibanMasked: maskIban(normalizedIban),
        ibanLast4: normalizedIban.slice(-4),
        ibanCountryCode: 'TR',
        ibanProviderCode: institution.value.ibanProviderCode,
        ibanStructurallyValid: true,
        institutionMatched: true,
        accountVerification: 'not_performed',
        ownershipVerification: 'not_performed',
        accountType: input.command.accountType,
        currency,
        alias,
        ...(branch ? { branch } : {}),
        ownershipBasisPoints: input.command.ownershipBasisPoints,
        status: input.command.status,
        privacy: input.command.privacy,
        createdAt: scope.occurredAt
      };
      const saved = scope.insertBankAccount(account);
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'finance.bank_account.created',
        resourceType: 'finance_record',
        resourceId: account.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audit.ok) return audit;
      const event = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'finance.bank_account.created',
        eventVersion: 1,
        aggregateType: 'finance_record',
        aggregateId: account.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: {
          accountId: account.id,
          ownerPersonId,
          institutionCode,
          accountType: account.accountType,
          currency: account.currency,
          privacy: account.privacy
        }
      });
      if (!event.ok) return event;
      const { familyId: _familyId, normalizedIban: _normalizedIban, ...view } = account;
      return ok(view);
    });
  }
}

const paymentCardContractError = (
  context: FinanceApplicationContext,
  command: CreatePaymentCardInput
): AppError | undefined => {
  const inspection = inspectPaymentCardDataContract(command);
  if (inspection.prohibitedFields.length > 0 || inspection.panLikeValueDetected) {
    return invalid(context, 'Tam PAN, kart numarası, CVV/CVC, PIN ve internet bankacılığı parolası kart sözleşmesinde kesinlikle kabul edilmez.');
  }
  if (inspection.unknownFields.length > 0) return invalid(context, 'Kart sözleşmesinde tanımsız alan bulunuyor.');
  return undefined;
};

const finiteMoney = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1_000_000_000_000_000;

export class CreatePaymentCardUseCase {
  public constructor(private readonly unitOfWork: FinanceUnitOfWork) {}

  public async execute(input: {
    context: FinanceApplicationContext;
    command: CreatePaymentCardInput;
    identifiers: { cardId: string; auditId: string; outboxEventId: EventId };
  }): Promise<Result<PaymentCardView, AppError>> {
    const contractError = paymentCardContractError(input.context, input.command);
    if (contractError) return err(contractError);
    const productName = input.command.productName.trim();
    const institutionCode = input.command.institutionCode.trim();
    const currency = input.command.currency.trim().toUpperCase();
    if (productName.length < 2 || productName.length > 120) return err(invalid(input.context, 'Kart ürün adı 2-120 karakter olmalıdır.'));
    if (!/^\d{4}$/u.test(institutionCode)) return err(invalid(input.context, 'TCMB kurum kodu dört rakam olmalıdır.'));
    if (!/^\d{4}$/u.test(input.command.last4)) return err(invalid(input.context, 'Kart için yalnız dört haneli son bölüm kabul edilir.'));
    if (!/^[A-Z]{3}$/u.test(currency)) return err(invalid(input.context, 'Kart para birimi üç büyük harfli ISO kodu olmalıdır.'));
    if (!['credit','debit','prepaid'].includes(input.command.kind)) return err(invalid(input.context, 'Kart türü geçersiz.'));
    if (!['troy','visa','mastercard','american_express','unionpay','other'].includes(input.command.network)) return err(invalid(input.context, 'Kart ağı geçersiz.'));
    if (!['physical','virtual','supplementary'].includes(input.command.formFactor)) return err(invalid(input.context, 'Kart biçimi geçersiz.'));
    if (!['none','minimum','full'].includes(input.command.automaticPaymentMode)) return err(invalid(input.context, 'Otomatik ödeme modu geçersiz.'));
    if (!['active','frozen','closed'].includes(input.command.status)) return err(invalid(input.context, 'Kart durumu geçersiz.'));
    if (!['private','selected_members','family'].includes(input.command.privacy)) return err(invalid(input.context, 'Kart gizlilik düzeyi geçersiz.'));
    const moneyValues = [
      input.command.creditLimit,
      input.command.availableLimit,
      input.command.currentDebt,
      input.command.statementBalance,
      input.command.installmentOutstandingAmount,
      input.command.rewardPoints,
      input.command.rewardMiles,
      input.command.annualFeeAmount
    ];
    if (!moneyValues.every(finiteMoney)) return err(invalid(input.context, 'Kart tutarları sonlu, negatif olmayan ve güvenli sınır içinde olmalıdır.'));
    if (input.command.availableLimit > input.command.creditLimit) return err(invalid(input.context, 'Kullanılabilir limit toplam kart limitini aşamaz.'));
    if (!Number.isInteger(input.command.activeInstallmentCount) || input.command.activeInstallmentCount < 0 || input.command.activeInstallmentCount > 999) {
      return err(invalid(input.context, 'Aktif taksit sayısı 0-999 arasında tam sayı olmalıdır.'));
    }
    if ((input.command.activeInstallmentCount === 0) !== (input.command.installmentOutstandingAmount === 0)) {
      return err(invalid(input.context, 'Taksit sayısı ile kalan taksit tutarı birlikte sıfır veya birlikte pozitif olmalıdır.'));
    }
    if (!Number.isInteger(input.command.utilizationAlertBasisPoints) || input.command.utilizationAlertBasisPoints < 1 || input.command.utilizationAlertBasisPoints > 10_000) {
      return err(invalid(input.context, 'Limit kullanım uyarısı 1-10.000 baz puan arasında olmalıdır.'));
    }
    if (!Number.isInteger(input.command.paymentDueAlertDays) || input.command.paymentDueAlertDays < 0 || input.command.paymentDueAlertDays > 365) {
      return err(invalid(input.context, 'Son ödeme uyarısı 0-365 gün arasında olmalıdır.'));
    }
    if (typeof input.command.alertsEnabled !== 'boolean') return err(invalid(input.context, 'Kart uyarı durumu boolean olmalıdır.'));
    const statementClosingAt = date(input.command.statementClosingAt, input.context, 'Ekstre kesim tarihi');
    if (!statementClosingAt.ok) return statementClosingAt;
    const paymentDueAt = date(input.command.paymentDueAt, input.context, 'Son ödeme tarihi');
    if (!paymentDueAt.ok) return paymentDueAt;
    if (paymentDueAt.value < statementClosingAt.value) return err(invalid(input.context, 'Son ödeme tarihi ekstre kesim tarihinden önce olamaz.'));
    const annualFeeDueAt = input.command.annualFeeDueAt
      ? date(input.command.annualFeeDueAt, input.context, 'Yıllık ücret tarihi')
      : undefined;
    if (annualFeeDueAt && !annualFeeDueAt.ok) return annualFeeDueAt;
    if (input.command.annualFeeAmount > 0 && !annualFeeDueAt) return err(invalid(input.context, 'Yıllık ücret pozitifse ücret tarihi zorunludur.'));
    const ownerPersonId = asPersonId(input.command.ownerPersonId);
    const intent: FinancePolicyIntent = {
      action: 'create',
      capability: 'finance.write',
      resourceType: 'finance_record',
      resourceId: input.identifiers.cardId,
      purpose: 'finance',
      ownerPersonId,
      privacy: input.command.privacy
    };

    return this.unitOfWork.execute(input.context, intent, (scope) => {
      const person = scope.findPerson(ownerPersonId);
      if (!person.ok) return person;
      if (!person.value) return err(missing(input.context, 'Kartın bağlanacağı aile üyesi bulunamadı.'));
      const institution = scope.findBankInstitution(institutionCode);
      if (!institution.ok) return institution;
      if (!institution.value || institution.value.status !== 'active' || !institution.value.supportsCustomerAccounts) {
        return err(missing(input.context, 'Seçilen etkin kart kurumu katalogda bulunamadı.'));
      }
      const authorization = scope.authorize({
        action: 'create',
        resourceType: 'finance_record',
        resourceId: input.identifiers.cardId,
        ownerPersonId,
        privacy: input.command.privacy
      });
      if (!authorization.ok) return authorization;
      if (!authorization.value) return err(denied(input.context));
      const card: PaymentCardView & {
        familyId: FamilyId;
        ownerPersonId: PersonId;
        statementClosingAt: IsoDateTime;
        paymentDueAt: IsoDateTime;
        annualFeeDueAt?: IsoDateTime;
        createdAt: IsoDateTime;
      } = {
        id: input.identifiers.cardId,
        familyId: input.context.familyId,
        ownerPersonId,
        institutionCode,
        institutionOfficialName: institution.value.officialName,
        institutionIconKey: institution.value.iconKey,
        productName,
        kind: input.command.kind,
        network: input.command.network,
        formFactor: input.command.formFactor,
        last4: input.command.last4,
        currency,
        creditLimit: input.command.creditLimit,
        availableLimit: input.command.availableLimit,
        currentDebt: input.command.currentDebt,
        statementBalance: input.command.statementBalance,
        statementClosingAt: statementClosingAt.value,
        paymentDueAt: paymentDueAt.value,
        activeInstallmentCount: input.command.activeInstallmentCount,
        installmentOutstandingAmount: input.command.installmentOutstandingAmount,
        automaticPaymentMode: input.command.automaticPaymentMode,
        rewardPoints: input.command.rewardPoints,
        rewardMiles: input.command.rewardMiles,
        annualFeeAmount: input.command.annualFeeAmount,
        ...(annualFeeDueAt?.ok ? { annualFeeDueAt: annualFeeDueAt.value } : {}),
        alertsEnabled: input.command.alertsEnabled,
        utilizationAlertBasisPoints: input.command.utilizationAlertBasisPoints,
        paymentDueAlertDays: input.command.paymentDueAlertDays,
        status: input.command.status,
        privacy: input.command.privacy,
        createdAt: scope.occurredAt
      };
      const saved = scope.insertPaymentCard(card);
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'finance.payment_card.created',
        resourceType: 'finance_record',
        resourceId: card.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audit.ok) return audit;
      const event = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'finance.payment_card.created',
        eventVersion: 1,
        aggregateType: 'finance_record',
        aggregateId: card.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: {
          cardId: card.id,
          ownerPersonId,
          institutionCode,
          kind: card.kind,
          formFactor: card.formFactor,
          currency: card.currency,
          privacy: card.privacy
        }
      });
      if (!event.ok) return event;
      const { familyId: _familyId, ...view } = card;
      return ok(view);
    });
  }
}

const loanContractError = (
  context: FinanceApplicationContext,
  command: CreateLoanAccountInput
): AppError | undefined => {
  const inspection = inspectLoanAccountDataContract(command);
  if (inspection.prohibitedFields.length > 0 || inspection.panLikeValueDetected) {
    return invalid(context, 'Tam PAN, kart sırrı, PIN ve internet bankacılığı parolası kredi sözleşmesinde kabul edilmez.');
  }
  if (inspection.unknownFields.length > 0) return invalid(context, 'Kredi sözleşmesinde tanımsız alan bulunuyor.');
  return undefined;
};

const loanPaymentContractError = (
  context: FinanceApplicationContext,
  command: RecordLoanPaymentInput
): AppError | undefined => {
  const inspection = inspectLoanPaymentDataContract(command);
  if (inspection.prohibitedFields.length > 0 || inspection.panLikeValueDetected) {
    return invalid(context, 'Tam PAN, kart sırrı, PIN ve internet bankacılığı parolası ödeme geçmişinde kabul edilmez.');
  }
  if (inspection.unknownFields.length > 0) return invalid(context, 'Kredi ödeme sözleşmesinde tanımsız alan bulunuyor.');
  return undefined;
};

const addCalendarMonths = (value: IsoDateTime, months: number): IsoDateTime => {
  const target = new Date(value);
  const originalDay = target.getUTCDate();
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(originalDay, lastDay));
  return asIsoDateTime(target.toISOString());
};

const equalMoney = (left: number, right: number): boolean =>
  Math.round(left * 100) === Math.round(right * 100);

export class CreateLoanAccountUseCase {
  public constructor(private readonly unitOfWork: FinanceUnitOfWork) {}

  public async execute(input: {
    context: FinanceApplicationContext;
    command: CreateLoanAccountInput;
    identifiers: { loanId: string; auditId: string; outboxEventId: EventId };
  }): Promise<Result<LoanAccountView, AppError>> {
    const contractError = loanContractError(input.context, input.command);
    if (contractError) return err(contractError);
    const institutionCode = input.command.institutionCode.trim();
    const title = input.command.title.trim();
    const currency = input.command.currency.trim().toUpperCase();
    const insuranceProvider = input.command.insuranceProvider?.trim();
    const insurancePolicyReference = input.command.insurancePolicyReference?.trim();
    const collateralDescription = input.command.collateralDescription?.trim();
    if (!/^\d{4}$/u.test(institutionCode)) return err(invalid(input.context, 'TCMB kurum kodu dört rakam olmalıdır.'));
    if (title.length < 2 || title.length > 120) return err(invalid(input.context, 'Kredi başlığı 2-120 karakter olmalıdır.'));
    if (!/^[A-Z]{3}$/u.test(currency)) return err(invalid(input.context, 'Kredi para birimi üç büyük harfli ISO kodu olmalıdır.'));
    if (!['consumer','mortgage','vehicle','other'].includes(input.command.kind)) return err(invalid(input.context, 'Kredi türü geçersiz.'));
    if (!['fixed','variable','profit_share','interest_free'].includes(input.command.rateType)) return err(invalid(input.context, 'Kredi oran türü geçersiz.'));
    if (!['active','overdue','restructured','closed'].includes(input.command.status)) return err(invalid(input.context, 'Kredi durumu geçersiz.'));
    if (!['none','active','expired','cancelled'].includes(input.command.insuranceStatus)) return err(invalid(input.context, 'Kredi sigorta durumu geçersiz.'));
    if (!['none','vehicle','real_estate','deposit','guarantee','other'].includes(input.command.collateralType)) return err(invalid(input.context, 'Kredi teminat türü geçersiz.'));
    if (!['private','selected_members','family'].includes(input.command.privacy)) return err(invalid(input.context, 'Kredi gizlilik düzeyi geçersiz.'));
    if (!Number.isInteger(input.command.annualRateBasisPoints) || input.command.annualRateBasisPoints < 0 || input.command.annualRateBasisPoints > 100_000) {
      return err(invalid(input.context, 'Yıllık oran 0-100.000 baz puan arasında tam sayı olmalıdır.'));
    }
    if (input.command.rateType === 'interest_free' && input.command.annualRateBasisPoints !== 0) {
      return err(invalid(input.context, 'Faizsiz kredi oranı sıfır olmalıdır.'));
    }
    if (!Number.isInteger(input.command.termMonths) || input.command.termMonths < 1 || input.command.termMonths > 600) {
      return err(invalid(input.context, 'Kredi vadesi 1-600 ay arasında tam sayı olmalıdır.'));
    }
    const moneyValues = [
      input.command.originalPrincipal,
      input.command.installmentAmount,
      input.command.remainingPrincipal,
      input.command.earlySettlementAmount,
      input.command.overdueAmount,
      input.command.insurancePremiumAmount,
      input.command.collateralEstimatedValue
    ];
    if (!moneyValues.every(finiteMoney)) return err(invalid(input.context, 'Kredi tutarları sonlu, negatif olmayan ve güvenli sınır içinde olmalıdır.'));
    if (input.command.originalPrincipal <= 0 || input.command.installmentAmount <= 0) return err(invalid(input.context, 'Kredi anaparası ve taksit tutarı pozitif olmalıdır.'));
    if (input.command.remainingPrincipal > input.command.originalPrincipal) return err(invalid(input.context, 'Kalan anapara ilk anaparayı aşamaz.'));
    if ((input.command.installmentAmount * input.command.termMonths) + 0.01 < input.command.originalPrincipal) {
      return err(invalid(input.context, 'Ödeme planı toplamı ilk anaparadan düşük olamaz.'));
    }
    if (!Number.isInteger(input.command.overdueInstallmentCount) || input.command.overdueInstallmentCount < 0 || input.command.overdueInstallmentCount > 600) {
      return err(invalid(input.context, 'Gecikmiş taksit sayısı 0-600 arasında tam sayı olmalıdır.'));
    }
    if (!Number.isInteger(input.command.daysPastDue) || input.command.daysPastDue < 0 || input.command.daysPastDue > 36_500) {
      return err(invalid(input.context, 'Gecikme günü 0-36.500 arasında tam sayı olmalıdır.'));
    }
    const hasOverdue = input.command.overdueInstallmentCount > 0 || input.command.overdueAmount > 0 || input.command.daysPastDue > 0;
    if (hasOverdue && !(input.command.overdueInstallmentCount > 0 && input.command.overdueAmount > 0 && input.command.daysPastDue > 0)) {
      return err(invalid(input.context, 'Gecikme sayısı, tutarı ve günü birlikte sıfır veya birlikte pozitif olmalıdır.'));
    }
    if ((input.command.status === 'overdue') !== hasOverdue) return err(invalid(input.context, 'Kredi durumu ile gecikme alanları tutarlı olmalıdır.'));
    if (input.command.status === 'closed' && input.command.remainingPrincipal !== 0) return err(invalid(input.context, 'Kapalı kredinin kalan anaparası sıfır olmalıdır.'));
    if (input.command.status !== 'closed' && input.command.remainingPrincipal <= 0) return err(invalid(input.context, 'Açık kredinin kalan anaparası pozitif olmalıdır.'));
    const disbursedAt = date(input.command.disbursedAt, input.context, 'Kullandırım tarihi');
    if (!disbursedAt.ok) return disbursedAt;
    const firstPaymentAt = date(input.command.firstPaymentAt, input.context, 'İlk ödeme tarihi');
    if (!firstPaymentAt.ok) return firstPaymentAt;
    if (firstPaymentAt.value < disbursedAt.value) return err(invalid(input.context, 'İlk ödeme tarihi kullandırım tarihinden önce olamaz.'));
    const maturityAt = addCalendarMonths(firstPaymentAt.value, input.command.termMonths - 1);
    const earlySettlementQuotedAt = input.command.earlySettlementQuotedAt
      ? date(input.command.earlySettlementQuotedAt, input.context, 'Erken kapama teklif tarihi')
      : undefined;
    if (earlySettlementQuotedAt && !earlySettlementQuotedAt.ok) return earlySettlementQuotedAt;
    if ((input.command.earlySettlementAmount > 0) !== Boolean(earlySettlementQuotedAt)) {
      return err(invalid(input.context, 'Erken kapama tutarı ile teklif tarihi birlikte girilmelidir.'));
    }
    if (earlySettlementQuotedAt?.ok && earlySettlementQuotedAt.value < disbursedAt.value) {
      return err(invalid(input.context, 'Erken kapama teklif tarihi kullandırım tarihinden önce olamaz.'));
    }
    const insuranceEndsAt = input.command.insuranceEndsAt
      ? date(input.command.insuranceEndsAt, input.context, 'Sigorta bitiş tarihi')
      : undefined;
    if (insuranceEndsAt && !insuranceEndsAt.ok) return insuranceEndsAt;
    if (input.command.insuranceStatus === 'none') {
      if (insuranceProvider || insurancePolicyReference || input.command.insurancePremiumAmount !== 0 || insuranceEndsAt) {
        return err(invalid(input.context, 'Sigorta yoksa sağlayıcı, poliçe, prim ve bitiş alanları boş olmalıdır.'));
      }
    } else if (!insuranceProvider || insuranceProvider.length > 120
      || !insurancePolicyReference || insurancePolicyReference.length > 120
      || input.command.insurancePremiumAmount <= 0 || !insuranceEndsAt) {
      return err(invalid(input.context, 'Sigortalı kredide sağlayıcı, poliçe referansı, pozitif prim ve bitiş tarihi zorunludur.'));
    }
    if (input.command.collateralType === 'none') {
      if (collateralDescription || input.command.collateralEstimatedValue !== 0) {
        return err(invalid(input.context, 'Teminat yoksa açıklama ve tahmini değer boş olmalıdır.'));
      }
    } else if (!collateralDescription || collateralDescription.length > 240 || input.command.collateralEstimatedValue <= 0) {
      return err(invalid(input.context, 'Teminatlı kredide açıklama ve pozitif tahmini değer zorunludur.'));
    }
    const ownerPersonId = asPersonId(input.command.ownerPersonId);
    const intent: FinancePolicyIntent = {
      action: 'create',
      capability: 'finance.write',
      resourceType: 'finance_record',
      resourceId: input.identifiers.loanId,
      purpose: 'finance',
      ownerPersonId,
      privacy: input.command.privacy
    };

    return this.unitOfWork.execute(input.context, intent, (scope) => {
      const person = scope.findPerson(ownerPersonId);
      if (!person.ok) return person;
      if (!person.value) return err(missing(input.context, 'Kredinin bağlanacağı aile üyesi bulunamadı.'));
      const institution = scope.findBankInstitution(institutionCode);
      if (!institution.ok) return institution;
      if (!institution.value || institution.value.status !== 'active' || !institution.value.supportsCustomerAccounts) {
        return err(missing(input.context, 'Seçilen etkin kredi kurumu katalogda bulunamadı.'));
      }
      const authorization = scope.authorize({
        action: 'create',
        resourceType: 'finance_record',
        resourceId: input.identifiers.loanId,
        ownerPersonId,
        privacy: input.command.privacy
      });
      if (!authorization.ok) return authorization;
      if (!authorization.value) return err(denied(input.context));
      const paymentSchedule = Object.freeze(Array.from({ length: input.command.termMonths }, (_unused, index) => Object.freeze({
        sequence: index + 1,
        dueAt: addCalendarMonths(firstPaymentAt.value, index),
        scheduledAmount: input.command.installmentAmount
      })));
      const loan: LoanAccountView & {
        familyId: FamilyId;
        ownerPersonId: PersonId;
        disbursedAt: IsoDateTime;
        firstPaymentAt: IsoDateTime;
        maturityAt: IsoDateTime;
        earlySettlementQuotedAt?: IsoDateTime;
        insuranceEndsAt?: IsoDateTime;
        createdAt: IsoDateTime;
      } = {
        id: input.identifiers.loanId,
        familyId: input.context.familyId,
        ownerPersonId,
        institutionCode,
        institutionOfficialName: institution.value.officialName,
        institutionIconKey: institution.value.iconKey,
        title,
        kind: input.command.kind,
        rateType: input.command.rateType,
        annualRateBasisPoints: input.command.annualRateBasisPoints,
        termMonths: input.command.termMonths,
        currency,
        originalPrincipal: input.command.originalPrincipal,
        installmentAmount: input.command.installmentAmount,
        remainingPrincipal: input.command.remainingPrincipal,
        disbursedAt: disbursedAt.value,
        firstPaymentAt: firstPaymentAt.value,
        maturityAt,
        earlySettlementAmount: input.command.earlySettlementAmount,
        ...(earlySettlementQuotedAt?.ok ? { earlySettlementQuotedAt: earlySettlementQuotedAt.value } : {}),
        overdueInstallmentCount: input.command.overdueInstallmentCount,
        overdueAmount: input.command.overdueAmount,
        daysPastDue: input.command.daysPastDue,
        insuranceStatus: input.command.insuranceStatus,
        ...(insuranceProvider ? { insuranceProvider } : {}),
        ...(insurancePolicyReference ? { insurancePolicyReference } : {}),
        insurancePremiumAmount: input.command.insurancePremiumAmount,
        ...(insuranceEndsAt?.ok ? { insuranceEndsAt: insuranceEndsAt.value } : {}),
        collateralType: input.command.collateralType,
        ...(collateralDescription ? { collateralDescription } : {}),
        collateralEstimatedValue: input.command.collateralEstimatedValue,
        status: input.command.status,
        privacy: input.command.privacy,
        dataSource: 'manual',
        bankVerification: 'not_performed',
        paymentExecution: 'not_performed',
        paymentSchedule,
        paymentHistory: Object.freeze([]),
        createdAt: scope.occurredAt
      };
      const saved = scope.insertLoanAccount(loan);
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'finance.loan.created',
        resourceType: 'finance_record',
        resourceId: loan.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audit.ok) return audit;
      const event = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'finance.loan.created',
        eventVersion: 1,
        aggregateType: 'finance_record',
        aggregateId: loan.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: {
          loanId: loan.id,
          ownerPersonId,
          institutionCode,
          kind: loan.kind,
          rateType: loan.rateType,
          termMonths: loan.termMonths,
          currency: loan.currency,
          privacy: loan.privacy
        }
      });
      if (!event.ok) return event;
      const { familyId: _familyId, ...view } = loan;
      return ok(view);
    });
  }
}

export class RecordLoanPaymentUseCase {
  public constructor(private readonly unitOfWork: FinanceUnitOfWork) {}

  public async execute(input: {
    context: FinanceApplicationContext;
    command: RecordLoanPaymentInput;
    identifiers: { paymentId: string; auditId: string; outboxEventId: EventId };
  }): Promise<Result<LoanPaymentHistoryItemView, AppError>> {
    const contractError = loanPaymentContractError(input.context, input.command);
    if (contractError) return err(contractError);
    const loanId = input.command.loanId.trim();
    const notes = input.command.notes?.trim();
    if (loanId.length < 2 || loanId.length > 160) return err(invalid(input.context, 'Kredi kimliği geçersiz.'));
    if (notes && notes.length > 500) return err(invalid(input.context, 'Ödeme notu en fazla 500 karakter olmalıdır.'));
    const moneyValues = [input.command.amount, input.command.principalAmount, input.command.interestAmount, input.command.lateFeeAmount];
    if (!moneyValues.every(finiteMoney) || input.command.amount <= 0) return err(invalid(input.context, 'Ödeme tutarları sonlu, negatif olmayan ve toplam ödeme pozitif olacak biçimde girilmelidir.'));
    if (!equalMoney(input.command.amount, input.command.principalAmount + input.command.interestAmount + input.command.lateFeeAmount)) {
      return err(invalid(input.context, 'Ödeme toplamı anapara, oran payı ve gecikme ücretinin toplamına eşit olmalıdır.'));
    }
    if (input.command.scheduledInstallmentSequence !== undefined
      && (!Number.isInteger(input.command.scheduledInstallmentSequence)
        || input.command.scheduledInstallmentSequence < 1
        || input.command.scheduledInstallmentSequence > 600)) {
      return err(invalid(input.context, 'Bağlı taksit sırası 1-600 arasında tam sayı olmalıdır.'));
    }
    const paidAt = date(input.command.paidAt, input.context, 'Ödeme tarihi');
    if (!paidAt.ok) return paidAt;
    const intent: FinancePolicyIntent = {
      action: 'update',
      capability: 'finance.write',
      resourceType: 'finance_record',
      resourceId: loanId,
      purpose: 'finance'
    };

    return this.unitOfWork.execute(input.context, intent, (scope) => {
      const loan = scope.findLoanAccount(loanId);
      if (!loan.ok) return loan;
      if (!loan.value) return err(missing(input.context, 'Ödeme geçmişinin bağlanacağı kredi bulunamadı.'));
      if (paidAt.value < loan.value.disbursedAt || paidAt.value > scope.occurredAt) {
        return err(invalid(input.context, 'Ödeme tarihi kullandırım tarihi ile kayıt zamanı arasında olmalıdır.'));
      }
      if (input.command.scheduledInstallmentSequence !== undefined
        && input.command.scheduledInstallmentSequence > loan.value.termMonths) {
        return err(invalid(input.context, 'Bağlı taksit sırası kredi vadesini aşamaz.'));
      }
      const authorization = scope.authorize({
        action: 'update',
        resourceType: 'finance_record',
        resourceId: loan.value.id,
        ownerPersonId: loan.value.ownerPersonId,
        privacy: loan.value.privacy
      });
      if (!authorization.ok) return authorization;
      if (!authorization.value) return err(denied(input.context));
      const payment: LoanPaymentHistoryItemView & {
        familyId: FamilyId;
        ownerPersonId: PersonId;
        paidAt: IsoDateTime;
        createdAt: IsoDateTime;
      } = {
        id: input.identifiers.paymentId,
        loanId: loan.value.id,
        familyId: input.context.familyId,
        ownerPersonId: loan.value.ownerPersonId,
        paidAt: paidAt.value,
        ...(input.command.scheduledInstallmentSequence === undefined
          ? {}
          : { scheduledInstallmentSequence: input.command.scheduledInstallmentSequence }),
        amount: input.command.amount,
        principalAmount: input.command.principalAmount,
        interestAmount: input.command.interestAmount,
        lateFeeAmount: input.command.lateFeeAmount,
        ...(notes ? { notes } : {}),
        createdAt: scope.occurredAt
      };
      const saved = scope.insertLoanPayment(payment);
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'finance.loan.payment_recorded',
        resourceType: 'finance_record',
        resourceId: loan.value.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audit.ok) return audit;
      const event = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'finance.loan.payment_recorded',
        eventVersion: 1,
        aggregateType: 'finance_record',
        aggregateId: loan.value.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: {
          paymentId: payment.id,
          loanId: loan.value.id,
          ownerPersonId: loan.value.ownerPersonId,
          scheduledInstallmentSequence: payment.scheduledInstallmentSequence,
          privacy: loan.value.privacy
        }
      });
      return event.ok ? ok(payment) : event;
    });
  }
}

export class CreateFinanceValuationUseCase {
  public constructor(private readonly unitOfWork: FinanceUnitOfWork) {}

  public async execute(input: {
    context: FinanceApplicationContext;
    command: CreateFinanceValuationInput;
    identifiers: { valuationId: string; auditId: string; outboxEventId: EventId };
  }): Promise<Result<FinanceValuationView, AppError>> {
    const bankingSecretInspection = inspectProhibitedBankingSecrets(input.command, ['provider']);
    if (bankingSecretInspection.prohibitedFields.length > 0 || bankingSecretInspection.panLikeValueDetected) {
      return err(invalid(input.context, 'Tam PAN, CVV/CVC, PIN ve internet bankacılığı parolası finans değerlemesinde kabul edilmez.'));
    }
    if (
      !Number.isFinite(input.command.unitPrice)
      || input.command.unitPrice < 0
      || !Number.isFinite(input.command.quantity)
      || input.command.quantity < 0
    ) return err(invalid(input.context, 'Değerleme bilgileri geçersiz.'));
    const valueDate = date(input.command.valueDate, input.context, 'Değerleme tarihi');
    if (!valueDate.ok) return valueDate;
    const intent: FinancePolicyIntent = {
      action: 'update',
      capability: 'finance.write',
      resourceType: 'finance_record',
      resourceId: input.command.financeRecordId,
      purpose: 'finance'
    };

    return this.unitOfWork.execute(input.context, intent, (scope) => {
      const record = scope.findRecord(input.command.financeRecordId);
      if (!record.ok) return record;
      if (!record.value) return err(missing(input.context, 'Finans kaydı bulunamadı.'));
      const authorization = scope.authorize({
        action: 'update',
        resourceType: 'finance_record',
        resourceId: record.value.id,
        ownerPersonId: record.value.ownerPersonId,
        privacy: record.value.privacy
      });
      if (!authorization.ok) return authorization;
      if (!authorization.value) return err(denied(input.context));

      const valuation = {
        id: input.identifiers.valuationId,
        financeRecordId: record.value.id,
        valueDate: valueDate.value,
        unitPrice: input.command.unitPrice,
        quantity: input.command.quantity,
        marketValue: input.command.unitPrice * input.command.quantity,
        provider: input.command.provider?.trim() || 'Manuel',
        createdAt: scope.occurredAt
      };
      const saved = scope.insertValuation(valuation);
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'finance.valued',
        resourceType: 'finance_record',
        resourceId: record.value.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audit.ok) return audit;
      const event = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'finance.record.valued',
        eventVersion: 1,
        aggregateType: 'finance_record',
        aggregateId: record.value.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: {
          valuationId: valuation.id,
          financeRecordId: valuation.financeRecordId,
          marketValue: valuation.marketValue,
          valueDate: valuation.valueDate
        }
      });
      return event.ok ? ok(valuation) : event;
    });
  }
}
