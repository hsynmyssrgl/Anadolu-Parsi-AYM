import { describe, expect, it } from 'vitest';
import type { LocalGovernedOcrPolicyIntent } from '@ppt/application';
import {
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  ok
} from '@ppt/core';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider
} from '@ppt/platform-policy';
import type { LocalGovernedOcrProductionPolicyRuntimeDependencies } from '../src/main/timeline-production-policy-runtime.js';
import { createLocalGovernedOcrProductionPolicyEnforcementPointResolver } from '../src/main/timeline-production-policy-runtime.js';

const NOW = asIsoDateTime('2026-08-14T09:30:00.000Z');
const FAMILY = asFamilyId('family-33-q');
const PERSON = asPersonId('person-33-q');
const ACCOUNT = asUserId('account-33-q');
const CORRELATION = asCorrelationId('ocr-production-policy-runtime');
const SOURCE_ID = 'archive-source-33-q';
const JOB_ID = 'local-ocr-job-33-q';
const RESULT_ID = `${JOB_ID}:result`;

const kernel = new PlatformPolicyKernel({
  policyVersion: '33-q-production-runtime-v1',
  signingKey: Buffer.from('33-q-production-runtime-signing-key'),
  applicationCapabilities: {
    'windows-desktop': ['family.read', 'family.write', 'archive.ocr', 'archive.write']
  },
  consentRequiredCapabilities: ['archive.ocr'],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'process', 'record']
});

const provider: PlatformPolicyAuthorizationProvider = Object.freeze({
  resolvePolicyPackage: () => kernel.policyPackage,
  authorize: ({ request, nonce }) => Object.freeze({
    effectiveRequest: request,
    authorization: kernel.authorizeWithReceipt(request, request.occurredAt, nonce)
  }),
  verify: ({ request, receipt }) => kernel.verifyReceiptForRequest(receipt, request)
});

const context = Object.freeze({
  familyId: FAMILY,
  actor: Object.freeze({ userId: ACCOUNT, role: 'family_admin' as const, personId: PERSON }),
  correlationId: CORRELATION
});

const intent = (
  overrides: Partial<LocalGovernedOcrPolicyIntent> = {}
): LocalGovernedOcrPolicyIntent => Object.freeze({
  action: 'read',
  capability: 'archive.ocr',
  resourceType: 'archive_item',
  resourceId: SOURCE_ID,
  purpose: 'ocr_process',
  familyId: FAMILY,
  ownerPersonId: PERSON,
  privacy: 'private',
  sensitivity: 'sensitive',
  ...overrides
});

interface FixtureOptions {
  readonly consent?: boolean;
  readonly archiveAccountId?: string;
  readonly archiveOwnerPersonId?: string;
  readonly jobSourceResourceId?: string;
}

