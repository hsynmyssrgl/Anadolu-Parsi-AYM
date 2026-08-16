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
  COMMUNICATION_ROOM_TYPES,
  COMMUNICATION_SECURITY_STORAGE_LIMITS,
  communicationSecurityCenterId,
  type AddCommunicationRoomMemberInput,
  type CommunicationMlsEpochReason,
  type CommunicationSecurityCenterView,
  type CommunicationSecurityMutationKind,
  type CommunicationSecurityMutationReceiptView,
  type CommunicationSecurityResourceType,
  type CreateCommunicationRoomInput,
  type FreezeCommunicationRoomInput,
  type RegisterCommunicationDeviceCredentialInput,
  type RekeyCommunicationRoomAfterDeviceRevocationInput,
  type RemoveCommunicationRoomMemberInput,
  type RevokeCommunicationDeviceCredentialInput,
  type SetCommunicationHistoryAccessInput,
  type VerifiedCommunicationDeviceCredentialInput,
  type VerifiedCommunicationMlsEpochInput
} from '@ppt/domain';
import type {
  CommunicationDeviceCredentialRow,
  CommunicationMlsEpochRow,
  CommunicationRoomMembershipRow,
  CommunicationRoomRow,
  CommunicationSecurityCenterKey,
  CommunicationSecurityMutationRow,
  CommunicationSecurityStorageUsageRow
} from '@ppt/repository-contracts';
import type { LifeApplicationContext, LifePolicyIntent } from './life-use-cases.js';

export interface CommunicationSecurityQueryPort {
  getCenter(context: LifeApplicationContext): Promise<Result<CommunicationSecurityCenterView, AppError>>;
}

export interface CommunicationMlsFoundationPort {
  provisionDeviceCredential(input: Readonly<{
    accountId: string;
    ownerPersonId: string;
    trustedDeviceId: string;
    occurredAt: string;
  }>): Result<VerifiedCommunicationDeviceCredentialInput, AppError>;
  createGroup(input: Readonly<{
    roomId: string;
    ownerCredential: Readonly<{
      id: string;
      deviceCredentialSha256: string;
      keyPackageSha256: string;
      sealedCredentialReference: string;
    }>;
    membershipDigestSha256: string;
    occurredAt: string;
  }>): Result<VerifiedCommunicationMlsEpochInput, AppError>;
  advanceEpoch(input: Readonly<{
    roomId: string;
    currentEpoch: number;
    groupIdSha256: string;
    previousSealedStateReference: string;
    previousCommitSha256: string;
    previousConfirmedTranscriptHashSha256: string;
    providerId: string;
    providerImplementation: string;
    activeCredentials: readonly Readonly<{
      id: string;
      deviceCredentialSha256: string;
      keyPackageSha256: string;
      sealedCredentialReference: string;
    }>[];
    membershipDigestSha256: string;
    reason: Exclude<CommunicationMlsEpochReason, 'room_created'>;
    occurredAt: string;
  }>): Result<VerifiedCommunicationMlsEpochInput, AppError>;
}

export interface CommunicationSecurityWriteScope {
  readonly occurredAt: CommunicationSecurityMutationRow['occurredAt'];
  readonly ownerPersonId: CommunicationSecurityCenterKey['ownerPersonId'];
  findDeviceCredential(id: string): Result<CommunicationDeviceCredentialRow | null, AppError>;
  findDeviceCredentialByTrustedDeviceId(trustedDeviceId: string): Result<CommunicationDeviceCredentialRow | null, AppError>;
  findFamilyDeviceCredentialForRoom(id: string): Result<CommunicationDeviceCredentialRow | null, AppError>;
  findRoom(id: string): Result<CommunicationRoomRow | null, AppError>;
  listMemberships(roomId: string): Result<readonly CommunicationRoomMembershipRow[], AppError>;
  findMembership(id: string): Result<CommunicationRoomMembershipRow | null, AppError>;
  findEpoch(roomId: string, epoch: number): Result<CommunicationMlsEpochRow | null, AppError>;
  findMutation(clientOperationId: string): Result<CommunicationSecurityMutationRow | null, AppError>;
  getStorageUsage(roomId?: string): Result<CommunicationSecurityStorageUsageRow, AppError>;
  insertMutation(row: CommunicationSecurityMutationRow): Result<void, AppError>;
  insertDeviceCredential(row: CommunicationDeviceCredentialRow): Result<void, AppError>;
  saveDeviceCredential(row: CommunicationDeviceCredentialRow, expectedRevision: number): Result<void, AppError>;
  insertEpoch(row: CommunicationMlsEpochRow): Result<void, AppError>;
  insertRoom(row: CommunicationRoomRow): Result<void, AppError>;
  saveRoom(row: CommunicationRoomRow, expectedRevision: number): Result<void, AppError>;
  insertMembership(row: CommunicationRoomMembershipRow): Result<void, AppError>;
  saveMembership(row: CommunicationRoomMembershipRow, expectedRevision: number): Result<void, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: CommunicationSecurityMutationRow['occurredAt'];
    readonly actorId: LifeApplicationContext['actor']['userId'];
  }): Result<string, AppError>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
}

export interface CommunicationSecurityUnitOfWork {
  execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: CommunicationSecurityWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,159}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const CONTROL = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const COMMUNICATION_OWNER_MEMBERSHIP_ROLES = Object.freeze(['owner'] as const);
const isCommunicationOwnerMembershipRole = (value: CommunicationRoomMembershipRow['role']): boolean =>
  COMMUNICATION_OWNER_MEMBERSHIP_ROLES.includes(value as 'owner');
