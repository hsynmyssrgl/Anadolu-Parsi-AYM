import { describe, expect, it } from 'vitest';
import {
  PLATFORM_APPLICATION_RUNTIME_CAPABILITY_REQUIREMENTS,
  PLATFORM_RUNTIME_CAPABILITIES,
  PlatformCapabilityManifestPolicy,
  PlatformPolicyKernel,
  assertPinnedBootstrapRuntimeCapability,
  createPlatformCapabilityManifestAuthority,
  platformCapabilityManifestHash,
  type PlatformApplicationIdentityManifest,
  type PlatformRuntimeCapabilityRequest
} from './src/index.js';

const NOW = '2026-08-12T00:00:00.000Z';
const kernel = () => new PlatformPolicyKernel({
  policyVersion: 'PPT-PLATFORM-POLICY-PPK022-TEST',
  signingKey: new Uint8Array(32).fill(9),
  policyPackageVersion: 22,
  decisionAuthorityId: 'windows-core-service',
  applicationVersions: {
    'windows-desktop': '1.0.0',
    'windows-core-service': '1.0.0'
  },
  applicationCapabilities: {
    'windows-desktop': ['family.read'],
    'windows-core-service': ['cluster.admin']
  },
  applicationRuntimeCapabilities: {
    'windows-desktop': PLATFORM_APPLICATION_RUNTIME_CAPABILITY_REQUIREMENTS['windows-desktop'],
    'windows-core-service': PLATFORM_APPLICATION_RUNTIME_CAPABILITY_REQUIREMENTS['windows-core-service']
  },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'share', 'record', 'administer']
});

const setup = () => {
  const policyKernel = kernel();
  const manifest = policyKernel.policyPackage.payload.applicationManifests['windows-desktop']!;
  const authority = createPlatformCapabilityManifestAuthority({
    source: 'core-service-kernel',
    policyPackageVerified: policyKernel.verifyPolicyPackage(policyKernel.policyPackage),
    policyPackageSha256: policyKernel.policyPackage.payloadSha256,
    manifest
  });
  const request = (capability: PlatformRuntimeCapabilityRequest['capability']): PlatformRuntimeCapabilityRequest => ({
    schemaVersion: 1,
    applicationId: 'windows-desktop',
    applicationVersion: manifest.applicationVersion,
    capabilityManifestSha256: manifest.capabilityManifestSha256,
    policyPackageSha256: policyKernel.policyPackage.payloadSha256,
    capability,
    occurredAt: NOW
  });
  return { policyKernel, manifest, authority, request, policy: new PlatformCapabilityManifestPolicy() };
};

const rebuiltManifest = (
  manifest: PlatformApplicationIdentityManifest,
  runtimeCapabilities: PlatformApplicationIdentityManifest['runtimeCapabilities']
): PlatformApplicationIdentityManifest => Object.freeze({
  ...manifest,
  runtimeCapabilities: Object.freeze([...runtimeCapabilities].sort()),
  capabilityManifestSha256: platformCapabilityManifestHash({
    applicationId: manifest.applicationId,
    applicationVersion: manifest.applicationVersion,
    capabilities: manifest.capabilities,
    runtimeCapabilities,
    deviceCertificateRequired: manifest.deviceCertificateRequired
  })
});

