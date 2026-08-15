import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  asEventId,
  asIsoDateTime,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import {
  HOUSEHOLD_OPERATION_AREAS,
  HOUSEHOLD_OPERATION_KINDS,
  householdOperationAreaForKind,
  householdOperationsCenterId,
  type CreateHouseholdOperationItemInput,
  type DeleteHouseholdOperationItemInput,
  type HouseholdExpenseShareView,
  type HouseholdOperationItemView,
  type HouseholdOperationKind,
  type HouseholdOperationMutationKind,
  type HouseholdOperationMutationReceiptView,
  type HouseholdOperationsCenterView,
  type UpdateHouseholdOperationItemInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  HouseholdOperationItemRow,
  HouseholdOperationMutationRow,
  HouseholdOperationsCenterKey,
  HouseholdOperationsCenterRow
} from '@ppt/repository-contracts';
import type { LifeApplicationContext, LifePolicyIntent } from './life-use-cases.js';

export interface HouseholdOperationsQueryPort {
  getCenter(context: LifeApplicationContext): Promise<Result<HouseholdOperationsCenterView, AppError>>;
}

export interface HouseholdOperationsWriteScope {
  readonly occurredAt: HouseholdOperationMutationRow['occurredAt'];
  findPerson(personId: string): Result<{
    readonly id: string;
    readonly familyId: string;
    readonly status: string;
  } | null, AppError>;
  findCenter(key: HouseholdOperationsCenterKey): Result<HouseholdOperationsCenterRow | null, AppError>;
  findItem(key: HouseholdOperationsCenterKey, itemId: string): Result<HouseholdOperationItemRow | null, AppError>;
  findMutation(key: HouseholdOperationsCenterKey, clientOperationId: string): Result<HouseholdOperationMutationRow | null, AppError>;
  insertMutation(row: HouseholdOperationMutationRow): Result<void, AppError>;
  insertCenter(row: HouseholdOperationsCenterRow): Result<void, AppError>;
  saveCenter(row: HouseholdOperationsCenterRow, expectedRevision: number): Result<void, AppError>;
  insertItem(row: HouseholdOperationItemRow): Result<void, AppError>;
  saveItem(row: HouseholdOperationItemRow, expectedRevision: number): Result<void, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: HouseholdOperationMutationRow['occurredAt'];
    readonly actorId: LifeApplicationContext['actor']['userId'];
  }): Result<string, AppError>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
}

export interface HouseholdOperationsUnitOfWork {
  execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: HouseholdOperationsWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,255}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const CURRENCY = /^[A-Z]{3}$/u;
const LAST_FOUR = /^[A-Za-z0-9]{4}$/u;
const CONTROL = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const householdKinds = new Set<string>(HOUSEHOLD_OPERATION_KINDS);
const allowedStatuses = new Set<HouseholdOperationItemView['status']>([
  'planned', 'active', 'low_stock', 'due', 'completed', 'cancelled', 'expired', 'delivered', 'revoked'
]);

const hash = (value: unknown): string => createHash('sha256')
  .update(JSON.stringify(value), 'utf8')
  .digest('hex');

const invalid = (context: LifeApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT,
  message,
  category: 'validation',
  correlationId: context.correlationId
});

const conflict = (context: LifeApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_CONFLICT,
  message,
  category: 'conflict',
  correlationId: context.correlationId
});

const denied = (context: LifeApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message,
  category: 'authorization',
  correlationId: context.correlationId
});

const notFound = (context: LifeApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_NOT_FOUND,
  message,
  category: 'not_found',
  correlationId: context.correlationId
});

const normalizeText = (
  context: LifeApplicationContext,
  value: string,
  label: string,
  minimum: number,
  maximum: number
): Result<string, AppError> => {
  if (typeof value !== 'string') return err(invalid(context, `${label} metin olmalıdır.`));
  const normalized = value.normalize('NFKC').trim();
  return normalized.length >= minimum && normalized.length <= maximum && !CONTROL.test(normalized)
    ? ok(normalized)
    : err(invalid(context, `${label} sınırları veya karakterleri geçersizdir.`));
};

const optionalText = (
  context: LifeApplicationContext,
  value: string | undefined,
  label: string,
  maximum: number
): Result<string | undefined, AppError> => {
  if (value === undefined) return ok(undefined);
  const normalized = normalizeText(context, value, label, 1, maximum);
  return normalized.ok ? ok(normalized.value) : normalized;
};

const iso = (
  context: LifeApplicationContext,
  value: string | undefined,
  label: string
): Result<HouseholdOperationMutationRow['occurredAt'] | undefined, AppError> => {
  if (value === undefined) return ok(undefined);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? ok(asIsoDateTime(new Date(parsed).toISOString()))
    : err(invalid(context, `${label} geçersizdir.`));
};

