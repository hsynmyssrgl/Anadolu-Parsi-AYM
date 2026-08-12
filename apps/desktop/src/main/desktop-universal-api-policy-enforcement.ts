import {
  ClientDataAccessBoundaryPolicy,
  PolicyServiceAvailabilityPolicy,
  assertActivePlatformPolicyTransactionContext,
  createTypedPolicyEnforcementPoint,
  type ClientDataAccessBootstrapRequest,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyClusterFence,
  type PlatformPolicyConnectionAuthority,
  type PlatformPolicyIntent,
  type PolicyServiceAvailabilityDecision,
  type PlatformPolicyReceiptSink
} from '@ppt/platform-policy';
import { EnforceClientDataAccessUseCase, GetClientDataAccessBoundaryUseCase } from '@ppt/application';
import type { ClientDataAccessBoundaryView } from '@ppt/domain';
import type { CorrelationId } from '@ppt/core';
import { DesktopRepositoryPolicyScope } from './desktop-repository-policy-scope.js';

export interface DesktopUniversalApiPolicyEnforcementDependencies {
  readonly authorizationProvider: PlatformPolicyAuthorizationProvider;
  readonly receiptSink: PlatformPolicyReceiptSink;
  readonly clusterFence: PlatformPolicyClusterFence;
  readonly resolveAuthority: () => PlatformPolicyConnectionAuthority | Promise<PlatformPolicyConnectionAuthority>;
  readonly repositoryPolicyScope: DesktopRepositoryPolicyScope;
  readonly resolveBootstrapClientContext: () => Omit<ClientDataAccessBootstrapRequest, 'schemaVersion' | 'channel' | 'method' | 'transport'>;
  readonly evaluatePolicyServiceAvailability: () => Promise<PolicyServiceAvailabilityDecision>;
  readonly onAvailabilityRestricted?: (decision: PolicyServiceAvailabilityDecision) => void;
  readonly clock?: () => string;
}

export interface DesktopUniversalApiExecutionInput<T> {
  readonly channel: string;
  readonly correlationId: CorrelationId;
  readonly operation: () => T | Promise<T>;
}

const READ_VERBS = new Set([
  'compare', 'get', 'health', 'insights', 'inspect', 'list', 'lookup',
  'preview', 'read', 'search', 'status', 'summary', 'verify'
]);

const BOOTSTRAP_CHANNELS = new Set([
  'app:getInfo',
  'auth:getExternalIdentityProviders',
  'auth:getState',
  'auth:getSessionLockState',
  'auth:recordSessionActivity',
  'auth:lockSession',
  'auth:unlockSession',
  'auth:getWindowsHelloState',
  'auth:login',
  'auth:loginWithWindowsHello',
  'auth:setup',
  'invitations:accept',
  'invitations:inspect'
]);

export const POLICY_SERVICE_AVAILABILITY_STATUS_CHANNEL = 'system:getPolicyServiceAvailabilityBoundary' as const;

const nonEmpty = (value: unknown, max = 512): value is string =>
  typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max;

export const isDesktopPolicyBootstrapChannel = (channel: string): boolean =>
  BOOTSTRAP_CHANNELS.has(channel);

export const isDesktopPolicyServiceAvailabilityStatusChannel = (channel: string): boolean =>
  channel === POLICY_SERVICE_AVAILABILITY_STATUS_CHANNEL;

export const resolveDesktopUniversalApiIntent = (
  channel: string,
  correlationId: CorrelationId
): PlatformPolicyIntent => {
  if (!nonEmpty(channel, 256) || !channel.includes(':')) {
    throw new Error('DESKTOP_API_POLICY_CHANNEL_INVALID');
  }
  const verb = channel.slice(channel.lastIndexOf(':') + 1).replace(/^(?:get|list|search|read|verify|inspect|preview|lookup|compare|create|update|delete|upsert|run|set|begin|apply|export|archive|capture|process|evaluate|acknowledge|register|rotate|revoke|reset|recover|request|execute|finalize|cancel|assign|end|toggle|mark|resend|trust|change|enable|disable|enroll|reauthorize|logout|maintenance).*/u, (value) => {
    const match = /^(get|list|search|read|verify|inspect|preview|lookup|compare|create|update|delete|upsert|run|set|begin|apply|export|archive|capture|process|evaluate|acknowledge|register|rotate|revoke|reset|recover|request|execute|finalize|cancel|assign|end|toggle|mark|resend|trust|change|enable|disable|enroll|reauthorize|logout|maintenance)/u.exec(value);
    return match?.[1] ?? value;
  });
  const read = READ_VERBS.has(verb);
  return Object.freeze({
    correlationId,
    action: read ? 'read' : 'update',
    capability: read ? 'family.read' : 'family.write',
    resourceType: 'desktop_ipc_endpoint',
    resourceId: channel,
    purpose: 'administration'
  });
};

