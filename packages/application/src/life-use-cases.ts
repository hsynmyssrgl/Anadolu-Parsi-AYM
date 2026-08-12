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
  CreateLifeRecordInput,
  FamilyRole,
  LifeRecordView,
  LifeRecordStatus,
  ManagedHomeBelongingKind,
  ManagedHomeDocumentKind,
  ManagedHomeDocumentTargetType,
  ManagedHomeInventoryBelongingLedgerItemView,
  ManagedHomeInventoryDocumentLedgerItemView,
  ManagedHomeInventoryLedgerItemView,
  ManagedHomeInventoryMeterLedgerItemView,
  ManagedHomeInventoryMeterReadingLedgerItemView,
  ManagedHomeInventoryRoomLedgerItemView,
  ManagedHomeInventoryServiceLedgerItemView,
  ManagedHomeInventoryWarrantyLedgerItemView,
  ManagedHomeMeterKind,
  ManagedHomeMeterReadingKind,
  ManagedHomeMeterReadingUnit,
  ManagedHomeRoomKind,
  ManagedHomeServiceKind,
  ManagedHomeServiceTargetType,
  ManagedLifeActivityKind,
  ManagedLifeActivityLedgerItemView,
  ManagedLifeCategory,
  ManagedLifeCurrentReminderView,
  ManagedLifeDocumentKind,
  ManagedLifeDocumentLedgerItemView,
  ManagedLifeLedgerItemView,
  ManagedLifeProfileDetailsByCategory,
  ManagedLifeProfileLedgerItemView,
  ManagedLifeProfileView,
  ManagedLifeReminderKind,
  ManagedLifeWorkspaceView,
  RecordManagedLifeActivityInput,
  RecordManagedLifeDocumentInput,
  RecordManagedLifeItemInput,
  RecordManagedLifeProfileInput,
  RecordManagedHomeInventoryBelongingInput,
  RecordManagedHomeInventoryDocumentInput,
  RecordManagedHomeInventoryItemInput,
  RecordManagedHomeInventoryMeterInput,
  RecordManagedHomeInventoryMeterReadingInput,
  RecordManagedHomeInventoryRoomInput,
  RecordManagedHomeInventoryServiceInput,
  RecordManagedHomeInventoryWarrantyInput,
  RecordPrivacy
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type { AuthorizationAction } from '@ppt/security';
import { inspectManagedLifeDataContract } from './life-security.js';

export {
  MANAGED_LIFE_INITIAL_REMINDER_KEYS,
  MANAGED_HOME_INVENTORY_INPUT_KEYS,
  MANAGED_HOME_INVENTORY_REQUIRED_INPUT_KEYS,
  MANAGED_LIFE_INPUT_KEYS,
  MANAGED_LIFE_PROFILE_DETAIL_KEYS,
  MANAGED_LIFE_PROFILE_REQUIRED_DETAIL_KEYS,
  MANAGED_LIFE_REMINDER_MUTATION_KEYS,
  MANAGED_LIFE_REQUIRED_INPUT_KEYS,
  containsLikelyManagedLifePan,
  inspectManagedLifeDataContract,
  type ManagedLifeDataContractInspection
} from './life-security.js';

export interface LifeActorContext {
  readonly userId: UserId;
  readonly role: FamilyRole;
  readonly personId?: PersonId;
}

export interface LifeApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: LifeActorContext;
  readonly correlationId: CorrelationId;
}

export interface LifePolicyIntent {
  readonly action: 'read' | 'create' | 'update';
  readonly capability: 'family.read' | 'family.write';
  readonly resourceType: 'life_record';
  readonly resourceId: string;
  readonly purpose: 'general';
  readonly ownerPersonId?: PersonId;
  readonly privacy?: RecordPrivacy;
}

export interface LifeQueryPort {
  listLifeRecords(context: LifeApplicationContext): Promise<Result<readonly LifeRecordView[], AppError>>;
  getManagedLifeWorkspace(context: LifeApplicationContext): Promise<Result<ManagedLifeWorkspaceView, AppError>>;
}

export type ManagedLifeProfileWriteRecord = ManagedLifeProfileLedgerItemView & {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly startsAt?: IsoDateTime;
  readonly endsAt?: IsoDateTime;
  readonly initialReminder?: {
    readonly kind: ManagedLifeReminderKind;
    readonly dueAt: IsoDateTime;
  };
  readonly createdAt: IsoDateTime;
};

export type ManagedLifeActivityWriteRecord = ManagedLifeActivityLedgerItemView & {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly occurredAt: IsoDateTime;
  readonly reminderMutation?:
    | { readonly action:'set'; readonly kind:ManagedLifeReminderKind; readonly dueAt:IsoDateTime }
    | { readonly action:'clear' };
  readonly createdAt: IsoDateTime;
};

export type ManagedLifeDocumentWriteRecord = ManagedLifeDocumentLedgerItemView & {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly createdAt: IsoDateTime;
};

export type ManagedLifeWriteRecord =
  | ManagedLifeProfileWriteRecord
  | ManagedLifeActivityWriteRecord
  | ManagedLifeDocumentWriteRecord;

interface ManagedHomeInventoryWriteRecordCommon {
  readonly familyId:FamilyId;
  readonly ownerPersonId:PersonId;
  readonly recordId:string;
  readonly privacy:RecordPrivacy;
  readonly supersedesItemId?:string;
  readonly dataSource:'manual';
  readonly externalVerification:'not_performed';
  readonly paymentExecution:'not_performed';
  readonly createdAt:IsoDateTime;
}

export type ManagedHomeInventoryRoomWriteRecord =
  ManagedHomeInventoryRoomLedgerItemView & ManagedHomeInventoryWriteRecordCommon;
export type ManagedHomeInventoryMeterWriteRecord =
  ManagedHomeInventoryMeterLedgerItemView & ManagedHomeInventoryWriteRecordCommon;
export type ManagedHomeInventoryMeterReadingWriteRecord =
  Omit<ManagedHomeInventoryMeterReadingLedgerItemView, 'recordedAt'>
  & ManagedHomeInventoryWriteRecordCommon
  & { readonly recordedAt:IsoDateTime };
export type ManagedHomeInventoryBelongingWriteRecord =
  Omit<ManagedHomeInventoryBelongingLedgerItemView, 'createdAt'|'purchasedAt'>
  & ManagedHomeInventoryWriteRecordCommon
  & { readonly serialNumber?:string; readonly purchasedAt?:IsoDateTime };
export type ManagedHomeInventoryWarrantyWriteRecord =
  Omit<ManagedHomeInventoryWarrantyLedgerItemView, 'startsAt'|'endsAt'|'reminderAt'>
  & ManagedHomeInventoryWriteRecordCommon
  & { readonly startsAt:IsoDateTime; readonly endsAt:IsoDateTime; readonly reminderAt?:IsoDateTime };
export type ManagedHomeInventoryServiceWriteRecord =
  Omit<ManagedHomeInventoryServiceLedgerItemView, 'occurredAt'>
  & ManagedHomeInventoryWriteRecordCommon
  & { readonly occurredAt:IsoDateTime };
export type ManagedHomeInventoryDocumentWriteRecord =
  ManagedHomeInventoryDocumentLedgerItemView & ManagedHomeInventoryWriteRecordCommon;
export type ManagedHomeInventoryWriteRecord =
  | ManagedHomeInventoryRoomWriteRecord
  | ManagedHomeInventoryMeterWriteRecord
  | ManagedHomeInventoryMeterReadingWriteRecord
  | ManagedHomeInventoryBelongingWriteRecord
  | ManagedHomeInventoryWarrantyWriteRecord
  | ManagedHomeInventoryServiceWriteRecord
  | ManagedHomeInventoryDocumentWriteRecord;