const canonicalStrings = (
  context: LifeApplicationContext,
  values: readonly string[] | undefined,
  label: string,
  maximumItems: number,
  maximumLength = 80
): Result<readonly string[] | undefined, AppError> => {
  if (values === undefined) return ok(undefined);
  if (!Array.isArray(values) || values.length > maximumItems) {
    return err(invalid(context, `${label} öğe sınırını aşıyor.`));
  }
  const normalized: string[] = [];
  for (const value of values) {
    const parsed = normalizeText(context, value, label, 1, maximumLength);
    if (!parsed.ok) return parsed;
    normalized.push(parsed.value.toLocaleLowerCase('tr-TR'));
  }
  const unique = [...new Set(normalized)].sort();
  return unique.length === normalized.length ? ok(Object.freeze(unique)) : err(invalid(context, `${label} yinelenen öğe içeremez.`));
};

const centerKey = (context: LifeApplicationContext): Result<HouseholdOperationsCenterKey, AppError> => {
  if (!context.actor.personId) return err(denied(context, 'Hane operasyonları için kişi bağlı oturum zorunludur.'));
  return ok(Object.freeze({
    familyId: context.familyId,
    accountId: context.actor.userId,
    actorPersonId: context.actor.personId,
    centerId: householdOperationsCenterId(context.familyId)
  }));
};

const writeIntent = (
  context: LifeApplicationContext,
  itemId: string,
  action: 'create' | 'update' | 'delete',
  ownerPersonId?: string
): LifePolicyIntent => ({
  action,
  capability: 'family.write',
  resourceType: 'household_operation_item',
  resourceId: itemId,
  purpose: 'general',
  ...(action === 'create' && ownerPersonId
    ? { ownerPersonId: asPersonId(ownerPersonId), privacy: 'family' as const }
    : {})
});

const readIntent = (): LifePolicyIntent => ({
  action: 'read',
  capability: 'family.read',
  resourceType: 'household_operations_center',
  resourceId: '*',
  purpose: 'general'
});

const identifiers = (
  context: LifeApplicationContext,
  clientOperationId: string,
  itemId: string,
  kind: HouseholdOperationMutationKind,
  request: unknown
): {
  readonly mutationId: string;
  readonly requestFingerprint: string;
  readonly auditId: string;
  readonly eventId: ReturnType<typeof asEventId>;
} => {
  const requestFingerprint = hash(request);
  const seed = `${context.familyId}|${context.actor.userId}|${clientOperationId}|${itemId}|${kind}`;
  return Object.freeze({
    mutationId: hash(`mutation|${seed}`),
    requestFingerprint,
    auditId: hash(`audit|${seed}`),
    eventId: asEventId(hash(`event|${seed}`))
  });
};

const validateRevisions = (
  context: LifeApplicationContext,
  centerRevision: number,
  itemRevision?: number
): Result<void, AppError> => Number.isSafeInteger(centerRevision) && centerRevision >= 0
  && (itemRevision === undefined || (Number.isSafeInteger(itemRevision) && itemRevision >= 1))
  ? ok(undefined)
  : err(invalid(context, 'Hane operasyonu revizyonu geçersizdir.'));

const validateIdempotency = (
  context: LifeApplicationContext,
  clientOperationId: string,
  itemId: string
): Result<void, AppError> => SAFE_ID.test(clientOperationId) && SAFE_ID.test(itemId)
  ? ok(undefined)
  : err(invalid(context, 'Hane operasyonu işlem veya öğe kimliği geçersizdir.'));

const ensurePerson = (
  context: LifeApplicationContext,
  scope: HouseholdOperationsWriteScope,
  personId: string
): Result<void, AppError> => {
  if (!SAFE_ID.test(personId)) return err(invalid(context, 'Atanan kişi kimliği geçersizdir.'));
  const person = scope.findPerson(personId);
  if (!person.ok) return person;
  return person.value && person.value.familyId === context.familyId && person.value.status === 'active'
    ? ok(undefined)
    : err(notFound(context, 'Atanan kişi etkin aile içinde bulunamadı.'));
};

const validateShares = (
  context: LifeApplicationContext,
  scope: HouseholdOperationsWriteScope,
  shares: readonly HouseholdExpenseShareView[] | undefined
): Result<readonly HouseholdExpenseShareView[] | undefined, AppError> => {
  if (shares === undefined) return ok(undefined);
  if (!Array.isArray(shares) || shares.length < 2 || shares.length > 64) {
    return err(invalid(context, 'Ortak gider en az iki ve en çok 64 pay gerektirir.'));
  }
  const ids = new Set<string>();
  let total = 0;
  const normalized: HouseholdExpenseShareView[] = [];
  for (const share of shares) {
    if (!SAFE_ID.test(share.personId) || ids.has(share.personId)
      || !Number.isSafeInteger(share.basisPoints) || share.basisPoints < 1 || share.basisPoints > 10_000) {
      return err(invalid(context, 'Ortak gider payı geçersiz veya yinelenmiştir.'));
    }
    const active = ensurePerson(context, scope, share.personId);
    if (!active.ok) return active;
    ids.add(share.personId);
    total += share.basisPoints;
    normalized.push(Object.freeze({ personId: share.personId, basisPoints: share.basisPoints }));
  }
  return total === 10_000
    ? ok(Object.freeze(normalized.sort((a, b) => a.personId.localeCompare(b.personId))))
    : err(invalid(context, 'Ortak gider payları toplamı tam olarak yüzde 100 olmalıdır.'));
};

