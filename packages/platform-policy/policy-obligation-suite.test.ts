import { describe, expect, it } from 'vitest';
import {
  PPK006_POLICY_OBLIGATION_TYPES,
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  platformPolicyContextHash,
  type PlatformApplicationId,
  type PlatformCapability,
  type PlatformPolicyIntent,
  type PlatformPolicyReceiptRecord,
  type PlatformPolicyRequest,
  type PolicyAction,
  type PolicyObligation
} from './src/index.js';

const NOW = '2026-08-11T14:00:00.000Z';
const LATER = '2026-08-11T15:00:00.000Z';

const request = (overrides: Partial<PlatformPolicyRequest> = {}): PlatformPolicyRequest => ({
  correlationId: 'corr-32-b',
  policyVersion: 'PPK-006',
  subject: {
    accountId: 'account-32-b', personId: 'person-32-b', deviceId: 'device-32-b',
    applicationId: 'windows-desktop', deviceTrusted: true, membershipActive: true,
    roles: ['adult_member'], familyIds: ['family-32-b'], householdIds: [], familyBranchIds: []
  },
  resource: {
    type: 'special_record', id: 'record-32-b', familyId: 'family-32-b',
    ownerPersonId: 'person-32-b', sensitivity: 'highly_sensitive',
    dataClasses: ['special'], classificationSource: 'declared'
  },
  action: 'read', capability: 'family.read', purpose: 'family-administration',
  occurredAt: NOW, online: true, clusterWritable: true, enforcementMode: 'strict',
  ...overrides
});

const kernel = (): PlatformPolicyKernel => new PlatformPolicyKernel({
  policyVersion: 'PPK-006',
  signingKey: Buffer.alloc(32, 6),
  applicationCapabilities: {
    'windows-desktop': ['family.read', 'file.share', 'communication.record', 'ai.process']
  },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete']
});

const providerPep = (input: {
  obligation: PolicyObligation;
  capability?: PlatformCapability;
  action?: PolicyAction;
  applicationId?: PlatformApplicationId;
}) => {
  let persisted = 0;
  let executed = 0;
  const capability = input.capability ?? 'family.read';
  const action = input.action ?? 'read';
  const applicationId = input.applicationId ?? 'windows-desktop';
  const pep = new PlatformPolicyEnforcementPoint({
    provider: {
      authorize: ({ request: effectiveRequest, nonce }) => {
        const decision = Object.freeze({
          allowed: true,
          reason: 'ALLOW_POLICY' as const,
          policyVersion: 'PPK-006',
          contextHash: platformPolicyContextHash(effectiveRequest),
          obligations: Object.freeze([Object.freeze(input.obligation)])
        });
        return Object.freeze({
          effectiveRequest,
          authorization: Object.freeze({
            decision,
            receipt: Object.freeze({
              receiptVersion: 1 as const,
              requestHash: '1'.repeat(64),
              decision,
              issuedAt: NOW,
              nonce,
              signature: '2'.repeat(64)
            })
          })
        });
      },
      verify: () => true
    },
    authorityResolver: { resolve: () => ({
      policyVersion: 'PPK-006', accountId: 'account-32-b', personId: 'person-32-b',
      deviceId: 'device-32-b', applicationId, deviceTrusted: true, membershipActive: true,
      roles: ['adult_member'], familyIds: ['family-32-b'], householdIds: [], familyBranchIds: [],
      online: true, expiresAt: LATER
    }) },
    resourceResolver: { resolve: () => ({
      type: 'general_record', id: 'record-32-b', familyId: 'family-32-b',
      ownerPersonId: 'person-32-b', sensitivity: 'personal' as const,
      dataClasses: ['general'] as const, classificationSource: 'declared' as const
    }) },
    receiptSink: { append: () => { persisted += 1; } },
    replayStore: { reserve: () => true },
    clock: () => NOW,
    nonceFactory: () => `nonce-${input.obligation.type}-${capability}`
  });
  const intent: PlatformPolicyIntent = {
    correlationId: `corr-${input.obligation.type}-${capability}`,
    action,
    capability,
    resourceType: 'general_record',
    resourceId: 'record-32-b',
    purpose: 'family-administration'
  };
  return {
    run: () => pep.execute(intent, () => ({ writable: true, epoch: 71 }), () => {
      executed += 1;
      return 'executed';
    }),
    counts: () => ({ persisted, executed })
  };
};

