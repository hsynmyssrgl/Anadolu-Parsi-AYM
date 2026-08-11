/// <reference types="node" />
import { createHash } from 'node:crypto';
import type { DatabaseExecutor } from '@ppt/contracts';
import {
  DerivedDataInheritancePolicy,
  DERIVED_DATA_MAX_ANCESTOR_COUNT,
  DERIVED_DATA_MAX_LINEAGE_DEPTH,
  type DerivedDataPolicyBinding,
  type DerivedDataSourcePolicySnapshot,
  type DerivedDataTargetPolicy,
  type PlatformPolicyReceipt,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import {
  assertPolicyAuthorizedRepositoryContext,
  type DerivedDataPolicyRepositoryPort,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import {
  canonicalPlatformPolicyJson,
  computePlatformPolicyReceiptHash
} from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const SHA256 = /^[0-9a-f]{64}$/u;
const CANONICAL_ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const SOURCE_RECEIPT_MAX_AGE_MS = 30_000;
const inheritancePolicy = new DerivedDataInheritancePolicy();

interface NormalizedSource {
  readonly ordinal: number;
  readonly sourceKey: string;
  readonly snapshot: DerivedDataSourcePolicySnapshot;
  readonly snapshotJson: string;
  readonly snapshotSha256: string;
}

interface NormalizedBinding {
  readonly binding: DerivedDataPolicyBinding;
  readonly bindingJson: string;
  readonly accessPolicyJson: string;
  readonly accessPolicySha256: string;
  readonly obligationsJson: string;
  readonly obligationsSha256: string;
  readonly sources: readonly NormalizedSource[];
}

interface StoredLineageTraversal {
  readonly activePath: ReadonlySet<string>;
  readonly validated: Set<string>;
}

const canonicalJson = (value: unknown): string => canonicalPlatformPolicyJson(value);
const digest = (value: unknown): string =>
  createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');

const strictIso = (value: unknown): value is string => {
  if (typeof value !== 'string' || !CANONICAL_ISO_UTC.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
};
const compareCanonicalText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const identityKey = (source: DerivedDataSourcePolicySnapshot): string => digest({
  schemaVersion: 1,
  resourceType: source.resourceType,
  resourceId: source.resourceId,
  resourceVersion: source.resourceVersion,
  contentSha256: source.contentSha256
});

/** Canonical lookup key shared by insertSealed/listBindingHashesBySource callers. */
export const computeDerivedDataPolicySourceKey = (
  source: DerivedDataSourcePolicySnapshot
): string => identityKey(source);

const bindingPayload = (binding: DerivedDataPolicyBinding): Omit<DerivedDataPolicyBinding, 'bindingHash'> => ({
  schemaVersion: binding.schemaVersion,
  target: binding.target,
  sources: binding.sources,
  effectivePolicy: binding.effectivePolicy,
  lineageDepth: binding.lineageDepth,
  ancestorResources: binding.ancestorResources,
  sourceSetHash: binding.sourceSetHash
});

const normalizeBinding = (candidate: DerivedDataPolicyBinding): NormalizedBinding => {
  const verification = inheritancePolicy.verify(candidate);
  if (!verification.allowed) {
    throw new Error(`DERIVED_DATA_POLICY_BINDING_REJECTED:${verification.reason}`);
  }
  const binding = verification.binding;
  if (digest(bindingPayload(binding)) !== binding.bindingHash) {
    throw new Error('DERIVED_DATA_POLICY_BINDING_HASH_MISMATCH');
  }
  if (digest({ schemaVersion: 1, sources: binding.sources }) !== binding.sourceSetHash) {
    throw new Error('DERIVED_DATA_POLICY_SOURCE_SET_HASH_MISMATCH');
  }
  const accessPolicy = Object.freeze({
    allowedAccountIds: binding.effectivePolicy.allowedAccountIds,
    allowedApplicationIds: binding.effectivePolicy.allowedApplicationIds,
    allowedCapabilities: binding.effectivePolicy.allowedCapabilities,
    allowedActions: binding.effectivePolicy.allowedActions,
    allowedPurposes: binding.effectivePolicy.allowedPurposes
  });
  const accessPolicyJson = canonicalJson(accessPolicy);
  const obligationsJson = canonicalJson(binding.effectivePolicy.obligations);
  return {
    binding,
    bindingJson: canonicalJson(binding),
    accessPolicyJson,
    accessPolicySha256: digest(accessPolicy),
    obligationsJson,
    obligationsSha256: digest(binding.effectivePolicy.obligations),
    sources: Object.freeze(binding.sources.map((snapshot, ordinal) => ({
      ordinal,
      sourceKey: identityKey(snapshot),
      snapshot,
      snapshotJson: canonicalJson(snapshot),
      snapshotSha256: digest(snapshot)
    })))
  };
};

const sameStrings = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const canonicalObligationsJson = (value: unknown): string => {
  if (!Array.isArray(value)) throw new Error('DERIVED_DATA_POLICY_OBLIGATIONS_MALFORMED');
  const obligations = value.map((candidate) => {
    const obligation = asRecord(candidate, 'policy obligation');
    const keys = Object.keys(obligation).sort();
    if (
      typeof obligation.type !== 'string'
      || (keys.length !== 1 && keys.length !== 2)
      || keys[0] !== 'type'
      || (keys.length === 2 && keys[1] !== 'value')
    ) {
      throw new Error('DERIVED_DATA_POLICY_OBLIGATIONS_MALFORMED');
    }
    if (keys.length === 1) return Object.freeze({ type: obligation.type });
    if (Array.isArray(obligation.value)) {
      if (!obligation.value.every((entry) => typeof entry === 'string')) {
        throw new Error('DERIVED_DATA_POLICY_OBLIGATIONS_MALFORMED');
      }
      return Object.freeze({
        type: obligation.type,
        value: Object.freeze([...obligation.value].sort(compareCanonicalText))
      });
    }
    if (typeof obligation.value !== 'string') {
      throw new Error('DERIVED_DATA_POLICY_OBLIGATIONS_MALFORMED');
    }
    return Object.freeze({ type: obligation.type, value: obligation.value });
  });
  obligations.sort((left, right) => compareCanonicalText(canonicalJson(left), canonicalJson(right)));
  return canonicalJson(obligations);
};

const UPSTREAM_SENSITIVITY_ORDER: Readonly<Record<DerivedDataSourcePolicySnapshot['sensitivity'], number>> =
  Object.freeze({ public: 0, internal: 1, personal: 2, sensitive: 3, highly_sensitive: 4 });

const containsEveryString = (candidate: readonly string[], required: readonly string[]): boolean => {
  const values = new Set(candidate);
  return required.every((value) => values.has(value));
};

const containsEveryObligation = (
  candidate: DerivedDataSourcePolicySnapshot['obligations'],
  required: DerivedDataPolicyBinding['effectivePolicy']['obligations']
): boolean => {
  const candidateValues = JSON.parse(canonicalObligationsJson(candidate)) as unknown[];
  const requiredValues = JSON.parse(canonicalObligationsJson(required)) as unknown[];
  const fingerprints = new Set(candidateValues.map(canonicalJson));
  return requiredValues.every((value) => fingerprints.has(canonicalJson(value)));
};

const retentionNoBroaderThanUpstream = (
  candidate: string | null,
  upstream: string | null
): boolean => upstream === null || (candidate !== null && Date.parse(candidate) <= Date.parse(upstream));

const sourcePolicyNoBroaderThanUpstream = (
  source: DerivedDataSourcePolicySnapshot,
  upstream: DerivedDataTargetPolicy
): boolean =>
  UPSTREAM_SENSITIVITY_ORDER[source.sensitivity] >= UPSTREAM_SENSITIVITY_ORDER[upstream.sensitivity]
  && containsEveryString(source.dataClasses, upstream.dataClasses)
  && containsEveryString(upstream.allowedAccountIds, source.allowedAccountIds)
  && containsEveryString(upstream.allowedApplicationIds, source.allowedApplicationIds)
  && containsEveryString(upstream.allowedCapabilities, source.allowedCapabilities)
  && containsEveryString(upstream.allowedActions, source.allowedActions)
  && containsEveryString(upstream.allowedPurposes, source.allowedPurposes)
  && containsEveryObligation(source.obligations, upstream.obligations)
  && retentionNoBroaderThanUpstream(source.retentionUntil, upstream.retentionUntil);

const assertAuthorizedTarget = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  target: DerivedDataTargetPolicy
): void => {
  const authorization = context.policyAuthorization;
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: target.resourceType,
    resourceId: target.resourceId,
    action: authorization.action,
    capability: authorization.capability,
    resourceFamilyId: target.familyId,
    purpose: authorization.purpose,
    occurredAt: authorization.occurredAt,
    contextHash: authorization.contextHash,
    dataClasses: target.dataClasses,
    correlationId: context.correlationId
  });
  if (
    target.policyVersion !== authorization.policyVersion
    || target.policyPackageSha256 !== authorization.policyPackageSha256
    || !target.allowedAccountIds.includes(authorization.subject.accountId)
    || !target.allowedApplicationIds.includes(authorization.subject.applicationId)
    || !target.allowedCapabilities.includes(authorization.capability)
    || !target.allowedActions.includes(authorization.action)
    || !target.allowedPurposes.includes(authorization.purpose)
    || authorization.receiptRecord.request.resource.sensitivity !== target.sensitivity
    || !sameStrings(authorization.dataClasses, target.dataClasses)
    || canonicalObligationsJson(authorization.receiptRecord.decision.obligations)
      !== canonicalObligationsJson(target.obligations)
  ) {
    throw new Error('DERIVED_DATA_POLICY_TARGET_CONTEXT_MISMATCH');
  }
};