const itemFingerprint = (row: Omit<HouseholdOperationItemRow, 'stateFingerprint'>): string => hash({
  id: row.id,
  centerId: row.centerId,
  familyId: row.familyId,
  ownerPersonId: row.ownerPersonId,
  kind: row.kind,
  area: row.area,
  title: row.title,
  status: row.status,
  revision: row.revision,
  parentItemId: row.parentItemId ?? null,
  assignedPersonId: row.assignedPersonId ?? null,
  stockCategory: row.stockCategory ?? null,
  quantity: row.quantity ?? null,
  unit: row.unit ?? null,
  scheduledAt: row.scheduledAt ?? null,
  dueAt: row.dueAt ?? null,
  expiresAt: row.expiresAt ?? null,
  recurrence: row.recurrence ?? null,
  amountMinor: row.amountMinor ?? null,
  currency: row.currency ?? null,
  splitShares: row.splitShares ?? [],
  ingredientNames: row.ingredientNames ?? [],
  allergenCodes: row.allergenCodes ?? [],
  avoidedAllergenCodes: row.avoidedAllergenCodes ?? [],
  allergyFilterStatus: row.allergyFilterStatus ?? null,
  providerLabel: row.providerLabel ?? null,
  trackingLastFour: row.trackingLastFour ?? null,
  guestLabel: row.guestLabel ?? null,
  accessArea: row.accessArea ?? null,
  opaquePetReference: row.opaquePetReference ?? null,
  note: row.note ?? null,
  lastMutationId: row.lastMutationId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  deletedAt: row.deletedAt ?? null
});

const centerNext = (
  key: HouseholdOperationsCenterKey,
  current: HouseholdOperationsCenterRow | null,
  mutationId: string,
  itemId: string,
  itemStateFingerprint: string,
  occurredAt: HouseholdOperationMutationRow['occurredAt']
): HouseholdOperationsCenterRow => {
  const revision = (current?.revision ?? 0) + 1;
  return Object.freeze({
    id: key.centerId,
    familyId: key.familyId,
    revision,
    stateFingerprint: hash({
      centerId: key.centerId,
      familyId: key.familyId,
      revision,
      mutationId,
      itemId,
      itemStateFingerprint,
      occurredAt
    }),
    lastMutationId: mutationId,
    createdAt: current?.createdAt ?? occurredAt,
    updatedAt: occurredAt
  });
};

const mutation = (input: {
  readonly context: LifeApplicationContext;
  readonly key: HouseholdOperationsCenterKey;
  readonly kind: HouseholdOperationMutationKind;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly mutationId: string;
  readonly currentCenter: HouseholdOperationsCenterRow | null;
  readonly nextCenter: HouseholdOperationsCenterRow;
  readonly previousItemRevision: number;
  readonly nextItem: HouseholdOperationItemRow;
  readonly occurredAt: HouseholdOperationMutationRow['occurredAt'];
}): HouseholdOperationMutationRow => Object.freeze({
  id: input.mutationId,
  centerId: input.key.centerId,
  familyId: input.key.familyId,
  itemId: input.nextItem.id,
  ownerPersonId: input.nextItem.ownerPersonId,
  actorAccountId: input.context.actor.userId,
  actorPersonId: input.context.actor.personId!,
  mutationKind: input.kind,
  clientOperationId: input.clientOperationId,
  requestFingerprint: input.requestFingerprint,
  expectedCenterRevision: input.currentCenter?.revision ?? 0,
  centerRevision: input.nextCenter.revision,
  expectedItemRevision: input.previousItemRevision,
  itemRevision: input.nextItem.revision,
  centerStateFingerprint: input.nextCenter.stateFingerprint,
  itemStateFingerprint: input.nextItem.stateFingerprint,
  occurredAt: input.occurredAt
});

const receipt = (
  row: HouseholdOperationMutationRow,
  replayed: boolean
): HouseholdOperationMutationReceiptView => Object.freeze({
  centerId: row.centerId,
  itemId: row.itemId,
  mutationKind: row.mutationKind,
  previousCenterRevision: row.expectedCenterRevision,
  centerRevision: row.centerRevision,
  previousItemRevision: row.expectedItemRevision,
  itemRevision: row.itemRevision,
  occurredAt: row.occurredAt,
  replayed,
  localOnly: true,
  externalAction: 'not_performed'
});