const communicationMembershipRolesMatch = (
  left: CommunicationRoomMembershipRow['role'],
  right: CommunicationRoomMembershipRow['role']
): boolean => Object.is(left, right);
const plainDataRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Reflect.ownKeys(value).every((key) => typeof key === 'string'
    && Object.getOwnPropertyDescriptor(value, key)?.enumerable === true
    && 'value' in Object.getOwnPropertyDescriptor(value, key)!);
};
const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('Communication command numbers must be safe integers.');
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!plainDataRecord(value)) throw new Error('Communication commands must contain canonical plain data objects.');
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
};
const hash = (value: unknown): string => createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
const exactCommand = (value: unknown, expected: readonly string[]): value is Record<string, unknown> => {
  if (!plainDataRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
};
const safeOpaqueReference = (value: unknown): value is string => typeof value === 'string'
  && value.length >= 8 && value.length <= 512 && value.trim() === value
  && !/[\u0000-\u001f\u007f\\]/u.test(value) && !/(?:PRIVATE KEY|BEGIN |file:|https?:|\.\.|[A-Za-z]:\/)/iu.test(value);
const normalizedText = (value: unknown, minimum: number, maximum: number): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return normalized.length >= minimum && normalized.length <= maximum && !CONTROL.test(normalized) ? normalized : null;
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

const actorPerson = (context: LifeApplicationContext) => context.actor.personId
  ? ok(context.actor.personId)
  : err(denied(context, 'İletişim güvenlik merkezi kişi bağlı oturum gerektirir.'));
const revision = (context: LifeApplicationContext, value: unknown, allowZero = false): Result<number, AppError> =>
  Number.isSafeInteger(value) && Number(value) >= (allowZero ? 0 : 1)
    ? ok(Number(value)) : err(invalid(context, 'Beklenen iletişim sürümü geçersizdir.'));
const reason = (context: LifeApplicationContext, value: unknown): Result<string, AppError> => {
  const normalized = normalizedText(value, 3, 500);
  return normalized ? ok(normalized) : err(invalid(context, 'İletişim değişikliği gerekçesi geçersizdir.'));
};

export const communicationSecurityReadIntent = (): LifePolicyIntent => ({
  action: 'read', capability: 'family.read', resourceType: 'communication_security_center',
  resourceId: '*', purpose: 'general'
});
export const communicationSecurityWriteIntent = (
  resourceType: CommunicationSecurityResourceType,
  resourceId: string,
  action: 'create' | 'update' | 'delete',
  ownerPersonId?: string
): LifePolicyIntent => ({
  action, capability: 'family.write', resourceType, resourceId, purpose: 'general',
  ...(action === 'create' && ownerPersonId
    ? { ownerPersonId: asPersonId(ownerPersonId), privacy: 'private' as const }
    : {})
});

export const communicationDeviceCredentialId = (familyId: string, ownerPersonId: string, trustedDeviceId: string): string =>
  `comm-device-${hash({ familyId, ownerPersonId, trustedDeviceId }).slice(0, 48)}`;
export const communicationRoomId = (context: LifeApplicationContext, clientOperationId: string): string =>
  `comm-room-${hash({ familyId: context.familyId, accountId: context.actor.userId, clientOperationId }).slice(0, 48)}`;
const membershipId = (roomId: string, credentialId: string): string =>
  `comm-member-${hash({ roomId, credentialId }).slice(0, 48)}`;
const mutationId = (context: LifeApplicationContext, clientOperationId: string, requestFingerprint: string): string =>
  hash({ familyId: context.familyId, accountId: context.actor.userId, clientOperationId, requestFingerprint });
const epochId = (roomId: string, epoch: number, commitSha256: string): string =>
  hash({ roomId, epoch, commitSha256 });
const membershipDigest = (credentials: readonly CommunicationDeviceCredentialRow[]): string => hash(
  credentials.map((item) => ({
    id: item.id,
    ownerPersonId: item.ownerPersonId,
    deviceCredentialSha256: item.deviceCredentialSha256,
    keyPackageSha256: item.keyPackageSha256
  })).toSorted((left, right) => left.id.localeCompare(right.id))
);

const deviceFingerprint = (row: Omit<CommunicationDeviceCredentialRow, 'stateFingerprint'>): string => hash({
  id: row.id, familyId: row.familyId, accountId: row.accountId, ownerPersonId: row.ownerPersonId,
  trustedDeviceId: row.trustedDeviceId, deviceCredentialSha256: row.deviceCredentialSha256,
  keyPackageSha256: row.keyPackageSha256, sealedCredentialReference: row.sealedCredentialReference,
  providerId: row.providerId, providerImplementation: row.providerImplementation,
  providerAttestationSha256: row.providerAttestationSha256, providerEvidenceVerified: row.providerEvidenceVerified,
  status: row.status, revision: row.revision, lastMutationId: row.lastMutationId,
  createdAt: row.createdAt, updatedAt: row.updatedAt, revokedAt: row.revokedAt ?? null
});
const roomFingerprint = (row: Omit<CommunicationRoomRow, 'stateFingerprint'>): string => hash({
  id: row.id, familyId: row.familyId, accountId: row.accountId, ownerPersonId: row.ownerPersonId,
  displayName: row.displayName, roomType: row.roomType, scopeResourceType: row.scopeResourceType ?? null,
  scopeResourceId: row.scopeResourceId ?? null, maskedRoomRefSha256: row.maskedRoomRefSha256,
  providerGroupIdSha256: row.providerGroupIdSha256, status: row.status,
  historyAccessMode: row.historyAccessMode, currentEpoch: row.currentEpoch,
  currentEpochId: row.currentEpochId, revision: row.revision, lastMutationId: row.lastMutationId,
  createdAt: row.createdAt, updatedAt: row.updatedAt
});
const membershipFingerprint = (row: Omit<CommunicationRoomMembershipRow, 'stateFingerprint'>): string => hash({
  id: row.id, familyId: row.familyId, ownerPersonId: row.ownerPersonId, roomId: row.roomId,
  memberPersonId: row.memberPersonId, deviceCredentialId: row.deviceCredentialId, role: row.role,
  status: row.status, joinedAtEpoch: row.joinedAtEpoch, historyVisibleFromEpoch: row.historyVisibleFromEpoch,
  removedAtEpoch: row.removedAtEpoch ?? null, revision: row.revision, lastMutationId: row.lastMutationId,
  createdAt: row.createdAt, updatedAt: row.updatedAt
});

const receipt = (row: CommunicationSecurityMutationRow, replayed: boolean): CommunicationSecurityMutationReceiptView => Object.freeze({
  resourceType: row.resourceType,
  resourceId: row.resourceId,
  mutationKind: row.mutationKind,
  previousRevision: row.expectedRevision,
  revision: row.revision,
  occurredAt: row.occurredAt,
  replayed,
  messageContentProcessed: false,
  networkUsed: false
});
const replay = (
  context: LifeApplicationContext,
  existing: CommunicationSecurityMutationRow | null,
  requestFingerprint: string,
  mutationKind: CommunicationSecurityMutationKind,
  resourceType: CommunicationSecurityResourceType,
  resourceId: string
): Result<CommunicationSecurityMutationReceiptView | null, AppError> => {
  if (!existing) return ok(null);
  return existing.requestFingerprint === requestFingerprint && existing.mutationKind === mutationKind
    && existing.resourceType === resourceType && existing.resourceId === resourceId
    ? ok(receipt(existing, true))
    : err(conflict(context, 'Aynı işlem kimliği farklı bir iletişim güvenliği komutuyla kullanıldı.'));
};

const ensureStorageCapacity = (
  context: LifeApplicationContext,
  scope: CommunicationSecurityWriteScope,
  input: Readonly<{
    roomId?: string;
    needsDeviceCredential?: boolean;
    needsRoom?: boolean;
    needsMembership?: boolean;
    needsEpoch?: boolean;
  }>
): Result<CommunicationSecurityStorageUsageRow, AppError> => {
  const usage = scope.getStorageUsage(input.roomId); if (!usage.ok) return usage;
  const limits = COMMUNICATION_SECURITY_STORAGE_LIMITS;
  if (usage.value.mutationCount >= limits.mutationsPerOwner
    || (input.needsDeviceCredential && usage.value.deviceCredentialCount >= limits.deviceCredentialsPerOwner)
    || (input.needsRoom && usage.value.roomCount >= limits.roomsPerOwner)
    || (input.needsMembership && usage.value.membershipCount >= limits.membershipsPerRoom)
    || (input.needsEpoch && usage.value.epochCount >= limits.epochsPerRoom)) {
    return err(conflict(context, 'İletişim güvenliği metadata depolama sınırına ulaştı; otomatik geçmiş silme uygulanmaz.'));
  }
  return usage;
};

const mutationRow = (
  context: LifeApplicationContext,
  scope: CommunicationSecurityWriteScope,
  actor: NonNullable<LifeApplicationContext['actor']['personId']>,
  input: Readonly<{
    id: string;
    resourceType: CommunicationSecurityResourceType;
    resourceId: string;
    mutationKind: CommunicationSecurityMutationKind;
    clientOperationId: string;
    requestFingerprint: string;
    expectedRevision: number;
    revision: number;
    stateFingerprint: string;
  }>
): CommunicationSecurityMutationRow => Object.freeze({
  id: input.id, familyId: context.familyId, ownerPersonId: scope.ownerPersonId,
  resourceType: input.resourceType, resourceId: input.resourceId,
  actorAccountId: context.actor.userId, actorPersonId: actor,
  mutationKind: input.mutationKind, clientOperationId: input.clientOperationId,
  requestFingerprint: input.requestFingerprint, expectedRevision: input.expectedRevision,
  revision: input.revision, resourceStateFingerprint: input.stateFingerprint,
  occurredAt: asIsoDateTime(scope.occurredAt)
});

const persist = (
  context: LifeApplicationContext,
  scope: CommunicationSecurityWriteScope,
  mutation: CommunicationSecurityMutationRow,
  writes: readonly (() => Result<void, AppError>)[]
): Result<CommunicationSecurityMutationReceiptView, AppError> => {
  const ledger = scope.insertMutation(mutation); if (!ledger.ok) return ledger;
  for (const write of writes) { const result = write(); if (!result.ok) return result; }
  const audit = scope.appendAudit({
    id: hash({ mutationId: mutation.id, kind: 'audit' }),
    action: `communication_security.${mutation.mutationKind}`,
    resourceType: mutation.resourceType,
    resourceId: mutation.resourceId,
    occurredAt: mutation.occurredAt,
    actorId: context.actor.userId
  });
  if (!audit.ok) return audit;
  const event = scope.enqueueEvent({
    eventId: asEventId(hash({ mutationId: mutation.id, kind: 'event' })),
    eventType: `communication_security.${mutation.mutationKind}`,
    eventVersion: 1,
    aggregateType: mutation.resourceType,
    aggregateId: mutation.resourceId,
    occurredAt: mutation.occurredAt,
    actorId: context.actor.userId,
    correlationId: context.correlationId,
    payload: Object.freeze({
      resourceType: mutation.resourceType,
      resourceId: mutation.resourceId,
      mutationKind: mutation.mutationKind,
      revision: mutation.revision,
      messageContentProcessed: false,
      networkUsed: false
    })
  });
  return event.ok ? ok(receipt(mutation, false)) : event;
};

const activeCredentials = (
  context: LifeApplicationContext,
  scope: CommunicationSecurityWriteScope,
  memberships: readonly CommunicationRoomMembershipRow[],
  excludeCredentialId?: string,
  addCredential?: CommunicationDeviceCredentialRow
): Result<readonly CommunicationDeviceCredentialRow[], AppError> => {
  const rows: CommunicationDeviceCredentialRow[] = [];
  for (const membership of memberships) {
    if (membership.status !== 'active' || membership.deviceCredentialId === excludeCredentialId) continue;
    const found = scope.findFamilyDeviceCredentialForRoom(membership.deviceCredentialId);
    if (!found.ok) return found;
    if (!found.value || found.value.status !== 'active') return err(denied(context, 'Etkin oda üyeliği doğrulanmış aktif cihaz kimliği gerektirir.'));
    rows.push(found.value);
  }
  if (addCredential && !rows.some((row) => row.id === addCredential.id)) rows.push(addCredential);
  return ok(Object.freeze(rows.toSorted((left, right) => left.id.localeCompare(right.id))));
};
const providerCredential = (row: CommunicationDeviceCredentialRow) => Object.freeze({
  id: row.id,
  deviceCredentialSha256: row.deviceCredentialSha256,
  keyPackageSha256: row.keyPackageSha256,
  sealedCredentialReference: row.sealedCredentialReference
});
const verifiedEpoch = (
  context: LifeApplicationContext,
  scope: CommunicationSecurityWriteScope,
  evidence: VerifiedCommunicationMlsEpochInput,
  expected: Readonly<{
    roomId: string;
    epoch: number;
    reason: CommunicationMlsEpochReason;
    membershipDigestSha256: string;
    groupIdSha256?: string;
    providerId?: string;
    providerImplementation?: string;
    previousEpoch?: number;
    previousCommitSha256?: string;
    previousConfirmedTranscriptHashSha256?: string;
  }>
): Result<VerifiedCommunicationMlsEpochInput, AppError> => evidence.providerEvidenceVerified === true
  && evidence.roomId === expected.roomId && evidence.epoch === expected.epoch
  && evidence.reason === expected.reason && evidence.membershipDigestSha256 === expected.membershipDigestSha256
  && evidence.createdAt === scope.occurredAt && SHA256.test(evidence.providerAttestationSha256)
  && SHA256.test(evidence.groupIdSha256) && SHA256.test(evidence.commitSha256)
  && SHA256.test(evidence.confirmedTranscriptHashSha256) && SHA256.test(evidence.groupContextSha256)
  && evidence.cipherSuite === 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519'
  && SAFE_ID.test(evidence.providerId) && SAFE_ID.test(evidence.providerImplementation)
  && safeOpaqueReference(evidence.sealedStateReference)
  && (!expected.groupIdSha256 || evidence.groupIdSha256 === expected.groupIdSha256)
  && (!expected.providerId || evidence.providerId === expected.providerId)
  && (!expected.providerImplementation || evidence.providerImplementation === expected.providerImplementation)
  && (expected.previousEpoch === undefined
    ? evidence.previousEpoch === undefined && evidence.previousCommitSha256 === undefined
      && evidence.previousConfirmedTranscriptHashSha256 === undefined
    : evidence.previousEpoch === expected.previousEpoch
      && evidence.previousCommitSha256 === expected.previousCommitSha256
      && evidence.previousConfirmedTranscriptHashSha256 === expected.previousConfirmedTranscriptHashSha256)
  ? ok(evidence) : err(denied(context, 'MLS dönem kanıtı oda, üyelik, zaman veya önceki grup kimliğiyle eşleşmiyor.'));
const epochRow = (
  context: LifeApplicationContext,
  scope: CommunicationSecurityWriteScope,
  evidence: VerifiedCommunicationMlsEpochInput,
  mutation: CommunicationSecurityMutationRow,
  activeDeviceCredentialCount: number
): CommunicationMlsEpochRow => Object.freeze({
  id: epochId(evidence.roomId, evidence.epoch, evidence.commitSha256),
  familyId: context.familyId, ownerPersonId: scope.ownerPersonId, roomId: evidence.roomId,
  epoch: evidence.epoch, cipherSuite: evidence.cipherSuite, groupIdSha256: evidence.groupIdSha256,
  commitSha256: evidence.commitSha256, confirmedTranscriptHashSha256: evidence.confirmedTranscriptHashSha256,
  groupContextSha256: evidence.groupContextSha256, membershipDigestSha256: evidence.membershipDigestSha256,
  sealedStateReference: evidence.sealedStateReference, providerId: evidence.providerId,
  providerImplementation: evidence.providerImplementation, providerAttestationSha256: evidence.providerAttestationSha256,
  providerEvidenceVerified: true, activeDeviceCredentialCount, reason: evidence.reason,
  ...(evidence.previousEpoch === undefined ? {} : { previousEpoch: evidence.previousEpoch }),
  ...(evidence.previousCommitSha256 === undefined ? {} : { previousCommitSha256: evidence.previousCommitSha256 }),
  ...(evidence.previousConfirmedTranscriptHashSha256 === undefined
    ? {} : { previousConfirmedTranscriptHashSha256: evidence.previousConfirmedTranscriptHashSha256 }),
  mutationId: mutation.id, createdAt: mutation.occurredAt
});

export class GetCommunicationSecurityCenterUseCase {
  public constructor(private readonly queryPort: CommunicationSecurityQueryPort) {}
  public execute(context: LifeApplicationContext): Promise<Result<CommunicationSecurityCenterView, AppError>> {
    return this.queryPort.getCenter(context);
  }
}

export class RegisterCommunicationDeviceCredentialUseCase {
  public constructor(
    private readonly unitOfWork: CommunicationSecurityUnitOfWork,
    private readonly provider: CommunicationMlsFoundationPort
  ) {}
  public async execute(input: { context: LifeApplicationContext; command: RegisterCommunicationDeviceCredentialInput })
  : Promise<Result<CommunicationSecurityMutationReceiptView, AppError>> {
    const { context, command } = input; const actor = actorPerson(context); if (!actor.ok) return actor;
    const expected = revision(context, command.expectedRevision, true); if (!expected.ok) return expected;
    if (!exactCommand(command, ['clientOperationId','expectedRevision','trustedDeviceId'])
      || expected.value !== 0 || !SAFE_ID.test(command.clientOperationId) || !SAFE_ID.test(command.trustedDeviceId))
      return err(invalid(context, 'İletişim cihaz kimliği kayıt komutu geçersizdir.'));
    const resourceId = communicationDeviceCredentialId(context.familyId, actor.value, command.trustedDeviceId);
    const requestFingerprint = hash(command);
    return this.unitOfWork.execute(context, communicationSecurityWriteIntent('communication_device_credential', resourceId, 'create', actor.value), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const repeated = replay(context, prior.value, requestFingerprint, 'device_credential_register', 'communication_device_credential', resourceId);
      if (!repeated.ok || repeated.value) return repeated.ok ? ok(repeated.value!) : repeated;
      const capacity = ensureStorageCapacity(context, scope, { needsDeviceCredential: true }); if (!capacity.ok) return capacity;
      const byDevice = scope.findDeviceCredentialByTrustedDeviceId(command.trustedDeviceId); if (!byDevice.ok) return byDevice;
      if (byDevice.value) return err(conflict(context, 'Bu güvenilir cihaz için iletişim kimliği zaten kayıtlıdır.'));
      const evidence = this.provider.provisionDeviceCredential({
        accountId: context.actor.userId, ownerPersonId: actor.value,
        trustedDeviceId: command.trustedDeviceId, occurredAt: scope.occurredAt
      });
      if (!evidence.ok) return evidence;
      if (evidence.value.providerEvidenceVerified !== true || evidence.value.trustedDeviceId !== command.trustedDeviceId
        || evidence.value.createdAt !== scope.occurredAt || ![evidence.value.deviceCredentialSha256,
          evidence.value.keyPackageSha256, evidence.value.providerAttestationSha256].every((value) => SHA256.test(value))
        || !SAFE_ID.test(evidence.value.providerId) || !SAFE_ID.test(evidence.value.providerImplementation)
        || !safeOpaqueReference(evidence.value.sealedCredentialReference))
        return err(denied(context, 'MLS cihaz kimliği kanıtı güvenilir cihaz ve işlem zamanı ile eşleşmiyor.'));
      const occurredAt = asIsoDateTime(scope.occurredAt); const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const base: Omit<CommunicationDeviceCredentialRow, 'stateFingerprint'> = Object.freeze({
        id: resourceId, familyId: context.familyId, accountId: context.actor.userId, ownerPersonId: actor.value,
        trustedDeviceId: command.trustedDeviceId, deviceCredentialSha256: evidence.value.deviceCredentialSha256,
        keyPackageSha256: evidence.value.keyPackageSha256, sealedCredentialReference: evidence.value.sealedCredentialReference,
        providerId: evidence.value.providerId, providerImplementation: evidence.value.providerImplementation,
        providerAttestationSha256: evidence.value.providerAttestationSha256, providerEvidenceVerified: true,
        status: 'active', revision: 1, lastMutationId: id, createdAt: occurredAt, updatedAt: occurredAt
      });
      const row: CommunicationDeviceCredentialRow = Object.freeze({ ...base, stateFingerprint: deviceFingerprint(base) });
      const mutation = mutationRow(context, scope, actor.value, { id, resourceType: 'communication_device_credential',
        resourceId, mutationKind: 'device_credential_register', clientOperationId: command.clientOperationId,
        requestFingerprint, expectedRevision: 0, revision: 1, stateFingerprint: row.stateFingerprint });
      return persist(context, scope, mutation, [() => scope.insertDeviceCredential(row)]);
    });
  }
}

