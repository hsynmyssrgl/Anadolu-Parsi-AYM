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
import type { DomainEvent } from '@ppt/events';
import {
  SMART_HOME_DEVICE_KINDS,
  SMART_HOME_MAX_CAMERA_CONSENTS,
  SMART_HOME_MAX_DEVICES,
  SMART_HOME_MAX_MUTATIONS,
  SMART_HOME_MAX_OBSERVATIONS,
  SMART_HOME_OBSERVATION_KINDS,
  type GrantSmartHomeCameraConsentInput,
  type RecordSmartHomeObservationInput,
  type RegisterSmartHomeDeviceInput,
  type RevokeSmartHomeCameraConsentInput,
  type SetSmartHomeProcessingInput,
  type SmartHomeDeviceKind,
  type SmartHomeEnergyCenterView,
  type SmartHomeMutationKind,
  type SmartHomeMutationReceiptView,
  type SmartHomeObservationKind,
  type SmartHomeObservationUnit,
  type SmartHomeResourceType,
  type UpdateSmartHomeDeviceStatusInput
} from '@ppt/domain';
import type {
  SmartHomeCameraConsentRow,
  SmartHomeDeviceRow,
  SmartHomeEnergyCenterKey,
  SmartHomeMutationRow,
  SmartHomeObservationRow,
  SmartHomeSettingsRow,
  SmartHomeStorageUsageRow
} from '@ppt/repository-contracts';
import type { LifeApplicationContext, LifePolicyIntent } from './life-use-cases.js';

export interface SmartHomeEnergyQueryPort {
  getCenter(context: LifeApplicationContext): Promise<Result<SmartHomeEnergyCenterView, AppError>>;
}

export interface SmartHomeEnergyWriteScope {
  readonly occurredAt: SmartHomeMutationRow['occurredAt'];
  readonly ownerPersonId: SmartHomeEnergyCenterKey['ownerPersonId'];
  findDevice(deviceId: string): Result<SmartHomeDeviceRow | null, AppError>;
  findConsent(consentId: string): Result<SmartHomeCameraConsentRow | null, AppError>;
  findSettings(): Result<SmartHomeSettingsRow | null, AppError>;
  getStorageUsage(): Result<SmartHomeStorageUsageRow, AppError>;
  findMutation(clientOperationId: string): Result<SmartHomeMutationRow | null, AppError>;
  insertMutation(row: SmartHomeMutationRow): Result<void, AppError>;
  insertDevice(row: SmartHomeDeviceRow): Result<void, AppError>;
  saveDevice(row: SmartHomeDeviceRow, expectedRevision: number): Result<void, AppError>;
  insertObservation(row: SmartHomeObservationRow): Result<void, AppError>;
  insertConsent(row: SmartHomeCameraConsentRow): Result<void, AppError>;
  saveConsent(row: SmartHomeCameraConsentRow, expectedRevision: number): Result<void, AppError>;
  insertSettings(row: SmartHomeSettingsRow): Result<void, AppError>;
  saveSettings(row: SmartHomeSettingsRow, expectedRevision: number): Result<void, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: SmartHomeMutationRow['occurredAt'];
    readonly actorId: LifeApplicationContext['actor']['userId'];
  }): Result<string, AppError>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
}

export interface SmartHomeEnergyUnitOfWork {
  execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: SmartHomeEnergyWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,159}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const CONTROL = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const EXACT_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const deviceKinds = new Set<string>(SMART_HOME_DEVICE_KINDS);
const observationKinds = new Set<string>(SMART_HOME_OBSERVATION_KINDS);
const booleanKinds = new Set<SmartHomeObservationKind>([
  'smoke_alarm', 'carbon_monoxide_alarm', 'water_leak_alarm', 'door_open', 'light_on', 'smart_plug_on'
]);
const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(null);
};
const hash = (value: unknown): string => createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
const exactRecord = (value: unknown, required: readonly string[], optional: readonly string[] = []): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value); if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value); if (keys.some((key) => typeof key === 'symbol')) return false;
  const allowed = new Set([...required, ...optional]); if (keys.some((key) => !allowed.has(String(key)))) return false;
  if (required.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) return false;
  return keys.every((key) => { const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return Boolean(descriptor && !descriptor.get && !descriptor.set && 'value' in descriptor); });
};

const appError = (
  context: LifeApplicationContext,
  code: typeof ERROR_CODES.CORE_INVALID_ARGUMENT | typeof ERROR_CODES.RESOURCE_CONFLICT |
    typeof ERROR_CODES.RESOURCE_NOT_FOUND | typeof ERROR_CODES.AUTHORIZATION_DENIED,
  message: string,
  category: 'validation' | 'conflict' | 'not_found' | 'authorization'
): AppError => createAppError({ code, message, category, correlationId: context.correlationId });
const invalid = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.CORE_INVALID_ARGUMENT, message, 'validation');
const conflict = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.RESOURCE_CONFLICT, message, 'conflict');
const missing = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.RESOURCE_NOT_FOUND, message, 'not_found');
const denied = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.AUTHORIZATION_DENIED, message, 'authorization');