const replay = (
  context: LifeApplicationContext,
  found: HouseholdOperationMutationRow | null,
  expected: {
    readonly kind: HouseholdOperationMutationKind;
    readonly itemId: string;
    readonly expectedCenterRevision: number;
    readonly expectedItemRevision: number;
    readonly requestFingerprint: string;
  }
): Result<HouseholdOperationMutationReceiptView | null, AppError> => {
  if (!found) return ok(null);
  return found.mutationKind === expected.kind
    && found.itemId === expected.itemId
    && found.expectedCenterRevision === expected.expectedCenterRevision
    && found.expectedItemRevision === expected.expectedItemRevision
    && found.requestFingerprint === expected.requestFingerprint
    ? ok(receipt(found, true))
    : err(conflict(context, 'Aynı işlem kimliği farklı hane operasyonu içeriğiyle yeniden kullanılamaz.'));
};

const persistCenter = (
  scope: HouseholdOperationsWriteScope,
  current: HouseholdOperationsCenterRow | null,
  next: HouseholdOperationsCenterRow
): Result<void, AppError> => current
  ? scope.saveCenter(next, current.revision)
  : scope.insertCenter(next);

const persistMutation = (
  context: LifeApplicationContext,
  scope: HouseholdOperationsWriteScope,
  row: HouseholdOperationMutationRow,
  currentCenter: HouseholdOperationsCenterRow | null,
  nextCenter: HouseholdOperationsCenterRow,
  nextItem: HouseholdOperationItemRow,
  previousItemRevision: number,
  auditId: string,
  eventId: ReturnType<typeof asEventId>
): Result<HouseholdOperationMutationReceiptView, AppError> => {
  const insertedMutation = scope.insertMutation(row);
  if (!insertedMutation.ok) return insertedMutation;
  const savedCenter = persistCenter(scope, currentCenter, nextCenter);
  if (!savedCenter.ok) return savedCenter;
  const savedItem = previousItemRevision === 0
    ? scope.insertItem(nextItem)
    : scope.saveItem(nextItem, previousItemRevision);
  if (!savedItem.ok) return savedItem;
  const audit = scope.appendAudit({
    id: auditId,
    action: `household_operations.${row.mutationKind}`,
    resourceType: 'household_operation_item',
    resourceId: row.itemId,
    occurredAt: row.occurredAt,
    actorId: context.actor.userId
  });
  if (!audit.ok) return audit;
  const event = scope.enqueueEvent({
    eventId,
    eventType: `household_operations.${row.mutationKind}`,
    eventVersion: 1,
    aggregateType: 'household_operation_item',
    aggregateId: row.itemId,
    occurredAt: row.occurredAt,
    actorId: context.actor.userId,
    correlationId: context.correlationId,
    payload: {
      centerId: row.centerId,
      itemId: row.itemId,
      kind: nextItem.kind,
      area: nextItem.area,
      status: nextItem.status,
      centerRevision: row.centerRevision,
      itemRevision: row.itemRevision
    }
  });
  return event.ok ? ok(receipt(row, false)) : event;
};

export class GetHouseholdOperationsCenterUseCase {
  public constructor(private readonly query: HouseholdOperationsQueryPort) {}
  public execute(context: LifeApplicationContext): Promise<Result<HouseholdOperationsCenterView, AppError>> {
    const key = centerKey(context);
    return key.ok ? this.query.getCenter(context) : Promise.resolve(key);
  }
}

export class CreateHouseholdOperationItemUseCase {
  public constructor(private readonly unitOfWork: HouseholdOperationsUnitOfWork) {}