describe('32-B PPK-006 complete policy obligation suite', () => {
  it('publishes the eight accepted PPK-006 obligation types', () => {
    expect(PPK006_POLICY_OBLIGATION_TYPES).toEqual([
      'mask_fields', 'local_processing_only', 'no_cache', 'no_export',
      'no_ai', 'no_recording', 'watermark', 'delete_after'
    ]);
  });

  it('emits the restrictive special-data obligation suite in canonical order', () => {
    const decision = kernel().evaluate(request());
    expect(decision.allowed).toBe(true);
    expect(decision.obligations).toEqual([
      { type: 'high_detail_audit' },
      { type: 'local_processing_only' },
      { type: 'no_cache' },
      { type: 'no_export' },
      { type: 'no_ai' },
      { type: 'no_recording' },
      { type: 'delete_after', value: 'retention:data-class:special' }
    ]);
  });

  it('binds a non-owner read mask to the sorted requested field set', () => {
    const base = request();
    const decision = kernel().evaluate(request({
      subject: { ...base.subject, personId: 'reader-32-b' },
      requestedFields: ['surname', 'birthDate'],
      grants: [{
        id: 'grant-32-b', subjectAccountId: 'account-32-b', resourceType: 'special_record',
        resourceId: 'record-32-b', actions: ['read'], effect: 'allow', startsAt: NOW
      }]
    }));
    expect(decision.allowed).toBe(true);
    expect(decision.obligations.find((item) => item.type === 'mask_fields')?.value)
      .toEqual(['birthDate', 'surname']);
  });

  it('uses a wildcard mask when a non-owner read has no field projection', () => {
    const base = request();
    const decision = kernel().evaluate(request({
      subject: { ...base.subject, personId: 'reader-32-b' },
      grants: [{
        id: 'grant-wildcard-32-b', subjectAccountId: 'account-32-b', resourceType: 'special_record',
        resourceId: 'record-32-b', actions: ['read'], effect: 'allow', startsAt: NOW
      }]
    }));
    expect(decision.obligations.find((item) => item.type === 'mask_fields')?.value).toEqual(['*']);
  });

  it('binds a share watermark to the signed policy version and correlation', () => {
    const base = request();
    const decision = kernel().evaluate(request({
      resource: { ...base.resource, type: 'family_file', dataClasses: ['personal'] },
      action: 'share', capability: 'file.share'
    }));
    expect(decision.allowed).toBe(true);
    expect(decision.obligations).toContainEqual({
      type: 'watermark', value: 'policy:PPK-006;correlation:corr-32-b'
    });
  });

  it('binds communication recording to the consent retention policy', () => {
    const base = request();
    const decision = kernel().evaluate(request({
      resource: { ...base.resource, type: 'communication_recording', dataClasses: ['communication'] },
      action: 'record', capability: 'communication.record'
    }));
    expect(decision.allowed).toBe(true);
    expect(decision.obligations).toContainEqual({ type: 'delete_after', value: 'retention:consent-policy' });
    expect(decision.obligations.some((item) => item.type === 'no_recording')).toBe(false);
  });

  it('executes and attests the complete restrictive control set before the callback', async () => {
    let record: PlatformPolicyReceiptRecord | undefined;
    const pep = new PlatformPolicyEnforcementPoint({
      kernel: kernel(),
      authorityResolver: { resolve: () => ({
        policyVersion: 'PPK-006', accountId: 'account-32-b', personId: 'person-32-b',
        deviceId: 'device-32-b', applicationId: 'windows-desktop', deviceTrusted: true,
        membershipActive: true, roles: ['adult_member'], familyIds: ['family-32-b'],
        householdIds: [], familyBranchIds: [], online: true, expiresAt: LATER
      }) },
      resourceResolver: { resolve: () => request().resource },
      receiptSink: { append: (value) => { record = value; } },
      replayStore: { reserve: () => true },
      clock: () => NOW,
      nonceFactory: () => 'nonce-32-b-complete-suite'
    });
    await expect(pep.execute({
      correlationId: 'corr-32-b', action: 'read', capability: 'family.read',
      resourceType: 'special_record', resourceId: 'record-32-b', purpose: 'family-administration'
    }, () => ({ writable: true, epoch: 71 }), (context) => {
      expect(context.obligationExecution.controls).toMatchObject({
        localProcessingOnly: true,
        allowCache: false,
        allowExport: false,
        allowAi: false,
        allowRecording: false,
        deleteAfter: 'retention:data-class:special'
      });
      expect(context.obligationExecution.executed).toHaveLength(context.decision.obligations.length);
      expect(context.obligationExecution.attestationHash).toMatch(/^[0-9a-f]{64}$/u);
      return 'executed';
    })).resolves.toBe('executed');
    expect(record?.obligationExecution?.attestationHash).toMatch(/^[0-9a-f]{64}$/u);
  });

  it.each([
    ['valued boolean control', { type: 'no_cache', value: 'invalid' }],
    ['non-canonical field mask', { type: 'mask_fields', value: ['z', 'a'] }],
    ['unbound watermark', { type: 'watermark', value: 'unbound' }],
    ['unsupported retention', { type: 'delete_after', value: 'delete-in-30-days' }]
  ] as const)('fails closed for %s', async (_name, obligation) => {
    const harness = providerPep({ obligation: obligation as PolicyObligation });
    await expect(harness.run()).rejects.toMatchObject({ code: 'OBLIGATION_EXECUTION_FAILED' });
    expect(harness.counts()).toEqual({ persisted: 0, executed: 0 });
  });

  it.each([
    ['no-export', { type: 'no_export' }, 'file.share', 'share', 'windows-desktop'],
    ['no-AI', { type: 'no_ai' }, 'ai.process', 'process', 'windows-desktop'],
    ['no-record', { type: 'no_recording' }, 'communication.record', 'record', 'windows-desktop'],
    ['local-only', { type: 'local_processing_only' }, 'family.read', 'read', 'communication-service']
  ] as const)('blocks a conflicting %s operation before persistence and execution', async (
    _name, obligation, capability, action, applicationId
  ) => {
    const harness = providerPep({
      obligation: obligation as PolicyObligation,
      capability: capability as PlatformCapability,
      action: action as PolicyAction,
      applicationId: applicationId as PlatformApplicationId
    });
    await expect(harness.run()).rejects.toMatchObject({ code: 'OBLIGATION_EXECUTION_FAILED' });
    expect(harness.counts()).toEqual({ persisted: 0, executed: 0 });
  });
});
