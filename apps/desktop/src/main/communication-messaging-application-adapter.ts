import { ERROR_CODES, asPersonId, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import {
  communicationMessageRowToView,
  communicationMessagingKey,
  communicationMessagingReadIntent,
  type CommunicationMessagePayloadPort,
  type CommunicationMessagingQueryPort,
  type CommunicationMessagingUnitOfWork,
  type CommunicationMessagingWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '@ppt/application';
import {
  communicationMessagingTruth,
  type CommunicationMessagingCenterView,
  type CommunicationPresenceView,
  type CommunicationRetentionPolicyView
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  CommunicationMessagingCenterKey,
  CommunicationMessagingPolicyResourceRepositoryPort,
  CommunicationMessagingRepositoryPort,
  CommunicationPresenceRow,
  CommunicationRetentionPolicyRow,
  PolicyAuthorizedRepositoryExecutionContext
} from '@ppt/repository-contracts';
import {
  RepositoryBackedLifePolicyTransactionRunner,
  type RepositoryBackedLifeApplicationDependencies
} from './life-application-adapter.js';

export interface RepositoryBackedCommunicationMessagingDependencies extends RepositoryBackedLifeApplicationDependencies {
  readonly communicationMessagingRepository: CommunicationMessagingRepositoryPort;
  readonly communicationMessagingPolicyResourceRepository: CommunicationMessagingPolicyResourceRepositoryPort;
  readonly communicationMessagePayloads: CommunicationMessagePayloadPort;
}

const denied = (context: LifeApplicationContext, message: string): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED, message, category: 'authorization', correlationId: context.correlationId
}));
const missing = (context: LifeApplicationContext, message: string): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.RESOURCE_NOT_FOUND, message, category: 'not_found', correlationId: context.correlationId
}));
const keyFor = (context: LifeApplicationContext, ownerPersonId: NonNullable<LifeApplicationContext['actor']['personId']>) =>
  communicationMessagingKey(context, ownerPersonId);

const presenceView = (
  personId: string,
  row: CommunicationPresenceRow | null,
  generatedAt: CommunicationMessagingCenterView['generatedAt']
): CommunicationPresenceView => row && (!row.expiresAt || Date.parse(row.expiresAt) > Date.parse(generatedAt)) ? Object.freeze({
  personId: row.personId, status: row.status, publicAvailability: row.publicAvailability, audience: row.audience,
  lastSeenShared: row.lastSeenShared, typingIndicatorsEnabled: row.typingIndicatorsEnabled,
  readReceiptsEnabled: row.readReceiptsEnabled, activeDeviceDisclosed: false, preciseActivityDisclosed: false,
  emergencyReachabilityEnabled: row.emergencyReachabilityEnabled, ...(row.expiresAt ? { expiresAt: row.expiresAt } : {}),
  revision: row.revision, updatedAt: row.updatedAt
}) : Object.freeze({
  personId, status: 'offline', publicAvailability: 'unavailable', audience: 'nobody', lastSeenShared: false,
  typingIndicatorsEnabled: false, readReceiptsEnabled: false, activeDeviceDisclosed: false,
  preciseActivityDisclosed: false, emergencyReachabilityEnabled: false,
  ...(row?.expiresAt ? { expiresAt: row.expiresAt } : {}), revision: row?.revision ?? 0, updatedAt: row?.updatedAt ?? generatedAt
});

const retentionView = (row: CommunicationRetentionPolicyRow)
: CommunicationRetentionPolicyView => Object.freeze({
  roomId: row.roomId, mode: row.mode, ...(row.durationDays === undefined ? {} : { durationDays: row.durationDays }),
  legalHoldReasonRecorded: row.legalHoldReasonSha256 !== undefined,
  automaticDeletionScheduled: row.mode === 'auto_delete', physicalSecureEraseGuaranteed: false,
  backupPropagationGuaranteed: false, revision: row.revision, updatedAt: row.updatedAt
});

