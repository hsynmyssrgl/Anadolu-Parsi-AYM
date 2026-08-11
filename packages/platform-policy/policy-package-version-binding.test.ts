import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  assertActivePlatformPolicyTransactionContext,
  platformPolicyContextHash,
  type PlatformPolicyPackage,
  type PlatformPolicyReceiptRecord,
  type PlatformPolicyRequest
} from './src/index.js';

const NOW = '2026-08-11T15:00:00.000Z';
const EXPIRES = '2026-08-11T16:00:00.000Z';
const APP_VERSION = 'desktop-4.8.2026';
const KEY = Buffer.alloc(32, 7);
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const kernel = (): PlatformPolicyKernel => new PlatformPolicyKernel({
  policyVersion: 'PPK-007',
  policyPackageVersion: 7,
  signingKey: KEY,
  applicationVersions: { 'windows-desktop': APP_VERSION },
  applicationCapabilities: { 'windows-desktop': ['family.write', 'family.read'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['delete', 'create', 'update']
});

const request = (overrides: Partial<PlatformPolicyRequest> = {}): PlatformPolicyRequest => {
  const policyPackage = kernel().policyPackage;
  return {
    correlationId: 'corr-32-c-ppk-007',
    policyVersion: 'PPK-007',
    policyPackageVersion: policyPackage.payload.packageVersion,
    policyPackageSha256: policyPackage.payloadSha256,
    subject: {
      accountId: 'account-32-c', personId: 'person-32-c', deviceId: 'device-32-c',
      applicationId: 'windows-desktop', applicationVersion: APP_VERSION,
      deviceTrusted: true, membershipActive: true, roles: ['adult_member'],
      familyIds: ['family-32-c'], householdIds: [], familyBranchIds: []
    },
    resource: {
      type: 'family_profile', id: 'profile-32-c', familyId: 'family-32-c',
      ownerPersonId: 'person-32-c', sensitivity: 'personal',
      dataClasses: ['personal'], classificationSource: 'declared'
    },
    action: 'read', capability: 'family.read', purpose: 'family-administration',
    occurredAt: NOW, online: true, clusterWritable: true, enforcementMode: 'strict',
    ...overrides
  };
};

describe('32-C PPK-007 signed versioned policy package binding', () => {
  it('builds one deterministic package independent of unordered rule input', () => {
    const first = kernel().policyPackage;
    const second = new PlatformPolicyKernel({
      policyVersion: 'PPK-007', policyPackageVersion: 7, signingKey: KEY,
      applicationVersions: { 'windows-desktop': APP_VERSION },
      applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write'] },
      consentRequiredCapabilities: [], onlineOnlyCapabilities: [],
      writeActions: ['create', 'update', 'delete']
    }).policyPackage;
    expect(second).toEqual(first);
    expect(first.payload.applicationCapabilities['windows-desktop']).toEqual(['family.read', 'family.write']);
  });

  it('publishes a frozen SHA-256-bound HMAC-SHA-256 package that self-verifies', () => {
    const policyKernel = kernel();
    const policyPackage = policyKernel.policyPackage;
    expect(policyPackage).toMatchObject({
      payload: { schemaVersion: 1, packageVersion: 7, policyVersion: 'PPK-007' },
      signatureAlgorithm: 'HMAC-SHA256'
    });
    expect(policyPackage.payloadSha256).toBe(createHash('sha256').update(stable(policyPackage.payload), 'utf8').digest('hex'));
    expect(policyPackage.signature).toMatch(/^[0-9a-f]{64}$/u);
    expect(Object.isFrozen(policyPackage)).toBe(true);
    expect(policyKernel.verifyPolicyPackage(policyPackage)).toBe(true);
  });

  it('rejects a package whose signed payload was changed', () => {
    const policyKernel = kernel();
    const changed = {
      ...policyKernel.policyPackage,
      payload: { ...policyKernel.policyPackage.payload, policyVersion: 'PPK-007-tampered' }
    } as PlatformPolicyPackage;
    expect(policyKernel.verifyPolicyPackage(changed)).toBe(false);
  });

  it('rejects a package whose SHA-256 binding was changed', () => {
    const policyKernel = kernel();
    expect(policyKernel.verifyPolicyPackage({
      ...policyKernel.policyPackage,
      payloadSha256: '0'.repeat(64)
    })).toBe(false);
  });

  it('rejects a non-positive policy package version at composition time', () => {
    expect(() => new PlatformPolicyKernel({
      policyVersion: 'PPK-007', policyPackageVersion: 0, signingKey: KEY,
      applicationCapabilities: { 'windows-desktop': ['family.read'] },
      consentRequiredCapabilities: [], onlineOnlyCapabilities: [], writeActions: []
    })).toThrow(/policyPackageVersion/u);
  });

  it('binds an allowed decision and signed receipt to package and application versions', () => {
    const policyKernel = kernel();
    const authorization = policyKernel.authorizeWithReceipt(request(), NOW, 'nonce-32-c-valid');
    expect(authorization.decision).toMatchObject({
      allowed: true, policyPackageVersion: 7,
      policyPackageSha256: policyKernel.policyPackage.payloadSha256,
      applicationVersion: APP_VERSION
    });
    expect(policyKernel.verifyReceiptForRequest(authorization.receipt, request())).toBe(true);
  });

  it('denies a policy package version mismatch', () => {
    expect(kernel().evaluate(request({ policyPackageVersion: 8 }))).toMatchObject({
      allowed: false, reason: 'POLICY_PACKAGE_VERSION_MISMATCH'
    });
  });

  it('denies a policy package SHA-256 mismatch', () => {
    expect(kernel().evaluate(request({ policyPackageSha256: '0'.repeat(64) }))).toMatchObject({
      allowed: false, reason: 'POLICY_PACKAGE_HASH_MISMATCH'
    });
  });

  it('denies an application version mismatch', () => {
    const base = request();
    expect(kernel().evaluate(request({
      subject: { ...base.subject, applicationVersion: 'desktop-incompatible' }
    }))).toMatchObject({ allowed: false, reason: 'APPLICATION_VERSION_MISMATCH' });
  });

  it.each([
    ['package version', (base: PlatformPolicyRequest) => ({ ...base, policyPackageVersion: undefined })],
    ['package hash', (base: PlatformPolicyRequest) => ({ ...base, policyPackageSha256: undefined })],
    ['application version', (base: PlatformPolicyRequest) => ({ ...base, subject: { ...base.subject, applicationVersion: undefined } })]
  ])('rejects a strict request missing its %s binding', (_name, mutate) => {
    expect(kernel().evaluate(mutate(request()) as PlatformPolicyRequest)).toMatchObject({
      allowed: false, reason: 'INVALID_REQUEST'
    });
  });

  it('changes the signed context hash for package or application version changes', () => {
    const base = request();
    const hashes = [
      platformPolicyContextHash(base),
      platformPolicyContextHash({ ...base, policyPackageVersion: 8 }),
      platformPolicyContextHash({ ...base, policyPackageSha256: '0'.repeat(64) }),
      platformPolicyContextHash({ ...base, subject: { ...base.subject, applicationVersion: 'other' } })
    ];
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it('rejects a receipt whose package-bound decision was replaced', () => {
    const policyKernel = kernel();
    const authorization = policyKernel.authorizeWithReceipt(request(), NOW, 'nonce-32-c-tamper');
    const decision = { ...authorization.decision, policyPackageSha256: '0'.repeat(64) };
    expect(policyKernel.verifyReceipt({ ...authorization.receipt, decision })).toBe(false);
  });

  it('fails closed when a provider authority omits package bindings', async () => {
    const pep = new PlatformPolicyEnforcementPoint({
      provider: { authorize: () => { throw new Error('must not be called'); }, verify: () => false },
      authorityResolver: { resolve: () => ({
        policyVersion: 'PPK-007', accountId: 'account-32-c', deviceId: 'device-32-c',
        applicationId: 'windows-desktop', deviceTrusted: true, membershipActive: true,
        roles: ['adult_member'], familyIds: ['family-32-c'], online: true, expiresAt: EXPIRES
      }) },
      resourceResolver: { resolve: () => { throw new Error('must not be called'); } },
      receiptSink: { append: () => undefined }, clock: () => NOW
    });
    await expect(pep.execute({
      correlationId: 'corr-missing-package', action: 'read', capability: 'family.read',
      resourceType: 'family_profile', resourceId: 'profile-32-c', purpose: 'family-administration'
    }, () => ({ writable: true, epoch: 72 }), () => undefined)).rejects.toMatchObject({ code: 'AUTHORITY_INVALID' });
  });

  it('blocks a provider package mismatch before persistence and operation execution', async () => {
    const policyKernel = kernel();
    let persisted = 0;
    let executed = 0;
    const pep = new PlatformPolicyEnforcementPoint({
      provider: {
        authorize: ({ request: effectiveRequest, nonce }) => {
          const issued = policyKernel.authorizeWithReceipt(effectiveRequest, NOW, nonce);
          const decision = Object.freeze({ ...issued.decision, policyPackageVersion: 8 });
          return { effectiveRequest, authorization: { decision, receipt: { ...issued.receipt, decision } } };
        },
        verify: () => true
      },
      authorityResolver: { resolve: () => ({
        policyVersion: 'PPK-007', policyPackageVersion: 7,
        policyPackageSha256: policyKernel.policyPackage.payloadSha256,
        accountId: 'account-32-c', personId: 'person-32-c', deviceId: 'device-32-c',
        applicationId: 'windows-desktop', applicationVersion: APP_VERSION,
        deviceTrusted: true, membershipActive: true, roles: ['adult_member'],
        familyIds: ['family-32-c'], online: true, expiresAt: EXPIRES
      }) },
      resourceResolver: { resolve: () => request().resource },
      receiptSink: { append: () => { persisted += 1; } }, replayStore: { reserve: () => true },
      clock: () => NOW, nonceFactory: () => 'nonce-provider-mismatch'
    });
    await expect(pep.execute({
      correlationId: 'corr-provider-mismatch', action: 'read', capability: 'family.read',
      resourceType: 'family_profile', resourceId: 'profile-32-c', purpose: 'family-administration'
    }, () => ({ writable: true, epoch: 72 }), () => { executed += 1; })).rejects.toMatchObject({ code: 'RECEIPT_VERIFICATION_FAILED' });
    expect({ persisted, executed }).toEqual({ persisted: 0, executed: 0 });
  });

  it('fills a local-kernel authority from the verified package and persists the exact binding', async () => {
    const policyKernel = kernel();
    let persisted: PlatformPolicyReceiptRecord | undefined;
    const pep = new PlatformPolicyEnforcementPoint({
      kernel: policyKernel,
      authorityResolver: { resolve: () => ({
        policyVersion: 'PPK-007', accountId: 'account-32-c', personId: 'person-32-c', deviceId: 'device-32-c',
        applicationId: 'windows-desktop', deviceTrusted: true, membershipActive: true,
        roles: ['adult_member'], familyIds: ['family-32-c'], online: true, expiresAt: EXPIRES
      }) },
      resourceResolver: { resolve: () => request().resource },
      receiptSink: { append: (record) => { persisted = record; } },
      replayStore: { reserve: () => true }, clock: () => NOW, nonceFactory: () => 'nonce-local-package'
    });
    await expect(pep.execute({
      correlationId: 'corr-local-package', action: 'read', capability: 'family.read',
      resourceType: 'family_profile', resourceId: 'profile-32-c', purpose: 'family-administration'
    }, () => ({ writable: true, epoch: 72 }), (context) => {
      assertActivePlatformPolicyTransactionContext(context);
      expect(context).toMatchObject({
        policyPackageVersion: 7,
        policyPackageSha256: policyKernel.policyPackage.payloadSha256,
        applicationVersion: APP_VERSION
      });
      return 'executed';
    })).resolves.toBe('executed');
    expect(persisted).toMatchObject({
      policyPackageVersion: 7,
      policyPackageSha256: policyKernel.policyPackage.payloadSha256,
      applicationVersion: APP_VERSION
    });
  });
});