/**
 * Default-deny PEP in front of every trusted renderer API. A small, explicit
 * bootstrap set remains outside this boundary because no authenticated policy
 * subject exists yet. Domain PEPs remain authoritative and execute inside this
 * outer API receipt boundary.
 */
export class DesktopUniversalApiPolicyEnforcement {
  readonly #enforcementPoint: ReturnType<typeof createTypedPolicyEnforcementPoint>;
  readonly #clusterFence: PlatformPolicyClusterFence;
  readonly #repositoryPolicyScope: DesktopRepositoryPolicyScope;
  readonly #clientDataAccessPolicy = new ClientDataAccessBoundaryPolicy();
  readonly #clientDataAccessEnforcement: EnforceClientDataAccessUseCase;
  readonly #clientDataAccessStatus: GetClientDataAccessBoundaryUseCase;
  readonly #policyServiceAvailabilityPolicy = new PolicyServiceAvailabilityPolicy();
  readonly #evaluatePolicyServiceAvailability: DesktopUniversalApiPolicyEnforcementDependencies['evaluatePolicyServiceAvailability'];
  readonly #onAvailabilityRestricted: DesktopUniversalApiPolicyEnforcementDependencies['onAvailabilityRestricted'];
  readonly #resolveBootstrapClientContext: DesktopUniversalApiPolicyEnforcementDependencies['resolveBootstrapClientContext'];