export class RepositoryBackedCommunicationMessagingQueryPort implements CommunicationMessagingQueryPort {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationMessagingDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) { this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies); }
  public getCenter(context: LifeApplicationContext): ReturnType<CommunicationMessagingQueryPort['getCenter']> {
    return this.#runner.execute(context, communicationMessagingReadIntent(), ({ repository, occurredAt }) => {
      if (!context.actor.personId) return denied(context, 'Mesaj merkezi kişi bağlı oturum gerektirir.');
      const key = keyFor(context, context.actor.personId);
      const snapshot = this.dependencies.communicationMessagingRepository.loadCenter(repository, key);
      if (!snapshot.ok) return snapshot;
      const view: CommunicationMessagingCenterView = Object.freeze({ schemaVersion: 1, centerId: key.centerId,
        ownerPersonId: context.actor.personId, messages: Object.freeze(snapshot.value.messages.map(communicationMessageRowToView)),
        presence: presenceView(context.actor.personId, snapshot.value.presence, occurredAt),
        retentionPolicies: Object.freeze(snapshot.value.retentionPolicies.map(retentionView)),
        truth: communicationMessagingTruth, generatedAt: occurredAt });
      return ok(view);
    });
  }
  public search(context: LifeApplicationContext, input: Parameters<CommunicationMessagingQueryPort['search']>[1]) {
    return this.#runner.execute(context, communicationMessagingReadIntent(), ({ repository }) => {
      if (!context.actor.personId) return denied(context, 'Mesaj araması kişi bağlı oturum gerektirir.');
      const found = this.dependencies.communicationMessagingRepository.searchMessages(repository, keyFor(context, context.actor.personId), input);
      if (!found.ok) return found;
      if (input.queryText === undefined) return ok(Object.freeze(found.value.map(communicationMessageRowToView)));
      const queryText = input.queryText.normalize('NFKC').trim().toLocaleLowerCase('tr-TR');
      if (queryText.length < 1 || queryText.length > 128 || /[\p{Cc}\p{Cf}\p{Cs}]/u.test(queryText))
        return denied(context, 'Mesaj içerik araması sorgusu geçersizdir.');
      const matched = [];
      for (const row of found.value) {
        if (row.state === 'deleted' || !['text','location'].includes(row.contentKind)) continue;
        const opened = this.dependencies.communicationMessagePayloads.open(row, context.correlationId);
        if (!opened.ok) return opened;
        if (opened.value.text?.normalize('NFKC').toLocaleLowerCase('tr-TR').includes(queryText))
          matched.push(communicationMessageRowToView(row));
      }
      return ok(Object.freeze(matched));
    });
  }
  public getContent(context: LifeApplicationContext, messageId: string) {
    return this.#runner.execute(context, communicationMessagingReadIntent(), ({ repository }) => {
      if (!context.actor.personId) return denied(context, 'Mesaj içeriği kişi bağlı oturum gerektirir.');
      const found = this.dependencies.communicationMessagingRepository.findMessage(repository, keyFor(context, context.actor.personId), messageId);
      if (!found.ok) return found;
      if (!found.value || found.value.state === 'deleted') return missing(context, 'Mesaj içeriği bulunamadı.');
      return this.dependencies.communicationMessagePayloads.open(found.value, context.correlationId);
    });
  }
  public getMaintenanceState(context: LifeApplicationContext): ReturnType<CommunicationMessagingQueryPort['getMaintenanceState']> {
    return this.#runner.execute(context, communicationMessagingReadIntent(), ({ repository, occurredAt }) => {
      if (!context.actor.personId) return denied(context, 'Mesaj payload bakımı kişi bağlı oturum gerektirir.');
      const snapshot = this.dependencies.communicationMessagingRepository.loadCenter(repository, keyFor(context, context.actor.personId));
      return snapshot.ok ? ok(Object.freeze({ rows: snapshot.value.messages, occurredAt })) : snapshot;
    });
  }
}

