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
});
