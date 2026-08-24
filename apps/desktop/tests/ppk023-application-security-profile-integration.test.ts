import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GetApplicationSecurityProfileGateBoundaryUseCase } from '@ppt/application';
import { ApplicationSecurityProfilePolicy } from '@ppt/platform-policy';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';
import { resolveIpcReadSharingPolicy } from '../src/main/ipc-read-sharing.js';

describe('32-S PPK-023 Desktop application-security profile integration', () => {
  it('maps only the content-free verified boundary snapshot', () => {
    const view = new GetApplicationSecurityProfileGateBoundaryUseCase(new ApplicationSecurityProfilePolicy()).execute();
    expect(view).toMatchObject({
      status: 'build-mapping-verified',
      enforcement: 'fail-closed',
      canonicalApplicationCount: 14,
      mappedApplicationCount: 14,
      threatModelCount: 14,
      mobileMasvsApplicationCount: 4,
      asvsVersion: '5.0.0',
      masvsVersion: '2.1.0',
      ssdfVersion: '1.1',
      mappingClaimsCompliance: false,
      nativeRuntimeValidationClaimed: false,
      sourcePathsExposedToClient: false,
      threatModelHashesExposedToClient: false,
      latestDatabaseMigration: 77
    });
  });

  it('accepts only zero-argument IPC and never caches the posture response', () => {
    const channel = 'system:getApplicationSecurityProfileGateBoundary';
    expect(evaluateIpcIntegrationPolicy(channel, [])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy(channel, ['payload'])).toMatchObject({ accepted: false });
    expect(resolveIpcReadSharingPolicy(channel)).toEqual({
      enabled: false, priority: 'standard', ttlMs: 0, maxEntries: 0, maxResultBytes: 0
    });
  });

  it('wires one policy/use-case status path without exposing source or hashes', () => {
    const main = readFileSync('apps/desktop/src/main/main.ts', 'utf8');
    const preload = readFileSync('apps/desktop/src/main/preload.ts', 'utf8');
    const global = readFileSync('apps/desktop/src/renderer/global.d.ts', 'utf8');
    const renderer = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
    expect(main).toContain('new ApplicationSecurityProfilePolicy()');
    expect(main).toContain("registerIpcHandler('system:getApplicationSecurityProfileGateBoundary'");
    expect(preload).toContain("invoke('system:getApplicationSecurityProfileGateBoundary')");
    expect(global).toContain('getApplicationSecurityProfileGateBoundary():Promise<ApplicationSecurityProfileGateBoundaryView>');
    expect(renderer).toContain('title="ASVS, MASVS, SSDF eşlemesi ve uygulama başına tehdit modeli"');
    expect(renderer).toContain('Eşleme uygunluk sertifikası veya çalışma anı yetkisi değildir');
    expect(renderer).toContain('tehdit modeli özeti verilmez');
  });

  it('is a root pretypecheck/prebuild gate and part of combined Platform Policy validation', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const combined = readFileSync('scripts/verify-platform-policy-gate.mjs', 'utf8');
    expect(pkg.scripts.pretypecheck).toContain('verify-application-security-profile-gate.mjs');
    expect(pkg.scripts.prebuild).toContain('verify-application-security-profile-gate.mjs');
    expect(combined).toContain('applicationSecurityProfileGateStatus');
  });
});
