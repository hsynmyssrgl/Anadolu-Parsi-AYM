import { describe, expect, it } from 'vitest';
import {
  CancelLocalGovernedOcrJobUseCase,
  RunLocalGovernedOcrJobUseCase,
  type LocalGovernedOcrAuthorizationPlan,
  type LocalGovernedOcrPolicyIntent,
  type LocalGovernedOcrRuntimePort
} from '@ppt/application';
import type { AsyncTransactionExecutor, DatabaseExecutor, TransactionContext } from '@ppt/contracts';
import {
  ERROR_CODES,
  asCorrelationId,
  asEventId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import { SqliteTransactionExecutor } from '@ppt/database';
import {
  PlatformPolicyKernel,
  createTypedPolicyEnforcementPoint,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyConnectionAuthority,
  type PlatformPolicyTransactionContext,
  type PolicyResource
} from '@ppt/platform-policy';
import type { PolicyAuthorizedRepositoryExecutionContext } from '@ppt/repository-contracts';
import {
  RepositoryBackedLocalGovernedOcrUnitOfWork,
  type RepositoryBackedLocalGovernedOcrApplicationDependencies
} from '../src/main/local-governed-ocr-application-adapter.js';
import type {
  LocalGovernedOcrProductionPolicyEnforcementPoint,
  LocalGovernedOcrProductionPolicyEnforcementPointResolver
} from '../src/main/timeline-production-policy-runtime.js';

const NOW = asIsoDateTime('2026-08-14T10:00:00.000Z');
const FAMILY = asFamilyId('family-33-q-uow');
const ACCOUNT = asUserId('account-33-q-uow');
const PERSON = asPersonId('person-33-q-uow');
const CORRELATION = asCorrelationId('ocr-uow-same-transaction');
const JOB_ID = 'local-ocr-job-uow';
const SOURCE_ID = 'archive-source-uow';
const SETTINGS_ID = `local-ocr-settings:${PERSON}`;
const RESULT_ID = `${JOB_ID}:result`;
const INPUT_SHA256 = 'a'.repeat(64);
const SEALED_RESULT_ID = 'b'.repeat(64);
const FOREIGN_CORRELATION = asCorrelationId('ocr-uow-foreign-correlation');

const context = Object.freeze({
  familyId: FAMILY,
  actor: Object.freeze({ userId: ACCOUNT, role: 'family_admin' as const, personId: PERSON }),
  correlationId: CORRELATION
});

const policyKernel = new PlatformPolicyKernel({
  policyVersion: '33-q-uow-v1',
  signingKey: Buffer.from('33-q-uow-policy-signing-key-with-32-byte-minimum'),
  applicationCapabilities: {
    'windows-desktop': ['family.read', 'family.write', 'archive.ocr', 'archive.write']
  },
  consentRequiredCapabilities: ['archive.ocr'],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'process', 'record']
});

const provider: PlatformPolicyAuthorizationProvider = Object.freeze({
  resolvePolicyPackage: () => policyKernel.policyPackage,
  authorize: ({ request, nonce }) => Object.freeze({
    effectiveRequest: request,
    authorization: policyKernel.authorizeWithReceipt(request, request.occurredAt, nonce)
  }),
  verify: ({ request, receipt }) => policyKernel.verifyReceiptForRequest(receipt, request)
});

const policyIntent = (
  overrides: Partial<LocalGovernedOcrPolicyIntent>
): LocalGovernedOcrPolicyIntent => Object.freeze({
  action: 'process',
  capability: 'archive.ocr',
  resourceType: 'local_ocr_job',
  resourceId: JOB_ID,
  purpose: 'ocr_process',
  familyId: FAMILY,
  ownerPersonId: PERSON,
  privacy: 'private',
  sensitivity: 'personal',
  ...overrides
});

const plan = (): LocalGovernedOcrAuthorizationPlan => Object.freeze({
  primary: policyIntent({}),
  source: policyIntent({ action: 'process', resourceType: 'archive_item', resourceId: SOURCE_ID }),
  settings: policyIntent({
    action: 'read',
    capability: 'family.read',
    resourceType: 'local_ocr_settings',
    resourceId: SETTINGS_ID,
    purpose: 'administration'
  }),
  target: Object.freeze({
    ...policyIntent({ resourceType: 'local_ocr_result', resourceId: RESULT_ID }),
    sourceJobId: JOB_ID
  })
});

const readPlan = (): LocalGovernedOcrAuthorizationPlan => Object.freeze({
  primary: policyIntent({ action: 'read' }),
  source: policyIntent({ action: 'read', resourceType: 'archive_item', resourceId: SOURCE_ID })
});

const correctionPlan = (): LocalGovernedOcrAuthorizationPlan => Object.freeze({
  primary: policyIntent({ action: 'process' }),
  source: policyIntent({ action: 'read', resourceType: 'archive_item', resourceId: SOURCE_ID }),
  target: Object.freeze({
    ...policyIntent({ resourceType: 'local_ocr_result', resourceId: RESULT_ID }),
    sourceJobId: JOB_ID
  })
});

