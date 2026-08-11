import { describe, expect, it } from 'vitest';
import {
  PLATFORM_DATA_CLASSES,
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  assertActivePlatformPolicyTransactionContext,
  inferPlatformDataClasses,
  normalizePlatformDataClasses,
  platformPolicyContextHash,
  type PlatformDataClass,
  type PlatformPolicyReceiptRecord,
  type PlatformPolicyRequest
} from './src/index.js';

const NOW = '2026-08-11T12:00:00.000Z';
const baseRequest = (dataClasses: readonly PlatformDataClass[] = ['personal']): PlatformPolicyRequest => ({
  correlationId: `corr-32-a-${dataClasses.join('-')}`,
  policyVersion: 'PPK-005',
  subject: {
    accountId: 'account-32-a', personId: 'person-32-a', deviceId: 'device-32-a',
    applicationId: 'windows-desktop', deviceTrusted: true, membershipActive: true,
    roles: ['adult_member'], familyIds: ['family-32-a'], householdIds: [], familyBranchIds: []
  },
  resource: {
    type: 'family_record', id: `record-${dataClasses.join('-')}`, familyId: 'family-32-a',
    ownerPersonId: 'person-32-a', sensitivity: 'personal', dataClasses,
    classificationSource: 'declared'
  },
  action: 'read',
  capability: 'family.read',
  purpose: 'family-administration',
  occurredAt: NOW,
  online: true,
  clusterWritable: true,
  enforcementMode: 'strict'
});

const kernel = (): PlatformPolicyKernel => new PlatformPolicyKernel({
  policyVersion: 'PPK-005',
  signingKey: Buffer.alloc(32, 5),
  applicationCapabilities: {
    'windows-desktop': [
      'family.read', 'health.read', 'finance.read', 'location.read',
      'communication.message', 'ai.process', 'archive.read', 'cluster.admin'
    ]
  },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete']
});