const requireActor = (context: LifeApplicationContext): Result<NonNullable<LifeApplicationContext['actor']['personId']>, AppError> =>
  context.actor.personId ? ok(context.actor.personId) : err(denied(context, 'Akıllı ev alanı kişi bağlı oturum gerektirir.'));

const normalizeText = (
  context: LifeApplicationContext,
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
  optional = false
): Result<string | undefined, AppError> => {
  if (optional && (value === undefined || value === '')) return ok(undefined);
  if (typeof value !== 'string') return err(invalid(context, `${field} metin olmalıdır.`));
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return normalized.length >= minimum && normalized.length <= maximum && !CONTROL.test(normalized)
    ? ok(normalized)
    : err(invalid(context, `${field} sınırları geçersizdir.`));
};

const revision = (context: LifeApplicationContext, value: unknown, allowZero = false): Result<number, AppError> =>
  Number.isSafeInteger(value) && Number(value) >= (allowZero ? 0 : 1)
    ? ok(Number(value)) : err(invalid(context, 'Beklenen sürüm geçersizdir.'));

const parseDate = (context: LifeApplicationContext, value: unknown, field: string): Result<ReturnType<typeof asIsoDateTime>, AppError> => {
  if (typeof value !== 'string' || !EXACT_ISO.test(value) || !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value) return err(invalid(context, `${field} zamanı geçersizdir.`));
  return ok(asIsoDateTime(value));
};

type CapacityKind = 'device' | 'observation' | 'camera_consent' | 'mutation_only';
const ensureCapacity = (
  context: LifeApplicationContext,
  usage: SmartHomeStorageUsageRow,
  kind: CapacityKind
): Result<void, AppError> => {
  if (usage.mutationCount >= SMART_HOME_MAX_MUTATIONS)
    return err(conflict(context, 'Akıllı ev mutation kapasitesi doludur; yeni yazım fail-closed kapatıldı.'));
  if (kind === 'device' && usage.deviceCount >= SMART_HOME_MAX_DEVICES)
    return err(conflict(context, 'Akıllı ev cihaz kapasitesi doludur.'));
  if (kind === 'observation' && usage.observationCount >= SMART_HOME_MAX_OBSERVATIONS)
    return err(conflict(context, 'Akıllı ev gözlem kapasitesi doludur.'));
  if (kind === 'camera_consent' && usage.cameraConsentCount >= SMART_HOME_MAX_CAMERA_CONSENTS)
    return err(conflict(context, 'Akıllı ev kamera izin kapasitesi doludur.'));
  return ok(undefined);
};

const requireMonotonicTime = (
  context: LifeApplicationContext,
  occurredAt: string,
  previousUpdatedAt: string
): Result<void, AppError> => Date.parse(occurredAt) >= Date.parse(previousUpdatedAt)
  ? ok(undefined) : err(conflict(context, 'Akıllı ev durum zamanı geriye gidemez.'));

export const smartHomeEnergyReadIntent = (): LifePolicyIntent => ({
  action: 'read', capability: 'family.read', resourceType: 'smart_home_energy_center', resourceId: '*', purpose: 'general'
});
const writeIntent = (
  resourceType: SmartHomeResourceType,
  resourceId: string,
  action: 'create' | 'update' | 'delete',
  ownerPersonId?: string
): LifePolicyIntent => ({
  action, capability: 'family.write', resourceType, resourceId, purpose: 'general',
  ...(action === 'create' && ownerPersonId ? { ownerPersonId: asPersonId(ownerPersonId), privacy: 'private' as const } : {})
});

