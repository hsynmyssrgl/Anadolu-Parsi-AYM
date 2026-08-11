import { randomUUID } from 'node:crypto';
import {
  CORE_SERVICE_APPLICATION_API_VERSION,
  CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION,
  CORE_SERVICE_REQUIRED_DESKTOP_METHODS,
  type CoreServiceArchitectureContract,
  type CoreServiceDeviceSecretProtectionStatusContract,
  type CoreServiceFamilyDataCutoverReadinessStatusContract,
  type CoreServiceFamilyDataCutoverStatusContract,
  type CoreServiceFamilyDataStatusContract
  , type PolicyJournalCheckpointContractPayload
  , type PolicyJournalCheckpointContractResult
} from '@ppt/core-service-contracts';
import {
  PlatformPolicyEnforcementError,
  PlatformPolicyKernel,
  type PlatformPolicyAuthorization,
  type PlatformPolicyClusterFenceSnapshot,
  type PlatformPolicyDecision,
  type PlatformPolicyEnforcementPoint,
  type PlatformPolicyIntent,
  type PlatformPolicyReceipt,
  type PlatformPolicyRequest,
  type PlatformPolicyTransactionContext
} from '@ppt/platform-policy';
import type { ClusterRole, CoreServiceHealthSnapshot, CoreServiceLifecycle } from './service-state.js';
import { CoreServiceFamilyDataOwnershipRuntime, type CoreServiceFamilyDataSessionPort } from './family-data-ownership-runtime.js';
import { CoreServiceDeviceSecretProtectionRuntime } from './device-secret-protection-runtime.js';
import { CoreServiceFamilyDataCutoverGuard } from './family-data-cutover-guard.js';
import { CoreServiceFamilyDataCutoverReadinessLedger } from './family-data-cutover-readiness-ledger.js';
import type { DeviceSecretProtector } from '@ppt/security';
import type { CoreServicePolicyJournalMonotonicAuthority } from './policy-journal-monotonic-authority.js';

export interface CoreServiceRuntimeOptions {
  readonly policyKernel: PlatformPolicyKernel;
  readonly policyVersion: string;
  readonly clock?: () => string;
  readonly nonceFactory?: () => string;
  readonly policyEnforcementPoint?: PlatformPolicyEnforcementPoint;
  readonly familyDataOwnership?: CoreServiceFamilyDataOwnershipRuntime;
  readonly deviceSecretProtection?: CoreServiceDeviceSecretProtectionRuntime;
  readonly familyDataCutoverGuard?: CoreServiceFamilyDataCutoverGuard;
  readonly familyDataCutoverReadiness?: CoreServiceFamilyDataCutoverReadinessLedger;
  readonly policyJournalMonotonicAuthority?: CoreServicePolicyJournalMonotonicAuthority;
}

export interface AuthorizedPolicyResult {
  readonly effectiveRequest: PlatformPolicyRequest;
  readonly authorization: PlatformPolicyAuthorization;
  readonly fence: PlatformPolicyClusterFenceSnapshot;
}

export interface PolicyReceiptVerificationResult {
  readonly valid: boolean;
  readonly fence: PlatformPolicyClusterFenceSnapshot;
}

export class CoreServiceRuntime {
  readonly #kernel: PlatformPolicyKernel;
  readonly #policyVersion: string;
  readonly #clock: () => string;
  readonly #startedAt: string;
  readonly #nonceFactory: () => string;
  readonly #policyEnforcementPoint: PlatformPolicyEnforcementPoint | undefined;
  readonly #familyDataOwnership: CoreServiceFamilyDataOwnershipRuntime;
  readonly #deviceSecretProtection: CoreServiceDeviceSecretProtectionRuntime;
  readonly #familyDataCutoverGuard: CoreServiceFamilyDataCutoverGuard;
  readonly #familyDataCutoverReadiness: CoreServiceFamilyDataCutoverReadinessLedger;
  readonly #policyJournalMonotonicAuthority: CoreServicePolicyJournalMonotonicAuthority | undefined;
  #lifecycle: CoreServiceLifecycle = 'starting';
  #role: ClusterRole = 'standalone';
  #writable = false;
  #safeMode = true;
  #writeFenceEpoch = 0;
  #reasons: string[] = ['INITIALIZING'];

