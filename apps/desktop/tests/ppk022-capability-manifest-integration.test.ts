import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GetPlatformCapabilityManifestGateBoundaryUseCase } from '@ppt/application';
import { PlatformCapabilityManifestPolicy } from '@ppt/platform-policy';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';
import { resolveIpcReadSharingPolicy } from '../src/main/ipc-read-sharing.js';

describe('32-R PPK-022 Desktop/Core Service capability manifest integration', () => {
  it('maps only the content-free verified boundary snapshot', () => {
    const view = new GetPlatformCapabilityManifestGateBoundaryUseCase(new PlatformCapabilityManifestPolicy()).execute();
    expect(view).toMatchObject({
      status: 'build-runtime-verified',
      gateVersion: 'PPK-022-V1',
      enforcement: 'build-and-runtime-fail-closed',
      protectedCapabilityCount: 7,
      canonicalApplicationCount: 14,
      exactAstSurfaceCount: 246,
      signedManifestHashBindingRequired: true,
      authenticatedRuntimeAuthorityRequired: true,
      bootstrapNetworkCapabilityPinned: true,
      sourcePathsExposedToClient: false,
      manifestHashesExposedToClient: false,
      schemaMigrationRequired: false,
      latestDatabaseMigration: 77
    });
  });

  it('accepts only zero-argument IPC and never caches the posture response', () => {
    const channel = 'system:getPlatformCapabilityManifestGateBoundary';
    expect(evaluateIpcIntegrationPolicy(channel, [])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy(channel, ['payload'])).toMatchObject({ accepted: false });
    expect(resolveIpcReadSharingPolicy(channel)).toEqual({
      enabled: false, priority: 'standard', ttlMs: 0, maxEntries: 0, maxResultBytes: 0
    });
  });

  it('binds Core Service production package creation and Desktop startup to exact runtime coverage', () => {
    const coreMain = readFileSync('apps/core-service/src/main.ts', 'utf8');
    const startup = readFileSync('apps/desktop/src/main/core-service-startup-connection.ts', 'utf8');
    const desktopMain = readFileSync('apps/desktop/src/main/main.ts', 'utf8');
    expect(coreMain).toContain('applicationRuntimeCapabilities: PLATFORM_APPLICATION_RUNTIME_CAPABILITY_REQUIREMENTS');
    expect(coreMain).toContain('capabilityManifestPolicy.evaluateCoverage(applicationId');
    expect(startup).toContain("source: 'authenticated-core-service-health'");
    expect(startup).toContain("evaluateCoverage(\n    'windows-desktop'");
    expect(desktopMain).toContain("assertPinnedBootstrapRuntimeCapability('windows-desktop', 'file.access')");
    expect(desktopMain).toContain("assertPinnedBootstrapRuntimeCapability('windows-desktop', 'network.access')");
  });

  it('wires preload, typing and UI truth to one no-cache status channel', () => {
    const preload = readFileSync('apps/desktop/src/main/preload.ts', 'utf8');
    const global = readFileSync('apps/desktop/src/renderer/global.d.ts', 'utf8');
    const renderer = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
    expect(preload).toContain("invoke('system:getPlatformCapabilityManifestGateBoundary')");
    expect(global).toContain('getPlatformCapabilityManifestGateBoundary():Promise<PlatformCapabilityManifestGateBoundaryView>');
    expect(renderer).toContain('Build manifesti tek başına runtime yetkisi vermez');
    expect(renderer).toContain('manifest hash\'i verilmez');
  });
});
