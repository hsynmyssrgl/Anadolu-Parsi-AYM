import { describe, expect, it } from 'vitest';
import {
  PlatformPolicyKernel,
  type PlatformPolicyRequest
} from '@ppt/platform-policy';
import { CoreServiceRuntime } from '../src/core-service-runtime.js';

const NOW = '2026-08-12T03:00:00.000Z';
const POLICY_VERSION = 'PPT-PLATFORM-POLICY-PPK-024-V1';

const kernel = (): PlatformPolicyKernel => new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  policyPackageVersion: 24,
  signingKey: Buffer.alloc(32, 24),
  decisionAuthorityId: 'windows-core-service',
  applicationVersions: { 'windows-desktop': 'v1', 'windows-core-service': 'v1' },
  applicationCapabilities: {
    'windows-desktop': ['family.read', 'family.write'],
    'windows-core-service': []
  },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete']
});

const request = (
  policyKernel: PlatformPolicyKernel,
  action: 'read' | 'update' = 'read'
): PlatformPolicyRequest => ({
  correlationId: `corr-ppk024-${action}`,
  policyVersion: POLICY_VERSION,
  policyPackageVersion: policyKernel.policyPackage.payload.packageVersion,
  policyPackageSha256: policyKernel.policyPackage.payloadSha256,
  decisionAuthorityId: 'windows-core-service',
  subject: {
    accountId: 'account-ppk024', personId: 'person-ppk024', deviceId: 'device-ppk024',
    applicationId: 'windows-desktop', applicationVersion: 'v1',
    capabilityManifestSha256: policyKernel.policyPackage.payload.applicationManifests['windows-desktop']!.capabilityManifestSha256,
    deviceTrusted: true, membershipActive: true, roles: ['adult_member'],
    familyIds: ['family-ppk024'], householdIds: [], familyBranchIds: []
  },
  resource: {
    type: 'desktop_ipc_endpoint', id: `resource-${action}`, familyId: 'family-ppk024',
    ownerPersonId: 'person-ppk024', sensitivity: 'internal', dataClasses: ['general'],
    classificationSource: 'declared'
  },
  purpose: 'administration',
  occurredAt: NOW,
  action,
  capability: action === 'read' ? 'family.read' : 'family.write',
  online: true,
  clusterWritable: true,
  requestedFields: [],
  enforcementMode: 'strict'
});

describe('32-T PPK-024 Core Service policy availability runtime', () => {
  it('denies authorization while the service is not ready', () => {
    const policyKernel = kernel();
    const runtime = new CoreServiceRuntime({ policyKernel, policyVersion: POLICY_VERSION, clock: () => NOW });
    expect(() => runtime.authorizeWithReceipt(request(policyKernel), 'nonce-starting'))
      .toThrowError(expect.objectContaining({ code: 'POLICY_DECISION_UNAVAILABLE' }));
    expect(runtime.verifyReceiptForRequest(request(policyKernel), {
      receiptVersion: 1, requestHash: '0'.repeat(64),
      decision: policyKernel.evaluate(request(policyKernel)), issuedAt: NOW,
      nonce: 'nonce-invalid', signature: '0'.repeat(64)
    })).toMatchObject({ valid: false, fence: { writable: false } });
  });

  it('attests a freshly self-verified signed package in ready state', () => {
    const policyKernel = kernel();
    const runtime = new CoreServiceRuntime({ policyKernel, policyVersion: POLICY_VERSION, clock: () => NOW });
    runtime.markReady('leader');
    expect(runtime.health()).toMatchObject({
      lifecycle: 'ready', writable: true, safeMode: false,
      policyPackageVerified: true, observedAt: NOW
    });
    expect(runtime.authorizeWithReceipt(request(policyKernel), 'nonce-ready').authorization.decision)
      .toMatchObject({ allowed: true, reason: 'ALLOW_POLICY' });
  });

  it('keeps verified degraded service read-only and signs the mutation denial', () => {
    const policyKernel = kernel();
    const runtime = new CoreServiceRuntime({ policyKernel, policyVersion: POLICY_VERSION, clock: () => NOW });
    runtime.markReady('leader');
    runtime.enterSafeMode('OPERATOR_SAFE_MODE');
    expect(runtime.health()).toMatchObject({
      lifecycle: 'degraded', writable: false, safeMode: true, policyPackageVerified: true
    });
    expect(runtime.authorizeWithReceipt(request(policyKernel, 'read'), 'nonce-read-only-read').authorization.decision)
      .toMatchObject({ allowed: true });
    expect(runtime.authorizeWithReceipt(request(policyKernel, 'update'), 'nonce-read-only-write').authorization.decision)
      .toMatchObject({ allowed: false, reason: 'CLUSTER_NOT_WRITABLE' });
  });

  it('denies after shutdown even when the package remains cryptographically valid', () => {
    const policyKernel = kernel();
    const runtime = new CoreServiceRuntime({ policyKernel, policyVersion: POLICY_VERSION, clock: () => NOW });
    runtime.markReady();
    runtime.beginShutdown();
    expect(() => runtime.authorize(request(policyKernel)))
      .toThrowError(expect.objectContaining({ code: 'POLICY_DECISION_UNAVAILABLE' }));
  });

  it('cannot enter ready state when kernel HMAC self-verification fails', () => {
    const valid = kernel();
    const invalid = {
      policyPackage: valid.policyPackage,
      applicationVersionFor: valid.applicationVersionFor.bind(valid),
      verifyPolicyPackage: () => false,
      evaluate: valid.evaluate.bind(valid),
      authorizeWithReceipt: valid.authorizeWithReceipt.bind(valid),
      verifyReceiptForRequest: valid.verifyReceiptForRequest.bind(valid)
    } as unknown as PlatformPolicyKernel;
    const runtime = new CoreServiceRuntime({ policyKernel: invalid, policyVersion: POLICY_VERSION, clock: () => NOW });
    runtime.markReady('leader');
    expect(runtime.health()).toMatchObject({
      lifecycle: 'degraded', writable: false, safeMode: true,
      policyPackageVerified: false, reasons: ['POLICY_PACKAGE_SIGNATURE_INVALID']
    });
    expect(() => runtime.authorizeWithReceipt(request(valid), 'nonce-invalid-package'))
      .toThrowError(expect.objectContaining({ code: 'POLICY_DECISION_UNAVAILABLE' }));
  });
});