export class RevokeCommunicationDeviceCredentialUseCase {
  public constructor(private readonly unitOfWork: CommunicationSecurityUnitOfWork) {}
  public async execute(input: { context: LifeApplicationContext; command: RevokeCommunicationDeviceCredentialInput })
  : Promise<Result<CommunicationSecurityMutationReceiptView, AppError>> {
    const { context, command } = input; const actor = actorPerson(context); if (!actor.ok) return actor;
    const expected = revision(context, command.expectedRevision); if (!expected.ok) return expected;
    const why = reason(context, command.reason); if (!why.ok) return why;
    if (!exactCommand(command, ['clientOperationId','confirmation','deviceCredentialId','expectedRevision','reason'])
      || !SAFE_ID.test(command.clientOperationId) || !SAFE_ID.test(command.deviceCredentialId)
      || command.confirmation !== 'ILETISIM CIHAZ KIMLIGINI IPTAL ET') return err(invalid(context, 'İletişim cihaz kimliği iptal komutu geçersizdir.'));
    const requestFingerprint = hash({ ...command, reason: why.value });
    return this.unitOfWork.execute(context, communicationSecurityWriteIntent('communication_device_credential', command.deviceCredentialId, 'delete'), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const repeated = replay(context, prior.value, requestFingerprint, 'device_credential_revoke', 'communication_device_credential', command.deviceCredentialId);
      if (!repeated.ok || repeated.value) return repeated.ok ? ok(repeated.value!) : repeated;
      const capacity = ensureStorageCapacity(context, scope, {}); if (!capacity.ok) return capacity;
      const found = scope.findDeviceCredential(command.deviceCredentialId); if (!found.ok) return found;
      if (!found.value) return err(missing(context, 'İletişim cihaz kimliği bulunamadı.'));
      if (found.value.revision !== expected.value || found.value.status !== 'active') return err(conflict(context, 'İletişim cihaz kimliği sürümü veya durumu değişti.'));
      const occurredAt = asIsoDateTime(scope.occurredAt); const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const base: Omit<CommunicationDeviceCredentialRow, 'stateFingerprint'> = Object.freeze({ ...found.value,
        status: 'revoked', revision: found.value.revision + 1, lastMutationId: id, updatedAt: occurredAt, revokedAt: occurredAt });
      const row: CommunicationDeviceCredentialRow = Object.freeze({ ...base, stateFingerprint: deviceFingerprint(base) });
      const mutation = mutationRow(context, scope, actor.value, { id, resourceType: 'communication_device_credential',
        resourceId: row.id, mutationKind: 'device_credential_revoke', clientOperationId: command.clientOperationId,
        requestFingerprint, expectedRevision: found.value.revision, revision: row.revision, stateFingerprint: row.stateFingerprint });
      return persist(context, scope, mutation, [() => scope.saveDeviceCredential(row, found.value!.revision)]);
    });
  }
}

