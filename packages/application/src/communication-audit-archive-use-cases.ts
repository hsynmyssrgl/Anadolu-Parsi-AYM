import { createHash } from 'node:crypto';
import { ERROR_CODES, asIsoDateTime, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import {
  communicationAuditArchiveTruth,
  type AppendCommunicationAuditEventInput,
  type CommunicationArchiveIntegrityCheckpointView,
  type CommunicationAuditArchiveCenterView,
  type CommunicationAuditArchiveSafeCenterView,
  type CommunicationAuditEventView,
  type CommunicationAuditResourceType,
  type RegisterCommunicationArchiveCheckpointInput
} from '@ppt/domain';
import type {
  CommunicationAuditArchiveKey,
  CommunicationAuditOperationRow,
  RepositoryResult
} from '@ppt/repository-contracts';
import type { LifeApplicationContext, LifePolicyIntent } from './life-use-cases.js';

export interface CommunicationAuditArchiveQueryPort {
  load(context: LifeApplicationContext): Promise<Result<CommunicationAuditArchiveCenterView, AppError>>;
}
export interface CommunicationAuditArchiveWriteScope {
  readonly key: CommunicationAuditArchiveKey;
  readonly occurredAt: CommunicationAuditEventView['occurredAt'];
  listEvents(): RepositoryResult<readonly CommunicationAuditEventView[]>;
  listCheckpoints(): RepositoryResult<readonly CommunicationArchiveIntegrityCheckpointView[]>;
  findOperation(clientOperationId: string): RepositoryResult<CommunicationAuditOperationRow | null>;
  appendEvent(event: CommunicationAuditEventView, operation: CommunicationAuditOperationRow): RepositoryResult<void>;
  appendCheckpoint(checkpoint: CommunicationArchiveIntegrityCheckpointView,
    operation: CommunicationAuditOperationRow): RepositoryResult<void>;
}
export interface CommunicationAuditArchiveUnitOfWork {
  execute<T>(context: LifeApplicationContext, intent: LifePolicyIntent,
    operation: (scope: CommunicationAuditArchiveWriteScope) => Result<T, AppError>): Promise<Result<T, AppError>>;
}

const SAFE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,127}$/u;
const SHA = /^[0-9a-f]{64}$/u;
const ZERO_HASH = '0'.repeat(64);
const SAFE_EVENT_LIMIT = 100;
const SAFE_CHECKPOINT_LIMIT = 50;
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
const appError = (context: LifeApplicationContext, code: AppError['code'], category: AppError['category'], message: string) =>
  createAppError({ code, category, message, correlationId: context.correlationId });
const invalid = (context: LifeApplicationContext, message: string) => appError(context, ERROR_CODES.CORE_INVALID_ARGUMENT, 'validation', message);
const denied = (context: LifeApplicationContext, message: string) => appError(context, ERROR_CODES.AUTHORIZATION_DENIED, 'authorization', message);
const conflict = (context: LifeApplicationContext, message: string) => appError(context, ERROR_CODES.RESOURCE_CONFLICT, 'conflict', message);

export const communicationAuditArchiveReadIntent = (): LifePolicyIntent => ({ action: 'read', capability: 'family.read',
  resourceType: 'communication_audit_archive', resourceId: '*', purpose: 'general' });
export const communicationAuditPolicyResourceId = (context: LifeApplicationContext, clientOperationId: string): string =>
  `communication-audit:${hash({ familyId: context.familyId, ownerPersonId: context.actor.personId, clientOperationId })}`;
export const communicationAuditArchiveWriteIntent = (context: LifeApplicationContext, clientOperationId: string): LifePolicyIntent => ({
  action: 'create', capability: 'family.write', resourceType: 'communication_audit_archive',
  resourceId: communicationAuditPolicyResourceId(context, clientOperationId), purpose: 'general',
  ...(context.actor.personId ? { ownerPersonId: context.actor.personId, privacy: 'private' as const } : {})
});

const resourceTypeForEvent = Object.freeze({
  room_joined: 'communication_room', room_left: 'communication_room',
  call_started: 'communication_call_session', call_ended: 'communication_call_session',
  file_shared: 'communication_file_sharing', permission_changed: 'communication_permission',
  message_created: 'communication_message', message_deleted: 'communication_message',
  recording_consent_changed: 'communication_recording_request'
} satisfies Readonly<Record<CommunicationAuditEventView['eventKind'], CommunicationAuditResourceType>>);

const eventMaterial = (event: Omit<CommunicationAuditEventView, 'eventHash'|'contentCopiedToAudit'>) => ({
  id: event.id, familyId: event.familyId, ownerPersonId: event.ownerPersonId, actorPersonId: event.actorPersonId,
  actorDeviceId: event.actorDeviceId, eventKind: event.eventKind, resourceType: event.resourceType,
  resourceId: event.resourceId, resourceVersion: event.resourceVersion, resourceFingerprint: event.resourceFingerprint,
  previousHash: event.previousHash, sequence: event.sequence, occurredAt: event.occurredAt
});