const deviceFingerprint = (row: Omit<SmartHomeDeviceRow, 'stateFingerprint'>): string => hash({
  id: row.id, familyId: row.familyId, ownerPersonId: row.ownerPersonId, adapterId: row.adapterId,
  providerId: row.providerId, kind: row.kind, label: row.label, room: row.room ?? null, status: row.status,
  localIdentifierSha256: row.localIdentifierSha256, adapterManifestSha256: row.adapterManifestSha256,
  adapterSignerKeyId: row.adapterSignerKeyId, signedAdapterEvidencePersisted: row.signedAdapterEvidencePersisted,
  revision: row.revision, lastMutationId: row.lastMutationId, createdAt: row.createdAt, updatedAt: row.updatedAt
});
const observationFingerprint = (row: Omit<SmartHomeObservationRow, 'stateFingerprint'>): string => hash({
  id: row.id, familyId: row.familyId, ownerPersonId: row.ownerPersonId, deviceId: row.deviceId, kind: row.kind,
  unit: row.unit, numericValue: row.numericValue ?? null, booleanValue: row.booleanValue ?? null,
  observedAt: row.observedAt, recordedAt: row.recordedAt, sourceManifestSha256: row.sourceManifestSha256,
  lastMutationId: row.lastMutationId
});
const consentFingerprint = (row: Omit<SmartHomeCameraConsentRow, 'stateFingerprint'>): string => hash({
  id: row.id, familyId: row.familyId, ownerPersonId: row.ownerPersonId, deviceId: row.deviceId, purpose: row.purpose,
  status: row.status, grantedByAccountId: row.grantedByAccountId, grantedByPersonId: row.grantedByPersonId,
  visibleIndicatorRequired: row.visibleIndicatorRequired, expiresAt: row.expiresAt, revision: row.revision,
  lastMutationId: row.lastMutationId, createdAt: row.createdAt, updatedAt: row.updatedAt, revokedAt: row.revokedAt ?? null
});
const settingsFingerprint = (row: Omit<SmartHomeSettingsRow, 'stateFingerprint'>): string => hash({
  id: row.id, familyId: row.familyId, ownerPersonId: row.ownerPersonId, processingEnabled: row.processingEnabled,
  cameraAccessDefaultDenied: row.cameraAccessDefaultDenied, hiddenSurveillanceProhibited: row.hiddenSurveillanceProhibited,
  revision: row.revision, lastMutationId: row.lastMutationId, createdAt: row.createdAt, updatedAt: row.updatedAt
});

const mutationId = (context: LifeApplicationContext, clientOperationId: string, requestFingerprint: string): string =>
  hash({ familyId: context.familyId, accountId: context.actor.userId, clientOperationId, requestFingerprint });
const mutationReceipt = (row: SmartHomeMutationRow, replayed: boolean): SmartHomeMutationReceiptView => Object.freeze({
  resourceType: row.resourceType, resourceId: row.resourceId, mutationKind: row.mutationKind,
  previousRevision: row.expectedRevision, revision: row.revision, occurredAt: row.occurredAt, replayed,
  networkUsed: false, cloudUsed: false, providerActionPerformed: 'not_performed'
});
const replay = (
  context: LifeApplicationContext,
  existing: SmartHomeMutationRow | null,
  requestFingerprint: string,
  mutationKind: SmartHomeMutationKind,
  resourceType: SmartHomeResourceType,
  resourceId: string
): Result<SmartHomeMutationReceiptView | null, AppError> => {
  if (!existing) return ok(null);
  return existing.requestFingerprint === requestFingerprint && existing.mutationKind === mutationKind &&
    existing.resourceType === resourceType && existing.resourceId === resourceId
    ? ok(mutationReceipt(existing, true))
    : err(conflict(context, 'Aynı işlem kimliği farklı bir akıllı ev komutuyla kullanıldı.'));
};

const persist = (
  context: LifeApplicationContext,
  scope: SmartHomeEnergyWriteScope,
  mutation: SmartHomeMutationRow,
  writeCurrent: () => Result<void, AppError>
): Result<SmartHomeMutationReceiptView, AppError> => {
  const ledger = scope.insertMutation(mutation); if (!ledger.ok) return ledger;
  const current = writeCurrent(); if (!current.ok) return current;
  const audit = scope.appendAudit({ id: hash({ mutationId: mutation.id, kind: 'audit' }),
    action: `smart_home.${mutation.mutationKind}`, resourceType: mutation.resourceType,
    resourceId: mutation.resourceId, occurredAt: mutation.occurredAt, actorId: context.actor.userId });
  if (!audit.ok) return audit;
  const event = scope.enqueueEvent({ eventId: asEventId(hash({ mutationId: mutation.id, kind: 'event' })),
    eventType: `smart_home.${mutation.mutationKind}`, eventVersion: 1, aggregateType: mutation.resourceType,
    aggregateId: mutation.resourceId, occurredAt: mutation.occurredAt, actorId: context.actor.userId,
    correlationId: context.correlationId, payload: { resourceType: mutation.resourceType, resourceId: mutation.resourceId,
      mutationKind: mutation.mutationKind, revision: mutation.revision, networkUsed: false, cloudUsed: false,
      providerActionPerformed: 'not_performed' } });
  return event.ok ? ok(mutationReceipt(mutation, false)) : event;
};

