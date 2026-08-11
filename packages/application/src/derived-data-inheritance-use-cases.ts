import {
  ERROR_CODES,
  createAppError,
  type AppError,
  type CorrelationId
} from '@ppt/core';
import type { DerivedDataPolicyBoundaryView } from '@ppt/domain';
import {
  DerivedDataInheritancePolicy,
  type DerivedDataPolicyBinding,
  type DerivedDataSourcePolicySnapshot,
  type DerivedDataTargetPolicy
} from '@ppt/platform-policy';

export interface DerivedDataInheritancePersistencePort {
  persist(binding: DerivedDataPolicyBinding): void | Promise<void>;
}

const denied = (correlationId: CorrelationId, reason: string): AppError => createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message: 'Türetilmiş veri, kaynak politikalarının tamamını en az aynı sıkılıkta devralmadan işlenemez.',
  category: 'security',
  correlationId,
  details: Object.freeze({ reason })
});

export class EnforceDerivedDataInheritanceUseCase {
  public constructor(
    private readonly policy: DerivedDataInheritancePolicy,
    private readonly persistence: DerivedDataInheritancePersistencePort
  ) {}

  public async execute<T>(input: {
    readonly correlationId: CorrelationId;
    readonly target: DerivedDataTargetPolicy;
    readonly sources: readonly DerivedDataSourcePolicySnapshot[];
    readonly operation: (binding: DerivedDataPolicyBinding) => T | Promise<T>;
  }): Promise<T> {
    const decision = this.policy.evaluate({ target: input.target, sources: input.sources });
    if (!decision.allowed) throw denied(input.correlationId, decision.reason);

    const verified = this.policy.verify(decision.binding);
    if (!verified.allowed) throw denied(input.correlationId, verified.reason);

    await this.persistence.persist(verified.binding);
    return input.operation(verified.binding);
  }
}

export class GetDerivedDataPolicyBoundaryUseCase {
  public constructor(private readonly policy: DerivedDataInheritancePolicy) {}

  public execute(): DerivedDataPolicyBoundaryView {
    const snapshot = this.policy.snapshot();
    return Object.freeze({
      schemaVersion: 1,
      enforcement: snapshot.enforcement,
      supportedKinds: snapshot.supportedKinds,
      maximumSourceCount: snapshot.maximumSourceCount,
      maximumLineageDepth: snapshot.maximumLineageDepth,
      maximumAncestorCount: snapshot.maximumAncestorCount,
      sourcePolicyIntersectionRequired: snapshot.sourcePolicyIntersectionRequired,
      sensitivityDowngradeAllowed: snapshot.sensitivityDowngradeAllowed,
      accessBroadeningAllowed: snapshot.accessBroadeningAllowed,
      authorizedRepositoryAdapterCount: snapshot.authorizedRepositoryAdapterCount,
      directAccessExceptionCount: snapshot.directAccessExceptionCount,
      payloadExposed: snapshot.payloadExposed,
      persistentPathExposed: snapshot.persistentPathExposed,
      secretMaterialExposed: snapshot.secretMaterialExposed,
      cutoverAuthorityAttached: snapshot.cutoverAuthorityAttached
    });
  }
}
