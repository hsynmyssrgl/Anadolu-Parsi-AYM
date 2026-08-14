import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EnforcePolicyServiceAvailabilityUseCase,
  EvaluatePolicyServiceAvailabilityUseCase,
  GetPolicyServiceAvailabilityBoundaryUseCase
} from '@ppt/application';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  PolicyServiceAvailabilityPolicy,
  type PlatformPolicyAuthorizationProvider,
  type PolicyServiceAvailabilityObservation,
  type PolicyServiceAvailabilityReason
} from '@ppt/platform-policy';
import {
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy.js';
import { resolveIpcReadSharingPolicy } from '../src/main/ipc-read-sharing.js';

const NOW = '2026-08-12T03:00:00.000Z';
const EXPIRES = '2026-08-12T04:00:00.000Z';
const atOffsetFromNow = (offsetMs: number): string =>
  new Date(Date.parse(NOW) + offsetMs).toISOString();
const kernel = new PlatformPolicyKernel({
  policyVersion: 'PPT-PLATFORM-POLICY-PPK024',
  signingKey: Buffer.alloc(32, 24),
  decisionAuthorityId: 'windows-core-service',
  applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'share', 'record', 'administer']
});

const observation = (
  overrides: Partial<PolicyServiceAvailabilityObservation> = {}
): PolicyServiceAvailabilityObservation => ({
  schemaVersion: 1,
  lifecycle: 'ready',
  writable: true,
  safeMode: false,
  policyPackageVerified: true,
  policyVersion: kernel.policyPackage.payload.policyVersion,
  policyPackageVersion: kernel.policyPackage.payload.packageVersion,
  policyPackageSha256: kernel.policyPackage.payloadSha256,
  expectedPolicyVersion: kernel.policyPackage.payload.policyVersion,
  expectedPolicyPackageVersion: kernel.policyPackage.payload.packageVersion,
  expectedPolicyPackageSha256: kernel.policyPackage.payloadSha256,
  observedAt: NOW,
  checkedAt: NOW,
  ...overrides
});

const enforcement = (observe: PlatformPolicyAuthorizationProvider['observePolicyServiceAvailability']) => {
  let authorizeCalls = 0;
  const provider: PlatformPolicyAuthorizationProvider = {
    decisionAuthority: 'windows-core-service',
    observePolicyServiceAvailability: observe,
    resolvePolicyPackage: () => kernel.policyPackage,
    authorize: ({ request, nonce }) => {
      authorizeCalls += 1;
      return { effectiveRequest: request, authorization: kernel.authorizeWithReceipt(request, NOW, nonce) };
    },
    verify: ({ request, receipt }) => kernel.verifyReceiptForRequest(receipt, request)
  };
  const point = new PlatformPolicyEnforcementPoint({
    provider,
    authorityResolver: {
      resolve: () => ({
        policyVersion: kernel.policyPackage.payload.policyVersion,
        policyPackageVersion: kernel.policyPackage.payload.packageVersion,
        policyPackageSha256: kernel.policyPackage.payloadSha256,
        decisionAuthorityId: 'windows-core-service',
        accountId: 'account-ppk024',
        personId: 'person-ppk024',
        deviceId: 'device-ppk024',
        applicationId: 'windows-desktop',
        applicationVersion: 'v1',
        deviceTrusted: true,
        membershipActive: true,
        roles: ['adult_member'],
        familyIds: ['family-main'],
        online: true,
        expiresAt: EXPIRES
      })
    },
    resourceResolver: {
      resolve: (intent) => ({
        type: intent.resourceType,
        id: intent.resourceId,
        familyId: 'family-main',
        ownerPersonId: 'person-ppk024',
        sensitivity: 'sensitive'
      })
    },
    replayStore: { reserve: () => true },
    receiptSink: { append: () => undefined },
    clock: () => NOW,
    nonceFactory: () => 'ppk024-nonce'
  });
  return { point, authorizeCalls: () => authorizeCalls };
};

const execute = (
  point: PlatformPolicyEnforcementPoint,
  action: 'read' | 'update',
  operation: () => string,
  fenceWritable = action !== 'read'
) => point.execute({
  correlationId: `corr-ppk024-${action}`,
  action,
  capability: action === 'read' ? 'family.read' : 'family.write',
  resourceType: 'desktop_ipc_endpoint',
  resourceId: action === 'read' ? 'dashboard:getOverview' : 'family:updateMember',
  purpose: 'administration'
}, () => ({ writable: fenceWritable, epoch: 24 }), operation);

