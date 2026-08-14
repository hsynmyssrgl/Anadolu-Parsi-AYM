import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
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
import {
  LOCAL_GOVERNED_OCR_MAX_PAGES,
  LOCAL_GOVERNED_OCR_MAX_RESULT_CHARACTERS,
  LOCAL_GOVERNED_OCR_MAX_SOURCE_BYTES,
  canonicalLocalGovernedOcrJobStateJson,
  canonicalLocalGovernedOcrSettingsStateJson,
  type LocalGovernedOcrJobView,
  type LocalGovernedOcrSettingsView
} from '@ppt/domain';
import type { DerivedDataPolicyBinding, DerivedDataSourcePolicySnapshot } from '@ppt/platform-policy';
import type {
  LocalGovernedOcrConsentRow,
  LocalGovernedOcrAuthorizationReconciliationCandidate,
  LocalGovernedOcrAuthorizationRevocationReason,
  LocalGovernedOcrJobRow,
  LocalGovernedOcrMutationRow,
  LocalGovernedOcrSourceDeletionBatch,
  LocalGovernedOcrSourceRow
} from '@ppt/repository-contracts';
import {
  CancelLocalGovernedOcrJobUseCase,
  CorrectLocalGovernedOcrResultUseCase,
  CreateLocalGovernedOcrJobUseCase,
  DeleteLocalGovernedOcrJobUseCase,
  GetLocalGovernedOcrCenterUseCase,
  GetLocalGovernedOcrResultUseCase,
  PropagateLocalGovernedOcrSourceDeletionUseCase,
  ReconcileLocalGovernedOcrAuthorizationUseCase,
  RerunLocalGovernedOcrJobUseCase,
  RunLocalGovernedOcrJobUseCase,
  SetLocalGovernedOcrEnabledUseCase,
  localGovernedOcrSettingsResourceId,
  type LocalGovernedOcrApplicationContext,
  type LocalGovernedOcrAuthorizationPlan,
  type LocalGovernedOcrOperationIdentifiers,
  type LocalGovernedOcrRunOutcome,
  type LocalGovernedOcrRuntimePort,
  type LocalGovernedOcrSealedResult,
  type LocalGovernedOcrUnitOfWork,
  type LocalGovernedOcrWriteScope
} from '../src/local-governed-ocr-use-cases.js';

const NOW = asIsoDateTime('2026-08-14T10:00:00.000Z');
const PURGED_AT = asIsoDateTime('2026-08-14T10:05:00.000Z');
const FAMILY = asFamilyId('family-33-q');
const ACCOUNT = asUserId('account-33-q');
const PERSON = asPersonId('person-33-q');
const SOURCE_ID = 'archive-33-q';
const SOURCE_SHA = 'a'.repeat(64);
const RESULT_SHA = 'b'.repeat(64);
const CORRECTED_SHA = 'c'.repeat(64);
const key = Object.freeze({ familyId: FAMILY, accountId: ACCOUNT, ownerPersonId: PERSON });
const context: LocalGovernedOcrApplicationContext = Object.freeze({
  familyId: FAMILY,
  actor: { userId: ACCOUNT, role: 'family_admin', personId: PERSON },
  correlationId: asCorrelationId('local-ocr-33-q-test')
});
const hash = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const ids = (resourceId: string, suffix: string, requestFingerprint = hash(`request:${suffix}`)):
LocalGovernedOcrOperationIdentifiers => ({
  mutationId: `mutation-${suffix}`,
  resourceId,
  requestFingerprint,
  auditId: `audit-${suffix}`,
  outboxEventId: asEventId(`event-${suffix}`)
});

const sourcePolicy = (): DerivedDataSourcePolicySnapshot => Object.freeze({
  schemaVersion: 1,
  resourceType: 'archive_item',
  resourceId: SOURCE_ID,
  resourceVersion: 'archive-v1',
  contentSha256: SOURCE_SHA,
  familyId: FAMILY,
  policyVersion: '33-q-policy-v1',
  policyPackageSha256: hash('policy-package'),
  receiptActive: true,
  receiptHash: hash('fresh-source-receipt'),
  contextHash: hash('fresh-source-context'),
  requestHash: hash('fresh-source-request'),
  sensitivity: 'sensitive',
  dataClasses: ['personal'],
  allowedAccountIds: [ACCOUNT],
  allowedApplicationIds: ['windows-desktop'],
  allowedCapabilities: ['archive.ocr'],
  allowedActions: ['read', 'process'],
  allowedPurposes: ['ocr_process'],
  obligations: [],
  retentionUntil: '2027-08-14T10:00:00.000Z',
  lineageDepth: 0,
  ancestorResources: []
});

const source = (): LocalGovernedOcrSourceRow => Object.freeze({
  key,
  resourceType: 'archive_item',
  resourceId: SOURCE_ID,
  inputSha256: SOURCE_SHA,
  mimeType: 'image/png',
  sizeBytes: 1024,
  sourcePolicy: sourcePolicy()
});

const consent = (): LocalGovernedOcrConsentRow => Object.freeze({
  id: 'consent-33-q',
  key,
  purpose: 'sensitive_processing',
  resourceType: 'archive_item',
  resourceId: SOURCE_ID,
  status: 'granted',
  startsAt: asIsoDateTime('2026-08-01T00:00:00.000Z'),
  endsAt: asIsoDateTime('2026-09-01T00:00:00.000Z')
});

