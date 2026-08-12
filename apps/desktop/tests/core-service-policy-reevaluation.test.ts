import { describe, expect, it } from 'vitest';
import { asCorrelationId } from '@ppt/core';
import { CORE_SERVICE_APPLICATION_API_VERSION } from '@ppt/core-service-contracts';
import { CoreServiceRuntime } from '../../core-service/src/core-service-runtime.js';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PolicyServiceAvailabilityObservation,
  type PlatformPolicyReceiptRecord,
  type PlatformPolicyRequest
} from '@ppt/platform-policy';
import {
  DesktopUniversalApiPolicyEnforcement,
  isDesktopPolicyBootstrapChannel,
  resolveDesktopUniversalApiIntent
} from '../src/main/desktop-universal-api-policy-enforcement.js';
import { DesktopRepositoryPolicyScope } from '../src/main/desktop-repository-policy-scope.js';

const NOW = '2026-08-11T13:00:00.000Z';
const EXPIRES = '2026-08-11T14:00:00.000Z';

const kernel = (authority: 'windows-core-service' | 'local-policy-kernel' = 'windows-core-service') =>
  new PlatformPolicyKernel({
    policyVersion: 'PPK-009', policyPackageVersion: 9,
    decisionAuthorityId: authority, signingKey: Buffer.alloc(32, 9),
    applicationVersions: {
      'windows-desktop': CORE_SERVICE_APPLICATION_API_VERSION,
      'windows-core-service': CORE_SERVICE_APPLICATION_API_VERSION
    },
    applicationCapabilities: {
      'windows-desktop': ['family.read', 'family.write'],
      'windows-core-service': ['family.read', 'family.write']
    },
    consentRequiredCapabilities: [], onlineOnlyCapabilities: [], writeActions: ['update']
  });

const request = (policyKernel = kernel(), trusted = true): PlatformPolicyRequest => {
  const policyPackage = policyKernel.policyPackage;
  return {
    correlationId: 'corr-32-e-ppk-009', policyVersion: 'PPK-009',
    policyPackageVersion: policyPackage.payload.packageVersion,
    policyPackageSha256: policyPackage.payloadSha256,
    decisionAuthorityId: 'windows-core-service',
    subject: {
      accountId: 'account-32-e', personId: 'person-32-e', deviceId: 'device-32-e',
      applicationId: 'windows-desktop', applicationVersion: CORE_SERVICE_APPLICATION_API_VERSION,
      capabilityManifestSha256: policyPackage.payload.applicationManifests['windows-desktop']!.capabilityManifestSha256,
      deviceTrusted: trusted, membershipActive: true, roles: ['family_admin'],
      familyIds: ['family-32-e'], householdIds: [], familyBranchIds: []
    },
    resource: {
      type: 'desktop_ipc_endpoint', id: 'family:getOverview', familyId: 'family-32-e',
      ownerPersonId: 'person-32-e', sensitivity: 'internal', dataClasses: ['general'],
      classificationSource: 'declared'
    },
    action: 'read', capability: 'family.read', purpose: 'administration',
    occurredAt: NOW, online: true, clusterWritable: true, enforcementMode: 'strict'
  };
};

const authority = () => ({
  policyVersion: 'PPK-009', accountId: 'account-32-e', personId: 'person-32-e',
  deviceId: 'device-32-e', applicationId: 'windows-desktop' as const,
  deviceTrusted: true, membershipActive: true, roles: ['family_admin'],
  familyIds: ['family-32-e'], online: true, expiresAt: EXPIRES
});

const availability = (policyKernel: PlatformPolicyKernel): PolicyServiceAvailabilityObservation => ({
  schemaVersion: 1,
  lifecycle: 'ready', writable: true, safeMode: false, policyPackageVerified: true,
  policyVersion: 'PPK-009', policyPackageVersion: policyKernel.policyPackage.payload.packageVersion,
  policyPackageSha256: policyKernel.policyPackage.payloadSha256,
  expectedPolicyVersion: 'PPK-009', expectedPolicyPackageVersion: policyKernel.policyPackage.payload.packageVersion,
  expectedPolicyPackageSha256: policyKernel.policyPackage.payloadSha256,
  observedAt: NOW, checkedAt: NOW
});