  public async execute(input: {
    readonly context: LifeApplicationContext;
    readonly command: CreateHouseholdOperationItemInput;
  }): Promise<Result<HouseholdOperationMutationReceiptView, AppError>> {
    const key = centerKey(input.context);
    if (!key.ok) return key;
    const revisions = validateRevisions(input.context, input.command.expectedCenterRevision);
    if (!revisions.ok) return revisions;
    const ids = validateIdempotency(input.context, input.command.clientOperationId, input.command.itemId);
    if (!ids.ok) return ids;
    if (!householdKinds.has(input.command.kind)) return err(invalid(input.context, 'Hane operasyonu türü geçersizdir.'));
    const title = normalizeText(input.context, input.command.title, 'Başlık', 2, 160);
    if (!title.ok) return title;
    const status = input.command.status ?? 'planned';
    if (!allowedStatuses.has(status)) return err(invalid(input.context, 'Hane operasyonu durumu geçersizdir.'));
    const unit = optionalText(input.context, input.command.unit, 'Birim', 32); if (!unit.ok) return unit;
    const recurrence = optionalText(input.context, input.command.recurrence, 'Tekrar', 160); if (!recurrence.ok) return recurrence;
    const provider = optionalText(input.context, input.command.providerLabel, 'Sağlayıcı etiketi', 120); if (!provider.ok) return provider;
    const guest = optionalText(input.context, input.command.guestLabel, 'Misafir etiketi', 120); if (!guest.ok) return guest;
    const accessArea = optionalText(input.context, input.command.accessArea, 'Erişim alanı', 120); if (!accessArea.ok) return accessArea;
    const pet = optionalText(input.context, input.command.opaquePetReference, 'Evcil hayvan referansı', 128); if (!pet.ok) return pet;
    const note = optionalText(input.context, input.command.note, 'Not', 2_000); if (!note.ok) return note;
    const scheduledAt = iso(input.context, input.command.scheduledAt, 'Planlanan zaman'); if (!scheduledAt.ok) return scheduledAt;
    const dueAt = iso(input.context, input.command.dueAt, 'Son tarih'); if (!dueAt.ok) return dueAt;
    const expiresAt = iso(input.context, input.command.expiresAt, 'Son kullanma tarihi'); if (!expiresAt.ok) return expiresAt;
    if (scheduledAt.value && dueAt.value && Date.parse(dueAt.value) < Date.parse(scheduledAt.value)) {
      return err(invalid(input.context, 'Son tarih planlanan zamandan önce olamaz.'));
    }
    if (input.command.quantity !== undefined && (!Number.isFinite(input.command.quantity) || input.command.quantity < 0 || input.command.quantity > 1_000_000_000)) {
      return err(invalid(input.context, 'Miktar geçersizdir.'));
    }
    const ingredients = canonicalStrings(input.context, input.command.ingredientNames, 'Malzeme', 128); if (!ingredients.ok) return ingredients;
    const allergens = canonicalStrings(input.context, input.command.allergenCodes, 'Alerjen kodu', 64, 64); if (!allergens.ok) return allergens;
    const avoided = canonicalStrings(input.context, input.command.avoidedAllergenCodes, 'Kaçınılan alerjen kodu', 64, 64); if (!avoided.ok) return avoided;
    if (input.command.amountMinor !== undefined && (!Number.isSafeInteger(input.command.amountMinor) || input.command.amountMinor < 0 || input.command.amountMinor > 9_000_000_000_000_000)) {
      return err(invalid(input.context, 'Tutar geçersizdir.'));
    }
    if (input.command.currency !== undefined && !CURRENCY.test(input.command.currency)) return err(invalid(input.context, 'Para birimi geçersizdir.'));
    if (input.command.trackingLastFour !== undefined && !LAST_FOUR.test(input.command.trackingLastFour)) {
      return err(invalid(input.context, 'Teslimat için yalnız dört karakterlik yerel gösterim ipucu kabul edilir.'));
    }

    const request = Object.freeze({ ...input.command, title: title.value });
    const identity = identifiers(input.context, input.command.clientOperationId, input.command.itemId, 'item_create', request);
    if (!SHA256.test(identity.requestFingerprint)) return err(invalid(input.context, 'Hane operasyonu parmak izi üretilemedi.'));
    return this.unitOfWork.execute(input.context, writeIntent(input.context, input.command.itemId, 'create', input.context.actor.personId), (scope) => {
      const currentCenter = scope.findCenter(key.value); if (!currentCenter.ok) return currentCenter;
      const prior = scope.findMutation(key.value, input.command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(input.context, prior.value, {
        kind: 'item_create', itemId: input.command.itemId,
        expectedCenterRevision: input.command.expectedCenterRevision,
        expectedItemRevision: 0, requestFingerprint: identity.requestFingerprint
      });
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      if ((currentCenter.value?.revision ?? 0) !== input.command.expectedCenterRevision) {
        return err(conflict(input.context, 'Hane operasyonu merkez revizyonu değişti.'));
      }
      const existing = scope.findItem(key.value, input.command.itemId); if (!existing.ok) return existing;
      if (existing.value) return err(conflict(input.context, 'Hane operasyonu öğesi zaten mevcut.'));
      if (input.command.assignedPersonId) {
        const assigned = ensurePerson(input.context, scope, input.command.assignedPersonId); if (!assigned.ok) return assigned;
      }
      const shares = validateShares(input.context, scope, input.command.splitShares); if (!shares.ok) return shares;
      let parent: HouseholdOperationItemRow | null = null;
      if (input.command.parentItemId) {
        const foundParent = scope.findItem(key.value, input.command.parentItemId); if (!foundParent.ok) return foundParent;
        parent = foundParent.value;
        if (!parent || parent.status === 'deleted') return err(notFound(input.context, 'Üst hane operasyonu öğesi bulunamadı.'));
      }
      if (input.command.kind === 'shopping_item' && parent?.kind !== 'shopping_list') {
        return err(invalid(input.context, 'Alışveriş öğesi etkin bir alışveriş listesine bağlı olmalıdır.'));
      }
      if (input.command.kind === 'meal_plan' && parent?.kind !== 'recipe') {
        return err(invalid(input.context, 'Öğün planı etkin bir tarife bağlı olmalıdır.'));
      }
      if (input.command.kind === 'recipe' && (!ingredients.value || ingredients.value.length === 0)) {
        return err(invalid(input.context, 'Tarif en az bir malzeme gerektirir.'));
      }
      if (input.command.kind === 'stock_item' && (!input.command.stockCategory || input.command.quantity === undefined || !unit.value)) {
        return err(invalid(input.context, 'Stok öğesi kategori, miktar ve birim gerektirir.'));
      }
      const expenseKind = input.command.kind === 'bill' || input.command.kind === 'subscription' || input.command.kind === 'shared_expense';
      if (expenseKind && (input.command.amountMinor === undefined || !input.command.currency)) {
        return err(invalid(input.context, 'Gider kaydı tutar ve para birimi gerektirir.'));
      }
      if (input.command.kind === 'shared_expense' && !shares.value) {
        return err(invalid(input.context, 'Ortak gider tam pay dağılımı gerektirir.'));
      }
      if (input.command.kind === 'delivery' && (!provider.value || !input.command.trackingLastFour)) {
        return err(invalid(input.context, 'Teslimat kaydı sağlayıcı etiketi ve yalnız son dört karakteri gerektirir.'));
      }
      if (input.command.kind === 'guest_access' && (!guest.value || !accessArea.value || !scheduledAt.value || !dueAt.value)) {
        return err(invalid(input.context, 'Misafir erişim planı etiket, alan, başlangıç ve bitiş gerektirir.'));
      }
      if (input.command.kind === 'pet_care' && !pet.value) return err(invalid(input.context, 'Evcil hayvan bakım görevi yerel bir referans gerektirir.'));
      if (input.command.kind === 'meal_plan') {
        const blocked = new Set(avoided.value ?? []);
        if ((parent!.allergenCodes ?? []).some((code) => blocked.has(code))) {
          return err(conflict(input.context, 'Öğün planı kaçınılan alerjenlerden birini içeren tarife bağlanamaz.'));
        }
      }
      const base = Object.freeze({
        id: input.command.itemId,
        centerId: key.value.centerId,
        familyId: key.value.familyId,
        ownerPersonId: input.context.actor.personId!,
        kind: input.command.kind,
        area: householdOperationAreaForKind(input.command.kind),
        title: title.value,
        status,
        revision: 1,
        ...(input.command.parentItemId ? { parentItemId: input.command.parentItemId } : {}),
        ...(input.command.assignedPersonId ? { assignedPersonId: asPersonId(input.command.assignedPersonId) } : {}),
        ...(input.command.stockCategory ? { stockCategory: input.command.stockCategory } : {}),
        ...(input.command.quantity !== undefined ? { quantity: input.command.quantity } : {}),
        ...(unit.value ? { unit: unit.value } : {}),
        ...(scheduledAt.value ? { scheduledAt: scheduledAt.value } : {}),
        ...(dueAt.value ? { dueAt: dueAt.value } : {}),
        ...(expiresAt.value ? { expiresAt: expiresAt.value } : {}),
        ...(recurrence.value ? { recurrence: recurrence.value } : {}),
        ...(input.command.amountMinor !== undefined ? { amountMinor: input.command.amountMinor } : {}),
        ...(input.command.currency ? { currency: input.command.currency } : {}),
        ...(shares.value ? { splitShares: shares.value } : {}),
        ...(ingredients.value ? { ingredientNames: ingredients.value } : {}),
        ...(allergens.value ? { allergenCodes: allergens.value } : {}),
        ...(avoided.value ? { avoidedAllergenCodes: avoided.value } : {}),
        allergyFilterStatus: input.command.kind === 'meal_plan' ? 'clear' as const : 'not_applicable' as const,
        ...(provider.value ? { providerLabel: provider.value } : {}),
        ...(input.command.trackingLastFour ? { trackingLastFour: input.command.trackingLastFour } : {}),
        ...(guest.value ? { guestLabel: guest.value } : {}),
        ...(accessArea.value ? { accessArea: accessArea.value } : {}),
        ...(pet.value ? { opaquePetReference: pet.value } : {}),
        ...(note.value ? { note: note.value } : {}),
        lastMutationId: identity.mutationId,
        createdAt: scope.occurredAt,
        updatedAt: scope.occurredAt
      }) satisfies Omit<HouseholdOperationItemRow, 'stateFingerprint'>;
      const nextItem: HouseholdOperationItemRow = Object.freeze({ ...base, stateFingerprint: itemFingerprint(base) });
      const nextCenter = centerNext(key.value, currentCenter.value, identity.mutationId, nextItem.id, nextItem.stateFingerprint, scope.occurredAt);
      const row = mutation({
        context: input.context, key: key.value, kind: 'item_create', clientOperationId: input.command.clientOperationId,
        requestFingerprint: identity.requestFingerprint, mutationId: identity.mutationId,
        currentCenter: currentCenter.value, nextCenter, previousItemRevision: 0, nextItem, occurredAt: scope.occurredAt
      });
      return persistMutation(input.context, scope, row, currentCenter.value, nextCenter, nextItem, 0, identity.auditId, identity.eventId);
    });
  }
}

export class UpdateHouseholdOperationItemUseCase {
  public constructor(private readonly unitOfWork: HouseholdOperationsUnitOfWork) {}