const purgePlan = (): LocalGovernedOcrAuthorizationPlan => Object.freeze({
  primary: policyIntent({ action: 'process' }),
  source: policyIntent({ action: 'read', resourceType: 'archive_item', resourceId: SOURCE_ID })
});

const authorizationReconciliationPlan = (): LocalGovernedOcrAuthorizationPlan => Object.freeze({
  primary: policyIntent({ action: 'delete', capability: 'archive.write' })
});

const maintenancePlan = (): LocalGovernedOcrAuthorizationPlan => Object.freeze({
  primary: policyIntent({
    action: 'update', capability: 'family.write', resourceType: 'local_ocr_settings',
    resourceId: SETTINGS_ID, purpose: 'administration'
  })
});

const sourceDeletionPlan = (): LocalGovernedOcrAuthorizationPlan => Object.freeze({
  primary: policyIntent({
    action: 'delete', capability: 'archive.write', resourceType: 'archive_item', resourceId: SOURCE_ID
  })
});

const jobRow = Object.freeze({
  id: JOB_ID,
  key: Object.freeze({ familyId: FAMILY, accountId: ACCOUNT, ownerPersonId: PERSON }),
  revision: 4,
  source: Object.freeze({
    resourceType: 'archive_item' as const,
    resourceId: SOURCE_ID,
    inputSha256: INPUT_SHA256,
    mimeType: 'image/png',
    sizeBytes: 128
  }),
  derivedResourceId: RESULT_ID,
  languageHints: Object.freeze(['tr-TR']),
  status: 'completed' as const,
  runAttempt: 0,
  correctionRevision: 0,
  resultAvailable: true,
  resultContentSha256: 'c'.repeat(64),
  sealedResultId: SEALED_RESULT_ID,
  consentId: 'sensitive-processing-consent-uow',
  deletionPropagation: 'active' as const,
  processor: 'local_ocr' as const,
  networkUsed: false as const,
  cloudUsed: false as const,
  completedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
  stateFingerprint: 'd'.repeat(64)
});

const {
  sealedResultId: _sealedResultId,
  resultContentSha256: _resultContentSha256,
  completedAt: _completedAt,
  ...jobWithoutResult
} = jobRow;
const queuedJobRow = Object.freeze({
  ...jobWithoutResult,
  status: 'queued' as const,
  resultAvailable: false
});
const RUN_ID = '9'.repeat(64);
const runningJobRow = Object.freeze({
  ...queuedJobRow,
  revision: queuedJobRow.revision + 1,
  status: 'running' as const,
  runAttempt: queuedJobRow.runAttempt + 1,
  activeRunId: RUN_ID,
  stateFingerprint: '8'.repeat(64)
});

class TestAsyncTransactionExecutor implements AsyncTransactionExecutor {
  public active = false;
  public asyncCount = 0;
  public committedCount = 0;
  public rolledBackCount = 0;
  private readonly transaction: TransactionContext = Object.freeze({
    transaction: Object.freeze({}),
    correlationId: CORRELATION,
    occurredAt: NOW
  });

  public execute<T>(
    _correlationId: typeof CORRELATION,
    operation: (transaction: TransactionContext) => Result<T, AppError>
  ): Result<T, AppError> {
    if (this.active) throw new Error('overlapping transaction');
    this.active = true;
    try { return operation(this.transaction); }
    finally { this.active = false; }
  }

  public async executeAsync<T>(
    _correlationId: typeof CORRELATION,
    operation: (transaction: TransactionContext) => Promise<Result<T, AppError>>
  ): Promise<Result<T, AppError>> {
    if (this.active) throw new Error('overlapping transaction');
    this.active = true;
    this.asyncCount += 1;
    try {
      const result = await operation(this.transaction);
      if (result.ok) this.committedCount += 1;
      else this.rolledBackCount += 1;
      return result;
    } catch (error) {
      this.rolledBackCount += 1;
      throw error;
    } finally {
      this.active = false;
    }
  }
}