describe('32-A PPK-005 complete platform data classification', () => {
  it('supports all ten accepted data classes as distinct signed context values', () => {
    expect(PLATFORM_DATA_CLASSES).toEqual([
      'general', 'personal', 'special', 'health', 'finance', 'child',
      'location', 'communication', 'biometric', 'legacy'
    ]);
    const decisions = PLATFORM_DATA_CLASSES.map((dataClass) => kernel().authorizeWithReceipt(
      baseRequest([dataClass]), NOW, `nonce-32-a-${dataClass}`
    ));
    expect(decisions.every((item) => item.decision.allowed)).toBe(true);
    expect(new Set(decisions.map((item) => item.decision.contextHash)).size).toBe(PLATFORM_DATA_CLASSES.length);
  });

  it.each([
    ['general', 'family.read', 'desktop_ipc_endpoint', ['general']],
    ['personal', 'archive.read', 'archive_item', ['personal']],
    ['special', 'ai.process', 'ai_job', ['special']],
    ['health', 'health.read', 'health_record', ['health']],
    ['finance', 'finance.read', 'finance_record', ['finance']],
    ['child', 'family.read', 'child_profile', ['child']],
    ['location', 'location.read', 'location', ['location']],
    ['communication', 'communication.message', 'communication_message', ['communication']],
    ['biometric', 'family.read', 'biometric_template', ['biometric']],
    ['legacy', 'family.read', 'digital_legacy_plan', ['legacy']]
  ] as const)('infers the %s class deterministically', (_name, capability, resourceType, expected) => {
    expect(inferPlatformDataClasses(capability, resourceType)).toEqual(expected);
  });

  it('normalizes multi-class data into one canonical, duplicate-free order', () => {
    expect(normalizePlatformDataClasses(['biometric', 'child', 'health'])).toEqual(['health', 'child', 'biometric']);
    expect(() => normalizePlatformDataClasses(['health', 'health'])).toThrow(TypeError);
  });

  it('fails closed when strict classification is missing', () => {
    const request = baseRequest();
    expect(kernel().evaluate({
      ...request,
      resource: { ...request.resource, dataClasses: undefined, classificationSource: undefined }
    } as PlatformPolicyRequest)).toMatchObject({ allowed: false, reason: 'INVALID_REQUEST' });
  });

  it('fails closed when the strict class set is not canonical', () => {
    expect(kernel().evaluate(baseRequest(['child', 'health']))).toMatchObject({
      allowed: false,
      reason: 'INVALID_REQUEST'
    });
  });

  it('fails closed for an unsupported classification source', () => {
    const request = baseRequest();
    expect(kernel().evaluate({
      ...request,
      resource: { ...request.resource, classificationSource: 'untrusted' }
    } as PlatformPolicyRequest)).toMatchObject({ allowed: false, reason: 'INVALID_REQUEST' });
  });

  it.each([
    ['health', 'location.read'],
    ['finance', 'health.read'],
    ['location', 'finance.read'],
    ['communication', 'location.read']
  ] as const)('rejects %s data on an incompatible %s capability', (dataClass, capability) => {
    const request = baseRequest([dataClass]);
    expect(kernel().evaluate({ ...request, capability })).toMatchObject({
      allowed: false,
      reason: 'DATA_CLASS_CAPABILITY_MISMATCH'
    });
  });

  it('applies no-AI and no-export controls to child data', () => {
    const decision = kernel().evaluate(baseRequest(['child']));
    expect(decision.allowed).toBe(true);
    expect(decision.obligations.map((item) => item.type)).toEqual(['high_detail_audit', 'no_ai', 'no_export']);
  });

  it('applies local-only, no-cache, no-clipboard, no-export and no-AI controls to biometric data', () => {
    const decision = kernel().evaluate(baseRequest(['biometric']));
    expect(decision.allowed).toBe(true);
    expect(decision.obligations.map((item) => item.type)).toEqual([
      'high_detail_audit', 'local_processing_only', 'no_cache', 'no_clipboard', 'no_export', 'no_ai'
    ]);
  });

  it('prevents legacy data export by signed obligation', () => {
    const decision = kernel().evaluate(baseRequest(['legacy']));
    expect(decision).toMatchObject({ allowed: true });
    expect(decision.obligations.map((item) => item.type)).toEqual(['high_detail_audit', 'no_export']);
  });

  it('infers combined child-health classification before authorization and persists it exactly', async () => {
    let persisted: PlatformPolicyReceiptRecord | undefined;
    const pep = new PlatformPolicyEnforcementPoint({
      kernel: kernel(),
      authorityResolver: { resolve: () => ({
        policyVersion: 'PPK-005', accountId: 'account-32-a', personId: 'person-32-a',
        deviceId: 'device-32-a', applicationId: 'windows-desktop', deviceTrusted: true,
        membershipActive: true, roles: ['adult_member'], familyIds: ['family-32-a'],
        householdIds: [], familyBranchIds: [], online: true,
        expiresAt: '2026-08-11T13:00:00.000Z'
      }) },
      resourceResolver: { resolve: () => ({
        type: 'child_health_record', id: 'child-health-32-a', familyId: 'family-32-a',
        ownerPersonId: 'person-32-a', sensitivity: 'highly_sensitive'
      }) },
      receiptSink: { append: (record) => { persisted = record; } },
      replayStore: { reserve: () => true },
      clock: () => NOW,
      nonceFactory: () => 'nonce-32-a-inferred'
    });
    const result = await pep.execute({
      correlationId: 'corr-32-a-inferred', action: 'read', capability: 'family.read',
      resourceType: 'child_health_record', resourceId: 'child-health-32-a', purpose: 'child-health-care'
    }, () => ({ writable: true, epoch: 70 }), (context) => {
      assertActivePlatformPolicyTransactionContext(context, {
        resourceType: 'child_health_record', resourceId: 'child-health-32-a', action: 'read',
        capability: 'family.read', dataClasses: ['health', 'child']
      });
      return context;
    });
    expect(result.dataClasses).toEqual(['health', 'child']);
    expect(result.receiptRecord.request.resource).toMatchObject({
      dataClasses: ['health', 'child'], classificationSource: 'policy_default'
    });
    expect(persisted?.dataClasses).toEqual(['health', 'child']);
    expect(result.contextHash).toBe(platformPolicyContextHash(result.receiptRecord.request));
  });

  it('preserves a declared multi-class authority after canonical normalization', async () => {
    const pep = new PlatformPolicyEnforcementPoint({
      kernel: kernel(),
      authorityResolver: { resolve: () => ({
        policyVersion: 'PPK-005', accountId: 'account-32-a', personId: 'person-32-a',
        deviceId: 'device-32-a', applicationId: 'windows-desktop', deviceTrusted: true,
        membershipActive: true, roles: ['adult_member'], familyIds: ['family-32-a'],
        online: true, expiresAt: '2026-08-11T13:00:00.000Z'
      }) },
      resourceResolver: { resolve: () => ({
        type: 'family_record', id: 'declared-32-a', familyId: 'family-32-a',
        ownerPersonId: 'person-32-a', sensitivity: 'highly_sensitive',
        dataClasses: ['biometric', 'health'], classificationSource: 'declared'
      }) },
      receiptSink: { append: () => undefined },
      replayStore: { reserve: () => true },
      clock: () => NOW,
      nonceFactory: () => 'nonce-32-a-declared'
    });
    const context = await pep.execute({
      correlationId: 'corr-32-a-declared', action: 'read', capability: 'family.read',
      resourceType: 'family_record', resourceId: 'declared-32-a', purpose: 'health-identity'
    }, () => ({ writable: true, epoch: 70 }), (value) => value);
    expect(context.dataClasses).toEqual(['health', 'biometric']);
    expect(context.receiptRecord.request.resource.classificationSource).toBe('declared');
  });
});
