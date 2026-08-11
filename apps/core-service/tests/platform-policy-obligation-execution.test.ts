import { describe, expect, it } from 'vitest';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  platformPolicyContextHash,
  type PlatformPolicyReceiptRecord,
  type PlatformPolicyTransactionContext
} from '@ppt/platform-policy';

const NOW = '2026-08-11T08:15:00.000Z';
const LATER = '2026-08-11T08:20:00.000Z';

const authorityResolver = {
  resolve: () => ({
    policyVersion: 'PPK-31-V',
    accountId: 'account-31-v',
    personId: 'person-31-v',
    deviceId: 'device-31-v',
    applicationId: 'windows-desktop' as const,
    deviceTrusted: true,
    membershipActive: true,
    roles: ['adult_member'],
    familyIds: ['family-31-v'],
    online: false,
    expiresAt: LATER
  })
};

const resourceResolver = {
  resolve: () => ({
    type: 'family_record',
    id: 'record-31-v',
    familyId: 'family-31-v',
    ownerPersonId: 'person-31-v',
    sensitivity: 'sensitive' as const
  })
};

describe('31-V strict policy obligation execution', () => {
  it('executes every signed obligation before the operation and binds the attestation to the receipt', async () => {
    const records: PlatformPolicyReceiptRecord[] = [];
    const pep = new PlatformPolicyEnforcementPoint({
      kernel: new PlatformPolicyKernel({
        policyVersion: 'PPK-31-V',
        signingKey: Buffer.alloc(32, 31),
        applicationCapabilities: { 'windows-desktop': ['family.read'] },
        consentRequiredCapabilities: [],
        onlineOnlyCapabilities: [],
        writeActions: ['create', 'update', 'delete']
      }),
      authorityResolver,
      resourceResolver,
      receiptSink: { append: (record) => { records.push(record); } },
      nonceFactory: () => 'nonce-31-v-obligations',
      clock: () => NOW
    });
    let captured: PlatformPolicyTransactionContext | undefined;
    const result = await pep.execute({
      correlationId: 'correlation-31-v',
      action: 'read',
      capability: 'family.read',
      resourceType: 'family_record',
      resourceId: 'record-31-v',
      purpose: 'family'
    }, () => ({ writable: true, epoch: 31 }), (context) => {
      captured = context;
      expect(context.decision.obligations.map((item) => item.type)).toEqual([
        'high_detail_audit', 'no_export', 'delete_after'
      ]);
      expect(context.obligationExecution.executed.map((item) => item.type)).toEqual([
        'high_detail_audit', 'no_export', 'delete_after'
      ]);
      expect(context.obligationExecution.controls).toMatchObject({
        highDetailAudit: true,
        allowExport: false,
        deleteAfter: 'retention:data-class:personal'
      });
      expect(context.receiptRecord.obligationExecution).toEqual(context.obligationExecution);
      expect(context.obligationExecution.attestationHash).toMatch(/^[0-9a-f]{64}$/u);
      return 'executed';
    });
    expect(result).toBe('executed');
    expect(records).toHaveLength(1);
    expect(records[0]?.obligationExecution).toEqual(captured?.obligationExecution);
  });

  it('fails closed when a provider emits an obligation that lacks transaction evidence', async () => {
    const providerKernel = new PlatformPolicyKernel({
      policyVersion: 'PPK-31-V', signingKey: Buffer.alloc(32, 31),
      applicationCapabilities: { 'windows-desktop': ['family.read'] },
      consentRequiredCapabilities: [], onlineOnlyCapabilities: [], writeActions: []
    });
    const pep = new PlatformPolicyEnforcementPoint({
      provider: {
        resolvePolicyPackage: () => providerKernel.policyPackage,
        authorize: ({ request, nonce }) => {
          const decision = Object.freeze({
            allowed: true,
            reason: 'ALLOW_POLICY' as const,
            policyVersion: 'PPK-31-V',
            policyPackageVersion: providerKernel.policyPackage.payload.packageVersion,
            policyPackageSha256: providerKernel.policyPackage.payloadSha256,
            applicationVersion: 'v1',
            capabilityManifestSha256: request.subject.capabilityManifestSha256,
            contextHash: platformPolicyContextHash(request),
            obligations: Object.freeze([{ type: 'strong_reauthentication' as const }])
          });
          return Object.freeze({
            effectiveRequest: request,
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
      authorityResolver,
      resourceResolver,
      receiptSink: { append: () => { throw new Error('MUST_NOT_PERSIST'); } },
      nonceFactory: () => 'nonce-31-v-strong-reauth',
      clock: () => NOW
    });
    await expect(pep.execute({
      correlationId: 'correlation-31-v-strong',
      action: 'read',
      capability: 'family.read',
      resourceType: 'family_record',
      resourceId: 'record-31-v',
      purpose: 'family'
    }, () => ({ writable: true, epoch: 31 }), () => 'must-not-run'))
      .rejects.toMatchObject({ code: 'OBLIGATION_EXECUTION_FAILED' });
  });
});