const createPolicyResolver = (
  transactionExecutor: TestAsyncTransactionExecutor,
  recorded: string[],
  projected: string[],
  resolvedCorrelations: string[]
): LocalGovernedOcrProductionPolicyEnforcementPointResolver => Object.freeze({
  async resolve(policyContext, intent): Promise<LocalGovernedOcrProductionPolicyEnforcementPoint> {
    resolvedCorrelations.push(policyContext.correlationId);
    const authority: PlatformPolicyConnectionAuthority = Object.freeze({
      policyVersion: '33-q-uow-v1',
      accountId: ACCOUNT,
      personId: PERSON,
      deviceId: 'device-33-q-uow',
      applicationId: 'windows-desktop',
      devicePublicKeyFingerprintSha256: 'fingerprint-33-q-uow',
      deviceCertificateIssuedAt: asIsoDateTime('2026-08-14T09:00:00.000Z'),
      deviceTrusted: true,
      membershipActive: true,
      roles: Object.freeze(['family_admin']),
      familyIds: Object.freeze([FAMILY]),
      online: true,
      grants: Object.freeze([]),
      consents: intent.capability === 'archive.ocr' ? Object.freeze([{
        id: 'sensitive-processing-consent-uow',
        subjectPersonId: PERSON,
        capability: 'archive.ocr' as const,
        purpose: 'ocr_process',
        startsAt: asIsoDateTime('2026-08-14T09:00:00.000Z')
      }]) : Object.freeze([]),
      expiresAt: asIsoDateTime('2026-08-14T10:00:30.000Z')
    });
    const resource: PolicyResource = Object.freeze({
      type: intent.resourceType,
      id: intent.resourceId,
      familyId: FAMILY,
      ownerPersonId: PERSON,
      sensitivity: 'personal',
      ...(intent.resourceType === 'local_ocr_job' || intent.resourceType === 'local_ocr_result'
        ? { sourceResourceId: SOURCE_ID }
        : {})
    });
    const enforcementPoint = createTypedPolicyEnforcementPoint({
      provider,
      authorityResolver: { resolve: () => authority },
      resourceResolver: { resolve: () => resource },
      receiptSink: {
        append: () => undefined,
        ensure: () => { throw new Error('projection is mocked by the adapter test'); }
      },
      deferAllowedReceiptPersistence: true,
      clock: () => NOW
    });
    return Object.freeze(Object.assign(enforcementPoint, {
      requiresTransactionRevalidation: true as const,
      requiresDurableTransactionReceipt: true as const,
      revalidateTransaction: (input: { readonly authorization: PlatformPolicyTransactionContext }) => {
        expect(transactionExecutor.active).toBe(true);
        expect(input.authorization.occurredAt).toBe(NOW);
        return ok(undefined);
      },
      recordAuthorizedTransaction: (input: { readonly authorization: PlatformPolicyTransactionContext }) => {
        expect(transactionExecutor.active).toBe(true);
        recorded.push(`${input.authorization.resourceType}:${input.authorization.resourceId}`);
        return ok(undefined);
      },
      projectCommittedTransaction: async (input: { readonly authorization: PlatformPolicyTransactionContext }) => {
        expect(transactionExecutor.active).toBe(false);
        projected.push(`${input.authorization.resourceType}:${input.authorization.resourceId}`);
        return ok(undefined);
      }
    })) as LocalGovernedOcrProductionPolicyEnforcementPoint;
  }
});

