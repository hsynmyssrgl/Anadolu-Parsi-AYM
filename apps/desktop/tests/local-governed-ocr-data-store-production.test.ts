import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import type { LocalGovernedOcrRuntimePort } from '@ppt/application';
import {
  ERROR_CODES,
  asIsoDateTime,
  createAppError,
  err,
  ok,
  type Clock,
  type CorrelationId
} from '@ppt/core';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord,
  type PlatformPolicyRequest
} from '@ppt/platform-policy';
import {
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '@ppt/repositories';
import { FamilyDataStore } from '../src/main/data-store.js';
import type { DeviceSecretProtector } from '../src/main/device-secret-protector.js';
import { ProtectedSideArtifactStore } from '../src/main/protected-side-artifact-store.js';

const temporaryDirectories: string[] = [];
const POLICY_VERSION = '33-q-local-ocr-data-store-production-v1';
const RAW_OCR_TEXT = 'OCR-PLAINTEXT-MUST-NOT-PERSIST';
const CORRECTED_OCR_TEXT = 'CORRECTED-OCR-PLAINTEXT-MUST-NOT-PERSIST';
const PDF_BYTES = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n', 'ascii');

class AdjustableClock implements Clock {
  #currentMs = Date.now() - (3 * 24 * 60 * 60 * 1_000);

  public now() {
    this.#currentMs += 1;
    return asIsoDateTime(new Date(this.#currentMs).toISOString());
  }

  public advanceDays(days: number): void {
    this.#currentMs += days * 24 * 60 * 60 * 1_000;
  }
}

const protector: DeviceSecretProtector = Object.freeze({
  protectionId: '33-q-test-secret-protector',
  required: false,
  isAvailable: () => true,
  protect: (secret: string) => Buffer.from(`protected:${secret}`, 'utf8').toString('base64'),
  unprotect: (protectedBase64: string) => {
    const value = Buffer.from(protectedBase64, 'base64').toString('utf8');
    if (!value.startsWith('protected:')) throw new Error('invalid protected test secret');
    return value.slice('protected:'.length);
  }
});

const kernel = new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('33-q-local-ocr-data-store-policy-signing-key-v1', 'utf8'),
  applicationCapabilities: {
    'windows-desktop': [
      'family.read',
      'family.write',
      'archive.read',
      'archive.write',
      'archive.ocr'
    ]
  },
  consentRequiredCapabilities: ['archive.ocr'],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'process', 'record']
});

let projectionSequence = 0;
const projectionProof = (record: PlatformPolicyReceiptRecord): PlatformPolicyJournalProjectionProof => {
  projectionSequence += 1;
  const entryHash = createHash('sha256').update(`entry:${projectionSequence}`, 'utf8').digest('hex');
  return Object.freeze({
    schemaVersion: 1,
    receiptHash: computePlatformPolicyReceiptHash(record.receipt),
    recordHash: computePlatformPolicyReceiptRecordHash(record),
    receiptNonce: record.receipt.nonce,
    entrySequence: projectionSequence,
    entryHash,
    headSequence: projectionSequence,
    headHash: entryHash,
    journalSizeBytes: projectionSequence * 512,
    issuedAt: record.recordedAt,
    proofMac: createHash('sha256').update(`proof:${projectionSequence}`, 'utf8').digest('hex')
  });
};

const productionPolicyOptions = (requests: PlatformPolicyRequest[]) => {
  const provider: PlatformPolicyAuthorizationProvider = Object.freeze({
    resolvePolicyPackage: () => kernel.policyPackage,
    authorize: ({ request, nonce }) => {
      requests.push(request);
      return Object.freeze({
        effectiveRequest: request,
        authorization: kernel.authorizeWithReceipt(request, request.occurredAt, nonce)
      });
    },
    verify: ({ request, receipt }) => kernel.verifyReceiptForRequest(receipt, request)
  });
  return Object.freeze({
    archivePolicyAuthorizationProvider: provider,
    archivePolicyReceiptSink: Object.freeze({
      append: () => undefined,
      ensure: projectionProof,
      verifyProjectionProof: () => true
    }),
    archivePolicyVersion: POLICY_VERSION,
    archiveClusterFence: () => Object.freeze({ writable: true, epoch: 33 })
  });
};