export class CreateCommunicationRoomUseCase {
  public constructor(
    private readonly unitOfWork: CommunicationSecurityUnitOfWork,
    private readonly provider: CommunicationMlsFoundationPort
  ) {}
  public async execute(input: { context: LifeApplicationContext; command: CreateCommunicationRoomInput })
  : Promise<Result<CommunicationSecurityMutationReceiptView, AppError>> {
    const { context, command } = input; const actor = actorPerson(context); if (!actor.ok) return actor;
    const displayName = normalizedText(command.displayName, 2, 160);
    const scoped = command.scopeResourceType !== undefined || command.scopeResourceId !== undefined;
    const commandKeys = ['clientOperationId','displayName','expectedRevision','ownerDeviceCredentialId','roomType',
      ...(command.scopeResourceType === undefined ? [] : ['scopeResourceType']),
      ...(command.scopeResourceId === undefined ? [] : ['scopeResourceId'])];
    if (!exactCommand(command, commandKeys) || !SAFE_ID.test(command.clientOperationId) || !SAFE_ID.test(command.ownerDeviceCredentialId)
      || command.expectedRevision !== 0 || !COMMUNICATION_ROOM_TYPES.includes(command.roomType)
      || !displayName || scoped)
      return err(invalid(context, 'İletişim odası oluşturma komutu geçersizdir.'));
    const roomId = communicationRoomId(context, command.clientOperationId);
    const requestFingerprint = hash({ ...command, displayName });
    return this.unitOfWork.execute(context, communicationSecurityWriteIntent('communication_room', roomId, 'create', actor.value), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const repeated = replay(context, prior.value, requestFingerprint, 'room_create', 'communication_room', roomId);
      if (!repeated.ok || repeated.value) return repeated.ok ? ok(repeated.value!) : repeated;
      const capacity = ensureStorageCapacity(context, scope, { needsRoom: true }); if (!capacity.ok) return capacity;
      const existing = scope.findRoom(roomId); if (!existing.ok) return existing;
      if (existing.value) return err(conflict(context, 'İletişim odası zaten oluşturulmuş.'));
      const credential = scope.findDeviceCredential(command.ownerDeviceCredentialId); if (!credential.ok) return credential;
      if (!credential.value || credential.value.status !== 'active' || credential.value.ownerPersonId !== actor.value)
        return err(denied(context, 'Oda oluşturmak için mevcut kişiye ait etkin MLS cihaz kimliği gerekir.'));
      const credentials = Object.freeze([credential.value]); const digest = membershipDigest(credentials);
      const evidence = this.provider.createGroup({ roomId, ownerCredential: providerCredential(credential.value),
        membershipDigestSha256: digest, occurredAt: scope.occurredAt });
      if (!evidence.ok) return evidence;
      const checked = verifiedEpoch(context, scope, evidence.value, { roomId, epoch: 1, reason: 'room_created', membershipDigestSha256: digest });
      if (!checked.ok) return checked;
      const occurredAt = asIsoDateTime(scope.occurredAt); const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const membershipBase: Omit<CommunicationRoomMembershipRow, 'stateFingerprint'> = Object.freeze({
        id: membershipId(roomId, credential.value.id), familyId: context.familyId, ownerPersonId: actor.value,
        roomId, memberPersonId: actor.value, deviceCredentialId: credential.value.id, role: 'owner', status: 'active',
        joinedAtEpoch: 1, historyVisibleFromEpoch: 1, revision: 1, lastMutationId: id,
        createdAt: occurredAt, updatedAt: occurredAt
      });
      const membership: CommunicationRoomMembershipRow = Object.freeze({ ...membershipBase,
        stateFingerprint: membershipFingerprint(membershipBase) });
      const roomBase: Omit<CommunicationRoomRow, 'stateFingerprint'> = Object.freeze({
        id: roomId, familyId: context.familyId, accountId: context.actor.userId, ownerPersonId: actor.value,
        displayName, roomType: command.roomType,
        ...(command.scopeResourceType ? { scopeResourceType: command.scopeResourceType } : {}),
        ...(command.scopeResourceId ? { scopeResourceId: command.scopeResourceId } : {}),
        maskedRoomRefSha256: hash({ roomId, kind: 'masked-room-reference' }),
        providerGroupIdSha256: checked.value.groupIdSha256, status: 'active',
        historyAccessMode: 'new_members_no_history', currentEpoch: 1,
        currentEpochId: epochId(roomId, 1, checked.value.commitSha256), revision: 1,
        lastMutationId: id, createdAt: occurredAt, updatedAt: occurredAt
      });
      const room: CommunicationRoomRow = Object.freeze({ ...roomBase, stateFingerprint: roomFingerprint(roomBase) });
      const mutation = mutationRow(context, scope, actor.value, { id, resourceType: 'communication_room', resourceId: roomId,
        mutationKind: 'room_create', clientOperationId: command.clientOperationId, requestFingerprint,
        expectedRevision: 0, revision: 1, stateFingerprint: room.stateFingerprint });
      const epoch = epochRow(context, scope, checked.value, mutation, 1);
      return persist(context, scope, mutation, [() => scope.insertEpoch(epoch), () => scope.insertRoom(room), () => scope.insertMembership(membership)]);
    });
  }
}

