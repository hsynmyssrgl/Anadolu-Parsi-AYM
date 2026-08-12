import { describe, expect, it } from 'vitest';
import { asCorrelationId } from '@ppt/core';
import {
  PlatformPolicyKernel,
  PolicyServiceAvailabilityPolicy,
  type PlatformPolicyReceiptRecord,
  type PolicyServiceAvailabilityObservation,
  type PolicyServiceAvailabilityReason
} from '@ppt/platform-policy';
import {
  DesktopUniversalApiPolicyEnforcement,
  POLICY_SERVICE_AVAILABILITY_STATUS_CHANNEL,
  isDesktopPolicyServiceAvailabilityStatusChannel
} from '../src/main/desktop-universal-api-policy-enforcement.js';
import { DesktopRepositoryPolicyScope } from '../src/main/desktop-repository-policy-scope.js';

const NOW = '2026-08-12T00:00:30.000Z';
const EXPIRES = '2026-08-12T01:00:30.000Z';
const correlationId = asCorrelationId('corr-32-t-ppk-024');

type AvailabilityScenario =
  | 'read-write'
  | 'read-only'
  | 'unavailable'
  | 'invalid-signature'
  | 'stale'
  | 'policy-version-mismatch'
  | 'package-version-mismatch'
  | 'package-hash-mismatch';

const createObservation = (
  kernel: PlatformPolicyKernel,
  scenario: AvailabilityScenario
): PolicyServiceAvailabilityObservation | undefined => {
  if (scenario === 'unavailable') return undefined;
  const readOnly = scenario === 'read-only';
  const base: PolicyServiceAvailabilityObservation = {
    schemaVersion: 1,
    lifecycle: readOnly ? 'degraded' : 'ready',
    writable: !readOnly,
    safeMode: readOnly,
    policyPackageVerified: true,
    policyVersion: 'PPK-024',
    policyPackageVersion: kernel.policyPackage.payload.packageVersion,
    policyPackageSha256: kernel.policyPackage.payloadSha256,
    expectedPolicyVersion: 'PPK-024',
    expectedPolicyPackageVersion: kernel.policyPackage.payload.packageVersion,
    expectedPolicyPackageSha256: kernel.policyPackage.payloadSha256,
    observedAt: NOW,
    checkedAt: NOW
  };
  if (scenario === 'invalid-signature') return Object.freeze({ ...base, policyPackageVerified: false });
  if (scenario === 'stale') {
    return Object.freeze({ ...base, observedAt: new Date(Date.parse(NOW) - 30_001).toISOString() });
  }
  if (scenario === 'policy-version-mismatch') {
    return Object.freeze({ ...base, policyVersion: 'PPK-023' });
  }
  if (scenario === 'package-version-mismatch') {
    return Object.freeze({ ...base, policyPackageVersion: kernel.policyPackage.payload.packageVersion + 1 });
  }
  if (scenario === 'package-hash-mismatch') {
    return Object.freeze({ ...base, policyPackageSha256: 'f'.repeat(64) });
  }
  return Object.freeze(base);
};

const createHarness = (scenario: AvailabilityScenario) => {
  const records: PlatformPolicyReceiptRecord[] = [];
  const repositoryPolicyScope = new DesktopRepositoryPolicyScope();
  const kernel = new PlatformPolicyKernel({
    policyVersion: 'PPK-024',
    policyPackageVersion: 24,
    signingKey: Buffer.alloc(32, 24),
    decisionAuthorityId: 'windows-core-service',
    deviceCertificateRequiredApplications: ['windows-desktop'],
    applicationVersions: { 'windows-desktop': 'v1' },
    applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write'] },
    consentRequiredCapabilities: [],
    onlineOnlyCapabilities: [],
    writeActions: ['create', 'update', 'delete']
  });
  const policy = new PolicyServiceAvailabilityPolicy();
  const currentObservation = createObservation(kernel, scenario);
  const currentDecision = policy.evaluate(currentObservation);
  const markers = {
    availabilityEvaluations: 0,
    ipcCacheClears: 0,
    offlineCacheLocks: 0,
    restrictedReasons: [] as PolicyServiceAvailabilityReason[]
  };
  const enforcement = new DesktopUniversalApiPolicyEnforcement({
    authorizationProvider: {
      decisionAuthority: 'windows-core-service',
      observePolicyServiceAvailability: () => currentObservation,
      resolvePolicyPackage: () => kernel.policyPackage,
      authorize: ({ request, nonce }) => ({
        effectiveRequest: request,
        authorization: kernel.authorizeWithReceipt(request, NOW, nonce)
      }),
      verify: ({ request, receipt }) => kernel.verifyReceiptForRequest(receipt, request)
    },
    receiptSink: { append: (record) => { records.push(record); } },
    clusterFence: () => Object.freeze({ writable: currentDecision.mode === 'read-write', epoch: 24 }),
    resolveAuthority: () => ({
      policyVersion: 'PPK-024',
      accountId: 'account-32-t',
      personId: 'person-32-t',
      deviceId: 'device-32-t',
      applicationId: 'windows-desktop',
      applicationVersion: 'v1',
      devicePublicKeyFingerprintSha256: '1'.repeat(64),
      deviceCertificateIssuedAt: NOW,
      deviceTrusted: true,
      membershipActive: true,
      roles: ['adult_member'],
      familyIds: ['family-32-t'],
      online: true,
      expiresAt: EXPIRES
    }),
    repositoryPolicyScope,
    evaluatePolicyServiceAvailability: () => {
      markers.availabilityEvaluations += 1;
      return Promise.resolve(currentDecision);
    },
    onAvailabilityRestricted: (decision) => {
      markers.ipcCacheClears += 1;
      markers.offlineCacheLocks += 1;
      markers.restrictedReasons.push(decision.reason);
    },
    resolveBootstrapClientContext: () => ({
      applicationId: 'windows-desktop',
      deviceId: 'device-32-t',
      policyVersion: 'PPK-024',
      policyPackageSha256: kernel.policyPackage.payloadSha256,
      capabilityManifestSha256: kernel.policyPackage.payload.applicationManifests['windows-desktop']!.capabilityManifestSha256,
      occurredAt: NOW
    }),
    clock: () => NOW
  });
  for (const channel of [
    'dashboard:getOverview',
    'family:createMember',
    'auth:getState',
    'auth:login',
    POLICY_SERVICE_AVAILABILITY_STATUS_CHANNEL
  ]) enforcement.registerClientApplicationServiceChannel(channel);
  return { enforcement, kernel, markers, records };
};