const mutation = (
  context: LifeApplicationContext,
  scope: SmartHomeEnergyWriteScope,
  actorPersonId: NonNullable<LifeApplicationContext['actor']['personId']>,
  input: {
    readonly id: string;
    readonly resourceType: SmartHomeResourceType;
    readonly resourceId: string;
    readonly mutationKind: SmartHomeMutationKind;
    readonly clientOperationId: string;
    readonly requestFingerprint: string;
    readonly expectedRevision: number;
    readonly revision: number;
    readonly stateFingerprint: string;
  }
): SmartHomeMutationRow => Object.freeze({
  id: input.id, familyId: context.familyId, ownerPersonId: scope.ownerPersonId, resourceType: input.resourceType,
  resourceId: input.resourceId, actorAccountId: context.actor.userId, actorPersonId, mutationKind: input.mutationKind,
  clientOperationId: input.clientOperationId, requestFingerprint: input.requestFingerprint,
  expectedRevision: input.expectedRevision, revision: input.revision,
  resourceStateFingerprint: input.stateFingerprint, occurredAt: asIsoDateTime(scope.occurredAt)
});

const unitFor = (kind: SmartHomeObservationKind): SmartHomeObservationUnit => {
  if (booleanKinds.has(kind)) return 'boolean';
  if (kind === 'temperature_celsius' || kind === 'thermostat_target_celsius') return 'celsius';
  if (kind === 'humidity_percent') return 'percent';
  if (kind === 'power_watts') return 'watt';
  return 'kilowatt_hour';
};

const compatibleKinds: Readonly<Record<SmartHomeObservationKind, readonly SmartHomeDeviceKind[]>> = Object.freeze({
  smoke_alarm: ['smoke_sensor'], carbon_monoxide_alarm: ['carbon_monoxide_sensor'], water_leak_alarm: ['water_leak_sensor'],
  door_open: ['door_sensor', 'doorbell'], temperature_celsius: ['temperature_sensor', 'thermostat'],
  humidity_percent: ['humidity_sensor'], energy_kilowatt_hour: ['energy_meter', 'smart_plug', 'ev_charger'],
  power_watts: ['energy_meter', 'smart_plug', 'ev_charger'], ev_charge_kilowatt_hour: ['ev_charger'],
  thermostat_target_celsius: ['thermostat'], light_on: ['light'], smart_plug_on: ['smart_plug']
});

const validNumericObservation = (kind: SmartHomeObservationKind, value: number): boolean => {
  if (!Number.isFinite(value)) return false;
  if (kind === 'temperature_celsius') return value >= -100 && value <= 100;
  if (kind === 'thermostat_target_celsius') return value >= -50 && value <= 60;
  if (kind === 'humidity_percent') return value >= 0 && value <= 100;
  return value >= 0 && value <= 1_000_000_000;
};

export class GetSmartHomeEnergyCenterUseCase {
  public constructor(private readonly queryPort: SmartHomeEnergyQueryPort) {}
  public execute(context: LifeApplicationContext): Promise<Result<SmartHomeEnergyCenterView, AppError>> {
    return this.queryPort.getCenter(context);
  }
}

export class RegisterSmartHomeDeviceUseCase {
  public constructor(private readonly unitOfWork: SmartHomeEnergyUnitOfWork) {}
  public async execute(input: { readonly context: LifeApplicationContext; readonly command: RegisterSmartHomeDeviceInput })
  : Promise<Result<SmartHomeMutationReceiptView, AppError>> {
    const { context, command } = input; const actor = requireActor(context); if (!actor.ok) return actor;
    if (!exactRecord(command, ['clientOperationId', 'deviceId', 'adapterId', 'providerId', 'kind', 'label',
      'localIdentifierSha256', 'adapterManifestSha256', 'adapterSignerKeyId', 'adapterSignatureVerified'], ['room']))
      return err(invalid(context, 'Cihaz kayıt komutu exact sözleşmeyle eşleşmiyor.'));
    if (![command.clientOperationId, command.deviceId, command.adapterId, command.providerId, command.adapterSignerKeyId].every(SAFE_ID.test.bind(SAFE_ID)) ||
      !deviceKinds.has(command.kind) || !SHA256.test(command.localIdentifierSha256) || !SHA256.test(command.adapterManifestSha256) ||
      command.adapterSignatureVerified !== true) return err(denied(context, 'Cihaz yalnız doğrulanmış imzalı adapter kanıtıyla kaydedilebilir.'));
    const label = normalizeText(context, command.label, 'Cihaz etiketi', 2, 120); if (!label.ok) return label;
    const room = normalizeText(context, command.room, 'Oda', 2, 120, true); if (!room.ok) return room;
    const requestFingerprint = hash({ clientOperationId: command.clientOperationId, deviceId: command.deviceId,
      adapterId: command.adapterId, providerId: command.providerId, kind: command.kind, label: label.value,
      room: room.value ?? null, localIdentifierSha256: command.localIdentifierSha256,
      adapterManifestSha256: command.adapterManifestSha256, adapterSignerKeyId: command.adapterSignerKeyId,
      adapterSignatureVerified: true });
    return this.unitOfWork.execute(context, writeIntent('smart_home_device', command.deviceId, 'create', actor.value), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, requestFingerprint, 'device_register', 'smart_home_device', command.deviceId);
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      const found = scope.findDevice(command.deviceId); if (!found.ok) return found;
      if (found.value) return err(conflict(context, 'Akıllı ev cihaz kimliği zaten kullanılıyor.'));
      const usage = scope.getStorageUsage(); if (!usage.ok) return usage;
      const capacity = ensureCapacity(context, usage.value, 'device'); if (!capacity.ok) return capacity;
      const occurredAt = asIsoDateTime(scope.occurredAt); const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const base: Omit<SmartHomeDeviceRow, 'stateFingerprint'> = { id: command.deviceId, familyId: context.familyId,
        ownerPersonId: scope.ownerPersonId, adapterId: command.adapterId, providerId: command.providerId,
        kind: command.kind, label: label.value!, ...(room.value ? { room: room.value } : {}), status: 'active',
        localIdentifierSha256: command.localIdentifierSha256, adapterManifestSha256: command.adapterManifestSha256,
        adapterSignerKeyId: command.adapterSignerKeyId, signedAdapterEvidencePersisted: true, revision: 1,
        lastMutationId: id, createdAt: occurredAt, updatedAt: occurredAt };
      const row: SmartHomeDeviceRow = Object.freeze({ ...base, stateFingerprint: deviceFingerprint(base) });
      const ledger = mutation(context, scope, actor.value, { id, resourceType: 'smart_home_device', resourceId: row.id,
        mutationKind: 'device_register', clientOperationId: command.clientOperationId, requestFingerprint,
        expectedRevision: 0, revision: 1, stateFingerprint: row.stateFingerprint });
      return persist(context, scope, ledger, () => scope.insertDevice(row));
    });
  }
}