export const verifyCommunicationAuditChain = (events: readonly CommunicationAuditEventView[]): boolean => {
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  let previousHash = ZERO_HASH; let sequence = 1;
  for (const event of ordered) {
    const { eventHash: _eventHash, contentCopiedToAudit: _contentCopiedToAudit, ...material } = event;
    if (event.sequence !== sequence || event.previousHash !== previousHash || event.contentCopiedToAudit !== false
      || hash(eventMaterial(material)) !== event.eventHash) return false;
    previousHash = event.eventHash; sequence += 1;
  }
  return true;
};

export const communicationAuditArchiveCenter = (
  events: readonly CommunicationAuditEventView[],
  checkpoints: readonly CommunicationArchiveIntegrityCheckpointView[],
  generatedAt: string
): CommunicationAuditArchiveCenterView => Object.freeze({ schemaVersion: 1,
  events: Object.freeze([...events].sort((left, right) => right.sequence - left.sequence)),
  checkpoints: Object.freeze([...checkpoints].sort((left, right) => right.archiveGeneration - left.archiveGeneration)),
  chainValid: verifyCommunicationAuditChain(events), truth: communicationAuditArchiveTruth, generatedAt: asIsoDateTime(generatedAt) });

export const communicationAuditArchiveSafeCenter = (
  center: CommunicationAuditArchiveCenterView
): CommunicationAuditArchiveSafeCenterView => Object.freeze({ schemaVersion: 1,
  eventCount: center.events.length, checkpointCount: center.checkpoints.length,
  recentEvents: Object.freeze(center.events.slice(0, SAFE_EVENT_LIMIT).map((event) => Object.freeze({
    eventKind: event.eventKind, resourceType: event.resourceType, resourceVersion: event.resourceVersion,
    sequence: event.sequence, occurredAt: event.occurredAt
  }))),
  recentCheckpoints: Object.freeze(center.checkpoints.slice(0, SAFE_CHECKPOINT_LIMIT).map((checkpoint) => Object.freeze({
    archiveGeneration: checkpoint.archiveGeneration, vaultVerified: checkpoint.vaultVerified,
    backupVerified: checkpoint.backupVerified, replicaVerified: checkpoint.replicaVerified,
    restoreVerified: checkpoint.restoreVerified, externalBackupProviderVerified: false,
    remoteReplicationVerified: false, createdAt: checkpoint.createdAt
  }))),
  recentEventsTruncated: center.events.length > SAFE_EVENT_LIMIT,
  recentCheckpointsTruncated: center.checkpoints.length > SAFE_CHECKPOINT_LIMIT,
  chainValid: center.chainValid, truth: center.truth, generatedAt: center.generatedAt,
  networkUsed: false, cloudUsed: false
});

export class GetCommunicationAuditArchiveCenterUseCase {
  public constructor(private readonly query: CommunicationAuditArchiveQueryPort) {}
  public execute(context: LifeApplicationContext) { return this.query.load(context); }
}

export class GetCommunicationAuditArchiveSafeCenterUseCase {
  public constructor(private readonly query: CommunicationAuditArchiveQueryPort) {}
  public async execute(context: LifeApplicationContext): Promise<Result<CommunicationAuditArchiveSafeCenterView, AppError>> {
    const loaded = await this.query.load(context);
    return loaded.ok ? ok(communicationAuditArchiveSafeCenter(loaded.value)) : loaded;
  }
}

export class AppendCommunicationAuditEventUseCase {
  public constructor(private readonly uow: CommunicationAuditArchiveUnitOfWork) {}
  public execute(input: { readonly context: LifeApplicationContext; readonly command: AppendCommunicationAuditEventInput }) {
    const { context, command } = input; const ownerPersonId = context.actor.personId;
    if (!ownerPersonId) return Promise.resolve(err(denied(context, 'İletişim denetimi kişi bağlı oturum gerektirir.')));
    if (![command.clientOperationId,command.actorDeviceId,command.resourceId].every((value) => SAFE.test(value))
      || command.resourceType !== resourceTypeForEvent[command.eventKind]
      || !Number.isSafeInteger(command.resourceVersion) || command.resourceVersion < 1 || !SHA.test(command.resourceFingerprint))
      return Promise.resolve(err(invalid(context, 'İletişim denetim olayı yalnız güvenli kimlik/hash/sürüm metadatası kabul eder.')));
    const requestFingerprint = hash(command);
    const policyResourceId = communicationAuditPolicyResourceId(context, command.clientOperationId);
    return this.uow.execute(context, communicationAuditArchiveWriteIntent(context, command.clientOperationId), (scope) => {
      const prior = scope.findOperation(command.clientOperationId); if (!prior.ok) return prior;
      if (prior.value) return prior.value.operationKind === 'audit_append' && prior.value.requestFingerprint === requestFingerprint
        ? ok(prior.value.resultId) : err(conflict(context, 'Aynı clientOperationId farklı denetim olayına aittir.'));
      const listed = scope.listEvents(); if (!listed.ok) return listed;
      if (listed.value.length >= 100_000) return err(conflict(context, 'İletişim denetim ledger kotası doldu.'));
      const ordered = [...listed.value].sort((left, right) => left.sequence - right.sequence);
      if (!verifyCommunicationAuditChain(ordered)) return err(conflict(context, 'Mevcut iletişim denetim hash zinciri geçersizdir.'));
      const previousHash = ordered.at(-1)?.eventHash ?? ZERO_HASH; const sequence = ordered.length + 1;
      const base = Object.freeze({ id: hash({ familyId: context.familyId, ownerPersonId, command, sequence }),
        familyId: context.familyId, ownerPersonId, actorPersonId: ownerPersonId, actorDeviceId: command.actorDeviceId,
        eventKind: command.eventKind, resourceType: command.resourceType, resourceId: command.resourceId,
        resourceVersion: command.resourceVersion, resourceFingerprint: command.resourceFingerprint, previousHash, sequence,
        occurredAt: scope.occurredAt });
      const event: CommunicationAuditEventView = Object.freeze({ ...base, eventHash: hash(eventMaterial(base)),
        contentCopiedToAudit: false });
      const operation: CommunicationAuditOperationRow = Object.freeze({ clientOperationId: command.clientOperationId,
        familyId: scope.key.familyId, ownerPersonId: scope.key.ownerPersonId, operationKind: 'audit_append',
        requestFingerprint, resultId: event.id, policyResourceId });
      const saved = scope.appendEvent(event, operation); return saved.ok ? ok(event.id) : saved;
    });
  }
}

