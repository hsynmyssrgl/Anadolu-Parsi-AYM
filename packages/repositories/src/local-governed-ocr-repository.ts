import { createHash } from 'node:crypto';

import { asFamilyId, asIsoDateTime, asPersonId, asUserId } from '@ppt/core';
import {
  canonicalLocalGovernedOcrJobStateJson,
  canonicalLocalGovernedOcrSettingsStateJson,
  type LocalGovernedOcrAggregateKey
} from '@ppt/domain';
import type { DataSensitivity, PlatformPolicyTransactionContext, PolicyAction } from '@ppt/platform-policy';
import type {
  LocalGovernedOcrCenterSnapshotRow,
  LocalGovernedOcrArchiveVaultLocatorRow,
  LocalGovernedOcrConsentRow,
  LocalGovernedOcrJobRow,
  LocalGovernedOcrMutationRow,
  LocalGovernedOcrPolicyResourceMetadata,
  LocalGovernedOcrRepositoryPort,
  LocalGovernedOcrSettingsRow,
  LocalGovernedOcrSourceRow,
  LocalGovernedOcrSourceDeletionBatch,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { assertPolicyAuthorizedRepositoryContext } from '@ppt/repository-contracts';

import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const SHA256 = /^[0-9a-f]{64}$/u;
const OPAQUE_SEALED_RESULT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const STRICT_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const SETTINGS_RESOURCE_PREFIX = 'local-ocr-settings:';
const MAX_JOBS = 500;
const MAX_LANGUAGE_HINTS = 8;

const digest = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const settingsResourceId = (key: LocalGovernedOcrAggregateKey): string => `${SETTINGS_RESOURCE_PREFIX}${key.ownerPersonId}`;

const assertIso = (value: string): void => {
  if (!STRICT_ISO.test(value) || new Date(value).toISOString() !== value) throw new Error('OCR timestamp is invalid');
};

const keyFrom = (row: Record<string, unknown>): LocalGovernedOcrAggregateKey => Object.freeze({
  familyId: asFamilyId(String(row.family_id)),
  accountId: asUserId(String(row.account_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id))
});

const optionalIso = <TKey extends string>(key: TKey, value: unknown): { readonly [P in TKey]: ReturnType<typeof asIsoDateTime> } | object =>
  value === null || value === undefined ? {} : { [key]: asIsoDateTime(String(value)) } as { readonly [P in TKey]: ReturnType<typeof asIsoDateTime> };

const parseLanguageHints = (value: unknown): readonly string[] => {
  const parsed: unknown = JSON.parse(String(value));
  if (!Array.isArray(parsed) || parsed.length > MAX_LANGUAGE_HINTS
    || new Set(parsed).size !== parsed.length
    || parsed.some((entry) => typeof entry !== 'string' || entry.trim() !== entry || entry.length < 2 || entry.length > 35)) {
    throw new Error('OCR language hints are invalid');
  }
  return Object.freeze(parsed as string[]);
};

const mapJob = (row: Record<string, unknown>): LocalGovernedOcrJobRow => {
  const key = keyFrom(row);
  const mapped: LocalGovernedOcrJobRow = Object.freeze({
    id: String(row.id),
    key,
    revision: Number(row.revision),
    source: Object.freeze({
      resourceType: 'archive_item' as const,
      resourceId: String(row.source_resource_id),
      inputSha256: String(row.input_sha256),
      mimeType: String(row.mime_type),
      sizeBytes: Number(row.size_bytes)
    }),
    derivedResourceId: String(row.derived_resource_id),
    languageHints: parseLanguageHints(row.language_hints_json),
    status: String(row.status) as LocalGovernedOcrJobRow['status'],
    ...(row.active_run_id ? { activeRunId: String(row.active_run_id) } : {}),
    runAttempt: Number(row.run_attempt),
    correctionRevision: Number(row.correction_revision),
    resultAvailable: Number(row.result_available) === 1,
    ...(row.result_content_sha256 ? { resultContentSha256: String(row.result_content_sha256) } : {}),
    ...(row.result_character_count === null ? {} : { resultCharacterCount: Number(row.result_character_count) }),
    ...(row.result_page_count === null ? {} : { resultPageCount: Number(row.result_page_count) }),
    ...(row.confidence_basis_points === null ? {} : { confidenceBasisPoints: Number(row.confidence_basis_points) }),
    ...(row.derived_binding_hash ? { derivedBindingHash: String(row.derived_binding_hash) } : {}),
    ...(row.sealed_result_id ? { sealedResultId: String(row.sealed_result_id) } : {}),
    consentId: String(row.consent_id),
    ...optionalIso('consentExpiresAt', row.consent_expires_at),
    ...optionalIso('retentionUntil', row.retention_until),
    ...(row.failure_code ? { failureCode: String(row.failure_code) as NonNullable<LocalGovernedOcrJobRow['failureCode']> } : {}),
    ...optionalIso('cancellationRequestedAt', row.cancellation_requested_at),
    ...optionalIso('completedAt', row.completed_at),
    ...optionalIso('failedAt', row.failed_at),
    ...optionalIso('cancelledAt', row.cancelled_at),
    ...optionalIso('deletedAt', row.deleted_at),
    ...optionalIso('sourceDeletedAt', row.source_deleted_at),
    deletionPropagation: String(row.deletion_propagation) as LocalGovernedOcrJobRow['deletionPropagation'],
    processor: 'local_ocr' as const,
    networkUsed: false as const,
    cloudUsed: false as const,
    createdAt: asIsoDateTime(String(row.created_at)),
    updatedAt: asIsoDateTime(String(row.updated_at)),
    stateFingerprint: String(row.state_fingerprint)
  });
  if (Number(row.network_used) !== 0 || Number(row.cloud_used) !== 0 || row.processor !== 'local_ocr') {
    throw new Error('OCR stored local-only truth is invalid');
  }
  assertJobFingerprint(mapped);
  return mapped;
};

const mapSettings = (row: Record<string, unknown>): LocalGovernedOcrSettingsRow => {
  const mapped: LocalGovernedOcrSettingsRow = Object.freeze({
    key: keyFrom(row),
    revision: Number(row.revision),
    enabled: Number(row.enabled) === 1,
    ...(row.disabled_reason ? { disabledReason: String(row.disabled_reason) } : {}),
    ...optionalIso('disabledAt', row.disabled_at),
    updatedAt: asIsoDateTime(String(row.updated_at)),
    stateFingerprint: String(row.state_fingerprint)
  });
  assertSettingsFingerprint(mapped);
  return mapped;
};

const mapMutation = (row: Record<string, unknown>): LocalGovernedOcrMutationRow => Object.freeze({
  id: String(row.id),
  key: keyFrom(row),
  clientOperationId: String(row.client_operation_id),
  requestFingerprint: String(row.request_fingerprint),
  mutationKind: String(row.mutation_kind) as LocalGovernedOcrMutationRow['mutationKind'],
  resourceType: String(row.resource_type) as LocalGovernedOcrMutationRow['resourceType'],
  resourceId: String(row.resource_id),
  previousRevision: Number(row.previous_revision),
  revision: Number(row.revision),
  stateFingerprint: String(row.state_fingerprint),
  occurredAt: asIsoDateTime(String(row.occurred_at))
});

export const computeLocalGovernedOcrJobStateFingerprint = (row: LocalGovernedOcrJobRow): string =>
  digest(row.activeRunId === undefined
    ? canonicalLocalGovernedOcrJobStateJson(row)
    : JSON.stringify({ state: JSON.parse(canonicalLocalGovernedOcrJobStateJson(row)), activeRunId: row.activeRunId }));
export const computeLocalGovernedOcrSettingsStateFingerprint = (row: LocalGovernedOcrSettingsRow): string =>
  digest(canonicalLocalGovernedOcrSettingsStateJson(row));
const computeSourceDeletionStateFingerprint = (rows: readonly LocalGovernedOcrJobRow[]): string => digest(JSON.stringify(
  rows.map((row) => ({ id: row.id, revision: row.revision, stateFingerprint: row.stateFingerprint }))
    .sort((left, right) => left.id.localeCompare(right.id))
));

const assertJobFingerprint = (row: LocalGovernedOcrJobRow): void => {
  if (!SHA256.test(row.stateFingerprint) || computeLocalGovernedOcrJobStateFingerprint(row) !== row.stateFingerprint) {
    throw new Error('OCR job state fingerprint mismatch');
  }
  if (row.sealedResultId !== undefined && (!OPAQUE_SEALED_RESULT_ID.test(row.sealedResultId)
    || /(?:token|bearer|password|secret)/iu.test(row.sealedResultId))) {
    throw new Error('OCR sealed result reference is not opaque');
  }
  if ((row.status === 'running' || row.status === 'cancel_requested')
    ? row.activeRunId === undefined || !SHA256.test(row.activeRunId)
    : row.activeRunId !== undefined) {
    throw new Error('OCR active run binding does not match the persisted job state');
  }
};

const assertSettingsFingerprint = (row: LocalGovernedOcrSettingsRow): void => {
  if (!SHA256.test(row.stateFingerprint) || computeLocalGovernedOcrSettingsStateFingerprint(row) !== row.stateFingerprint) {
    throw new Error('OCR settings state fingerprint mismatch');
  }
  if (row.enabled ? row.disabledReason !== undefined || row.disabledAt !== undefined
    : !row.disabledReason || !row.disabledAt) throw new Error('OCR settings enabled state is invalid');
};

const assertKey = (context: RepositoryExecutionContext, key: LocalGovernedOcrAggregateKey): void => {
  if (String(context.actor.userId) !== key.accountId || context.actor.personId !== key.ownerPersonId) {
    throw new Error('OCR repository requires the exact account/person actor');
  }
};

const authorizationOf = (context: RepositoryExecutionContext): PlatformPolicyTransactionContext => {
  assertPolicyAuthorizedRepositoryContext(context);
  return context.policyAuthorization;
};

const primaryScope = (
  context: RepositoryExecutionContext,
  key: LocalGovernedOcrAggregateKey,
  resourceType: 'local_ocr_job' | 'local_ocr_settings',
  resourceId: string,
  actions: readonly PolicyAction[]
) => {
  assertKey(context, key);
  const authorization = authorizationOf(context);
  const sensitivity = authorization.receiptRecord.request.resource.sensitivity;
  const expectedCapability = resourceType === 'local_ocr_settings' ? (authorization.action === 'read' ? 'family.read' : 'family.write')
    : authorization.action === 'delete' ? 'archive.write' : 'archive.ocr';
  const expectedPurpose = resourceType === 'local_ocr_settings' ? 'administration' : 'ocr_process';
  if (!actions.includes(authorization.action as never)
    || authorization.resourceType !== resourceType || authorization.resourceId !== resourceId
    || authorization.subject.accountId !== key.accountId || authorization.subject.personId !== key.ownerPersonId
    || authorization.resourceFamilyId !== key.familyId || authorization.resourceOwnerPersonId !== key.ownerPersonId
    || !authorization.subject.familyIds.includes(key.familyId) || authorization.capability !== expectedCapability
    || authorization.purpose !== expectedPurpose
    || (resourceType === 'local_ocr_settings' ? sensitivity !== 'personal'
      : !['personal', 'sensitive', 'highly_sensitive'].includes(sensitivity))) {
    throw new Error('OCR primary policy scope is invalid');
  }
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType, resourceId, action: authorization.action, capability: expectedCapability,
    correlationId: context.correlationId, resourceFamilyId: key.familyId,
    resourceOwnerPersonId: key.ownerPersonId, purpose: expectedPurpose
  });
  const policy = platformPolicyPersistenceBinding(context, resourceType, resourceId);
  if (!policy) throw new Error('OCR operation requires a durable primary receipt');
  return policy;
};