  public async execute(input: {
    readonly context: LifeApplicationContext;
    readonly command: UpdateHouseholdOperationItemInput;
  }): Promise<Result<HouseholdOperationMutationReceiptView, AppError>> {
    const key = centerKey(input.context); if (!key.ok) return key;
    const revisions = validateRevisions(input.context, input.command.expectedCenterRevision, input.command.expectedItemRevision); if (!revisions.ok) return revisions;
    const ids = validateIdempotency(input.context, input.command.clientOperationId, input.command.itemId); if (!ids.ok) return ids;
    const patchCount = ['status','assignedPersonId','quantity','scheduledAt','dueAt','expiresAt','note']
      .filter((field) => Object.prototype.hasOwnProperty.call(input.command, field)).length;
    if (patchCount === 0) return err(invalid(input.context, 'Hane operasyonu güncellemesi en az bir alan gerektirir.'));
    if (input.command.status !== undefined && !allowedStatuses.has(input.command.status)) return err(invalid(input.context, 'Hane operasyonu durumu geçersizdir.'));
    if (input.command.quantity !== undefined && (!Number.isFinite(input.command.quantity) || input.command.quantity < 0 || input.command.quantity > 1_000_000_000)) return err(invalid(input.context, 'Miktar geçersizdir.'));
    const scheduledAt = input.command.scheduledAt === null ? ok(null) : iso(input.context, input.command.scheduledAt, 'Planlanan zaman'); if (!scheduledAt.ok) return scheduledAt;
    const dueAt = input.command.dueAt === null ? ok(null) : iso(input.context, input.command.dueAt, 'Son tarih'); if (!dueAt.ok) return dueAt;
    const expiresAt = input.command.expiresAt === null ? ok(null) : iso(input.context, input.command.expiresAt, 'Son kullanma tarihi'); if (!expiresAt.ok) return expiresAt;
    const note = input.command.note === null ? ok(null) : optionalText(input.context, input.command.note, 'Not', 2_000); if (!note.ok) return note;
    const identity = identifiers(input.context, input.command.clientOperationId, input.command.itemId, 'item_update', input.command);
    return this.unitOfWork.execute(input.context, writeIntent(input.context, input.command.itemId, 'update'), (scope) => {
      const currentCenter = scope.findCenter(key.value); if (!currentCenter.ok) return currentCenter;
      const currentItem = scope.findItem(key.value, input.command.itemId); if (!currentItem.ok) return currentItem;
      const prior = scope.findMutation(key.value, input.command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(input.context, prior.value, {
        kind: 'item_update', itemId: input.command.itemId, expectedCenterRevision: input.command.expectedCenterRevision,
        expectedItemRevision: input.command.expectedItemRevision, requestFingerprint: identity.requestFingerprint
      });
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      if (!currentCenter.value || currentCenter.value.revision !== input.command.expectedCenterRevision) return err(conflict(input.context, 'Hane operasyonu merkez revizyonu değişti.'));
      if (!currentItem.value || currentItem.value.status === 'deleted') return err(notFound(input.context, 'Etkin hane operasyonu öğesi bulunamadı.'));
      if (currentItem.value.revision !== input.command.expectedItemRevision) return err(conflict(input.context, 'Hane operasyonu öğe revizyonu değişti.'));
      if (typeof input.command.assignedPersonId === 'string') {
        const assigned = ensurePerson(input.context, scope, input.command.assignedPersonId); if (!assigned.ok) return assigned;
      }
      const base: Record<string, unknown> = {
        ...currentItem.value,
        ...(input.command.status !== undefined ? { status: input.command.status } : {}),
        ...(input.command.quantity !== undefined ? { quantity: input.command.quantity } : {}),
        revision: currentItem.value.revision + 1,
        lastMutationId: identity.mutationId,
        updatedAt: scope.occurredAt
      };
      delete base.stateFingerprint;
      if (input.command.assignedPersonId === null) delete base.assignedPersonId;
      else if (input.command.assignedPersonId !== undefined) base.assignedPersonId = asPersonId(input.command.assignedPersonId);
      for (const [field, value] of [
        ['scheduledAt', scheduledAt.value], ['dueAt', dueAt.value], ['expiresAt', expiresAt.value], ['note', note.value]
      ] as const) {
        if (!Object.prototype.hasOwnProperty.call(input.command, field)) continue;
        if (value === null || value === undefined) delete base[field];
        else base[field] = value;
      }
      const nextItemBase = base as unknown as Omit<HouseholdOperationItemRow, 'stateFingerprint'>;
      const nextItem: HouseholdOperationItemRow = Object.freeze({ ...nextItemBase, stateFingerprint: itemFingerprint(nextItemBase) });
      const nextCenter = centerNext(key.value, currentCenter.value, identity.mutationId, nextItem.id, nextItem.stateFingerprint, scope.occurredAt);
      const row = mutation({ context: input.context, key: key.value, kind: 'item_update', clientOperationId: input.command.clientOperationId,
        requestFingerprint: identity.requestFingerprint, mutationId: identity.mutationId, currentCenter: currentCenter.value,
        nextCenter, previousItemRevision: currentItem.value.revision, nextItem, occurredAt: scope.occurredAt });
      return persistMutation(input.context, scope, row, currentCenter.value, nextCenter, nextItem, currentItem.value.revision, identity.auditId, identity.eventId);
    });
  }
}

export class DeleteHouseholdOperationItemUseCase {
  public constructor(private readonly unitOfWork: HouseholdOperationsUnitOfWork) {}