export class RegisterCommunicationArchiveCheckpointUseCase {
  public constructor(private readonly uow: CommunicationAuditArchiveUnitOfWork) {}
  public execute(input: { readonly context: LifeApplicationContext; readonly command: RegisterCommunicationArchiveCheckpointInput }) {
    const { context, command } = input; const ownerPersonId = context.actor.personId;
    if (!ownerPersonId) return Promise.resolve(err(denied(context, 'İletişim arşiv bütünlüğü kişi bağlı oturum gerektirir.')));
    if (!SAFE.test(command.clientOperationId) || !Number.isSafeInteger(command.archiveGeneration) || command.archiveGeneration < 1
      || ![command.vaultManifestSha256,command.databaseManifestSha256,command.backupManifestSha256].every((value) => SHA.test(value))
      || (command.replicaManifestSha256 !== undefined && !SHA.test(command.replicaManifestSha256))
      || (command.restoreManifestSha256 !== undefined && !SHA.test(command.restoreManifestSha256))
      || (command.replicaVerified && !command.replicaManifestSha256)
      || (command.restoreVerified && (!command.restoreManifestSha256 || !command.backupVerified)))
      return Promise.resolve(err(invalid(context, 'İletişim arşiv bütünlük checkpoint kanıtı eksik veya geçersizdir.')));
    const requestFingerprint = hash(command);
    const policyResourceId = communicationAuditPolicyResourceId(context, command.clientOperationId);
    return this.uow.execute(context, communicationAuditArchiveWriteIntent(context, command.clientOperationId), (scope) => {
      const prior = scope.findOperation(command.clientOperationId); if (!prior.ok) return prior;
      if (prior.value) return prior.value.operationKind === 'checkpoint_register' && prior.value.requestFingerprint === requestFingerprint
        ? ok(prior.value.resultId) : err(conflict(context, 'Aynı clientOperationId farklı arşiv checkpoint işlemine aittir.'));
      const checkpoints = scope.listCheckpoints(); if (!checkpoints.ok) return checkpoints;
      if (checkpoints.value.some((candidate) => candidate.archiveGeneration === command.archiveGeneration))
        return err(conflict(context, 'Arşiv generation checkpoint kaydı değiştirilemez.'));
      const checkpoint: CommunicationArchiveIntegrityCheckpointView = Object.freeze({ id: hash({ context: context.familyId, command }),
        familyId: context.familyId, archiveGeneration: command.archiveGeneration,
        vaultManifestSha256: command.vaultManifestSha256, databaseManifestSha256: command.databaseManifestSha256,
        backupManifestSha256: command.backupManifestSha256,
        ...(command.replicaManifestSha256 ? { replicaManifestSha256: command.replicaManifestSha256 } : {}),
        ...(command.restoreManifestSha256 ? { restoreManifestSha256: command.restoreManifestSha256 } : {}),
        vaultVerified: command.vaultVerified, backupVerified: command.backupVerified,
        replicaVerified: command.replicaVerified, restoreVerified: command.restoreVerified,
        externalBackupProviderVerified: false, remoteReplicationVerified: false, createdAt: scope.occurredAt });
      const operation: CommunicationAuditOperationRow = Object.freeze({ clientOperationId: command.clientOperationId,
        familyId: scope.key.familyId, ownerPersonId: scope.key.ownerPersonId, operationKind: 'checkpoint_register',
        requestFingerprint, resultId: checkpoint.id, policyResourceId });
      const saved = scope.appendCheckpoint(checkpoint, operation); return saved.ok ? ok(checkpoint.id) : saved;
    });
  }
}
