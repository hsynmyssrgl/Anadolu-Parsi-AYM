import type { SupplyChainReleaseBoundaryView } from '@ppt/domain';
import {
  SupplyChainReleasePolicy,
  type SupplyChainReleaseDecision,
  type SupplyChainReleaseEvidence
} from '@ppt/platform-policy';

export interface SupplyChainReleaseEvidencePort {
  load(): Promise<unknown>;
}

export class EvaluateSupplyChainReleaseUseCase {
  private readonly policy: SupplyChainReleasePolicy;
  private readonly evidence: SupplyChainReleaseEvidencePort;

  public constructor(
    policy: SupplyChainReleasePolicy,
    evidence: SupplyChainReleaseEvidencePort
  ) {
    this.policy = policy;
    this.evidence = evidence;
  }

  public async execute(): Promise<SupplyChainReleaseDecision> {
    try { return this.policy.evaluate(await this.evidence.load()); }
    catch { return this.policy.evaluate(undefined); }
  }
}

export class AuthorizeSupplyChainReleaseUseCase {
  private readonly evaluator: EvaluateSupplyChainReleaseUseCase;
  private readonly policy: SupplyChainReleasePolicy;

  public constructor(evaluator: EvaluateSupplyChainReleaseUseCase, policy: SupplyChainReleasePolicy) {
    this.evaluator = evaluator;
    this.policy = policy;
  }

  public async execute<T>(callback: (decision: SupplyChainReleaseDecision) => Promise<T>): Promise<T> {
    const decision = await this.evaluator.execute();
    this.policy.assertReleaseEligible(decision);
    return callback(decision);
  }
}

export class GetSupplyChainReleaseBoundaryUseCase {
  private readonly evaluator: EvaluateSupplyChainReleaseUseCase;
  private readonly policy: SupplyChainReleasePolicy;

  public constructor(evaluator: EvaluateSupplyChainReleaseUseCase, policy: SupplyChainReleasePolicy) {
    this.evaluator = evaluator;
    this.policy = policy;
  }

  public async execute(): Promise<SupplyChainReleaseBoundaryView> {
    const snapshot = this.policy.snapshot(await this.evaluator.execute());
    if (!this.policy.verifySnapshot(snapshot)) throw new TypeError('SUPPLY_CHAIN_RELEASE_SNAPSHOT_INVALID');
    return Object.freeze({
      schemaVersion: 1,
      status: snapshot.status,
      releaseEligible: snapshot.releaseEligible,
      blockingReasonCount: snapshot.blockingReasonCount,
      enforcement: snapshot.enforcement,
      requiredLockfileCount: snapshot.requiredLockfileCount,
      requiredVulnerabilityScopeCount: snapshot.requiredVulnerabilityScopeCount,
      requiredRegistrySignatureScopeCount: snapshot.requiredRegistrySignatureScopeCount,
      requiredExternalAssetCount: snapshot.requiredExternalAssetCount,
      installerAndMainExecutableAuthenticodeRequired: snapshot.installerAndMainExecutableAuthenticodeRequired,
      productionCertificateExternal: snapshot.productionCertificateExternal,
      detailsExposedToClient: false,
      grantsReleaseAuthority: false,
      schemaMigrationRequired: snapshot.schemaMigrationRequired,
      latestDatabaseMigration: snapshot.latestDatabaseMigration
    });
  }
}

export const asSupplyChainReleaseEvidence = (value: SupplyChainReleaseEvidence): SupplyChainReleaseEvidence => value;