const sourceScope = (
  context: RepositoryExecutionContext,
  key: LocalGovernedOcrAggregateKey,
  resourceId: string,
  actions: readonly ('read' | 'process')[] = ['read', 'process']
) => {
  assertKey(context, key);
  const authorization = authorizationOf(context);
  const sensitivity = authorization.receiptRecord.request.resource.sensitivity;
  if (!actions.includes(authorization.action as never) || authorization.resourceType !== 'archive_item'
    || authorization.resourceId !== resourceId || authorization.capability !== 'archive.ocr'
    || authorization.subject.accountId !== key.accountId || authorization.subject.personId !== key.ownerPersonId
    || authorization.resourceFamilyId !== key.familyId || authorization.resourceOwnerPersonId !== key.ownerPersonId
    || !authorization.subject.familyIds.includes(key.familyId) || authorization.purpose !== 'ocr_process'
    || !['personal', 'sensitive', 'highly_sensitive'].includes(sensitivity)) {
    throw new Error('OCR source policy scope is invalid');
  }
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'archive_item', resourceId, action: authorization.action, capability: 'archive.ocr',
    correlationId: context.correlationId, resourceFamilyId: key.familyId,
    resourceOwnerPersonId: key.ownerPersonId, purpose: 'ocr_process'
  });
  const policy = platformPolicyPersistenceBinding(context, 'archive_item', resourceId);
  if (!policy) throw new Error('OCR source resolution requires a fresh durable receipt');
  return { authorization, policy };
};

