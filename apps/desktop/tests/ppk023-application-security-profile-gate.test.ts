import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  evaluateApplicationSecurityProfileGate,
  runApplicationSecurityProfileGate
} from '../../../scripts/verify-application-security-profile-gate.mjs';

const manifest = () => JSON.parse(readFileSync('config/32-s-ppk-023-application-security-profile-manifest.json', 'utf8'));
const input = () => ({
  manifest: manifest(),
  threatModelBytes: readFileSync('docs/security/PPK-023_APPLICATION_SECURITY_PROFILES_THREAT_MODEL.md'),
  applicationIds: manifest().profiles.map((profile: any) => profile.applicationId),
  targetProfiles: JSON.parse(readFileSync('config/32-p-ppk-020-policy-conformance-target-inventory.json', 'utf8')).targets,
  workspacePaths: ['apps/core-service', 'apps/desktop']
});

describe('32-S PPK-023 fail-closed build profile gate', () => {
  it('passes the real kernel/workspace/profile/threat-model inventory with no finding', async () => {
    await expect(runApplicationSecurityProfileGate()).resolves.toMatchObject({
      status: 'PASS',
      canonicalApplications: 14,
      mappedApplications: 14,
      applicationWorkspaces: 2,
      assuranceProfiles: 2,
      threatModels: 14,
      mobileMasvsApplications: 4,
      asvsControls: 21,
      masvsControls: 24,
      ssdfPractices: 19,
      maliciousSelfTestAssertions: 17,
      benignSelfTestAssertions: 4,
      complianceClaimed: false,
      nativeRuntimeValidationClaimedForProfileOnlyTargets: false,
      findings: []
    });
  });

  it('rejects a newly discovered application without a mapped profile', () => {
    const candidate = input();
    candidate.applicationIds.push('unreviewed-app');
    expect(evaluateApplicationSecurityProfileGate(candidate).findings)
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'CANONICAL_TARGET_INVENTORY_MISMATCH' })]));
  });

  it('rejects threat-model byte tamper even when all profile identities remain present', () => {
    const candidate = input();
    candidate.threatModelBytes = Buffer.from(candidate.threatModelBytes.toString('utf8').replace('path swap', 'path swap tamper'));
    expect(evaluateApplicationSecurityProfileGate(candidate).findings)
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'THREAT_MODEL_BINDING_INVALID' })]));
  });

  it('rejects mobile MASVS omissions and non-mobile N/A without rationale', () => {
    const mobile = input();
    mobile.manifest.assuranceProfiles[1].masvs.controlIds.pop();
    expect(evaluateApplicationSecurityProfileGate(mobile).findings)
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'MANIFEST_HASH_MISMATCH' }), expect.objectContaining({ kind: 'ASSURANCE_PROFILE_INVALID' })]));
    const general = input();
    general.manifest.assuranceProfiles[0].masvs.notApplicableReason = null;
    expect(evaluateApplicationSecurityProfileGate(general).findings)
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'ASSURANCE_PROFILE_INVALID' })]));
  });
});