export class UpdateSmartHomeDeviceStatusUseCase {
  public constructor(private readonly unitOfWork: SmartHomeEnergyUnitOfWork) {}
  public async execute(input: { readonly context: LifeApplicationContext; readonly command: UpdateSmartHomeDeviceStatusInput })
  : Promise<Result<SmartHomeMutationReceiptView, AppError>> {
    const { context, command } = input; const actor = requireActor(context); if (!actor.ok) return actor;
    if (!exactRecord(command, ['clientOperationId', 'deviceId', 'expectedRevision', 'status']))
      return err(invalid(context, 'Cihaz durum komutu exact sözleşmeyle eşleşmiyor.'));
    const expected = revision(context, command.expectedRevision); if (!expected.ok) return expected;
    if (!SAFE_ID.test(command.clientOperationId) || !SAFE_ID.test(command.deviceId) ||
      !['active', 'offline', 'retired'].includes(command.status)) return err(invalid(context, 'Cihaz durum komutu geçersizdir.'));
    const requestFingerprint = hash({ clientOperationId: command.clientOperationId, deviceId: command.deviceId,
      expectedRevision: expected.value, status: command.status });
    return this.unitOfWork.execute(context, writeIntent('smart_home_device', command.deviceId, 'update'), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, requestFingerprint, 'device_status_update', 'smart_home_device', command.deviceId);
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      const found = scope.findDevice(command.deviceId); if (!found.ok) return found;
      if (!found.value) return err(missing(context, 'Akıllı ev cihazı bulunamadı.'));
      if (found.value.revision !== expected.value || found.value.status === 'retired' || found.value.status === command.status)
        return err(conflict(context, 'Cihaz sürümü veya durumu değişti.'));
      const occurredAt = asIsoDateTime(scope.occurredAt); const nextRevision = found.value.revision + 1;
      const monotonic = requireMonotonicTime(context, occurredAt, found.value.updatedAt); if (!monotonic.ok) return monotonic;
      const usage = scope.getStorageUsage(); if (!usage.ok) return usage;
      const capacity = ensureCapacity(context, usage.value, 'mutation_only'); if (!capacity.ok) return capacity;
      const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const base: Omit<SmartHomeDeviceRow, 'stateFingerprint'> = { ...found.value, status: command.status,
        revision: nextRevision, lastMutationId: id, updatedAt: occurredAt };
      const row: SmartHomeDeviceRow = Object.freeze({ ...base, stateFingerprint: deviceFingerprint(base) });
      const ledger = mutation(context, scope, actor.value, { id, resourceType: 'smart_home_device', resourceId: row.id,
        mutationKind: 'device_status_update', clientOperationId: command.clientOperationId, requestFingerprint,
        expectedRevision: found.value.revision, revision: nextRevision, stateFingerprint: row.stateFingerprint });
      return persist(context, scope, ledger, () => scope.saveDevice(row, found.value!.revision));
    });
  }
}

