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
  CreatePaymentCardInput,
  FamilyRole,
  FinanceRecordView,
  FinanceValuationView,
  IbanStructuralValidationView,
  PaymentCardView,
  RecordPrivacy
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type { AuthorizationAction } from '@ppt/security';
import {
  inspectBankAccountDataContract,
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
  validateIban(context: FinanceApplicationContext, iban: string): Promise<Result<IbanStructuralValidationView, AppError>>;
}

export interface FinanceWriteScope {
  readonly occurredAt: IsoDateTime;
  findPerson(id: PersonId): Result<{ id: PersonId } | null, AppError>;
  findRecord(id: string): Result<(FinanceRecordView & { ownerPersonId: PersonId }) | null, AppError>;
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