const assertAuthorizedSourceLookup = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  source: DerivedDataSourcePolicySnapshot
): void => {
  const authorization = context.policyAuthorization;
  if (
    source.resourceType !== authorization.resourceType
    || source.resourceId !== authorization.resourceId
    || source.familyId !== authorization.resourceFamilyId
    || source.policyVersion !== authorization.policyVersion
    || source.policyPackageSha256 !== authorization.policyPackageSha256
    || source.sensitivity !== authorization.receiptRecord.request.resource.sensitivity
    || !sameStrings(source.dataClasses, authorization.dataClasses)
    || !sameStrings(source.allowedAccountIds, [authorization.subject.accountId])
    || !sameStrings(source.allowedApplicationIds, [authorization.subject.applicationId])
    || !sameStrings(source.allowedCapabilities, [authorization.capability])
    || !sameStrings(source.allowedActions, [authorization.action])
    || !sameStrings(source.allowedPurposes, [authorization.purpose])
    || canonicalObligationsJson(authorization.receiptRecord.decision.obligations)
      !== canonicalObligationsJson(source.obligations)
  ) {
    throw new Error('SOURCE_LOOKUP_CONTEXT_MISMATCH');
  }
};

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is malformed`);
  }
  return value as Record<string, unknown>;
};

interface VerifiedReceiptRow {
  readonly row: Record<string, unknown>;
  readonly record: PlatformPolicyReceiptRecord;
}

const readVerifiedReceipt = (
  database: DatabaseExecutor,
  receiptHash: string,
  label: 'source' | 'producer'
): VerifiedReceiptRow => {
  const row = database.prepare(`
    SELECT receipt_hash,request_hash,context_hash,policy_version,policy_package_sha256,
      resource_type,resource_id,issued_at,data_classes_json,record_json
    FROM platform_policy_transaction_receipts WHERE receipt_hash=?
  `).get(receiptHash) as Record<string, unknown> | undefined;
  if (!row || !strictIso(row.issued_at) || !SHA256.test(receiptHash)) {
    throw new Error(`DERIVED_DATA_POLICY_${label.toUpperCase()}_RECEIPT_MISSING`);
  }
  const rawRecord = JSON.parse(String(row.record_json)) as unknown;
  const receiptRecord = asRecord(rawRecord, `${label} receipt record`);
  const request = asRecord(receiptRecord.request, `${label} receipt request`);
  const resource = asRecord(request.resource, `${label} receipt resource`);
  const decision = asRecord(receiptRecord.decision, `${label} receipt decision`);
  const receipt = asRecord(receiptRecord.receipt, `${label} signed receipt`);
  const receiptDecision = asRecord(receipt.decision, `${label} signed receipt decision`);
  let computedReceiptHash: string;
  try {
    computedReceiptHash = computePlatformPolicyReceiptHash(
      receipt as unknown as PlatformPolicyReceipt
    );
  } catch {
    throw new Error(`DERIVED_DATA_POLICY_${label.toUpperCase()}_RECEIPT_MALFORMED`);
  }
  if (
    row.receipt_hash !== receiptHash
    || computedReceiptHash !== receiptHash
    || canonicalJson(receiptRecord) !== String(row.record_json)
    || receipt.requestHash !== row.request_hash
    || receipt.issuedAt !== row.issued_at
    || receiptRecord.recordedAt !== row.issued_at
    || receiptRecord.contextHash !== row.context_hash
    || decision.contextHash !== row.context_hash
    || receiptDecision.contextHash !== row.context_hash
    || receiptRecord.policyPackageSha256 !== row.policy_package_sha256
    || request.policyPackageSha256 !== row.policy_package_sha256
    || decision.policyPackageSha256 !== row.policy_package_sha256
    || receiptDecision.policyPackageSha256 !== row.policy_package_sha256
    || request.policyVersion !== row.policy_version
    || decision.policyVersion !== row.policy_version
    || receiptDecision.policyVersion !== row.policy_version
    || receiptRecord.resourceType !== row.resource_type
    || receiptRecord.resourceId !== row.resource_id
    || resource.type !== row.resource_type
    || resource.id !== row.resource_id
    || receiptRecord.action !== request.action
    || receiptRecord.capability !== request.capability
    || receiptRecord.correlationId !== request.correlationId
    || canonicalJson(receiptRecord.dataClasses) !== String(row.data_classes_json)
    || canonicalJson(resource.dataClasses) !== String(row.data_classes_json)
    || canonicalJson(decision) !== canonicalJson(receiptDecision)
    || decision.allowed !== true
  ) {
    throw new Error(`DERIVED_DATA_POLICY_${label.toUpperCase()}_RECEIPT_ENVELOPE_MISMATCH`);
  }
  return {
    row,
    record: receiptRecord as unknown as PlatformPolicyReceiptRecord
  };
};

const assertSourceReceipt = (
  database: DatabaseExecutor,
  source: DerivedDataSourcePolicySnapshot
): string => {
  const { row, record } = readVerifiedReceipt(database, source.receiptHash, 'source');
  const receiptRecord = record as unknown as Record<string, unknown>;
  const request = asRecord(receiptRecord.request, 'source receipt request');
  const subject = asRecord(request.subject, 'source receipt subject');
  const resource = asRecord(request.resource, 'source receipt resource');
  const decision = asRecord(receiptRecord.decision, 'source receipt decision');
  if (
    row.receipt_hash !== source.receiptHash
    || row.request_hash !== source.requestHash
    || row.context_hash !== source.contextHash
    || row.policy_version !== source.policyVersion
    || row.policy_package_sha256 !== source.policyPackageSha256
    || row.resource_type !== source.resourceType
    || row.resource_id !== source.resourceId
    || decision.allowed !== true
    || resource.familyId !== source.familyId
    || resource.sensitivity !== source.sensitivity
    || String(row.data_classes_json) !== canonicalJson(source.dataClasses)
    || typeof subject.accountId !== 'string'
    || typeof subject.applicationId !== 'string'
    || typeof request.capability !== 'string'
    || typeof request.action !== 'string'
    || typeof request.purpose !== 'string'
    || !sameStrings(source.allowedAccountIds, [subject.accountId])
    || !sameStrings(source.allowedApplicationIds, [subject.applicationId])
    || !sameStrings(source.allowedCapabilities, [request.capability])
    || !sameStrings(source.allowedActions, [request.action])
    || !sameStrings(source.allowedPurposes, [request.purpose])
    || canonicalObligationsJson(decision.obligations) !== canonicalObligationsJson(source.obligations)
  ) {
    throw new Error('DERIVED_DATA_POLICY_SOURCE_RECEIPT_MISMATCH');
  }
  return String(row.issued_at);
};

const includesString = (values: readonly string[], candidate: unknown): candidate is string =>
  typeof candidate === 'string' && values.includes(candidate);

const assertProducerReceipt = (
  database: DatabaseExecutor,
  target: DerivedDataTargetPolicy,
  bindingRow: Record<string, unknown>
): void => {
  const producerReceiptHash = bindingRow.producer_receipt_hash;
  if (typeof producerReceiptHash !== 'string') {
    throw new Error('DERIVED_DATA_POLICY_PRODUCER_RECEIPT_HASH_MISSING');
  }
  const { row, record } = readVerifiedReceipt(database, producerReceiptHash, 'producer');
  const request = record.request;
  const resource = request.resource;
  const decision = record.decision;
  if (
    row.issued_at !== bindingRow.created_at
    || row.policy_version !== target.policyVersion
    || row.policy_package_sha256 !== target.policyPackageSha256
    || row.resource_type !== target.resourceType
    || row.resource_id !== target.resourceId
    || resource.type !== target.resourceType
    || resource.id !== target.resourceId
    || resource.familyId !== target.familyId
    || resource.sensitivity !== target.sensitivity
    || canonicalJson(resource.dataClasses) !== canonicalJson(target.dataClasses)
    || canonicalJson(record.dataClasses) !== canonicalJson(target.dataClasses)
    || !includesString(target.allowedAccountIds, request.subject.accountId)
    || !includesString(target.allowedApplicationIds, request.subject.applicationId)
    || !includesString(target.allowedCapabilities, request.capability)
    || !includesString(target.allowedActions, request.action)
    || !includesString(target.allowedPurposes, request.purpose)
    || canonicalObligationsJson(decision.obligations)
      !== canonicalObligationsJson(target.obligations)
  ) {
    throw new Error('DERIVED_DATA_POLICY_PRODUCER_RECEIPT_MISMATCH');
  }
};

const assertStoredBindingRows = (
  database: DatabaseExecutor,
  normalized: NormalizedBinding,
  row: Record<string, unknown>,
  traversal: StoredLineageTraversal = {
    activePath: new Set<string>(),
    validated: new Set<string>()
  }
): void => {
  const binding = normalized.binding;
  const target = binding.target;
  if (traversal.activePath.has(binding.bindingHash)) {
    throw new Error('DERIVED_DATA_POLICY_STORED_LINEAGE_CYCLE');
  }
  if (traversal.validated.has(binding.bindingHash)) return;
  if (new Set([
    ...traversal.activePath,
    ...traversal.validated,
    binding.bindingHash
  ]).size > DERIVED_DATA_MAX_ANCESTOR_COUNT) {
    throw new Error('DERIVED_DATA_POLICY_STORED_ANCESTOR_COUNT_EXCEEDED');
  }
  if (traversal.activePath.size >= DERIVED_DATA_MAX_LINEAGE_DEPTH) {
    throw new Error('DERIVED_DATA_POLICY_STORED_LINEAGE_DEPTH_EXCEEDED');
  }
  const nextActivePath = new Set(traversal.activePath);
  nextActivePath.add(binding.bindingHash);
  if (
    row.binding_hash !== binding.bindingHash
    || row.schema_version !== 1
    || row.derived_kind !== target.kind
    || row.derived_resource_type !== target.resourceType
    || row.derived_resource_id !== target.resourceId
    || row.derived_resource_version !== target.resourceVersion
    || row.content_sha256 !== target.contentSha256
    || row.family_id !== target.familyId
    || row.policy_version !== target.policyVersion
    || row.policy_package_sha256 !== target.policyPackageSha256
    || row.sensitivity !== target.sensitivity
    || row.data_classes_json !== canonicalJson(target.dataClasses)
    || row.access_policy_json !== normalized.accessPolicyJson
    || row.access_policy_sha256 !== normalized.accessPolicySha256
    || row.obligations_json !== normalized.obligationsJson
    || row.obligations_sha256 !== normalized.obligationsSha256
    || row.source_set_sha256 !== binding.sourceSetHash
    || row.binding_json !== normalized.bindingJson
    || row.source_count !== binding.sources.length
    || row.lineage_depth !== binding.lineageDepth
    || row.retention_until !== binding.effectivePolicy.retentionUntil
    || row.status !== 'sealed'
    || !strictIso(row.created_at)
    || !strictIso(row.sealed_at)
  ) {
    throw new Error('DERIVED_DATA_POLICY_STORED_BINDING_MISMATCH');
  }
  assertProducerReceipt(database, target, row);

  const sourceRows = database.prepare(`
    SELECT * FROM derived_data_policy_sources
    WHERE binding_hash=? ORDER BY source_ordinal
  `).all(binding.bindingHash) as Array<Record<string, unknown>>;
  if (sourceRows.length !== normalized.sources.length) {
    throw new Error('DERIVED_DATA_POLICY_STORED_SOURCE_COUNT_MISMATCH');
  }
  for (const source of normalized.sources) {
    const stored = sourceRows[source.ordinal];
    const snapshot = source.snapshot;
    if (
      !stored
      || stored.binding_hash !== binding.bindingHash
      || stored.source_ordinal !== source.ordinal
      || stored.source_key !== source.sourceKey
      || stored.source_resource_type !== snapshot.resourceType
      || stored.source_resource_id !== snapshot.resourceId
      || stored.source_resource_version !== snapshot.resourceVersion
      || stored.content_sha256 !== snapshot.contentSha256
      || stored.family_id !== snapshot.familyId
      || stored.policy_version !== snapshot.policyVersion
      || stored.policy_package_sha256 !== snapshot.policyPackageSha256
      || stored.sensitivity !== snapshot.sensitivity
      || stored.data_classes_json !== canonicalJson(snapshot.dataClasses)
      || stored.policy_receipt_hash !== snapshot.receiptHash
      || stored.context_hash !== snapshot.contextHash
      || stored.request_hash !== snapshot.requestHash
      || stored.source_snapshot_json !== source.snapshotJson
      || stored.source_snapshot_sha256 !== source.snapshotSha256
      || stored.lineage_depth !== snapshot.lineageDepth
      || stored.retention_until !== snapshot.retentionUntil
      || !strictIso(stored.authorized_at)
    ) {
      throw new Error('DERIVED_DATA_POLICY_STORED_SOURCE_MISMATCH');
    }
    const receiptIssuedAt = assertSourceReceipt(database, snapshot);
    if (receiptIssuedAt !== stored.authorized_at) {
      throw new Error('DERIVED_DATA_POLICY_STORED_SOURCE_AUTHORIZATION_TIME_MISMATCH');
    }
    const authorizationAgeMs = Date.parse(String(row.created_at)) - Date.parse(receiptIssuedAt);
    if (authorizationAgeMs < 0 || authorizationAgeMs > SOURCE_RECEIPT_MAX_AGE_MS) {
      throw new Error('DERIVED_DATA_POLICY_STORED_SOURCE_RECEIPT_STALE');
    }
  }
  assertSourceLineageBindings(database, normalized, {
    activePath: nextActivePath,
    validated: traversal.validated
  });
  traversal.validated.add(binding.bindingHash);
};

const parseStoredBinding = (value: unknown): DerivedDataPolicyBinding => {
  if (typeof value !== 'string') throw new Error('DERIVED_DATA_POLICY_BINDING_JSON_MISSING');
  const parsed = JSON.parse(value) as DerivedDataPolicyBinding;
  if (canonicalJson(parsed) !== value) throw new Error('DERIVED_DATA_POLICY_BINDING_JSON_NOT_CANONICAL');
  return parsed;
};

const assertSourceLineageBindings = (
  database: DatabaseExecutor,
  normalized: NormalizedBinding,
  traversal: StoredLineageTraversal
): void => {
  for (const source of normalized.sources) {
    const snapshot = source.snapshot;
    const upstreamRows = database.prepare(`
      SELECT * FROM derived_data_policy_bindings
      WHERE derived_resource_type=?
        AND derived_resource_id=?
        AND derived_resource_version=?
      ORDER BY binding_hash
    `).all(
      snapshot.resourceType,
      snapshot.resourceId,
      snapshot.resourceVersion
    ) as Array<Record<string, unknown>>;

    if (upstreamRows.length === 0) {
      if (snapshot.lineageDepth !== 0 || snapshot.ancestorResources.length !== 0) {
        throw new Error('DERIVED_DATA_POLICY_PRIMARY_SOURCE_LINEAGE_MISMATCH');
      }
      continue;
    }
    if (upstreamRows.length !== 1) {
      throw new Error('DERIVED_DATA_POLICY_SOURCE_UPSTREAM_AMBIGUOUS');
    }

    const upstreamRow = upstreamRows[0]!;
    if (
      upstreamRow.status !== 'sealed'
      || upstreamRow.content_sha256 !== snapshot.contentSha256
      || upstreamRow.family_id !== snapshot.familyId
    ) {
      throw new Error('DERIVED_DATA_POLICY_SOURCE_UPSTREAM_MISMATCH');
    }
    const upstream = normalizeBinding(parseStoredBinding(upstreamRow.binding_json));
    const upstreamTarget = upstream.binding.target;
    if (
      upstreamTarget.resourceType !== snapshot.resourceType
      || upstreamTarget.resourceId !== snapshot.resourceId
      || upstreamTarget.resourceVersion !== snapshot.resourceVersion
      || upstreamTarget.contentSha256 !== snapshot.contentSha256
      || upstreamTarget.familyId !== snapshot.familyId
    ) {
      throw new Error('DERIVED_DATA_POLICY_SOURCE_UPSTREAM_TARGET_MISMATCH');
    }
    assertStoredBindingRows(database, upstream, upstreamRow, traversal);
    if (!sourcePolicyNoBroaderThanUpstream(snapshot, upstream.binding.target)) {
      throw new Error('DERIVED_DATA_POLICY_SOURCE_UPSTREAM_POLICY_BROADENED');
    }
    if (
      snapshot.lineageDepth !== upstream.binding.lineageDepth
      || canonicalJson(snapshot.ancestorResources)
        !== canonicalJson(upstream.binding.ancestorResources)
    ) {
      throw new Error('DERIVED_DATA_POLICY_SOURCE_LINEAGE_MISMATCH');
    }
  }
};

export class SqliteDerivedDataPolicyRepository extends SqliteRepository implements DerivedDataPolicyRepositoryPort {
  public insertSealed(
    context: PolicyAuthorizedRepositoryExecutionContext,
    candidate: DerivedDataPolicyBinding
  ): RepositoryResult<void> {
    return this.execute(context, () => {
      const normalized = normalizeBinding(candidate);
      const binding = normalized.binding;
      const target = binding.target;
      assertAuthorizedTarget(context, target);
      if (!strictIso(context.occurredAt)) throw new Error('DERIVED_DATA_POLICY_TRANSACTION_TIME_INVALID');
      const database = this.database(context);
      assertSourceLineageBindings(database, normalized, {
        activePath: new Set([binding.bindingHash]),
        validated: new Set<string>()
      });
      const sourceAuthorizedAt = normalized.sources.map((source) =>
        assertSourceReceipt(database, source.snapshot));
      const targetOccurredAtMs = Date.parse(context.occurredAt);
      if (sourceAuthorizedAt.some((issuedAt) => {
        const ageMs = targetOccurredAtMs - Date.parse(issuedAt);
        return ageMs < 0 || ageMs > SOURCE_RECEIPT_MAX_AGE_MS;
      })) {
        throw new Error('DERIVED_DATA_POLICY_SOURCE_RECEIPT_STALE');
      }
      const producerReceiptHash = computePlatformPolicyReceiptHash(context.policyAuthorization.receipt);

      database.prepare(`
        INSERT INTO derived_data_policy_bindings(
          binding_hash,schema_version,derived_kind,derived_resource_type,derived_resource_id,
          derived_resource_version,content_sha256,family_id,policy_version,policy_package_sha256,
          sensitivity,data_classes_json,access_policy_json,access_policy_sha256,obligations_json,
          obligations_sha256,source_set_sha256,producer_receipt_hash,binding_json,source_count,
          lineage_depth,retention_until,status,created_at,sealed_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        binding.bindingHash,
        1,
        target.kind,
        target.resourceType,
        target.resourceId,
        target.resourceVersion,
        target.contentSha256,
        target.familyId,
        target.policyVersion,
        target.policyPackageSha256,
        target.sensitivity,
        canonicalJson(target.dataClasses),
        normalized.accessPolicyJson,
        normalized.accessPolicySha256,
        normalized.obligationsJson,
        normalized.obligationsSha256,
        binding.sourceSetHash,
        producerReceiptHash,
        normalized.bindingJson,
        binding.sources.length,
        binding.lineageDepth,
        binding.effectivePolicy.retentionUntil,
        'pending',
        context.occurredAt,
        null
      );

      const insertSource = database.prepare(`
        INSERT INTO derived_data_policy_sources(
          binding_hash,source_ordinal,source_key,source_resource_type,source_resource_id,
          source_resource_version,content_sha256,family_id,policy_version,policy_package_sha256,
          sensitivity,data_classes_json,policy_receipt_hash,context_hash,request_hash,
          source_snapshot_json,source_snapshot_sha256,lineage_depth,retention_until,authorized_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `);
      for (const source of normalized.sources) {
        const snapshot = source.snapshot;
        insertSource.run(
          binding.bindingHash,
          source.ordinal,
          source.sourceKey,
          snapshot.resourceType,
          snapshot.resourceId,
          snapshot.resourceVersion,
          snapshot.contentSha256,
          snapshot.familyId,
          snapshot.policyVersion,
          snapshot.policyPackageSha256,
          snapshot.sensitivity,
          canonicalJson(snapshot.dataClasses),
          snapshot.receiptHash,
          snapshot.contextHash,
          snapshot.requestHash,
          source.snapshotJson,
          source.snapshotSha256,
          snapshot.lineageDepth,
          snapshot.retentionUntil,
          sourceAuthorizedAt[source.ordinal]
        );
      }

      const sealed = database.prepare(`
        UPDATE derived_data_policy_bindings SET status='sealed',sealed_at=?
        WHERE binding_hash=? AND status='pending'
      `).run(context.occurredAt, binding.bindingHash);
      if (Number(sealed.changes) !== 1) throw new Error('DERIVED_DATA_POLICY_BINDING_SEAL_FAILED');
    });
  }

  public findByHash(
    context: PolicyAuthorizedRepositoryExecutionContext,
    bindingHash: string
  ): RepositoryResult<DerivedDataPolicyBinding | undefined> {
    return this.execute(context, () => {
      assertPolicyAuthorizedRepositoryContext(context);
      if (!SHA256.test(bindingHash)) throw new Error('DERIVED_DATA_POLICY_BINDING_HASH_INVALID');
      const database = this.database(context);
      const row = database.prepare(`
        SELECT * FROM derived_data_policy_bindings
        WHERE binding_hash=? AND family_id=? AND status='sealed'
      `).get(bindingHash, context.policyAuthorization.resourceFamilyId) as Record<string, unknown> | undefined;
      if (!row) return undefined;
      const normalized = normalizeBinding(parseStoredBinding(row.binding_json));
      if (normalized.binding.bindingHash !== bindingHash) {
        throw new Error('DERIVED_DATA_POLICY_BINDING_KEY_MISMATCH');
      }
      assertAuthorizedTarget(context, normalized.binding.target);
      assertStoredBindingRows(database, normalized, row);
      return normalized.binding;
    });
  }

  public listBindingHashesBySource(
    context: PolicyAuthorizedRepositoryExecutionContext,
    sourceKey: string
  ): RepositoryResult<readonly string[]> {
    return this.execute(context, () => {
      assertPolicyAuthorizedRepositoryContext(context);
      if (sourceKey.trim() !== sourceKey || sourceKey.length < 1 || sourceKey.length > 512) {
        throw new Error('DERIVED_DATA_POLICY_SOURCE_KEY_INVALID');
      }
      const authorization = context.policyAuthorization;
      const database = this.database(context);
      const rows = database.prepare(`
        SELECT binding.*
        FROM derived_data_policy_sources source
        JOIN derived_data_policy_bindings binding ON binding.binding_hash=source.binding_hash
        WHERE source.source_key=?
          AND source.source_resource_type=?
          AND source.source_resource_id=?
          AND source.family_id=?
          AND binding.status='sealed'
        ORDER BY binding.created_at,binding.binding_hash
      `).all(
        sourceKey,
        authorization.resourceType,
        authorization.resourceId,
        authorization.resourceFamilyId
      ) as Array<Record<string, unknown>>;
      return Object.freeze(rows.map((row) => {
        const normalized = normalizeBinding(parseStoredBinding(row.binding_json));
        const source = normalized.sources.find((candidate) => candidate.sourceKey === sourceKey);
        if (
          !source
          || source.snapshot.resourceType !== authorization.resourceType
          || source.snapshot.resourceId !== authorization.resourceId
          || source.snapshot.familyId !== authorization.resourceFamilyId
        ) {
          throw new Error('DERIVED_DATA_POLICY_SOURCE_INDEX_MISMATCH');
        }
        assertAuthorizedSourceLookup(context, source.snapshot);
        assertStoredBindingRows(database, normalized, row);
        return normalized.binding.bindingHash;
      }));
    });
  }
}