export class RecordSmartHomeObservationUseCase {
  public constructor(private readonly unitOfWork: SmartHomeEnergyUnitOfWork) {}
  public async execute(input: { readonly context: LifeApplicationContext; readonly command: RecordSmartHomeObservationInput })
  : Promise<Result<SmartHomeMutationReceiptView, AppError>> {
    const { context, command } = input; const actor = requireActor(context); if (!actor.ok) return actor;
    if (!exactRecord(command, ['clientOperationId', 'observationId', 'deviceId', 'expectedDeviceRevision', 'kind',
      'observedAt', 'sourceManifestSha256'], ['numericValue', 'booleanValue']))
      return err(invalid(context, 'Sensör gözlem komutu exact sözleşmeyle eşleşmiyor.'));
    const expected = revision(context, command.expectedDeviceRevision); if (!expected.ok) return expected;
    if (![command.clientOperationId, command.observationId, command.deviceId].every(SAFE_ID.test.bind(SAFE_ID)) ||
      !observationKinds.has(command.kind) || !SHA256.test(command.sourceManifestSha256))
      return err(invalid(context, 'Sensör gözlem komutu geçersizdir.'));
    const observedAt = parseDate(context, command.observedAt, 'Gözlem'); if (!observedAt.ok) return observedAt;
    const kind = command.kind as SmartHomeObservationKind; const booleanObservation = booleanKinds.has(kind);
    if (booleanObservation ? (typeof command.booleanValue !== 'boolean' || command.numericValue !== undefined)
      : (typeof command.numericValue !== 'number' || command.booleanValue !== undefined || !validNumericObservation(kind, command.numericValue)))
      return err(invalid(context, 'Sensör gözlem değeri tür veya güvenli aralıkla eşleşmiyor.'));
    const requestFingerprint = hash({ clientOperationId: command.clientOperationId, observationId: command.observationId,
      deviceId: command.deviceId, expectedDeviceRevision: expected.value, kind, numericValue: command.numericValue ?? null,
      booleanValue: command.booleanValue ?? null, observedAt: observedAt.value, sourceManifestSha256: command.sourceManifestSha256 });
    return this.unitOfWork.execute(context, writeIntent('smart_home_observation', command.observationId, 'create', actor.value), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, requestFingerprint, 'observation_record', 'smart_home_observation', command.observationId);
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      const now = Date.parse(scope.occurredAt); const observed = Date.parse(observedAt.value);
      if (observed < now - 30 * 86_400_000 || observed > now + 5 * 60_000)
        return err(invalid(context, 'Sensör gözlem zamanı izin verilen yerel pencerenin dışındadır.'));
      const settings = scope.findSettings(); if (!settings.ok) return settings;
      if (!settings.value?.processingEnabled)
        return err(denied(context, 'Yeni sensör gözlemleri için yerel işleme açık olmalıdır.'));
      const device = scope.findDevice(command.deviceId); if (!device.ok) return device;
      if (!device.value || device.value.status !== 'active') return err(denied(context, 'Gözlem için etkin ve yetkili cihaz gerekir.'));
      if (device.value.revision !== expected.value || device.value.adapterManifestSha256 !== command.sourceManifestSha256 ||
        !(compatibleKinds[kind] ?? []).includes(device.value.kind)) return err(denied(context, 'Gözlem cihaz sürümü, türü veya imzalı adapter kanıtıyla eşleşmiyor.'));
      const usage = scope.getStorageUsage(); if (!usage.ok) return usage;
      const capacity = ensureCapacity(context, usage.value, 'observation'); if (!capacity.ok) return capacity;
      const occurredAt = asIsoDateTime(scope.occurredAt); const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const base: Omit<SmartHomeObservationRow, 'stateFingerprint'> = { id: command.observationId, familyId: context.familyId,
        ownerPersonId: scope.ownerPersonId, deviceId: command.deviceId, kind, unit: unitFor(kind),
        ...(booleanObservation ? { booleanValue: command.booleanValue! } : { numericValue: command.numericValue! }),
        observedAt: observedAt.value, recordedAt: occurredAt, sourceManifestSha256: command.sourceManifestSha256,
        lastMutationId: id };
      const row: SmartHomeObservationRow = Object.freeze({ ...base, stateFingerprint: observationFingerprint(base) });
      const ledger = mutation(context, scope, actor.value, { id, resourceType: 'smart_home_observation', resourceId: row.id,
        mutationKind: 'observation_record', clientOperationId: command.clientOperationId, requestFingerprint,
        expectedRevision: 0, revision: 1, stateFingerprint: row.stateFingerprint });
      return persist(context, scope, ledger, () => scope.insertObservation(row));
    });
  }
}