  public constructor(dependencies: DesktopUniversalApiPolicyEnforcementDependencies) {
    if (
      !dependencies ||
      typeof dependencies.resolveAuthority !== 'function' ||
      typeof dependencies.resolveBootstrapClientContext !== 'function' ||
      typeof dependencies.evaluatePolicyServiceAvailability !== 'function' ||
      dependencies.authorizationProvider?.decisionAuthority !== 'windows-core-service' ||
      !(dependencies.repositoryPolicyScope instanceof DesktopRepositoryPolicyScope)
    ) {
      throw new Error('DESKTOP_API_POLICY_AUTHORITY_UNAVAILABLE');
    }
    this.#clusterFence = dependencies.clusterFence;
    this.#repositoryPolicyScope = dependencies.repositoryPolicyScope;
    this.#resolveBootstrapClientContext = dependencies.resolveBootstrapClientContext;
    this.#evaluatePolicyServiceAvailability = dependencies.evaluatePolicyServiceAvailability;
    this.#onAvailabilityRestricted = dependencies.onAvailabilityRestricted;
    this.#clientDataAccessEnforcement = new EnforceClientDataAccessUseCase(this.#clientDataAccessPolicy);
    this.#clientDataAccessStatus = new GetClientDataAccessBoundaryUseCase(this.#clientDataAccessPolicy);
    this.#enforcementPoint = createTypedPolicyEnforcementPoint({
      provider: dependencies.authorizationProvider,
      receiptSink: dependencies.receiptSink,
      authorityResolver: { resolve: dependencies.resolveAuthority },
      resourceResolver: {
        resolve: async (intent, authority) => {
          const familyId = authority.familyIds?.[0];
          if (!nonEmpty(familyId) || !nonEmpty(authority.personId)) {
            throw new Error('DESKTOP_API_POLICY_SUBJECT_SCOPE_UNAVAILABLE');
          }
          return Object.freeze({
            type: intent.resourceType,
            id: intent.resourceId,
            familyId,
            ownerPersonId: authority.personId,
            sensitivity: 'internal' as const
          });
        }
      },
      ...(dependencies.clock ? { clock: dependencies.clock } : {})
    });
  }

  public registerClientApplicationServiceChannel(channel: string): void {
    this.#clientDataAccessPolicy.registerApplicationServiceChannel(
      channel,
      isDesktopPolicyBootstrapChannel(channel) || isDesktopPolicyServiceAvailabilityStatusChannel(channel)
    );
  }

  public clientDataAccessBoundary(): ClientDataAccessBoundaryView {
    return this.#clientDataAccessStatus.execute();
  }

  public async execute<T>(input: DesktopUniversalApiExecutionInput<T>): Promise<T> {
    if (isDesktopPolicyServiceAvailabilityStatusChannel(input.channel)) return input.operation();
    const availability = await this.#evaluatePolicyServiceAvailability();
    if (availability.mode !== 'read-write') this.#onAvailabilityRestricted?.(availability);
    if (availability.mode === 'deny') {
      this.#policyServiceAvailabilityPolicy.assertOperationAllowed('read', availability);
    }
    if (isDesktopPolicyBootstrapChannel(input.channel)) {
      const bootstrapIntent = resolveDesktopUniversalApiIntent(input.channel, input.correlationId);
      this.#policyServiceAvailabilityPolicy.assertOperationAllowed(
        bootstrapIntent.action === 'read' ? 'read' : 'mutation',
        availability
      );
      const binding = this.#resolveBootstrapClientContext();
      return this.#clientDataAccessEnforcement.executeBootstrap({
        correlationId: input.correlationId,
        request: Object.freeze({
          schemaVersion: 1,
          channel: input.channel,
          method: 'application-service',
          transport: 'typed-electron-ipc',
          ...binding
        }),
        operation: () => this.#repositoryPolicyScope.runBootstrap({
          correlationId: input.correlationId,
          boundary: input.channel
        }, input.operation)
      });
    }
    const intent = resolveDesktopUniversalApiIntent(input.channel, input.correlationId);
    return this.#repositoryPolicyScope.runPolicyResolution({
      correlationId: input.correlationId,
      boundary: input.channel
    }, () => this.#enforcementPoint.execute(intent, this.#clusterFence, async (authorization) => {
      assertActivePlatformPolicyTransactionContext(authorization, {
        resourceType: intent.resourceType,
        resourceId: intent.resourceId,
        action: intent.action,
        capability: intent.capability,
        correlationId: input.correlationId,
        resourceFamilyId: authorization.resourceFamilyId,
        fenceEpoch: authorization.fenceEpoch,
        fenceWritable: authorization.fenceWritable
      });
      const receiptRequest = authorization.receiptRecord.request;
      const certificate = receiptRequest.subject.deviceCertificate;
      return this.#clientDataAccessEnforcement.execute({
        correlationId: input.correlationId,
        request: Object.freeze({
          schemaVersion: 1,
          channel: input.channel,
          method: 'application-service',
          transport: 'typed-electron-ipc',
          applicationId: authorization.subject.applicationId,
          deviceId: authorization.subject.deviceId,
          subjectAccountId: authorization.subject.accountId,
          familyId: authorization.resourceFamilyId,
          policyVersion: authorization.policyVersion,
          policyPackageSha256: authorization.policyPackageSha256,
          capabilityManifestSha256: authorization.capabilityManifestSha256 ?? '',
          deviceCertificateSha256: authorization.deviceCertificateSha256 ?? '',
          authorizationContextSha256: authorization.contextHash,
          occurredAt: authorization.occurredAt
        }),
        authoritativeContext: Object.freeze({
          applicationId: receiptRequest.subject.applicationId,
          deviceId: receiptRequest.subject.deviceId,
          subjectAccountId: receiptRequest.subject.accountId,
          familyId: receiptRequest.resource.familyId,
          policyVersion: receiptRequest.policyVersion,
          policyPackageSha256: receiptRequest.policyPackageSha256 ?? '',
          capabilityManifestSha256: receiptRequest.subject.capabilityManifestSha256 ?? '',
          deviceCertificateSha256: certificate?.certificateSha256 ?? '',
          authorizationContextSha256: authorization.contextHash,
          expiresAt: certificate?.expiresAt ?? ''
        }),
        operation: () => this.#repositoryPolicyScope.runAuthorized(authorization, input.operation)
      });
    }));
  }
}
