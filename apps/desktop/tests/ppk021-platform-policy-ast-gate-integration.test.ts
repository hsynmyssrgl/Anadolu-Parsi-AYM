import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GetPlatformPolicyAstGateBoundaryUseCase } from '@ppt/application';
import { PlatformPolicyAstGatePolicy } from '@ppt/platform-policy';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';
import { resolveIpcReadSharingPolicy } from '../src/main/ipc-read-sharing.js';

describe('32-Q PPK-021 desktop content-free AST gate boundary', () => {
  it('maps only the verified posture snapshot', () => {
    const view = new GetPlatformPolicyAstGateBoundaryUseCase(new PlatformPolicyAstGatePolicy()).execute();
    expect(view).toMatchObject({
      status: 'build-verified',
      gateVersion: 'PPK-021-V1',
      parser: '@babel/parser',
      syntaxModel: 'TYPESCRIPT_AST',
      enforcement: 'fail-closed',
      defaultDecision: 'DENY',
      protectedRuleCount: 6,
      exactAllowlistEntries: 590,
      directRoleAuthorizationBypasses: 0,
      wildcardsAllowed: false,
      buildGateReplacesRuntimePolicy: false,
      schemaMigrationRequired: false,
      latestDatabaseMigration: 77
    });
    expect(Object.hasOwn(view, 'sourcePaths')).toBe(false);
    expect(Object.hasOwn(view, 'allowlistHash')).toBe(false);
  });

  it('accepts only a zero-argument IPC request', () => {
    expect(evaluateIpcIntegrationPolicy('system:getPlatformPolicyAstGateBoundary', [])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('system:getPlatformPolicyAstGateBoundary', ['payload'])).toMatchObject({
      accepted: false,
      reason: 'ARGUMENT_COUNT_MISMATCH'
    });
  });

  it('keeps the posture response outside every IPC read cache', () => {
    expect(resolveIpcReadSharingPolicy('system:getPlatformPolicyAstGateBoundary')).toEqual({
      enabled: false,
      priority: 'standard',
      ttlMs: 0,
      maxEntries: 0,
      maxResultBytes: 0
    });
  });

  it('wires preload, typing and UI truth to the same channel', () => {
    const preload = readFileSync('apps/desktop/src/main/preload.ts', 'utf8');
    const global = readFileSync('apps/desktop/src/renderer/global.d.ts', 'utf8');
    const renderer = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
    expect(preload).toContain("invoke('system:getPlatformPolicyAstGateBoundary')");
    expect(global).toContain('getPlatformPolicyAstGateBoundary():Promise<PlatformPolicyAstGateBoundaryView>');
    expect(renderer).toContain('AST gate runtime politikasının yerine geçmez');
    expect(renderer).toContain('doğrudan rol yetkilendirmesi:');
    expect(renderer).toContain('directRoleAuthorizationBypasses');
  });
});
