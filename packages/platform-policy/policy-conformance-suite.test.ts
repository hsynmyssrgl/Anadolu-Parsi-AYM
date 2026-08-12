import { describe, expect, it } from 'vitest';
import {
  POLICY_CONFORMANCE_CASE_IDS,
  POLICY_CONFORMANCE_TARGET_PROFILES,
  PlatformPolicyConformanceSuite,
  PlatformPolicyKernel,
  createPlatformDeviceCertificate,
  type PlatformApplicationId,
  type PlatformPolicyRequest
} from './src/index.js';

const NOW = '2026-08-12T20:00:00.000Z';
const VERSION = 'conformance-v1';

const kernelFor = (applicationId: PlatformApplicationId): PlatformPolicyKernel => new PlatformPolicyKernel({
  policyVersion: 'PPK-020',
  policyPackageVersion: 20,
  signingKey: Buffer.alloc(32, 20),
  decisionAuthorityId: 'local-policy-kernel',
  applicationVersions: { [applicationId]: VERSION },
  deviceCertificateRequiredApplications: [applicationId],
  applicationCapabilities: { [applicationId]: ['family.read', 'family.write', 'health.read'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: ['family.read'],
  writeActions: ['create', 'update', 'delete']
});

const baselineFor = (applicationId: PlatformApplicationId, kernel = kernelFor(applicationId)): PlatformPolicyRequest => {
  const policyPackage = kernel.policyPackage;
  const manifest = policyPackage.payload.applicationManifests[applicationId]!;
  const certificate = createPlatformDeviceCertificate({
    schemaVersion: 1,
    issuer: 'trusted-device-registry',
    deviceId: `device-${applicationId}`,
    applicationId,
    publicKeyFingerprintSha256: 'a'.repeat(64),
    capabilityManifestSha256: manifest.capabilityManifestSha256,
    issuedAt: '2026-08-11T20:00:00.000Z',
    expiresAt: '2026-08-13T20:00:00.000Z'
  });
  return {
    correlationId: `corr-ppk-020-${applicationId}`,
    policyVersion: 'PPK-020',
    policyPackageVersion: 20,
    policyPackageSha256: policyPackage.payloadSha256,
    decisionAuthorityId: 'local-policy-kernel',
    subject: {
      accountId: 'account-ppk-020',
      personId: 'person-ppk-020',
      deviceId: `device-${applicationId}`,
      applicationId,
      applicationVersion: VERSION,
      capabilityManifestSha256: manifest.capabilityManifestSha256,
      deviceCertificate: certificate,
      deviceTrusted: true,
      membershipActive: true,
      roles: ['family_admin'],
      familyIds: ['family-ppk-020'],
      householdIds: [],
      familyBranchIds: []
    },
    resource: {
      type: 'family_profile',
      id: 'profile-ppk-020',
      familyId: 'family-ppk-020',
      ownerPersonId: 'person-ppk-020',
      sensitivity: 'sensitive',
      dataClasses: ['personal'],
      classificationSource: 'declared'
    },
    action: 'read',
    capability: 'family.read',
    purpose: 'policy-conformance',
    occurredAt: NOW,
    online: true,
    clusterWritable: true,
    enforcementMode: 'strict'
  };
};

describe('32-P PPK-020 cross-platform policy conformance suite', () => {
  it.each(POLICY_CONFORMANCE_TARGET_PROFILES)(
    'executes the identical 22-case fail-closed matrix for $applicationId',
    (target) => {
      const kernel = kernelFor(target.applicationId);
      const suite = new PlatformPolicyConformanceSuite();
      const report = suite.run({ target, kernel, baselineRequest: baselineFor(target.applicationId, kernel) });
      expect(report.cases.map((item) => item.caseId)).toEqual(POLICY_CONFORMANCE_CASE_IDS);
      expect(report.cases.filter((item) => !item.passed)).toEqual([]);
      expect(report).toMatchObject({
        target,
        signedPolicyPackageVerified: true,
        identicalCaseSetApplied: true,
        passedCases: 22,
        failedCases: 0
      });
      expect(report.cases.every((item) => item.passed)).toBe(true);
      expect(report.reportHash).toMatch(/^[0-9a-f]{64}$/u);
      expect(suite.verify(report)).toBe(true);
    }
  );

  it('covers every canonical application identity exactly once', () => {
    expect(POLICY_CONFORMANCE_TARGET_PROFILES).toHaveLength(14);
    expect(new Set(POLICY_CONFORMANCE_TARGET_PROFILES.map((target) => target.applicationId)).size).toBe(14);
  });

  it('keeps the Windows desktop and core service as the only deployed runtime targets', () => {
    expect(POLICY_CONFORMANCE_TARGET_PROFILES.filter((target) => target.deploymentState === 'DEPLOYED').map((target) => target.applicationId))
      .toEqual(['windows-desktop', 'windows-core-service']);
  });

  it('keeps undeployed Apple clients profile-only without claiming native execution', () => {
    const apple = POLICY_CONFORMANCE_TARGET_PROFILES.filter((target) => ['MACOS', 'IOS', 'IPADOS', 'APPLE_ADJACENT'].includes(target.platformGroup));
    expect(apple).toHaveLength(5);
    expect(apple.every((target) => target.deploymentState === 'NOT_DEPLOYED' && target.nativeRuntimeExecution === 'PROFILE_ONLY')).toBe(true);
  });

  it('rejects a target descriptor whose deployment truth was altered', () => {
    const target = POLICY_CONFORMANCE_TARGET_PROFILES[3]!;
    const kernel = kernelFor(target.applicationId);
    expect(() => new PlatformPolicyConformanceSuite().run({
      target: { ...target, deploymentState: 'DEPLOYED' },
      kernel,
      baselineRequest: baselineFor(target.applicationId, kernel)
    })).toThrow('POLICY_CONFORMANCE_TARGET_PROFILE_MISMATCH');
  });

  it('rejects a baseline bound to another application identity', () => {
    const target = POLICY_CONFORMANCE_TARGET_PROFILES[0]!;
    const kernel = kernelFor(target.applicationId);
    const baseline = baselineFor(target.applicationId, kernel);
    expect(() => new PlatformPolicyConformanceSuite().run({
      target,
      kernel,
      baselineRequest: { ...baseline, subject: { ...baseline.subject, applicationId: 'macos-companion' } }
    })).toThrow('POLICY_CONFORMANCE_BASELINE_APPLICATION_MISMATCH');
  });

  it('rejects a baseline that omits strict policy package binding', () => {
    const target = POLICY_CONFORMANCE_TARGET_PROFILES[0]!;
    const kernel = kernelFor(target.applicationId);
    const baseline = baselineFor(target.applicationId, kernel);
    const { policyPackageSha256: _policyPackageSha256, ...unbound } = baseline;
    expect(() => new PlatformPolicyConformanceSuite().run({ target, kernel, baselineRequest: unbound }))
      .toThrow('POLICY_CONFORMANCE_BASELINE_BINDING_INVALID');
  });

  it('rejects a report whose case outcome was changed after execution', () => {
    const target = POLICY_CONFORMANCE_TARGET_PROFILES[0]!;
    const kernel = kernelFor(target.applicationId);
    const suite = new PlatformPolicyConformanceSuite();
    const report = suite.run({ target, kernel, baselineRequest: baselineFor(target.applicationId, kernel) });
    const cases = report.cases.map((item, index) => index === 0 ? { ...item, actualAllowed: false } : item);
    expect(suite.verify({ ...report, cases })).toBe(false);
  });

  it('publishes a content-free boundary snapshot with exact matrix counts', () => {
    expect(new PlatformPolicyConformanceSuite().snapshot()).toMatchObject({
      suiteVersion: 'PPK-020-V1',
      enforcement: 'fail-closed',
      targetCount: 14,
      caseCount: 22,
      totalMatrixAssertions: 308,
      deployedRuntimeTargets: 2,
      profileOnlyTargets: 12,
      referenceHarnessGrantsRuntimeAuthority: false,
      nativeAppleRuntimeExecutionClaimed: false,
      nativeRuntimeValidationRequiredBeforeDeployment: true,
      payloadExposedToClient: false
    });
  });
});