const archiveDeletionScope = (
  context: RepositoryExecutionContext,
  key: LocalGovernedOcrAggregateKey,
  resourceId: string
) => {
  assertKey(context, key);
  const authorization = authorizationOf(context);
  const sensitivity = authorization.receiptRecord.request.resource.sensitivity;
  if (authorization.action !== 'delete' || authorization.resourceType !== 'archive_item'
    || authorization.resourceId !== resourceId || authorization.capability !== 'archive.write'
    || authorization.subject.accountId !== key.accountId || authorization.subject.personId !== key.ownerPersonId
    || authorization.resourceFamilyId !== key.familyId || authorization.resourceOwnerPersonId !== key.ownerPersonId
    || !authorization.subject.familyIds.includes(key.familyId) || authorization.purpose !== 'ocr_process'
    || !['personal', 'sensitive', 'highly_sensitive'].includes(sensitivity)) {
    throw new Error('OCR source deletion policy scope is invalid');
  }
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'archive_item', resourceId, action: 'delete', capability: 'archive.write',
    correlationId: context.correlationId, resourceFamilyId: key.familyId,
    resourceOwnerPersonId: key.ownerPersonId, purpose: 'ocr_process'
  });
  const policy = platformPolicyPersistenceBinding(context, 'archive_item', resourceId);
  if (!policy) throw new Error('OCR source deletion requires a durable archive receipt');
  return policy;
};

const defaultSettings = (key: LocalGovernedOcrAggregateKey, occurredAt: string): LocalGovernedOcrSettingsRow => {
  const base = Object.freeze({ key, revision: 0, enabled: true, updatedAt: asIsoDateTime(occurredAt) });
  return Object.freeze({ ...base, stateFingerprint: digest(canonicalLocalGovernedOcrSettingsStateJson(base)) });
};

const rowKeyMatches = (row: { readonly key: LocalGovernedOcrAggregateKey }, key: LocalGovernedOcrAggregateKey): boolean =>
  row.key.familyId === key.familyId && row.key.accountId === key.accountId && row.key.ownerPersonId === key.ownerPersonId;

export class SqliteLocalGovernedOcrRepository extends SqliteRepository implements LocalGovernedOcrRepositoryPort {
  public loadCenter(context: RepositoryExecutionContext, key: LocalGovernedOcrAggregateKey): RepositoryResult<LocalGovernedOcrCenterSnapshotRow> {
    primaryScope(context, key, 'local_ocr_settings', settingsResourceId(key), ['read', 'update']);
    return this.execute(context, () => {
      const database = this.database(context);
      const settingsRow = database.prepare(`SELECT * FROM local_governed_ocr_settings
        WHERE family_id=? AND account_id=? AND owner_person_id=?`).get(key.familyId, key.accountId, key.ownerPersonId) as Record<string, unknown> | undefined;
      const jobs = (database.prepare(`SELECT * FROM local_governed_ocr_jobs
        WHERE family_id=? AND account_id=? AND owner_person_id=? ORDER BY updated_at DESC,id LIMIT ?`)
        .all(key.familyId, key.accountId, key.ownerPersonId, MAX_JOBS) as Record<string, unknown>[]).map(mapJob);
      let settings: LocalGovernedOcrSettingsRow;
      if (settingsRow) settings = mapSettings(settingsRow);
      else {
        const owner = database.prepare(`SELECT account.created_at FROM accounts account
          JOIN people person ON person.id=account.person_id
          WHERE account.id=? AND account.status='active' AND account.person_id=?
            AND person.family_id=? AND person.status='active'`)
          .get(key.accountId, key.ownerPersonId, key.familyId) as { created_at?: unknown } | undefined;
        if (!owner) throw new Error('OCR default settings owner is unavailable');
        const stableUpdatedAt = String(owner.created_at);
        assertIso(stableUpdatedAt);
        settings = defaultSettings(key, stableUpdatedAt);
      }
      return Object.freeze({ settings, jobs: Object.freeze(jobs) });
    });
  }

