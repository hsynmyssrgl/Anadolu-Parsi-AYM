import { ERROR_CODES, asPersonId, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import {
  communicationSecurityReadIntent,
  type CommunicationSecurityQueryPort,
  type CommunicationSecurityUnitOfWork,
  type CommunicationSecurityWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '@ppt/application';
import {
  communicationSecurityCenterId,
  communicationSecurityTruth,
  COMMUNICATION_SECURITY_STORAGE_LIMITS,
  type CommunicationSecurityCenterView
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  CommunicationSecurityCenterKey,
  CommunicationSecurityPolicyResourceRepositoryPort,
  CommunicationSecurityRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext
} from '@ppt/repository-contracts';
import {
  RepositoryBackedLifePolicyTransactionRunner,
  type RepositoryBackedLifeApplicationDependencies
} from './life-application-adapter.js';

export interface RepositoryBackedCommunicationSecurityDependencies extends RepositoryBackedLifeApplicationDependencies {
  readonly communicationSecurityRepository: CommunicationSecurityRepositoryPort;
  readonly communicationSecurityPolicyResourceRepository: CommunicationSecurityPolicyResourceRepositoryPort;
}

const denied = (context: LifeApplicationContext, message: string): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message,
  category: 'authorization',
  correlationId: context.correlationId
}));

const keyFor = (
  context: LifeApplicationContext,
  ownerPersonId: NonNullable<LifeApplicationContext['actor']['personId']>
): CommunicationSecurityCenterKey => ({
  familyId: context.familyId,
  accountId: context.actor.userId,
  actorPersonId: context.actor.personId!,
  ownerPersonId,
  centerId: communicationSecurityCenterId(context.familyId, ownerPersonId)
});

export class RepositoryBackedCommunicationSecurityQueryPort implements CommunicationSecurityQueryPort {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationSecurityDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) {
    this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }
  public getCenter(context: LifeApplicationContext): ReturnType<CommunicationSecurityQueryPort['getCenter']> {
    return this.#runner.execute(context, communicationSecurityReadIntent(), ({ repository, occurredAt }) => {
      if (!context.actor.personId) return denied(context, 'İletişim güvenlik merkezi kişi bağlı oturum gerektirir.');
      const key = keyFor(context, context.actor.personId);
      const snapshot = this.dependencies.communicationSecurityRepository.loadCenter(repository, key);
      if (!snapshot.ok) return snapshot;
      const view: CommunicationSecurityCenterView = Object.freeze({
        schemaVersion: 1,
        centerId: key.centerId,
        ownerPersonId: context.actor.personId,
        deviceCredentials: Object.freeze(snapshot.value.deviceCredentials.map((row) => Object.freeze({
          id: row.id,
          trustedDeviceId: row.trustedDeviceId,
          status: row.status,
          providerVerified: true as const,
          keyPackageStoredOutsideDatabase: true as const,
          revision: row.revision,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          ...(row.revokedAt ? { revokedAt: row.revokedAt } : {})
        }))),
        rooms: Object.freeze(snapshot.value.rooms.map(({ room, memberships, currentEpoch, epochCount }) => Object.freeze({
          id: room.id,
          displayName: room.displayName,
          roomType: room.roomType,
          ...(room.scopeResourceType ? { scopeResourceType: room.scopeResourceType } : {}),
          ...(room.scopeResourceId ? { scopeResourceId: room.scopeResourceId } : {}),
          status: room.status,
          historyAccessMode: room.historyAccessMode,
          currentEpoch: room.currentEpoch,
          memberships: Object.freeze(memberships.map((membership) => Object.freeze({
            id: membership.id,
            memberPersonId: membership.memberPersonId,
            deviceCredentialId: membership.deviceCredentialId,
            role: membership.role,
            status: membership.status,
            joinedAtEpoch: membership.joinedAtEpoch,
            historyVisibleFromEpoch: membership.historyVisibleFromEpoch,
            ...(membership.removedAtEpoch === undefined ? {} : { removedAtEpoch: membership.removedAtEpoch })
          }))),
          currentEpochEvidence: Object.freeze({
            epoch: currentEpoch.epoch,
            cipherSuite: currentEpoch.cipherSuite,
            providerEvidenceVerified: true as const,
            sealedProviderStateStored: true as const,
            activeDeviceCredentialCount: currentEpoch.activeDeviceCredentialCount,
            createdAt: currentEpoch.createdAt,
            reason: currentEpoch.reason
          }),
          storageCapacity: Object.freeze({
            memberships: Object.freeze({ current: memberships.length,
              limit: COMMUNICATION_SECURITY_STORAGE_LIMITS.membershipsPerRoom,
              limitReached: memberships.length >= COMMUNICATION_SECURITY_STORAGE_LIMITS.membershipsPerRoom }),
            epochs: Object.freeze({ current: epochCount, limit: COMMUNICATION_SECURITY_STORAGE_LIMITS.epochsPerRoom,
              limitReached: epochCount >= COMMUNICATION_SECURITY_STORAGE_LIMITS.epochsPerRoom })
          }),
          revision: room.revision,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt
        }))),
        storageCapacity: Object.freeze({
          deviceCredentials: Object.freeze({ current: snapshot.value.deviceCredentials.length,
            limit: COMMUNICATION_SECURITY_STORAGE_LIMITS.deviceCredentialsPerOwner,
            limitReached: snapshot.value.deviceCredentials.length >= COMMUNICATION_SECURITY_STORAGE_LIMITS.deviceCredentialsPerOwner }),
          rooms: Object.freeze({ current: snapshot.value.rooms.length, limit: COMMUNICATION_SECURITY_STORAGE_LIMITS.roomsPerOwner,
            limitReached: snapshot.value.rooms.length >= COMMUNICATION_SECURITY_STORAGE_LIMITS.roomsPerOwner }),
          mutations: Object.freeze({ current: snapshot.value.mutationCount, limit: COMMUNICATION_SECURITY_STORAGE_LIMITS.mutationsPerOwner,
            limitReached: snapshot.value.mutationCount >= COMMUNICATION_SECURITY_STORAGE_LIMITS.mutationsPerOwner })
        }),
        truth: communicationSecurityTruth,
        generatedAt: occurredAt
      });
      return ok(view);
    });
  }
}