  public constructor(options: CoreServiceRuntimeOptions) {
    this.#kernel = options.policyKernel;
    this.#policyVersion = options.policyVersion;
    if (this.#kernel.policyPackage.payload.policyVersion !== this.#policyVersion) {
      throw new Error('Core Service policy version does not match the signed policy package');
    }
    if (this.#kernel.applicationVersionFor('windows-core-service') !== CORE_SERVICE_APPLICATION_API_VERSION) {
      throw new Error('Core Service application API version does not match the signed policy package');
    }
    this.#clock = options.clock ?? (() => new Date().toISOString());
    this.#startedAt = this.#clock();
    this.#nonceFactory = options.nonceFactory ?? randomUUID;
    this.#policyEnforcementPoint = options.policyEnforcementPoint;
    this.#familyDataOwnership = options.familyDataOwnership ?? new CoreServiceFamilyDataOwnershipRuntime(this.#clock);
    this.#deviceSecretProtection = options.deviceSecretProtection ?? new CoreServiceDeviceSecretProtectionRuntime(this.#clock);
    this.#familyDataCutoverGuard = options.familyDataCutoverGuard ?? new CoreServiceFamilyDataCutoverGuard(this.#clock);
    this.#familyDataCutoverReadiness = options.familyDataCutoverReadiness ?? new CoreServiceFamilyDataCutoverReadinessLedger({ clock: this.#clock });
    this.#policyJournalMonotonicAuthority = options.policyJournalMonotonicAuthority;
  }

  public markReady(role: ClusterRole = 'standalone'): void {
    this.#writeFenceEpoch += 1;
    this.#role = role;
    this.#lifecycle = 'ready';
    this.#safeMode = false;
    this.#writable = role === 'standalone' || role === 'leader';
    this.#reasons = [];
  }

  public enterSafeMode(reason: string): void {
    this.#writeFenceEpoch += 1;
    this.#lifecycle = 'degraded';
    this.#safeMode = true;
    this.#writable = false;
    this.#reasons = [reason.trim() || 'UNSPECIFIED_SAFE_MODE'];
  }

  public beginShutdown(): void {
    this.#writeFenceEpoch += 1;
    this.#lifecycle = 'stopping';
    this.#writable = false;
    this.#safeMode = true;
    this.#reasons = ['SHUTTING_DOWN'];
  }

  public finishShutdown(): void {
    this.#writeFenceEpoch += 1;
    this.#lifecycle = 'stopped';
    this.#writable = false;
    this.#safeMode = true;
    this.#reasons = ['STOPPED'];
  }

  public dispose(): void {
    this.#policyJournalMonotonicAuthority?.dispose();
  }

  public authorize(request: PlatformPolicyRequest): PlatformPolicyDecision {
    return this.#kernel.evaluate({ ...request, clusterWritable: request.clusterWritable && this.#writable });
  }

  public authorizeWithReceipt(request: PlatformPolicyRequest, nonce: string = this.#nonceFactory()): AuthorizedPolicyResult {
    const fence = this.#fenceSnapshot();
    const effectiveRequest = Object.freeze({ ...request, clusterWritable: request.clusterWritable && fence.writable });
    return Object.freeze({
      effectiveRequest,
      authorization: this.#kernel.authorizeWithReceipt(effectiveRequest, this.#clock(), nonce),
      fence
    });
  }

  public verifyReceiptForRequest(request: PlatformPolicyRequest, receipt: PlatformPolicyReceipt): PolicyReceiptVerificationResult {
    return Object.freeze({
      valid: this.#kernel.verifyReceiptForRequest(receipt, request),
      fence: this.#fenceSnapshot()
    });
  }