abstract class RoomEpochMutationUseCase<TCommand extends { clientOperationId: string; expectedRevision: number; roomId: string }> {
  public constructor(
    protected readonly unitOfWork: CommunicationSecurityUnitOfWork,
    protected readonly provider: CommunicationMlsFoundationPort
  ) {}
  protected run(
    context: LifeApplicationContext,
    command: TCommand,
    mutationKind: Extract<CommunicationSecurityMutationKind, 'member_add' | 'member_remove' | 'device_revocation_rekey'>,
    epochReason: Exclude<CommunicationMlsEpochReason, 'room_created'>,
    transform: (input: Readonly<{
      scope: CommunicationSecurityWriteScope;
      room: CommunicationRoomRow;
      memberships: readonly CommunicationRoomMembershipRow[];
      credentials: readonly CommunicationDeviceCredentialRow[];
      mutationId: string;
      occurredAt: CommunicationSecurityMutationRow['occurredAt'];
      nextEpoch: number;
    }>) => Result<readonly (() => Result<void, AppError>)[], AppError>
  ): Promise<Result<CommunicationSecurityMutationReceiptView, AppError>> {
    const actor = actorPerson(context); if (!actor.ok) return Promise.resolve(actor);
    const expected = revision(context, command.expectedRevision); if (!expected.ok) return Promise.resolve(expected);
    if (!SAFE_ID.test(command.clientOperationId) || !SAFE_ID.test(command.roomId)) return Promise.resolve(err(invalid(context, 'Oda dönem komutu geçersizdir.')));
    const requestFingerprint = hash(command);
    return this.unitOfWork.execute(context, communicationSecurityWriteIntent('communication_room', command.roomId, 'update'), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const repeated = replay(context, prior.value, requestFingerprint, mutationKind, 'communication_room', command.roomId);
      if (!repeated.ok || repeated.value) return repeated.ok ? ok(repeated.value!) : repeated;
      const capacity = ensureStorageCapacity(context, scope, { roomId: command.roomId, needsEpoch: true });
      if (!capacity.ok) return capacity;
      const found = scope.findRoom(command.roomId); if (!found.ok) return found;
      if (!found.value) return err(missing(context, 'İletişim odası bulunamadı.'));
      if (found.value.revision !== expected.value || found.value.status !== 'active') return err(conflict(context, 'İletişim odası sürümü veya etkin durumu değişti.'));
      const memberships = scope.listMemberships(command.roomId); if (!memberships.ok) return memberships;
      const prepared = this.prepareCredentials(context, scope, found.value, memberships.value, command);
      if (!prepared.ok) return prepared;
      const credentials = prepared.value; if (credentials.length < 1) return err(denied(context, 'MLS odası en az bir etkin cihaz kimliği korumalıdır.'));
      const currentEpoch = scope.findEpoch(command.roomId, found.value.currentEpoch); if (!currentEpoch.ok) return currentEpoch;
      if (!currentEpoch.value || currentEpoch.value.id !== found.value.currentEpochId) return err(denied(context, 'Odanın geçerli MLS dönem kanıtı bulunamadı.'));
      const digest = membershipDigest(credentials); const nextEpoch = found.value.currentEpoch + 1;
      const evidence = this.provider.advanceEpoch({ roomId: command.roomId, currentEpoch: found.value.currentEpoch,
        groupIdSha256: found.value.providerGroupIdSha256, previousSealedStateReference: currentEpoch.value.sealedStateReference,
        previousCommitSha256: currentEpoch.value.commitSha256,
        previousConfirmedTranscriptHashSha256: currentEpoch.value.confirmedTranscriptHashSha256,
        providerId: currentEpoch.value.providerId, providerImplementation: currentEpoch.value.providerImplementation,
        activeCredentials: Object.freeze(credentials.map(providerCredential)), membershipDigestSha256: digest,
        reason: epochReason, occurredAt: scope.occurredAt });
      if (!evidence.ok) return evidence;
      const checked = verifiedEpoch(context, scope, evidence.value, { roomId: command.roomId, epoch: nextEpoch,
        reason: epochReason, membershipDigestSha256: digest, groupIdSha256: found.value.providerGroupIdSha256,
        providerId: currentEpoch.value.providerId, providerImplementation: currentEpoch.value.providerImplementation,
        previousEpoch: currentEpoch.value.epoch, previousCommitSha256: currentEpoch.value.commitSha256,
        previousConfirmedTranscriptHashSha256: currentEpoch.value.confirmedTranscriptHashSha256 });
      if (!checked.ok) return checked;
      const occurredAt = asIsoDateTime(scope.occurredAt); const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const roomBase: Omit<CommunicationRoomRow, 'stateFingerprint'> = Object.freeze({ ...found.value,
        currentEpoch: nextEpoch, currentEpochId: epochId(command.roomId, nextEpoch, checked.value.commitSha256),
        revision: found.value.revision + 1, lastMutationId: id, updatedAt: occurredAt });
      const room: CommunicationRoomRow = Object.freeze({ ...roomBase, stateFingerprint: roomFingerprint(roomBase) });
      const mutation = mutationRow(context, scope, actor.value, { id, resourceType: 'communication_room', resourceId: command.roomId,
        mutationKind, clientOperationId: command.clientOperationId, requestFingerprint,
        expectedRevision: found.value.revision, revision: room.revision, stateFingerprint: room.stateFingerprint });
      const epoch = epochRow(context, scope, checked.value, mutation, credentials.length);
      const extra = transform({ scope, room: found.value, memberships: memberships.value, credentials,
        mutationId: id, occurredAt, nextEpoch });
      if (!extra.ok) return extra;
      return persist(context, scope, mutation, [() => scope.insertEpoch(epoch), () => scope.saveRoom(room, found.value!.revision), ...extra.value]);
    });
  }
  protected abstract prepareCredentials(
    context: LifeApplicationContext,
    scope: CommunicationSecurityWriteScope,
    room: CommunicationRoomRow,
    memberships: readonly CommunicationRoomMembershipRow[],
    command: TCommand
  ): Result<readonly CommunicationDeviceCredentialRow[], AppError>;
}

