import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  asCorrelationId,
  asEventId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  ok,
  type AppError,
  type CorrelationId,
  type IsoDateTime,
  type Result
} from '@ppt/core';
import {
  CreateGovernedFamilyLocationUseCase,
  UpsertObjectPermissionUseCase,
  type AuthorizationAccountRecord,
  type AuthorizationApplicationContext,
  type AuthorizationUnitOfWork,
  type AuthorizationWriteScope,
  type LocationApplicationContext,
  type LocationPolicyIntent,
  type LocationUnitOfWork,
  type LocationWriteScope
} from '@ppt/application';
import type { DomainEvent } from '@ppt/events';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyRequest
} from '@ppt/platform-policy';
import type {
  AccountRepositoryPort,
  AccountRow,
  LocationPolicyResourceRecord,
  LocationPolicyResourceRepositoryPort,
  ObjectPermissionRepositoryPort,
  ObjectPermissionRow,
  PersonRecord,
  PersonRepositoryPort,
  PlatformPolicyTransactionReceiptRecord,
  PlatformPolicyTransactionRepositoryPort,
  TransactionContext,
  TransactionExecutor,
  TrustedDeviceRepositoryPort,
  TrustedDeviceRow
} from '@ppt/repository-contracts';
import {
  RepositoryBackedLocationPolicyTransactionRunner,
  locationCollectionReadIntent,
  locationExactReadIntent
} from '../src/main/location-application-adapter.js';
import { createLocationProductionPolicyEnforcementPointResolver } from '../src/main/location-production-policy-runtime.js';

const POLICY_VERSION = '30-z-location-policy-test-v1';
const initialNow = '2026-08-08T10:00:00.000Z';
const familyId = asFamilyId('family-location-test');
const actorAccountId = asUserId('location-owner-account');
const actorPersonId = asPersonId('location-owner-person');
const otherPersonId = asPersonId('location-other-person');
const deviceId = 'location-test-device';
const fingerprint = 'location-test-fingerprint';
const publicKeyPem = '-----BEGIN PUBLIC KEY-----\nlocation-test-key\n-----END PUBLIC KEY-----';

const context: LocationApplicationContext = Object.freeze({
  familyId,
  actor: Object.freeze({
    userId: actorAccountId,
    role: 'family_admin',
    personId: actorPersonId
  }),
  correlationId: asCorrelationId('location-policy-runtime-test')
});

const account: AccountRow = Object.freeze({
  id: actorAccountId,
  displayName: 'Konum Sahibi',
  email: 'location-owner@example.test',
  passwordRecord: 'not-used-by-policy-test',
  role: 'family_admin',
  status: 'active',
  personId: actorPersonId,
  startsAt: asIsoDateTime('2020-01-01T00:00:00.000Z'),
  endsAt: asIsoDateTime('2030-01-01T00:00:00.000Z'),
  failedLoginCount: 0,
  securityEpoch: 7,
  createdAt: asIsoDateTime('2020-01-01T00:00:00.000Z')
});

const people = new Map<string, PersonRecord>([
  [actorPersonId, Object.freeze({
    id: actorPersonId,
    familyId,
    displayName: 'Konum Sahibi',
    relationshipType: 'self',
    generation: 0,
    branch: 'main',
    status: 'active',
    createdAt: asIsoDateTime('2020-01-01T00:00:00.000Z')
  })],
  [otherPersonId, Object.freeze({
    id: otherPersonId,
    familyId,
    displayName: 'Diğer Üye',
    relationshipType: 'relative',
    generation: 0,
    branch: 'main',
    status: 'active',
    createdAt: asIsoDateTime('2020-01-01T00:00:00.000Z')
  })]
]);

const trustedDevice: TrustedDeviceRow = Object.freeze({
  id: 'trusted-location-device-row',
  accountId: actorAccountId,
  deviceId,
  displayName: 'Location test device',
  fingerprint,
  publicKeyPem,
  trustedAt: asIsoDateTime('2026-08-08T09:00:00.000Z'),
  lastSeenAt: asIsoDateTime('2026-08-08T09:59:00.000Z'),
  securityEpoch: account.securityEpoch
});