const fixture = (options: FixtureOptions = {}) => {
  const transactionState = { active: false, executeCalls: 0 };
  const policyTransactionRepository = {
    readJournalAnchor: () => ok(null),
    listPendingJournalProjections: () => ok([]),
    acknowledgeJournalProjection: () => ok(undefined),
    findReceiptByNonce: () => ok(null),
    synchronizeFence: (_context: unknown, input: unknown) => ok(input),
    pruneExpiredUnusedReplayReservations: () => ok(0),
    reserveReplayNonce: () => ok(true),
    recordAuthorizedTransaction: () => ok(undefined)
  };
  const consentLookups: Array<{ accountId: string; purpose: string; at: string }> = [];
  const archiveMetadata = Object.freeze({
    familyId: FAMILY,
    accountId: options.archiveAccountId ?? ACCOUNT,
    ownerPersonId: options.archiveOwnerPersonId ?? PERSON,
    revision: 1,
    stateFingerprint: 'a'.repeat(64),
    sensitivity: 'personal' as const,
    sourceResourceType: null,
    sourceResourceId: null,
    derivedResourceId: null
  });
  const dependencies = {
    transactionExecutor: {
      execute: (_correlationId: unknown, operation: (transaction: unknown) => unknown) => {
        transactionState.executeCalls += 1;
        if (transactionState.active) throw new Error('nested transaction was attempted');
        return operation({ transaction: {}, occurredAt: NOW });
      }
    },
    accountRepository: {
      findById: () => ok({
        id: ACCOUNT,
        displayName: 'Owner',
        email: 'owner@example.com',
        passwordRecord: 'protected',
        role: 'family_admin',
        status: 'active',
        personId: PERSON,
        startsAt: asIsoDateTime('2026-08-14T00:00:00.000Z'),
        failedLoginCount: 0,
        securityEpoch: 7,
        createdAt: NOW
      })
    },
    personRepository: {
      findById: () => ok({
        id: PERSON,
        familyId: FAMILY,
        displayName: 'Owner',
        relationshipType: 'self',
        generation: 0,
        branch: 'main',
        status: 'active',
        createdAt: NOW
      })
    },
    permissionRepository: { listActiveForSubject: () => ok([]) },
    trustedDeviceRepository: {
      findActive: () => ok({
        id: 'trusted-33-q',
        accountId: ACCOUNT,
        deviceId: 'device-33-q',
        displayName: 'Device',
        fingerprint: 'fingerprint-33-q',
        publicKeyPem: '-----BEGIN PUBLIC KEY-----\n33-q\n-----END PUBLIC KEY-----',
        trustedAt: asIsoDateTime('2026-08-14T08:00:00.000Z'),
        lastSeenAt: NOW,
        securityEpoch: 7
      })
    },
    timelinePolicyResourceRepository: { findTimelineEventForPolicyResolution: () => ok(null) },
    accessibilityPreferencesRepository: { findForPolicyResolution: () => ok(null) },
    formDraftRepository: { findForPolicyResolution: () => ok(null) },
    identityAccessCredentialRepository: { resolvePolicyResource: () => ok(null) },
    privacyOwnershipDataRightsRepository: { resolvePolicyResource: () => ok(null) },
    localGovernedOcrRepository: {
      resolvePolicyResource: (_execution: unknown, _key: unknown, resourceType: string, resourceId: string) => {
        if (resourceType === 'local_ocr_settings') return ok({
          familyId: FAMILY,
          accountId: ACCOUNT,
          ownerPersonId: PERSON,
          revision: 0,
          stateFingerprint: 'b'.repeat(64),
          sensitivity: 'personal' as const,
          sourceResourceType: null,
          sourceResourceId: null,
          derivedResourceId: null
        });
        if (resourceId !== JOB_ID) return ok(null);
        return ok({
          familyId: FAMILY,
          accountId: ACCOUNT,
          ownerPersonId: PERSON,
          revision: 4,
          stateFingerprint: 'c'.repeat(64),
          sensitivity: 'personal' as const,
          sourceResourceType: 'archive_item' as const,
          sourceResourceId: options.jobSourceResourceId ?? SOURCE_ID,
          derivedResourceId: RESULT_ID
        });
      },
      resolveArchivePolicyResource: (_execution: unknown, _key: unknown, resourceId: string) =>
        ok(resourceId === SOURCE_ID ? archiveMetadata : null)
    },
    aiConsentRepository: {
      listActive: (_execution: unknown, accountId: string, purpose: string, at: string) => {
        consentLookups.push({ accountId, purpose, at });
        return ok(options.consent === false ? [] : [{
          id: 'sensitive-processing-consent-33-q',
          accountId: ACCOUNT,
          purpose: 'sensitive_processing',
          resourceType: 'archive_item',
          resourceId: SOURCE_ID,
          status: 'granted',
          startsAt: asIsoDateTime('2026-08-14T08:30:00.000Z'),
          createdAt: asIsoDateTime('2026-08-14T08:30:00.000Z')
        }])
      }
    },
    deviceIdentityProvider: {
      snapshot: () => ({
        deviceId: 'device-33-q',
        fingerprint: 'fingerprint-33-q',
        publicKeyPem: '-----BEGIN PUBLIC KEY-----\n33-q\n-----END PUBLIC KEY-----'
      })
    },
    authorizationProvider: provider,
    receiptSink: {
      append: () => undefined,
      ensure: () => { throw new Error('projection is outside this authorization-only test'); },
      verifyProjectionProof: () => true
    },
    policyTransactionRepository,
    clusterFence: () => ({ writable: true, epoch: 94 }),
    policyVersion: '33-q-production-runtime-v1',
    clock: { now: () => NOW }
  };
  return {
    dependencies: dependencies as unknown as LocalGovernedOcrProductionPolicyRuntimeDependencies,
    consentLookups,
    transactionState
  };
};

