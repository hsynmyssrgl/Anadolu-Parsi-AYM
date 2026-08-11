import {
  PlatformPolicyEnforcementPoint,
  assertActivePlatformPolicyTransactionContext,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyClusterFence,
  type PlatformPolicyConnectionAuthority,
  type PlatformPolicyIntent,
  type PlatformPolicyReceiptSink
} from '@ppt/platform-policy';
import type { CorrelationId } from '@ppt/core';

export interface DesktopUniversalApiPolicyEnforcementDependencies {
  readonly authorizationProvider: PlatformPolicyAuthorizationProvider;
  readonly receiptSink: PlatformPolicyReceiptSink;
  readonly clusterFence: PlatformPolicyClusterFence;
  readonly resolveAuthority: () => PlatformPolicyConnectionAuthority | Promise<PlatformPolicyConnectionAuthority>;
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
  'auth:getWindowsHelloState',
  'auth:login',
  'auth:loginWithWindowsHello',
  'auth:setup',
  'invitations:accept',
  'invitations:inspect'
]);

const nonEmpty = (value: unknown, max = 512): value is string =>
  typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max;

export const isDesktopPolicyBootstrapChannel = (channel: string): boolean =>
  channel.startsWith('auth:') || BOOTSTRAP_CHANNELS.has(channel);

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
  readonly #enforcementPoint: PlatformPolicyEnforcementPoint;
  readonly #clusterFence: PlatformPolicyClusterFence;

  public constructor(dependencies: DesktopUniversalApiPolicyEnforcementDependencies) {
    if (!dependencies || typeof dependencies.resolveAuthority !== 'function') {
      throw new Error('DESKTOP_API_POLICY_AUTHORITY_UNAVAILABLE');
    }
    this.#clusterFence = dependencies.clusterFence;
    this.#enforcementPoint = new PlatformPolicyEnforcementPoint({
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

  public async execute<T>(input: DesktopUniversalApiExecutionInput<T>): Promise<T> {
    if (isDesktopPolicyBootstrapChannel(input.channel)) return input.operation();
    const intent = resolveDesktopUniversalApiIntent(input.channel, input.correlationId);
    return this.#enforcementPoint.execute(intent, this.#clusterFence, async (authorization) => {
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
      return input.operation();
    });
  }
}