export class AddCommunicationRoomMemberUseCase extends RoomEpochMutationUseCase<AddCommunicationRoomMemberInput> {
  public execute(input: { context: LifeApplicationContext; command: AddCommunicationRoomMemberInput }) {
    const { context, command } = input;
    if (!exactCommand(command, ['clientOperationId','deviceCredentialId','expectedRevision','memberPersonId','role','roomId'])
      || !SAFE_ID.test(command.memberPersonId) || !SAFE_ID.test(command.deviceCredentialId)
      || !['administrator','member'].includes(command.role)) return Promise.resolve(err(invalid(context, 'Oda üyeliği ekleme komutu geçersizdir.')));
    return this.run(context, command, 'member_add', 'member_added', ({ scope, memberships, mutationId: id, occurredAt, nextEpoch }) => {
      const credential = scope.findFamilyDeviceCredentialForRoom(command.deviceCredentialId); if (!credential.ok) return credential;
      if (!credential.value || credential.value.status !== 'active' || credential.value.ownerPersonId !== command.memberPersonId)
        return err(denied(context, 'Eklenecek üye için aynı aileye ait etkin ve doğrulanmış cihaz kimliği gerekir.'));
      const existing = memberships.find((item) => item.deviceCredentialId === credential.value!.id);
      if (existing?.status === 'active')
        return err(conflict(context, 'Bu cihaz kimliği odada zaten etkin üyedir.'));
      if (existing && (existing.memberPersonId !== command.memberPersonId
        || !communicationMembershipRolesMatch(existing.role, command.role)))
        return err(conflict(context, 'Kaldırılmış üyelik farklı kişi veya rolle yeniden kullanılamaz.'));
      const base: Omit<CommunicationRoomMembershipRow, 'stateFingerprint'> = Object.freeze({
        id: existing?.id ?? membershipId(command.roomId, credential.value.id),
        familyId: context.familyId, ownerPersonId: scope.ownerPersonId, roomId: command.roomId,
        memberPersonId: asPersonId(command.memberPersonId), deviceCredentialId: credential.value.id,
        role: command.role, createdAt: existing?.createdAt ?? occurredAt,
        status: 'active', joinedAtEpoch: nextEpoch, historyVisibleFromEpoch: nextEpoch,
        revision: (existing?.revision ?? 0) + 1, lastMutationId: id, updatedAt: occurredAt
      });
      const row: CommunicationRoomMembershipRow = Object.freeze({ ...base, stateFingerprint: membershipFingerprint(base) });
      return ok(Object.freeze([() => existing ? scope.saveMembership(row, existing.revision) : scope.insertMembership(row)]));
    });
  }
  protected prepareCredentials(context: LifeApplicationContext, scope: CommunicationSecurityWriteScope, _room: CommunicationRoomRow,
    memberships: readonly CommunicationRoomMembershipRow[], command: AddCommunicationRoomMemberInput) {
    const credential = scope.findFamilyDeviceCredentialForRoom(command.deviceCredentialId); if (!credential.ok) return credential;
    if (!credential.value || credential.value.status !== 'active' || credential.value.ownerPersonId !== command.memberPersonId)
      return err(denied(context, 'Eklenecek cihaz kimliği doğrulanamadı.'));
    const existing = memberships.find((item) => item.deviceCredentialId === command.deviceCredentialId);
    if (existing?.status === 'active') return err(conflict(context, 'Bu cihaz kimliği odada zaten etkin üyedir.'));
    if (!existing) {
      const capacity = ensureStorageCapacity(context, scope, { roomId: command.roomId, needsMembership: true });
      if (!capacity.ok) return capacity;
    }
    return activeCredentials(context, scope, memberships, undefined, credential.value);
  }
}

