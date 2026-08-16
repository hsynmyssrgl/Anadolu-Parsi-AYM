import { ERROR_CODES, asPersonId, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import {
  signedPluginPlatformReadIntent,
  type LifeApplicationContext,
  type LifePolicyIntent,
  type SignedPluginPlatformQueryPort,
  type SignedPluginPlatformUnitOfWork,
  type SignedPluginPlatformWriteScope
} from '@ppt/application';
import {
  SIGNED_PLUGIN_MAX_INSTALLATIONS,
  SIGNED_PLUGIN_MAX_MUTATIONS,
  SIGNED_PLUGIN_MAX_RELEASES_PER_PLUGIN,
  signedPluginPlatformCenterId,
  signedPluginPlatformTruth,
  type SignedPluginPlatformCenterView,
  type SignedPluginReleaseView
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  SignedPluginPlatformCenterKey,
  SignedPluginPlatformPolicyResourceRepositoryPort,
  SignedPluginPlatformRepositoryPort,
  SignedPluginReleaseRow
} from '@ppt/repository-contracts';
import {
  RepositoryBackedLifePolicyTransactionRunner,
  type RepositoryBackedLifeApplicationDependencies
} from './life-application-adapter.js';

export interface RepositoryBackedSignedPluginPlatformDependencies extends RepositoryBackedLifeApplicationDependencies {
  readonly signedPluginPlatformRepository: SignedPluginPlatformRepositoryPort;
  readonly signedPluginPlatformPolicyResourceRepository: SignedPluginPlatformPolicyResourceRepositoryPort;
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
): SignedPluginPlatformCenterKey => ({
  familyId: context.familyId,
  accountId: context.actor.userId,
  actorPersonId: context.actor.personId!,
  ownerPersonId,
  centerId: signedPluginPlatformCenterId(context.familyId, ownerPersonId)
});
const releaseView = (row: SignedPluginReleaseRow, generatedAt: string): SignedPluginReleaseView => Object.freeze({
  version: row.version,
  minimumHostVersion: row.minimumHostVersion,
  providerKinds: Object.freeze([...row.providerKinds]),
  capabilityCodes: Object.freeze([...row.capabilityCodes]),
  dataDeclarations: Object.freeze(row.dataDeclarations.map((item) => Object.freeze({ ...item }))),
  egressMode: row.egressMode,
  egressHostCount: row.egressHosts.length,
  sandboxProfile: 'isolated_child_process',
  signatureVerified: true,
  sbomEvidencePresent: true,
  licenseInventoryEvidencePresent: true,
  provenanceEvidencePresent: true,
  verifiedAt: row.verifiedAt,
  expiresAt: row.expiresAt,
  manifestStatus: Date.parse(row.expiresAt) > Date.parse(generatedAt) ? 'valid' : 'expired'
});

export class RepositoryBackedSignedPluginPlatformQueryPort implements SignedPluginPlatformQueryPort {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedSignedPluginPlatformDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) {
    this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }
  public getCenter(context: LifeApplicationContext): ReturnType<SignedPluginPlatformQueryPort['getCenter']> {
    return this.#runner.execute(context, signedPluginPlatformReadIntent(), ({ repository, occurredAt }) => {
      if (!context.actor.personId) return denied(context, 'İmzalı eklenti merkezi kişi bağlı oturum gerektirir.');
      const key = keyFor(context, context.actor.personId);
      const snapshot = this.dependencies.signedPluginPlatformRepository.loadCenter(repository, key);
      if (!snapshot.ok) return snapshot;
      const installations = snapshot.value.installations.map(({ installation, currentRelease, releaseCount }) => Object.freeze({
        id: installation.id,
        ownerPersonId: installation.ownerPersonId,
        displayName: installation.displayName,
        currentRelease: releaseView(currentRelease, occurredAt),
        ...(installation.previousVersion ? { previousVersion: installation.previousVersion } : {}),
        desiredState: installation.desiredState,
        runtimeExecutionReady: false as const,
        externalProviderConnectionReady: false as const,
        rollbackAvailable: installation.desiredState !== 'emergency_disabled'
          && releaseCount > 1 && Boolean(installation.previousVersion),
        releaseHistoryCount: releaseCount,
        releaseHistoryLimitReached: releaseCount >= SIGNED_PLUGIN_MAX_RELEASES_PER_PLUGIN,
        revision: installation.revision,
        createdAt: installation.createdAt,
        updatedAt: installation.updatedAt,
        ...(installation.emergencyDisabledAt ? { emergencyDisabledAt: installation.emergencyDisabledAt } : {})
      }));
      const view: SignedPluginPlatformCenterView = Object.freeze({
        schemaVersion: 1,
        centerId: key.centerId,
        ownerPersonId: context.actor.personId,
        installations: Object.freeze(installations),
        installationTotal: snapshot.value.installationTotal,
        storageCapacity: Object.freeze({
          installations: Object.freeze({
            current: snapshot.value.installationTotal,
            maximum: SIGNED_PLUGIN_MAX_INSTALLATIONS,
            remaining: Math.max(0, SIGNED_PLUGIN_MAX_INSTALLATIONS - snapshot.value.installationTotal),
            limitReached: snapshot.value.installationTotal >= SIGNED_PLUGIN_MAX_INSTALLATIONS
          }),
          mutations: Object.freeze({
            current: snapshot.value.mutationCount,
            maximum: SIGNED_PLUGIN_MAX_MUTATIONS,
            remaining: Math.max(0, SIGNED_PLUGIN_MAX_MUTATIONS - snapshot.value.mutationCount),
            limitReached: snapshot.value.mutationCount >= SIGNED_PLUGIN_MAX_MUTATIONS
          })
        }),
        truth: signedPluginPlatformTruth,
        generatedAt: occurredAt
      });
      return ok(view);
    });
  }
}