const dependencies = (
  currentJob = jobRow,
  transactionExecutor: TestAsyncTransactionExecutor = new TestAsyncTransactionExecutor()
) => {
  let currentJobState = currentJob;
  const mutations = new Map<string, unknown>();
  const recorded: string[] = [];
  const projected: string[] = [];
  const routed: string[] = [];
  const resolvedCorrelations: string[] = [];
  const assertRoute = (label: string, repository: PolicyAuthorizedRepositoryExecutionContext): void => {
    expect(transactionExecutor.active).toBe(true);
    routed.push(`${label}:${repository.policyAuthorization.resourceType}:${repository.policyAuthorization.resourceId}`);
  };
  const localGovernedOcrRepository = {
    loadCenter: (repository: PolicyAuthorizedRepositoryExecutionContext) => {
      assertRoute('center', repository);
      return ok({ settings: { enabled: true }, jobs: [] } as never);
    },
    findJob: (repository: PolicyAuthorizedRepositoryExecutionContext, _key: unknown, jobId: string) => {
      assertRoute('job', repository);
      return ok(jobId === JOB_ID ? currentJobState : null);
    },
    listJobsBySource: (repository: PolicyAuthorizedRepositoryExecutionContext) => {
      assertRoute('source-jobs', repository);
      return ok([currentJobState]);
    },
    resolveArchiveSource: (repository: PolicyAuthorizedRepositoryExecutionContext) => {
      assertRoute('source', repository);
      return ok({
        key: jobRow.key,
        resourceType: 'archive_item',
        resourceId: SOURCE_ID,
        inputSha256: INPUT_SHA256,
        mimeType: 'image/png',
        sizeBytes: 128,
        sourcePolicy: {
          resourceType: 'archive_item',
          resourceId: SOURCE_ID,
          familyId: FAMILY,
          contentSha256: INPUT_SHA256,
          receiptActive: true,
          allowedCapabilities: ['archive.ocr'],
          allowedActions: ['process'],
          allowedPurposes: ['ocr_process'],
          retentionUntil: null
        }
      } as never);
    },
    resolveAuthorizedArchiveVaultLocator: (repository: PolicyAuthorizedRepositoryExecutionContext) => {
      assertRoute('vault-locator', repository);
      return ok({
        key: jobRow.key,
        resourceType: 'archive_item',
        resourceId: SOURCE_ID,
        storedName: 'archive-uow-source.bin',
        originalName: 'archive-uow-source.png',
        inputSha256: INPUT_SHA256,
        mimeType: 'image/png',
        sizeBytes: 128
      });
    },
    resolveActiveSensitiveProcessingConsent: (repository: PolicyAuthorizedRepositoryExecutionContext) => {
      assertRoute('consent', repository);
      return ok({
        id: 'sensitive-processing-consent-uow',
        key: jobRow.key,
        purpose: 'sensitive_processing',
        resourceType: 'archive_item',
        resourceId: SOURCE_ID,
        status: 'granted',
        startsAt: asIsoDateTime('2026-08-14T09:00:00.000Z')
      } as never);
    },
    listAuthorizationReconciliationCandidates: (_repository: unknown, _key: unknown, _at: string, limit: number) => {
      return ok(Object.freeze(limit < 1 ? [] : [{ jobId: JOB_ID, revision: currentJobState.revision,
        stateFingerprint: currentJobState.stateFingerprint, reason: 'permission_revoked' as const }]));
    },
    listRetentionReconciliationCandidates: (_repository: unknown, _key: unknown, _at: string, limit: number) => {
      return ok(Object.freeze(limit < 1 ? [] : [{ jobId: JOB_ID, revision: currentJobState.revision,
        stateFingerprint: currentJobState.stateFingerprint, retentionUntil: NOW }]));
    },
    resolveAuthorizationRevocation: (repository: PolicyAuthorizedRepositoryExecutionContext) => {
      assertRoute('authorization-revocation', repository);
      return ok('permission_revoked' as const);
    },
    resolveRetentionExpiry: (repository: PolicyAuthorizedRepositoryExecutionContext) => {
      assertRoute('retention-expiry', repository);
      return ok(NOW);
    },
    resolveMaintenanceJobBinding: (repository: PolicyAuthorizedRepositoryExecutionContext, _key: unknown, jobId: string) => {
      assertRoute('maintenance-job', repository);
      return ok(jobId === JOB_ID ? {
        key: currentJobState.key,
        jobId: currentJobState.id,
        derivedResourceId: currentJobState.derivedResourceId,
        sourceResourceId: currentJobState.source.resourceId,
        inputSha256: currentJobState.source.inputSha256,
        currentSealedResultId: currentJobState.sealedResultId ?? null
      } : null);
    },
    findMutationByClientOperationId: (repository: PolicyAuthorizedRepositoryExecutionContext, _key: unknown,
      clientOperationId: string) => {
      assertRoute('replay', repository);
      return ok(mutations.get(clientOperationId) ?? null);
    },
    insertMutation: (repository: PolicyAuthorizedRepositoryExecutionContext, row: { readonly clientOperationId: string }) => {
      assertRoute('mutation', repository);
      mutations.set(row.clientOperationId, row);
      return ok(undefined);
    },
    saveJob: (repository: PolicyAuthorizedRepositoryExecutionContext, row: typeof currentJobState, expectedRevision: number) => {
      assertRoute('save', repository);
      if (currentJobState.revision !== expectedRevision) return ok(false);
      currentJobState = row;
      return ok(true);
    },
    resolvePolicyResource: () => ok({
      familyId: FAMILY,
      accountId: ACCOUNT,
      ownerPersonId: PERSON,
      revision: currentJobState.revision,
      stateFingerprint: currentJobState.stateFingerprint,
      sensitivity: 'personal',
      sourceResourceType: 'archive_item',
      sourceResourceId: SOURCE_ID,
      derivedResourceId: RESULT_ID
    }),
    resolveArchivePolicyResource: () => ok({
      familyId: FAMILY,
      accountId: ACCOUNT,
      ownerPersonId: PERSON,
      revision: 1,
      stateFingerprint: 'a'.repeat(64),
      sensitivity: 'personal',
      sourceResourceType: null,
      sourceResourceId: null,
      derivedResourceId: null
    })
  };
  const value: RepositoryBackedLocalGovernedOcrApplicationDependencies = {
    transactionExecutor,
    localGovernedOcrRepository: localGovernedOcrRepository as never,
    derivedDataPolicyRepository: {
      insertSealed: (repository: PolicyAuthorizedRepositoryExecutionContext) => {
        assertRoute('binding', repository);
        return ok(undefined);
      }
    } as never,
    auditRepository: {
      append: (repository: PolicyAuthorizedRepositoryExecutionContext) => {
        assertRoute('audit', repository);
        return ok('audit-chain-hash');
      }
    } as never,
    outboxRepository: {
      enqueue: (repository: PolicyAuthorizedRepositoryExecutionContext) => {
        assertRoute('outbox', repository);
        return ok(undefined);
      }
    } as never,
    policyEnforcementPointResolver: createPolicyResolver(
      transactionExecutor,
      recorded,
      projected,
      resolvedCorrelations
    ),
    clusterFence: () => ({ writable: true, epoch: 94 })
  };
  return { value, transactionExecutor, recorded, projected, routed, resolvedCorrelations,
    currentJob: () => currentJobState, mutations };
};