export class GrantSmartHomeCameraConsentUseCase {
  public constructor(private readonly unitOfWork: SmartHomeEnergyUnitOfWork) {}
  public async execute(input: { readonly context: LifeApplicationContext; readonly command: GrantSmartHomeCameraConsentInput })
  : Promise<Result<SmartHomeMutationReceiptView, AppError>> {
    const { context, command } = input; const actor = requireActor(context); if (!actor.ok) return actor;
    if (!exactRecord(command, ['clientOperationId', 'consentId', 'deviceId', 'purpose', 'expiresAt']))
      return err(invalid(context, 'Kamera izin komutu exact sözleşmeyle eşleşmiyor.'));
    if (![command.clientOperationId, command.consentId, command.deviceId].every(SAFE_ID.test.bind(SAFE_ID)) ||
      !['live_view', 'doorbell_answer'].includes(command.purpose)) return err(invalid(context, 'Kamera izin komutu geçersizdir.'));
    const expiresAt = parseDate(context, command.expiresAt, 'İzin bitiş'); if (!expiresAt.ok) return expiresAt;
    const requestFingerprint = hash({ clientOperationId: command.clientOperationId, consentId: command.consentId,
      deviceId: command.deviceId, purpose: command.purpose, expiresAt: expiresAt.value });
    return this.unitOfWork.execute(context, writeIntent('smart_home_camera_consent', command.consentId, 'create', actor.value), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, requestFingerprint, 'camera_consent_grant', 'smart_home_camera_consent', command.consentId);
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      const now = Date.parse(scope.occurredAt); const expiry = Date.parse(expiresAt.value);
      if (expiry < now + 5 * 60_000 || expiry > now + 60 * 60_000)
        return err(invalid(context, 'Kamera izni 5 ile 60 dakika arasında ve süreli olmalıdır.'));
      const found = scope.findConsent(command.consentId); if (!found.ok) return found;
      if (found.value) return err(conflict(context, 'Kamera izin kimliği zaten kullanılıyor.'));
      const device = scope.findDevice(command.deviceId); if (!device.ok) return device;
      if (!device.value || device.value.status !== 'active' || !['camera', 'doorbell'].includes(device.value.kind))
        return err(denied(context, 'Görünür süreli izin yalnız etkin kamera veya kapı zili için verilebilir.'));
      if (command.purpose === 'doorbell_answer' && device.value.kind !== 'doorbell')
        return err(denied(context, 'Kapı zilini yanıtlama izni yalnız kapı zili cihazı için verilebilir.'));
      const usage = scope.getStorageUsage(); if (!usage.ok) return usage;
      const capacity = ensureCapacity(context, usage.value, 'camera_consent'); if (!capacity.ok) return capacity;
      const occurredAt = asIsoDateTime(scope.occurredAt); const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const base: Omit<SmartHomeCameraConsentRow, 'stateFingerprint'> = { id: command.consentId, familyId: context.familyId,
        ownerPersonId: scope.ownerPersonId, deviceId: command.deviceId, purpose: command.purpose, status: 'active',
        grantedByAccountId: context.actor.userId, grantedByPersonId: actor.value, visibleIndicatorRequired: true,
        expiresAt: expiresAt.value, revision: 1, lastMutationId: id, createdAt: occurredAt, updatedAt: occurredAt };
      const row: SmartHomeCameraConsentRow = Object.freeze({ ...base, stateFingerprint: consentFingerprint(base) });
      const ledger = mutation(context, scope, actor.value, { id, resourceType: 'smart_home_camera_consent', resourceId: row.id,
        mutationKind: 'camera_consent_grant', clientOperationId: command.clientOperationId, requestFingerprint,
        expectedRevision: 0, revision: 1, stateFingerprint: row.stateFingerprint });
      return persist(context, scope, ledger, () => scope.insertConsent(row));
    });
  }
}

export class RevokeSmartHomeCameraConsentUseCase {
  public constructor(private readonly unitOfWork: SmartHomeEnergyUnitOfWork) {}
  public async execute(input: { readonly context: LifeApplicationContext; readonly command: RevokeSmartHomeCameraConsentInput })
  : Promise<Result<SmartHomeMutationReceiptView, AppError>> {
    const { context, command } = input; const actor = requireActor(context); if (!actor.ok) return actor;
    if (!exactRecord(command, ['clientOperationId', 'consentId', 'expectedRevision']))
      return err(invalid(context, 'İzin iptal komutu exact sözleşmeyle eşleşmiyor.'));
    const expected = revision(context, command.expectedRevision); if (!expected.ok) return expected;
    if (!SAFE_ID.test(command.clientOperationId) || !SAFE_ID.test(command.consentId)) return err(invalid(context, 'İzin iptal komutu geçersizdir.'));
    const requestFingerprint = hash({ clientOperationId: command.clientOperationId, consentId: command.consentId,
      expectedRevision: expected.value });
    return this.unitOfWork.execute(context, writeIntent('smart_home_camera_consent', command.consentId, 'delete'), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, requestFingerprint, 'camera_consent_revoke', 'smart_home_camera_consent', command.consentId);
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      const found = scope.findConsent(command.consentId); if (!found.ok) return found;
      if (!found.value) return err(missing(context, 'Kamera izni bulunamadı.'));
      if (found.value.revision !== expected.value || found.value.status !== 'active') return err(conflict(context, 'Kamera izni sürümü veya durumu değişti.'));
      const occurredAt = asIsoDateTime(scope.occurredAt); const nextRevision = found.value.revision + 1;
      const monotonic = requireMonotonicTime(context, occurredAt, found.value.updatedAt); if (!monotonic.ok) return monotonic;
      const usage = scope.getStorageUsage(); if (!usage.ok) return usage;
      const capacity = ensureCapacity(context, usage.value, 'mutation_only'); if (!capacity.ok) return capacity;
      const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const base: Omit<SmartHomeCameraConsentRow, 'stateFingerprint'> = { ...found.value, status: 'revoked',
        revision: nextRevision, lastMutationId: id, updatedAt: occurredAt, revokedAt: occurredAt };
      const row: SmartHomeCameraConsentRow = Object.freeze({ ...base, stateFingerprint: consentFingerprint(base) });
      const ledger = mutation(context, scope, actor.value, { id, resourceType: 'smart_home_camera_consent', resourceId: row.id,
        mutationKind: 'camera_consent_revoke', clientOperationId: command.clientOperationId, requestFingerprint,
        expectedRevision: found.value.revision, revision: nextRevision, stateFingerprint: row.stateFingerprint });
      return persist(context, scope, ledger, () => scope.saveConsent(row, found.value!.revision));
    });
  }
}