const projectionProof = (): PlatformPolicyJournalProjectionProof => Object.freeze({
  schemaVersion: 1,
  receiptHash: 'a'.repeat(64),
  recordHash: 'b'.repeat(64),
  receiptNonce: 'location-test-nonce',
  entrySequence: 1,
  entryHash: 'c'.repeat(64),
  headSequence: 1,
  headHash: 'c'.repeat(64),
  journalSizeBytes: 512,
  issuedAt: initialNow,
  proofMac: 'd'.repeat(64)
});

interface LocationRuntimeHarness {
  readonly runner: RepositoryBackedLocationPolicyTransactionRunner;
  readonly requests: PlatformPolicyRequest[];
  readonly receipts: Map<string, PlatformPolicyTransactionReceiptRecord>;
  setPermissions(rows: readonly ObjectPermissionRow[]): void;
  setNow(value: IsoDateTime): void;
  setAfterAuthorize(hook: (() => void) | undefined): void;
  setLocationResource(locationId: string, resource: LocationPolicyResourceRecord | undefined): void;
}

const createHarness = (): LocationRuntimeHarness => {
  let now = asIsoDateTime(initialNow);
  let permissions: readonly ObjectPermissionRow[] = [];
  let afterAuthorize: (() => void) | undefined;
  const requests: PlatformPolicyRequest[] = [];
  const receipts = new Map<string, PlatformPolicyTransactionReceiptRecord>();
  const replayNonces = new Set<string>();
  const locationResources = new Map<string, LocationPolicyResourceRecord>([
    ['other-location', Object.freeze({ id: 'other-location', familyId, ownerPersonId: otherPersonId, createReceiptHash: '1'.repeat(64) })],
    ['owner-location', Object.freeze({ id: 'owner-location', familyId, ownerPersonId: actorPersonId, createReceiptHash: '2'.repeat(64) })]
  ]);

  const transactionExecutor: TransactionExecutor = Object.freeze({
    execute<T>(correlationId: CorrelationId, operation: (context: TransactionContext) => Result<T, AppError>): Result<T, AppError> {
      return operation(Object.freeze({
        transaction: Object.freeze({}) as TransactionContext['transaction'],
        correlationId,
        occurredAt: now
      }));
    }
  });

  const accountRepository = Object.freeze({
    findById: () => ok(account)
  }) as unknown as AccountRepositoryPort;
  const personRepository = Object.freeze({
    findById: (_execution: unknown, personId: string) => ok(people.get(personId) ?? null)
  }) as unknown as PersonRepositoryPort;
  const permissionRepository = Object.freeze({
    listActiveForSubject: (_execution: unknown, subjectAccountId: string, occurredAt: IsoDateTime) => {
      const at = Date.parse(occurredAt);
      return ok(permissions.filter((row) =>
        row.subjectAccountId === subjectAccountId
        && Date.parse(row.startsAt) <= at
        && (!row.endsAt || Date.parse(row.endsAt) >= at)
      ));
    }
  }) as unknown as ObjectPermissionRepositoryPort;
  const trustedDeviceRepository = Object.freeze({
    findActive: () => ok(trustedDevice)
  }) as unknown as TrustedDeviceRepositoryPort;
  const locationPolicyResourceRepository = Object.freeze({
    findLocationForPolicyResolution: (_execution: unknown, locationId: string) => ok(locationResources.get(locationId) ?? null)
  }) as unknown as LocationPolicyResourceRepositoryPort;

  const policyTransactionRepository = Object.freeze({
    synchronizeFence: (_execution: unknown, input: { fenceName: string; epoch: number; writable: boolean; synchronizedAt: IsoDateTime }) => ok(input),
    pruneExpiredUnusedReplayReservations: (_execution: unknown, input: { cutoffMs: number }) => ok({
      cutoffMs: input.cutoffMs,
      prunedCount: 0,
      hasMore: false
    }),
    reserveReplayNonce: (_execution: unknown, input: { nonce: string }) => {
      if (replayNonces.has(input.nonce)) return ok(false);
      replayNonces.add(input.nonce);
      return ok(true);
    },
    recordAuthorizedTransaction: (_execution: unknown, input: {
      record: PlatformPolicyTransactionReceiptRecord['record'];
      fenceEpoch: number;
    }) => {
      const record = input.record;
      const persisted: PlatformPolicyTransactionReceiptRecord = Object.freeze({
        receiptHash: 'e'.repeat(64),
        receiptVersion: 1,
        requestHash: record.receipt.requestHash,
        nonce: record.receipt.nonce,
        correlationId: record.correlationId,
        policyVersion: record.request.policyVersion,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        action: record.action,
        capability: record.capability,
        fenceName: 'location-write',
        fenceEpoch: input.fenceEpoch,
        issuedAt: asIsoDateTime(record.receipt.issuedAt),
        recordedAt: asIsoDateTime(record.recordedAt),
        record
      });
      receipts.set(record.receipt.nonce, persisted);
      return ok(persisted);
    },
    readJournalAnchor: () => ok(undefined),
    listPendingJournalProjections: () => ok([]),
    acknowledgeJournalProjection: () => ok(true),
    findReceiptByNonce: (_execution: unknown, nonce: string) => ok(receipts.get(nonce))
  }) as unknown as PlatformPolicyTransactionRepositoryPort;

  const kernel = new PlatformPolicyKernel({
    policyVersion: POLICY_VERSION,
    signingKey: Buffer.from('30-z-location-controlled-signing-key-v1', 'utf8'),
    applicationCapabilities: {
      'windows-desktop': ['location.read', 'family.write']
    },
    consentRequiredCapabilities: [],
    onlineOnlyCapabilities: [],
    writeActions: ['create', 'update', 'delete', 'record']
  });
  const authorizationProvider: PlatformPolicyAuthorizationProvider = Object.freeze({
    resolvePolicyPackage: () => kernel.policyPackage,
    authorize({ request, nonce }: Parameters<PlatformPolicyAuthorizationProvider['authorize']>[0]) {
      requests.push(request);
      const authorization = kernel.authorizeWithReceipt(request, request.occurredAt, nonce);
      afterAuthorize?.();
      return Object.freeze({ effectiveRequest: request, authorization });
    },
    verify({ request, receipt }: Parameters<PlatformPolicyAuthorizationProvider['verify']>[0]) {
      return kernel.verifyReceiptForRequest(receipt, request);
    }
  });
  const clusterFence = () => Object.freeze({ writable: true, epoch: 66 });
  const policyEnforcementPointResolver = createLocationProductionPolicyEnforcementPointResolver({
    transactionExecutor,
    accountRepository,
    permissionRepository,
    trustedDeviceRepository,
    locationPolicyResourceRepository,
    personRepository,
    deviceIdentityProvider: Object.freeze({
      snapshot: () => Object.freeze({
        deviceId,
        fingerprint,
        publicKeyPem,
        createdAt: asIsoDateTime('2026-08-08T09:00:00.000Z')
      })
    }),
    authorizationProvider,
    receiptSink: Object.freeze({
      append: () => undefined,
      ensure: projectionProof,
      verifyProjectionProof: () => true
    }),
    policyTransactionRepository,
    clusterFence,
    policyVersion: POLICY_VERSION,
    clock: Object.freeze({ now: () => now })
  });
  const runner = new RepositoryBackedLocationPolicyTransactionRunner({
    transactionExecutor,
    locationRepository: Object.freeze({}) as never,
    personRepository,
    auditRepository: Object.freeze({}) as never,
    outboxRepository: Object.freeze({}) as never,
    policyEnforcementPointResolver,
    clusterFence
  });
  return {
    runner,
    requests,
    receipts,
    setPermissions: (rows) => { permissions = rows; },
    setNow: (value) => { now = value; },
    setAfterAuthorize: (hook) => { afterAuthorize = hook; },
    setLocationResource: (locationId, resource) => {
      if (resource) locationResources.set(locationId, resource);
      else locationResources.delete(locationId);
    }
  };
};