export interface LifeWriteScope {
  readonly occurredAt: IsoDateTime;
  findPerson(personId: PersonId): Result<{ readonly id: PersonId } | null, AppError>;
  authorize(input: {
    readonly action: AuthorizationAction;
    readonly resourceType: 'life_record';
    readonly resourceId: string;
    readonly ownerPersonId: PersonId;
    readonly privacy: RecordPrivacy;
  }): Result<boolean, AppError>;
  insertLifeRecord(record: LifeRecordView & {
    readonly familyId: FamilyId;
    readonly ownerPersonId: PersonId;
    readonly startsAt?: IsoDateTime;
    readonly dueAt?: IsoDateTime;
    readonly createdAt: IsoDateTime;
  }): Result<void, AppError>;
  findManagedLifeProfile(id: string): Result<ManagedLifeProfileWriteRecord | null, AppError>;
  insertManagedLifeItem(record: ManagedLifeWriteRecord): Result<void, AppError>;
  findManagedHomeInventoryItem(id: string): Result<ManagedHomeInventoryWriteRecord | null, AppError>;
  findLatestManagedHomeMeterReading(
    recordId:string,
    meterId:string
  ): Result<ManagedHomeInventoryMeterReadingWriteRecord | null, AppError>;
  insertManagedHomeInventoryItem(record: ManagedHomeInventoryWriteRecord): Result<void, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: IsoDateTime;
    readonly actorId: UserId;
  }): Result<string, AppError>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
}

export interface LifeUnitOfWork {
  execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: LifeWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

const invalid = (context: LifeApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT,
  message,
  category: 'validation',
  correlationId: context.correlationId
});

const denied = (context: LifeApplicationContext): AppError => createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message: 'Bu yaşam kaydı işlemi için yetkiniz bulunmuyor.',
  category: 'authorization',
  correlationId: context.correlationId
});

const missing = (context: LifeApplicationContext): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_NOT_FOUND,
  message: 'Yaşam kaydının bağlanacağı aile üyesi bulunamadı.',
  category: 'not_found',
  correlationId: context.correlationId
});

const normalizeOptionalDate = (
  value: string | undefined,
  context: LifeApplicationContext,
  label: string
): Result<IsoDateTime | undefined, AppError> => {
  if (!value) return ok(undefined);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? err(invalid(context, label + ' geçersiz.'))
    : ok(asIsoDateTime(parsed.toISOString()));
};

export class ListLifeRecordsUseCase {
  public constructor(private readonly query: LifeQueryPort) {}

  public execute(context: LifeApplicationContext): ReturnType<LifeQueryPort['listLifeRecords']> {
    return this.query.listLifeRecords(context);
  }
}

export class CreateLifeRecordUseCase {
  public constructor(private readonly unitOfWork: LifeUnitOfWork) {}

  public execute(input: {
    readonly context: LifeApplicationContext;
    readonly command: CreateLifeRecordInput;
    readonly identifiers: {
      readonly recordId: string;
      readonly auditId: string;
      readonly outboxEventId: EventId;
    };
  }): Promise<Result<LifeRecordView, AppError>> {
    const title = input.command.title.trim();
    if (title.length < 2) {
      return Promise.resolve(err(invalid(input.context, 'Yaşam kaydı başlığı en az 2 karakter olmalıdır.')));
    }
    const starts = normalizeOptionalDate(input.command.startsAt, input.context, 'Başlangıç tarihi');
    if (!starts.ok) return Promise.resolve(starts);
    const due = normalizeOptionalDate(input.command.dueAt, input.context, 'Vade tarihi');
    if (!due.ok) return Promise.resolve(due);
    if (starts.value && due.value && Date.parse(due.value) < Date.parse(starts.value)) {
      return Promise.resolve(err(invalid(input.context, 'Vade tarihi başlangıç tarihinden önce olamaz.')));
    }
    if (
      input.command.amount !== undefined
      && (!Number.isFinite(input.command.amount) || input.command.amount < 0)
    ) {
      return Promise.resolve(err(invalid(input.context, 'Tutar sıfırdan küçük olamaz.')));
    }

    const ownerPersonId = asPersonId(input.command.ownerPersonId);
    const intent: LifePolicyIntent = {
      action: 'create',
      capability: 'family.write',
      resourceType: 'life_record',
      resourceId: input.identifiers.recordId,
      purpose: 'general',
      ownerPersonId,
      privacy: input.command.privacy
    };
    return this.unitOfWork.execute(input.context, intent, (scope) => {
      const person = scope.findPerson(ownerPersonId);
      if (!person.ok) return person;
      if (!person.value) return err(missing(input.context));
      const authorization = scope.authorize({
        action: 'create',
        resourceType: 'life_record',
        resourceId: input.identifiers.recordId,
        ownerPersonId,
        privacy: input.command.privacy
      });
      if (!authorization.ok) return authorization;
      if (!authorization.value) return err(denied(input.context));

      const record: LifeRecordView & {
        readonly familyId: FamilyId;
        readonly ownerPersonId: PersonId;
        readonly startsAt?: IsoDateTime;
        readonly dueAt?: IsoDateTime;
        readonly createdAt: IsoDateTime;
      } = {
        id: input.identifiers.recordId,
        familyId: input.context.familyId,
        ownerPersonId,
        category: input.command.category,
        title,
        status: input.command.status,
        privacy: input.command.privacy,
        ...(starts.value ? { startsAt: starts.value } : {}),
        ...(due.value ? { dueAt: due.value } : {}),
        ...(input.command.provider?.trim() ? { provider: input.command.provider.trim() } : {}),
        ...(input.command.referenceNo?.trim() ? { referenceNo: input.command.referenceNo.trim() } : {}),
        ...(input.command.amount !== undefined ? { amount: input.command.amount } : {}),
        ...(input.command.currency?.trim()
          ? { currency: input.command.currency.trim().toUpperCase() }
          : {}),
        ...(input.command.location?.trim() ? { location: input.command.location.trim() } : {}),
        ...(input.command.notes?.trim() ? { notes: input.command.notes.trim() } : {}),
        createdAt: scope.occurredAt
      };
      const saved = scope.insertLifeRecord(record);
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'life_record.created',
        resourceType: 'life_record',
        resourceId: record.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audit.ok) return audit;
      const event = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'life.record.created',
        eventVersion: 1,
        aggregateType: 'life_record',
        aggregateId: record.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: {
          recordId: record.id,
          ownerPersonId,
          category: record.category,
          status: record.status,
          privacy: record.privacy
        }
      });
      return event.ok ? ok(record) : event;
    });
  }
}