  public findJob(context: RepositoryExecutionContext, key: LocalGovernedOcrAggregateKey, jobId: string): RepositoryResult<LocalGovernedOcrJobRow | null> {
    primaryScope(context, key, 'local_ocr_job', jobId, ['read', 'process', 'delete']);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`SELECT * FROM local_governed_ocr_jobs
        WHERE id=? AND family_id=? AND account_id=? AND owner_person_id=?`).get(jobId, key.familyId, key.accountId, key.ownerPersonId) as Record<string, unknown> | undefined;
      return row ? mapJob(row) : null;
    });
  }

  public listJobsBySource(context: RepositoryExecutionContext, key: LocalGovernedOcrAggregateKey,
    resourceType: 'archive_item', resourceId: string): RepositoryResult<readonly LocalGovernedOcrJobRow[]> {
    if (resourceType !== 'archive_item') throw new Error('OCR source type is unsupported');
    if (authorizationOf(context).action === 'delete') archiveDeletionScope(context, key, resourceId);
    else sourceScope(context, key, resourceId);
    return this.execute(context, () => Object.freeze((this.database(context).prepare(`SELECT * FROM local_governed_ocr_jobs
      WHERE family_id=? AND account_id=? AND owner_person_id=? AND source_resource_type='archive_item' AND source_resource_id=?
      ORDER BY updated_at DESC,id LIMIT ?`).all(key.familyId, key.accountId, key.ownerPersonId, resourceId, MAX_JOBS) as Record<string, unknown>[]).map(mapJob)));
  }

  public resolveArchiveSource(context: RepositoryExecutionContext, key: LocalGovernedOcrAggregateKey,
    resourceId: string): RepositoryResult<LocalGovernedOcrSourceRow | null> {
    const { authorization, policy } = sourceScope(context, key, resourceId);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`SELECT source.*,retention.retention_days,
          json_extract(original.record_json,'$.request.resource.ownerPersonId') original_owner_person_id,
          json_extract(original.record_json,'$.request.subject.accountId') original_account_id
        FROM archive_items source
        JOIN platform_policy_transaction_receipts original ON original.receipt_hash=source.policy_receipt_hash
        LEFT JOIN archive_retention_policies retention ON retention.id=source.retention_policy_id
        WHERE source.id=? AND source.family_id=? AND source.destroyed_at IS NULL`)
        .get(resourceId, key.familyId) as Record<string, unknown> | undefined;
      if (!row) return null;
      if (String(row.original_owner_person_id) !== key.ownerPersonId || String(row.original_account_id) !== key.accountId
        || !SHA256.test(String(row.sha256))
        || !['image/png', 'image/jpeg', 'application/pdf'].includes(String(row.mime_type))
        || !Number.isSafeInteger(Number(row.size_bytes)) || Number(row.size_bytes) < 12 || Number(row.size_bytes) > 16_777_216) return null;
      const retentionDays = row.retention_days === null ? null : Number(row.retention_days);
      const retentionUntil = retentionDays === null ? null
        : new Date(Date.parse(String(row.created_at)) + retentionDays * 86_400_000).toISOString();
      const sensitivity = authorization.receiptRecord.request.resource.sensitivity as DataSensitivity;
      const sourcePolicy = Object.freeze({
        schemaVersion: 1 as const,
        resourceType: 'archive_item', resourceId, resourceVersion: String(row.sha256), contentSha256: String(row.sha256),
        familyId: key.familyId, policyVersion: authorization.policyVersion,
        policyPackageSha256: authorization.policyPackageSha256, receiptActive: true,
        receiptHash: policy.receiptHash, contextHash: authorization.contextHash, requestHash: authorization.requestHash,
        sensitivity, dataClasses: authorization.dataClasses,
        allowedAccountIds: Object.freeze([authorization.subject.accountId]),
        allowedApplicationIds: Object.freeze([authorization.subject.applicationId]),
        allowedCapabilities: Object.freeze([authorization.capability]),
        allowedActions: Object.freeze([authorization.action]), allowedPurposes: Object.freeze([authorization.purpose]),
        obligations: authorization.decision.obligations, retentionUntil, lineageDepth: 0,
        ancestorResources: Object.freeze([])
      });
      return Object.freeze({
        key, resourceType: 'archive_item' as const, resourceId, inputSha256: String(row.sha256),
        mimeType: String(row.mime_type), sizeBytes: Number(row.size_bytes), sourcePolicy
      });
    });
  }

  public resolveAuthorizedArchiveVaultLocator(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: LocalGovernedOcrAggregateKey,
    resourceId: string
  ): RepositoryResult<LocalGovernedOcrArchiveVaultLocatorRow | null> {
    sourceScope(context, key, resourceId);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`SELECT source.id,source.stored_name,source.original_name,
          source.mime_type,source.size_bytes,source.sha256,
          json_extract(original.record_json,'$.request.resource.ownerPersonId') original_owner_person_id,
          json_extract(original.record_json,'$.request.subject.accountId') original_account_id
        FROM archive_items source
        JOIN platform_policy_transaction_receipts original ON original.receipt_hash=source.policy_receipt_hash
        WHERE source.id=? AND source.family_id=? AND source.destroyed_at IS NULL`)
        .get(resourceId, key.familyId) as Record<string, unknown> | undefined;
      if (!row || String(row.original_owner_person_id) !== key.ownerPersonId
        || String(row.original_account_id) !== key.accountId || !SHA256.test(String(row.sha256))
        || !['image/png', 'image/jpeg', 'application/pdf'].includes(String(row.mime_type))
        || !Number.isSafeInteger(Number(row.size_bytes)) || Number(row.size_bytes) < 12
        || Number(row.size_bytes) > 16_777_216) return null;
      return Object.freeze({
        key,
        resourceType: 'archive_item' as const,
        resourceId,
        storedName: String(row.stored_name),
        originalName: String(row.original_name),
        inputSha256: String(row.sha256),
        mimeType: String(row.mime_type),
        sizeBytes: Number(row.size_bytes)
      });
    });
  }

  public resolveActiveSensitiveProcessingConsent(context: RepositoryExecutionContext, key: LocalGovernedOcrAggregateKey,
    resourceType: 'archive_item', resourceId: string, at: string): RepositoryResult<LocalGovernedOcrConsentRow | null> {
    assertIso(at);
    if (resourceType !== 'archive_item') throw new Error('OCR consent source type is unsupported');
    sourceScope(context, key, resourceId);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`SELECT * FROM ai_consents WHERE account_id=? AND purpose='sensitive_processing'
        AND resource_type='archive_item' AND resource_id=? AND status='granted' AND julianday(starts_at)<=julianday(?)
        AND (ends_at IS NULL OR julianday(ends_at)>=julianday(?)) ORDER BY starts_at DESC,id LIMIT 1`)
        .get(key.accountId, resourceId, at, at) as Record<string, unknown> | undefined;
      if (!row) return null;
      return Object.freeze({ id: String(row.id), key, purpose: 'sensitive_processing' as const,
        resourceType: 'archive_item' as const, resourceId, status: 'granted' as const,
        startsAt: asIsoDateTime(String(row.starts_at)), ...(row.ends_at ? { endsAt: asIsoDateTime(String(row.ends_at)) } : {}) });
    });
  }

  public findMutationByClientOperationId(context: RepositoryExecutionContext, key: LocalGovernedOcrAggregateKey,
    clientOperationId: string): RepositoryResult<LocalGovernedOcrMutationRow | null> {
    assertKey(context, key);
    const authorization = authorizationOf(context);
    if (!['local_ocr_job', 'local_ocr_settings'].includes(authorization.resourceType)) throw new Error('OCR mutation lookup requires a primary scope');
    const allowedActions: readonly PolicyAction[] = authorization.resourceType === 'local_ocr_settings'
      ? ['update']
      : ['process', 'delete'];
    primaryScope(context, key, authorization.resourceType as 'local_ocr_job' | 'local_ocr_settings', authorization.resourceId,
      allowedActions);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`SELECT * FROM local_governed_ocr_mutations
        WHERE family_id=? AND account_id=? AND owner_person_id=? AND client_operation_id=?
          AND resource_type=? AND resource_id=?`).get(key.familyId, key.accountId, key.ownerPersonId,
          clientOperationId, authorization.resourceType, authorization.resourceId) as Record<string, unknown> | undefined;
      return row ? mapMutation(row) : null;
    });
  }

  public findSourceDeletionMutationByClientOperationId(context: RepositoryExecutionContext, key: LocalGovernedOcrAggregateKey,
    sourceResourceId: string, clientOperationId: string): RepositoryResult<LocalGovernedOcrMutationRow | null> {
    archiveDeletionScope(context, key, sourceResourceId);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`SELECT * FROM local_governed_ocr_mutations
        WHERE family_id=? AND account_id=? AND owner_person_id=? AND client_operation_id=?
          AND mutation_kind='source_delete_propagate' AND resource_type='local_ocr_job' AND resource_id=?`)
        .get(key.familyId, key.accountId, key.ownerPersonId, clientOperationId, sourceResourceId) as Record<string, unknown> | undefined;
      return row ? mapMutation(row) : null;
    });
  }

  public insertJob(context: RepositoryExecutionContext, row: LocalGovernedOcrJobRow): RepositoryResult<void> {
    assertJobFingerprint(row);
    if (row.revision !== 1 || !rowKeyMatches(row, row.key)) throw new Error('OCR job creation revision is invalid');
    const policy = primaryScope(context, row.key, 'local_ocr_job', row.id, ['process']);
    return this.execute(context, () => {
      const lastMutationId = this.findExactMutationId(context, row.key, 'local_ocr_job', row.id, 0, row.revision, row.stateFingerprint);
      this.database(context).prepare(`INSERT INTO local_governed_ocr_jobs(
        id,family_id,account_id,owner_person_id,revision,source_resource_type,source_resource_id,input_sha256,mime_type,size_bytes,
        derived_resource_id,language_hints_json,status,active_run_id,run_attempt,correction_revision,result_available,result_content_sha256,
        result_character_count,result_page_count,confidence_basis_points,derived_binding_hash,sealed_result_id,consent_id,consent_expires_at,
        retention_until,failure_code,cancellation_requested_at,completed_at,failed_at,cancelled_at,deleted_at,source_deleted_at,
        deletion_propagation,processor,network_used,cloud_used,created_at,updated_at,last_mutation_id,state_fingerprint,policy_receipt_hash
      ) VALUES(${Array.from({ length: 42 }, () => '?').join(',')})`).run(...this.jobParameters(row), lastMutationId, row.stateFingerprint, policy.receiptHash);
    });
  }

  public saveJob(context: RepositoryExecutionContext, row: LocalGovernedOcrJobRow, expectedRevision: number): RepositoryResult<boolean> {
    assertJobFingerprint(row);
    if (row.revision !== expectedRevision + 1) throw new Error('OCR job optimistic revision is invalid');
    const authorization = authorizationOf(context);
    if (authorization.action !== 'process' && authorization.action !== 'delete') throw new Error('OCR job write action is invalid');
    primaryScope(context, row.key, 'local_ocr_job', row.id, [authorization.action]);
    const policy = platformPolicyPersistenceBinding(context, 'local_ocr_job', row.id);
    if (!policy) throw new Error('OCR job update requires a durable receipt');
    return this.execute(context, () => {
      const lastMutationId = this.findExactMutationId(context, row.key, 'local_ocr_job', row.id, expectedRevision, row.revision, row.stateFingerprint);
      const parameters = this.jobParameters(row);
      const changed = this.database(context).prepare(`UPDATE local_governed_ocr_jobs SET
        revision=?,source_resource_type=?,source_resource_id=?,input_sha256=?,mime_type=?,size_bytes=?,derived_resource_id=?,language_hints_json=?,
        status=?,active_run_id=?,run_attempt=?,correction_revision=?,result_available=?,result_content_sha256=?,result_character_count=?,result_page_count=?,
        confidence_basis_points=?,derived_binding_hash=?,sealed_result_id=?,consent_id=?,consent_expires_at=?,retention_until=?,failure_code=?,
        cancellation_requested_at=?,completed_at=?,failed_at=?,cancelled_at=?,deleted_at=?,source_deleted_at=?,deletion_propagation=?,processor=?,
        network_used=?,cloud_used=?,created_at=?,updated_at=?,last_mutation_id=?,state_fingerprint=?,policy_receipt_hash=?
        WHERE id=? AND family_id=? AND account_id=? AND owner_person_id=? AND revision=?`)
        .run(...parameters.slice(4), lastMutationId, row.stateFingerprint, policy.receiptHash,
          row.id, row.key.familyId, row.key.accountId, row.key.ownerPersonId, expectedRevision).changes;
      return changed === 1;
    });
  }

  public saveSettings(context: RepositoryExecutionContext, row: LocalGovernedOcrSettingsRow,
    expectedRevision: number): RepositoryResult<boolean> {
    assertSettingsFingerprint(row);
    if (row.revision !== expectedRevision + 1) throw new Error('OCR settings optimistic revision is invalid');
    const resourceId = settingsResourceId(row.key);
    const policy = primaryScope(context, row.key, 'local_ocr_settings', resourceId, ['update']);
    return this.execute(context, () => {
      const mutationId = this.findExactMutationId(context, row.key, 'local_ocr_settings', resourceId,
        expectedRevision, row.revision, row.stateFingerprint);
      if (expectedRevision === 0) return this.database(context).prepare(`INSERT INTO local_governed_ocr_settings(
        account_id,family_id,owner_person_id,resource_id,revision,enabled,disabled_reason,disabled_at,updated_at,last_mutation_id,state_fingerprint,policy_receipt_hash
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(account_id) DO NOTHING`).run(row.key.accountId, row.key.familyId,
        row.key.ownerPersonId, resourceId, row.revision, row.enabled ? 1 : 0, row.disabledReason ?? null, row.disabledAt ?? null,
        row.updatedAt, mutationId, row.stateFingerprint, policy.receiptHash).changes === 1;
      return this.database(context).prepare(`UPDATE local_governed_ocr_settings SET revision=?,enabled=?,disabled_reason=?,disabled_at=?,
        updated_at=?,last_mutation_id=?,state_fingerprint=?,policy_receipt_hash=?
        WHERE account_id=? AND family_id=? AND owner_person_id=? AND resource_id=? AND revision=?`).run(row.revision,
        row.enabled ? 1 : 0, row.disabledReason ?? null, row.disabledAt ?? null, row.updatedAt, mutationId,
        row.stateFingerprint, policy.receiptHash, row.key.accountId, row.key.familyId, row.key.ownerPersonId, resourceId,
        expectedRevision).changes === 1;
    });
  }

  public insertMutation(context: RepositoryExecutionContext, row: LocalGovernedOcrMutationRow): RepositoryResult<void> {
    assertKey(context, row.key);
    if (!SHA256.test(row.requestFingerprint) || !SHA256.test(row.stateFingerprint)
      || row.revision !== row.previousRevision + 1 || row.clientOperationId.length > 160) throw new Error('OCR mutation is invalid');
    const action: PolicyAction = row.resourceType === 'local_ocr_settings' ? 'update'
      : row.mutationKind === 'job_delete' || row.mutationKind === 'source_delete_propagate' ? 'delete' : 'process';
    const policy = primaryScope(context, row.key, row.resourceType, row.resourceId, [action]);
    return this.execute(context, () => {
      const database = this.database(context);
      database.exec('SAVEPOINT local_ocr_mutation_insert');
      try {
        database.prepare(`DELETE FROM local_governed_ocr_mutations WHERE family_id=? AND account_id=? AND owner_person_id=?
          AND julianday(occurred_at)<=julianday(?,'-30 days')
          AND NOT EXISTS(SELECT 1 FROM local_governed_ocr_jobs current WHERE current.last_mutation_id=local_governed_ocr_mutations.id)
          AND NOT EXISTS(SELECT 1 FROM local_governed_ocr_settings current WHERE current.last_mutation_id=local_governed_ocr_mutations.id)`)
          .run(row.key.familyId, row.key.accountId, row.key.ownerPersonId, context.occurredAt);
        database.prepare(`INSERT INTO local_governed_ocr_mutations(
          id,family_id,account_id,owner_person_id,client_operation_id,request_fingerprint,mutation_kind,resource_type,
          resource_id,previous_revision,revision,state_fingerprint,occurred_at,policy_receipt_hash
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id, row.key.familyId, row.key.accountId, row.key.ownerPersonId,
          row.clientOperationId, row.requestFingerprint, row.mutationKind, row.resourceType, row.resourceId,
          row.previousRevision, row.revision, row.stateFingerprint, row.occurredAt, policy.receiptHash);
        database.exec('RELEASE SAVEPOINT local_ocr_mutation_insert');
      } catch (error) {
        database.exec('ROLLBACK TO SAVEPOINT local_ocr_mutation_insert');
        database.exec('RELEASE SAVEPOINT local_ocr_mutation_insert');
        throw error;
      }
    });
  }

  public propagateSourceDeletion(context: RepositoryExecutionContext,
    batch: LocalGovernedOcrSourceDeletionBatch): RepositoryResult<void> {
    const mutation = batch.batchMutation;
    assertKey(context, mutation.key);
    if (batch.sourceResourceType !== 'archive_item' || batch.sourceResourceId !== mutation.resourceId
      || mutation.mutationKind !== 'source_delete_propagate' || mutation.resourceType !== 'local_ocr_job'
      || mutation.previousRevision !== 0 || mutation.revision !== 1
      || !SHA256.test(mutation.requestFingerprint) || !SHA256.test(mutation.stateFingerprint)
      || mutation.clientOperationId.length < 1 || mutation.clientOperationId.length > 160
      || mutation.occurredAt !== context.occurredAt || batch.items.length > MAX_JOBS) {
      throw new Error('OCR source deletion batch is invalid');
    }
    const policy = archiveDeletionScope(context, mutation.key, batch.sourceResourceId);
    const seen = new Set<string>();
    for (const item of batch.items) {
      assertJobFingerprint(item.previous);
      assertJobFingerprint(item.next);
      if (seen.has(item.previous.id) || item.previous.id !== item.next.id
        || !rowKeyMatches(item.previous, mutation.key) || !rowKeyMatches(item.next, mutation.key)
        || item.previous.source.resourceType !== 'archive_item'
        || item.previous.source.resourceId !== batch.sourceResourceId
        || item.next.source.resourceType !== 'archive_item' || item.next.source.resourceId !== batch.sourceResourceId
        || item.next.revision !== item.previous.revision + 1 || item.next.status !== 'deleted'
        || item.previous.sourceDeletedAt !== undefined || item.next.sourceDeletedAt !== mutation.occurredAt
        || item.next.updatedAt !== mutation.occurredAt || item.next.deletionPropagation !== 'locally_deleted'
        || item.next.resultAvailable || item.next.sealedResultId !== undefined) {
        throw new Error('OCR source deletion item is invalid');
      }
      seen.add(item.previous.id);
    }
    return this.execute(context, () => {
      const database = this.database(context);
      database.exec('SAVEPOINT local_ocr_source_deletion');
      try {
        database.prepare(`DELETE FROM local_governed_ocr_mutations WHERE family_id=? AND account_id=? AND owner_person_id=?
          AND julianday(occurred_at)<=julianday(?,'-30 days')
          AND NOT EXISTS(SELECT 1 FROM local_governed_ocr_jobs current WHERE current.last_mutation_id=local_governed_ocr_mutations.id)
          AND NOT EXISTS(SELECT 1 FROM local_governed_ocr_settings current WHERE current.last_mutation_id=local_governed_ocr_mutations.id)
          AND NOT EXISTS(SELECT 1 FROM local_governed_ocr_source_deletion_items item
            WHERE item.batch_mutation_id=local_governed_ocr_mutations.id)`)
          .run(mutation.key.familyId, mutation.key.accountId, mutation.key.ownerPersonId, context.occurredAt);
        database.prepare(`INSERT INTO local_governed_ocr_mutations(
          id,family_id,account_id,owner_person_id,client_operation_id,request_fingerprint,mutation_kind,resource_type,
          resource_id,previous_revision,revision,state_fingerprint,occurred_at,policy_receipt_hash
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(mutation.id, mutation.key.familyId, mutation.key.accountId,
          mutation.key.ownerPersonId, mutation.clientOperationId, mutation.requestFingerprint, mutation.mutationKind,
          mutation.resourceType, mutation.resourceId, mutation.previousRevision, mutation.revision,
          mutation.stateFingerprint, mutation.occurredAt, policy.receiptHash);

        for (const item of batch.items) {
          const itemMutationId = `ocr-source-item:${digest(JSON.stringify([mutation.id, item.previous.id]))}`;
          const itemClientOperationId = `ocr-source-op:${digest(JSON.stringify([mutation.clientOperationId, item.previous.id]))}`;
          const itemRequestFingerprint = digest(JSON.stringify([mutation.requestFingerprint, item.previous.id,
            item.previous.revision, item.next.revision, item.next.stateFingerprint]));
          database.prepare(`INSERT INTO local_governed_ocr_source_deletion_items(
            batch_mutation_id,item_mutation_id,client_operation_id,request_fingerprint,job_id,family_id,account_id,
            owner_person_id,source_resource_id,previous_revision,previous_state_fingerprint,revision,state_fingerprint,
            occurred_at,policy_receipt_hash
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(mutation.id, itemMutationId,
            itemClientOperationId, itemRequestFingerprint, item.previous.id,
            mutation.key.familyId, mutation.key.accountId, mutation.key.ownerPersonId, batch.sourceResourceId,
            item.previous.revision, item.previous.stateFingerprint, item.next.revision, item.next.stateFingerprint,
            mutation.occurredAt, policy.receiptHash);
          const parameters = this.jobParameters(item.next);
          const changed = database.prepare(`UPDATE local_governed_ocr_jobs SET
            revision=?,source_resource_type=?,source_resource_id=?,input_sha256=?,mime_type=?,size_bytes=?,derived_resource_id=?,language_hints_json=?,
            status=?,active_run_id=?,run_attempt=?,correction_revision=?,result_available=?,result_content_sha256=?,result_character_count=?,result_page_count=?,
            confidence_basis_points=?,derived_binding_hash=?,sealed_result_id=?,consent_id=?,consent_expires_at=?,retention_until=?,failure_code=?,
            cancellation_requested_at=?,completed_at=?,failed_at=?,cancelled_at=?,deleted_at=?,source_deleted_at=?,deletion_propagation=?,processor=?,
            network_used=?,cloud_used=?,created_at=?,updated_at=?,last_mutation_id=?,state_fingerprint=?,policy_receipt_hash=?
            WHERE id=? AND family_id=? AND account_id=? AND owner_person_id=? AND revision=? AND state_fingerprint=?`)
            .run(...parameters.slice(4), mutation.id, item.next.stateFingerprint, policy.receiptHash,
              item.previous.id, mutation.key.familyId, mutation.key.accountId, mutation.key.ownerPersonId,
              item.previous.revision, item.previous.stateFingerprint).changes;
          if (changed !== 1) throw new Error('OCR source deletion optimistic revision conflict');
        }
        const finalRows = (database.prepare(`SELECT * FROM local_governed_ocr_jobs
          WHERE family_id=? AND account_id=? AND owner_person_id=? AND source_resource_type='archive_item'
            AND source_resource_id=? ORDER BY id`).all(mutation.key.familyId, mutation.key.accountId,
            mutation.key.ownerPersonId, batch.sourceResourceId) as Record<string, unknown>[]).map(mapJob);
        if (finalRows.some((row) => row.sourceDeletedAt === undefined)
          || computeSourceDeletionStateFingerprint(finalRows) !== mutation.stateFingerprint) {
          throw new Error('OCR source deletion aggregate fingerprint mismatch');
        }
        database.exec('RELEASE SAVEPOINT local_ocr_source_deletion');
      } catch (error) {
        database.exec('ROLLBACK TO SAVEPOINT local_ocr_source_deletion');
        database.exec('RELEASE SAVEPOINT local_ocr_source_deletion');
        throw error;
      }
    });
  }

  public resolvePolicyResource(context: RepositoryExecutionContext, key: LocalGovernedOcrAggregateKey,
    resourceType: 'local_ocr_job' | 'local_ocr_settings', resourceId: string): RepositoryResult<LocalGovernedOcrPolicyResourceMetadata | null> {
    assertKey(context, key);
    return this.execute(context, () => {
      const active = this.database(context).prepare(`SELECT account.created_at FROM accounts account JOIN people owner ON owner.id=account.person_id
        WHERE account.id=? AND account.status='active' AND account.person_id=? AND owner.family_id=? AND owner.status='active'`)
        .get(key.accountId, key.ownerPersonId, key.familyId) as { created_at?: unknown } | undefined;
      if (!active) return null;
      if (resourceType === 'local_ocr_settings') {
        if (resourceId !== settingsResourceId(key)) return null;
        const row = this.database(context).prepare(`SELECT revision,state_fingerprint FROM local_governed_ocr_settings
          WHERE account_id=? AND family_id=? AND owner_person_id=? AND resource_id=?`)
          .get(key.accountId, key.familyId, key.ownerPersonId, resourceId) as Record<string, unknown> | undefined;
        const stableUpdatedAt = String(active.created_at);
        assertIso(stableUpdatedAt);
        const defaults = defaultSettings(key, stableUpdatedAt);
        return Object.freeze({ familyId: key.familyId, accountId: key.accountId, ownerPersonId: key.ownerPersonId,
          revision: row ? Number(row.revision) : 0, stateFingerprint: row ? String(row.state_fingerprint) : defaults.stateFingerprint,
          sensitivity: 'personal' as const, sourceResourceType: null, sourceResourceId: null,
          derivedResourceId: null });
      }
      const row = this.database(context).prepare(`SELECT job.revision,job.state_fingerprint,job.source_resource_type,job.source_resource_id,job.derived_resource_id,
          json_extract(receipt.record_json,'$.request.resource.sensitivity') sensitivity
        FROM local_governed_ocr_jobs job JOIN platform_policy_transaction_receipts receipt ON receipt.receipt_hash=job.policy_receipt_hash
        WHERE job.id=? AND job.family_id=? AND job.account_id=? AND job.owner_person_id=?`)
        .get(resourceId, key.familyId, key.accountId, key.ownerPersonId) as Record<string, unknown> | undefined;
      if (!row) return null;
      const sensitivity = String(row.sensitivity);
      if (!['personal', 'sensitive', 'highly_sensitive'].includes(sensitivity)) throw new Error('OCR job sensitivity is invalid');
      return Object.freeze({ familyId: key.familyId, accountId: key.accountId, ownerPersonId: key.ownerPersonId,
        revision: Number(row.revision), stateFingerprint: String(row.state_fingerprint),
        sensitivity: sensitivity as 'personal' | 'sensitive' | 'highly_sensitive', sourceResourceType: 'archive_item' as const,
        sourceResourceId: String(row.source_resource_id), derivedResourceId: String(row.derived_resource_id) });
    });
  }

  public resolveArchivePolicyResource(context: RepositoryExecutionContext, key: LocalGovernedOcrAggregateKey,
    resourceId: string): RepositoryResult<LocalGovernedOcrPolicyResourceMetadata | null> {
    assertKey(context, key);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`SELECT source.sha256,source.mime_type,source.size_bytes,source.sensitivity,
          json_extract(original.record_json,'$.request.subject.accountId') original_account_id,
          json_extract(original.record_json,'$.request.resource.ownerPersonId') original_owner_person_id
        FROM archive_items source
        JOIN platform_policy_transaction_receipts original ON original.receipt_hash=source.policy_receipt_hash
        WHERE source.id=? AND source.family_id=? AND source.destroyed_at IS NULL`)
        .get(resourceId, key.familyId) as Record<string, unknown> | undefined;
      if (!row || String(row.original_account_id) !== key.accountId
        || String(row.original_owner_person_id) !== key.ownerPersonId || !SHA256.test(String(row.sha256))) return null;
      const sensitivity = String(row.sensitivity) === 'high' ? 'highly_sensitive' as const
        : String(row.sensitivity) === 'personal' ? 'sensitive' as const : 'personal' as const;
      return Object.freeze({
        familyId: key.familyId,
        accountId: key.accountId,
        ownerPersonId: key.ownerPersonId,
        revision: 1,
        stateFingerprint: digest(JSON.stringify({
          resourceType: 'archive_item', resourceId, familyId: key.familyId, ownerPersonId: key.ownerPersonId,
          sha256: String(row.sha256), mimeType: String(row.mime_type), sizeBytes: Number(row.size_bytes), sensitivity
        })),
        sensitivity,
        sourceResourceType: null,
        sourceResourceId: null,
        derivedResourceId: null
      });
    });
  }

  private findExactMutationId(context: RepositoryExecutionContext, key: LocalGovernedOcrAggregateKey,
    resourceType: 'local_ocr_job' | 'local_ocr_settings', resourceId: string, previousRevision: number,
    revision: number, stateFingerprint: string): string {
    const row = this.database(context).prepare(`SELECT id FROM local_governed_ocr_mutations
      WHERE family_id=? AND account_id=? AND owner_person_id=? AND resource_type=? AND resource_id=?
        AND previous_revision=? AND revision=? AND state_fingerprint=?`)
      .get(key.familyId, key.accountId, key.ownerPersonId, resourceType, resourceId,
        previousRevision, revision, stateFingerprint) as { id?: unknown } | undefined;
    if (!row?.id) throw new Error('OCR current row requires its exact immutable mutation');
    return String(row.id);
  }

  private jobParameters(row: LocalGovernedOcrJobRow): readonly unknown[] {
    return [row.id, row.key.familyId, row.key.accountId, row.key.ownerPersonId, row.revision,
      row.source.resourceType, row.source.resourceId, row.source.inputSha256, row.source.mimeType, row.source.sizeBytes,
      row.derivedResourceId, JSON.stringify(row.languageHints), row.status, row.activeRunId ?? null,
      row.runAttempt, row.correctionRevision,
      row.resultAvailable ? 1 : 0, row.resultContentSha256 ?? null, row.resultCharacterCount ?? null,
      row.resultPageCount ?? null, row.confidenceBasisPoints ?? null, row.derivedBindingHash ?? null,
      row.sealedResultId ?? null, row.consentId, row.consentExpiresAt ?? null, row.retentionUntil ?? null,
      row.failureCode ?? null, row.cancellationRequestedAt ?? null, row.completedAt ?? null, row.failedAt ?? null,
      row.cancelledAt ?? null, row.deletedAt ?? null, row.sourceDeletedAt ?? null, row.deletionPropagation,
      row.processor, row.networkUsed ? 1 : 0, row.cloudUsed ? 1 : 0, row.createdAt, row.updatedAt] as const;
  }
}
