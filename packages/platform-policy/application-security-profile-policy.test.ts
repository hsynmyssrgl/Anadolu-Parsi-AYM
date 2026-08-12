import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  APPLICATION_SECURITY_ASVS_BASELINE_CONTROLS,
  APPLICATION_SECURITY_MASVS_MOBILE_CONTROLS,
  APPLICATION_SECURITY_SSDF_BASELINE_PRACTICES,
  ApplicationSecurityProfilePolicy,
  PLATFORM_APPLICATION_IDS,
  applicationSecurityProfileManifestHash
} from './src/index.js';

const loadManifest = (): Record<string, any> =>
  JSON.parse(readFileSync('config/32-s-ppk-023-application-security-profile-manifest.json', 'utf8'));
const rebuilt = (mutate: (manifest: Record<string, any>) => void): Record<string, any> => {
  const manifest = loadManifest();
  mutate(manifest);
  manifest.manifestSha256 = applicationSecurityProfileManifestHash(manifest);
  return manifest;
};

describe('32-S PPK-023 application security profile policy', () => {
  it('verifies one exact threat-mapped profile for every canonical application', () => {
    const manifest = loadManifest();
    const policy = new ApplicationSecurityProfilePolicy();
    expect(policy.verifyManifest(manifest)).toBe(true);
    expect(manifest.profiles.map((profile: any) => profile.applicationId)).toEqual(PLATFORM_APPLICATION_IDS);
    for (const applicationId of PLATFORM_APPLICATION_IDS) {
      expect(policy.evaluate(applicationId, manifest)).toMatchObject({
        allowed: true,
        reason: 'ALLOW_MAPPED_PROFILE',
        applicationId,
        mappingClaimsCompliance: false,
        grantsRuntimeAuthority: false
      });
    }
  });

  it('pins versioned ASVS, MASVS and final SSDF control sets', () => {
    expect(APPLICATION_SECURITY_ASVS_BASELINE_CONTROLS).toHaveLength(21);
    expect(APPLICATION_SECURITY_ASVS_BASELINE_CONTROLS.every((id) => id.startsWith('v5.0.0-'))).toBe(true);
    expect(APPLICATION_SECURITY_MASVS_MOBILE_CONTROLS).toHaveLength(24);
    expect(APPLICATION_SECURITY_SSDF_BASELINE_PRACTICES).toEqual([
      'PO.1', 'PO.2', 'PO.3', 'PO.4', 'PO.5', 'PS.1', 'PS.2', 'PS.3',
      'PW.1', 'PW.2', 'PW.4', 'PW.5', 'PW.6', 'PW.7', 'PW.8', 'PW.9',
      'RV.1', 'RV.2', 'RV.3'
    ]);
  });

  it('rejects unknown applications and malformed manifests by default', () => {
    const policy = new ApplicationSecurityProfilePolicy();
    expect(policy.evaluate('future-unreviewed-app', loadManifest()))
      .toMatchObject({ allowed: false, reason: 'APPLICATION_UNKNOWN' });
    expect(policy.evaluate('windows-desktop', null))
      .toMatchObject({ allowed: false, reason: 'MALFORMED_MANIFEST' });
  });

  it('rejects a manifest hash mismatch before trusting mapped content', () => {
    const manifest = loadManifest();
    manifest.manifestSha256 = 'a'.repeat(64);
    expect(new ApplicationSecurityProfilePolicy().evaluate('windows-desktop', manifest))
      .toMatchObject({ allowed: false, reason: 'MANIFEST_HASH_MISMATCH' });
  });

  it('rejects missing, duplicate or falsely native-validated target profiles', () => {
    const policy = new ApplicationSecurityProfilePolicy();
    expect(policy.evaluate('windows-desktop', rebuilt((manifest) => manifest.profiles.pop())))
      .toMatchObject({ allowed: false, reason: 'MAPPING_INCOMPLETE' });
    expect(policy.evaluate('windows-desktop', rebuilt((manifest) => {
      manifest.profiles[13] = structuredClone(manifest.profiles[12]);
    }))).toMatchObject({ allowed: false, reason: 'MAPPING_INCOMPLETE' });
    expect(policy.evaluate('windows-cluster-agent', rebuilt((manifest) => {
      manifest.profiles[2].nativeRuntimeValidated = true;
    }))).toMatchObject({ allowed: false, reason: 'MAPPING_INCOMPLETE' });
  });

  it('requires explicit non-mobile MASVS rationale and complete mobile MASVS coverage', () => {
    const policy = new ApplicationSecurityProfilePolicy();
    expect(policy.evaluate('windows-desktop', rebuilt((manifest) => {
      manifest.assuranceProfiles[0].masvs.notApplicableReason = null;
    }))).toMatchObject({ allowed: false, reason: 'MAPPING_INCOMPLETE' });
    expect(policy.evaluate('ios-companion', rebuilt((manifest) => {
      manifest.assuranceProfiles[1].masvs.controlIds.pop();
    }))).toMatchObject({ allowed: false, reason: 'MAPPING_INCOMPLETE' });
  });

  it('rejects standard version drift and unreviewed extra manifest fields', () => {
    const policy = new ApplicationSecurityProfilePolicy();
    expect(policy.evaluate('windows-desktop', rebuilt((manifest) => {
      manifest.standards.asvs.version = '5.0.1';
    }))).toMatchObject({ allowed: false, reason: 'MAPPING_INCOMPLETE' });
    expect(policy.evaluate('windows-desktop', rebuilt((manifest) => {
      manifest.exception = 'temporary';
    }))).toMatchObject({ allowed: false, reason: 'MAPPING_INCOMPLETE' });
  });

  it('exposes only an exact content-free posture snapshot', () => {
    const policy = new ApplicationSecurityProfilePolicy();
    const snapshot = policy.snapshot();
    expect(policy.verifySnapshot(snapshot)).toBe(true);
    expect(policy.verifySnapshot({ ...snapshot, complianceClaimed: true })).toBe(false);
    expect(policy.verifySnapshot({ ...snapshot, threatModelPath: 'secret' })).toBe(false);
    expect(snapshot).toMatchObject({
      gateVersion: 'PPK-023-V1',
      canonicalApplicationCount: 14,
      mappedApplicationCount: 14,
      assuranceProfileCount: 2,
      threatModelCount: 14,
      mobileMasvsApplicationCount: 4,
      mappingClaimsCompliance: false,
      nativeRuntimeValidationClaimed: false,
      latestDatabaseMigration: 77
    });
  });
});