describe('32-R PPK-022 signed runtime capability manifest policy', () => {
  it('binds the seven-family runtime capability list into the signed application manifest hash', () => {
    const { policyKernel, manifest } = setup();
    expect(PLATFORM_RUNTIME_CAPABILITIES).toHaveLength(7);
    expect(manifest.runtimeCapabilities).toEqual(['file.access', 'network.access', 'ocr.process']);
    expect(manifest.capabilityManifestSha256).toBe(platformCapabilityManifestHash(manifest));
    expect(policyKernel.verifyPolicyPackage(policyKernel.policyPackage)).toBe(true);
  });

  it('allows only file and network capabilities declared by the exact signed manifest', () => {
    const { policy, authority, request } = setup();
    expect(policy.authorize(request('file.access'), authority)).toMatchObject({ allowed: true, reason: 'ALLOW_CAPABILITY' });
    expect(policy.authorize(request('network.access'), authority)).toMatchObject({ allowed: true, reason: 'ALLOW_CAPABILITY' });
    expect(policy.authorize(request('camera.access'), authority)).toMatchObject({ allowed: false, reason: 'CAPABILITY_NOT_DECLARED' });
  });

  it('rejects malformed, unverified and package-hash mismatched runtime authority', () => {
    const { policy, authority, request } = setup();
    expect(policy.authorize({}, authority)).toMatchObject({ allowed: false, reason: 'MALFORMED_REQUEST' });
    expect(policy.authorize(request('file.access'), { ...authority, policyPackageVerified: false }))
      .toMatchObject({ allowed: false, reason: 'POLICY_PACKAGE_UNVERIFIED' });
    expect(policy.authorize({ ...request('file.access'), policyPackageSha256: 'a'.repeat(64) }, authority))
      .toMatchObject({ allowed: false, reason: 'POLICY_PACKAGE_HASH_MISMATCH' });
  });

  it('rejects application, version and capability-manifest identity mismatches', () => {
    const { policy, authority, request } = setup();
    expect(policy.authorize({ ...request('file.access'), applicationId: 'windows-core-service' }, authority))
      .toMatchObject({ allowed: false, reason: 'APPLICATION_ID_MISMATCH' });
    expect(policy.authorize({ ...request('file.access'), applicationVersion: '2.0.0' }, authority))
      .toMatchObject({ allowed: false, reason: 'APPLICATION_VERSION_MISMATCH' });
    expect(policy.authorize({ ...request('file.access'), capabilityManifestSha256: 'b'.repeat(64) }, authority))
      .toMatchObject({ allowed: false, reason: 'CAPABILITY_MANIFEST_HASH_MISMATCH' });
  });

  it('requires exact startup coverage and rejects both missing and unexpected capability', () => {
    const { policy, authority, manifest } = setup();
    expect(policy.evaluateCoverage('windows-desktop', authority)).toMatchObject({ allowed: true, reason: 'ALLOW_CAPABILITY' });
    const missing = rebuiltManifest(manifest, ['file.access']);
    expect(policy.evaluateCoverage('windows-desktop', { ...authority, manifest: missing }))
      .toMatchObject({ allowed: false, reason: 'CAPABILITY_REQUIREMENT_MISSING' });
    const unexpected = rebuiltManifest(manifest, ['camera.access', 'file.access', 'network.access', 'ocr.process']);
    expect(policy.evaluateCoverage('windows-desktop', { ...authority, manifest: unexpected }))
      .toMatchObject({ allowed: false, reason: 'CAPABILITY_REQUIREMENT_UNEXPECTED' });
  });

  it('rejects tampered manifest payloads even if the authority boolean is set', () => {
    const { policy, authority, manifest, request } = setup();
    const tampered = { ...manifest, runtimeCapabilities: ['camera.access', ...manifest.runtimeCapabilities] };
    expect(policy.authorize(request('file.access'), { ...authority, manifest: tampered }))
      .toMatchObject({ allowed: false, reason: 'MALFORMED_AUTHORITY' });
  });

  it('rejects invalid runtime capability configuration before package creation', () => {
    expect(() => new PlatformPolicyKernel({
      policyVersion: 'PPT-PLATFORM-POLICY-PPK022-INVALID',
      signingKey: new Uint8Array(32).fill(1),
      applicationCapabilities: { 'windows-desktop': ['family.read'] },
      applicationRuntimeCapabilities: { 'windows-desktop': ['file.access', 'file.access'] },
      consentRequiredCapabilities: [], onlineOnlyCapabilities: [], writeActions: []
    })).toThrow('application runtime capability registry is invalid');
  });

  it('pins the pre-handshake Desktop file bootstrap and exposes only a content-free snapshot', () => {
    expect(() => assertPinnedBootstrapRuntimeCapability('windows-desktop', 'file.access')).not.toThrow();
    expect(() => assertPinnedBootstrapRuntimeCapability('windows-desktop', 'network.access')).not.toThrow();
    expect(() => assertPinnedBootstrapRuntimeCapability('windows-desktop', 'ocr.process'))
      .toThrow('BOOTSTRAP_RUNTIME_CAPABILITY_NOT_DECLARED');
    expect(() => assertPinnedBootstrapRuntimeCapability('windows-desktop', 'camera.access'))
      .toThrow('BOOTSTRAP_RUNTIME_CAPABILITY_NOT_DECLARED');
    const policy = new PlatformCapabilityManifestPolicy();
    const snapshot = policy.snapshot();
    expect(policy.verifySnapshot(snapshot)).toBe(true);
    expect(policy.verifySnapshot({ ...snapshot, runtimeAuthorityGranted: true })).toBe(false);
    expect(snapshot).toMatchObject({
      gateVersion: 'PPK-022-V1',
      protectedCapabilityCount: 7,
      canonicalApplicationCount: 14,
      exactAstSurfaceCount: 345,
      bootstrapNetworkCapabilityPinned: true,
      buildManifestAloneGrantsRuntimeAuthority: false,
      latestDatabaseMigration: 77
    });
  });

  it('never allows a capability from a signed but production-baseline-broadened manifest', () => {
    const { policy, authority, manifest, request } = setup();
    const broadened = rebuiltManifest(manifest, ['camera.access', 'file.access', 'network.access', 'ocr.process']);
    expect(policy.authorize({
      ...request('file.access'),
      capabilityManifestSha256: broadened.capabilityManifestSha256
    }, { ...authority, manifest: broadened }))
      .toMatchObject({ allowed: false, reason: 'CAPABILITY_REQUIREMENT_UNEXPECTED' });
  });
});
