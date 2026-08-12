import { describe, expect, it } from 'vitest';
import { PLATFORM_POLICY_AST_GATE_RULE_IDS, PlatformPolicyAstGatePolicy } from './src/platform-policy-ast-gate-policy.js';

describe('32-Q PPK-021 AST gate policy snapshot', () => {
  it('publishes the exact default-deny AST boundary', () => {
    const policy = new PlatformPolicyAstGatePolicy();
    const snapshot = policy.snapshot();
    expect(policy.verify(snapshot)).toBe(true);
    expect(snapshot).toMatchObject({
      gateVersion: 'PPK-021-V1',
      syntaxModel: 'TYPESCRIPT_AST',
      enforcement: 'fail-closed',
      defaultDecision: 'DENY',
      protectedRuleCount: 6,
      productionSourceZones: 18,
      exactAllowlistEntries: 542,
      directRoleAuthorizationBypasses: 0,
      wildcardsAllowed: false,
      buildGateReplacesRuntimePolicy: false,
      schemaMigrationRequired: false,
      latestDatabaseMigration: 77
    });
    expect(snapshot.protectedRules).toEqual(PLATFORM_POLICY_AST_GATE_RULE_IDS);
  });

  it('rejects a broadened or reordered snapshot', () => {
    const policy = new PlatformPolicyAstGatePolicy();
    const snapshot = policy.snapshot();
    expect(policy.verify({ ...snapshot, wildcardsAllowed: true } as never)).toBe(false);
    expect(policy.verify({ ...snapshot, directRoleAuthorizationBypasses: 1 } as never)).toBe(false);
    expect(policy.verify({ ...snapshot, protectedRules: [...snapshot.protectedRules].reverse() } as never)).toBe(false);
  });
});