describe('32-T PPK-024 Policy Service availability integration', () => {
  it('rejects an explicit Core Service provider without a live availability observer', () => {
    expect(() => enforcement(undefined)).toThrowError(/Policy enforcement dependency is unavailable/u);
  });

  it('maps an observation failure to an exact content-free deny view', async () => {
    const view = await new GetPolicyServiceAvailabilityBoundaryUseCase(
      new PolicyServiceAvailabilityPolicy(),
      { observe: () => { throw new Error('connection detail must not escape'); } }
    ).execute();
    expect(view).toMatchObject({
      status: 'policy-service-availability-evaluated',
      enforcement: 'fail-closed',
      mode: 'deny',
      reason: 'SERVICE_UNAVAILABLE',
      sensitiveReadAllowed: false,
      sensitiveMutationAllowed: false,
      sourcePathsExposedToClient: false,
      policyPackageHashesExposedToClient: false,
      latestDatabaseMigration: 77
    });
    expect(JSON.stringify(view)).not.toContain('connection detail');
  });

  it.each([
    ['service unavailable', undefined, 'SERVICE_UNAVAILABLE'],
    ['invalid signature', observation({ policyPackageVerified: false }), 'POLICY_PACKAGE_SIGNATURE_INVALID'],
    ['stale observation', observation({ observedAt: atOffsetFromNow(-30_001) }), 'OBSERVATION_STALE'],
    ['policy mismatch', observation({ policyVersion: 'PPK-023' }), 'POLICY_VERSION_MISMATCH']
  ] as const)('does not call either application callback when %s', async (_name, value, reason) => {
    for (const operation of ['read', 'mutation'] as const) {
      let callbacks = 0;
      const useCase = new EnforcePolicyServiceAvailabilityUseCase(
        new PolicyServiceAvailabilityPolicy(),
        { observe: () => value }
      );
      await expect(useCase.execute({
        operation,
        callback: () => { callbacks += 1; return 'must-not-run'; }
      })).rejects.toMatchObject({
        code: 'POLICY_SERVICE_AVAILABILITY_DENIED',
        reason: reason as PolicyServiceAvailabilityReason,
        mode: 'deny'
      });
      expect(callbacks).toBe(0);
    }
  });

  it('maps an observation-port exception to unavailable without calling the callback', async () => {
    const policy = new PolicyServiceAvailabilityPolicy();
    let callbacks = 0;
    const evaluate = new EvaluatePolicyServiceAvailabilityUseCase(policy, {
      observe: () => { throw new Error('transport unavailable'); }
    });
    await expect(evaluate.execute()).resolves.toMatchObject({ mode: 'deny', reason: 'SERVICE_UNAVAILABLE' });
    const enforce = new EnforcePolicyServiceAvailabilityUseCase(policy, {
      observe: () => { throw new Error('transport unavailable'); }
    });
    await expect(enforce.execute({
      operation: 'read',
      callback: () => { callbacks += 1; }
    })).rejects.toMatchObject({ reason: 'SERVICE_UNAVAILABLE' });
    expect(callbacks).toBe(0);
  });

  it('allows a read-only application read once but blocks its mutation callback', async () => {
    const readOnly = observation({ lifecycle: 'degraded', writable: false, safeMode: true });
    let reads = 0;
    let mutations = 0;
    const useCase = new EnforcePolicyServiceAvailabilityUseCase(
      new PolicyServiceAvailabilityPolicy(),
      { observe: () => readOnly }
    );
    await expect(useCase.execute({
      operation: 'read',
      callback: (decision) => { reads += 1; return decision.mode; }
    })).resolves.toBe('read-only');
    await expect(useCase.execute({
      operation: 'mutation',
      callback: () => { mutations += 1; }
    })).rejects.toMatchObject({
      code: 'POLICY_SERVICE_AVAILABILITY_DENIED',
      reason: 'READ_ONLY_MUTATION_DENIED',
      mode: 'read-only'
    });
    expect({ reads, mutations }).toEqual({ reads: 1, mutations: 0 });
  });

  it('allows a fresh verified application mutation exactly once', async () => {
    let callbacks = 0;
    const useCase = new EnforcePolicyServiceAvailabilityUseCase(
      new PolicyServiceAvailabilityPolicy(),
      { observe: () => observation() }
    );
    await expect(useCase.execute({
      operation: 'mutation',
      callback: (decision) => { callbacks += 1; return decision.reason; }
    })).resolves.toBe('FRESH_VERIFIED_READ_WRITE');
    expect(callbacks).toBe(1);
  });

  it('returns a frozen public boundary without package hashes, paths or runtime authority', async () => {
    const view = await new GetPolicyServiceAvailabilityBoundaryUseCase(
      new PolicyServiceAvailabilityPolicy(),
      { observe: () => observation({ lifecycle: 'degraded', writable: false, safeMode: true }) }
    ).execute();
    expect(Object.isFrozen(view)).toBe(true);
    expect(view).toMatchObject({
      mode: 'read-only',
      sensitiveReadAllowed: true,
      sensitiveMutationAllowed: false,
      mappingGrantsRuntimeAuthority: false,
      historicalReceiptGrantsCurrentAuthority: false,
      sourcePathsExposedToClient: false,
      policyPackageHashesExposedToClient: false,
      schemaMigrationRequired: false,
      latestDatabaseMigration: 77
    });
    expect(view).not.toHaveProperty('policyPackageSha256');
    expect(view).not.toHaveProperty('observationAgeMs');
  });

  it('keeps the content-free availability channel zero-argument and no-cache', () => {
    const channel = 'system:getPolicyServiceAvailabilityBoundary';
    expect(evaluateIpcIntegrationPolicy(channel, [])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy(channel, [{}])).toMatchObject({ accepted: false });
    expect(resolveIpcReadSharingPolicy(channel)).toEqual({
      enabled: false, priority: 'standard', ttlMs: 0, maxEntries: 0, maxResultBytes: 0
    });
  });

  it('accepts only the exact content-free availability result contract', async () => {
    const channel = 'system:getPolicyServiceAvailabilityBoundary';
    const view = await new GetPolicyServiceAvailabilityBoundaryUseCase(
      new PolicyServiceAvailabilityPolicy(),
      { observe: () => observation() }
    ).execute();
    expect(evaluateIpcIntegrationResultPolicy(channel, view)).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationResultPolicy(channel, { ...view, policyPackageSha256: 'a'.repeat(64) }))
      .toEqual({ accepted: false, reason: 'POLICY_SERVICE_AVAILABILITY_RESULT_INVALID', path: '$result' });
    const accessor = { ...view } as Record<string, unknown>;
    Object.defineProperty(accessor, 'reason', { enumerable: true, get: () => 'FRESH_VERIFIED_READ_WRITE' });
    expect(evaluateIpcIntegrationResultPolicy(channel, accessor)).toMatchObject({ accepted: false });
  });

  it.each([
    ['service unavailable', undefined, 'SERVICE_UNAVAILABLE'],
    ['invalid signature', observation({ policyPackageVerified: false }), 'POLICY_PACKAGE_SIGNATURE_INVALID'],
    ['stale policy observation', observation({ observedAt: '2026-08-12T02:59:29.999Z' }), 'OBSERVATION_STALE']
  ] as const)('fails closed before authority resolution for %s', async (_label, value, reason) => {
    const harness = enforcement(() => value);
    let executed = false;
    await expect(execute(harness.point, 'read', () => { executed = true; return 'must-not-run'; }))
      .rejects.toMatchObject({
        code: 'POLICY_SERVICE_AVAILABILITY_DENIED',
        availabilityStage: 'POLICY_SERVICE_AVAILABILITY',
        policyServiceAvailabilityReason: reason,
        policyServiceAvailabilityMode: 'deny'
      });
    expect(executed).toBe(false);
    expect(harness.authorizeCalls()).toBe(0);
  });

  it('allows reads but denies mutations in fresh verified read-only mode', async () => {
    const harness = enforcement(() => observation({ lifecycle: 'degraded', writable: false, safeMode: true }));
    await expect(execute(harness.point, 'read', () => 'read-ok')).resolves.toBe('read-ok');
    let mutationExecuted = false;
    await expect(execute(
      harness.point,
      'update',
      () => { mutationExecuted = true; return 'must-not-run'; },
      false
    )).rejects.toMatchObject({ code: 'POLICY_DENIED' });
    expect(mutationExecuted).toBe(false);
    expect(harness.authorizeCalls()).toBe(2);
  });

  it('wires authenticated health, PEP, use case, typed IPC and renderer posture without policy hashes', () => {
    const core = readFileSync('apps/core-service/src/core-service-runtime.ts', 'utf8');
    const adapter = readFileSync('apps/desktop/src/main/policy-service-availability-application-adapter.ts', 'utf8');
    const main = readFileSync('apps/desktop/src/main/main.ts', 'utf8');
    const preload = readFileSync('apps/desktop/src/main/preload.ts', 'utf8');
    const global = readFileSync('apps/desktop/src/renderer/global.d.ts', 'utf8');
    const renderer = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
    expect(core).toContain('policyPackageVerified: this.#policyPackageVerified()');
    expect(adapter).toContain('expectedPolicyPackageSha256');
    expect(main).toContain('new EvaluatePolicyServiceAvailabilityUseCase');
    expect(main).toContain("registerIpcHandler('system:getPolicyServiceAvailabilityBoundary'");
    expect(preload).toContain("invoke('system:getPolicyServiceAvailabilityBoundary')");
    expect(global).toContain('getPolicyServiceAvailabilityBoundary():Promise<PolicyServiceAvailabilityBoundaryView>');
    expect(renderer).toContain('PPK-024');
    expect(renderer).not.toContain('policyPackageSha256');
  });
});