const settingsRow = (enabled = true, revision = 0): LocalGovernedOcrSettingsView & { readonly stateFingerprint: string } => {
  const view: LocalGovernedOcrSettingsView = {
    key,
    revision,
    enabled,
    ...(enabled ? {} : { disabledReason: 'Kullanıcı yerel OCR işleme özelliğini kapattı', disabledAt: NOW }),
    updatedAt: NOW
  };
  return Object.freeze({ ...view, stateFingerprint: hash(canonicalLocalGovernedOcrSettingsStateJson(view)) });
};

const jobRow = (
  overrides: Partial<LocalGovernedOcrJobView> = {},
  sealedResultId?: string,
  activeRunId?: string
): LocalGovernedOcrJobRow => {
  const view: LocalGovernedOcrJobView = {
    id: 'ocr-job-1',
    key,
    revision: 1,
    source: { resourceType: 'archive_item', resourceId: SOURCE_ID, inputSha256: SOURCE_SHA,
      mimeType: 'image/png', sizeBytes: 1024 },
    derivedResourceId: 'local-ocr-result-1',
    languageHints: ['tr'],
    status: 'queued',
    runAttempt: 0,
    correctionRevision: 0,
    resultAvailable: false,
    consentId: 'consent-33-q',
    consentExpiresAt: asIsoDateTime('2026-09-01T00:00:00.000Z'),
    retentionUntil: asIsoDateTime('2027-08-14T10:00:00.000Z'),
    deletionPropagation: 'active',
    processor: 'local_ocr',
    networkUsed: false,
    cloudUsed: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
  return Object.freeze({ ...view,
    ...(activeRunId === undefined ? {} : { activeRunId }),
    ...(sealedResultId === undefined ? {} : { sealedResultId }),
    stateFingerprint: hash(activeRunId === undefined
      ? canonicalLocalGovernedOcrJobStateJson(view)
      : JSON.stringify({ state: JSON.parse(canonicalLocalGovernedOcrJobStateJson(view)), activeRunId })) });
};

const failure = (message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_UNEXPECTED,
  category: 'unexpected',
  message,
  correlationId: context.correlationId
});

class Unit implements LocalGovernedOcrUnitOfWork {
  public settings = settingsRow();
  public readonly jobs = new Map<string, LocalGovernedOcrJobRow>();
  public readonly mutations = new Map<string, LocalGovernedOcrMutationRow>();
  public source: LocalGovernedOcrSourceRow | null = source();
  public consent: LocalGovernedOcrConsentRow | null = consent();
  public readonly plans: LocalGovernedOcrAuthorizationPlan[] = [];
  public readonly bindings: DerivedDataPolicyBinding[] = [];
  public readonly audits: unknown[] = [];
  public readonly events: unknown[] = [];
  public readonly order: string[] = [];
  public batchCalls = 0;
  public lastBatch?: LocalGovernedOcrSourceDeletionBatch;
  public failAudit = false;
  public failBatch = false;
  public authorizationRevocation: LocalGovernedOcrAuthorizationRevocationReason | null = null;

  public listAuthorizationReconciliationCandidates(
    _context: LocalGovernedOcrApplicationContext,
    requestedKey: typeof key,
    limit: number
  ) {
    if (requestedKey.familyId !== FAMILY || requestedKey.accountId !== ACCOUNT
      || requestedKey.ownerPersonId !== PERSON || this.authorizationRevocation === null) return ok([]);
    return ok(Object.freeze([...this.jobs.values()]
      .filter((row) => row.status === 'completed' && row.resultAvailable && row.sealedResultId)
      .slice(0, limit)
      .map((row): LocalGovernedOcrAuthorizationReconciliationCandidate => Object.freeze({
        jobId: row.id,
        revision: row.revision,
        stateFingerprint: row.stateFingerprint,
        reason: this.authorizationRevocation!
      }))));
  }

  public resolvePolicyResource(
    _context: LocalGovernedOcrApplicationContext,
    requestedKey: typeof key,
    resourceType: 'local_ocr_job' | 'local_ocr_settings',
    resourceId: string
  ) {
    if (requestedKey.familyId !== FAMILY || requestedKey.accountId !== ACCOUNT || requestedKey.ownerPersonId !== PERSON) return ok(null);
    if (resourceType === 'local_ocr_settings') return ok({ familyId: FAMILY, accountId: ACCOUNT,
      ownerPersonId: PERSON, revision: this.settings.revision, stateFingerprint: this.settings.stateFingerprint,
      sensitivity: 'personal' as const, sourceResourceType: null, sourceResourceId: null,
      derivedResourceId: null });
    const row = this.jobs.get(resourceId);
    return ok(row ? { familyId: FAMILY, accountId: ACCOUNT, ownerPersonId: PERSON, revision: row.revision,
      stateFingerprint: row.stateFingerprint, sensitivity: 'sensitive' as const,
      sourceResourceType: 'archive_item' as const, sourceResourceId: row.source.resourceId,
      derivedResourceId: row.derivedResourceId } : null);
  }

  public resolveArchivePolicyResource(
    _context: LocalGovernedOcrApplicationContext,
    requestedKey: typeof key,
    resourceId: string
  ) {
    if (requestedKey.familyId !== FAMILY || requestedKey.accountId !== ACCOUNT
      || requestedKey.ownerPersonId !== PERSON || this.source?.resourceId !== resourceId) return ok(null);
    return ok({ familyId: FAMILY, accountId: ACCOUNT, ownerPersonId: PERSON, revision: 1,
      stateFingerprint: hash(`archive:${resourceId}:${SOURCE_SHA}`), sensitivity: 'sensitive' as const,
      sourceResourceType: null, sourceResourceId: null, derivedResourceId: null });
  }