class RepositoryBackedSignedPluginPlatformWriteScope implements SignedPluginPlatformWriteScope {
  public readonly ownerPersonId: SignedPluginPlatformCenterKey['ownerPersonId'];
  readonly #key: SignedPluginPlatformCenterKey;
  public constructor(
    private readonly dependencies: RepositoryBackedSignedPluginPlatformDependencies,
    private readonly context: LifeApplicationContext,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: SignedPluginPlatformWriteScope['occurredAt']
  ) {
    const owner = repository.policyAuthorization.receiptRecord.request.resource.ownerPersonId;
    if (!context.actor.personId || !owner) throw new Error('Signed plugin durable owner context is incomplete');
    this.ownerPersonId = asPersonId(owner);
    this.#key = keyFor(context, this.ownerPersonId);
  }
  public findInstallation(pluginId: string) {
    return this.dependencies.signedPluginPlatformRepository.findInstallation(this.repository, this.#key, pluginId);
  }
  public findRelease(pluginId: string, version: string) {
    return this.dependencies.signedPluginPlatformRepository.findRelease(this.repository, this.#key, pluginId, version);
  }
  public getStorageUsage(pluginId: string) {
    return this.dependencies.signedPluginPlatformRepository.getStorageUsage(this.repository, this.#key, pluginId);
  }
  public findMutation(clientOperationId: string) {
    return this.dependencies.signedPluginPlatformRepository.findMutationByClientOperationId(this.repository, this.#key, clientOperationId);
  }
  public insertMutation(row: Parameters<SignedPluginPlatformWriteScope['insertMutation']>[0]) {
    return this.dependencies.signedPluginPlatformRepository.insertMutation(this.repository, row);
  }
  public insertRelease(row: Parameters<SignedPluginPlatformWriteScope['insertRelease']>[0]) {
    return this.dependencies.signedPluginPlatformRepository.insertRelease(this.repository, row);
  }
  public insertInstallation(row: Parameters<SignedPluginPlatformWriteScope['insertInstallation']>[0]) {
    return this.dependencies.signedPluginPlatformRepository.insertInstallation(this.repository, row);
  }
  public saveInstallation(row: Parameters<SignedPluginPlatformWriteScope['saveInstallation']>[0], expectedRevision: number) {
    return this.dependencies.signedPluginPlatformRepository.saveInstallation(this.repository, row, expectedRevision);
  }
  public appendAudit(input: Parameters<SignedPluginPlatformWriteScope['appendAudit']>[0]) {
    return this.dependencies.auditRepository.append(this.repository, input);
  }
  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.repository, event);
  }
}

export class RepositoryBackedSignedPluginPlatformUnitOfWork implements SignedPluginPlatformUnitOfWork {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedSignedPluginPlatformDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) {
    this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }
  public execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: SignedPluginPlatformWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    return this.#runner.execute(context, intent, ({ repository, occurredAt }) => operation(
      new RepositoryBackedSignedPluginPlatformWriteScope(this.dependencies, context, repository, occurredAt)));
  }
}