describe('32-T PPK-024 Desktop policy service availability integration', () => {
  it('allows fresh verified read-write normal and bootstrap reads and mutations', async () => {
    const { enforcement, markers, records } = createHarness('read-write');
    const executed: string[] = [];
    for (const channel of ['dashboard:getOverview', 'family:createMember', 'auth:getState', 'auth:login']) {
      await expect(enforcement.execute({
        channel,
        correlationId,
        operation: () => { executed.push(channel); return channel; }
      })).resolves.toBe(channel);
    }
    expect(executed).toEqual(['dashboard:getOverview', 'family:createMember', 'auth:getState', 'auth:login']);
    expect(records.map((record) => [record.resourceId, record.decision.allowed])).toEqual([
      ['dashboard:getOverview', true],
      ['family:createMember', true]
    ]);
    expect(markers).toMatchObject({
      availabilityEvaluations: 4,
      ipcCacheClears: 0,
      offlineCacheLocks: 0,
      restrictedReasons: []
    });
  });

  it.each([
    ['unavailable', 'SERVICE_UNAVAILABLE'],
    ['invalid-signature', 'POLICY_PACKAGE_SIGNATURE_INVALID'],
    ['stale', 'OBSERVATION_STALE'],
    ['policy-version-mismatch', 'POLICY_VERSION_MISMATCH'],
    ['package-version-mismatch', 'POLICY_PACKAGE_VERSION_MISMATCH'],
    ['package-hash-mismatch', 'POLICY_PACKAGE_HASH_MISMATCH']
  ] as const)('denies %s before every normal and bootstrap read/write callback', async (scenario, reason) => {
    for (const channel of ['dashboard:getOverview', 'family:createMember', 'auth:getState', 'auth:login']) {
      const { enforcement, markers, records } = createHarness(scenario);
      let callbacks = 0;
      await expect(enforcement.execute({
        channel,
        correlationId,
        operation: () => { callbacks += 1; return 'must-not-run'; }
      })).rejects.toMatchObject({
        code: 'POLICY_SERVICE_AVAILABILITY_DENIED',
        reason,
        mode: 'deny'
      });
      expect(callbacks).toBe(0);
      expect(records).toHaveLength(0);
      expect(markers).toMatchObject({
        availabilityEvaluations: 1,
        ipcCacheClears: 1,
        offlineCacheLocks: 1,
        restrictedReasons: [reason]
      });
    }
  });

  it('allows a fresh verified read-only normal read with one signed allow receipt', async () => {
    const { enforcement, kernel, markers, records } = createHarness('read-only');
    let callbacks = 0;
    await expect(enforcement.execute({
      channel: 'dashboard:getOverview',
      correlationId,
      operation: () => { callbacks += 1; return 'read-only-result'; }
    })).resolves.toBe('read-only-result');
    expect(callbacks).toBe(1);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      action: 'read',
      capability: 'family.read',
      decision: { allowed: true, reason: 'ALLOW_POLICY' }
    });
    expect(records[0]?.receipt.signature).toMatch(/^[0-9a-f]{64}$/u);
    expect(kernel.verifyReceiptForRequest(records[0]!.receipt, records[0]!.request)).toBe(true);
    expect(markers).toMatchObject({
      availabilityEvaluations: 1,
      ipcCacheClears: 1,
      offlineCacheLocks: 1,
      restrictedReasons: ['FRESH_VERIFIED_READ_ONLY']
    });
  });

  it('persists a signed CLUSTER_NOT_WRITABLE denial for a read-only normal mutation', async () => {
    const { enforcement, kernel, markers, records } = createHarness('read-only');
    let callbacks = 0;
    await expect(enforcement.execute({
      channel: 'family:createMember',
      correlationId,
      operation: () => { callbacks += 1; return 'must-not-run'; }
    })).rejects.toMatchObject({ code: 'POLICY_DENIED' });
    expect(callbacks).toBe(0);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      action: 'update',
      capability: 'family.write',
      decision: { allowed: false, reason: 'CLUSTER_NOT_WRITABLE' }
    });
    expect(records[0]?.receipt.signature).toMatch(/^[0-9a-f]{64}$/u);
    expect(kernel.verifyReceiptForRequest(records[0]!.receipt, records[0]!.request)).toBe(true);
    expect(markers).toMatchObject({
      availabilityEvaluations: 1,
      ipcCacheClears: 1,
      offlineCacheLocks: 1,
      restrictedReasons: ['FRESH_VERIFIED_READ_ONLY']
    });
  });

  it('blocks a read-only bootstrap mutation before the callback and without a receipt', async () => {
    const { enforcement, markers, records } = createHarness('read-only');
    let callbacks = 0;
    await expect(enforcement.execute({
      channel: 'auth:login',
      correlationId,
      operation: () => { callbacks += 1; return 'must-not-run'; }
    })).rejects.toMatchObject({
      code: 'POLICY_SERVICE_AVAILABILITY_DENIED',
      reason: 'READ_ONLY_MUTATION_DENIED',
      mode: 'read-only'
    });
    expect(callbacks).toBe(0);
    expect(records).toHaveLength(0);
    expect(markers).toMatchObject({
      availabilityEvaluations: 1,
      ipcCacheClears: 1,
      offlineCacheLocks: 1,
      restrictedReasons: ['FRESH_VERIFIED_READ_ONLY']
    });
  });

  it('bypasses availability only for the exact content-free status channel', async () => {
    const { enforcement, markers, records } = createHarness('unavailable');
    let callbacks = 0;
    expect(isDesktopPolicyServiceAvailabilityStatusChannel(POLICY_SERVICE_AVAILABILITY_STATUS_CHANNEL)).toBe(true);
    await expect(enforcement.execute({
      channel: POLICY_SERVICE_AVAILABILITY_STATUS_CHANNEL,
      correlationId,
      operation: () => { callbacks += 1; return Object.freeze({ mode: 'deny', contentFree: true }); }
    })).resolves.toEqual({ mode: 'deny', contentFree: true });
    expect(callbacks).toBe(1);
    expect(records).toHaveLength(0);
    expect(markers).toMatchObject({
      availabilityEvaluations: 0,
      ipcCacheClears: 0,
      offlineCacheLocks: 0,
      restrictedReasons: []
    });
  });

  it('does not let a lookalike status channel bypass unavailable fail-closed enforcement', async () => {
    const { enforcement, markers, records } = createHarness('unavailable');
    const lookalike = `${POLICY_SERVICE_AVAILABILITY_STATUS_CHANNEL}:lookalike`;
    let callbacks = 0;
    expect(isDesktopPolicyServiceAvailabilityStatusChannel(lookalike)).toBe(false);
    await expect(enforcement.execute({
      channel: lookalike,
      correlationId,
      operation: () => { callbacks += 1; return 'must-not-run'; }
    })).rejects.toMatchObject({
      code: 'POLICY_SERVICE_AVAILABILITY_DENIED',
      reason: 'SERVICE_UNAVAILABLE'
    });
    expect(callbacks).toBe(0);
    expect(records).toHaveLength(0);
    expect(markers).toMatchObject({
      availabilityEvaluations: 1,
      ipcCacheClears: 1,
      offlineCacheLocks: 1,
      restrictedReasons: ['SERVICE_UNAVAILABLE']
    });
  });

  it('marks both cache clear and offline cache lock on restricted transitions only', async () => {
    const readWrite = createHarness('read-write');
    await readWrite.enforcement.execute({
      channel: 'dashboard:getOverview', correlationId, operation: () => 'rw'
    });
    expect(readWrite.markers).toMatchObject({ ipcCacheClears: 0, offlineCacheLocks: 0 });

    const readOnly = createHarness('read-only');
    await readOnly.enforcement.execute({
      channel: 'dashboard:getOverview', correlationId, operation: () => 'ro'
    });
    expect(readOnly.markers).toMatchObject({ ipcCacheClears: 1, offlineCacheLocks: 1 });

    const unavailable = createHarness('unavailable');
    await expect(unavailable.enforcement.execute({
      channel: 'dashboard:getOverview', correlationId, operation: () => 'must-not-run'
    })).rejects.toMatchObject({ reason: 'SERVICE_UNAVAILABLE' });
    expect(unavailable.markers).toMatchObject({ ipcCacheClears: 1, offlineCacheLocks: 1 });

    const status = createHarness('unavailable');
    await status.enforcement.execute({
      channel: POLICY_SERVICE_AVAILABILITY_STATUS_CHANNEL,
      correlationId,
      operation: () => 'status'
    });
    expect(status.markers).toMatchObject({ ipcCacheClears: 0, offlineCacheLocks: 0 });
  });
});