  public async execute<T>(
    _context: LocalGovernedOcrApplicationContext,
    authorization: LocalGovernedOcrAuthorizationPlan,
    operation: (scope: LocalGovernedOcrWriteScope) => Result<T, AppError> | Promise<Result<T, AppError>>
  ): Promise<Result<T, AppError>> {
    this.plans.push(authorization);
    const checkpoint = {
      settings: this.settings,
      jobs: new Map(this.jobs),
      mutations: new Map(this.mutations),
      bindings: this.bindings.length,
      audits: this.audits.length,
      events: this.events.length,
      order: this.order.length,
      batchCalls: this.batchCalls
    };
    const restore = (): void => {
      this.settings = checkpoint.settings;
      this.jobs.clear(); checkpoint.jobs.forEach((value, id) => this.jobs.set(id, value));
      this.mutations.clear(); checkpoint.mutations.forEach((value, id) => this.mutations.set(id, value));
      this.bindings.length = checkpoint.bindings;
      this.audits.length = checkpoint.audits;
      this.events.length = checkpoint.events;
      this.order.length = checkpoint.order;
      this.batchCalls = checkpoint.batchCalls;
      this.lastBatch = undefined;
    };
    const scope: LocalGovernedOcrWriteScope = {
      occurredAt: NOW,
      loadCenter: () => ok({ settings: this.settings, jobs: [...this.jobs.values()] }),
      findJob: (_key, id) => ok(this.jobs.get(id) ?? null),
      listJobsBySource: (_key, _type, resourceId) => ok([...this.jobs.values()].filter((row) => row.source.resourceId === resourceId)),
      resolveArchiveSource: (_key, resourceId) => ok(this.source?.resourceId === resourceId ? this.source : null),
      resolveActiveSensitiveProcessingConsent: (_key, _type, resourceId) =>
        ok(this.consent?.resourceId === resourceId ? this.consent : null),
      resolveAuthorizationRevocation: (_key, jobId) =>
        ok(this.jobs.has(jobId) ? this.authorizationRevocation : null),
      findMutationByClientOperationId: (_key, operationId) => ok(this.mutations.get(operationId) ?? null),
      findSourceDeletionMutationByClientOperationId: (_key, sourceResourceId, operationId) => {
        const row = this.mutations.get(operationId);
        return ok(row?.mutationKind === 'source_delete_propagate' && row.resourceId === sourceResourceId ? row : null);
      },
      insertJob: (row) => { this.order.push('job.insert'); this.jobs.set(row.id, row); return ok(undefined); },
      saveJob: (row, expectedRevision) => {
        this.order.push('job.save');
        const current = this.jobs.get(row.id);
        if (!current || current.revision !== expectedRevision) return ok(false);
        this.jobs.set(row.id, row); return ok(true);
      },
      saveSettings: (row, expectedRevision) => {
        this.order.push('settings.save');
        if (this.settings.revision !== expectedRevision) return ok(false);
        this.settings = row; return ok(true);
      },
      insertMutation: (row) => { this.order.push('mutation.insert'); this.mutations.set(row.clientOperationId, row); return ok(undefined); },
      propagateSourceDeletion: (batch: LocalGovernedOcrSourceDeletionBatch) => {
        this.order.push('source.batch'); this.batchCalls += 1;
        if (this.failBatch) return err(failure('forced batch failure'));
        for (const item of batch.items) {
          const current = this.jobs.get(item.previous.id);
          if (!current || current.revision !== item.previous.revision || current.stateFingerprint !== item.previous.stateFingerprint) {
            return err(failure('source batch previous row mismatch'));
          }
        }
        this.lastBatch = batch;
        this.mutations.set(batch.batchMutation.clientOperationId, batch.batchMutation);
        for (const item of batch.items) this.jobs.set(item.next.id, item.next);
        return ok(undefined);
      },
      insertDerivedBinding: (binding) => { this.order.push('binding.insert'); this.bindings.push(binding); return ok(undefined); },
      appendAudit: (entry) => {
        this.order.push('audit.append');
        if (this.failAudit) return err(failure('forced audit failure'));
        this.audits.push(entry); return ok(hash(JSON.stringify(entry)));
      },
      enqueueEvent: (event) => { this.order.push('outbox.enqueue'); this.events.push(event); return ok(undefined); }
    };
    try {
      const result = await operation(scope);
      if (!result.ok) restore();
      return result;
    } catch (error) {
      restore();
      return err(failure(error instanceof Error ? error.message : 'unexpected operation error'));
    }
  }

  public async executeDetached<TPrepared, TResult>(
    operationContext: LocalGovernedOcrApplicationContext,
    authorization: LocalGovernedOcrAuthorizationPlan,
    runtimeAuthority: (prepared: TPrepared) => {
      readonly operation: 'run'; readonly runId: string; readonly jobId: string;
      readonly derivedResourceId: string; readonly sourceResourceId: string; readonly expectedInputSha256: string;
    },
    prepare: (scope: LocalGovernedOcrWriteScope) => Result<TPrepared, AppError> | Promise<Result<TPrepared, AppError>>,
    operation: (prepared: TPrepared) => Promise<Result<TResult, AppError>>
  ): Promise<Result<TResult, AppError>> {
    const committed = await this.execute(operationContext, authorization, prepare);
    if (!committed.ok) return committed;
    runtimeAuthority(committed.value);
    return operation(committed.value);
  }
}