describe('33-Q repository-backed local governed OCR UoW', () => {
  it('records primary, source, settings and target receipts then routes every port in one async transaction', async () => {
    const fixture = dependencies();
    const unitOfWork = new RepositoryBackedLocalGovernedOcrUnitOfWork(fixture.value);
    const result = await unitOfWork.execute(context, plan(), async (scope) => {
      expect(scope.occurredAt).toBe(NOW);
      expect(scope.loadCenter({ familyId: FAMILY, accountId: ACCOUNT, ownerPersonId: PERSON }).ok).toBe(true);
      expect(scope.findJob({ familyId: FAMILY, accountId: ACCOUNT, ownerPersonId: PERSON }, JOB_ID).ok).toBe(true);
      expect(scope.resolveArchiveSource(
        { familyId: FAMILY, accountId: ACCOUNT, ownerPersonId: PERSON },
        SOURCE_ID
      ).ok).toBe(true);
      expect(scope.resolveActiveSensitiveProcessingConsent(
        { familyId: FAMILY, accountId: ACCOUNT, ownerPersonId: PERSON },
        'archive_item',
        SOURCE_ID,
        NOW
      ).ok).toBe(true);
      expect(scope.insertDerivedBinding({
        target: { resourceType: 'local_ocr_result', resourceId: RESULT_ID, familyId: FAMILY }
      } as never).ok).toBe(true);
      expect(scope.findMutationByClientOperationId(
        { familyId: FAMILY, accountId: ACCOUNT, ownerPersonId: PERSON },
        'ocr-operation-uow'
      ).ok).toBe(true);
      expect(scope.insertMutation({
        key: { familyId: FAMILY, accountId: ACCOUNT, ownerPersonId: PERSON },
        resourceType: 'local_ocr_job',
        resourceId: JOB_ID
      } as never).ok).toBe(true);
      expect(scope.saveJob({
        id: JOB_ID,
        key: { familyId: FAMILY, accountId: ACCOUNT, ownerPersonId: PERSON }
      } as never, 4).ok).toBe(true);
      expect(scope.appendAudit({
        id: 'ocr-audit-uow',
        action: 'ocr.job_run',
        resourceType: 'local_ocr_job',
        resourceId: JOB_ID,
        occurredAt: NOW,
        actorId: ACCOUNT
      }).ok).toBe(true);
      expect(scope.enqueueEvent({
        eventId: asEventId('ocr-outbox-uow'),
        eventType: 'ocr.state.changed',
        eventVersion: 1,
        aggregateType: 'local_ocr_job',
        aggregateId: JOB_ID,
        occurredAt: NOW,
        actorId: ACCOUNT,
        correlationId: CORRELATION,
        payload: { stateFingerprint: 'f'.repeat(64) }
      }).ok).toBe(true);
      return ok('committed');
    });

    expect(result).toEqual(ok('committed'));
    expect(fixture.transactionExecutor.asyncCount).toBe(1);
    expect(fixture.recorded).toEqual([
      `local_ocr_job:${JOB_ID}`,
      `archive_item:${SOURCE_ID}`,
      `local_ocr_settings:${SETTINGS_ID}`,
      `local_ocr_result:${RESULT_ID}`
    ]);
    expect(fixture.projected).toEqual(fixture.recorded);
    expect(fixture.resolvedCorrelations).toEqual([
      CORRELATION,
      expect.stringMatching(/^local-ocr-source-[0-9a-f]{64}$/u),
      expect.stringMatching(/^local-ocr-settings-[0-9a-f]{64}$/u),
      expect.stringMatching(/^local-ocr-target-[0-9a-f]{64}$/u)
    ]);
    expect(new Set(fixture.resolvedCorrelations).size).toBe(4);
    expect(fixture.routed).toEqual([
      `center:local_ocr_settings:${SETTINGS_ID}`,
      `job:local_ocr_job:${JOB_ID}`,
      `source:archive_item:${SOURCE_ID}`,
      `consent:archive_item:${SOURCE_ID}`,
      `binding:local_ocr_result:${RESULT_ID}`,
      `replay:local_ocr_job:${JOB_ID}`,
      `mutation:local_ocr_job:${JOB_ID}`,
      `save:local_ocr_job:${JOB_ID}`,
      `audit:local_ocr_job:${JOB_ID}`,
      `outbox:local_ocr_job:${JOB_ID}`
    ]);
  });

  it('rejects a derived target that is not bound to the exact primary job before opening a transaction', async () => {
    const fixture = dependencies();
    const exact = plan();
    const invalidPlan = {
      ...exact,
      target: { ...exact.target!, sourceJobId: 'foreign-job' }
    };
    const result = await new RepositoryBackedLocalGovernedOcrUnitOfWork(fixture.value)
      .execute(context, invalidPlan, () => ok(undefined));
    expect(result.ok).toBe(false);
    expect(fixture.transactionExecutor.asyncCount).toBe(0);
    expect(fixture.recorded).toEqual([]);
  });

  it('leases the exact run source only after every receipt and revokes it on every exit path', async () => {
    const fixture = dependencies(runningJobRow);
    const unitOfWork = new RepositoryBackedLocalGovernedOcrUnitOfWork(fixture.value);
    const exactInput = {
      operation: 'run' as const,
      runId: RUN_ID,
      jobId: JOB_ID,
      derivedResourceId: RESULT_ID,
      sourceResourceId: SOURCE_ID,
      expectedInputSha256: INPUT_SHA256,
      correlationId: CORRELATION
    };
    expect(unitOfWork.resolveAuthorizedArchiveSource(exactInput).ok).toBe(false);

    const result = await unitOfWork.executeDetached(context, plan(), () => ({
      operation: 'run' as const,
      runId: RUN_ID,
      jobId: JOB_ID,
      derivedResourceId: RESULT_ID,
      sourceResourceId: SOURCE_ID,
      expectedInputSha256: INPUT_SHA256
    }), () => ok('prepared'), async () => {
      await Promise.resolve();
      const authorized = unitOfWork.resolveAuthorizedArchiveSource(exactInput);
      expect(authorized.ok, authorized.ok ? '' : authorized.error.message).toBe(true);
      if (authorized.ok) expect(authorized.value).toMatchObject({
        authority: 'central_pep_authorized_archive_vault_read',
        familyId: FAMILY,
        accountId: ACCOUNT,
        ownerPersonId: PERSON,
        jobId: JOB_ID,
        derivedResourceId: RESULT_ID,
        sourceResourceId: SOURCE_ID,
        inputSha256: INPUT_SHA256,
        storedName: 'archive-uow-source.bin',
        originalName: 'archive-uow-source.png'
      });
      expect(unitOfWork.resolveAuthorizedArchiveSource({
        ...exactInput,
        correlationId: FOREIGN_CORRELATION
      }).ok).toBe(false);
      expect(unitOfWork.resolveAuthorizedArchiveSource({
        ...exactInput,
        sourceResourceId: 'foreign-archive-source'
      }).ok).toBe(false);
      expect(unitOfWork.resolveAuthorizedArchiveSource({
        ...exactInput,
        expectedInputSha256: 'e'.repeat(64)
      }).ok).toBe(false);
      return ok('run-authorized');
    });

    expect(result).toEqual(ok('run-authorized'));
    expect(unitOfWork.resolveAuthorizedArchiveSource(exactInput).ok).toBe(false);
    expect(fixture.routed).toContain(`vault-locator:archive_item:${SOURCE_ID}`);
  });

  it('binds correct, read and purge to their exact current job snapshots and rejects foreign or stale calls', async () => {
    const fixture = dependencies();
    const unitOfWork = new RepositoryBackedLocalGovernedOcrUnitOfWork(fixture.value);
    const bindingInput = {
      jobId: JOB_ID,
      sealedResultId: SEALED_RESULT_ID,
      correlationId: CORRELATION
    };

    const corrected = await unitOfWork.execute(context, correctionPlan(), async () => {
      await Promise.resolve();
      expect(unitOfWork.resolveAuthorizedJobBinding({ operation: 'correct', ...bindingInput }).ok).toBe(true);
      expect(unitOfWork.resolveAuthorizedJobBinding({
        operation: 'correct', ...bindingInput, sealedResultId: 'e'.repeat(64)
      }).ok).toBe(false);
      expect(unitOfWork.resolveAuthorizedJobBinding({
        operation: 'correct', ...bindingInput, jobId: 'foreign-job'
      }).ok).toBe(false);
      expect((await unitOfWork.resolveAuthorizedJobBinding({
        operation: 'orphan_sweep', ...bindingInput
      })).ok).toBe(false);
      return ok('correct');
    });
    expect(corrected).toEqual(ok('correct'));
    expect(unitOfWork.resolveAuthorizedJobBinding({ operation: 'correct', ...bindingInput }).ok).toBe(false);

    const read = await unitOfWork.execute(context, readPlan(), () => {
      expect(unitOfWork.resolveAuthorizedJobBinding({ operation: 'read', ...bindingInput }).ok).toBe(true);
      expect(unitOfWork.resolveAuthorizedJobBinding({ operation: 'purge', ...bindingInput }).ok).toBe(false);
      return ok('read');
    });
    expect(read).toEqual(ok('read'));

    const purged = await unitOfWork.execute(context, purgePlan(), () => {
      expect(unitOfWork.resolveAuthorizedJobBinding({ operation: 'purge', ...bindingInput }).ok).toBe(true);
      expect(unitOfWork.resolveAuthorizedJobBinding({
        operation: 'purge', ...bindingInput, sealedResultId: 'f'.repeat(64)
      }).ok).toBe(false);
      return ok('purge');
    });
    expect(purged).toEqual(ok('purge'));

    const propagated = await unitOfWork.execute(context, sourceDeletionPlan(), () => {
      expect(unitOfWork.resolveAuthorizedJobBinding({ operation: 'purge', ...bindingInput }).ok).toBe(true);
      return ok('source-delete-purge');
    });
    expect(propagated).toEqual(ok('source-delete-purge'));
    expect(fixture.routed).toContain(`source-jobs:archive_item:${SOURCE_ID}`);
  });

  it('discovers owner-bound revocations and authorizes purge only under the exact primary job-delete receipt', async () => {
    const fixture = dependencies();
    const unitOfWork = new RepositoryBackedLocalGovernedOcrUnitOfWork(fixture.value);
    const candidates = unitOfWork.listAuthorizationReconciliationCandidates(context, jobRow.key, 8);
    expect(candidates).toEqual({ ok: true, value: [expect.objectContaining({
      jobId: JOB_ID, revision: jobRow.revision, reason: 'permission_revoked'
    })] });

    const bindingInput = Object.freeze({ operation: 'purge' as const, jobId: JOB_ID,
      sealedResultId: SEALED_RESULT_ID, correlationId: CORRELATION });
    const reconciled = await unitOfWork.execute(context, authorizationReconciliationPlan(), (scope) => {
      expect(scope.resolveAuthorizationRevocation(jobRow.key, JOB_ID, NOW))
        .toEqual({ ok: true, value: 'permission_revoked' });
      expect(unitOfWork.resolveAuthorizedJobBinding(bindingInput)).toEqual(expect.objectContaining({ ok: true,
        value: expect.objectContaining({ jobId: JOB_ID, currentSealedResultId: SEALED_RESULT_ID }) }));
      expect(unitOfWork.resolveAuthorizedJobBinding({ ...bindingInput, jobId: 'foreign-job' }).ok).toBe(false);
      return ok('authorization-reconciled');
    });
    expect(reconciled).toEqual(ok('authorization-reconciled'));
    expect(unitOfWork.resolveAuthorizedJobBinding(bindingInput).ok).toBe(false);
    expect(fixture.routed).toContain(`authorization-revocation:local_ocr_job:${JOB_ID}`);
    expect(fixture.recorded).toEqual([`local_ocr_job:${JOB_ID}`]);
  });

  it('opens a distinct settings maintenance lease, resolves every orphan against live owner state and revokes finally', async () => {
    const fixture = dependencies();
    const unitOfWork = new RepositoryBackedLocalGovernedOcrUnitOfWork(fixture.value);
    const input = Object.freeze({
      operation: 'orphan_sweep' as const,
      jobId: JOB_ID,
      sealedResultId: SEALED_RESULT_ID,
      correlationId: CORRELATION
    });
    expect((await unitOfWork.resolveAuthorizedJobBinding(input)).ok).toBe(false);
    const maintained = await unitOfWork.executeMaintenance(
      context,
      maintenancePlan(),
      (scope) => {
        expect(scope.loadCenter(jobRow.key).ok).toBe(true);
        return ok(undefined);
      },
      async () => {
        const exact = await unitOfWork.resolveAuthorizedJobBinding(input);
        expect(exact).toEqual(expect.objectContaining({ ok: true, value: expect.objectContaining({
          authority: 'central_pep_authorized_local_ocr_job',
          familyId: FAMILY,
          accountId: ACCOUNT,
          ownerPersonId: PERSON,
          currentSealedResultId: SEALED_RESULT_ID
        }) }));
        expect((await unitOfWork.resolveAuthorizedJobBinding({ ...input, jobId: 'foreign-job' })).ok).toBe(false);
        expect((await unitOfWork.resolveAuthorizedJobBinding({ ...input, correlationId: FOREIGN_CORRELATION })).ok).toBe(false);
        return ok('maintained');
      }
    );
    expect(maintained).toEqual(ok('maintained'));
    expect((await unitOfWork.resolveAuthorizedJobBinding(input)).ok).toBe(false);
    expect(fixture.recorded).toEqual([
      `local_ocr_settings:${SETTINGS_ID}`,
      `local_ocr_settings:${SETTINGS_ID}`,
      `local_ocr_settings:${SETTINGS_ID}`
    ]);
    expect(fixture.projected).toEqual(fixture.recorded);
    expect(fixture.routed).toContain(`maintenance-job:local_ocr_settings:${SETTINGS_ID}`);
  });

  it('revokes the runtime lease on rollback and never projects a rolled-back receipt', async () => {
    const commands: string[] = [];
    const database: DatabaseExecutor = {
      exec: (sql) => { commands.push(sql); },
      prepare: () => { throw new Error('repository mocks do not prepare SQL in this rollback test'); }
    };
    const productionExecutor = new SqliteTransactionExecutor(database, { now: () => NOW });
    const fixture = dependencies(
      jobRow,
      productionExecutor as unknown as TestAsyncTransactionExecutor
    );
    const unitOfWork = new RepositoryBackedLocalGovernedOcrUnitOfWork(fixture.value);
    const bindingInput = {
      operation: 'correct' as const,
      jobId: JOB_ID,
      sealedResultId: SEALED_RESULT_ID,
      correlationId: CORRELATION
    };
    const result = await unitOfWork.execute(context, correctionPlan(), async () => {
      await Promise.resolve();
      expect(unitOfWork.resolveAuthorizedJobBinding(bindingInput).ok).toBe(true);
      return err(createAppError({
        code: ERROR_CODES.CORE_UNEXPECTED,
        category: 'unexpected',
        message: 'forced rollback',
        correlationId: CORRELATION
      }));
    });

    expect(result.ok).toBe(false);
    expect(commands).toEqual(['BEGIN IMMEDIATE', 'ROLLBACK']);
    expect(fixture.recorded).toEqual([
      `local_ocr_job:${JOB_ID}`,
      `archive_item:${SOURCE_ID}`,
      `local_ocr_result:${RESULT_ID}`
    ]);
    expect(fixture.projected).toEqual([]);
    expect(unitOfWork.resolveAuthorizedJobBinding(bindingInput).ok).toBe(false);
  });

  it('lets a concurrent cancel reach the runtime after the short run-begin transaction commits', async () => {
    const transactionExecutor = new TestAsyncTransactionExecutor();
    const fixture = dependencies(queuedJobRow, transactionExecutor);
    const unitOfWork = new RepositoryBackedLocalGovernedOcrUnitOfWork(fixture.value);
    let releaseWorker!: () => void;
    let workerEntered!: () => void;
    const workerGate = new Promise<void>((resolve) => { releaseWorker = resolve; });
    const entered = new Promise<void>((resolve) => { workerEntered = resolve; });
    let cancellationRuntimeCalls = 0;
    const runtime = {
      runAndSeal: async () => {
        workerEntered();
        await workerGate;
        return ok({
          status: 'cancelled' as const,
          cancelledAt: NOW,
          networkUsed: false as const,
          cloudUsed: false as const
        });
      },
      requestCancellation: async () => {
        cancellationRuntimeCalls += 1;
        releaseWorker();
        return ok({ accepted: true as const });
      }
    } as unknown as LocalGovernedOcrRuntimePort;
    const run = new RunLocalGovernedOcrJobUseCase(unitOfWork, runtime);
    const cancel = new CancelLocalGovernedOcrJobUseCase(unitOfWork, runtime);
    const runPromise = run.execute({
      context,
      command: {
        jobId: JOB_ID,
        expectedRevision: queuedJobRow.revision,
        clientOperationId: 'ocr-run-overlap-operation'
      },
      identifiers: {
        mutationId: 'ocr-run-overlap-mutation',
        resourceId: JOB_ID,
        auditId: 'ocr-run-overlap-audit',
        outboxEventId: asEventId('ocr-run-overlap-event'),
        requestFingerprint: '1'.repeat(64)
      }
    });
    const runStart = await Promise.race([
      entered.then(() => ({ kind: 'entered' as const })),
      runPromise.then((result) => ({ kind: 'ended' as const, result }))
    ]);
    if (runStart.kind === 'ended') {
      throw new Error(`run ended before worker: ${JSON.stringify({ result: runStart.result,
        current: fixture.currentJob(), mutations: [...fixture.mutations.values()] })}`);
    }

    const cancelResult = await cancel.execute({
      context: { ...context, correlationId: asCorrelationId('ocr-uow-concurrent-cancel') },
      command: {
        jobId: JOB_ID,
        expectedRevision: queuedJobRow.revision + 1,
        clientOperationId: 'ocr-cancel-overlap-operation'
      },
      identifiers: {
        mutationId: 'ocr-cancel-overlap-mutation',
        resourceId: JOB_ID,
        auditId: 'ocr-cancel-overlap-audit',
        outboxEventId: asEventId('ocr-cancel-overlap-event'),
        requestFingerprint: '2'.repeat(64)
      }
    });
    expect(cancelResult.ok).toBe(true);
    expect(cancellationRuntimeCalls).toBe(1);
    const runResult = await runPromise;
    expect(runResult.ok, runResult.ok ? '' : runResult.error.message).toBe(true);
    expect(transactionExecutor.active).toBe(false);
    expect(transactionExecutor.rolledBackCount).toBe(0);
    expect(transactionExecutor.committedCount).toBeGreaterThanOrEqual(4);
    expect(fixture.currentJob()).toMatchObject({ status: 'cancelled' });
    expect(fixture.currentJob()).not.toHaveProperty('activeRunId');
  });
});