  public executeAuthorizedTransaction<T>(
    intent: PlatformPolicyIntent,
    operation: (context: PlatformPolicyTransactionContext) => Promise<T> | T
  ): Promise<T> {
    if (!this.#policyEnforcementPoint) {
      throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE', 'Core Service policy enforcement point is unavailable');
    }
    return this.#policyEnforcementPoint.execute(intent, () => Object.freeze({ writable: this.#writable, epoch: this.#writeFenceEpoch }), operation);
  }

  public health(): CoreServiceHealthSnapshot {
    return Object.freeze({
      lifecycle: this.#lifecycle,
      role: this.#role,
      writable: this.#writable,
      safeMode: this.#safeMode,
      writeFenceEpoch: this.#writeFenceEpoch,
      policyVersion: this.#policyVersion,
      policyPackage: this.#kernel.policyPackage,
      startedAt: this.#startedAt,
      observedAt: this.#clock(),
      reasons: Object.freeze([...this.#reasons])
    });
  }

  public familyDataStatus(): CoreServiceFamilyDataStatusContract {
    return this.#familyDataOwnership.status();
  }

  public attachFamilyDataSession(session: CoreServiceFamilyDataSessionPort): CoreServiceFamilyDataStatusContract {
    this.#familyDataCutoverGuard.assertSessionAttachmentAllowed();
    return this.#familyDataOwnership.attach(session);
  }

  public sealFamilyDataSession(): Promise<CoreServiceFamilyDataStatusContract> {
    return this.#familyDataOwnership.seal();
  }

  public deviceSecretProtectionStatus(): CoreServiceDeviceSecretProtectionStatusContract {
    return this.#deviceSecretProtection.status();
  }

  public attachDeviceSecretProtector(protector: DeviceSecretProtector): CoreServiceDeviceSecretProtectionStatusContract {
    return this.#deviceSecretProtection.attach(protector);
  }

  public familyDataCutoverStatus(): CoreServiceFamilyDataCutoverStatusContract {
    return this.#familyDataCutoverGuard.status();
  }

  public familyDataCutoverReadinessStatus(): CoreServiceFamilyDataCutoverReadinessStatusContract {
    return this.#familyDataCutoverReadiness.status();
  }

  public checkpointPolicyJournal(
    input: PolicyJournalCheckpointContractPayload
  ): PolicyJournalCheckpointContractResult {
    if (!this.#policyJournalMonotonicAuthority) {
      throw new PlatformPolicyEnforcementError(
        'ENFORCEMENT_UNAVAILABLE',
        'Core Service policy-journal monotonic authority is unavailable'
      );
    }
    return this.#policyJournalMonotonicAuthority.checkpoint(input);
  }

  public architecture(): CoreServiceArchitectureContract {
    const familyData = this.#familyDataOwnership.status();
    const deviceSecretProtection = this.#deviceSecretProtection.status();
    const familyDataCutover = this.#familyDataCutoverGuard.status();
    return Object.freeze({
      schemaVersion: 1,
      apiVersion: CORE_SERVICE_APPLICATION_API_VERSION,
      protocolVersion: CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION,
      processBoundary: 'headless-core-service',
      ownership: Object.freeze({
        process: 'core-service',
        policyKernel: 'core-service',
        applicationApi: 'core-service',
        familyData: familyData.owner,
        deviceSecretProtection: deviceSecretProtection.owner,
        backup: 'desktop-transition',
        sync: 'not-implemented'
      }),
      safety: Object.freeze({
        familyDataCutover: familyDataCutover.decision,
        legacyDesktopDataActive: familyDataCutover.legacyDesktopDataActive,
        automaticCutoverAllowed: familyDataCutover.automaticActivationAllowed
      }),
      supportedMethods: CORE_SERVICE_REQUIRED_DESKTOP_METHODS,
      requiredDesktopMethods: CORE_SERVICE_REQUIRED_DESKTOP_METHODS
    });
  }

  #fenceSnapshot(): PlatformPolicyClusterFenceSnapshot {
    return Object.freeze({ writable: this.#writable, epoch: this.#writeFenceEpoch });
  }
}
