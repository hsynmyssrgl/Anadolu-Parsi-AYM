import { describe, expect, it } from 'vitest';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  assertActivePlatformPolicyTransactionContext,
  platformPolicyContextHash,
  platformPolicyContextSnapshot,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyReceiptRecord,
  type PlatformPolicyRequest
} from './src/index.js';

const NOW = '2026-08-11T10:00:00.000Z';
const baseRequest = (): PlatformPolicyRequest => ({
  correlationId: 'corr-31-z-ppk-004',
  policyVersion: 'PPK-004',
  subject: {
    accountId: 'account-31-z',
    personId: 'person-owner',
    deviceId: 'device-31-z',
    applicationId: 'windows-desktop',
    deviceTrusted: true,
    membershipActive: true,
    roles: ['adult_member'],
    familyIds: ['family-main'],
    householdIds: ['household-main'],
    familyBranchIds: ['branch-main']
  },
  resource: {
    type: 'family_profile',
    id: 'profile-31-z',
    familyId: 'family-main',
    householdId: 'household-main',
    familyBranchId: 'branch-main',
    ownerPersonId: 'person-owner',
    sensitivity: 'personal'
  },
  action: 'read',
  capability: 'family.read',
  purpose: 'family-administration',
  occurredAt: NOW,
  online: true,
  clusterWritable: true,
  requestedFields: ['displayName'],
  enforcementMode: 'strict'
});

