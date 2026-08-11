import { describe, expect, it } from 'vitest';
import { CentralAuthorizationService, type AuthorizationGrant, type AuthorizationRequest } from '@ppt/security';
import {
  PlatformPolicyKernel,
  platformPolicyContextHash,
  type PlatformPolicyRequest,
  type PolicyGrant
} from '@ppt/platform-policy';

const NOW = '2026-08-11T16:00:00.000Z';

const centralGrant = (input: Partial<AuthorizationGrant> = {}): AuthorizationGrant => ({
  id: 'grant-32-g',
  subjectAccountId: 'account-32-g',
  resourceType: 'finance_record',
  resourceId: 'asset-shared',
  actions: ['read'],
  effect: 'allow',
  purpose: 'finance',
  familyBranchId: 'branch-main',
  ownershipBasisPoints: 4_000,
  startsAt: '2026-08-11T15:00:00.000Z',
  endsAt: '2026-08-11T17:00:00.000Z',
  ...input
});

const centralRequest = (input: Partial<AuthorizationRequest> = {}): AuthorizationRequest => ({
  accountId: 'account-32-g',
  role: 'limited_member',
  action: 'read',
  resourceType: 'finance_record',
  resourceId: 'asset-shared',
  occurredAt: NOW,
  purpose: 'finance',
  actorBranchIds: ['branch-main'],
  resourceBranchId: 'branch-main',
  minimumOwnershipBasisPoints: 2_500,
  grants: [centralGrant()],
  ...input
});

const platformKernel = (): PlatformPolicyKernel => new PlatformPolicyKernel({
  policyVersion: 'PPK-011',
  signingKey: Buffer.alloc(32, 11),
  applicationCapabilities: { 'windows-desktop': ['finance.read'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete']
});

const platformGrant = (input: Partial<PolicyGrant> = {}): PolicyGrant => ({
  id: 'platform-grant-32-g',
  subjectAccountId: 'account-32-g',
  resourceType: 'finance_record',
  resourceId: 'asset-shared',
  actions: ['read'],
  purposes: ['finance'],
  effect: 'allow',
  ownershipBasisPoints: 4_000,
  startsAt: '2026-08-11T15:00:00.000Z',
  endsAt: '2026-08-11T17:00:00.000Z',
  ...input
});

const platformRequest = (input: Partial<PlatformPolicyRequest> = {}): PlatformPolicyRequest => ({
  policyVersion: 'PPK-011',
  subject: {
    accountId: 'account-32-g', personId: 'person-member', deviceId: 'device-32-g',
    applicationId: 'windows-desktop', deviceTrusted: true, membershipActive: true,
    roles: ['limited_member'], familyIds: ['family-main'], householdIds: [], familyBranchIds: ['branch-main']
  },
  resource: {
    type: 'finance_record', id: 'asset-shared', familyId: 'family-main', familyBranchId: 'branch-main',
    ownerPersonId: 'person-owner', sensitivity: 'sensitive', dataClasses: ['finance'], classificationSource: 'declared'
  },
  action: 'read',
  capability: 'finance.read',
  purpose: 'finance',
  minimumOwnershipBasisPoints: 2_500,
  occurredAt: NOW,
  online: true,
  clusterWritable: true,
  grants: [platformGrant()],
  ...input
});

describe('32-G PPK-011 contextual authorization and ownership share', () => {
  const central = new CentralAuthorizationService();

  it('allows a central grant whose ownership share meets the required threshold', () => {
    expect(central.authorize(centralRequest())).toMatchObject({
      allowed: true, reason: 'explicit_allow', matchedGrantId: 'grant-32-g', matchedOwnershipBasisPoints: 4_000
    });
  });

  it('denies a central grant below the required ownership threshold', () => {
    expect(central.authorize(centralRequest({ minimumOwnershipBasisPoints: 5_000 }))).toMatchObject({
      allowed: false, reason: 'ownership_threshold'
    });
  });

  it('keeps an explicit denial above a qualifying ownership grant', () => {
    const denial = centralGrant({ id: 'deny-32-g', effect: 'deny', ownershipBasisPoints: undefined, denialReason: 'Ortak varlık erişimi açıkça reddedildi.' });
    expect(central.authorize(centralRequest({ grants: [centralGrant(), denial] }))).toMatchObject({
      allowed: false, reason: 'explicit_deny', matchedGrantId: 'deny-32-g'
    });
  });

  it('treats the exact resource owner as a full-share owner', () => {
    expect(central.authorize(centralRequest({ actorPersonId: 'person-owner', ownerPersonId: 'person-owner', grants: [] }))).toMatchObject({
      allowed: true, reason: 'owner', matchedOwnershipBasisPoints: 10_000
    });
  });

  it('does not activate an ownership grant outside its purpose, branch or time window', () => {
    expect(central.authorize(centralRequest({ purpose: 'health' }))).toMatchObject({ allowed: false });
    expect(central.authorize(centralRequest({ resourceBranchId: 'branch-other' }))).toMatchObject({ allowed: false });
    expect(central.authorize(centralRequest({ occurredAt: '2026-08-11T18:00:00.000Z' }))).toMatchObject({ allowed: false });
  });

  it('rejects an invalid central ownership threshold fail closed', () => {
    expect(central.authorize(centralRequest({ minimumOwnershipBasisPoints: 10_001 }))).toMatchObject({
      allowed: false, reason: 'ownership_threshold'
    });
  });

  it('allows a platform grant whose signed ownership share meets the threshold', () => {
    expect(platformKernel().evaluate(platformRequest())).toMatchObject({
      allowed: true, reason: 'ALLOW_POLICY', matchedGrantId: 'platform-grant-32-g', matchedOwnershipBasisPoints: 4_000
    });
  });

  it('denies a platform grant below the requested ownership share', () => {
    expect(platformKernel().evaluate(platformRequest({ minimumOwnershipBasisPoints: 5_000 }))).toMatchObject({
      allowed: false, reason: 'OWNERSHIP_SHARE_REQUIRED'
    });
  });

  it('keeps platform explicit denial above a qualifying ownership grant', () => {
    const denial = platformGrant({ id: 'platform-deny-32-g', effect: 'deny', ownershipBasisPoints: undefined });
    expect(platformKernel().evaluate(platformRequest({ grants: [platformGrant(), denial] }))).toMatchObject({
      allowed: false, reason: 'EXPLICIT_DENY', matchedGrantId: 'platform-deny-32-g'
    });
  });

  it('rejects an out-of-range platform ownership share as an invalid request', () => {
    expect(platformKernel().evaluate(platformRequest({ grants: [platformGrant({ ownershipBasisPoints: 10_001 })] }))).toMatchObject({
      allowed: false, reason: 'INVALID_REQUEST'
    });
  });

  it('rejects ownership metadata on a platform deny grant', () => {
    expect(platformKernel().evaluate(platformRequest({ grants: [platformGrant({ effect: 'deny', ownershipBasisPoints: 1_000 })] }))).toMatchObject({
      allowed: false, reason: 'INVALID_REQUEST'
    });
  });

  it('binds the requested ownership threshold into the signed context hash', () => {
    expect(platformPolicyContextHash(platformRequest())).not.toBe(
      platformPolicyContextHash(platformRequest({ minimumOwnershipBasisPoints: 2_501 }))
    );
  });
});
