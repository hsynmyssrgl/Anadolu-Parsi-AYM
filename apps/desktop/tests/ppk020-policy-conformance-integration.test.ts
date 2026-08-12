import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GetPolicyConformanceSuiteBoundaryUseCase } from '@ppt/application';
import { PlatformPolicyConformanceSuite } from '@ppt/platform-policy';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';
import { resolveIpcReadSharingPolicy } from '../src/main/ipc-read-sharing.js';

describe('32-P PPK-020 desktop content-free conformance status boundary', () => {
  it('maps the canonical suite snapshot without exposing test payloads', () => {
    const view = new GetPolicyConformanceSuiteBoundaryUseCase(new PlatformPolicyConformanceSuite()).execute();
    expect(view).toMatchObject({
      status: 'build-verified',
      enforcement: 'fail-closed',
      suiteVersion: 'PPK-020-V1',
      targetCount: 14,
      caseCount: 22,
      totalMatrixAssertions: 308,
      deployedRuntimeTargets: 2,
      profileOnlyTargets: 12,
      referenceHarnessGrantsRuntimeAuthority: false,
      nativeAppleRuntimeExecutionClaimed: false,
      payloadExposedToClient: false,
      schemaMigrationRequired: false,
      latestDatabaseMigration: 77
    });
    expect(Object.hasOwn(view, 'cases')).toBe(false);
    expect(Object.hasOwn(view, 'reportHash')).toBe(false);
  });

  it('accepts only a zero-argument IPC request', () => {
    expect(evaluateIpcIntegrationPolicy('system:getPolicyConformanceSuiteBoundary', [])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('system:getPolicyConformanceSuiteBoundary', ['payload'])).toMatchObject({
      accepted: false,
      reason: 'ARGUMENT_COUNT_MISMATCH'
    });
  });

  it('keeps the policy posture response outside every IPC read cache', () => {
    expect(resolveIpcReadSharingPolicy('system:getPolicyConformanceSuiteBoundary')).toEqual({
      enabled: false,
      priority: 'standard',
      ttlMs: 0,
      maxEntries: 0,
      maxResultBytes: 0
    });
  });

  it('wires preload, global typing and renderer deployment truth to the same channel', () => {
    const preload = readFileSync('apps/desktop/src/main/preload.ts', 'utf8');
    const global = readFileSync('apps/desktop/src/renderer/global.d.ts', 'utf8');
    const renderer = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
    expect(preload).toContain("invoke('system:getPolicyConformanceSuiteBoundary')");
    expect(global).toContain('getPolicyConformanceSuiteBoundary():Promise<PolicyConformanceSuiteBoundaryView>');
    expect(renderer).toContain('Native Apple çalıştırması tamamlandı iddiası yoktur');
    expect(renderer).toContain('profile-only/not-deployed');
  });
});