const kernel = (): PlatformPolicyKernel => new PlatformPolicyKernel({
  policyVersion: 'PPK-004',
  signingKey: Buffer.alloc(32, 4),
  applicationCapabilities: { 'windows-desktop': ['family.read'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete']
});

describe('31-Z PPK-004 complete policy context binding', () => {
  it('binds the complete validated context into the signed decision and receipt', () => {
    const request = baseRequest();
    const expected = platformPolicyContextHash(request);
    const authorization = kernel().authorizeWithReceipt(request, NOW, 'nonce-31-z-1');
    expect(expected).toMatch(/^[0-9a-f]{64}$/u);
    expect(platformPolicyContextSnapshot(request)).toMatchObject({
      correlationId: request.correlationId,
      subject: { accountId: 'account-31-z', deviceId: 'device-31-z', roles: ['adult_member'] },
      resource: { familyId: 'family-main', ownerPersonId: 'person-owner' },
      purpose: 'family-administration',
      occurredAt: NOW,
      action: 'read',
      capability: 'family.read'
    });
    expect(authorization.decision).toMatchObject({ allowed: true, contextHash: expected });
    expect(authorization.receipt.decision.contextHash).toBe(expected);
    expect(kernel().verifyReceiptForRequest(authorization.receipt, request)).toBe(true);
  });

  it('changes the binding when any user, device, application, scope, owner, purpose, time or operation field changes', () => {
    const request = baseRequest();
    const hashes = [
      platformPolicyContextHash(request),
      platformPolicyContextHash({ ...request, subject: { ...request.subject, accountId: 'account-other' } }),
      platformPolicyContextHash({ ...request, subject: { ...request.subject, deviceId: 'device-other' } }),
      platformPolicyContextHash({ ...request, subject: { ...request.subject, applicationId: 'windows-core-service' } }),
      platformPolicyContextHash({ ...request, subject: { ...request.subject, roles: ['family_admin'] } }),
      platformPolicyContextHash({ ...request, resource: { ...request.resource, familyId: 'family-other' } }),
      platformPolicyContextHash({ ...request, resource: { ...request.resource, householdId: 'household-other' } }),
      platformPolicyContextHash({ ...request, resource: { ...request.resource, familyBranchId: 'branch-other' } }),
      platformPolicyContextHash({ ...request, resource: { ...request.resource, ownerPersonId: 'person-other' } }),
      platformPolicyContextHash({ ...request, purpose: 'support' }),
      platformPolicyContextHash({ ...request, occurredAt: '2026-08-11T10:00:01.000Z' }),
      platformPolicyContextHash({ ...request, action: 'update' }),
      platformPolicyContextHash({ ...request, capability: 'family.write' })
    ];
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it.each([
    ['empty roles', (request: PlatformPolicyRequest) => ({ ...request, subject: { ...request.subject, roles: [] } })],
    ['missing family scope', (request: PlatformPolicyRequest) => ({ ...request, subject: { ...request.subject, familyIds: undefined } })],
    ['missing household scope', (request: PlatformPolicyRequest) => ({ ...request, subject: { ...request.subject, householdIds: undefined } })],
    ['missing family branch scope', (request: PlatformPolicyRequest) => ({ ...request, subject: { ...request.subject, familyBranchIds: undefined } })],
    ['missing purpose', (request: PlatformPolicyRequest) => ({ ...request, purpose: undefined })],
    ['missing correlation', (request: PlatformPolicyRequest) => ({ ...request, correlationId: undefined })]
  ])('fails closed for %s', (_name, mutate) => {
    expect(kernel().evaluate(mutate(baseRequest()) as PlatformPolicyRequest)).toMatchObject({
      allowed: false,
      reason: 'INVALID_REQUEST'
    });
  });

  it.each([
    ['family', (request: PlatformPolicyRequest) => ({ ...request, subject: { ...request.subject, familyIds: ['family-other'] } })],
    ['household', (request: PlatformPolicyRequest) => ({ ...request, subject: { ...request.subject, householdIds: ['household-other'] } })],
    ['family branch', (request: PlatformPolicyRequest) => ({ ...request, subject: { ...request.subject, familyBranchIds: ['branch-other'] } })]
  ])('denies a resource outside the %s authority scope', (_name, mutate) => {
    expect(kernel().evaluate(mutate(baseRequest()))).toMatchObject({
      allowed: false,
      reason: 'RESOURCE_SCOPE_DENIED'
    });
  });

  it('rejects a provider decision carrying a context hash that does not match the effective request', async () => {
    const signingKernel = kernel();
    let executed = false;
    const provider: PlatformPolicyAuthorizationProvider = {
      authorize: ({ request, nonce }) => {
        const issued = signingKernel.authorizeWithReceipt(request, NOW, nonce);
        const decision = Object.freeze({ ...issued.decision, contextHash: '0'.repeat(64) });
        return {
          effectiveRequest: request,
          authorization: {
            decision,
            receipt: Object.freeze({ ...issued.receipt, decision })
          }
        };
      },
      verify: () => true
    };
    const pep = new PlatformPolicyEnforcementPoint({
      provider,
      authorityResolver: { resolve: () => ({
        policyVersion: 'PPK-004', accountId: 'account-31-z', personId: 'person-owner',
        deviceId: 'device-31-z', applicationId: 'windows-desktop', deviceTrusted: true,
        membershipActive: true, roles: ['adult_member'], familyIds: ['family-main'],
        householdIds: ['household-main'], familyBranchIds: ['branch-main'], online: true,
        expiresAt: '2026-08-11T11:00:00.000Z'
      }) },
      resourceResolver: { resolve: () => baseRequest().resource },
      receiptSink: { append: () => undefined },
      replayStore: { reserve: () => true },
      clock: () => NOW,
      nonceFactory: () => 'nonce-31-z-provider'
    });
    await expect(pep.execute({
      correlationId: 'corr-31-z-ppk-004', action: 'read', capability: 'family.read',
      resourceType: 'family_profile', resourceId: 'profile-31-z', purpose: 'family-administration'
    }, () => ({ writable: true, epoch: 69 }), () => { executed = true; })).rejects.toMatchObject({
      code: 'RECEIPT_VERIFICATION_FAILED'
    });
    expect(executed).toBe(false);
  });

  it('carries the exact context through the active transaction and durable receipt record', async () => {
    let persisted: PlatformPolicyReceiptRecord | undefined;
    const pep = new PlatformPolicyEnforcementPoint({
      kernel: kernel(),
      authorityResolver: { resolve: () => ({
        policyVersion: 'PPK-004', accountId: 'account-31-z', personId: 'person-owner',
        deviceId: 'device-31-z', applicationId: 'windows-desktop', deviceTrusted: true,
        membershipActive: true, roles: ['adult_member'], familyIds: ['family-main'],
        householdIds: ['household-main'], familyBranchIds: ['branch-main'], online: true,
        expiresAt: '2026-08-11T11:00:00.000Z'
      }) },
      resourceResolver: { resolve: () => baseRequest().resource },
      receiptSink: { append: (record) => { persisted = record; } },
      replayStore: { reserve: () => true },
      clock: () => NOW,
      nonceFactory: () => 'nonce-31-z-context'
    });
    const result = await pep.execute({
      correlationId: 'corr-31-z-ppk-004', action: 'read', capability: 'family.read',
      resourceType: 'family_profile', resourceId: 'profile-31-z', purpose: 'family-administration'
    }, () => ({ writable: true, epoch: 69 }), (context) => {
      assertActivePlatformPolicyTransactionContext(context, {
        resourceType: 'family_profile', resourceId: 'profile-31-z', action: 'read', capability: 'family.read',
        resourceFamilyId: 'family-main', resourceHouseholdId: 'household-main',
        resourceFamilyBranchId: 'branch-main', resourceOwnerPersonId: 'person-owner',
        purpose: 'family-administration', occurredAt: NOW, contextHash: context.contextHash,
        fenceEpoch: 69, fenceWritable: true
      });
      return context;
    });
    expect(result.contextHash).toBe(platformPolicyContextHash(result.receiptRecord.request));
    expect(result.subject).toMatchObject({
      accountId: 'account-31-z', deviceId: 'device-31-z', applicationId: 'windows-desktop',
      roles: ['adult_member'], familyIds: ['family-main'], householdIds: ['household-main'],
      familyBranchIds: ['branch-main']
    });
    expect(persisted).toMatchObject({ contextHash: result.contextHash });
  });
});