class RepositoryBackedCommunicationMessagingWriteScope implements CommunicationMessagingWriteScope {
  public readonly ownerPersonId: CommunicationMessagingCenterKey['ownerPersonId'];
  readonly #key: CommunicationMessagingCenterKey;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationMessagingDependencies,
    private readonly context: LifeApplicationContext,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: CommunicationMessagingWriteScope['occurredAt']
  ) {
    const owner = repository.policyAuthorization.receiptRecord.request.resource.ownerPersonId;
    if (!context.actor.personId || !owner) throw new Error('Communication messaging durable owner context is incomplete');
    this.ownerPersonId = asPersonId(owner); this.#key = keyFor(context, this.ownerPersonId);
  }
  public findRoomGuard(roomId: string) { return this.dependencies.communicationMessagingRepository.findRoomGuard(this.repository, this.#key, roomId); }
  public findAttachmentGuard(fileId: string) {
    return this.dependencies.communicationMessagingRepository.findAttachmentGuard(this.repository, this.#key, fileId);
  }
  public findMessage(messageId: string) { return this.dependencies.communicationMessagingRepository.findMessage(this.repository, this.#key, messageId); }
  public findPresence() { return this.dependencies.communicationMessagingRepository.findPresence(this.repository, this.#key); }
  public findRetentionPolicy(roomId: string) { return this.dependencies.communicationMessagingRepository.findRetentionPolicy(this.repository, this.#key, roomId); }
  public findDeliveryQueue(messageId: string) { return this.dependencies.communicationMessagingRepository.findDeliveryQueue(this.repository, this.#key, messageId); }
  public findMutation(clientOperationId: string) {
    return this.dependencies.communicationMessagingRepository.findMutationByClientOperationId(this.repository, this.#key, clientOperationId);
  }
  public insertMutation(row: Parameters<CommunicationMessagingWriteScope['insertMutation']>[0]) {
    return this.dependencies.communicationMessagingRepository.insertMutation(this.repository, row);
  }
  public insertMessage(row: Parameters<CommunicationMessagingWriteScope['insertMessage']>[0]) {
    return this.dependencies.communicationMessagingRepository.insertMessage(this.repository, row);
  }
  public saveMessage(row: Parameters<CommunicationMessagingWriteScope['saveMessage']>[0], expectedRevision: number) {
    return this.dependencies.communicationMessagingRepository.saveMessage(this.repository, row, expectedRevision);
  }
  public appendMessageEvent(row: Parameters<CommunicationMessagingWriteScope['appendMessageEvent']>[0]) {
    return this.dependencies.communicationMessagingRepository.appendMessageEvent(this.repository, row);
  }
  public upsertDeliveryQueue(row: Parameters<CommunicationMessagingWriteScope['upsertDeliveryQueue']>[0], expectedRevision: number) {
    return this.dependencies.communicationMessagingRepository.upsertDeliveryQueue(this.repository, row, expectedRevision);
  }
  public savePresence(row: Parameters<CommunicationMessagingWriteScope['savePresence']>[0], expectedRevision: number) {
    return this.dependencies.communicationMessagingRepository.savePresence(this.repository, row, expectedRevision);
  }
  public saveRetentionPolicy(row: Parameters<CommunicationMessagingWriteScope['saveRetentionPolicy']>[0], expectedRevision: number) {
    return this.dependencies.communicationMessagingRepository.saveRetentionPolicy(this.repository, row, expectedRevision);
  }
  public appendAudit(input: Parameters<CommunicationMessagingWriteScope['appendAudit']>[0]) {
    return this.dependencies.auditRepository.append(this.repository, input);
  }
  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.repository, event);
  }
}

export class RepositoryBackedCommunicationMessagingUnitOfWork implements CommunicationMessagingUnitOfWork {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationMessagingDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) { this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies); }
  public execute<T>(context: LifeApplicationContext, intent: LifePolicyIntent,
    operation: (scope: CommunicationMessagingWriteScope) => Result<T, AppError>): Promise<Result<T, AppError>> {
    return this.#runner.execute(context, intent, ({ repository, occurredAt }) => operation(
      new RepositoryBackedCommunicationMessagingWriteScope(this.dependencies, context, repository, occurredAt)));
  }
}