interface RuntimeResult {
  readonly sealedResultId: string;
  readonly inputSha256: string;
  readonly text: string;
  readonly contentSha256: string;
}

class DeterministicBoundedOcrRuntime implements LocalGovernedOcrRuntimePort {
  readonly #results = new Map<string, RuntimeResult>();
  readonly #runCounts = new Map<string, number>();
  public runCalls = 0;
  public purgeCalls = 0;
  public mismatchNextRun = false;
  public failNextPurge = false;

  public hasResult(jobId: string): boolean {
    return this.#results.has(jobId);
  }

  public async runAndSeal(
    input: Parameters<LocalGovernedOcrRuntimePort['runAndSeal']>[0]
  ): ReturnType<LocalGovernedOcrRuntimePort['runAndSeal']> {
    this.runCalls += 1;
    const runCount = (this.#runCounts.get(input.jobId) ?? 0) + 1;
    this.#runCounts.set(input.jobId, runCount);
    const text = `${RAW_OCR_TEXT}:${input.jobId}:run-${runCount}`;
    const contentSha256 = createHash('sha256').update(text, 'utf8').digest('hex');
    const sealedResultId = createHash('sha256')
      .update(`${input.jobId}\u0000${runCount}\u0000${contentSha256}`, 'utf8')
      .digest('hex');
    const inputSha256 = this.mismatchNextRun ? 'f'.repeat(64) : input.expectedInputSha256;
    this.mismatchNextRun = false;
    if (inputSha256 === input.expectedInputSha256) {
      this.#results.set(input.jobId, { sealedResultId, inputSha256, text, contentSha256 });
    }
    return ok({
      status: 'completed',
      sealedResultId,
      inputSha256,
      contentSha256,
      characterCount: text.length,
      pageCount: 1,
      confidenceBasisPoints: 9_500,
      completedAt: asIsoDateTime(new Date(Date.now() + this.runCalls).toISOString()),
      networkUsed: false,
      cloudUsed: false
    });
  }

  public async correctAndSeal(
    input: Parameters<LocalGovernedOcrRuntimePort['correctAndSeal']>[0]
  ): ReturnType<LocalGovernedOcrRuntimePort['correctAndSeal']> {
    const previous = this.#results.get(input.jobId);
    if (!previous || previous.sealedResultId !== input.previousSealedResultId) {
      return err(this.#notFound(input.correlationId));
    }
    const contentSha256 = createHash('sha256').update(input.correctedText, 'utf8').digest('hex');
    const sealedResultId = createHash('sha256')
      .update(`${previous.sealedResultId}\u0000${contentSha256}`, 'utf8')
      .digest('hex');
    this.#results.set(input.jobId, {
      sealedResultId,
      inputSha256: input.expectedInputSha256,
      text: input.correctedText,
      contentSha256
    });
    return ok({
      sealedResultId,
      inputSha256: input.expectedInputSha256,
      contentSha256,
      characterCount: input.correctedText.length,
      pageCount: 1,
      confidenceBasisPoints: 10_000,
      completedAt: asIsoDateTime(new Date(Date.now() + 100).toISOString()),
      networkUsed: false,
      cloudUsed: false
    });
  }