class Runtime implements LocalGovernedOcrRuntimePort {
  public runOutcome: LocalGovernedOcrRunOutcome = {
    status: 'completed', sealedResultId: 'sealed-result-1', inputSha256: SOURCE_SHA,
    contentSha256: RESULT_SHA, characterCount: 42, pageCount: 1, completedAt: NOW,
    networkUsed: false, cloudUsed: false
  };
  public corrected: LocalGovernedOcrSealedResult = {
    sealedResultId: 'sealed-result-2', inputSha256: SOURCE_SHA, contentSha256: CORRECTED_SHA,
    characterCount: 24, pageCount: 1, completedAt: NOW, networkUsed: false, cloudUsed: false
  };
  public readonly texts = new Map<string, { text: string; hash: string }>([
    ['sealed-result-1', { text: 'Yerel OCR sonucu', hash: RESULT_SHA }],
    ['sealed-result-2', { text: 'Düzeltilmiş yerel sonuç', hash: CORRECTED_SHA }]
  ]);
  public readonly purges: string[] = [];
  public readonly cancellations: string[] = [];
  public readonly runs: unknown[] = [];
  public failPurge = false;

  public constructor(private readonly order: string[]) {}
  public async runAndSeal(input: Parameters<LocalGovernedOcrRuntimePort['runAndSeal']>[0]) {
    this.runs.push(input); return ok(this.runOutcome);
  }
  public async correctAndSeal() { return ok(this.corrected); }
  public async readSealedResult(input: Parameters<LocalGovernedOcrRuntimePort['readSealedResult']>[0]) {
    const value = this.texts.get(input.sealedResultId);
    return value ? ok({ text: value.text, contentSha256: value.hash, networkUsed: false as const, cloudUsed: false as const })
      : err(failure('sealed result missing'));
  }
  public async requestCancellation(input: Parameters<LocalGovernedOcrRuntimePort['requestCancellation']>[0]) {
    this.order.push(`runtime.cancel:${input.jobId}`); this.cancellations.push(input.jobId);
    return ok({ accepted: true as const });
  }
  public async purgeSealedResult(input: Parameters<LocalGovernedOcrRuntimePort['purgeSealedResult']>[0]) {
    this.order.push(`runtime.purge:${input.jobId}`); this.purges.push(input.jobId);
    if (this.failPurge) return err(failure('forced local sealed-result purge failure'));
    this.texts.delete(input.sealedResultId);
    return ok({ deleted: true as const, verified: true as const });
  }
}

const completedJob = (id = 'ocr-job-1', revision = 2): LocalGovernedOcrJobRow => jobRow({
  id,
  derivedResourceId: `local-ocr-result-${id}`,
  revision,
  status: 'completed',
  runAttempt: 1,
  resultAvailable: true,
  resultContentSha256: RESULT_SHA,
  resultCharacterCount: 42,
  resultPageCount: 1,
  derivedBindingHash: hash(`binding:${id}`),
  completedAt: NOW
}, `sealed-result-${id}`);

