import { ERROR_CODES, asPersonId, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import {
  communicationCallPreferencesRowToView,
  communicationCallSessionRowToView,
  communicationRealtimeCallingKey,
  communicationRealtimeCallingReadIntent,
  type CommunicationRealtimeCallingQueryPort,
  type CommunicationRealtimeCallingUnitOfWork,
  type CommunicationRealtimeCallingWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '@ppt/application';
import { communicationRealtimeCallingTruth, type CommunicationRealtimeCallingCenterView } from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  CommunicationRealtimeCallingCenterKey,
  CommunicationRealtimeCallingPolicyResourceRepositoryPort,
  CommunicationRealtimeCallingRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext
} from '@ppt/repository-contracts';
import {
  RepositoryBackedLifePolicyTransactionRunner,
  type RepositoryBackedLifeApplicationDependencies
} from './life-application-adapter.js';

export interface RepositoryBackedCommunicationRealtimeCallingDependencies extends RepositoryBackedLifeApplicationDependencies {
  readonly communicationRealtimeCallingRepository: CommunicationRealtimeCallingRepositoryPort;
  readonly communicationRealtimeCallingPolicyResourceRepository: CommunicationRealtimeCallingPolicyResourceRepositoryPort;
}

const denied = (context: LifeApplicationContext, message: string): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED, message, category: 'authorization', correlationId: context.correlationId
}));
const keyFor = (context: LifeApplicationContext, ownerPersonId: NonNullable<LifeApplicationContext['actor']['personId']>) =>
  communicationRealtimeCallingKey(context, ownerPersonId);

export class RepositoryBackedCommunicationRealtimeCallingQueryPort implements CommunicationRealtimeCallingQueryPort {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationRealtimeCallingDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) { this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies); }
  public getCenter(context: LifeApplicationContext): ReturnType<CommunicationRealtimeCallingQueryPort['getCenter']> {
    return this.#runner.execute(context, communicationRealtimeCallingReadIntent(), ({ repository, occurredAt }) => {
      if (!context.actor.personId) return denied(context, 'Çağrı merkezi kişi bağlı oturum gerektirir.');
      const key = keyFor(context, context.actor.personId);
      const snapshot = this.dependencies.communicationRealtimeCallingRepository.loadCenter(repository, key);
      if (!snapshot.ok) return snapshot;
      const view: CommunicationRealtimeCallingCenterView = Object.freeze({
        schemaVersion: 1,
        centerId: key.centerId,
        ownerPersonId: context.actor.personId,
        sessions: Object.freeze(snapshot.value.sessions.map(communicationCallSessionRowToView)),
        preferences: communicationCallPreferencesRowToView(snapshot.value.preferences, occurredAt),
        qualityObservations: Object.freeze(snapshot.value.qualityObservations.map((row) => Object.freeze({
          sessionId: row.sessionId, roundTripMs: row.roundTripMs, packetLossPermille: row.packetLossPermille,
          jitterMs: row.jitterMs, uplinkKbps: row.uplinkKbps, downlinkKbps: row.downlinkKbps,
          providerVerified: true as const, observedAt: row.observedAt
        }))),
        truth: communicationRealtimeCallingTruth,
        generatedAt: occurredAt
      });
      return ok(view);
    });
  }
}

class RepositoryBackedCommunicationRealtimeCallingWriteScope implements CommunicationRealtimeCallingWriteScope {
  public readonly ownerPersonId: CommunicationRealtimeCallingCenterKey['ownerPersonId'];
  readonly #key: CommunicationRealtimeCallingCenterKey;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationRealtimeCallingDependencies,
    private readonly context: LifeApplicationContext,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: CommunicationRealtimeCallingWriteScope['occurredAt']
  ) {
    const owner = repository.policyAuthorization.receiptRecord.request.resource.ownerPersonId;
    if (!context.actor.personId || !owner) throw new Error('Communication calling durable owner context is incomplete');
    this.ownerPersonId = asPersonId(owner); this.#key = keyFor(context, this.ownerPersonId);
  }
  public findRoomGuard(roomId: string) {
    return this.dependencies.communicationRealtimeCallingRepository.findRoomGuard(this.repository, this.#key, roomId);
  }
  public findSession(sessionId: string) {
    return this.dependencies.communicationRealtimeCallingRepository.findSession(this.repository, this.#key, sessionId);
  }
  public findPreferences() {
    return this.dependencies.communicationRealtimeCallingRepository.findPreferences(this.repository, this.#key);
  }
  public findMutation(clientOperationId: string) {
    return this.dependencies.communicationRealtimeCallingRepository.findMutationByClientOperationId(this.repository, this.#key, clientOperationId);
  }
  public insertMutation(row: Parameters<CommunicationRealtimeCallingWriteScope['insertMutation']>[0]) {
    return this.dependencies.communicationRealtimeCallingRepository.insertMutation(this.repository, row);
  }
  public insertSession(row: Parameters<CommunicationRealtimeCallingWriteScope['insertSession']>[0]) {
    return this.dependencies.communicationRealtimeCallingRepository.insertSession(this.repository, row);
  }
  public saveSession(row: Parameters<CommunicationRealtimeCallingWriteScope['saveSession']>[0], expectedRevision: number) {
    return this.dependencies.communicationRealtimeCallingRepository.saveSession(this.repository, row, expectedRevision);
  }
  public insertParticipants(rows: Parameters<CommunicationRealtimeCallingWriteScope['insertParticipants']>[0]) {
    return this.dependencies.communicationRealtimeCallingRepository.insertParticipants(this.repository, rows);
  }
  public appendEvent(row: Parameters<CommunicationRealtimeCallingWriteScope['appendEvent']>[0]) {
    return this.dependencies.communicationRealtimeCallingRepository.appendEvent(this.repository, row);
  }
  public savePreferences(row: Parameters<CommunicationRealtimeCallingWriteScope['savePreferences']>[0], expectedRevision: number) {
    return this.dependencies.communicationRealtimeCallingRepository.savePreferences(this.repository, row, expectedRevision);
  }
  public appendQualityObservation(row: Parameters<CommunicationRealtimeCallingWriteScope['appendQualityObservation']>[0]) {
    return this.dependencies.communicationRealtimeCallingRepository.appendQualityObservation(this.repository, row);
  }
  public appendAudit(input: Parameters<CommunicationRealtimeCallingWriteScope['appendAudit']>[0]) {
    return this.dependencies.auditRepository.append(this.repository, input);
  }
  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.repository, event);
  }
}

export class RepositoryBackedCommunicationRealtimeCallingUnitOfWork implements CommunicationRealtimeCallingUnitOfWork {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationRealtimeCallingDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) { this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies); }
  public execute<T>(context: LifeApplicationContext, intent: LifePolicyIntent,
    operation: (scope: CommunicationRealtimeCallingWriteScope) => Result<T, AppError>): Promise<Result<T, AppError>> {
    return this.#runner.execute(context, intent, ({ repository, occurredAt }) => operation(
      new RepositoryBackedCommunicationRealtimeCallingWriteScope(this.dependencies, context, repository, occurredAt)));
  }
}