  public async readSealedResult(
    input: Parameters<LocalGovernedOcrRuntimePort['readSealedResult']>[0]
  ): ReturnType<LocalGovernedOcrRuntimePort['readSealedResult']> {
    const result = this.#results.get(input.jobId);
    if (!result || result.sealedResultId !== input.sealedResultId) {
      return err(this.#notFound(input.correlationId));
    }
    return ok({
      text: result.text,
      contentSha256: result.contentSha256,
      networkUsed: false,
      cloudUsed: false
    });
  }

  public async requestCancellation(): ReturnType<LocalGovernedOcrRuntimePort['requestCancellation']> {
    return ok({ accepted: true });
  }

  public async purgeSealedResult(
    input: Parameters<LocalGovernedOcrRuntimePort['purgeSealedResult']>[0]
  ): ReturnType<LocalGovernedOcrRuntimePort['purgeSealedResult']> {
    this.purgeCalls += 1;
    if (this.failNextPurge) {
      this.failNextPurge = false;
      return err(createAppError({
        code: ERROR_CODES.CORE_UNEXPECTED,
        category: 'infrastructure',
        message: 'injected verified-purge failure',
        correlationId: input.correlationId
      }));
    }
    const current = this.#results.get(input.jobId);
    if (current && current.sealedResultId !== input.sealedResultId) {
      return err(this.#notFound(input.correlationId));
    }
    this.#results.delete(input.jobId);
    return ok({ deleted: true, verified: true });
  }

  #notFound(correlationId: CorrelationId) {
    return createAppError({
      code: ERROR_CODES.RESOURCE_NOT_FOUND,
      category: 'not_found',
      message: 'sealed test result not found',
      correlationId
    });
  }
}

interface OcrFixture {
  readonly directory: string;
  readonly databasePath: string;
  readonly archivePath: string;
  readonly sourcePath: string;
  readonly sourceId: string;
  readonly accountId: string;
  readonly personId: string;
  readonly consentId: string;
  readonly clock: AdjustableClock;
  readonly requests: PlatformPolicyRequest[];
  readonly store: FamilyDataStore;
}

const prepareOcrFixture = async (input: {
  readonly runtime?: LocalGovernedOcrRuntimePort;
  readonly protectedResults?: boolean;
} = {}): Promise<OcrFixture> => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-33q-ocr-data-store-'));
  temporaryDirectories.push(directory);
  const databasePath = join(directory, 'family.db');
  const archivePath = join(directory, 'archive-vault');
  const sourcePath = join(directory, 'source.pdf');
  const clock = new AdjustableClock();
  const requests: PlatformPolicyRequest[] = [];
  const protectedSideArtifacts = input.protectedResults
    ? new ProtectedSideArtifactStore({
        keyPath: join(directory, 'protected-side-artifact.key'),
        applicationVersion: '33-q-test',
        protector,
        now: () => clock.now()
      })
    : undefined;
  const store = new FamilyDataStore({
    databasePath,
    archivePath,
    seed: false,
    clock,
    ...productionPolicyOptions(requests),
    ...(input.runtime === undefined ? {} : { localGovernedOcrRuntime: input.runtime }),
    ...(protectedSideArtifacts === undefined ? {} : { protectedSideArtifacts })
  });
  try {
  store.setupAdmin({
    familyName: '33-Q OCR Test Ailesi',
    displayName: '33-Q OCR Yöneticisi',
    password: 'Guclu33QOcrTestParolasi!2026'
  });
  const accountId = store.listAccounts()[0]!.id;
  writeFileSync(sourcePath, PDF_BYTES);
  const archiveItems = await store.importArchiveFile(sourcePath, {
    title: '33-Q Yerel OCR Kaynağı',
    operationId: '33-q-ocr-source-import-operation'
  });
  const source = archiveItems.find((item) => item.title === '33-Q Yerel OCR Kaynağı')!;
  const retentionPolicy = (await store.createArchiveRetentionPolicy({
    name: '33-Q Bir Günlük OCR Saklama',
    retentionDays: 1,
    secureDestroy: true,
    operationId: '33-q-ocr-retention-policy-operation'
  })).find((policy) => policy.name === '33-Q Bir Günlük OCR Saklama')!;
  await store.assignArchiveRetentionPolicy({
    itemId: source.id,
    policyId: retentionPolicy.id,
    operationId: '33-q-ocr-retention-assign-operation'
  });

  const database = new DatabaseSync(databasePath);
  const person = database.prepare('SELECT id FROM people WHERE family_id=? ORDER BY created_at LIMIT 1')
    .get('family-main') as { readonly id: string } | undefined;
  const trustedDevice = database.prepare(
    'SELECT account_id,device_id,fingerprint,public_key_pem,revoked_at FROM trusted_devices WHERE account_id=?'
  ).get(accountId) as Record<string, unknown> | undefined;
  const archive = database.prepare(`
    SELECT source.family_id,source.original_name,source.mime_type,source.size_bytes,source.sha256,source.destroyed_at,
      json_extract(receipt.record_json,'$.request.subject.accountId') receipt_account_id,
      json_extract(receipt.record_json,'$.request.resource.ownerPersonId') receipt_owner_person_id
    FROM archive_items source
    JOIN platform_policy_transaction_receipts receipt ON receipt.receipt_hash=source.policy_receipt_hash
    WHERE source.id=?
  `).get(source.id) as Record<string, unknown> | undefined;
  expect(person?.id).toBeTruthy();
  expect(trustedDevice).toMatchObject({ account_id: accountId, revoked_at: null });
  expect(String(trustedDevice?.device_id)).not.toHaveLength(0);
  expect(String(trustedDevice?.fingerprint)).not.toHaveLength(0);
  expect(String(trustedDevice?.public_key_pem)).toContain('PUBLIC KEY');
  expect(archive).toMatchObject({
    family_id: 'family-main',
    original_name: 'source.pdf',
    mime_type: 'application/pdf',
    size_bytes: PDF_BYTES.byteLength,
    sha256: createHash('sha256').update(PDF_BYTES).digest('hex'),
    destroyed_at: null,
    receipt_account_id: accountId,
    receipt_owner_person_id: person?.id
  });
  const consentId = '33-q-sensitive-processing-consent';
  const consentTime = clock.now();
  database.prepare(`
    INSERT INTO ai_consents(
      id,account_id,purpose,resource_type,resource_id,status,starts_at,ends_at,created_at
    ) VALUES(?,?,?,?,?,'granted',?,NULL,?)
  `).run(
    consentId,
    accountId,
    'sensitive_processing',
    'archive_item',
    source.id,
    consentTime,
    consentTime
  );
  const consent = database.prepare(
    'SELECT account_id,purpose,resource_type,resource_id,status FROM ai_consents WHERE id=?'
  ).get(consentId);
  expect(consent).toMatchObject({
    account_id: accountId,
    purpose: 'sensitive_processing',
    resource_type: 'archive_item',
    resource_id: source.id,
    status: 'granted'
  });
  database.close();
  return {
    directory,
    databasePath,
    archivePath,
    sourcePath,
    sourceId: source.id,
    accountId,
    personId: person!.id,
    consentId,
    clock,
    requests,
    store
  };
  } catch (error) {
    store.close();
    throw error;
  }
};

