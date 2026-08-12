import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { verifyPpk026PolicyClient } from '../../../scripts/verify-ppk026-policy-client.mjs';
import {
  scanTypedPolicySdkBoundarySource,
  verifyTypedPolicySdkBoundary
} from '../../../scripts/verify-typed-policy-sdk-boundary.mjs';

describe('32-V PPK-026 typed SDK and XPF-003 production integration', () => {
  it('regenerates the policy client byte-for-byte from the canonical schema', async () => {
    await expect(verifyPpk026PolicyClient()).resolves.toMatchObject({
      status: 'PASS',
      methodCount: 2,
      sourceExact: true,
      manifestExact: true,
      findings: []
    });
  });

  it('denies direct PEP construction, raw wire methods, raw results and generated-client escapes', () => {
    const malicious = [
      "import { PlatformPolicyEnforcementPoint } from '@ppt/platform-policy'; new PlatformPolicyEnforcementPoint({});",
      "client.request('policy.authorize', payload);",
      "import type { PolicyReceiptVerificationContractResult } from '@ppt/core-service-contracts';",
      "import { GeneratedPolicyServiceClient } from '@ppt/core-service-client';"
    ];
    const rules = malicious.flatMap((source) =>
      scanTypedPolicySdkBoundarySource('apps/desktop/src/main/malicious.ts', source).findings.map((finding) => finding.rule)
    );
    expect(rules).toEqual(expect.arrayContaining([
      'DIRECT_PEP_IMPORT',
      'DIRECT_PEP_CONSTRUCTION',
      'RAW_POLICY_METHOD_LITERAL',
      'RAW_POLICY_RESULT_IMPORT',
      'GENERATED_CLIENT_ESCAPE'
    ]));
  });

  it('keeps all production policy consumers on the canonical SDK factory with no findings', async () => {
    await expect(verifyTypedPolicySdkBoundary()).resolves.toMatchObject({
      status: 'PASS',
      canonicalFactoryConsumers: 7,
      maliciousSelfTestAssertions: 14,
      benignSelfTestAssertions: 4,
      findings: []
    });
  });

  it.each([
    ['finance', 'apps/desktop/src/main/finance-production-policy-runtime.ts'],
    ['health', 'apps/desktop/src/main/health-production-policy-runtime.ts']
  ])('binds the XPF-003 %s runtime to the shared typed policy factory', async (_domain, path) => {
    const source = await readFile(path, 'utf8');
    expect(source).toContain('createTypedPolicyEnforcementPoint');
    expect(source).not.toContain('new PlatformPolicyEnforcementPoint');
  });
});