const managedLifeStatuses = new Set<LifeRecordStatus>([
  'planned','active','completed','expired','cancelled'
]);
const managedLifePrivacies = new Set<RecordPrivacy>(['private','selected_members','family']);
const managedLifeCategories = new Set<ManagedLifeCategory>([
  'insurance','subscription','education','employment','official_operation','home','vehicle'
]);
const managedLifeReminderKinds = new Set<ManagedLifeReminderKind>([
  'renewal','expiry','payment','term','contract_end','official_deadline',
  'rent','insurance','inspection','maintenance','other'
]);
const managedLifeActivityKinds = new Set<ManagedLifeActivityKind>([
  'renewal','rent_payment','insurance_premium','inspection','maintenance',
  'service','fuel','charging','expense'
]);
const managedLifeDocumentKinds = new Set<ManagedLifeDocumentKind>([
  'policy','contract','certificate','application_receipt','invoice','lease','deed',
  'dask_policy','home_insurance_policy','vehicle_registration','vehicle_insurance_policy',
  'inspection_report','service_receipt','fuel_receipt','charging_receipt','other'
]);
const managedLifeReminderMatrix: Readonly<Record<ManagedLifeCategory, ReadonlySet<ManagedLifeReminderKind>>> = {
  insurance: new Set(['renewal','expiry','payment','insurance','other']),
  subscription: new Set(['renewal','payment','contract_end','other']),
  education: new Set(['term','payment','expiry','other']),
  employment: new Set(['contract_end','expiry','other']),
  official_operation: new Set(['official_deadline','renewal','expiry','other']),
  home: new Set(['rent','insurance','renewal','expiry','payment','maintenance','other']),
  vehicle: new Set(['insurance','inspection','maintenance','renewal','expiry','payment','other'])
};
const managedLifeActivityMatrix: Readonly<Record<ManagedLifeActivityKind, ReadonlySet<ManagedLifeCategory>>> = {
  renewal: new Set(managedLifeCategories),
  rent_payment: new Set(['home']),
  insurance_premium: new Set(['insurance','home','vehicle']),
  inspection: new Set(['vehicle']),
  maintenance: new Set(['home','vehicle']),
  service: new Set(['home','vehicle']),
  fuel: new Set(['vehicle']),
  charging: new Set(['vehicle']),
  expense: new Set(managedLifeCategories)
};
const managedLifeDocumentMatrix: Readonly<Record<ManagedLifeCategory, ReadonlySet<ManagedLifeDocumentKind>>> = {
  insurance: new Set(['policy','contract','certificate','application_receipt','invoice','other']),
  subscription: new Set(['contract','application_receipt','invoice','other']),
  education: new Set(['contract','certificate','application_receipt','invoice','other']),
  employment: new Set(['contract','certificate','application_receipt','other']),
  official_operation: new Set(['certificate','application_receipt','invoice','other']),
  home: new Set(['contract','invoice','lease','deed','dask_policy','home_insurance_policy','service_receipt','other']),
  vehicle: new Set([
    'invoice','vehicle_registration','vehicle_insurance_policy','inspection_report',
    'service_receipt','fuel_receipt','charging_receipt','other'
  ])
};
const MAX_MANAGED_LIFE_INTEGER = 9_000_000_000_000_000;
const EXACT_ISO_DATE_TIME = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/u;

