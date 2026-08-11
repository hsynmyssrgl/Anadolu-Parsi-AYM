import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PlatformPolicyKernel } from '@ppt/platform-policy';
import type { CoreServiceArchitectureContract } from '@ppt/core-service-contracts';
import { CoreServiceMethodDispatcher } from '../src/core-service-method-dispatcher.js';
import { CoreServiceRuntime } from '../src/core-service-runtime.js';

const runtimeFixture = (): CoreServiceRuntime => {
  const runtime = new CoreServiceRuntime({
    policyKernel: new PlatformPolicyKernel({
      policyVersion: 'PPT-PLATFORM-POLICY-2026-08-04-V1',
      signingKey: randomBytes(32),
      applicationCapabilities: { 'windows-desktop': ['family.read'] },
      consentRequiredCapabilities: [],
      onlineOnlyCapabilities: [],
      writeActions: ['create', 'update', 'delete']
    }),
    policyVersion: 'PPT-PLATFORM-POLICY-2026-08-04-V1',
    clock: () => '2026-08-10T18:00:00.000Z'
  });
  runtime.markReady('standalone');
  return runtime;
};

describe('31-G Core Service typed method dispatcher', () => {
  it('reports the headless ownership and typed method registry without claiming data migration', () => {
    const response = new CoreServiceMethodDispatcher(runtimeFixture()).dispatch('architecture-1', 'architecture.get', {});
    expect(response).toMatchObject({ protocolVersion: 1, requestId: 'architecture-1', ok: true });
    expect(response.ok).toBe(true);
    const architecture = response.ok ? response.result as CoreServiceArchitectureContract : undefined;
    expect(architecture).toMatchObject({
      apiVersion: 'v1',
      processBoundary: 'headless-core-service',
      ownership: {
        process: 'core-service',
        policyKernel: 'core-service',
        applicationApi: 'core-service',
        familyData: 'desktop-transition',
        deviceSecretProtection: 'detached',
        backup: 'desktop-transition',
        sync: 'not-implemented'
      },
      safety: {
        familyDataCutover: 'blocked',
        legacyDesktopDataActive: true,
        automaticCutoverAllowed: false
      }
    });
    expect(architecture?.supportedMethods).toEqual(['architecture.get', 'health.get', 'family-data.status', 'device-secret-protection.status', 'family-data-cutover.status', 'family-data-cutover-readiness.status', 'policy.authorize', 'policy.verify', 'policy-journal.checkpoint']);
  });

  it('keeps health on the same dispatcher and rejects malformed or unknown calls', () => {
    const dispatcher = new CoreServiceMethodDispatcher(runtimeFixture());
    expect(dispatcher.dispatch('health-1', 'health.get', {})).toMatchObject({ ok: true });
    expect(dispatcher.dispatch('health-2', 'health.get', { unexpected: true })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(dispatcher.dispatch('family-data-1', 'family-data.status', {})).toMatchObject({
      ok: true,
      result: { owner: 'desktop-transition', lifecycle: 'detached', writable: false, persistentPathExposed: false }
    });
    expect(dispatcher.dispatch('family-data-2', 'family-data.status', { path: 'forbidden' })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(dispatcher.dispatch('device-protection-1', 'device-secret-protection.status', {})).toMatchObject({
      ok: true,
      result: { owner: 'detached', lifecycle: 'detached', available: false, secretMaterialExposed: false, electronDependency: false }
    });
    expect(dispatcher.dispatch('device-protection-2', 'device-secret-protection.status', { secret: 'forbidden' })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(dispatcher.dispatch('cutover-1', 'family-data-cutover.status', {})).toMatchObject({
      ok: true,
      result: {
        mode: 'coexistence-no-cutover',
        decision: 'blocked',
        legacyDesktopDataActive: true,
        realDataTransferAllowed: false,
        writeOwnershipTransferAllowed: false,
        persistentPathExposed: false,
        secretMaterialExposed: false
      }
    });
    expect(dispatcher.dispatch('cutover-2', 'family-data-cutover.status', { allow: true })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(dispatcher.dispatch('readiness-1', 'family-data-cutover-readiness.status', {})).toMatchObject({
      ok: true,
      result: {
        mode: 'monotonic-evidence-no-cutover',
        decision: 'blocked',
        ledgerEpoch: 0,
        entryCount: 0,
        allRequiredGatesPass: false,
        cutoverAuthorityAttached: false,
        persistentPathExposed: false,
        secretMaterialExposed: false
      }
    });
    expect(dispatcher.dispatch('readiness-2', 'family-data-cutover-readiness.status', { pass: true })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(dispatcher.dispatch('unknown-1', 'database.query', {})).toMatchObject({ ok: false, error: { code: 'METHOD_NOT_ALLOWED' } });
    expect(dispatcher.dispatch('policy-1', 'policy.authorize', { nonce: '' })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
  });

  it('accepts only a complete strict PPK-004 context on authorize and verify boundaries', () => {
    const dispatcher = new CoreServiceMethodDispatcher(runtimeFixture());
    const request = {
      correlationId: 'core-service-ppk-004',
      policyVersion: 'PPT-PLATFORM-POLICY-2026-08-04-V1',
      subject: {
        accountId: 'account-ppk-004', personId: 'person-ppk-004', deviceId: 'device-ppk-004',
        applicationId: 'windows-desktop' as const, deviceTrusted: true, membershipActive: true,
        roles: ['adult_member'], familyIds: ['family-ppk-004'], householdIds: [], familyBranchIds: []
      },
      resource: {
        type: 'family', id: 'family-ppk-004', familyId: 'family-ppk-004',
        ownerPersonId: 'person-ppk-004', sensitivity: 'personal' as const,
        dataClasses: ['personal'] as const, classificationSource: 'declared' as const
      },
      action: 'read' as const,
      capability: 'family.read' as const,
      purpose: 'family-administration',
      occurredAt: '2026-08-10T18:00:00.000Z',
      online: true,
      clusterWritable: true,
      enforcementMode: 'strict' as const
    };
    expect(dispatcher.dispatch('policy-legacy', 'policy.authorize', {
      nonce: 'nonce-policy-legacy', request: { ...request, enforcementMode: 'legacy' }
    })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(dispatcher.dispatch('policy-purpose-missing', 'policy.authorize', {
      nonce: 'nonce-policy-purpose-missing', request: { ...request, purpose: undefined }
    })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });

    const authorization = dispatcher.dispatch('policy-strict', 'policy.authorize', {
      nonce: 'nonce-policy-strict', request
    });
    expect(authorization).toMatchObject({
      ok: true,
      result: { authorization: { decision: { allowed: true, contextHash: expect.stringMatching(/^[0-9a-f]{64}$/u) } } }
    });
    expect(authorization.ok).toBe(true);
    if (!authorization.ok) return;
    const receipt = (authorization.result as { authorization: { receipt: unknown } }).authorization.receipt;
    expect(dispatcher.dispatch('policy-verify-strict', 'policy.verify', { request, receipt })).toMatchObject({
      ok: true,
      result: { valid: true }
    });
    expect(dispatcher.dispatch('policy-verify-changed-purpose', 'policy.verify', {
      request: { ...request, purpose: 'support' }, receipt
    })).toMatchObject({ ok: true, result: { valid: false } });
  });
});