describe('32-E PPK-009 Core Service policy decision re-evaluation', () => {
  it('signs the Core Service decision authority into the policy package', () => {
    expect(kernel().policyPackage.payload).toMatchObject({
      policyVersion: 'PPK-009', decisionAuthorityId: 'windows-core-service'
    });
  });

  it('binds an allow decision and receipt to Core Service', () => {
    const policyKernel = kernel();
    const authorization = policyKernel.authorizeWithReceipt(request(policyKernel), NOW, 'nonce-32-e-core');
    expect(authorization.decision).toMatchObject({ allowed: true, decisionAuthorityId: 'windows-core-service' });
    expect(authorization.receipt.decision.decisionAuthorityId).toBe('windows-core-service');
  });

  it('denies a strict request that omits the signed decision authority', () => {
    const policyKernel = kernel();
    const { decisionAuthorityId: _omitted, ...withoutAuthority } = request(policyKernel);
    expect(policyKernel.evaluate(withoutAuthority as PlatformPolicyRequest))
      .toMatchObject({ allowed: false, reason: 'DECISION_AUTHORITY_MISMATCH' });
  });

  it('denies a request that substitutes a local evaluator', () => {
    const policyKernel = kernel();
    expect(policyKernel.evaluate({ ...request(policyKernel), decisionAuthorityId: 'local-policy-kernel' }))
      .toMatchObject({ allowed: false, reason: 'DECISION_AUTHORITY_MISMATCH' });
  });

  it('Core Service freshly re-evaluates an untrusted UI claim to deny', () => {
    const policyKernel = kernel();
    const runtime = new CoreServiceRuntime({ policyKernel, policyVersion: 'PPK-009', clock: () => NOW });
    runtime.markReady();
    const result = runtime.authorizeWithReceipt(request(policyKernel, false), 'nonce-32-e-untrusted');
    expect(result.authorization.decision).toMatchObject({
      allowed: false, reason: 'DEVICE_NOT_TRUSTED', decisionAuthorityId: 'windows-core-service'
    });
  });

  it('PEP persists Core authority before opening the operation callback', async () => {
    const policyKernel = kernel();
    const records: PlatformPolicyReceiptRecord[] = [];
    const provider: PlatformPolicyAuthorizationProvider = {
      decisionAuthority: 'windows-core-service',
      observePolicyServiceAvailability: () => availability(policyKernel),
      resolvePolicyPackage: () => policyKernel.policyPackage,
      authorize: ({ request: resolved, nonce }) => ({
        effectiveRequest: resolved, authorization: policyKernel.authorizeWithReceipt(resolved, NOW, nonce)
      }),
      verify: ({ request: resolved, receipt }) => policyKernel.verifyReceiptForRequest(receipt, resolved)
    };
    const pep = new PlatformPolicyEnforcementPoint({
      provider, authorityResolver: { resolve: authority },
      resourceResolver: { resolve: () => request(policyKernel).resource },
      receiptSink: { append: (record) => { records.push(record); } },
      replayStore: { reserve: () => true }, clock: () => NOW,
      nonceFactory: () => 'nonce-32-e-pep'
    });
    await expect(pep.execute({
      correlationId: 'corr-32-e-ppk-009', action: 'read', capability: 'family.read',
      resourceType: 'desktop_ipc_endpoint', resourceId: 'family:getOverview', purpose: 'administration'
    }, () => ({ writable: true, epoch: 74 }), () => `after-${records.length}-receipt`))
      .resolves.toBe('after-1-receipt');
    expect(records[0]).toMatchObject({ decisionAuthorityId: 'windows-core-service' });
  });

  it('rejects a provider that relabels a Core decision as local before persistence', async () => {
    const policyKernel = kernel();
    let persisted = 0;
    let executed = 0;
    const pep = new PlatformPolicyEnforcementPoint({
      provider: {
        decisionAuthority: 'windows-core-service',
        observePolicyServiceAvailability: () => availability(policyKernel),
        resolvePolicyPackage: () => policyKernel.policyPackage,
        authorize: ({ request: resolved, nonce }) => {
          const valid = policyKernel.authorizeWithReceipt(resolved, NOW, nonce);
          const decision = { ...valid.decision, decisionAuthorityId: 'local-policy-kernel' as const };
          return { effectiveRequest: resolved, authorization: { decision, receipt: { ...valid.receipt, decision } } };
        },
        verify: () => true
      },
      authorityResolver: { resolve: authority },
      resourceResolver: { resolve: () => request(policyKernel).resource },
      receiptSink: { append: () => { persisted += 1; } }, replayStore: { reserve: () => true },
      clock: () => NOW, nonceFactory: () => 'nonce-32-e-relabel'
    });
    await expect(pep.execute({
      correlationId: 'corr-32-e-ppk-009', action: 'read', capability: 'family.read',
      resourceType: 'desktop_ipc_endpoint', resourceId: 'family:getOverview', purpose: 'administration'
    }, () => ({ writable: true, epoch: 74 }), () => { executed += 1; }))
      .rejects.toMatchObject({ code: 'RECEIPT_VERIFICATION_FAILED' });
    expect({ persisted, executed }).toEqual({ persisted: 0, executed: 0 });
  });

  it('Desktop universal PEP rejects a provider without the Core process marker', () => {
    expect(() => new DesktopUniversalApiPolicyEnforcement({
      authorizationProvider: {
        authorize: () => { throw new Error('must-not-run'); }, verify: () => false
      },
      receiptSink: { append: () => undefined }, clusterFence: () => ({ writable: true, epoch: 74 }),
      resolveAuthority: authority, repositoryPolicyScope: new DesktopRepositoryPolicyScope(),
      resolveBootstrapClientContext: () => ({
        applicationId: 'windows-desktop', deviceId: 'device-32-e', policyVersion: 'PPK-009',
        policyPackageSha256: '1'.repeat(64), capabilityManifestSha256: '2'.repeat(64), occurredAt: NOW
      }),
      clock: () => NOW
    })).toThrow('DESKTOP_API_POLICY_AUTHORITY_UNAVAILABLE');
  });

  it('derives authorization only from channel identity and never from UI visibility', () => {
    expect(resolveDesktopUniversalApiIntent('family:updateMember', asCorrelationId('corr-32-e-ui')))
      .toMatchObject({ action: 'update', capability: 'family.write', resourceId: 'family:updateMember' });
  });

  it('keeps receiptless execution limited to the explicit unauthenticated bootstrap set', () => {
    expect(isDesktopPolicyBootstrapChannel('auth:login')).toBe(true);
    expect(isDesktopPolicyBootstrapChannel('auth:logout')).toBe(false);
    expect(isDesktopPolicyBootstrapChannel('family:updateMember')).toBe(false);
  });
});
