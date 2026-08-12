import { describe, expect, it } from 'vitest';
import type {
  CoreServiceHealthContract,
  CoreServiceMethodPayload,
  CoreServiceMethodResult,
  PolicyAuthorizationContractResult,
  PolicyServiceAvailabilityObservation
} from '@ppt/core-service-contracts';
import {
  CoreServicePolicySdk,
  CoreServicePolicySdkError,
  GeneratedPolicyServiceClient,
  type GeneratedPolicyClientTransport,
  type GeneratedPolicyMethod
} from './src/index.js';

const NOW = '2026-08-12T08:00:00.000Z';

const fixture = () => {
  const policyPackage = {
    payload: { packageVersion: 26 },
    payloadSha256: 'a'.repeat(64)
  } as unknown as CoreServiceHealthContract['policyPackage'];
  const request: CoreServiceMethodPayload<'policy.authorize'>['request'] = {
    correlationId: 'corr-32-v-sdk',
    policyVersion: 'PPK-026',
    policyPackageVersion: policyPackage.payload.packageVersion,
    policyPackageSha256: policyPackage.payloadSha256,
    decisionAuthorityId: 'windows-core-service',
    subject: {
      accountId: 'account-32-v',
      personId: 'person-32-v',
      deviceId: 'device-32-v',
      applicationId: 'windows-desktop',
      applicationVersion: 'v1',
      capabilityManifestSha256: 'b'.repeat(64),
      deviceTrusted: true,
      membershipActive: true,
      roles: ['family_admin'],
      familyIds: ['family-32-v'],
      householdIds: [],
      familyBranchIds: []
    },
    resource: {
      type: 'finance_record',
      id: 'finance-32-v',
      familyId: 'family-32-v',
      ownerPersonId: 'person-32-v',
      sensitivity: 'sensitive',
      dataClasses: ['financial'],
      classificationSource: 'declared'
    },
    action: 'read',
    capability: 'finance.read',
    purpose: 'administration',
    occurredAt: NOW,
    online: true,
    clusterWritable: true,
    enforcementMode: 'strict'
  };
  const health = (verified = true): CoreServiceHealthContract => ({
    lifecycle: 'ready',
    role: 'standalone',
    writable: true,
    safeMode: false,
    writeFenceEpoch: 26,
    policyVersion: 'PPK-026',
    policyPackage,
    policyPackageVerified: verified,
    startedAt: NOW,
    observedAt: NOW,
    reasons: []
  });
  const availability: PolicyServiceAvailabilityObservation = {
    schemaVersion: 1,
    lifecycle: 'ready',
    writable: true,
    safeMode: false,
    policyPackageVerified: true,
    policyVersion: 'PPK-026',
    policyPackageVersion: policyPackage.payload.packageVersion,
    policyPackageSha256: policyPackage.payloadSha256,
    expectedPolicyVersion: 'PPK-026',
    expectedPolicyPackageVersion: policyPackage.payload.packageVersion,
    expectedPolicyPackageSha256: policyPackage.payloadSha256,
    observedAt: NOW,
    checkedAt: NOW
  };
  let fence = { writable: true, epoch: 26 };
  let malformed = false;
  const transport: GeneratedPolicyClientTransport = {
    request: async <TMethod extends GeneratedPolicyMethod>(
      method: TMethod,
      payload: CoreServiceMethodPayload<TMethod>
    ): Promise<CoreServiceMethodResult<TMethod>> => {
      if (malformed) return { invalid: true } as CoreServiceMethodResult<TMethod>;
      if (method === 'policy.authorize') {
        const authorizationPayload = payload as CoreServiceMethodPayload<'policy.authorize'>;
        const authorization = {
          decision: { decisionAuthorityId: 'windows-core-service' },
          receipt: { nonce: authorizationPayload.nonce }
        } as unknown as PolicyAuthorizationContractResult['authorization'];
        return {
          effectiveRequest: authorizationPayload.request,
          authorization,
          fence
        } as CoreServiceMethodResult<TMethod>;
      }
      return {
        valid: true,
        fence
      } as CoreServiceMethodResult<TMethod>;
    }
  };
  const sdk = new CoreServicePolicySdk(new GeneratedPolicyServiceClient(transport));
  return {
    sdk,
    request,
    health,
    availability,
    setFence: (value: { writable: boolean; epoch: number }) => { fence = value; },
    setMalformed: (value: boolean) => { malformed = value; }
  };
};

