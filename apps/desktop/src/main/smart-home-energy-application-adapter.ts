import { ERROR_CODES, asPersonId, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import {
  smartHomeEnergyReadIntent,
  type LifeApplicationContext,
  type LifePolicyIntent,
  type SmartHomeEnergyQueryPort,
  type SmartHomeEnergyUnitOfWork,
  type SmartHomeEnergyWriteScope
} from '@ppt/application';
import { smartHomeEnergyCenterId, smartHomeEnergyTruth, type SmartHomeEnergyCenterView } from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  SmartHomeEnergyCenterKey,
  SmartHomeEnergyPolicyResourceRepositoryPort,
  SmartHomeEnergyRepositoryPort
} from '@ppt/repository-contracts';
import {
  RepositoryBackedLifePolicyTransactionRunner,
  type RepositoryBackedLifeApplicationDependencies
} from './life-application-adapter.js';

export interface RepositoryBackedSmartHomeEnergyDependencies extends RepositoryBackedLifeApplicationDependencies {
  readonly smartHomeEnergyRepository: SmartHomeEnergyRepositoryPort;
  readonly smartHomeEnergyPolicyResourceRepository: SmartHomeEnergyPolicyResourceRepositoryPort;
}

const denied = (context: LifeApplicationContext, message: string): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED, message, category: 'authorization', correlationId: context.correlationId
}));
const keyFor = (
  context: LifeApplicationContext,
  ownerPersonId: NonNullable<LifeApplicationContext['actor']['personId']>
): SmartHomeEnergyCenterKey => ({ familyId: context.familyId, accountId: context.actor.userId,
  actorPersonId: context.actor.personId!, ownerPersonId, centerId: smartHomeEnergyCenterId(context.familyId, ownerPersonId) });

export class RepositoryBackedSmartHomeEnergyQueryPort implements SmartHomeEnergyQueryPort {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(private readonly dependencies: RepositoryBackedSmartHomeEnergyDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner) {
    this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }
  public getCenter(context: LifeApplicationContext): ReturnType<SmartHomeEnergyQueryPort['getCenter']> {
    return this.#runner.execute(context, smartHomeEnergyReadIntent(), ({ repository, occurredAt }) => {
      if (!context.actor.personId) return denied(context, 'Akıllı ev alanı kişi bağlı oturum gerektirir.');
      const key = keyFor(context, context.actor.personId);
      const snapshot = this.dependencies.smartHomeEnergyRepository.loadCenter(repository, key);
      if (!snapshot.ok) return snapshot;
      const devices = snapshot.value.devices.map(({ familyId: _family, localIdentifierSha256: _identifier,
        adapterManifestSha256: _manifest, adapterSignerKeyId: _signer, stateFingerprint: _state,
        lastMutationId: _mutation, ...view }) => Object.freeze(view));
      const observations = snapshot.value.observations.map(({ familyId: _family, ownerPersonId: _owner,
        sourceManifestSha256: _manifest, stateFingerprint: _state, lastMutationId: _mutation, ...view }) => Object.freeze(view));
      const cameraConsents = snapshot.value.cameraConsents.map(({ familyId: _family, stateFingerprint: _state,
        lastMutationId: _mutation, ...view }) => Object.freeze(view));
      const settings = snapshot.value.settings
        ? (({ familyId: _family, stateFingerprint: _state, lastMutationId: _mutation, ...view }) => Object.freeze(view))(snapshot.value.settings)
        : Object.freeze({ id: `smart-home-settings:${context.actor.personId}`, ownerPersonId: context.actor.personId,
          processingEnabled: false, cameraAccessDefaultDenied: true as const, hiddenSurveillanceProhibited: true as const,
          revision: 0, createdAt: occurredAt, updatedAt: occurredAt });
      const view: SmartHomeEnergyCenterView = Object.freeze({ schemaVersion: 1, centerId: key.centerId,
        ownerPersonId: context.actor.personId, devices: Object.freeze(devices), observations: Object.freeze(observations),
        observationTotal: snapshot.value.observationTotal,
        observationsTruncated: snapshot.value.observationTotal > snapshot.value.observations.length,
        cameraConsents: Object.freeze(cameraConsents), settings, truth: smartHomeEnergyTruth, generatedAt: occurredAt });
      return ok(view);
    });
  }
}