const finiteAllow = (endsAt = '2026-08-08T11:00:00.000Z'): ObjectPermissionRow => Object.freeze({
  id: 'finite-location-read',
  subjectAccountId: actorAccountId,
  resourceType: 'location',
  resourceId: 'other-location',
  actions: ['read'] as const,
  effect: 'allow',
  purpose: 'general',
  startsAt: asIsoDateTime('2026-08-08T09:00:00.000Z'),
  endsAt: asIsoDateTime(endsAt),
  createdAt: asIsoDateTime('2026-08-08T09:00:00.000Z')
});

describe('30-Z governed location policy runtime', () => {
  it('uses location.read with a fixed highly-sensitive collection envelope owned by the current person', async () => {
    const harness = createHarness();
    const result = await harness.runner.execute(context, locationCollectionReadIntent(), () => ok('opened'));

    expect(result).toEqual({ ok: true, value: 'opened' });
    expect(harness.requests).toHaveLength(1);
    expect(harness.requests[0]).toMatchObject({
      action: 'read',
      capability: 'location.read',
      purpose: 'general',
      resource: {
        type: 'location',
        id: '*',
        familyId,
        ownerPersonId: actorPersonId,
        sensitivity: 'highly_sensitive'
      }
    });
    expect([...harness.receipts.values()][0]).toMatchObject({
      resourceType: 'location',
      resourceId: '*',
      action: 'read',
      capability: 'location.read',
      fenceName: 'location-write',
      fenceEpoch: 66
    });
  });

  it('requires a finite explicit grant for a cross-owner exact read and honors expiry and revocation', async () => {
    const harness = createHarness();
    const intent = locationExactReadIntent('other-location');

    const withoutGrant = await harness.runner.execute(context, intent, () => ok('leaked'));
    expect(withoutGrant.ok).toBe(false);

    harness.setPermissions([finiteAllow()]);
    const allowed = await harness.runner.execute(context, intent, () => ok('visible'));
    expect(allowed).toEqual({ ok: true, value: 'visible' });

    harness.setNow(asIsoDateTime('2026-08-08T11:00:00.001Z'));
    const expired = await harness.runner.execute(context, intent, () => ok('expired-leak'));
    expect(expired.ok).toBe(false);

    harness.setNow(asIsoDateTime(initialNow));
    harness.setPermissions([]);
    const revoked = await harness.runner.execute(context, intent, () => ok('revoked-leak'));
    expect(revoked.ok).toBe(false);
  });

  it('fails closed for open-ended, branch-scoped or multi-action location permission rows', async () => {
    const { endsAt: _finiteEnd, ...openEndedAllow } = finiteAllow();
    const invalidRows: ObjectPermissionRow[] = [
      { ...openEndedAllow, id: 'open-ended' },
      { ...finiteAllow(), id: 'branch-scoped', familyBranchId: 'branch-a' as never },
      { ...finiteAllow(), id: 'multi-action', actions: ['read', 'create'] as never }
    ];

    for (const row of invalidRows) {
      const harness = createHarness();
      harness.setPermissions([row]);
      const result = await harness.runner.execute(context, locationExactReadIntent('other-location'), () => ok('invalid-grant-leak'));
      expect(result.ok).toBe(false);
    }
  });

  it('revalidates authority inside the transaction and blocks a grant revoked after receipt issuance', async () => {
    const harness = createHarness();
    harness.setPermissions([finiteAllow()]);
    let operationExecuted = false;
    harness.setAfterAuthorize(() => harness.setPermissions([]));

    const result = await harness.runner.execute(context, locationExactReadIntent('other-location'), () => {
      operationExecuted = true;
      return ok('should-not-commit');
    });

    expect(result.ok).toBe(false);
    expect(operationExecuted).toBe(false);
    expect(harness.receipts.size).toBe(0);
  });

  it('completes an anticipated exact read only when the created row carries the bound create receipt', async () => {
    const receiptHash = 'a'.repeat(64);
    const successful = createHarness();
    const intent: LocationPolicyIntent = Object.freeze({
      ...locationExactReadIntent('batch-created-location'),
      anticipatedCreate: Object.freeze({ ownerPersonId: actorPersonId, receiptHash })
    });

    const result = await successful.runner.execute(context, intent, () => {
      successful.setLocationResource('batch-created-location', Object.freeze({
        id: 'batch-created-location',
        familyId,
        ownerPersonId: actorPersonId,
        createReceiptHash: receiptHash
      }));
      return ok('created-and-read');
    });

    expect(result).toEqual(ok('created-and-read'));
    expect(successful.requests[0]).toMatchObject({
      action: 'read',
      capability: 'location.read',
      resource: {
        id: 'batch-created-location',
        familyId,
        ownerPersonId: actorPersonId,
        sensitivity: 'highly_sensitive'
      }
    });

    const mismatched = createHarness();
    const denied = await mismatched.runner.execute(context, intent, () => {
      mismatched.setLocationResource('batch-created-location', Object.freeze({
        id: 'batch-created-location',
        familyId,
        ownerPersonId: actorPersonId,
        createReceiptHash: 'b'.repeat(64)
      }));
      return ok('must-not-commit');
    });
    expect(denied.ok).toBe(false);
  });

  it('rejects stale LIFE-derived capability/privacy intents before the business operation', async () => {
    const harness = createHarness();
    let operationExecuted = false;
    const staleIntent = {
      ...locationExactReadIntent('owner-location'),
      capability: 'family.read',
      privacy: 'private'
    } as unknown as LocationPolicyIntent;

    const result = await harness.runner.execute(context, staleIntent, () => {
      operationExecuted = true;
      return ok('stale-intent-leak');
    });

    expect(result.ok).toBe(false);
    expect(operationExecuted).toBe(false);
    expect(harness.requests).toHaveLength(0);
  });

  it('keeps the location-created outbox payload free of personal metadata', async () => {
    let capturedEvent: DomainEvent<unknown> | undefined;
    let capturedIntent: LocationPolicyIntent | undefined;
    const unitOfWork: LocationUnitOfWork = Object.freeze({
      async execute<T>(
        _applicationContext: LocationApplicationContext,
        intent: LocationPolicyIntent,
        operation: (scope: LocationWriteScope) => Result<T, AppError>
      ): Promise<Result<T, AppError>> {
        capturedIntent = intent;
        return operation(Object.freeze({
          occurredAt: asIsoDateTime(initialNow),
          findPerson: () => ok(people.get(actorPersonId)!),
          insertLocation: () => ok(undefined),
          appendAudit: () => ok('audit-chain-hash'),
          enqueueEvent: <TPayload>(event: DomainEvent<TPayload>) => {
            capturedEvent = event;
            return ok(undefined);
          }
        }));
      }
    });
    const useCase = new CreateGovernedFamilyLocationUseCase(unitOfWork);

    const result = await useCase.execute({
      context,
      command: {
        label: 'Aile Evi',
        address: 'Kişisel adres dışarı çıkmamalı',
        latitude: 39.93,
        longitude: 32.85,
        kind: 'residence'
      },
      identifiers: {
        locationId: 'new-location',
        auditId: 'new-location-audit',
        outboxEventId: asEventId('new-location-event')
      }
    });

    expect(result.ok).toBe(true);
    expect(capturedIntent).toMatchObject({
      action: 'create',
      capability: 'family.write',
      resourceType: 'location',
      resourceId: 'new-location',
      purpose: 'general',
      ownerPersonId: actorPersonId,
      sensitivity: 'highly_sensitive'
    });
    expect(capturedEvent?.payload).toEqual({ locationId: 'new-location', kind: 'residence' });
    expect(capturedEvent?.payload).not.toHaveProperty('ownerPersonId');
    expect(capturedEvent?.payload).not.toHaveProperty('label');
    expect(capturedEvent?.payload).not.toHaveProperty('address');
    expect(capturedEvent?.payload).not.toHaveProperty('latitude');
    expect(capturedEvent?.payload).not.toHaveProperty('longitude');
  });

  it('accepts only finite, general, branchless, read-only location allow grants at the application boundary', () => {
    let saved = 0;
    const authorizationContext: AuthorizationApplicationContext = Object.freeze({
      correlationId: asCorrelationId('location-permission-validation')
    });
    const authorizationAccount: AuthorizationAccountRecord = Object.freeze({
      id: actorAccountId,
      role: 'family_admin',
      status: 'active',
      personId: actorPersonId,
      startsAt: asIsoDateTime('2020-01-01T00:00:00.000Z'),
      endsAt: asIsoDateTime('2030-01-01T00:00:00.000Z')
    });
    const unitOfWork: AuthorizationUnitOfWork = Object.freeze({
      execute<T>(
        _applicationContext: AuthorizationApplicationContext,
        _actorId: typeof actorAccountId,
        operation: (scope: AuthorizationWriteScope) => Result<T, AppError>
      ): Result<T, AppError> {
        return operation(Object.freeze({
          occurredAt: asIsoDateTime(initialNow),
          getAccount: () => ok(authorizationAccount),
          upsertPermission: () => {
            saved += 1;
            return ok(undefined);
          },
          deletePermission: () => ok(false),
          appendAudit: () => ok('authorization-audit-chain')
        }));
      }
    });
    const useCase = new UpsertObjectPermissionUseCase(unitOfWork);
    const baseCommand = {
      subjectAccountId: actorAccountId,
      resourceType: 'location',
      resourceId: 'other-location',
      actions: ['read'] as const,
      effect: 'allow' as const,
      purpose: 'general' as const,
      startsAt: initialNow
    };
    const execute = (command: Parameters<UpsertObjectPermissionUseCase['execute']>[0]['command']) => useCase.execute({
      context: authorizationContext,
      actorId: actorAccountId,
      command,
      permissionId: `permission-${saved}`,
      auditId: `permission-audit-${saved}`
    });

    expect(execute({ ...baseCommand, actions: ['read'] }).ok).toBe(false);
    expect(execute({ ...baseCommand, actions: ['read', 'create'], endsAt: '2026-08-08T11:00:00.000Z' }).ok).toBe(false);
    expect(execute({ ...baseCommand, actions: ['read'], familyBranchId: 'branch-a', endsAt: '2026-08-08T11:00:00.000Z' }).ok).toBe(false);
    expect(saved).toBe(0);

    const valid = execute({ ...baseCommand, actions: ['read'], endsAt: '2026-08-08T11:00:00.000Z' });
    expect(valid.ok).toBe(true);
    expect(saved).toBe(1);
  });

  it('requires a finite end for timeline event allow grants at the application boundary', () => {
    let saved = 0;
    const authorizationContext: AuthorizationApplicationContext = Object.freeze({
      correlationId: asCorrelationId('timeline-permission-validation')
    });
    const authorizationAccount: AuthorizationAccountRecord = Object.freeze({
      id: actorAccountId,
      role: 'family_admin',
      status: 'active',
      personId: actorPersonId,
      startsAt: asIsoDateTime('2020-01-01T00:00:00.000Z'),
      endsAt: asIsoDateTime('2030-01-01T00:00:00.000Z')
    });
    const unitOfWork: AuthorizationUnitOfWork = Object.freeze({
      execute<T>(
        _applicationContext: AuthorizationApplicationContext,
        _actorId: typeof actorAccountId,
        operation: (scope: AuthorizationWriteScope) => Result<T, AppError>
      ): Result<T, AppError> {
        return operation(Object.freeze({
          occurredAt: asIsoDateTime(initialNow),
          getAccount: () => ok(authorizationAccount),
          upsertPermission: () => { saved += 1; return ok(undefined); },
          deletePermission: () => ok(false),
          appendAudit: () => ok('authorization-audit-chain')
        }));
      }
    });
    const useCase = new UpsertObjectPermissionUseCase(unitOfWork);
    const execute = (endsAt?: string) => useCase.execute({
      context: authorizationContext,
      actorId: actorAccountId,
      command: {
        subjectAccountId: actorAccountId,
        resourceType: 'event',
        resourceId: '*',
        actions: ['read'],
        effect: 'allow',
        purpose: 'general',
        startsAt: initialNow,
        ...(endsAt ? { endsAt } : {})
      },
      permissionId: `timeline-permission-${saved}`,
      auditId: `timeline-permission-audit-${saved}`
    });

    expect(execute().ok).toBe(false);
    expect(saved).toBe(0);
    expect(execute('2026-08-08T11:00:00.000Z').ok).toBe(true);
    expect(saved).toBe(1);
  });

  it('has no stale privacy, family.read or location.share production branches in the runtime source', () => {
    const source = readFileSync(new URL('../src/main/location-production-policy-runtime.ts', import.meta.url), 'utf8');
    expect(source).toContain("requestedIntent.capability !== 'location.read'");
    expect(source).toContain("requestedIntent.sensitivity !== 'highly_sensitive'");
    expect(source).not.toMatch(/family\.read/u);
    expect(source).not.toMatch(/privacy/u);
    expect(source).not.toMatch(/location\.share/u);
  });
});