export const isExactManagedLifeIsoDateTime = (value: unknown): value is string => {
  if (typeof value !== 'string' || !EXACT_ISO_DATE_TIME.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

const managedLifeDate = (
  value: unknown,
  context: LifeApplicationContext,
  label: string
): Result<IsoDateTime, AppError> => isExactManagedLifeIsoDateTime(value)
  ? ok(asIsoDateTime(value))
  : err(invalid(context, `${label} tam UTC ISO-8601 biçiminde olmalıdır.`));

const managedLifeText = (value: unknown, minimum: number, maximum: number): value is string =>
  typeof value === 'string'
  && value.trim().length >= minimum
  && value.trim().length <= maximum;

const managedLifeId = (value: unknown): value is string =>
  typeof value === 'string'
  && value === value.trim()
  && value.length >= 2
  && value.length <= 160
  && !/[\\/\0]/u.test(value);

const managedLifeInteger = (value: unknown, minimum = 0): value is number =>
  typeof value === 'number'
  && Number.isSafeInteger(value)
  && value >= minimum
  && value <= MAX_MANAGED_LIFE_INTEGER;

const optionalManagedLifeText = (value: unknown, maximum: number): boolean =>
  value === undefined || managedLifeText(value, 1, maximum);

const managedLifeCurrency = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z]{3}$/u.test(value);

const managedHomeRoomKinds = new Set<ManagedHomeRoomKind>([
  'living_room','bedroom','kitchen','bathroom','storage','garage','garden','other'
]);
const managedHomeMeterKinds = new Set<ManagedHomeMeterKind>([
  'electricity','water','natural_gas','other'
]);
const managedHomeMeterReadingKinds = new Set<ManagedHomeMeterReadingKind>([
  'reading','reset','replacement'
]);
const managedHomeBelongingKinds = new Set<ManagedHomeBelongingKind>([
  'appliance','electronics','furniture','tool','other'
]);
const managedHomeServiceTargetTypes = new Set<ManagedHomeServiceTargetType>([
  'room','meter','belonging'
]);
const managedHomeServiceKinds = new Set<ManagedHomeServiceKind>([
  'maintenance','repair','inspection','installation','other'
]);
const managedHomeDocumentTargetTypes = new Set<ManagedHomeDocumentTargetType>([
  'meter','belonging','warranty','service'
]);
const managedHomeDocumentKinds = new Set<ManagedHomeDocumentKind>([
  'invoice','warranty','service_receipt','meter_document','other'
]);
const managedHomeMeterUnitMatrix: Readonly<Record<ManagedHomeMeterKind, ManagedHomeMeterReadingUnit>> = {
  electricity: 'wh',
  water: 'milliliter',
  natural_gas: 'milliliter_cubic_meter_equivalent',
  other: 'custom_milliunit'
};

const managedHomeSerial = (value: unknown): value is string =>
  managedLifeText(value, 2, 160)
  && /^[\p{L}\p{N}][\p{L}\p{N} ._:/+()-]*$/u.test(value.trim());

export const maskManagedHomeSerial = (value:string): string => {
  const normalized = value.trim();
  if (normalized.length <= 4) return '*'.repeat(normalized.length);
  return `${'*'.repeat(Math.min(12, normalized.length - 4))}${normalized.slice(-4)}`;
};

const managedHomeOptionalId = (value: unknown): boolean =>
  value === undefined || managedLifeId(value);

const managedHomeAmount = (input: {
  readonly amountMinor?:number | undefined;
  readonly currency?:string | undefined;
  readonly financeExpenseId?:string | undefined;
}): boolean => {
  const hasAmount = input.amountMinor !== undefined;
  const hasCurrency = input.currency !== undefined;
  if (input.financeExpenseId !== undefined) {
    return managedLifeId(input.financeExpenseId) && !hasAmount && !hasCurrency;
  }
  return hasAmount === hasCurrency
    && (!hasAmount || (managedLifeInteger(input.amountMinor, 1) && managedLifeCurrency(input.currency)));
};

const isManagedHomeInventoryCommand = (
  command:RecordManagedLifeItemInput,
  inspection:ReturnType<typeof inspectManagedLifeDataContract>
): command is RecordManagedHomeInventoryItemInput => inspection.contractFamily === 'home_inventory';

const validateManagedHomeInventoryCommand = (
  context:LifeApplicationContext,
  command:RecordManagedHomeInventoryItemInput
): Result<void, AppError> => {
  if (!managedLifeId(command.recordId)
    || !managedHomeOptionalId(command.supersedesItemId)) {
    return err(invalid(context, 'Ev envanteri kök veya supersede kimliği geçersiz.'));
  }
  switch (command.itemType) {
    case 'room':
      return managedLifeText(command.name, 1, 120) && managedHomeRoomKinds.has(command.roomKind)
        ? ok(undefined)
        : err(invalid(context, 'Oda adı veya türü geçersiz.'));
    case 'meter':
      return managedHomeOptionalId(command.roomId)
        && managedLifeText(command.label, 1, 120)
        && managedHomeMeterKinds.has(command.meterKind)
        && command.readingUnit === managedHomeMeterUnitMatrix[command.meterKind]
        ? ok(undefined)
        : err(invalid(context, 'Sayaç alanı, türü veya ölçü birimi geçersiz.'));
    case 'meter_reading': {
      if (!managedLifeId(command.meterId)
        || !managedHomeMeterReadingKinds.has(command.readingKind)
        || !managedLifeInteger(command.readingMilliunits)
        || !optionalManagedLifeText(command.note, 240)
        || (command.readingKind !== 'reading' && !managedLifeText(command.note, 2, 240))) {
        return err(invalid(context, 'Sayaç okuması veya reset/değişim açıklaması geçersiz.'));
      }
      return managedLifeDate(command.recordedAt, context, 'Sayaç okuma tarihi').ok
        ? ok(undefined)
        : err(invalid(context, 'Sayaç okuma tarihi tam UTC ISO-8601 biçiminde olmalıdır.'));
    }
    case 'belonging': {
      if (!managedHomeOptionalId(command.roomId)
        || !managedLifeText(command.name, 1, 120)
        || !managedHomeBelongingKinds.has(command.belongingKind)
        || (command.serialNumber !== undefined && !managedHomeSerial(command.serialNumber))
        || !managedHomeAmount({
          amountMinor: command.purchaseAmountMinor,
          currency: command.currency,
          financeExpenseId: command.financeExpenseId
        })) {
        return err(invalid(context, 'Eşya alanı, seri veya finans bağlantısı geçersiz.'));
      }
      if (command.purchasedAt !== undefined && !isExactManagedLifeIsoDateTime(command.purchasedAt)) {
        return err(invalid(context, 'Satın alma tarihi tam UTC ISO-8601 biçiminde olmalıdır.'));
      }
      return ok(undefined);
    }
    case 'warranty': {
      if (!managedLifeId(command.belongingId)
        || !optionalManagedLifeText(command.provider, 160)
        || !optionalManagedLifeText(command.note, 500)
        || !isExactManagedLifeIsoDateTime(command.startsAt)
        || !isExactManagedLifeIsoDateTime(command.endsAt)
        || command.endsAt < command.startsAt
        || (command.reminderAt !== undefined
          && (!isExactManagedLifeIsoDateTime(command.reminderAt)
            || command.reminderAt < command.startsAt
            || command.reminderAt > command.endsAt))) {
        return err(invalid(context, 'Garanti tarihleri, sağlayıcısı veya açıklaması geçersiz.'));
      }
      return ok(undefined);
    }
    case 'service':
      if (!managedLifeId(command.targetItemId)
        || !managedHomeServiceTargetTypes.has(command.targetType)
        || !managedHomeServiceKinds.has(command.serviceKind)
        || !isExactManagedLifeIsoDateTime(command.occurredAt)
        || !optionalManagedLifeText(command.provider, 160)
        || !optionalManagedLifeText(command.note, 500)
        || !managedHomeAmount(command)) {
        return err(invalid(context, 'Servis alanı, tarihi veya finans bağlantısı geçersiz.'));
      }
      return ok(undefined);
    case 'document':
      return managedLifeId(command.targetItemId)
        && managedHomeDocumentTargetTypes.has(command.targetType)
        && managedLifeId(command.archiveItemId)
        && managedHomeDocumentKinds.has(command.documentKind)
        && optionalManagedLifeText(command.label, 120)
        ? ok(undefined)
        : err(invalid(context, 'Ev envanteri belge bağlantısı geçersiz.'));
  }
};

const validateManagedProfileDetails = (command: RecordManagedLifeProfileInput): boolean => {
  const details = command.details as unknown as Record<string, unknown>;
  switch (command.category) {
    case 'insurance':
      return ['dask','home','vehicle_compulsory','vehicle_comprehensive','other'].includes(String(details.insuranceKind))
        && managedLifeText(details.provider, 1, 160);
    case 'subscription':
      return managedLifeText(details.provider, 1, 160)
        && managedLifeText(details.planName, 1, 120)
        && ['monthly','quarterly','yearly','other'].includes(String(details.billingCycle));
    case 'education':
      return managedLifeText(details.institution, 1, 160)
        && managedLifeText(details.program, 1, 160);
    case 'employment':
      return managedLifeText(details.employer, 1, 160)
        && managedLifeText(details.position, 1, 120);
    case 'official_operation':
      return managedLifeText(details.authority, 1, 160)
        && managedLifeText(details.operationType, 1, 120);
    case 'home':
      return ['owner','tenant'].includes(String(details.tenure))
        && ['residence','workplace','land','other'].includes(String(details.propertyType))
        && managedLifeText(details.addressLabel, 1, 240);
    case 'vehicle':
      return ['car','motorcycle','commercial','other'].includes(String(details.vehicleType))
        && ['fuel','electric','hybrid','other'].includes(String(details.energyType))
        && (details.plate === undefined
          || (managedLifeText(details.plate, 2, 20) && /^[\p{L}\p{N} -]+$/u.test(details.plate.trim())));
  }
  return false;
};

const normalizeManagedProfileDetails = (
  command: RecordManagedLifeProfileInput
): ManagedLifeProfileDetailsByCategory[ManagedLifeCategory] => {
  switch (command.category) {
    case 'insurance': return {
      insuranceKind: command.details.insuranceKind,
      provider: command.details.provider.trim()
    };
    case 'subscription': return {
      provider: command.details.provider.trim(),
      planName: command.details.planName.trim(),
      billingCycle: command.details.billingCycle
    };
    case 'education': return {
      institution: command.details.institution.trim(),
      program: command.details.program.trim()
    };
    case 'employment': return {
      employer: command.details.employer.trim(),
      position: command.details.position.trim()
    };
    case 'official_operation': return {
      authority: command.details.authority.trim(),
      operationType: command.details.operationType.trim()
    };
    case 'home': return {
      tenure: command.details.tenure,
      propertyType: command.details.propertyType,
      addressLabel: command.details.addressLabel.trim()
    };
    case 'vehicle': return {
      vehicleType: command.details.vehicleType,
      energyType: command.details.energyType,
      ...(command.details.plate?.trim() ? { plate: command.details.plate.trim().toLocaleUpperCase('tr-TR') } : {})
    };
  }
  throw new Error('Unsupported managed LIFE profile category');
};

const validateManagedLifeCommand = (
  context: LifeApplicationContext,
  command: RecordManagedLifeItemInput
): Result<void, AppError> => {
  const inspection = inspectManagedLifeDataContract(command);
  if (!inspection.accepted) {
    return err(invalid(
      context,
      'Yönetilen yaşam kaydı yalnız tanımlı alanları içerebilir; gizli bilgi, PAN, dosya yolu ve base64 veri kabul edilmez.'
    ));
  }
  if (isManagedHomeInventoryCommand(command, inspection)) {
    return validateManagedHomeInventoryCommand(context, command);
  }
  if (command.itemType === 'profile') {
    if (!managedLifeId(command.ownerPersonId)
      || !managedLifeCategories.has(command.category)
      || !managedLifeText(command.title, 2, 120)
      || !managedLifeStatuses.has(command.status)
      || !managedLifePrivacies.has(command.privacy)
      || !validateManagedProfileDetails(command)
      || (command.financeAssetId !== undefined && !managedLifeId(command.financeAssetId))) {
      return err(invalid(context, 'Yönetilen yaşam profili sahibi, kategorisi, alanları veya gizliliği geçersiz.'));
    }
    const starts = command.startsAt === undefined ? undefined : managedLifeDate(command.startsAt, context, 'Başlangıç tarihi');
    if (starts && !starts.ok) return starts;
    const ends = command.endsAt === undefined ? undefined : managedLifeDate(command.endsAt, context, 'Bitiş tarihi');
    if (ends && !ends.ok) return ends;
    if (starts?.ok && ends?.ok && ends.value < starts.value) {
      return err(invalid(context, 'Bitiş tarihi başlangıç tarihinden önce olamaz.'));
    }
    if (command.initialReminder) {
      if (!managedLifeReminderKinds.has(command.initialReminder.kind)
        || !managedLifeReminderMatrix[command.category].has(command.initialReminder.kind)) {
        return err(invalid(context, 'İlk hatırlatma türü yaşam kategorisiyle uyumlu değil.'));
      }
      const due = managedLifeDate(command.initialReminder.dueAt, context, 'İlk hatırlatma tarihi');
      if (!due.ok) return due;
      if (starts?.ok && due.value < starts.value) {
        return err(invalid(context, 'İlk hatırlatma tarihi başlangıç tarihinden önce olamaz.'));
      }
    }
    return ok(undefined);
  }
  if (command.itemType === 'activity') {
    if (!managedLifeId(command.recordId)
      || !managedLifeActivityKinds.has(command.activityKind)
      || !optionalManagedLifeText(command.provider, 160)
      || !optionalManagedLifeText(command.note, 500)
      || (command.financeExpenseId !== undefined && !managedLifeId(command.financeExpenseId))
      || (command.amountMinor !== undefined && !managedLifeInteger(command.amountMinor, 1))
      || (command.quantityMilliunits !== undefined && !managedLifeInteger(command.quantityMilliunits, 1))
      || (command.odometerKm !== undefined && !managedLifeInteger(command.odometerKm))) {
      return err(invalid(context, 'Yönetilen yaşam etkinliği kimliği, türü, sayısal değeri veya metni geçersiz.'));
    }
    const hasAmount = command.amountMinor !== undefined;
    const hasCurrency = command.currency !== undefined;
    if (hasAmount !== hasCurrency || (hasCurrency && !managedLifeCurrency(command.currency))) {
      return err(invalid(context, 'Tutar ve üç harfli para birimi birlikte verilmelidir.'));
    }
    if (command.financeExpenseId && (hasAmount || hasCurrency)) {
      return err(invalid(context, 'Bağlı finans gideri ile yinelenen tutar veya para birimi birlikte kaydedilemez.'));
    }
    const quantityActivity = command.activityKind === 'fuel' || command.activityKind === 'charging';
    if (quantityActivity !== (command.quantityMilliunits !== undefined)) {
      return err(invalid(context, 'Yakıt ve şarj etkinliklerinde pozitif milli-birim miktarı zorunludur; diğer türlerde kullanılamaz.'));
    }
    const occurred = managedLifeDate(command.occurredAt, context, 'Etkinlik tarihi');
    if (!occurred.ok) return occurred;
    if (command.reminderMutation?.action === 'set') {
      if (!managedLifeReminderKinds.has(command.reminderMutation.kind)) {
        return err(invalid(context, 'Hatırlatma türü geçersiz.'));
      }
      const due = managedLifeDate(command.reminderMutation.dueAt, context, 'Sonraki hatırlatma tarihi');
      if (!due.ok) return due;
      if (due.value < occurred.value) {
        return err(invalid(context, 'Sonraki hatırlatma tarihi etkinlik tarihinden önce olamaz.'));
      }
    }
    return ok(undefined);
  }
  if (!managedLifeId(command.recordId)
    || !managedLifeId(command.archiveItemId)
    || !managedLifeDocumentKinds.has(command.documentKind)
    || !optionalManagedLifeText(command.label, 120)) {
    return err(invalid(context, 'Yönetilen yaşam belgesi bağlantısı geçersiz.'));
  }
  return ok(undefined);
};

const stripManagedLifePersistenceFields = <T extends object>(value:T): T => {
  const {
    familyId: _familyId,
    policyReceiptHash: _policyReceiptHash,
    policyReceiptVersion: _policyReceiptVersion,
    policyReceiptNonce: _policyReceiptNonce,
    policyCorrelationId: _policyCorrelationId,
    policyResourceType: _policyResourceType,
    policyResourceId: _policyResourceId,
    policyAction: _policyAction,
    policyCapability: _policyCapability,
    ...safe
  } = value as T & {
    readonly familyId?:unknown;
    readonly policyReceiptHash?:unknown;
    readonly policyReceiptVersion?:unknown;
    readonly policyReceiptNonce?:unknown;
    readonly policyCorrelationId?:unknown;
    readonly policyResourceType?:unknown;
    readonly policyResourceId?:unknown;
    readonly policyAction?:unknown;
    readonly policyCapability?:unknown;
  };
  return safe as T;
};

const managedHomePublicCommon = (item:ManagedHomeInventoryWriteRecord) => ({
  id: item.id,
  recordId: item.recordId,
  ownerPersonId: item.ownerPersonId,
  privacy: item.privacy,
  ...(item.supersedesItemId ? { supersedesItemId: item.supersedesItemId } : {}),
  dataSource: item.dataSource,
  externalVerification: item.externalVerification,
  paymentExecution: item.paymentExecution,
  createdAt: item.createdAt
});

const projectManagedHomeInventoryItem = (
  item:ManagedHomeInventoryWriteRecord
): ManagedHomeInventoryLedgerItemView => {
  const common = managedHomePublicCommon(item);
  switch (item.itemType) {
    case 'room': return Object.freeze({
      ...common,
      itemType: 'room',
      name: item.name,
      roomKind: item.roomKind
    });
    case 'meter': return Object.freeze({
      ...common,
      itemType: 'meter',
      ...(item.roomId ? { roomId: item.roomId } : {}),
      label: item.label,
      meterKind: item.meterKind,
      readingUnit: item.readingUnit
    });
    case 'meter_reading': return Object.freeze({
      ...common,
      itemType: 'meter_reading',
      meterId: item.meterId,
      readingKind: item.readingKind,
      readingMilliunits: item.readingMilliunits,
      recordedAt: item.recordedAt,
      ...(item.note ? { note: item.note } : {})
    });
    case 'belonging': return Object.freeze({
      ...common,
      itemType: 'belonging',
      ...(item.roomId ? { roomId: item.roomId } : {}),
      name: item.name,
      belongingKind: item.belongingKind,
      ...(item.serialNumber
        ? { serialNumberMasked: maskManagedHomeSerial(item.serialNumber) }
        : item.serialNumberMasked ? { serialNumberMasked: item.serialNumberMasked } : {}),
      ...(item.purchasedAt ? { purchasedAt: item.purchasedAt } : {}),
      ...(item.purchaseAmountMinor !== undefined ? { purchaseAmountMinor: item.purchaseAmountMinor } : {}),
      ...(item.currency ? { currency: item.currency } : {}),
      ...(item.financeExpenseId ? { financeExpenseId: item.financeExpenseId } : {}),
      financePosting: item.financePosting
    });
    case 'warranty': return Object.freeze({
      ...common,
      itemType: 'warranty',
      belongingId: item.belongingId,
      ...(item.provider ? { provider: item.provider } : {}),
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      ...(item.reminderAt ? { reminderAt: item.reminderAt } : {}),
      ...(item.note ? { note: item.note } : {})
    });
    case 'service': return Object.freeze({
      ...common,
      itemType: 'service',
      targetItemId: item.targetItemId,
      targetType: item.targetType,
      serviceKind: item.serviceKind,
      occurredAt: item.occurredAt,
      ...(item.provider ? { provider: item.provider } : {}),
      ...(item.amountMinor !== undefined ? { amountMinor: item.amountMinor } : {}),
      ...(item.currency ? { currency: item.currency } : {}),
      ...(item.financeExpenseId ? { financeExpenseId: item.financeExpenseId } : {}),
      financePosting: item.financePosting,
      ...(item.note ? { note: item.note } : {})
    });
    case 'document': return Object.freeze({
      ...common,
      itemType: 'document',
      targetItemId: item.targetItemId,
      targetType: item.targetType,
      archiveItemId: item.archiveItemId,
      documentKind: item.documentKind,
      ...(item.label ? { label: item.label } : {})
    });
  }
};

export const buildManagedLifeWorkspace = (input: {
  readonly items:readonly ManagedLifeLedgerItemView[];
  readonly homeInventoryItems?:readonly ManagedHomeInventoryWriteRecord[];
  readonly generatedAt:string;
}): ManagedLifeWorkspaceView => {
  const profiles = input.items.filter((item): item is ManagedLifeProfileLedgerItemView => item.itemType === 'profile');
  const activities = input.items.filter((item): item is ManagedLifeActivityLedgerItemView => item.itemType === 'activity');
  const documents = input.items.filter((item): item is ManagedLifeDocumentLedgerItemView => item.itemType === 'document');
  const reminders: ManagedLifeCurrentReminderView[] = [];
  const profileViews = profiles.map((profile): ManagedLifeProfileView => {
    const profileActivities = activities
      .filter((activity) => activity.recordId === profile.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
    const profileDocuments = documents
      .filter((document) => document.recordId === profile.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
    const latestMutation = profileActivities.find((activity) => activity.reminderMutation !== undefined);
    const activeReminder = latestMutation
      ? latestMutation.reminderMutation?.action === 'set'
        ? {
            sourceId: latestMutation.id,
            recordId: profile.id,
            ownerPersonId: profile.ownerPersonId,
            category: profile.category,
            title: profile.title,
            kind: latestMutation.reminderMutation.kind,
            dueAt: latestMutation.reminderMutation.dueAt
          }
        : undefined
      : profile.initialReminder
        ? {
            sourceId: profile.id,
            recordId: profile.id,
            ownerPersonId: profile.ownerPersonId,
            category: profile.category,
            title: profile.title,
            kind: profile.initialReminder.kind,
            dueAt: profile.initialReminder.dueAt
          }
        : undefined;
    if (activeReminder) reminders.push(Object.freeze(activeReminder));
    return Object.freeze({
      ...stripManagedLifePersistenceFields(profile),
      activities: Object.freeze(profileActivities.map(stripManagedLifePersistenceFields)),
      documents: Object.freeze(profileDocuments.map(stripManagedLifePersistenceFields)),
      ...(activeReminder ? { currentReminder: Object.freeze(activeReminder) } : {})
    }) as ManagedLifeProfileView;
  }).sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
  const visibleRootIds = new Set(profileViews
    .filter((profile) => profile.category === 'home')
    .map((profile) => profile.id));
  const homeInventoryItems = (input.homeInventoryItems ?? [])
    .filter((item) => visibleRootIds.has(item.recordId))
    .map(projectManagedHomeInventoryItem)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
  return Object.freeze({
    profiles: Object.freeze(profileViews),
    homeInventoryItems: Object.freeze(homeInventoryItems),
    upcomingReminders: Object.freeze(reminders
      .filter((reminder) => reminder.dueAt >= input.generatedAt)
      .sort((left, right) => left.dueAt.localeCompare(right.dueAt) || left.sourceId.localeCompare(right.sourceId))
      .slice(0, 250)),
    generatedAt: input.generatedAt,
    dataSource: 'manual',
    externalRegistryLookup: 'not_performed',
    smartMeterLookup: 'not_performed',
    providerContact: 'not_performed',
    warrantyLookup: 'not_performed',
    ocr: 'not_performed',
    paymentExecution: 'not_performed',
    documentContentExposure: 'not_performed'
  });
};

export class GetManagedLifeWorkspaceUseCase {
  public constructor(private readonly query: LifeQueryPort) {}

  public execute(context: LifeApplicationContext): ReturnType<LifeQueryPort['getManagedLifeWorkspace']> {
    return this.query.getManagedLifeWorkspace(context);
  }
}

const buildManagedProfileRecord = (input: {
  readonly context:LifeApplicationContext;
  readonly command:RecordManagedLifeProfileInput;
  readonly itemId:string;
  readonly occurredAt:IsoDateTime;
}): ManagedLifeProfileWriteRecord => {
  const command = input.command;
  const startsAt = command.startsAt ? asIsoDateTime(command.startsAt) : undefined;
  const endsAt = command.endsAt ? asIsoDateTime(command.endsAt) : undefined;
  const details = normalizeManagedProfileDetails(command);
  return {
    id: input.itemId,
    familyId: input.context.familyId,
    ownerPersonId: asPersonId(command.ownerPersonId),
    itemType: 'profile',
    category: command.category,
    title: command.title.trim(),
    status: command.status,
    details,
    privacy: command.privacy,
    ...(startsAt ? { startsAt } : {}),
    ...(endsAt ? { endsAt } : {}),
    ...(command.initialReminder ? {
      initialReminder: {
        kind: command.initialReminder.kind,
        dueAt: asIsoDateTime(command.initialReminder.dueAt)
      }
    } : {}),
    ...(command.financeAssetId ? { financeAssetId: command.financeAssetId } : {}),
    dataSource: 'manual',
    externalVerification: 'not_performed',
    paymentExecution: 'not_performed',
    createdAt: input.occurredAt
  } as ManagedLifeProfileWriteRecord;
};

const buildManagedActivityRecord = (input: {
  readonly context:LifeApplicationContext;
  readonly command:RecordManagedLifeActivityInput;
  readonly parent:ManagedLifeProfileWriteRecord;
  readonly itemId:string;
  readonly occurredAt:IsoDateTime;
}): ManagedLifeActivityWriteRecord => ({
  id: input.itemId,
  familyId: input.context.familyId,
  ownerPersonId: input.parent.ownerPersonId,
  itemType: 'activity',
  recordId: input.parent.id,
  activityKind: input.command.activityKind,
  occurredAt: asIsoDateTime(input.command.occurredAt),
  ...(input.command.provider?.trim() ? { provider: input.command.provider.trim() } : {}),
  ...(input.command.amountMinor !== undefined ? { amountMinor: input.command.amountMinor } : {}),
  ...(input.command.currency ? { currency: input.command.currency.toUpperCase() } : {}),
  ...(input.command.quantityMilliunits !== undefined ? { quantityMilliunits: input.command.quantityMilliunits } : {}),
  ...(input.command.odometerKm !== undefined ? { odometerKm: input.command.odometerKm } : {}),
  ...(input.command.financeExpenseId ? { financeExpenseId: input.command.financeExpenseId } : {}),
  financePosting: input.command.financeExpenseId ? 'linked' : 'not_performed',
  ...(input.command.reminderMutation?.action === 'set' ? {
    reminderMutation: {
      action: 'set',
      kind: input.command.reminderMutation.kind,
      dueAt: asIsoDateTime(input.command.reminderMutation.dueAt)
    }
  } : input.command.reminderMutation?.action === 'clear' ? {
    reminderMutation: { action: 'clear' }
  } : {}),
  ...(input.command.note?.trim() ? { note: input.command.note.trim() } : {}),
  privacy: input.parent.privacy,
  dataSource: 'manual',
  externalVerification: 'not_performed',
  paymentExecution: 'not_performed',
  createdAt: input.occurredAt
});

const buildManagedDocumentRecord = (input: {
  readonly context:LifeApplicationContext;
  readonly command:RecordManagedLifeDocumentInput;
  readonly parent:ManagedLifeProfileWriteRecord;
  readonly itemId:string;
  readonly occurredAt:IsoDateTime;
}): ManagedLifeDocumentWriteRecord => ({
  id: input.itemId,
  familyId: input.context.familyId,
  ownerPersonId: input.parent.ownerPersonId,
  itemType: 'document',
  recordId: input.parent.id,
  archiveItemId: input.command.archiveItemId,
  documentKind: input.command.documentKind,
  ...(input.command.label?.trim() ? { label: input.command.label.trim() } : {}),
  privacy: input.parent.privacy,
  dataSource: 'manual',
  externalVerification: 'not_performed',
  paymentExecution: 'not_performed',
  createdAt: input.occurredAt
});

const managedHomeCommon = (input: {
  readonly context:LifeApplicationContext;
  readonly command:RecordManagedHomeInventoryItemInput;
  readonly parent:ManagedLifeProfileWriteRecord;
  readonly itemId:string;
  readonly occurredAt:IsoDateTime;
}) => ({
  id: input.itemId,
  familyId: input.context.familyId,
  recordId: input.parent.id,
  ownerPersonId: input.parent.ownerPersonId,
  privacy: input.parent.privacy,
  ...(input.command.supersedesItemId ? { supersedesItemId: input.command.supersedesItemId } : {}),
  dataSource: 'manual' as const,
  externalVerification: 'not_performed' as const,
  paymentExecution: 'not_performed' as const,
  createdAt: input.occurredAt
});

const buildManagedHomeInventoryRecord = (input: {
  readonly context:LifeApplicationContext;
  readonly command:RecordManagedHomeInventoryItemInput;
  readonly parent:ManagedLifeProfileWriteRecord;
  readonly itemId:string;
  readonly occurredAt:IsoDateTime;
}): ManagedHomeInventoryWriteRecord => {
  const common = managedHomeCommon(input);
  switch (input.command.itemType) {
    case 'room': return {
      ...common,
      itemType: 'room',
      name: input.command.name.trim(),
      roomKind: input.command.roomKind
    };
    case 'meter': return {
      ...common,
      itemType: 'meter',
      ...(input.command.roomId ? { roomId: input.command.roomId } : {}),
      label: input.command.label.trim(),
      meterKind: input.command.meterKind,
      readingUnit: input.command.readingUnit
    };
    case 'meter_reading': return {
      ...common,
      itemType: 'meter_reading',
      meterId: input.command.meterId,
      readingKind: input.command.readingKind,
      readingMilliunits: input.command.readingMilliunits,
      recordedAt: asIsoDateTime(input.command.recordedAt),
      ...(input.command.note?.trim() ? { note: input.command.note.trim() } : {})
    };
    case 'belonging': return {
      ...common,
      itemType: 'belonging',
      ...(input.command.roomId ? { roomId: input.command.roomId } : {}),
      name: input.command.name.trim(),
      belongingKind: input.command.belongingKind,
      ...(input.command.serialNumber?.trim() ? { serialNumber: input.command.serialNumber.trim() } : {}),
      ...(input.command.purchasedAt ? { purchasedAt: asIsoDateTime(input.command.purchasedAt) } : {}),
      ...(input.command.purchaseAmountMinor !== undefined
        ? { purchaseAmountMinor: input.command.purchaseAmountMinor } : {}),
      ...(input.command.currency ? { currency: input.command.currency.toUpperCase() } : {}),
      ...(input.command.financeExpenseId ? { financeExpenseId: input.command.financeExpenseId } : {}),
      financePosting: input.command.financeExpenseId ? 'linked' : 'not_performed'
    };
    case 'warranty': return {
      ...common,
      itemType: 'warranty',
      belongingId: input.command.belongingId,
      ...(input.command.provider?.trim() ? { provider: input.command.provider.trim() } : {}),
      startsAt: asIsoDateTime(input.command.startsAt),
      endsAt: asIsoDateTime(input.command.endsAt),
      ...(input.command.reminderAt ? { reminderAt: asIsoDateTime(input.command.reminderAt) } : {}),
      ...(input.command.note?.trim() ? { note: input.command.note.trim() } : {})
    };
    case 'service': return {
      ...common,
      itemType: 'service',
      targetItemId: input.command.targetItemId,
      targetType: input.command.targetType,
      serviceKind: input.command.serviceKind,
      occurredAt: asIsoDateTime(input.command.occurredAt),
      ...(input.command.provider?.trim() ? { provider: input.command.provider.trim() } : {}),
      ...(input.command.amountMinor !== undefined ? { amountMinor: input.command.amountMinor } : {}),
      ...(input.command.currency ? { currency: input.command.currency.toUpperCase() } : {}),
      ...(input.command.financeExpenseId ? { financeExpenseId: input.command.financeExpenseId } : {}),
      financePosting: input.command.financeExpenseId ? 'linked' : 'not_performed',
      ...(input.command.note?.trim() ? { note: input.command.note.trim() } : {})
    };
    case 'document': return {
      ...common,
      itemType: 'document',
      targetItemId: input.command.targetItemId,
      targetType: input.command.targetType,
      archiveItemId: input.command.archiveItemId,
      documentKind: input.command.documentKind,
      ...(input.command.label?.trim() ? { label: input.command.label.trim() } : {})
    };
  }
};

const managedHomeExpectedTargetType = (
  item:ManagedHomeInventoryWriteRecord
): ManagedHomeServiceTargetType | ManagedHomeDocumentTargetType | undefined => {
  switch (item.itemType) {
    case 'room': return 'room';
    case 'meter': return 'meter';
    case 'belonging': return 'belonging';
    case 'warranty': return 'warranty';
    case 'service': return 'service';
    default: return undefined;
  }
};

const validateManagedHomeInventoryRelations = (input: {
  readonly context:LifeApplicationContext;
  readonly command:RecordManagedHomeInventoryItemInput;
  readonly parent:ManagedLifeProfileWriteRecord;
  readonly scope:LifeWriteScope;
  readonly itemId:string;
}): Result<void, AppError> => {
  const findItem = (id:string): Result<ManagedHomeInventoryWriteRecord, AppError> => {
    const found = input.scope.findManagedHomeInventoryItem(id);
    if (!found.ok) return found;
    if (!found.value
      || found.value.recordId !== input.parent.id
      || found.value.familyId !== input.context.familyId
      || found.value.ownerPersonId !== input.parent.ownerPersonId
      || found.value.privacy !== input.parent.privacy) {
      return err(invalid(input.context, 'Ev envanteri üst bağlantısı aynı home kökünde bulunmalıdır.'));
    }
    return ok(found.value);
  };
  if (input.command.supersedesItemId) {
    if (input.command.supersedesItemId === input.itemId) {
      return err(invalid(input.context, 'Ev envanteri kaydı kendisini supersede edemez.'));
    }
    const superseded = findItem(input.command.supersedesItemId);
    if (!superseded.ok) return superseded;
    if (superseded.value.itemType !== input.command.itemType) {
      return err(invalid(input.context, 'Supersede edilen kayıt aynı türde olmalıdır.'));
    }
  }
  switch (input.command.itemType) {
    case 'room': return ok(undefined);
    case 'meter':
      if (!input.command.roomId) return ok(undefined);
      {
        const room = findItem(input.command.roomId);
        return room.ok && room.value.itemType === 'room'
          ? ok(undefined)
          : err(invalid(input.context, 'Sayaç yalnız aynı home kökündeki odaya bağlanabilir.'));
      }
    case 'meter_reading': {
      const meter = findItem(input.command.meterId);
      if (!meter.ok) return meter;
      if (meter.value.itemType !== 'meter') {
        return err(invalid(input.context, 'Sayaç okuması geçerli bir sayaç kaydına bağlanmalıdır.'));
      }
      const latest = input.scope.findLatestManagedHomeMeterReading(input.parent.id, input.command.meterId);
      if (!latest.ok) return latest;
      if (latest.value && input.command.recordedAt <= latest.value.recordedAt) {
        return err(invalid(input.context, 'Sayaç okuması önceki olaydan sonra olmalıdır.'));
      }
      if (input.command.recordedAt > input.scope.occurredAt) {
        return err(invalid(input.context, 'Sayaç okuma tarihi işlem zamanından sonra olamaz.'));
      }
      if (input.command.readingKind === 'reading'
        && latest.value
        && input.command.readingMilliunits < latest.value.readingMilliunits) {
        return err(invalid(input.context, 'Normal sayaç okuması monoton ilerlemelidir; düşüş reset veya replacement ister.'));
      }
      return ok(undefined);
    }
    case 'belonging':
      if (input.command.purchasedAt && input.command.purchasedAt > input.scope.occurredAt) {
        return err(invalid(input.context, 'Satın alma tarihi işlem zamanından sonra olamaz.'));
      }
      if (!input.command.roomId) return ok(undefined);
      {
        const room = findItem(input.command.roomId);
        return room.ok && room.value.itemType === 'room'
          ? ok(undefined)
          : err(invalid(input.context, 'Eşya yalnız aynı home kökündeki odaya bağlanabilir.'));
      }
    case 'warranty': {
      const belonging = findItem(input.command.belongingId);
      return belonging.ok && belonging.value.itemType === 'belonging'
        ? ok(undefined)
        : err(invalid(input.context, 'Garanti yalnız aynı home kökündeki eşyaya bağlanabilir.'));
    }
    case 'service': {
      if (input.command.occurredAt > input.scope.occurredAt) {
        return err(invalid(input.context, 'Servis tarihi işlem zamanından sonra olamaz.'));
      }
      const target = findItem(input.command.targetItemId);
      return target.ok && managedHomeExpectedTargetType(target.value) === input.command.targetType
        ? ok(undefined)
        : err(invalid(input.context, 'Servis hedef türü aynı home kökündeki kayıtla eşleşmelidir.'));
    }
    case 'document': {
      const target = findItem(input.command.targetItemId);
      return target.ok && managedHomeExpectedTargetType(target.value) === input.command.targetType
        ? ok(undefined)
        : err(invalid(input.context, 'Belge hedef türü aynı home kökündeki kayıtla eşleşmelidir.'));
    }
  }
};

export class RecordManagedLifeItemUseCase {
  public constructor(private readonly unitOfWork: LifeUnitOfWork) {}

  public execute(input: {
    readonly context:LifeApplicationContext;
    readonly command:RecordManagedLifeItemInput;
    readonly identifiers:{
      readonly itemId:string;
      readonly auditId:string;
      readonly outboxEventId:EventId;
    };
  }): Promise<Result<ManagedLifeLedgerItemView | ManagedHomeInventoryLedgerItemView, AppError>> {
    const commandValidation = validateManagedLifeCommand(input.context, input.command);
    if (!commandValidation.ok) return Promise.resolve(commandValidation);
    if (!managedLifeId(input.identifiers.itemId)) {
      return Promise.resolve(err(invalid(input.context, 'Yönetilen yaşam kayıt kimliği geçersiz.')));
    }
    const inspection = inspectManagedLifeDataContract(input.command);
    const isHomeInventory = isManagedHomeInventoryCommand(input.command, inspection);
    const isProfile = !isHomeInventory && input.command.itemType === 'profile';
    const rootId = isProfile ? input.identifiers.itemId : input.command.recordId;
    const profileOwner = isProfile ? asPersonId(input.command.ownerPersonId) : undefined;
    const profilePrivacy = isProfile ? input.command.privacy : undefined;
    const intent: LifePolicyIntent = {
      action: isProfile ? 'create' : 'update',
      capability: 'family.write',
      resourceType: 'life_record',
      resourceId: rootId,
      purpose: 'general',
      ...(profileOwner ? { ownerPersonId: profileOwner, privacy: profilePrivacy! } : {})
    };
    return this.unitOfWork.execute(input.context, intent, (scope) => {
      let parent: ManagedLifeProfileWriteRecord | undefined;
      if (isProfile) {
        const person = scope.findPerson(profileOwner!);
        if (!person.ok) return person;
        if (!person.value) return err(missing(input.context));
      } else {
        const found = scope.findManagedLifeProfile(rootId);
        if (!found.ok) return found;
        if (!found.value) return err(createAppError({
          code: ERROR_CODES.RESOURCE_NOT_FOUND,
          message: 'Yönetilen yaşam üst kaydı bulunamadı.',
          category: 'not_found',
          correlationId: input.context.correlationId
        }));
        parent = found.value;
      }
      const ownerPersonId = profileOwner ?? parent!.ownerPersonId;
      const privacy = profilePrivacy ?? parent!.privacy;
      const authorization = scope.authorize({
        action: isProfile ? 'create' : 'update',
        resourceType: 'life_record',
        resourceId: rootId,
        ownerPersonId,
        privacy
      });
      if (!authorization.ok) return authorization;
      if (!authorization.value) return err(denied(input.context));

      let item: ManagedLifeWriteRecord | ManagedHomeInventoryWriteRecord;
      if (isHomeInventory) {
        if (parent!.category !== 'home') {
          return err(invalid(input.context, 'Ev envanteri yalnız yönetilen home profiline bağlanabilir.'));
        }
        const relationValidation = validateManagedHomeInventoryRelations({
          context: input.context,
          command: input.command,
          parent: parent!,
          scope,
          itemId: input.identifiers.itemId
        });
        if (!relationValidation.ok) return relationValidation;
        item = buildManagedHomeInventoryRecord({
          context: input.context,
          command: input.command,
          parent: parent!,
          itemId: input.identifiers.itemId,
          occurredAt: scope.occurredAt
        });
      } else if (input.command.itemType === 'profile') {
        item = buildManagedProfileRecord({
          context: input.context,
          command: input.command,
          itemId: input.identifiers.itemId,
          occurredAt: scope.occurredAt
        });
      } else if (input.command.itemType === 'activity') {
        const activityCategories = managedLifeActivityMatrix[input.command.activityKind];
        const parentCategory = parent!.category;
        if (!activityCategories || !activityCategories.has(parentCategory)) {
          return err(invalid(input.context, 'Etkinlik türü yaşam kategorisiyle uyumlu değil.'));
        }
        if (input.command.odometerKm !== undefined && parent!.category !== 'vehicle') {
          return err(invalid(input.context, 'Kilometre yalnız araç etkinliklerinde kaydedilebilir.'));
        }
        if (input.command.reminderMutation?.action === 'set'
          && !managedLifeReminderMatrix[parentCategory]?.has(input.command.reminderMutation.kind)) {
          return err(invalid(input.context, 'Hatırlatma türü yaşam kategorisiyle uyumlu değil.'));
        }
        if (input.command.occurredAt > scope.occurredAt) {
          return err(invalid(input.context, 'Gerçekleşen etkinlik tarihi işlem zamanından sonra olamaz.'));
        }
        item = buildManagedActivityRecord({
          context: input.context,
          command: input.command,
          parent: parent!,
          itemId: input.identifiers.itemId,
          occurredAt: scope.occurredAt
        });
      } else {
        const documentKinds = managedLifeDocumentMatrix[parent!.category];
        if (!documentKinds || !documentKinds.has(input.command.documentKind)) {
          return err(invalid(input.context, 'Belge türü yaşam kategorisiyle uyumlu değil.'));
        }
        item = buildManagedDocumentRecord({
          context: input.context,
          command: input.command,
          parent: parent!,
          itemId: input.identifiers.itemId,
          occurredAt: scope.occurredAt
        });
      }
      const saved = isHomeInventory
        ? scope.insertManagedHomeInventoryItem(item as ManagedHomeInventoryWriteRecord)
        : scope.insertManagedLifeItem(item as ManagedLifeWriteRecord);
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({
        id: input.identifiers.auditId,
        action: `life.managed.${item.itemType}.recorded`,
        resourceType: 'life_record',
        resourceId: rootId,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audit.ok) return audit;
      const event = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'life.managed.item_recorded',
        eventVersion: 1,
        aggregateType: 'life_record',
        aggregateId: rootId,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: {
          itemId: item.id,
          recordId: rootId,
          itemType: item.itemType,
          category: isProfile ? input.command.category : parent!.category,
          privacy
        }
      });
      if (!event.ok) return event;
      return ok(isHomeInventory
        ? projectManagedHomeInventoryItem(item as ManagedHomeInventoryWriteRecord)
        : item as ManagedLifeWriteRecord);
    });
  }
}