class RepositoryBackedSmartHomeEnergyWriteScope implements SmartHomeEnergyWriteScope {
  public readonly ownerPersonId: SmartHomeEnergyCenterKey['ownerPersonId'];
  readonly #key: SmartHomeEnergyCenterKey;
  public constructor(private readonly dependencies: RepositoryBackedSmartHomeEnergyDependencies,
    private readonly context: LifeApplicationContext,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: SmartHomeEnergyWriteScope['occurredAt']) {
    const owner = repository.policyAuthorization.receiptRecord.request.resource.ownerPersonId;
    if (!context.actor.personId || !owner) throw new Error('Smart home durable owner context is incomplete');
    this.ownerPersonId = asPersonId(owner); this.#key = keyFor(context, asPersonId(owner));
  }
  public findDevice(deviceId: string) { return this.dependencies.smartHomeEnergyRepository.findDevice(this.repository, this.#key, deviceId); }
  public findConsent(consentId: string) { return this.dependencies.smartHomeEnergyRepository.findConsent(this.repository, this.#key, consentId); }
  public findSettings() { return this.dependencies.smartHomeEnergyRepository.findSettings(this.repository, this.#key); }
  public findMutation(clientOperationId: string) {
    return this.dependencies.smartHomeEnergyRepository.findMutationByClientOperationId(this.repository, this.#key, clientOperationId);
  }
  public insertMutation(row: Parameters<SmartHomeEnergyWriteScope['insertMutation']>[0]) {
    return this.dependencies.smartHomeEnergyRepository.insertMutation(this.repository, row);
  }
  public insertDevice(row: Parameters<SmartHomeEnergyWriteScope['insertDevice']>[0]) {
    return this.dependencies.smartHomeEnergyRepository.insertDevice(this.repository, row);
  }
  public saveDevice(row: Parameters<SmartHomeEnergyWriteScope['saveDevice']>[0], expectedRevision: number) {
    return this.dependencies.smartHomeEnergyRepository.saveDevice(this.repository, row, expectedRevision);
  }
  public insertObservation(row: Parameters<SmartHomeEnergyWriteScope['insertObservation']>[0]) {
    return this.dependencies.smartHomeEnergyRepository.insertObservation(this.repository, row);
  }
  public insertConsent(row: Parameters<SmartHomeEnergyWriteScope['insertConsent']>[0]) {
    return this.dependencies.smartHomeEnergyRepository.insertConsent(this.repository, row);
  }
  public saveConsent(row: Parameters<SmartHomeEnergyWriteScope['saveConsent']>[0], expectedRevision: number) {
    return this.dependencies.smartHomeEnergyRepository.saveConsent(this.repository, row, expectedRevision);
  }
  public insertSettings(row: Parameters<SmartHomeEnergyWriteScope['insertSettings']>[0]) {
    return this.dependencies.smartHomeEnergyRepository.insertSettings(this.repository, row);
  }
  public saveSettings(row: Parameters<SmartHomeEnergyWriteScope['saveSettings']>[0], expectedRevision: number) {
    return this.dependencies.smartHomeEnergyRepository.saveSettings(this.repository, row, expectedRevision);
  }
  public appendAudit(input: Parameters<SmartHomeEnergyWriteScope['appendAudit']>[0]) {
    return this.dependencies.auditRepository.append(this.repository, input);
  }
  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.repository, event);
  }
}

export class RepositoryBackedSmartHomeEnergyUnitOfWork implements SmartHomeEnergyUnitOfWork {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(private readonly dependencies: RepositoryBackedSmartHomeEnergyDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner) {
    this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }
  public execute<T>(context: LifeApplicationContext, intent: LifePolicyIntent,
    operation: (scope: SmartHomeEnergyWriteScope) => Result<T, AppError>): Promise<Result<T, AppError>> {
    return this.#runner.execute(context, intent, ({ repository, occurredAt }) => operation(
      new RepositoryBackedSmartHomeEnergyWriteScope(this.dependencies, context, repository, occurredAt)));
  }
}