class RepositoryBackedCommunicationSecurityWriteScope implements CommunicationSecurityWriteScope {
  public readonly ownerPersonId: CommunicationSecurityCenterKey['ownerPersonId'];
  readonly #key: CommunicationSecurityCenterKey;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationSecurityDependencies,
    private readonly context: LifeApplicationContext,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: CommunicationSecurityWriteScope['occurredAt']
  ) {
    const owner = repository.policyAuthorization.receiptRecord.request.resource.ownerPersonId;
    if (!context.actor.personId || !owner) throw new Error('Communication security durable owner context is incomplete');
    this.ownerPersonId = asPersonId(owner);
    this.#key = keyFor(context, this.ownerPersonId);
  }
  public findDeviceCredential(id: string) {
    return this.dependencies.communicationSecurityRepository.findDeviceCredential(this.repository, this.#key, id);
  }
  public findDeviceCredentialByTrustedDeviceId(trustedDeviceId: string) {
    return this.dependencies.communicationSecurityRepository.findDeviceCredentialByTrustedDeviceId(
      this.repository, this.#key, trustedDeviceId);
  }
  public findFamilyDeviceCredentialForRoom(id: string) {
    return this.dependencies.communicationSecurityRepository.findFamilyDeviceCredentialForRoom(
      this.repository, this.context.familyId, id);
  }
  public findRoom(id: string) {
    return this.dependencies.communicationSecurityRepository.findRoom(this.repository, this.#key, id);
  }
  public listMemberships(roomId: string) {
    return this.dependencies.communicationSecurityRepository.listMemberships(this.repository, this.#key, roomId);
  }
  public findMembership(id: string) {
    return this.dependencies.communicationSecurityRepository.findMembership(this.repository, this.#key, id);
  }
  public findEpoch(roomId: string, epoch: number) {
    return this.dependencies.communicationSecurityRepository.findEpoch(this.repository, this.#key, roomId, epoch);
  }
  public findMutation(clientOperationId: string) {
    return this.dependencies.communicationSecurityRepository.findMutationByClientOperationId(
      this.repository, this.#key, clientOperationId);
  }
  public getStorageUsage(roomId?: string) {
    return this.dependencies.communicationSecurityRepository.getStorageUsage(
      this.repository, this.#key, roomId);
  }
  public insertMutation(row: Parameters<CommunicationSecurityWriteScope['insertMutation']>[0]) {
    return this.dependencies.communicationSecurityRepository.insertMutation(this.repository, row);
  }
  public insertDeviceCredential(row: Parameters<CommunicationSecurityWriteScope['insertDeviceCredential']>[0]) {
    return this.dependencies.communicationSecurityRepository.insertDeviceCredential(this.repository, row);
  }
  public saveDeviceCredential(
    row: Parameters<CommunicationSecurityWriteScope['saveDeviceCredential']>[0], expectedRevision: number
  ) {
    return this.dependencies.communicationSecurityRepository.saveDeviceCredential(this.repository, row, expectedRevision);
  }
  public insertEpoch(row: Parameters<CommunicationSecurityWriteScope['insertEpoch']>[0]) {
    return this.dependencies.communicationSecurityRepository.insertEpoch(this.repository, row);
  }
  public insertRoom(row: Parameters<CommunicationSecurityWriteScope['insertRoom']>[0]) {
    return this.dependencies.communicationSecurityRepository.insertRoom(this.repository, row);
  }
  public saveRoom(row: Parameters<CommunicationSecurityWriteScope['saveRoom']>[0], expectedRevision: number) {
    return this.dependencies.communicationSecurityRepository.saveRoom(this.repository, row, expectedRevision);
  }
  public insertMembership(row: Parameters<CommunicationSecurityWriteScope['insertMembership']>[0]) {
    return this.dependencies.communicationSecurityRepository.insertMembership(this.repository, row);
  }
  public saveMembership(row: Parameters<CommunicationSecurityWriteScope['saveMembership']>[0], expectedRevision: number) {
    return this.dependencies.communicationSecurityRepository.saveMembership(this.repository, row, expectedRevision);
  }
  public appendAudit(input: Parameters<CommunicationSecurityWriteScope['appendAudit']>[0]) {
    return this.dependencies.auditRepository.append(this.repository, input);
  }
  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.repository, event);
  }
}

export class RepositoryBackedCommunicationSecurityUnitOfWork implements CommunicationSecurityUnitOfWork {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationSecurityDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) {
    this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }
  public execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: CommunicationSecurityWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    return this.#runner.execute(context, intent, ({ repository, occurredAt }) => operation(
      new RepositoryBackedCommunicationSecurityWriteScope(this.dependencies, context, repository, occurredAt)));
  }
}