export class RemoveCommunicationRoomMemberUseCase extends RoomEpochMutationUseCase<RemoveCommunicationRoomMemberInput> {
  public execute(input: { context: LifeApplicationContext; command: RemoveCommunicationRoomMemberInput }) {
    const why = reason(input.context, input.command.reason); if (!why.ok) return Promise.resolve(why);
    if (!exactCommand(input.command, ['clientOperationId','expectedRevision','membershipId','reason','roomId'])
      || !SAFE_ID.test(input.command.membershipId)) return Promise.resolve(err(invalid(input.context, 'Oda üyeliği kaldırma komutu geçersizdir.')));
    return this.run(input.context, { ...input.command, reason: why.value }, 'member_remove', 'member_removed',
      ({ scope, memberships, mutationId: id, occurredAt, nextEpoch }) => {
        const found = memberships.find((item) => item.id === input.command.membershipId);
        if (!found || found.status !== 'active') return err(missing(input.context, 'Etkin oda üyeliği bulunamadı.'));
        if (isCommunicationOwnerMembershipRole(found.role)) return err(denied(input.context, 'Oda sahibi üyeliği bu komutla kaldırılamaz.'));
        const base: Omit<CommunicationRoomMembershipRow, 'stateFingerprint'> = Object.freeze({ ...found,
          status: 'removed', removedAtEpoch: nextEpoch, revision: found.revision + 1,
          lastMutationId: id, updatedAt: occurredAt });
        const row: CommunicationRoomMembershipRow = Object.freeze({ ...base, stateFingerprint: membershipFingerprint(base) });
        return ok(Object.freeze([() => scope.saveMembership(row, found.revision)]));
      });
  }
  protected prepareCredentials(context: LifeApplicationContext, scope: CommunicationSecurityWriteScope, _room: CommunicationRoomRow,
    memberships: readonly CommunicationRoomMembershipRow[], command: RemoveCommunicationRoomMemberInput) {
    const found = memberships.find((item) => item.id === command.membershipId);
    if (!found || found.status !== 'active' || isCommunicationOwnerMembershipRole(found.role)) return err(denied(context, 'Kaldırılabilir etkin oda üyeliği bulunamadı.'));
    const credential = scope.findFamilyDeviceCredentialForRoom(found.deviceCredentialId); if (!credential.ok) return credential;
    if (!credential.value || credential.value.status !== 'active')
      return err(denied(context, 'İptal edilmiş cihaz üyeliği yalnız açık kayıp-cihaz rekey akışıyla kaldırılabilir.'));
    return activeCredentials(context, scope, memberships, found.deviceCredentialId);
  }
}

export class RekeyCommunicationRoomAfterDeviceRevocationUseCase extends RoomEpochMutationUseCase<RekeyCommunicationRoomAfterDeviceRevocationInput> {
  public execute(input: { context: LifeApplicationContext; command: RekeyCommunicationRoomAfterDeviceRevocationInput }) {
    const why = reason(input.context, input.command.reason); if (!why.ok) return Promise.resolve(why);
    const keys = ['clientOperationId','confirmation','expectedRevision','reason','revokedDeviceCredentialId','roomId',
      ...(input.command.replacementDeviceCredentialId === undefined ? [] : ['replacementDeviceCredentialId'])];
    if (!exactCommand(input.command, keys) || !SAFE_ID.test(input.command.revokedDeviceCredentialId)
      || (input.command.replacementDeviceCredentialId !== undefined
        && (!SAFE_ID.test(input.command.replacementDeviceCredentialId)
          || input.command.replacementDeviceCredentialId === input.command.revokedDeviceCredentialId))
      || input.command.confirmation !== 'KAYIP CIHAZ SONRASI ODAYI YENIDEN ANAHTARLA')
      return Promise.resolve(err(invalid(input.context, 'Kayıp cihaz sonrası yeniden anahtarlama komutu geçersizdir.')));
    return this.run(input.context, { ...input.command, reason: why.value }, 'device_revocation_rekey', 'device_revoked_recovery',
      ({ scope, memberships, mutationId: id, occurredAt, nextEpoch }) => {
        const affected = memberships.filter((item) => item.status === 'active' && item.deviceCredentialId === input.command.revokedDeviceCredentialId);
        if (!affected.length) return err(missing(input.context, 'İptal edilen cihazın etkin oda üyeliği bulunamadı.'));
        const writes: (() => Result<void, AppError>)[] = affected.map((found) => () => {
          const base: Omit<CommunicationRoomMembershipRow, 'stateFingerprint'> = Object.freeze({ ...found,
            status: 'removed', removedAtEpoch: nextEpoch, revision: found.revision + 1,
            lastMutationId: id, updatedAt: occurredAt });
          const row: CommunicationRoomMembershipRow = Object.freeze({ ...base, stateFingerprint: membershipFingerprint(base) });
          return scope.saveMembership(row, found.revision);
        });
        if (input.command.replacementDeviceCredentialId) {
          const replacement = scope.findFamilyDeviceCredentialForRoom(input.command.replacementDeviceCredentialId);
          if (!replacement.ok) return replacement;
          if (!replacement.value || replacement.value.status !== 'active')
            return err(denied(input.context, 'Yedek cihaz kimliği etkin ve doğrulanmış olmalıdır.'));
          const targetPerson = affected[0]!.memberPersonId;
          const role = affected.some((item) => isCommunicationOwnerMembershipRole(item.role)) ? 'owner' : affected[0]!.role;
          const existing = memberships.find((item) => item.deviceCredentialId === replacement.value!.id);
          if (!existing || existing.status === 'removed') {
            if (existing && existing.memberPersonId !== targetPerson)
              return err(conflict(input.context, 'Yedek cihazın kaldırılmış üyeliği farklı kişiye bağlıdır.'));
            const base: Omit<CommunicationRoomMembershipRow, 'stateFingerprint'> = Object.freeze({
              id: existing?.id ?? membershipId(input.command.roomId, replacement.value.id), familyId: input.context.familyId,
              ownerPersonId: scope.ownerPersonId, roomId: input.command.roomId, memberPersonId: targetPerson,
              deviceCredentialId: replacement.value.id, role, status: 'active', joinedAtEpoch: nextEpoch,
              historyVisibleFromEpoch: nextEpoch, revision: (existing?.revision ?? 0) + 1,
              lastMutationId: id, createdAt: existing?.createdAt ?? occurredAt, updatedAt: occurredAt
            });
            const row: CommunicationRoomMembershipRow = Object.freeze({ ...base, stateFingerprint: membershipFingerprint(base) });
            writes.push(() => existing ? scope.saveMembership(row, existing.revision) : scope.insertMembership(row));
          }
        }
        return ok(Object.freeze(writes));
      });
  }
  protected prepareCredentials(context: LifeApplicationContext, scope: CommunicationSecurityWriteScope, _room: CommunicationRoomRow,
    memberships: readonly CommunicationRoomMembershipRow[], command: RekeyCommunicationRoomAfterDeviceRevocationInput) {
    const credential = scope.findFamilyDeviceCredentialForRoom(command.revokedDeviceCredentialId); if (!credential.ok) return credential;
    if (!credential.value || credential.value.status !== 'revoked') return err(denied(context, 'Yeniden anahtarlama yalnız kalıcı olarak iptal edilmiş cihaz kimliği için yapılabilir.'));
    const affected = memberships.filter((item) => item.status === 'active' && item.deviceCredentialId === command.revokedDeviceCredentialId);
    if (!affected.length)
      return err(missing(context, 'İptal edilen cihazın etkin oda üyeliği bulunamadı.'));
    let replacement: CommunicationDeviceCredentialRow | undefined;
    if (command.replacementDeviceCredentialId) {
      const found = scope.findFamilyDeviceCredentialForRoom(command.replacementDeviceCredentialId); if (!found.ok) return found;
      if (!found.value || found.value.status !== 'active' || found.value.ownerPersonId !== credential.value.ownerPersonId)
        return err(denied(context, 'Yedek cihaz kimliği iptal edilen cihazla aynı kişiye ait etkin bir kimlik olmalıdır.'));
      replacement = found.value;
      if (!memberships.some((item) => item.deviceCredentialId === replacement!.id)) {
        const capacity = ensureStorageCapacity(context, scope, { roomId: command.roomId, needsMembership: true });
        if (!capacity.ok) return capacity;
      }
    }
    const remaining = activeCredentials(context, scope, memberships, command.revokedDeviceCredentialId, replacement);
    if (!remaining.ok) return remaining;
    if (affected.some((item) => isCommunicationOwnerMembershipRole(item.role))
      && !remaining.value.some((item) => item.ownerPersonId === credential.value!.ownerPersonId))
      return err(denied(context, 'Oda sahibi cihazı için aynı kişiye ait etkin bir yedek cihaz kimliği gerekir.'));
    return remaining;
  }
}