  public async execute(input: {
    readonly context: LifeApplicationContext;
    readonly command: DeleteHouseholdOperationItemInput;
  }): Promise<Result<HouseholdOperationMutationReceiptView, AppError>> {
    const key = centerKey(input.context); if (!key.ok) return key;
    const revisions = validateRevisions(input.context, input.command.expectedCenterRevision, input.command.expectedItemRevision); if (!revisions.ok) return revisions;
    const ids = validateIdempotency(input.context, input.command.clientOperationId, input.command.itemId); if (!ids.ok) return ids;
    const reason = normalizeText(input.context, input.command.reason, 'Silme gerekçesi', 3, 240); if (!reason.ok) return reason;
    const identity = identifiers(input.context, input.command.clientOperationId, input.command.itemId, 'item_delete', { ...input.command, reason: reason.value });
    return this.unitOfWork.execute(input.context, writeIntent(input.context, input.command.itemId, 'delete'), (scope) => {
      const currentCenter = scope.findCenter(key.value); if (!currentCenter.ok) return currentCenter;
      const currentItem = scope.findItem(key.value, input.command.itemId); if (!currentItem.ok) return currentItem;
      const prior = scope.findMutation(key.value, input.command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(input.context, prior.value, { kind: 'item_delete', itemId: input.command.itemId,
        expectedCenterRevision: input.command.expectedCenterRevision, expectedItemRevision: input.command.expectedItemRevision,
        requestFingerprint: identity.requestFingerprint });
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      if (!currentCenter.value || currentCenter.value.revision !== input.command.expectedCenterRevision) return err(conflict(input.context, 'Hane operasyonu merkez revizyonu değişti.'));
      if (!currentItem.value || currentItem.value.status === 'deleted') return err(notFound(input.context, 'Etkin hane operasyonu öğesi bulunamadı.'));
      if (currentItem.value.revision !== input.command.expectedItemRevision) return err(conflict(input.context, 'Hane operasyonu öğe revizyonu değişti.'));
      const base = { ...currentItem.value, status: 'deleted' as const, revision: currentItem.value.revision + 1,
        note: reason.value, lastMutationId: identity.mutationId, updatedAt: scope.occurredAt, deletedAt: scope.occurredAt } as
        Omit<HouseholdOperationItemRow, 'stateFingerprint'> & { stateFingerprint?: string };
      delete base.stateFingerprint;
      const nextItem: HouseholdOperationItemRow = Object.freeze({ ...base, stateFingerprint: itemFingerprint(base) } as HouseholdOperationItemRow);
      const nextCenter = centerNext(key.value, currentCenter.value, identity.mutationId, nextItem.id, nextItem.stateFingerprint, scope.occurredAt);
      const row = mutation({ context: input.context, key: key.value, kind: 'item_delete', clientOperationId: input.command.clientOperationId,
        requestFingerprint: identity.requestFingerprint, mutationId: identity.mutationId, currentCenter: currentCenter.value,
        nextCenter, previousItemRevision: currentItem.value.revision, nextItem, occurredAt: scope.occurredAt });
      return persistMutation(input.context, scope, row, currentCenter.value, nextCenter, nextItem, currentItem.value.revision, identity.auditId, identity.eventId);
    });
  }
}

export const householdOperationsReadIntent = readIntent;
export const householdOperationsTruth = Object.freeze({
  localOnly: true as const,
  externalShoppingOrder: 'not_performed' as const,
  automaticInventoryScan: 'not_configured' as const,
  recipeMedicalAdvice: 'not_provided' as const,
  paymentExecution: 'not_performed' as const,
  carrierSynchronization: 'not_performed' as const,
  remoteAccessControl: 'not_configured' as const,
  keyCodeStored: false as const,
  petCareDelivery: 'not_performed' as const
});

export const emptyHouseholdOperationsCounts = (): Record<(typeof HOUSEHOLD_OPERATION_AREAS)[number], number> => ({
  shopping: 0,
  inventory: 0,
  meals: 0,
  chores: 0,
  expenses: 0,
  deliveries: 0,
  guests: 0,
  pets: 0
});