const inspectDatabase = <T>(databasePath: string, operation: (database: DatabaseSync) => T): T => {
  const database = new DatabaseSync(databasePath);
  try { return operation(database); }
  finally { database.close(); }
};

afterEach(() => {
  projectionSequence = 0;
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

describe('33-Q Local OCR DataStore production composition', () => {
  it('fails closed without central policy and rejects an overlapping protected result root', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppt-33q-ocr-fail-closed-'));
    temporaryDirectories.push(directory);
    const ungoverned = new FamilyDataStore({
      databasePath: join(directory, 'ungoverned.db'),
      seed: false
    });
    ungoverned.setupAdmin({
      familyName: 'Fail Closed Ailesi',
      displayName: 'Fail Closed Yöneticisi',
      password: 'GucluFailClosedParolasi!2026'
    });
    try {
      await expect(ungoverned.getLocalGovernedOcrCenter()).rejects.toThrow(
        /merkezi politika.*güvenli biçimde durduruldu/u
      );
    } finally {
      ungoverned.close();
    }

    const databasePath = join(directory, 'overlap.db');
    const archivePath = join(directory, 'overlapping-archive');
    const protectedSideArtifacts = new ProtectedSideArtifactStore({
      keyPath: join(directory, 'side-artifact.key'),
      applicationVersion: '33-q-test',
      protector
    });
    const externalDatabase = new DatabaseSync(databasePath);
    try {
      expect(() => new FamilyDataStore({
        databasePath,
        databaseConnection: externalDatabase,
        archivePath,
        localGovernedOcrResultPath: archivePath,
        protectedSideArtifacts,
        seed: false,
        ...productionPolicyOptions([])
      })).toThrow(/result root must be separate/u);
    } finally {
      externalDatabase.close();
    }
  });

  it('composes the protected default runtime and fails closed when no malware provider is configured', async () => {
    const fixture = await prepareOcrFixture({ protectedResults: true });
    try {
      const initial = await fixture.store.getLocalGovernedOcrCenter();
      expect(initial).toMatchObject({
        schemaVersion: 1,
        key: {
          familyId: 'family-main',
          accountId: fixture.accountId,
          ownerPersonId: fixture.personId
        },
        settings: { revision: 0, enabled: true },
        truth: {
          executionScope: 'bounded_child_process',
          sourceBytesExposedToRenderer: false,
          plaintextResultPersistedInRepository: false,
          networkUsed: false,
          cloudUsed: false,
          providerDeliveryGuaranteed: false
        }
      });
      const created = await fixture.store.createLocalGovernedOcrJob({
        sourceResourceType: 'archive_item',
        sourceResourceId: fixture.sourceId,
        languageHints: ['tr-TR'],
        expectedRevision: 0,
        clientOperationId: '33-q-default-runtime-create'
      });
      const run = await fixture.store.runLocalGovernedOcrJob({
        jobId: created.resourceId,
        expectedRevision: 1,
        clientOperationId: '33-q-default-runtime-run'
      });
      expect(run).toMatchObject({ mutationKind: 'job_run', revision: 3, replayed: false });
      const failed = (await fixture.store.getLocalGovernedOcrCenter()).jobs
        .find((job) => job.id === created.resourceId)!;
      expect(failed).toMatchObject({
        status: 'failed',
        resultAvailable: false,
        networkUsed: false,
        cloudUsed: false
      });
      expect(failed.failureCode).toMatch(/^(?:engine_failed|source_unavailable)$/u);
      await expect(fixture.store.getLocalGovernedOcrResult({ jobId: created.resourceId }))
        .rejects.toThrow(/RESOURCE-CONFLICT/u);
      expect(existsSync(`${fixture.databasePath}.local-ocr-results`)).toBe(true);
      expect(fixture.requests.some((request) => request.capability === 'archive.ocr'
        && request.action === 'process')).toBe(true);
    } finally {
      fixture.store.close();
    }
  });

  it('executes the full facade, rolls back mismatches and recovers source deletion with the same operation id', async () => {
    const runtime = new DeterministicBoundedOcrRuntime();
    const fixture = await prepareOcrFixture({ runtime });
    let originalStoreClosed = false;
    let restartedStore: FamilyDataStore | undefined;
    try {
      const center = await fixture.store.getLocalGovernedOcrCenter();
      expect(center.settings).toMatchObject({ revision: 0, enabled: true });
      expect(center.truth.sourceDeletionAutoResumeGuaranteed).toBe(true);

      const createCommand = {
        sourceResourceType: 'archive_item' as const,
        sourceResourceId: fixture.sourceId,
        languageHints: ['tr-TR'],
        expectedRevision: 0,
        clientOperationId: '33-q-full-create-primary'
      };
      const created = await fixture.store.createLocalGovernedOcrJob(createCommand);
      const createReplay = await fixture.store.createLocalGovernedOcrJob(createCommand);
      expect(created).toMatchObject({ mutationKind: 'job_create', revision: 1, replayed: false });
      expect(createReplay).toMatchObject({ resourceId: created.resourceId, replayed: true });

      const runCommand = {
        jobId: created.resourceId,
        expectedRevision: 1,
        clientOperationId: '33-q-full-run-primary'
      };
      const run = await fixture.store.runLocalGovernedOcrJob(runCommand);
      const runReplay = await fixture.store.runLocalGovernedOcrJob(runCommand);
      expect(run).toMatchObject({ mutationKind: 'job_run', revision: 3, replayed: false });
      expect(runReplay).toMatchObject({ revision: 3, replayed: true });
      expect(runtime.runCalls).toBe(1);
      await expect(fixture.store.runLocalGovernedOcrJob({
        ...runCommand,
        expectedRevision: 3
      })).rejects.toThrow(/RESOURCE-CONFLICT/u);

      const firstResult = await fixture.store.getLocalGovernedOcrResult({ jobId: created.resourceId });
      expect(firstResult).toMatchObject({
        jobId: created.resourceId,
        revision: 3,
        corrected: false,
        payloadSource: 'sealed_local_result',
        networkUsed: false,
        cloudUsed: false
      });
      expect(firstResult.text).toContain(RAW_OCR_TEXT);

      const corrected = await fixture.store.correctLocalGovernedOcrResult({
        jobId: created.resourceId,
        correctedText: CORRECTED_OCR_TEXT,
        expectedRevision: 3,
        clientOperationId: '33-q-full-correct-primary'
      });
      expect(corrected).toMatchObject({ mutationKind: 'result_correct', revision: 4 });
      expect(await fixture.store.getLocalGovernedOcrResult({ jobId: created.resourceId }))
        .toMatchObject({ text: CORRECTED_OCR_TEXT, corrected: true, revision: 4 });

      const rerun = await fixture.store.rerunLocalGovernedOcrJob({
        jobId: created.resourceId,
        languageHints: ['tr-TR', 'en-US'],
        expectedRevision: 4,
        clientOperationId: '33-q-full-rerun-primary'
      });
      expect(rerun).toMatchObject({ mutationKind: 'job_rerun', revision: 5 });
      const secondRun = await fixture.store.runLocalGovernedOcrJob({
        jobId: created.resourceId,
        expectedRevision: 5,
        clientOperationId: '33-q-full-run-primary-second'
      });
      expect(secondRun).toMatchObject({ mutationKind: 'job_run', revision: 7 });
      const deleted = await fixture.store.deleteLocalGovernedOcrJob({
        jobId: created.resourceId,
        reason: 'Kullanıcı tarafından yerel OCR sonucu silindi.',
        expectedRevision: 7,
        clientOperationId: '33-q-full-delete-primary'
      });
      expect(deleted).toMatchObject({ mutationKind: 'job_delete', revision: 8 });
      expect(runtime.hasResult(created.resourceId)).toBe(false);

      const disabled = await fixture.store.setLocalGovernedOcrEnabled({
        enabled: false,
        reason: 'Kullanıcı yerel işlemeyi geçici olarak kapattı.',
        expectedRevision: 0,
        clientOperationId: '33-q-full-settings-disable'
      });
      const disabledReplay = await fixture.store.setLocalGovernedOcrEnabled({
        enabled: false,
        reason: 'Kullanıcı yerel işlemeyi geçici olarak kapattı.',
        expectedRevision: 0,
        clientOperationId: '33-q-full-settings-disable'
      });
      expect(disabled).toMatchObject({ mutationKind: 'processing_disable', revision: 1, replayed: false });
      expect(disabledReplay).toMatchObject({ revision: 1, replayed: true });
      const enabled = await fixture.store.setLocalGovernedOcrEnabled({
        enabled: true,
        reason: 'Kullanıcı yerel işlemeyi yeniden etkinleştirdi.',
        expectedRevision: 1,
        clientOperationId: '33-q-full-settings-enable'
      });
      expect(enabled).toMatchObject({ mutationKind: 'processing_enable', revision: 2 });

      const cancelledJob = await fixture.store.createLocalGovernedOcrJob({
        ...createCommand,
        clientOperationId: '33-q-full-create-cancelled'
      });
      const cancelled = await fixture.store.cancelLocalGovernedOcrJob({
        jobId: cancelledJob.resourceId,
        expectedRevision: 1,
        clientOperationId: '33-q-full-cancel-queued'
      });
      expect(cancelled).toMatchObject({ mutationKind: 'job_cancel', revision: 2 });
      const cancelledRerun = await fixture.store.rerunLocalGovernedOcrJob({
        jobId: cancelledJob.resourceId,
        expectedRevision: 2,
        clientOperationId: '33-q-full-rerun-cancelled'
      });
      expect(cancelledRerun).toMatchObject({ mutationKind: 'job_rerun', revision: 3 });
      await fixture.store.runLocalGovernedOcrJob({
        jobId: cancelledJob.resourceId,
        expectedRevision: 3,
        clientOperationId: '33-q-full-run-cancelled'
      });

      const rollbackJob = await fixture.store.createLocalGovernedOcrJob({
        ...createCommand,
        clientOperationId: '33-q-full-create-rollback'
      });
      runtime.mismatchNextRun = true;
      const rollbackRun = {
        jobId: rollbackJob.resourceId,
        expectedRevision: 1,
        clientOperationId: '33-q-full-run-rollback'
      };
      await expect(fixture.store.runLocalGovernedOcrJob(rollbackRun))
        .rejects.toThrow(/PERMISSION-DENIED-001/u);
      const afterRollback = (await fixture.store.getLocalGovernedOcrCenter()).jobs
        .find((job) => job.id === rollbackJob.resourceId)!;
      expect(afterRollback).toMatchObject({ status: 'running', revision: 2, resultAvailable: false });
      expect(inspectDatabase(fixture.databasePath, (database) => Number((database.prepare(
        'SELECT COUNT(*) AS value FROM local_governed_ocr_mutations WHERE client_operation_id=?'
      ).get(rollbackRun.clientOperationId) as { readonly value: number }).value))).toBe(0);
      const retriedRollback = await fixture.store.runLocalGovernedOcrJob(rollbackRun);
      expect(retriedRollback).toMatchObject({ mutationKind: 'job_run', revision: 3, replayed: false });

      fixture.clock.advanceDays(2);
      expect(fixture.store.login({
        accountId: fixture.accountId,
        password: 'Guclu33QOcrTestParolasi!2026'
      })).toMatchObject({ authenticated: true });
      const storedName = inspectDatabase(fixture.databasePath, (database) => String((database.prepare(
        'SELECT stored_name FROM archive_items WHERE id=?'
      ).get(fixture.sourceId) as { readonly stored_name: string }).stored_name));
      const storedPath = join(fixture.archivePath, storedName);
      const preservedPath = `${storedPath}.preserved`;
      renameSync(storedPath, preservedPath);
      mkdirSync(storedPath);
      const archiveDeleteIntent = {
        mutation: 'archive:secureDestroy' as const,
        semanticInput: { itemId: fixture.sourceId }
      };
      const archiveDeleteOperationId = fixture.store.acquireArchivePendingOperationIdentity(
        archiveDeleteIntent
      ).operationId;
      fixture.store.requireArchivePendingOperationIdentity({
        ...archiveDeleteIntent,
        operationId: archiveDeleteOperationId
      });
      const purgeCallsBeforeDestroyFailure = runtime.purgeCalls;
      await expect(fixture.store.securelyDestroyArchiveItem(
        fixture.sourceId,
        archiveDeleteOperationId
      )).rejects.toThrow(/CORE-UNEXPECTED/u);
      expect(runtime.purgeCalls).toBe(purgeCallsBeforeDestroyFailure);
      expect(inspectDatabase(fixture.databasePath, (database) => database.prepare(`
        SELECT COUNT(*) AS value FROM local_governed_ocr_mutations
        WHERE mutation_kind='source_delete_propagate' AND resource_id=?
      `).get(fixture.sourceId))).toMatchObject({ value: 0 });
      expect(inspectDatabase(fixture.databasePath, (database) => database.prepare(`
        SELECT COUNT(*) AS value FROM local_governed_ocr_jobs
        WHERE source_resource_id=? AND source_deleted_at IS NOT NULL
      `).get(fixture.sourceId))).toMatchObject({ value: 0 });
      rmSync(storedPath, { recursive: true, force: true });
      renameSync(preservedPath, storedPath);

      runtime.failNextPurge = true;
      await expect(fixture.store.securelyDestroyArchiveItem(
        fixture.sourceId,
        archiveDeleteOperationId
      )).rejects.toThrow(/injected verified-purge failure/u);
      expect(existsSync(storedPath)).toBe(false);
      expect(inspectDatabase(fixture.databasePath, (database) => database.prepare(
        'SELECT destroyed_at FROM archive_items WHERE id=?'
      ).get(fixture.sourceId))).toMatchObject({ destroyed_at: null });
      expect(inspectDatabase(fixture.databasePath, (database) => database.prepare(`
        SELECT COUNT(*) AS value FROM local_governed_ocr_mutations
        WHERE mutation_kind='source_delete_propagate' AND resource_id=?
      `).get(fixture.sourceId))).toMatchObject({ value: 0 });

      fixture.store.close();
      originalStoreClosed = true;
      restartedStore = new FamilyDataStore({
        databasePath: fixture.databasePath,
        archivePath: fixture.archivePath,
        seed: false,
        clock: fixture.clock,
        ...productionPolicyOptions(fixture.requests),
        localGovernedOcrRuntime: runtime
      });
      expect(restartedStore.login({
        accountId: fixture.accountId,
        password: 'Guclu33QOcrTestParolasi!2026'
      })).toMatchObject({ authenticated: true });
      await expect(restartedStore.resumePendingLocalGovernedOcrArchiveDeletions()).resolves.toEqual({
        attempted: 1,
        completed: 1,
        failed: 0
      });
      const deletionState = inspectDatabase(fixture.databasePath, (database) => ({
        archive: database.prepare('SELECT destroyed_at FROM archive_items WHERE id=?').get(fixture.sourceId),
        jobs: database.prepare(`
          SELECT status,deletion_propagation,source_deleted_at,result_available,sealed_result_id
          FROM local_governed_ocr_jobs WHERE source_resource_id=? ORDER BY id
        `).all(fixture.sourceId),
        mutations: database.prepare(`
          SELECT mutation_kind,resource_id FROM local_governed_ocr_mutations
          WHERE mutation_kind='source_delete_propagate' AND resource_id=?
        `).all(fixture.sourceId),
        pending: database.prepare(`
          SELECT pending.acknowledgement_kind,pending.acknowledged_at,recovery.source_resource_id
          FROM platform_policy_archive_pending_operations pending
          JOIN local_governed_ocr_source_deletion_recovery_intents recovery
            ON recovery.operation_id=pending.operation_id
          WHERE pending.operation_id=?
        `).get(archiveDeleteOperationId)
      }));
      expect(deletionState.archive).toMatchObject({ destroyed_at: expect.any(String) });
      expect(deletionState.jobs).toHaveLength(3);
      expect(deletionState.jobs).toEqual(expect.arrayContaining([
        expect.objectContaining({
          status: 'deleted',
          deletion_propagation: 'locally_deleted',
          source_deleted_at: expect.any(String),
          result_available: 0,
          sealed_result_id: null
        })
      ]));
      expect(deletionState.mutations).toEqual([
        expect.objectContaining({ mutation_kind: 'source_delete_propagate', resource_id: fixture.sourceId })
      ]);
      expect(deletionState.pending).toMatchObject({
        acknowledgement_kind: 'completed',
        acknowledged_at: expect.any(String),
        source_resource_id: fixture.sourceId
      });
      expect(runtime.hasResult(cancelledJob.resourceId)).toBe(false);
      expect(runtime.hasResult(rollbackJob.resourceId)).toBe(false);

      const persisted = inspectDatabase(fixture.databasePath, (database) => JSON.stringify({
        jobs: database.prepare('SELECT * FROM local_governed_ocr_jobs').all(),
        settings: database.prepare('SELECT * FROM local_governed_ocr_settings').all(),
        mutations: database.prepare('SELECT * FROM local_governed_ocr_mutations').all(),
        bindings: database.prepare('SELECT * FROM derived_data_policy_bindings').all(),
        audit: database.prepare("SELECT * FROM audit_log WHERE action LIKE 'ocr.%'").all(),
        outbox: database.prepare("SELECT * FROM event_outbox WHERE event_type='ocr.state.changed'").all()
      }));
      expect(persisted).not.toContain(RAW_OCR_TEXT);
      expect(persisted).not.toContain(CORRECTED_OCR_TEXT);
      expect(persisted).not.toContain(fixture.sourcePath);
      expect(fixture.requests).toEqual(expect.arrayContaining([
        expect.objectContaining({
          resource: expect.objectContaining({ type: 'local_ocr_settings' }),
          action: 'read',
          capability: 'family.read',
          purpose: 'administration'
        }),
        expect.objectContaining({
          resource: expect.objectContaining({ type: 'local_ocr_result' }),
          action: 'process',
          capability: 'archive.ocr',
          purpose: 'ocr_process'
        }),
        expect.objectContaining({
          resource: expect.objectContaining({ type: 'archive_item', id: fixture.sourceId }),
          action: 'delete',
          capability: 'archive.write',
          purpose: 'ocr_process'
        })
      ]));
    } finally {
      restartedStore?.close();
      if (!originalStoreClosed) fixture.store.close();
    }
  });
});