describe('32-V PPK-026 Core Service typed policy SDK', () => {
  it('denies package, fence, authorization and verification before verified health is observed', async () => {
    const { sdk, request } = fixture();
    expect(() => sdk.clusterFence()).toThrowError(CoreServicePolicySdkError);
    expect(() => sdk.policyProvider.resolvePolicyPackage?.('windows-desktop')).toThrow('has not been verified');
    await expect(sdk.policyProvider.authorize({ request, nonce: 'nonce-unobserved' }))
      .rejects.toMatchObject({ code: 'POLICY_STATE_UNOBSERVED' });
  });

  it('maps generated authorization and verification without exposing raw contract results', async () => {
    const { sdk, request, health, availability } = fixture();
    sdk.observeHealth(health());
    sdk.bindPolicyServiceAvailabilityObserver(async () => availability);
    expect(sdk.clusterFence()).toEqual({ writable: true, epoch: 26 });
    expect(sdk.policyProvider.resolvePolicyPackage?.('windows-desktop')).toBe(health().policyPackage);
    await expect(sdk.policyProvider.observePolicyServiceAvailability?.()).resolves.toBe(availability);

    const authorization = await sdk.policyProvider.authorize({ request, nonce: 'nonce-32-v-authorize' });
    expect(authorization.effectiveRequest).toBe(request);
    expect(authorization.authorization.decision.decisionAuthorityId).toBe('windows-core-service');
    await expect(sdk.policyProvider.verify({ request, receipt: authorization.authorization.receipt })).resolves.toBe(true);
    expect(Object.keys(authorization).sort()).toEqual(['authorization', 'effectiveRequest']);
  });

  it('clears all trusted state when health is unverified', async () => {
    const { sdk, request, health } = fixture();
    sdk.observeHealth(health());
    sdk.observeHealth(health(false));
    expect(() => sdk.clusterFence()).toThrow('has not been verified');
    expect(() => sdk.policyProvider.resolvePolicyPackage?.('windows-desktop')).toThrow('has not been verified');
    await expect(sdk.policyProvider.authorize({ request, nonce: 'nonce-after-unverified-health' }))
      .rejects.toMatchObject({ code: 'POLICY_STATE_UNOBSERVED' });
  });

  it('rejects a regressing remote fence and clears the previously trusted state', async () => {
    const { sdk, request, health, setFence } = fixture();
    sdk.observeHealth(health());
    setFence({ writable: true, epoch: 25 });
    await expect(sdk.policyProvider.authorize({ request, nonce: 'nonce-regressing-fence' }))
      .rejects.toMatchObject({ code: 'POLICY_FENCE_REGRESSION' });
    expect(() => sdk.clusterFence()).toThrow('has not been verified');
  });

  it('rejects malformed remote results and duplicate availability observers', async () => {
    const { sdk, request, health, availability, setMalformed } = fixture();
    sdk.observeHealth(health());
    sdk.bindPolicyServiceAvailabilityObserver(async () => availability);
    expect(() => sdk.bindPolicyServiceAvailabilityObserver(async () => availability))
      .toThrowError(CoreServicePolicySdkError);
    setMalformed(true);
    await expect(sdk.policyProvider.authorize({ request, nonce: 'nonce-malformed-result' }))
      .rejects.toMatchObject({ code: 'POLICY_RESPONSE_INVALID' });
    expect(() => sdk.clusterFence()).toThrow('has not been verified');
  });
});