export class SetCommunicationHistoryAccessUseCase {
  public constructor(private readonly unitOfWork: CommunicationSecurityUnitOfWork) {}
  public async execute(input: { context: LifeApplicationContext; command: SetCommunicationHistoryAccessInput })
  : Promise<Result<CommunicationSecurityMutationReceiptView, AppError>> {
    const { context, command } = input; const actor = actorPerson(context); if (!actor.ok) return actor;
    const expected = revision(context, command.expectedRevision); if (!expected.ok) return expected;
    const why = reason(context, command.reason); if (!why.ok) return why;
    if (!exactCommand(command, ['clientOperationId','expectedRevision','historyAccessMode','reason','roomId'])
      || !SAFE_ID.test(command.clientOperationId) || !SAFE_ID.test(command.roomId)
      || !['new_members_no_history','explicit_snapshot_grant'].includes(command.historyAccessMode))
      return err(invalid(context, 'Geçmiş erişim politikası komutu geçersizdir.'));
    const requestFingerprint = hash({ ...command, reason: why.value });
    return this.unitOfWork.execute(context, communicationSecurityWriteIntent('communication_room', command.roomId, 'update'), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const repeated = replay(context, prior.value, requestFingerprint, 'history_policy_update', 'communication_room', command.roomId);
      if (!repeated.ok || repeated.value) return repeated.ok ? ok(repeated.value!) : repeated;
      const capacity = ensureStorageCapacity(context, scope, { roomId: command.roomId }); if (!capacity.ok) return capacity;
      const found = scope.findRoom(command.roomId); if (!found.ok) return found;
      if (!found.value) return err(missing(context, 'İletişim odası bulunamadı.'));
      if (found.value.revision !== expected.value || found.value.status !== 'active') return err(conflict(context, 'İletişim odası sürümü veya durumu değişti.'));
      if (found.value.historyAccessMode === command.historyAccessMode)
        return err(conflict(context, 'Geçmiş erişim politikası zaten istenen durumdadır.'));
      const occurredAt = asIsoDateTime(scope.occurredAt); const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const base: Omit<CommunicationRoomRow, 'stateFingerprint'> = Object.freeze({ ...found.value,
        historyAccessMode: command.historyAccessMode, revision: found.value.revision + 1,
        lastMutationId: id, updatedAt: occurredAt });
      const row: CommunicationRoomRow = Object.freeze({ ...base, stateFingerprint: roomFingerprint(base) });
      const mutation = mutationRow(context, scope, actor.value, { id, resourceType: 'communication_room', resourceId: row.id,
        mutationKind: 'history_policy_update', clientOperationId: command.clientOperationId, requestFingerprint,
        expectedRevision: found.value.revision, revision: row.revision, stateFingerprint: row.stateFingerprint });
      return persist(context, scope, mutation, [() => scope.saveRoom(row, found.value!.revision)]);
    });
  }
}

export class FreezeCommunicationRoomUseCase {
  public constructor(private readonly unitOfWork: CommunicationSecurityUnitOfWork) {}
  public async execute(input: { context: LifeApplicationContext; command: FreezeCommunicationRoomInput })
  : Promise<Result<CommunicationSecurityMutationReceiptView, AppError>> {
    const { context, command } = input; const actor = actorPerson(context); if (!actor.ok) return actor;
    const expected = revision(context, command.expectedRevision); if (!expected.ok) return expected;
    const why = reason(context, command.reason); if (!why.ok) return why;
    if (!exactCommand(command, ['clientOperationId','confirmation','expectedRevision','reason','roomId'])
      || !SAFE_ID.test(command.clientOperationId) || !SAFE_ID.test(command.roomId)
      || command.confirmation !== 'ILETISIM ODASINI DONDUR') return err(invalid(context, 'Oda dondurma komutu geçersizdir.'));
    const requestFingerprint = hash({ ...command, reason: why.value });
    return this.unitOfWork.execute(context, communicationSecurityWriteIntent('communication_room', command.roomId, 'delete'), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const repeated = replay(context, prior.value, requestFingerprint, 'room_freeze', 'communication_room', command.roomId);
      if (!repeated.ok || repeated.value) return repeated.ok ? ok(repeated.value!) : repeated;
      const capacity = ensureStorageCapacity(context, scope, { roomId: command.roomId }); if (!capacity.ok) return capacity;
      const found = scope.findRoom(command.roomId); if (!found.ok) return found;
      if (!found.value) return err(missing(context, 'İletişim odası bulunamadı.'));
      if (found.value.revision !== expected.value || found.value.status !== 'active') return err(conflict(context, 'İletişim odası sürümü veya durumu değişti.'));
      const occurredAt = asIsoDateTime(scope.occurredAt); const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const base: Omit<CommunicationRoomRow, 'stateFingerprint'> = Object.freeze({ ...found.value,
        status: 'frozen', revision: found.value.revision + 1, lastMutationId: id, updatedAt: occurredAt });
      const row: CommunicationRoomRow = Object.freeze({ ...base, stateFingerprint: roomFingerprint(base) });
      const mutation = mutationRow(context, scope, actor.value, { id, resourceType: 'communication_room', resourceId: row.id,
        mutationKind: 'room_freeze', clientOperationId: command.clientOperationId, requestFingerprint,
        expectedRevision: found.value.revision, revision: row.revision, stateFingerprint: row.stateFingerprint });
      return persist(context, scope, mutation, [() => scope.saveRoom(row, found.value!.revision)]);
    });
  }
}
