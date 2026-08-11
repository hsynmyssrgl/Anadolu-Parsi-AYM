import { describe, expect, it } from 'vitest';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyAuthorityResolver,
  type PlatformPolicyReceiptSink,
  type PlatformPolicyReplayStore,
  type PlatformPolicyResourceResolver
} from './src/index.js';

const NOW = '2026-08-11T09:00:00.000Z';
const EXPIRES = '2026-08-11T10:00:00.000Z';
const intent = Object.freeze({
  correlationId: 'corr-31-y-ppk-003',
  action: 'read' as const,
  capability: 'family.read' as const,
  resourceType: 'desktop_ipc_endpoint',
  resourceId: 'dashboard:getOverview',
  purpose: 'administration'
});
const never = <T>(): Promise<T> => new Promise<T>(() => undefined);
const wait = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

const kernel = (): PlatformPolicyKernel => new PlatformPolicyKernel({
  policyVersion: 'PPK-003',
  signingKey: Buffer.alloc(32, 3),
  applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete']
});

const policyPackage = kernel().policyPackage;

const authorityResolver = (): PlatformPolicyAuthorityResolver => ({
  resolve: () => ({
    policyVersion: 'PPK-003',
    policyPackageVersion: policyPackage.payload.packageVersion,
    policyPackageSha256: policyPackage.payloadSha256,
    accountId: 'account-31-y',
    personId: 'person-31-y',
    deviceId: 'device-31-y',
    applicationId: 'windows-desktop',
    applicationVersion: 'v1',
    deviceTrusted: true,
    membershipActive: true,
    roles: ['adult_member'],
    familyIds: ['family-main'],
    online: true,
    expiresAt: EXPIRES
  })
});

const resourceResolver = (): PlatformPolicyResourceResolver => ({
  resolve: (resolvedIntent) => ({
    type: resolvedIntent.resourceType,
    id: resolvedIntent.resourceId,
    familyId: 'family-main',
    ownerPersonId: 'person-31-y',
    sensitivity: 'internal'
  })
});

interface HarnessOverrides {
  readonly authorityResolver?: PlatformPolicyAuthorityResolver;
  readonly resourceResolver?: PlatformPolicyResourceResolver;
  readonly replayStore?: PlatformPolicyReplayStore;
  readonly provider?: PlatformPolicyAuthorizationProvider;
  readonly receiptSink?: PlatformPolicyReceiptSink;
}

let nonceSequence = 0;
const createHarness = (overrides: HarnessOverrides = {}): PlatformPolicyEnforcementPoint => {
  const signingKernel = kernel();
  const provider: PlatformPolicyAuthorizationProvider = overrides.provider ?? {
    authorize: ({ request, nonce }) => ({
      effectiveRequest: request,
      authorization: signingKernel.authorizeWithReceipt(request, NOW, nonce)
    }),
    verify: ({ request, receipt }) => signingKernel.verifyReceiptForRequest(receipt, request)
  };
  return new PlatformPolicyEnforcementPoint({
    provider,
    authorityResolver: overrides.authorityResolver ?? authorityResolver(),
    resourceResolver: overrides.resourceResolver ?? resourceResolver(),
    replayStore: overrides.replayStore ?? { reserve: () => true },
    receiptSink: overrides.receiptSink ?? { append: () => undefined },
    clock: () => NOW,
    nonceFactory: () => `ppk-003-nonce-${++nonceSequence}`,
    decisionTimeoutMs: 15
  });
};

const expectUnavailable = async (
  enforcementPoint: PlatformPolicyEnforcementPoint,
  availabilityStage: string
): Promise<void> => {
  let operationExecuted = false;
  await expect(enforcementPoint.execute(intent, () => ({ writable: true, epoch: 31 }), () => {
    operationExecuted = true;
    return 'must-not-run';
  })).rejects.toMatchObject({
    code: 'POLICY_DECISION_UNAVAILABLE',
    availabilityStage
  });
  expect(operationExecuted).toBe(false);
};

describe('31-Y PPK-003 bounded default-deny policy decision availability', () => {
  it('executes only after every trusted decision dependency settles', async () => {
    await expect(createHarness().execute(
      intent,
      () => ({ writable: true, epoch: 31 }),
      () => 'authorized'
    )).resolves.toBe('authorized');
  });

  it('rejects an incomplete enforcement composition before use', () => {
    expect(() => new PlatformPolicyEnforcementPoint({
      provider: {} as PlatformPolicyAuthorizationProvider,
      authorityResolver: authorityResolver(),
      resourceResolver: resourceResolver(),
      receiptSink: { append: () => undefined }
    })).toThrowError(expect.objectContaining({ code: 'ENFORCEMENT_UNAVAILABLE' }));
  });

  it('fails closed when authority resolution never settles', async () => {
    await expectUnavailable(createHarness({ authorityResolver: { resolve: () => never() } }), 'AUTHORITY_RESOLUTION');
  });

  it('fails closed when resource resolution never settles', async () => {
    await expectUnavailable(createHarness({ resourceResolver: { resolve: () => never() } }), 'RESOURCE_RESOLUTION');
  });

  it('fails closed when replay reservation never settles', async () => {
    await expectUnavailable(createHarness({ replayStore: { reserve: () => never() } }), 'REPLAY_RESERVATION');
  });

  it('fails closed when policy authorization never settles', async () => {
    const signingKernel = kernel();
    await expectUnavailable(createHarness({
      provider: {
        authorize: () => never(),
        verify: ({ request, receipt }) => signingKernel.verifyReceiptForRequest(receipt, request)
      }
    }), 'POLICY_AUTHORIZATION');
  });

  it('fails closed when signed receipt verification never settles', async () => {
    const signingKernel = kernel();
    await expectUnavailable(createHarness({
      provider: {
        authorize: ({ request, nonce }) => ({
          effectiveRequest: request,
          authorization: signingKernel.authorizeWithReceipt(request, NOW, nonce)
        }),
        verify: () => never()
      }
    }), 'RECEIPT_VERIFICATION');
  });

  it('fails closed when mandatory receipt persistence never settles', async () => {
    await expectUnavailable(createHarness({ receiptSink: { append: () => never() } }), 'RECEIPT_PERSISTENCE');
  });

  it('does not execute after a timed-out provider returns a late allow decision', async () => {
    const signingKernel = kernel();
    let operationExecuted = false;
    const enforcementPoint = createHarness({
      provider: {
        authorize: async ({ request, nonce }) => {
          await wait(50);
          return {
            effectiveRequest: request,
            authorization: signingKernel.authorizeWithReceipt(request, NOW, nonce)
          };
        },
        verify: ({ request, receipt }) => signingKernel.verifyReceiptForRequest(receipt, request)
      }
    });
    await expect(enforcementPoint.execute(intent, () => ({ writable: true, epoch: 31 }), () => {
      operationExecuted = true;
    })).rejects.toMatchObject({
      code: 'POLICY_DECISION_UNAVAILABLE',
      availabilityStage: 'POLICY_AUTHORIZATION'
    });
    await wait(70);
    expect(operationExecuted).toBe(false);
  });
});