describe('33-Q local governed OCR application core', () => {
  it('exposes the bounded local truth and canonical limits without a cloud, renderer-byte or secure-erase claim', async () => {
    const unit = new Unit();
    unit.jobs.set('ocr-job-1', jobRow({ status: 'running', runAttempt: 1 }, undefined, hash('main-only-active-run')));
    const result = await new GetLocalGovernedOcrCenterUseCase(unit).execute(context);
    expect(result.ok && result.value.truth).toEqual({
      executionScope: 'bounded_child_process', lowPrivilegeSandboxVerified: false,
      sourceBytesExposedToRenderer: false, plaintextResultPersistedInRepository: false,
      networkUsed: false, cloudUsed: false, providerDeliveryGuaranteed: false,
      explicitSensitiveProcessingConsentRequired: true, derivedPolicyBindingRequired: true,
      sourceDeletionPropagatesToDerivedResult: true, sourceDeletionAutoResumeGuaranteed: true,
      authorizationRevocationPropagatesToSealedResult: true,
      derivedDeletionDeletesSource: false
    });
    expect(result.ok && result.value.jobs[0]).not.toHaveProperty('activeRunId');
    expect([LOCAL_GOVERNED_OCR_MAX_SOURCE_BYTES, LOCAL_GOVERNED_OCR_MAX_RESULT_CHARACTERS,
      LOCAL_GOVERNED_OCR_MAX_PAGES]).toEqual([16 * 1024 * 1024, 250_000, 50]);
    expect(unit.plans[0]?.primary).toMatchObject({ action: 'read', capability: 'family.read',
      resourceType: 'local_ocr_settings', purpose: 'administration', sensitivity: 'personal' });
  });

  it('creates one metadata-only job with a fresh OCR source receipt, separate consent and exact replay', async () => {
    const unit = new Unit();
    const identifiers = ids('ocr-job-1', 'create-1');
    const useCase = new CreateLocalGovernedOcrJobUseCase(unit);
    const command = { expectedRevision: 0, clientOperationId: 'ocr-create-operation-1',
      sourceResourceType: 'archive_item' as const, sourceResourceId: SOURCE_ID, languageHints: ['tr', 'en'] };
    const created = await useCase.execute({ context, command, identifiers });
    expect(created.ok && created.value).toMatchObject({ revision: 1, replayed: false, sourceResourceDeleted: false });
    expect(unit.plans[0]).toMatchObject({
      primary: { action: 'process', capability: 'archive.ocr', resourceType: 'local_ocr_job', purpose: 'ocr_process' },
      source: { action: 'read', capability: 'archive.ocr', resourceType: 'archive_item', purpose: 'ocr_process' },
      settings: { action: 'read', capability: 'family.read', resourceType: 'local_ocr_settings',
        purpose: 'administration', sensitivity: 'personal' }
    });
    expect(unit.source?.sourcePolicy.allowedPurposes).toEqual(['ocr_process']);
    expect(unit.consent?.purpose).toBe('sensitive_processing');
    expect(unit.order).toEqual(['mutation.insert', 'job.insert', 'audit.append', 'outbox.enqueue']);
    const durableJson = JSON.stringify({ jobs: [...unit.jobs.values()], mutations: [...unit.mutations.values()],
      audits: unit.audits, events: unit.events });
    expect(durableJson).not.toMatch(/(?:document_bytes|file_path|plaintext|Yerel OCR sonucu)/u);

    const replay = await useCase.execute({ context, command, identifiers });
    expect(replay.ok && replay.value.replayed).toBe(true);
    expect(unit.mutations.size).toBe(1);
    expect(unit.audits).toHaveLength(1);
    const mismatch = await useCase.execute({ context, command,
      identifiers: ids('ocr-job-1', 'create-1', hash('different request')) });
    expect(mismatch.ok).toBe(false);
    expect(!mismatch.ok && mismatch.error.code).toBe(ERROR_CODES.RESOURCE_CONFLICT);
  });

  it('fails closed without exact OCR PEP authority or active sensitive-processing consent', async () => {
    const noAuthority = new Unit();
    noAuthority.source = { ...source(), sourcePolicy: { ...sourcePolicy(), allowedPurposes: ['ai_processing'] } };
    const deniedAuthority = await new CreateLocalGovernedOcrJobUseCase(noAuthority).execute({ context,
      command: { expectedRevision: 0, clientOperationId: 'ocr-create-no-authority', sourceResourceType: 'archive_item',
        sourceResourceId: SOURCE_ID, languageHints: ['tr'] }, identifiers: ids('ocr-job-a', 'deny-a') });
    expect(deniedAuthority.ok).toBe(false);
    expect(noAuthority.mutations.size).toBe(0);

    const noConsent = new Unit(); noConsent.consent = null;
    const deniedConsent = await new CreateLocalGovernedOcrJobUseCase(noConsent).execute({ context,
      command: { expectedRevision: 0, clientOperationId: 'ocr-create-no-consent', sourceResourceType: 'archive_item',
        sourceResourceId: SOURCE_ID, languageHints: ['tr'] }, identifiers: ids('ocr-job-b', 'deny-b') });
    expect(deniedConsent.ok).toBe(false);
    expect(!deniedConsent.ok && deniedConsent.error.code).toBe(ERROR_CODES.AUTHORIZATION_DENIED);
  });

  it('runs locally, seals PPK-016 lineage and preserves unavailable confidence as unavailable', async () => {
    const unit = new Unit(); unit.jobs.set('ocr-job-1', jobRow());
    const runtime = new Runtime(unit.order);
    const result = await new RunLocalGovernedOcrJobUseCase(unit, runtime).execute({ context,
      command: { jobId: 'ocr-job-1', expectedRevision: 1, clientOperationId: 'ocr-run-operation-1' },
      identifiers: ids('ocr-job-1', 'run-1') });
    expect(result.ok).toBe(true);
    expect(unit.jobs.get('ocr-job-1')).toMatchObject({ status: 'completed', revision: 3,
      resultAvailable: true, resultContentSha256: RESULT_SHA, runAttempt: 1 });
    expect(unit.jobs.get('ocr-job-1')).not.toHaveProperty('confidenceBasisPoints');
    expect(unit.bindings).toHaveLength(1);
    expect(unit.bindings[0]).toMatchObject({ target: { kind: 'OCR_TEXT', resourceType: 'local_ocr_result',
      allowedCapabilities: ['archive.ocr'], allowedPurposes: ['ocr_process'] } });
    expect(unit.plans[0]?.source).toMatchObject({ action: 'process', resourceId: SOURCE_ID });
    expect(unit.plans[0]?.settings).toMatchObject({ action: 'read', resourceType: 'local_ocr_settings' });
    expect(unit.plans[0]?.target).toMatchObject({ action: 'process', capability: 'archive.ocr',
      resourceType: 'local_ocr_result', resourceId: 'local-ocr-result-1', sourceJobId: 'ocr-job-1',
      purpose: 'ocr_process', sensitivity: 'sensitive' });
    expect(JSON.stringify({ mutation: [...unit.mutations.values()], audits: unit.audits, events: unit.events }))
      .not.toContain('Yerel OCR sonucu');

    const hostile = new Unit(); hostile.jobs.set('ocr-job-1', jobRow());
    const hostileRuntime = new Runtime(hostile.order);
    hostileRuntime.runOutcome = { ...hostileRuntime.runOutcome, networkUsed: true } as unknown as LocalGovernedOcrRunOutcome;
    const denied = await new RunLocalGovernedOcrJobUseCase(hostile, hostileRuntime).execute({ context,
      command: { jobId: 'ocr-job-1', expectedRevision: 1, clientOperationId: 'ocr-run-hostile-1' },
      identifiers: ids('ocr-job-1', 'run-hostile') });
    expect(denied.ok).toBe(false);
    expect(hostile.jobs.get('ocr-job-1')).toMatchObject({ status: 'running', revision: 2 });
    expect(hostile.mutations.size).toBe(1);
    expect([...hostile.mutations.values()][0]?.mutationKind).toBe('job_run_begin');
  });

  it('keeps disable settings-only while explicit cancel owns the running-job mutation', async () => {
    const unit = new Unit();
    unit.jobs.set('ocr-job-1', jobRow({ status: 'running', runAttempt: 1 }, undefined, hash('active-run-fixture')));
    const runtime = new Runtime(unit.order);
    const settingsId = localGovernedOcrSettingsResourceId(PERSON);
    const disabled = await new SetLocalGovernedOcrEnabledUseCase(unit, runtime).execute({ context,
      command: { expectedRevision: 0, clientOperationId: 'ocr-disable-operation-1', enabled: false,
        reason: 'Kullanıcı OCR işlemeyi kapattı' }, identifiers: ids(settingsId, 'disable-1') });
    expect(disabled.ok).toBe(true);
    expect(unit.settings).toMatchObject({ enabled: false, revision: 1 });
    expect(unit.jobs.get('ocr-job-1')).toMatchObject({ status: 'running', revision: 1 });
    expect(runtime.cancellations).toEqual(['ocr-job-1']);
    expect(unit.mutations.get('ocr-disable-operation-1')?.resourceType).toBe('local_ocr_settings');

    unit.settings = settingsRow(true, 0);
    const cancelled = await new CancelLocalGovernedOcrJobUseCase(unit, runtime).execute({ context,
      command: { jobId: 'ocr-job-1', expectedRevision: 1, clientOperationId: 'ocr-cancel-operation-1' },
      identifiers: ids('ocr-job-1', 'cancel-1') });
    expect(cancelled.ok).toBe(true);
    expect(unit.jobs.get('ocr-job-1')).toMatchObject({ status: 'cancel_requested', revision: 2 });
    expect(unit.mutations.get('ocr-cancel-operation-1')?.mutationKind).toBe('job_cancel');

    const blocked = new Unit(); blocked.settings = settingsRow(false, 1); blocked.jobs.set('ocr-job-1', jobRow());
    const blockedRun = await new RunLocalGovernedOcrJobUseCase(blocked, new Runtime(blocked.order)).execute({ context,
      command: { jobId: 'ocr-job-1', expectedRevision: 1, clientOperationId: 'ocr-run-disabled-1' },
      identifiers: ids('ocr-job-1', 'run-disabled') });
    expect(blockedRun.ok).toBe(false);
    expect(blocked.mutations.size).toBe(0);
  });

  it('corrects, reruns and deletes only derived output while preserving the archive source', async () => {
    const unit = new Unit(); unit.jobs.set('ocr-job-1', completedJob('ocr-job-1'));
    const originalSource = unit.source;
    const runtime = new Runtime(unit.order);
    const corrected = await new CorrectLocalGovernedOcrResultUseCase(unit, runtime).execute({ context,
      command: { jobId: 'ocr-job-1', expectedRevision: 2, clientOperationId: 'ocr-correct-operation-1',
        correctedText: 'Düzeltilmiş yerel sonuç' }, identifiers: ids('ocr-job-1', 'correct-1') });
    expect(corrected.ok).toBe(true);
    expect(unit.jobs.get('ocr-job-1')).toMatchObject({ revision: 3, correctionRevision: 1,
      resultContentSha256: CORRECTED_SHA });
    expect(unit.bindings.at(-1)?.target.resourceVersion).toBe('run-1-correction-1');
    expect(unit.jobs.get('ocr-job-1')).not.toHaveProperty('confidenceBasisPoints');

    const rerun = await new RerunLocalGovernedOcrJobUseCase(unit, runtime).execute({ context,
      command: { jobId: 'ocr-job-1', expectedRevision: 3, clientOperationId: 'ocr-rerun-operation-1',
        languageHints: ['tr'] }, identifiers: ids('ocr-job-1', 'rerun-1') });
    expect(rerun.ok).toBe(true);
    expect(unit.jobs.get('ocr-job-1')).toMatchObject({ revision: 4, status: 'queued', resultAvailable: false });
    expect(unit.jobs.get('ocr-job-1')).not.toHaveProperty('sealedResultId');

    unit.jobs.set('ocr-job-1', completedJob('ocr-job-1', 5));
    const deleted = await new DeleteLocalGovernedOcrJobUseCase(unit, runtime).execute({ context,
      command: { jobId: 'ocr-job-1', expectedRevision: 5, clientOperationId: 'ocr-delete-operation-1',
        reason: 'Yalnız türetilmiş OCR sonucunu kaldır' }, identifiers: ids('ocr-job-1', 'delete-1') });
    expect(deleted.ok && deleted.value.sourceResourceDeleted).toBe(false);
    expect(unit.jobs.get('ocr-job-1')).toMatchObject({ status: 'deleted', resultAvailable: false,
      deletionPropagation: 'active' });
    expect(unit.source).toBe(originalSource);
    expect(JSON.stringify({ mutations: [...unit.mutations.values()], audits: unit.audits, events: unit.events }))
      .not.toMatch(/(?:Düzeltilmiş yerel sonuç|Yalnız türetilmiş)/u);
  });

  it('purges a sealed result file-first after exact consent revocation and retries an atomic ledger rollback', async () => {
    const unit = new Unit();
    unit.jobs.set('ocr-job-1', completedJob('ocr-job-1'));
    unit.authorizationRevocation = 'consent_revoked';
    const runtime = new Runtime(unit.order);
    const useCase = new ReconcileLocalGovernedOcrAuthorizationUseCase(unit, runtime);

    expect(useCase.list(context, 8)).toEqual({ ok: true, value: [expect.objectContaining({
      jobId: 'ocr-job-1', revision: 2, reason: 'consent_revoked'
    })] });

    unit.failAudit = true;
    const command = Object.freeze({ jobId: 'ocr-job-1', expectedRevision: 2,
      reason: 'consent_revoked' as const, clientOperationId: 'ocr-authorization-revoke-operation' });
    const identifiers = ids('ocr-job-1', 'authorization-revoke');
    const rolledBack = await useCase.execute({ context, command, identifiers });
    expect(rolledBack.ok).toBe(false);
    expect(unit.jobs.get('ocr-job-1')).toMatchObject({ status: 'completed', revision: 2, resultAvailable: true });
    expect(unit.mutations.size).toBe(0);
    expect(unit.audits).toHaveLength(0);
    expect(unit.events).toHaveLength(0);
    expect(runtime.purges).toEqual(['ocr-job-1']);

    unit.failAudit = false;
    const completed = await useCase.execute({ context, command, identifiers });
    expect(completed).toEqual(expect.objectContaining({ ok: true, value: expect.objectContaining({
      mutationKind: 'authorization_revoke_propagate', previousRevision: 2, revision: 3, replayed: false
    }) }));
    expect(unit.plans.at(-1)).toMatchObject({ primary: { resourceType: 'local_ocr_job', resourceId: 'ocr-job-1',
      action: 'delete', capability: 'archive.write' } });
    expect(unit.plans.at(-1)?.source).toBeUndefined();
    expect(unit.jobs.get('ocr-job-1')).toMatchObject({ status: 'deleted', revision: 3, resultAvailable: false,
      source: { resourceId: SOURCE_ID }, deletionPropagation: 'active' });
    expect(unit.jobs.get('ocr-job-1')?.sourceDeletedAt).toBeUndefined();
    expect(unit.jobs.get('ocr-job-1')?.sealedResultId).toBeUndefined();
    expect(unit.order.slice(-5)).toEqual([
      'runtime.purge:ocr-job-1', 'mutation.insert', 'job.save', 'audit.append', 'outbox.enqueue'
    ]);

    const replay = await useCase.execute({ context, command, identifiers });
    expect(replay).toEqual(expect.objectContaining({ ok: true, value: expect.objectContaining({ replayed: true }) }));
    expect(runtime.purges).toEqual(['ocr-job-1', 'ocr-job-1']);
  });

  it('does not touch sealed output when the discovered authorization reason is stale or purge verification fails', async () => {
    const stale = new Unit(); stale.jobs.set('ocr-job-1', completedJob('ocr-job-1'));
    stale.authorizationRevocation = 'permission_revoked';
    const staleRuntime = new Runtime(stale.order);
    const staleUseCase = new ReconcileLocalGovernedOcrAuthorizationUseCase(stale, staleRuntime);
    const staleResult = await staleUseCase.execute({ context, command: { jobId: 'ocr-job-1', expectedRevision: 2,
      reason: 'consent_expired', clientOperationId: 'ocr-stale-authorization-operation' },
      identifiers: ids('ocr-job-1', 'stale-authorization') });
    expect(staleResult.ok).toBe(false);
    expect(staleRuntime.purges).toHaveLength(0);
    expect(stale.mutations.size).toBe(0);

    const failed = new Unit(); failed.jobs.set('ocr-job-1', completedJob('ocr-job-1'));
    failed.authorizationRevocation = 'consent_expired';
    const failedRuntime = new Runtime(failed.order); failedRuntime.failPurge = true;
    const failedUseCase = new ReconcileLocalGovernedOcrAuthorizationUseCase(failed, failedRuntime);
    const failedResult = await failedUseCase.execute({ context, command: { jobId: 'ocr-job-1', expectedRevision: 2,
      reason: 'consent_expired', clientOperationId: 'ocr-failed-authorization-operation' },
      identifiers: ids('ocr-job-1', 'failed-authorization') });
    expect(failedResult.ok).toBe(false);
    expect(failed.jobs.get('ocr-job-1')).toMatchObject({ status: 'completed', resultAvailable: true });
    expect(failed.mutations.size).toBe(0);
    expect(failed.audits).toHaveLength(0);
    expect(failed.events).toHaveLength(0);
  });

  it('returns plaintext only through the authorized result read and keeps audit content-free', async () => {
    const unit = new Unit(); unit.jobs.set('ocr-job-1', completedJob('ocr-job-1'));
    const runtime = new Runtime(unit.order);
    runtime.texts.set('sealed-result-ocr-job-1', { text: 'Yetkili yerel sonuç', hash: RESULT_SHA });
    const read = await new GetLocalGovernedOcrResultUseCase(unit, runtime).execute({ context,
      jobId: 'ocr-job-1', auditId: 'audit-result-read-1' });
    expect(read.ok && read.value).toMatchObject({ text: 'Yetkili yerel sonuç', payloadSource: 'sealed_local_result',
      networkUsed: false, cloudUsed: false });
    expect(JSON.stringify(unit.audits)).not.toContain('Yetkili yerel sonuç');
    const deniedUnit = new Unit(); deniedUnit.consent = null;
    deniedUnit.jobs.set('ocr-job-1', completedJob('ocr-job-1'));
    const denied = await new GetLocalGovernedOcrResultUseCase(deniedUnit, runtime).execute({ context,
      jobId: 'ocr-job-1', auditId: 'audit-result-read-2' });
    expect(denied.ok).toBe(false);
    expect(deniedUnit.audits).toHaveLength(0);
  });

  it('propagates source deletion file-first through one atomic batch, replays exactly and rolls DB back on failure', async () => {
    const unit = new Unit();
    unit.jobs.set('ocr-job-1', completedJob('ocr-job-1'));
    unit.jobs.set('ocr-job-2', jobRow({ id: 'ocr-job-2', derivedResourceId: 'local-ocr-result-2',
      revision: 3, status: 'deleted', resultAvailable: false, deletedAt: NOW,
      deletionPropagation: 'locally_deleted' }));
    const runtime = new Runtime(unit.order);
    runtime.texts.set('sealed-result-ocr-job-1', { text: 'Silinecek sonuç', hash: RESULT_SHA });
    const identifiers = ids(SOURCE_ID, 'source-delete-1');
    const command = { sourceResourceType: 'archive_item' as const, sourceResourceId: SOURCE_ID,
      purgedAt: PURGED_AT, clientOperationId: 'ocr-source-delete-operation-1' };
    const useCase = new PropagateLocalGovernedOcrSourceDeletionUseCase(unit, runtime);
    const deleted = await useCase.execute({ context, command, identifiers });
    expect(deleted.ok && deleted.value).toMatchObject({ replayed: false, sourceResourceDeleted: true });
    expect(unit.batchCalls).toBe(1);
    expect(unit.order.indexOf('runtime.purge:ocr-job-1')).toBeLessThan(unit.order.indexOf('source.batch'));
    expect([...unit.jobs.values()]).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'ocr-job-1', status: 'deleted', sourceDeletedAt: NOW,
        resultAvailable: false }),
      expect.objectContaining({ id: 'ocr-job-2', status: 'deleted', sourceDeletedAt: NOW,
        resultAvailable: false })
    ]));
    expect(unit.lastBatch?.items).toHaveLength(2);
    expect(unit.lastBatch?.items.every((item) => item.previous.id === item.next.id
      && item.next.revision === item.previous.revision + 1
      && item.next.updatedAt === NOW)).toBe(true);
    expect([...unit.jobs.values()].every((row) => !('sealedResultId' in row)
      && !('resultContentSha256' in row) && !('derivedBindingHash' in row))).toBe(true);
    expect(unit.order.slice(-3)).toEqual(['source.batch', 'audit.append', 'outbox.enqueue']);
    expect(unit.events.at(-1)).toMatchObject({ aggregateType: 'archive_item', aggregateId: SOURCE_ID });
    const replay = await useCase.execute({ context, command, identifiers });
    expect(replay.ok && replay.value.replayed).toBe(true);
    expect(unit.batchCalls).toBe(1);
    const mismatch = await useCase.execute({ context, command,
      identifiers: ids(SOURCE_ID, 'source-delete-1', hash('mismatch')) });
    expect(mismatch.ok).toBe(false);

    const failing = new Unit(); failing.jobs.set('ocr-job-1', completedJob('ocr-job-1'));
    const failingRuntime = new Runtime(failing.order); failingRuntime.failPurge = true;
    const failed = await new PropagateLocalGovernedOcrSourceDeletionUseCase(failing, failingRuntime).execute({ context,
      command: { ...command, clientOperationId: 'ocr-source-delete-operation-2' },
      identifiers: ids(SOURCE_ID, 'source-delete-2') });
    expect(failed.ok).toBe(false);
    expect(failing.batchCalls).toBe(0);
    expect(failing.jobs.get('ocr-job-1')).toMatchObject({ status: 'completed' });
    expect(failing.jobs.get('ocr-job-1')).not.toHaveProperty('sourceDeletedAt');
    expect(failing.mutations.size).toBe(0);
    expect(failing.audits).toHaveLength(0);

    const rollback = new Unit(); rollback.jobs.set('ocr-job-1', completedJob('ocr-job-1')); rollback.failAudit = true;
    const rollbackRuntime = new Runtime(rollback.order);
    const rolledBack = await new PropagateLocalGovernedOcrSourceDeletionUseCase(rollback, rollbackRuntime).execute({ context,
      command: { ...command, clientOperationId: 'ocr-source-delete-operation-3' },
      identifiers: ids(SOURCE_ID, 'source-delete-3') });
    expect(rolledBack.ok).toBe(false);
    expect(rollback.jobs.get('ocr-job-1')).toMatchObject({ status: 'completed' });
    expect(rollback.jobs.get('ocr-job-1')).not.toHaveProperty('sourceDeletedAt');
    expect(rollback.mutations.size).toBe(0);
    expect(rollback.events).toHaveLength(0);
    rollback.failAudit = false;
    const recovered = await new PropagateLocalGovernedOcrSourceDeletionUseCase(rollback, rollbackRuntime).execute({ context,
      command: { ...command, clientOperationId: 'ocr-source-delete-operation-3' },
      identifiers: ids(SOURCE_ID, 'source-delete-3') });
    expect(recovered.ok && recovered.value).toMatchObject({ replayed: false, sourceResourceDeleted: true });
    expect(rollback.jobs.get('ocr-job-1')).toMatchObject({ status: 'deleted', sourceDeletedAt: NOW });
  });
});
