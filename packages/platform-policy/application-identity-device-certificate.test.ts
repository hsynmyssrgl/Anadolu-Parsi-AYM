import { describe, expect, it } from 'vitest';
import {
  createPlatformDeviceCertificate,
  platformCapabilityManifestHash,
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  verifyPlatformDeviceCertificate,
  type PlatformPolicyReceiptRecord,
  type PlatformPolicyRequest
} from './src/index.js';

const NOW = '2026-08-11T12:00:00.000Z';
const ISSUED = '2026-08-10T12:00:00.000Z';
const EXPIRES = '2026-08-11T13:00:00.000Z';
const FINGERPRINT = 'a'.repeat(64);

const kernel = (): PlatformPolicyKernel => new PlatformPolicyKernel({
  policyVersion: 'PPK-008',
  policyPackageVersion: 8,
  signingKey: Buffer.alloc(32, 8),
  applicationVersions: { 'windows-desktop': 'desktop-api-v8' },
  deviceCertificateRequiredApplications: ['windows-desktop'],
  applicationCapabilities: { 'windows-desktop': ['family.write', 'family.read'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete']
});

const certificate = (policyKernel = kernel()) => {
  const manifest = policyKernel.policyPackage.payload.applicationManifests['windows-desktop']!;
  return createPlatformDeviceCertificate({
    schemaVersion: 1,
    issuer: 'trusted-device-registry',
    deviceId: 'device-32-d',
    applicationId: 'windows-desktop',
    publicKeyFingerprintSha256: FINGERPRINT,
    capabilityManifestSha256: manifest.capabilityManifestSha256,
    issuedAt: ISSUED,
    expiresAt: EXPIRES
  });
};

const request = (policyKernel = kernel()): PlatformPolicyRequest => {
  const policyPackage = policyKernel.policyPackage;
  const manifest = policyPackage.payload.applicationManifests['windows-desktop']!;
  return {
    correlationId: 'corr-32-d-ppk-008',
    policyVersion: 'PPK-008',
    policyPackageVersion: 8,
    policyPackageSha256: policyPackage.payloadSha256,
    subject: {
      accountId: 'account-32-d', personId: 'person-32-d', deviceId: 'device-32-d',
      applicationId: 'windows-desktop', applicationVersion: 'desktop-api-v8',
      capabilityManifestSha256: manifest.capabilityManifestSha256,
      deviceCertificate: certificate(policyKernel), deviceTrusted: true, membershipActive: true,
      roles: ['family_admin'], familyIds: ['family-32-d'], householdIds: [], familyBranchIds: []
    },
    resource: {
      type: 'family_profile', id: 'profile-32-d', familyId: 'family-32-d',
      ownerPersonId: 'person-32-d', sensitivity: 'personal', dataClasses: ['personal'],
      classificationSource: 'declared'
    },
    action: 'read', capability: 'family.read', purpose: 'family-administration',
    occurredAt: NOW, online: true, clusterWritable: true, enforcementMode: 'strict'
  };
};

describe('32-D PPK-008 application identity, device certificate and capability manifest', () => {
  it('publishes a deterministic signed application manifest with canonical capabilities', () => {
    const first = kernel().policyPackage;
    const second = kernel().policyPackage;
    const manifest = first.payload.applicationManifests['windows-desktop']!;
    expect(first).toEqual(second);
    expect(manifest).toMatchObject({
      applicationId: 'windows-desktop', applicationVersion: 'desktop-api-v8',
      capabilities: ['family.read', 'family.write'], deviceCertificateRequired: true
    });
    expect(manifest.capabilityManifestSha256).toBe(platformCapabilityManifestHash(manifest));
  });

  it('rejects duplicate or unknown certificate application registrations', () => {
    const base = {
      policyVersion: 'PPK-008', signingKey: Buffer.alloc(32, 8),
      applicationCapabilities: { 'windows-desktop': ['family.read'] as const },
      consentRequiredCapabilities: [], onlineOnlyCapabilities: [], writeActions: []
    };
    expect(() => new PlatformPolicyKernel({
      ...base, deviceCertificateRequiredApplications: ['windows-desktop', 'windows-desktop']
    })).toThrow('device certificate application registry is invalid');
    expect(() => new PlatformPolicyKernel({
      ...base, deviceCertificateRequiredApplications: ['unknown-worker' as 'windows-desktop']
    })).toThrow('device certificate application registry is invalid');
  });

  it('verifies the exact trusted-device certificate binding', () => {
    const policyKernel = kernel();
    const manifest = policyKernel.policyPackage.payload.applicationManifests['windows-desktop']!;
    expect(verifyPlatformDeviceCertificate(certificate(policyKernel), {
      deviceId: 'device-32-d', applicationId: 'windows-desktop',
      capabilityManifestSha256: manifest.capabilityManifestSha256, occurredAt: NOW
    })).toBe(true);
  });

  it('rejects a mutated certificate hash', () => {
    const original = certificate();
    expect(verifyPlatformDeviceCertificate({ ...original, publicKeyFingerprintSha256: 'b'.repeat(64) }, {
      deviceId: original.deviceId, applicationId: original.applicationId,
      capabilityManifestSha256: original.capabilityManifestSha256, occurredAt: NOW
    })).toBe(false);
  });

  it('allows a strict request only with the registered manifest and certificate', () => {
    expect(kernel().evaluate(request())).toMatchObject({
      allowed: true, reason: 'ALLOW_POLICY',
      capabilityManifestSha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
      deviceCertificateSha256: expect.stringMatching(/^[0-9a-f]{64}$/u)
    });
  });

  it('denies a missing application manifest binding', () => {
    const policyKernel = kernel();
    const base = request(policyKernel);
    expect(policyKernel.evaluate({ ...base, subject: { ...base.subject, capabilityManifestSha256: undefined } }))
      .toMatchObject({ allowed: false, reason: 'APPLICATION_MANIFEST_MISMATCH' });
  });

  it('denies a missing device certificate', () => {
    const policyKernel = kernel();
    const base = request(policyKernel);
    expect(policyKernel.evaluate({ ...base, subject: { ...base.subject, deviceCertificate: undefined } }))
      .toMatchObject({ allowed: false, reason: 'DEVICE_CERTIFICATE_INVALID' });
  });

  it('denies an expired device certificate', () => {
    const policyKernel = kernel();
    const base = request(policyKernel);
    const expired = createPlatformDeviceCertificate({
      ...base.subject.deviceCertificate!, expiresAt: '2026-08-11T11:59:59.999Z'
    });
    expect(policyKernel.evaluate({ ...base, subject: { ...base.subject, deviceCertificate: expired } }))
      .toMatchObject({ allowed: false, reason: 'DEVICE_CERTIFICATE_INVALID' });
  });

  it('rejects a certificate bound to a different application manifest', () => {
    const original = certificate();
    const rebound = createPlatformDeviceCertificate({
      ...original, capabilityManifestSha256: 'c'.repeat(64)
    });
    const base = request();
    expect(kernel().evaluate({ ...base, subject: { ...base.subject, deviceCertificate: rebound } }))
      .toMatchObject({ allowed: false, reason: 'DEVICE_CERTIFICATE_INVALID' });
  });

  it('PEP mints the certificate from trusted-device registry facts and persists both hashes', async () => {
    const policyKernel = kernel();
    let persisted: PlatformPolicyReceiptRecord | undefined;
    const pep = new PlatformPolicyEnforcementPoint({
      kernel: policyKernel,
      authorityResolver: { resolve: () => ({
        policyVersion: 'PPK-008', accountId: 'account-32-d', personId: 'person-32-d',
        deviceId: 'device-32-d', applicationId: 'windows-desktop',
        devicePublicKeyFingerprintSha256: FINGERPRINT, deviceCertificateIssuedAt: ISSUED,
        deviceTrusted: true, membershipActive: true, roles: ['family_admin'],
        familyIds: ['family-32-d'], online: true, expiresAt: EXPIRES
      }) },
      resourceResolver: { resolve: () => request(policyKernel).resource },
      receiptSink: { append: (record) => { persisted = record; } },
      replayStore: { reserve: () => true }, clock: () => NOW,
      nonceFactory: () => 'nonce-32-d-ppk-008'
    });
    await expect(pep.execute({
      correlationId: 'corr-32-d-ppk-008', action: 'read', capability: 'family.read',
      resourceType: 'family_profile', resourceId: 'profile-32-d', purpose: 'family-administration'
    }, () => ({ writable: true, epoch: 73 }), (context) => {
      expect(context.capabilityManifestSha256).toMatch(/^[0-9a-f]{64}$/u);
      expect(context.deviceCertificateSha256).toMatch(/^[0-9a-f]{64}$/u);
      return 'executed';
    })).resolves.toBe('executed');
    expect(persisted?.request.subject.deviceCertificate).toMatchObject({
      issuer: 'trusted-device-registry', publicKeyFingerprintSha256: FINGERPRINT
    });
    expect(persisted?.capabilityManifestSha256).toBe(persisted?.decision.capabilityManifestSha256);
    expect(persisted?.deviceCertificateSha256).toBe(persisted?.decision.deviceCertificateSha256);
  });
});
