import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it } from 'vitest';
import {
  StoredCorrelationContextProvider,
  asCorrelationId,
  type CorrelationContext
} from '@ppt/core';
import { SqliteRepository } from '@ppt/repositories';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';
import {
  PlatformPolicyKernel,
  PolicyServiceAvailabilityPolicy,
  type PolicyServiceAvailabilityDecision,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import {
  DesktopUniversalApiPolicyEnforcement,
  VAULT_SESSION_CHECKPOINT_CHANNEL,
  isDesktopPolicyBootstrapChannel,
  resolveDesktopUniversalApiIntent
} from '../src/main/desktop-universal-api-policy-enforcement.js';
import { DesktopRepositoryPolicyScope } from '../src/main/desktop-repository-policy-scope.js';

const NOW = '2026-08-11T09:00:00.000Z';
const EXPIRES = '2026-08-11T10:00:00.000Z';
const correlationId = asCorrelationId('corr-31-u-universal-api');

class GuardedProbeRepository extends SqliteRepository {
  public probe(context: RepositoryExecutionContext) {
    return this.execute(context, () => 'repository-ok');
  }
}

const repositoryContext = (value = correlationId): RepositoryExecutionContext => ({
  transaction: {} as RepositoryExecutionContext['transaction'],
  actor: { userId: 'account-31-u' as RepositoryExecutionContext['actor']['userId'], roles: ['adult_member'] },
  correlationId: value,
  occurredAt: NOW as RepositoryExecutionContext['occurredAt']
});

const createHarness = (
  writable = true,
  trusted = true,
  availabilityEvaluator?: () => Promise<PolicyServiceAvailabilityDecision>
) => {
  const records: PlatformPolicyReceiptRecord[] = [];
  const repositoryPolicyScope = new DesktopRepositoryPolicyScope();
  const kernel = new PlatformPolicyKernel({
    policyVersion: 'PPK-31-U',
    signingKey: Buffer.alloc(32, 31),
    decisionAuthorityId: 'windows-core-service',
    deviceCertificateRequiredApplications: ['windows-desktop'],
    applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write'] },
    consentRequiredCapabilities: [],
    onlineOnlyCapabilities: [],
    writeActions: ['create', 'update', 'delete']
  });
  const enforcement = new DesktopUniversalApiPolicyEnforcement({
    authorizationProvider: {
      decisionAuthority: 'windows-core-service',
      observePolicyServiceAvailability: () => ({
        schemaVersion: 1,
        lifecycle: writable ? 'ready' : 'degraded', writable, safeMode: !writable,
        policyPackageVerified: true, policyVersion: 'PPK-31-U',
        policyPackageVersion: kernel.policyPackage.payload.packageVersion,
        policyPackageSha256: kernel.policyPackage.payloadSha256,
        expectedPolicyVersion: 'PPK-31-U',
        expectedPolicyPackageVersion: kernel.policyPackage.payload.packageVersion,
        expectedPolicyPackageSha256: kernel.policyPackage.payloadSha256,
        observedAt: NOW, checkedAt: NOW
      }),
      resolvePolicyPackage: () => kernel.policyPackage,
      authorize: ({ request, nonce }) => ({ effectiveRequest: request, authorization: kernel.authorizeWithReceipt(request, NOW, nonce) }),
      verify: ({ request, receipt }) => kernel.verifyReceiptForRequest(receipt, request)
    },
    receiptSink: { append: (record) => { records.push(record); } },
    clusterFence: () => ({ writable, epoch: 31 }),
    resolveAuthority: () => ({
      policyVersion: 'PPK-31-U',
      accountId: 'account-31-u',
      personId: 'person-31-u',
      deviceId: 'device-31-u',
      applicationId: 'windows-desktop',
      applicationVersion: 'v1',
      devicePublicKeyFingerprintSha256: '1'.repeat(64),
      deviceCertificateIssuedAt: NOW,
      deviceTrusted: trusted,
      membershipActive: true,
      roles: ['adult_member'],
      familyIds: ['family-main'],
      online: true,
      expiresAt: EXPIRES
    }),
    repositoryPolicyScope,
    evaluatePolicyServiceAvailability: availabilityEvaluator ?? (async () => new PolicyServiceAvailabilityPolicy().evaluate({
      schemaVersion: 1,
      lifecycle: writable ? 'ready' : 'degraded',
      writable,
      safeMode: !writable,
      policyPackageVerified: true,
      policyVersion: 'PPK-31-U',
      policyPackageVersion: kernel.policyPackage.payload.packageVersion,
      policyPackageSha256: kernel.policyPackage.payloadSha256,
      expectedPolicyVersion: 'PPK-31-U',
      expectedPolicyPackageVersion: kernel.policyPackage.payload.packageVersion,
      expectedPolicyPackageSha256: kernel.policyPackage.payloadSha256,
      observedAt: NOW,
      checkedAt: NOW
    })),
    resolveBootstrapClientContext: () => ({
      applicationId: 'windows-desktop',
      deviceId: 'device-31-u',
      policyVersion: 'PPK-31-U',
      policyPackageSha256: kernel.policyPackage.payloadSha256,
      capabilityManifestSha256: kernel.policyPackage.payload.applicationManifests['windows-desktop']!.capabilityManifestSha256,
      occurredAt: NOW
    }),
    clock: () => NOW
  });
  for (const channel of [
    'dashboard:getOverview',
    'formDraft:getWorkspace',
    'family:createMember',
    'auth:login',
    'auth:getState',
    'auth:beginTwoFactorSetup',
    'auth:enableTwoFactor',
    'auth:trustCurrentDevice',
    'app:getInfo',
    'app:getLocalizationBootstrap',
    'app:setLanguagePreference',
    VAULT_SESSION_CHECKPOINT_CHANNEL
  ]) {
    enforcement.registerClientApplicationServiceChannel(channel);
  }
  return { enforcement, records, repositoryPolicyScope };
};

describe('31-U universal Desktop API policy enforcement', () => {
  it('classifies read and mutation channels deterministically', () => {
    expect(resolveDesktopUniversalApiIntent('dashboard:getOverview', correlationId)).toMatchObject({ action: 'read', capability: 'family.read' });
    expect(resolveDesktopUniversalApiIntent('family:createMember', correlationId)).toMatchObject({ action: 'update', capability: 'family.write' });
    expect(isDesktopPolicyBootstrapChannel('auth:login')).toBe(true);
    expect(isDesktopPolicyBootstrapChannel('auth:beginTwoFactorSetup')).toBe(true);
    expect(isDesktopPolicyBootstrapChannel('auth:enableTwoFactor')).toBe(true);
    expect(isDesktopPolicyBootstrapChannel('auth:trustCurrentDevice')).toBe(true);
    expect(isDesktopPolicyBootstrapChannel('app:getLocalizationBootstrap')).toBe(true);
    expect(isDesktopPolicyBootstrapChannel('app:setLanguagePreference')).toBe(true);
    expect(isDesktopPolicyBootstrapChannel('auth:reauthorizeCurrentDeviceAfterRecovery')).toBe(false);
    expect(isDesktopPolicyBootstrapChannel('family:createMember')).toBe(false);
  });

  it('persists an allow receipt before executing a protected API operation', async () => {
    const { enforcement, records } = createHarness();
    const order: string[] = [];
    const result = await enforcement.execute({
      channel: 'dashboard:getOverview',
      correlationId,
      operation: () => { order.push(`operation-after-${records.length}-receipt`); return 'ok'; }
    });
    expect(result).toBe('ok');
    expect(order).toEqual(['operation-after-1-receipt']);
    expect(records[0]).toMatchObject({ resourceType: 'desktop_ipc_endpoint', resourceId: 'dashboard:getOverview', action: 'read', capability: 'family.read' });
  });

  it('authorizes the registered internal vault checkpoint before running it', async () => {
    const { enforcement, records } = createHarness();
    await expect(enforcement.execute({
      channel: VAULT_SESSION_CHECKPOINT_CHANNEL,
      correlationId,
      operation: () => 'checkpoint-ok'
    })).resolves.toBe('checkpoint-ok');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      resourceId: VAULT_SESSION_CHECKPOINT_CHANNEL,
      action: 'update',
      capability: 'family.write'
    });
  });

  it('fails closed before a mutation when the cluster fence is not writable', async () => {
    const { enforcement, records } = createHarness(false);
    let executed = false;
    await expect(enforcement.execute({
      channel: 'family:createMember',
      correlationId,
      operation: () => { executed = true; }
    })).rejects.toMatchObject({ code: 'POLICY_DENIED' });
    expect(executed).toBe(false);
    expect(records).toHaveLength(1);
    expect(records[0]?.decision.reason).toBe('CLUSTER_NOT_WRITABLE');
  });

  it('fails closed for an untrusted authenticated device', async () => {
    const { enforcement } = createHarness(true, false);
    await expect(enforcement.execute({ channel: 'dashboard:getOverview', correlationId, operation: () => 'must-not-run' }))
      .rejects.toMatchObject({ code: 'POLICY_DENIED' });
  });

  it('limits the receiptless path to the explicit bootstrap registry', async () => {
    const { enforcement, records } = createHarness();
    await expect(enforcement.execute({ channel: 'auth:login', correlationId, operation: () => 'bootstrap' })).resolves.toBe('bootstrap');
    await expect(enforcement.execute({ channel: 'auth:beginTwoFactorSetup', correlationId, operation: () => '2fa-begin' })).resolves.toBe('2fa-begin');
    await expect(enforcement.execute({ channel: 'auth:enableTwoFactor', correlationId, operation: () => '2fa-enable' })).resolves.toBe('2fa-enable');
    await expect(enforcement.execute({ channel: 'auth:trustCurrentDevice', correlationId, operation: () => 'device-trust' })).resolves.toBe('device-trust');
    await expect(enforcement.execute({ channel: 'app:getInfo', correlationId, operation: () => 'info' })).resolves.toBe('info');
    await expect(enforcement.execute({ channel: 'app:getLocalizationBootstrap', correlationId, operation: () => 'tr' })).resolves.toBe('tr');
    await expect(enforcement.execute({ channel: 'app:setLanguagePreference', correlationId, operation: () => 'tr' })).resolves.toBe('tr');
    expect(records).toHaveLength(0);
  });

  it('fails closed when a guarded repository is called outside every policy scope', () => {
    const { repositoryPolicyScope } = createHarness();
    const repository = new GuardedProbeRepository({ executionPolicyGuard: repositoryPolicyScope.guard });
    expect(() => repository.probe(repositoryContext())).toThrowError(
      expect.objectContaining({ code: 'TRANSACTION_CONTEXT_INVALID' })
    );
  });

  it('keeps guarded repository execution inside the signed API callback', async () => {
    const { enforcement, repositoryPolicyScope } = createHarness();
    const repository = new GuardedProbeRepository({ executionPolicyGuard: repositoryPolicyScope.guard });
    await expect(enforcement.execute({
      channel: 'dashboard:getOverview',
      correlationId,
      operation: () => repository.probe(repositoryContext())
    })).resolves.toMatchObject({ ok: true, value: 'repository-ok' });
  });

  it('serializes protected application-service operations on the single SQLite authority boundary', async () => {
    const { enforcement } = createHarness();
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let firstEntered = false;
    let secondEntered = false;
    let active = 0;
    let maximumActive = 0;
    const first = enforcement.execute({
      channel: 'dashboard:getOverview',
      correlationId,
      operation: async () => {
        firstEntered = true;
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await firstGate;
        active -= 1;
        return 'first';
      }
    });
    while (!firstEntered) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const second = enforcement.execute({
      channel: 'family:createMember',
      correlationId,
      operation: () => {
        secondEntered = true;
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        active -= 1;
        return 'second';
      }
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(secondEntered).toBe(false);
    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toEqual(['first', 'second']);
    expect(maximumActive).toBe(1);
  });

  it('lets queued interactive work overtake standard work without concurrent SQLite access', async () => {
    const { enforcement } = createHarness();
    let releaseActive!: () => void;
    const activeGate = new Promise<void>((resolve) => { releaseActive = resolve; });
    const order: string[] = [];
    let activeEntered = false;
    let active = 0;
    let maximumActive = 0;
    const enter = (name: string): void => {
      order.push(name);
      active += 1;
      maximumActive = Math.max(maximumActive, active);
    };
    const leave = (): void => { active -= 1; };
    const first = enforcement.execute({
      channel: 'dashboard:getOverview',
      correlationId,
      operation: async () => {
        enter('active');
        activeEntered = true;
        await activeGate;
        leave();
        return 'active';
      }
    });
    while (!activeEntered) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const standard = enforcement.execute({
      channel: 'family:createMember',
      correlationId,
      operation: () => { enter('standard'); leave(); return 'standard'; }
    });
    const interactive = enforcement.execute({
      channel: 'formDraft:getWorkspace',
      correlationId,
      operation: () => { enter('interactive'); leave(); return 'interactive'; }
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(order).toEqual(['active']);
    releaseActive();
    await expect(Promise.all([first, standard, interactive])).resolves.toEqual(['active', 'standard', 'interactive']);
    expect(order).toEqual(['active', 'interactive', 'standard']);
    expect(maximumActive).toBe(1);
  });

  it('serializes policy availability observations with protected operations', async () => {
    const availability = new PolicyServiceAvailabilityPolicy().evaluate({
      schemaVersion: 1,
      lifecycle: 'ready', writable: true, safeMode: false,
      policyPackageVerified: true, policyVersion: 'PPK-31-U',
      policyPackageVersion: 1,
      policyPackageSha256: 'a'.repeat(64),
      expectedPolicyVersion: 'PPK-31-U',
      expectedPolicyPackageVersion: 1,
      expectedPolicyPackageSha256: 'a'.repeat(64),
      observedAt: NOW, checkedAt: NOW
    });
    let observationCount = 0;
    const { enforcement } = createHarness(true, true, async () => {
      observationCount += 1;
      return availability;
    });
    let firstEntered = false;
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const first = enforcement.execute({
      channel: 'dashboard:getOverview',
      correlationId,
      operation: async () => {
        firstEntered = true;
        await firstGate;
        return 'first';
      }
    });
    while (!firstEntered) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const second = enforcement.execute({
      channel: 'formDraft:getWorkspace',
      correlationId,
      operation: () => 'second'
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(observationCount).toBe(1);
    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toEqual(['first', 'second']);
    expect(observationCount).toBe(2);
  });

  it('keeps queued interactive session bootstrap work ahead of later bootstrap polling', async () => {
    const { enforcement } = createHarness();
    let releaseActive!: () => void;
    const activeGate = new Promise<void>((resolve) => { releaseActive = resolve; });
    const order: string[] = [];
    let activeEntered = false;
    const active = enforcement.execute({
      channel: 'dashboard:getOverview',
      correlationId,
      operation: async () => {
        order.push('active');
        activeEntered = true;
        await activeGate;
        return 'active';
      }
    });
    while (!activeEntered) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const sessionBootstrap = enforcement.execute({
      channel: 'formDraft:getWorkspace',
      correlationId,
      operation: () => { order.push('session-bootstrap'); return 'session-bootstrap'; }
    });
    const laterBootstrapPoll = enforcement.execute({
      channel: 'auth:getState',
      correlationId,
      operation: () => { order.push('later-bootstrap-poll'); return 'later-bootstrap-poll'; }
    });
    releaseActive();
    await expect(Promise.all([active, sessionBootstrap, laterBootstrapPoll])).resolves.toEqual([
      'active',
      'session-bootstrap',
      'later-bootstrap-poll'
    ]);
    expect(order).toEqual(['active', 'session-bootstrap', 'later-bootstrap-poll']);
  });

  it('preserves each queued caller runtime correlation context', async () => {
    const repositoryPolicyScope = new DesktopRepositoryPolicyScope();
    const runtimeCorrelation = new StoredCorrelationContextProvider(
      new AsyncLocalStorage<CorrelationContext>()
    );
    const firstCorrelationId = asCorrelationId('corr-exclusive-first');
    const secondCorrelationId = asCorrelationId('corr-exclusive-second');
    let firstEntered = false;
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });

    const first = runtimeCorrelation.run({ correlationId: firstCorrelationId }, () =>
      repositoryPolicyScope.runPolicyResolutionExclusive({
        correlationId: firstCorrelationId,
        boundary: 'dashboard:getOverview'
      }, async () => {
        firstEntered = true;
        expect(runtimeCorrelation.current()?.correlationId).toBe(firstCorrelationId);
        await firstGate;
        return runtimeCorrelation.current()?.correlationId;
      })
    );
    while (!firstEntered) await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const second = runtimeCorrelation.run({ correlationId: secondCorrelationId }, () =>
      repositoryPolicyScope.runPolicyResolutionExclusive({
        correlationId: secondCorrelationId,
        boundary: 'dashboard:getOverview'
      }, () => runtimeCorrelation.current()?.correlationId)
    );
    releaseFirst();

    await expect(Promise.all([first, second])).resolves.toEqual([
      firstCorrelationId,
      secondCorrelationId
    ]);
  });

  it('rejects an unregistered direct repository bootstrap scope', () => {
    const { repositoryPolicyScope } = createHarness();
    const repository = new GuardedProbeRepository({ executionPolicyGuard: repositoryPolicyScope.guard });
    expect(() => repositoryPolicyScope.runBootstrap({
      correlationId,
      boundary: 'auth:logout'
    }, () => repository.probe(repositoryContext()))).toThrowError(
      expect.objectContaining({ code: 'INTENT_INVALID' })
    );
  });

  it('rejects a repository context that changes correlation inside an authorized callback', async () => {
    const { enforcement, repositoryPolicyScope } = createHarness();
    const repository = new GuardedProbeRepository({ executionPolicyGuard: repositoryPolicyScope.guard });
    await expect(enforcement.execute({
      channel: 'dashboard:getOverview',
      correlationId,
      operation: () => repository.probe(repositoryContext(asCorrelationId('corr-mismatch')))
    })).rejects.toMatchObject({ code: 'TRANSACTION_CONTEXT_MISMATCH' });
  });

  it('allows only registered internal child correlations inside the signed callback', async () => {
    const { enforcement, repositoryPolicyScope } = createHarness();
    const repository = new GuardedProbeRepository({ executionPolicyGuard: repositoryPolicyScope.guard });
    const allowedSuffixes = [
      'timeline-location-proof',
      'timeline-location-collection',
      'timeline-location-exact',
      'life-report'
    ];

    await expect(enforcement.execute({
      channel: 'dashboard:getOverview',
      correlationId,
      operation: () => allowedSuffixes.map((suffix) => repository.probe(
        repositoryContext(asCorrelationId(`${correlationId}:${suffix}`))
      ))
    })).resolves.toHaveLength(allowedSuffixes.length);

    await expect(enforcement.execute({
      channel: 'dashboard:getOverview',
      correlationId,
      operation: () => repository.probe(
        repositoryContext(asCorrelationId(`${correlationId}:unregistered-child`))
      )
    })).rejects.toMatchObject({ code: 'TRANSACTION_CONTEXT_MISMATCH' });

    await expect(enforcement.execute({
      channel: 'dashboard:getOverview',
      correlationId,
      operation: () => repository.probe(
        repositoryContext(asCorrelationId(`${correlationId}:timeline-location-collection:nested`))
      )
    })).rejects.toMatchObject({ code: 'TRANSACTION_CONTEXT_MISMATCH' });
  });
});