const authorize = async (
  dependencies: LocalGovernedOcrProductionPolicyRuntimeDependencies,
  requestedIntent: LocalGovernedOcrPolicyIntent,
  options: { readonly sourceResourceId?: string } = {}
) => {
  const enforcementPoint = await createLocalGovernedOcrProductionPolicyEnforcementPointResolver(dependencies)
    .resolve(context, requestedIntent, { ...options, authorizationOccurredAt: () => NOW });
  return enforcementPoint.execute({
    correlationId: CORRELATION,
    action: requestedIntent.action,
    capability: requestedIntent.capability,
    resourceType: requestedIntent.resourceType,
    resourceId: requestedIntent.resourceId,
    purpose: requestedIntent.purpose
  }, () => ({ writable: true, epoch: 94 }), (authorization) => authorization);
};

describe('33-Q local governed OCR production central PEP', () => {
  it('uses authoritative archive metadata for source, absent-job create and derived target sensitivity', async () => {
    const sourceFixture = fixture();
    const source = await authorize(sourceFixture.dependencies, intent());
    expect(source).toMatchObject({
      resourceType: 'archive_item',
      resourceId: SOURCE_ID,
      capability: 'archive.ocr',
      action: 'read',
      purpose: 'ocr_process'
    });
    expect(source.receiptRecord.request.resource.sensitivity).toBe('personal');
    expect(source.decision.matchedConsentId).toBe('sensitive-processing-consent-33-q');

    const create = await authorize(sourceFixture.dependencies, intent({
      action: 'process',
      resourceType: 'local_ocr_job',
      resourceId: 'new-local-ocr-job-33-q'
    }), { sourceResourceId: SOURCE_ID });
    expect(create.receiptRecord.request.resource).toMatchObject({
      type: 'local_ocr_job',
      id: 'new-local-ocr-job-33-q',
      sensitivity: 'personal',
      sourceResourceId: SOURCE_ID
    });

    const target = await authorize(sourceFixture.dependencies, Object.freeze({
      ...intent({ action: 'process', resourceType: 'local_ocr_result', resourceId: RESULT_ID }),
      sourceJobId: JOB_ID
    }));
    expect(target.receiptRecord.request.resource).toMatchObject({
      type: 'local_ocr_result',
      id: RESULT_ID,
      sensitivity: 'personal',
      sourceResourceId: SOURCE_ID
    });
    expect(sourceFixture.consentLookups.every((lookup) => lookup.purpose === 'sensitive_processing')).toBe(true);
  });

  it('preserves an existing job source and rejects caller source replacement', async () => {
    const exact = fixture();
    const authorization = await authorize(exact.dependencies, intent({
      action: 'process',
      resourceType: 'local_ocr_job',
      resourceId: JOB_ID
    }), { sourceResourceId: SOURCE_ID });
    expect(authorization.receiptRecord.request.resource.sourceResourceId).toBe(SOURCE_ID);

    await expect(authorize(exact.dependencies, intent({
      action: 'process',
      resourceType: 'local_ocr_job',
      resourceId: JOB_ID
    }), { sourceResourceId: 'archive-source-replacement' })).rejects.toThrow(/preserve|source|snapshot/u);
  });

  it('fails closed for missing exact consent and foreign archive account or owner metadata', async () => {
    await expect(authorize(fixture({ consent: false }).dependencies, intent()))
      .rejects.toThrow(/consent|snapshot/u);
    await expect(authorize(fixture({ archiveAccountId: 'foreign-account' }).dependencies, intent()))
      .rejects.toThrow(/ownership|snapshot/u);
    await expect(authorize(fixture({ archiveOwnerPersonId: 'foreign-person' }).dependencies, intent()))
      .rejects.toThrow(/ownership|snapshot/u);
  });

  it('persists replay reservations through the supplied active async transaction without nesting SQLite', async () => {
    const exact = fixture();
    const transaction = { transaction: {}, correlationId: CORRELATION, occurredAt: NOW } as never;
    const enforcementPoint = await createLocalGovernedOcrProductionPolicyEnforcementPointResolver(exact.dependencies)
      .resolve(context, intent(), {
        authorizationOccurredAt: () => NOW,
        authorizationTransaction: () => transaction
      });
    const callsBeforeAuthorization = exact.transactionState.executeCalls;
    exact.transactionState.active = true;
    try {
      const authorization = await enforcementPoint.execute({
        correlationId: CORRELATION,
        action: 'read',
        capability: 'archive.ocr',
        resourceType: 'archive_item',
        resourceId: SOURCE_ID,
        purpose: 'ocr_process'
      }, () => ({ writable: true, epoch: 94 }), (value) => value);
      expect(authorization.resourceId).toBe(SOURCE_ID);
    } finally {
      exact.transactionState.active = false;
    }
    expect(exact.transactionState.executeCalls).toBe(callsBeforeAuthorization);
  });
});