export class SetSmartHomeProcessingUseCase {
  public constructor(private readonly unitOfWork: SmartHomeEnergyUnitOfWork) {}
  public async execute(input: { readonly context: LifeApplicationContext; readonly command: SetSmartHomeProcessingInput })
  : Promise<Result<SmartHomeMutationReceiptView, AppError>> {
    const { context, command } = input; const actor = requireActor(context); if (!actor.ok) return actor;
    if (!exactRecord(command, ['clientOperationId', 'expectedRevision', 'enabled', 'reason']))
      return err(invalid(context, 'Yerel işleme ayarı exact sözleşmeyle eşleşmiyor.'));
    const expected = revision(context, command.expectedRevision, true); if (!expected.ok) return expected;
    if (!SAFE_ID.test(command.clientOperationId) || typeof command.enabled !== 'boolean') return err(invalid(context, 'Yerel işleme ayarı geçersizdir.'));
    const reason = normalizeText(context, command.reason, 'Gerekçe', 3, 500); if (!reason.ok) return reason;
    const settingsId = `smart-home-settings:${actor.value}`; const requestFingerprint = hash({ clientOperationId: command.clientOperationId,
      expectedRevision: expected.value, enabled: command.enabled, reason: reason.value });
    const kind: SmartHomeMutationKind = command.enabled ? 'processing_enable' : 'processing_disable';
    return this.unitOfWork.execute(context, writeIntent('smart_home_settings', settingsId, expected.value === 0 ? 'create' : 'update',
      expected.value === 0 ? actor.value : undefined), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, requestFingerprint, kind, 'smart_home_settings', settingsId);
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      const found = scope.findSettings(); if (!found.ok) return found;
      if ((expected.value === 0 && found.value) || (expected.value > 0 && (!found.value || found.value.revision !== expected.value)))
        return err(conflict(context, 'Yerel işleme ayarı sürümü değişti.'));
      if (found.value?.processingEnabled === command.enabled)
        return err(conflict(context, 'Yerel işleme ayarı değişmedi.'));
      const occurredAt = asIsoDateTime(scope.occurredAt); const nextRevision = expected.value + 1;
      if (found.value) { const monotonic = requireMonotonicTime(context, occurredAt, found.value.updatedAt); if (!monotonic.ok) return monotonic; }
      const usage = scope.getStorageUsage(); if (!usage.ok) return usage;
      const capacity = ensureCapacity(context, usage.value, 'mutation_only'); if (!capacity.ok) return capacity;
      const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const base: Omit<SmartHomeSettingsRow, 'stateFingerprint'> = { id: settingsId, familyId: context.familyId,
        ownerPersonId: scope.ownerPersonId, processingEnabled: command.enabled, cameraAccessDefaultDenied: true,
        hiddenSurveillanceProhibited: true, revision: nextRevision, lastMutationId: id,
        createdAt: found.value?.createdAt ?? occurredAt, updatedAt: occurredAt };
      const row: SmartHomeSettingsRow = Object.freeze({ ...base, stateFingerprint: settingsFingerprint(base) });
      const ledger = mutation(context, scope, actor.value, { id, resourceType: 'smart_home_settings', resourceId: settingsId,
        mutationKind: kind, clientOperationId: command.clientOperationId, requestFingerprint,
        expectedRevision: expected.value, revision: nextRevision, stateFingerprint: row.stateFingerprint });
      return persist(context, scope, ledger, () => expected.value === 0 ? scope.insertSettings(row) : scope.saveSettings(row, expected.value));
    });
  }
}
