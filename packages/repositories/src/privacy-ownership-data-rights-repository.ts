import { createHash } from 'node:crypto';
import { asFamilyId, asIsoDateTime, asPersonId, asUserId } from '@ppt/core';
import type {
  AccessHistoryEntryView,
  AiMemoryRecordView,
  DataInventoryItemView,
  DerivedDataLineageView,
  LocalDeviceActivityView,
  LocalProcessingObservationView,
  PrivacyOwnershipAggregateKey
} from '@ppt/domain';
import {
  canonicalAiMemoryStateJson,
  canonicalDataRightsRequestStateJson,
  canonicalEncryptedPrivacyExportStateJson,
  canonicalPrivacyIncidentStateJson
} from '@ppt/domain';
import type {
  AiMemoryRecordRow,
  DataRightsRequestRow,
  EncryptedPrivacyExportRow,
  PolicyAuthorizedRepositoryExecutionContext,
  PrivacyIncidentQuarantineWrite,
  PrivacyIncidentRevocationWrite,
  PrivacyIncidentRow,
  PrivacyOwnershipCenterSnapshotRow,
  PrivacyOwnershipDataRightsRepositoryPort,
  PrivacyOwnershipMutationRow,
  PrivacyOwnershipPolicyResourceResolution,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { assertPolicyAuthorizedRepositoryContext } from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const SHA256 = /^[0-9a-f]{64}$/u;
const MAX_AI_MEMORY = 500;
const MAX_INVENTORY = 1_000;
const MAX_ACCESS = 500;
const MAX_PROCESSING = 500;
const MAX_LINEAGE = 512;
const MAX_RIGHTS = 100;
const MAX_INCIDENTS = 100;

const inventoryCategory = (resourceType: string): DataInventoryItemView['category'] => {
  if (resourceType.startsWith('finance_') || resourceType === 'finance_record') return 'finance';
  if (resourceType === 'health_record' || resourceType === 'medication_plan'
    || resourceType === 'family_health_history') return 'health';
  if (resourceType.startsWith('legacy_') || resourceType === 'digital_legacy_plan') return 'legacy';
  if (resourceType.includes('archive')) return 'archive';
  if (resourceType.includes('location')) return 'location';
  if (resourceType.includes('event') || resourceType.includes('family') || resourceType === 'life_record') return 'family';
  return 'other';
};

const inventorySensitivity = (privacy: unknown): DataInventoryItemView['sensitivity'] =>
  String(privacy) === 'family' ? 'personal'
    : String(privacy) === 'selected_members' ? 'sensitive' : 'highly_sensitive';

const stable = (value: unknown): string => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  }
  throw new Error('Privacy ownership state contains a non-canonical value');
};

export const computePrivacyOwnershipStateFingerprint = (
  row: AiMemoryRecordRow | DataRightsRequestRow | PrivacyIncidentRow
): string => createHash('sha256').update(
  'statement' in row ? canonicalAiMemoryStateJson(row)
    : 'kind' in row ? canonicalDataRightsRequestStateJson(row)
      : canonicalPrivacyIncidentStateJson(row),
  'utf8'
).digest('hex');

const assertStateFingerprint = (row: AiMemoryRecordRow | DataRightsRequestRow | PrivacyIncidentRow): void => {
  if (!SHA256.test(row.stateFingerprint) || computePrivacyOwnershipStateFingerprint(row) !== row.stateFingerprint) {
    throw new Error('Privacy ownership state fingerprint mismatch');
  }
};

const parseArray = <T extends string>(value: unknown): readonly T[] => {
  const parsed: unknown = JSON.parse(String(value));
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new Error('Privacy ownership stored array is invalid');
  }
  return Object.freeze(parsed as T[]);
};

const parseIncidentActions = (value: unknown): PrivacyIncidentRow['actions'] => {
  const parsed: unknown = JSON.parse(String(value));
  if (!Array.isArray(parsed) || parsed.some((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return true;
    const record = item as Record<string, unknown>;
    return Object.keys(record).sort().join(',') !== 'action,targetId'
      || typeof record.action !== 'string' || typeof record.targetId !== 'string';
  })) throw new Error('Privacy incident actions are invalid');
  return Object.freeze(parsed as PrivacyIncidentRow['actions']);
};

const keyFrom = (row: Record<string, unknown>): PrivacyOwnershipAggregateKey => Object.freeze({
  familyId: asFamilyId(String(row.family_id)),
  accountId: asUserId(String(row.account_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id))
});

const mapAiMemory = (row: Record<string, unknown>): AiMemoryRecordRow => {
  const key = keyFrom(row);
  return Object.freeze({
    id: String(row.resource_id), key,
    familyId: key.familyId, accountId: key.accountId, ownerPersonId: key.ownerPersonId,
    derivedBindingHash: String(row.derived_binding_hash),
    revision: Number(row.revision), title: String(row.title), statement: String(row.statement),
    sourceResourceType: String(row.source_resource_type), sourceResourceId: String(row.source_resource_id),
    ...(row.source_occurred_at ? { sourceOccurredAt: asIsoDateTime(String(row.source_occurred_at)) } : {}),
    restriction: Object.freeze({
      visibility: String(row.restriction_visibility) as AiMemoryRecordView['restriction']['visibility'],
      selectedAccountIds: parseArray<ReturnType<typeof asUserId>>(row.selected_account_ids_json).map(asUserId),
      allowedPurposes: parseArray<AiMemoryRecordView['restriction']['allowedPurposes'][number]>(row.allowed_purposes_json),
      processingAllowed: Number(row.processing_allowed) === 1
    }),
    status: String(row.state) as AiMemoryRecordRow['status'],
    ...(row.retention_until ? { retentionUntil: asIsoDateTime(String(row.retention_until)) } : {}),
    ...(row.expired_at ? { expiredAt: asIsoDateTime(String(row.expired_at)) } : {}),
    ...(row.deletion_requested_at ? { deletionRequestedAt: asIsoDateTime(String(row.deletion_requested_at)) } : {}),
    ...(row.deleted_at ? { deletedAt: asIsoDateTime(String(row.deleted_at)) } : {}),
    createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at)),
    lastMutationId: String(row.last_mutation_id), stateFingerprint: String(row.state_fingerprint)
  });
};

const mapRights = (row: Record<string, unknown>): DataRightsRequestRow => {
  const key = keyFrom(row);
  return Object.freeze({
    id: String(row.id), key, familyId: key.familyId, accountId: key.accountId, ownerPersonId: key.ownerPersonId,
    revision: Number(row.revision), kind: String(row.request_kind) as DataRightsRequestRow['kind'],
    scopeResourceType: String(row.scope_resource_type), scopeResourceId: String(row.scope_resource_id),
    ...(row.requested_retention_until ? { requestedRetentionUntil: asIsoDateTime(String(row.requested_retention_until)) } : {}),
    status: String(row.status) as DataRightsRequestRow['status'], reason: String(row.reason),
    ...(row.resolution_note ? { resolutionNote: String(row.resolution_note) } : {}),
    encryptedExportRequired: Number(row.encrypted_export_required) === 1,
    externalCopiesErasureGuaranteed: false,
    createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at)),
    lastMutationId: String(row.last_mutation_id), stateFingerprint: String(row.state_fingerprint)
  });
};

const mapIncident = (row: Record<string, unknown>): PrivacyIncidentRow => {
  const key = keyFrom(row);
  return Object.freeze({
    id: String(row.id), key, familyId: key.familyId, accountId: key.accountId, ownerPersonId: key.ownerPersonId,
    revision: Number(row.revision), title: String(row.title),
    severity: String(row.severity) as PrivacyIncidentRow['severity'],
    status: String(row.status) as PrivacyIncidentRow['status'], suspectedAt: asIsoDateTime(String(row.suspected_at)),
    actions: parseIncidentActions(row.actions_json),
    evidenceReferenceIds: parseArray<string>(row.evidence_reference_ids_json),
    ...(row.resolution_note ? { resolutionNote: String(row.resolution_note) } : {}),
    remoteWipePerformed: false, mdmOperationPerformed: false, networkDeliveryGuaranteed: false,
    createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at)),
    lastMutationId: String(row.last_mutation_id), stateFingerprint: String(row.state_fingerprint)
  });
};

const mapEncryptedExport = (row: Record<string, unknown>): EncryptedPrivacyExportRow => {
  const key = keyFrom(row);
  const mapped: EncryptedPrivacyExportRow = Object.freeze({
    id:String(row.id),key,familyId:key.familyId,accountId:key.accountId,ownerPersonId:key.ownerPersonId,
    requestId:String(row.rights_request_id),requestKind:String(row.request_kind) as EncryptedPrivacyExportRow['requestKind'],
    requestRevision:Number(row.request_revision),artifactSha256:String(row.artifact_sha256),envelopeSha256:String(row.envelope_sha256),
    lineageSha256:String(row.lineage_snapshot_sha256),itemCount:Number(row.item_count),plaintextSizeBytes:Number(row.plaintext_size_bytes),
    sizeBytes:Number(row.size_bytes),readbackVerified:true,encrypted:true,localUserSelected:true,networkDeliveryGuaranteed:false,
    recipientReadGuaranteed:false,localArtifactPathExposed:false,passphraseExposed:false,createdAt:asIsoDateTime(String(row.created_at)),
    stateFingerprint:String(row.state_fingerprint)
  });
  const fingerprint=createHash('sha256').update(canonicalEncryptedPrivacyExportStateJson(mapped),'utf8').digest('hex');
  if(fingerprint!==mapped.stateFingerprint)throw new Error('Encrypted export state fingerprint mismatch');
  return mapped;
};

const mapMutation = (row: Record<string, unknown>): PrivacyOwnershipMutationRow => Object.freeze({
  id: String(row.id), clientOperationId: String(row.client_operation_id),
  requestFingerprint: String(row.request_fingerprint), stateFingerprint: String(row.state_fingerprint),
  familyId: asFamilyId(String(row.family_id)), accountId: asUserId(String(row.account_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  mutationKind: String(row.mutation_kind) as PrivacyOwnershipMutationRow['mutationKind'],
  resourceType: String(row.resource_type) as PrivacyOwnershipMutationRow['resourceType'],
  resourceId: String(row.resource_id), previousRevision: Number(row.previous_revision), revision: Number(row.revision),
  createdAt: asIsoDateTime(String(row.occurred_at))
});

const assertKey = (context: RepositoryExecutionContext, key: PrivacyOwnershipAggregateKey): void => {
  if (String(context.actor.userId) !== key.accountId || context.actor.personId !== key.ownerPersonId) {
    throw new Error('Privacy ownership repository requires the exact account/person actor');
  }
};

const policyScope = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  key: PrivacyOwnershipAggregateKey,
  resourceType: string,
  resourceId: string,
  actions: readonly ('read' | 'create' | 'update' | 'delete')[]
) => {
  assertKey(context, key);
  const authorization = context.policyAuthorization;
  if (!actions.includes(authorization.action as never)
    || authorization.subject.accountId !== key.accountId
    || authorization.subject.personId !== key.ownerPersonId
    || authorization.resourceFamilyId !== key.familyId
    || authorization.resourceOwnerPersonId !== key.ownerPersonId
    || !authorization.subject.familyIds.includes(key.familyId)
    || authorization.resourceType !== resourceType || authorization.resourceId !== resourceId
    || authorization.receiptRecord.request.resource.sensitivity === 'public'
    || authorization.receiptRecord.request.resource.sensitivity === 'internal') {
    throw new Error('Privacy ownership policy subject, resource or sensitivity mismatch');
  }
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType, resourceId, action: authorization.action, capability: authorization.capability,
    correlationId: context.correlationId, resourceFamilyId: key.familyId,
    resourceOwnerPersonId: key.ownerPersonId, purpose: authorization.purpose
  });
  const policy = platformPolicyPersistenceBinding(context, resourceType, resourceId);
  if (!policy) throw new Error('Privacy ownership write requires a durable policy receipt');
  return policy;
};

const rowKeyMatches = (row: { readonly familyId: string; readonly accountId: string; readonly ownerPersonId: string }, key: PrivacyOwnershipAggregateKey): boolean =>
  row.familyId === key.familyId && row.accountId === key.accountId && row.ownerPersonId === key.ownerPersonId;

export class SqlitePrivacyOwnershipDataRightsRepository extends SqliteRepository implements PrivacyOwnershipDataRightsRepositoryPort {
  public resolvePolicyResource(context: RepositoryExecutionContext, key: PrivacyOwnershipAggregateKey,
    resourceType: 'privacy_ownership_center' | 'ai_memory_record' | 'data_rights_request' | 'privacy_incident', resourceId: string
  ): RepositoryResult<PrivacyOwnershipPolicyResourceResolution | null> {
    assertKey(context, key);
    return this.execute(context, () => {
      const active = this.database(context).prepare(`SELECT 1 FROM accounts a JOIN people p ON p.id=a.person_id
        WHERE a.id=? AND a.status='active' AND p.id=? AND p.family_id=? AND p.status='active'`)
        .get(key.accountId, key.ownerPersonId, key.familyId);
      if (!active) return null;
      if (resourceType === 'privacy_ownership_center') return Object.freeze({
        familyId: key.familyId, ownerPersonId: key.ownerPersonId, revision: 0,
        stateFingerprint: createHash('sha256').update(stable(key)).digest('hex'), sensitivity: 'personal' as const
      });
      const table = resourceType === 'ai_memory_record' ? 'governed_ai_memory_records'
        : resourceType === 'data_rights_request' ? 'privacy_rights_requests' : 'policy_incident_cases';
      const idColumn = resourceType === 'ai_memory_record' ? 'resource_id' : 'id';
      const row = this.database(context).prepare(`SELECT family_id,owner_person_id,revision,state_fingerprint,policy_receipt_hash
        FROM ${table} WHERE ${idColumn}=? AND family_id=? AND account_id=? AND owner_person_id=?`)
        .get(resourceId, key.familyId, key.accountId, key.ownerPersonId) as Record<string, unknown> | undefined;
      if (!row) return null;
      const receipt = this.database(context).prepare(`SELECT json_extract(record_json,'$.request.resource.sensitivity') sensitivity
        FROM platform_policy_transaction_receipts WHERE receipt_hash=?`).get(row.policy_receipt_hash) as { sensitivity?: unknown } | undefined;
      const sensitivity = String(receipt?.sensitivity);
      if (!['personal', 'sensitive', 'highly_sensitive'].includes(sensitivity)) throw new Error('Privacy resource sensitivity receipt is invalid');
      return Object.freeze({ familyId: key.familyId, ownerPersonId: key.ownerPersonId,
        revision: Number(row.revision), stateFingerprint: String(row.state_fingerprint), sensitivity: sensitivity as 'personal' | 'sensitive' | 'highly_sensitive' });
    });
  }

  public loadCenter(context: PolicyAuthorizedRepositoryExecutionContext, key: PrivacyOwnershipAggregateKey): RepositoryResult<PrivacyOwnershipCenterSnapshotRow> {
    policyScope(context, key, 'privacy_ownership_center', key.accountId, ['read']);
    return this.execute(context, () => {
      const db = this.database(context);
      const aiRows = db.prepare(`SELECT * FROM governed_ai_memory_records WHERE family_id=? AND account_id=? AND owner_person_id=? ORDER BY updated_at DESC,resource_id LIMIT ?`)
        .all(key.familyId, key.accountId, key.ownerPersonId, MAX_AI_MEMORY) as Record<string, unknown>[];
      const aiMemoryRecords = aiRows.map(mapAiMemory);
      const inventory: DataInventoryItemView[] = [];
      const aiInventory = db.prepare(`SELECT state,COUNT(*) record_count,MAX(retention_until) retention_until
        FROM governed_ai_memory_records WHERE family_id=? AND account_id=? AND owner_person_id=? GROUP BY state ORDER BY state`)
        .all(key.familyId,key.accountId,key.ownerPersonId) as Record<string,unknown>[];
      for(const row of aiInventory) inventory.push(Object.freeze({id:`inventory/ai/${String(row.state)}`,key,category:'ai_memory',
        resourceType:'ai_memory_record',resourceId:'*',displayName:`ai_memory:${String(row.state)}`,recordCount:Number(row.record_count),
        storageScope:'local_encrypted',sensitivity:'highly_sensitive',...(row.retention_until?{retentionUntil:asIsoDateTime(String(row.retention_until))}:{}),derivedDataCount:0}));
      const rightsInventory = db.prepare(`SELECT request_kind,status,COUNT(*) record_count FROM privacy_rights_requests
        WHERE family_id=? AND account_id=? AND owner_person_id=? GROUP BY request_kind,status ORDER BY request_kind,status`)
        .all(key.familyId,key.accountId,key.ownerPersonId) as Record<string,unknown>[];
      for(const row of rightsInventory) inventory.push(Object.freeze({id:`inventory/rights/${String(row.request_kind)}/${String(row.status)}`,key,category:'security',
        resourceType:'data_rights_request',resourceId:'*',displayName:`${String(row.request_kind)}:${String(row.status)}`,recordCount:Number(row.record_count),
        storageScope:'local_encrypted',sensitivity:'personal',derivedDataCount:0}));
      const incidentInventory = db.prepare(`SELECT severity,status,COUNT(*) record_count FROM policy_incident_cases
        WHERE family_id=? AND account_id=? AND owner_person_id=? GROUP BY severity,status ORDER BY severity,status`)
        .all(key.familyId,key.accountId,key.ownerPersonId) as Record<string,unknown>[];
      for(const row of incidentInventory) inventory.push(Object.freeze({id:`inventory/incident/${String(row.severity)}/${String(row.status)}`,key,category:'security',
        resourceType:'privacy_incident',resourceId:'*',displayName:`incident:${String(row.severity)}:${String(row.status)}`,recordCount:Number(row.record_count),
        storageScope:'local_encrypted',sensitivity:'highly_sensitive',derivedDataCount:0}));
      const deviceInventory = db.prepare(`SELECT CASE WHEN revoked_at IS NULL THEN 'trusted' ELSE 'revoked' END status,COUNT(*) record_count
        FROM trusted_devices WHERE account_id=? GROUP BY status ORDER BY status`).all(key.accountId) as Record<string,unknown>[];
      for(const row of deviceInventory) inventory.push(Object.freeze({id:`inventory/device/${String(row.status)}`,key,category:'security',
        resourceType:'trusted_device',resourceId:'*',displayName:`trusted_device:${String(row.status)}`,recordCount:Number(row.record_count),
        storageScope:'local_encrypted',sensitivity:'personal',derivedDataCount:0}));
      const derivedInventory = db.prepare(`SELECT b.derived_kind,b.derived_resource_type,b.sensitivity,COUNT(*) record_count,MAX(b.retention_until) retention_until
        FROM derived_data_policy_bindings b JOIN platform_policy_transaction_receipts receipt ON receipt.receipt_hash=b.producer_receipt_hash
        WHERE b.family_id=? AND b.status='sealed'
          AND json_extract(receipt.record_json,'$.request.subject.accountId')=?
          AND json_extract(receipt.record_json,'$.request.subject.personId')=?
          AND json_extract(receipt.record_json,'$.request.resource.familyId')=?
          AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=?
        GROUP BY b.derived_kind,b.derived_resource_type,b.sensitivity ORDER BY b.derived_kind,b.derived_resource_type`)
        .all(key.familyId,key.accountId,key.ownerPersonId,key.familyId,key.ownerPersonId) as Record<string,unknown>[];
      for(const row of derivedInventory){const kind=String(row.derived_kind);inventory.push(Object.freeze({id:`inventory/derived/${kind}/${String(row.derived_resource_type)}`,key,
        category:kind==='AI_MEMORY'?'ai_memory':kind==='OCR_TEXT'?'ocr':kind==='TRANSLATION'?'translation':'other',resourceType:String(row.derived_resource_type),
        resourceId:'*',displayName:`derived:${kind}`,recordCount:Number(row.record_count),storageScope:'local_encrypted',
        sensitivity:String(row.sensitivity) as DataInventoryItemView['sensitivity'],...(row.retention_until?{retentionUntil:asIsoDateTime(String(row.retention_until))}:{}),
        derivedDataCount:Number(row.record_count)}));}
      const lifecycleInventory = db.prepare(`SELECT lifecycle.resource_type,lifecycle.privacy,lifecycle.state,COUNT(*) record_count,
          MAX(lifecycle.purge_eligible_at) purge_eligible_at
        FROM data_lifecycle lifecycle
        JOIN people owner ON owner.id=lifecycle.owner_person_id AND owner.family_id=? AND owner.status='active'
        WHERE lifecycle.owner_person_id=? AND lifecycle.state<>'purged'
        GROUP BY lifecycle.resource_type,lifecycle.privacy,lifecycle.state ORDER BY lifecycle.resource_type,lifecycle.state`)
        .all(key.familyId,key.ownerPersonId) as Record<string,unknown>[];
      for(const row of lifecycleInventory){const resourceType=String(row.resource_type);inventory.push(Object.freeze({
        id:`inventory/lifecycle/${resourceType}/${String(row.state)}/${String(row.privacy)}`,key,category:inventoryCategory(resourceType),
        resourceType,resourceId:'*',displayName:`held:${resourceType}:${String(row.state)}`,recordCount:Number(row.record_count),
        storageScope:'local_encrypted',sensitivity:inventorySensitivity(row.privacy),
        ...(row.purge_eligible_at?{retentionUntil:asIsoDateTime(String(row.purge_eligible_at))}:{}),
        derivedDataCount:0
      }));}
      const legacyInventory = db.prepare(`SELECT plan.status,COUNT(DISTINCT plan.id) record_count,
          COUNT(DISTINCT grant_row.id) grant_count,COUNT(DISTINCT approval.id) approval_count
        FROM digital_legacy_plans plan JOIN people owner ON owner.id=plan.owner_person_id
        LEFT JOIN legacy_grants grant_row ON grant_row.plan_id=plan.id
        LEFT JOIN legacy_approvals approval ON approval.plan_id=plan.id
        WHERE plan.owner_person_id=? AND owner.family_id=? AND owner.status='active'
        GROUP BY plan.status ORDER BY plan.status`).all(key.ownerPersonId,key.familyId) as Record<string,unknown>[];
      for(const row of legacyInventory) inventory.push(Object.freeze({
        id:`inventory/legacy/plan/${String(row.status)}`,key,category:'legacy',resourceType:'digital_legacy_plan',resourceId:'*',
        displayName:`legacy_plan:${String(row.status)}`,recordCount:Number(row.record_count),storageScope:'local_encrypted',sensitivity:'highly_sensitive',
        derivedDataCount:Number(row.grant_count)+Number(row.approval_count)
      }));
      const ownerCollections = db.prepare(`
        SELECT 'account_profile' resource_type,COUNT(*) record_count FROM accounts WHERE id=? AND person_id=?
        UNION ALL SELECT 'person_profile',COUNT(*) FROM people WHERE id=? AND family_id=?
        UNION ALL SELECT 'location',COUNT(*) FROM locations WHERE family_id=? AND owner_person_id=?
        UNION ALL SELECT 'event',COUNT(*) FROM events WHERE family_id=? AND owner_person_id=?
        UNION ALL SELECT 'archive_item',COUNT(*) FROM archive_items item
          JOIN platform_policy_transaction_receipts receipt ON receipt.receipt_hash=item.policy_receipt_hash
          WHERE item.family_id=? AND item.destroyed_at IS NULL
            AND json_extract(receipt.record_json,'$.request.subject.accountId')=?
            AND json_extract(receipt.record_json,'$.request.subject.personId')=?
            AND json_extract(receipt.record_json,'$.request.resource.familyId')=?
            AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=?
        UNION ALL SELECT 'bank_account',COUNT(*) FROM bank_accounts WHERE family_id=? AND owner_person_id=?
        UNION ALL SELECT 'payment_card',COUNT(*) FROM payment_cards WHERE family_id=? AND owner_person_id=?
        UNION ALL SELECT 'loan_account',COUNT(*) FROM loan_accounts WHERE family_id=? AND owner_person_id=?
        UNION ALL SELECT 'finance_planning_item',COUNT(*) FROM finance_planning_ledger WHERE family_id=? AND owner_person_id=?
        UNION ALL SELECT 'finance_import_batch',COUNT(*) FROM finance_import_batches WHERE family_id=? AND owner_person_id=?
        UNION ALL SELECT 'finance_import_entry',COUNT(*) FROM finance_import_entries WHERE family_id=? AND owner_person_id=?
        UNION ALL SELECT 'managed_life_item',COUNT(*) FROM life_managed_ledger WHERE family_id=? AND owner_person_id=?
        UNION ALL SELECT 'home_inventory_item',COUNT(*) FROM life_home_inventory_ledger WHERE family_id=? AND owner_person_id=?
        UNION ALL SELECT 'long_term_portfolio',COUNT(*) FROM long_term_portfolios WHERE family_id=? AND owner_person_id=?
        UNION ALL SELECT 'form_draft',COUNT(*) FROM governed_form_drafts WHERE family_id=? AND account_id=? AND owner_person_id=?
        UNION ALL SELECT 'accessibility_preferences',COUNT(*) FROM accessibility_preferences WHERE family_id=? AND account_id=? AND owner_person_id=?`)
        .all(
          key.accountId,key.ownerPersonId,
          key.ownerPersonId,key.familyId,
          key.familyId,key.ownerPersonId,
          key.familyId,key.ownerPersonId,
          key.familyId,key.accountId,key.ownerPersonId,key.familyId,key.ownerPersonId,
          key.familyId,key.ownerPersonId,
          key.familyId,key.ownerPersonId,
          key.familyId,key.ownerPersonId,
          key.familyId,key.ownerPersonId,
          key.familyId,key.ownerPersonId,
          key.familyId,key.ownerPersonId,
          key.familyId,key.ownerPersonId,
          key.familyId,key.ownerPersonId,
          key.familyId,key.ownerPersonId,
          key.familyId,key.accountId,key.ownerPersonId,
          key.familyId,key.accountId,key.ownerPersonId
        ) as Record<string,unknown>[];
      for(const row of ownerCollections.filter((item)=>Number(item.record_count)>0)){const resourceType=String(row.resource_type);inventory.push(Object.freeze({
        id:`inventory/collection/${resourceType}`,key,category:inventoryCategory(resourceType),resourceType,resourceId:'*',
        displayName:`held_collection:${resourceType}`,recordCount:Number(row.record_count),storageScope:'local_encrypted',
        sensitivity:resourceType==='account_profile'||resourceType==='person_profile'||resourceType==='accessibility_preferences'?'personal':'highly_sensitive',
        derivedDataCount:0
      }));}
      if(inventory.length>MAX_INVENTORY)throw new Error('Privacy inventory category bound exceeded');
      const dataInventory:readonly DataInventoryItemView[]=Object.freeze(inventory);
      const observationRows=db.prepare(`SELECT * FROM privacy_access_observations WHERE family_id=? AND account_id=? AND owner_person_id=? ORDER BY observed_at DESC,id LIMIT ?`)
        .all(key.familyId, key.accountId, key.ownerPersonId, MAX_ACCESS) as Record<string, unknown>[];
      const observedReceiptHashes=new Set(observationRows.map(row=>String(row.policy_receipt_hash)));
      const observedAccess=observationRows.map((row): AccessHistoryEntryView => Object.freeze({
          id: String(row.id), key, actorAccountId: asUserId(String(row.observer_account_id)),
          ...(row.observer_person_id ? { actorPersonId: asPersonId(String(row.observer_person_id)) } : {}),
          actorDisplayName: String(row.observer_display_name), resourceType: String(row.resource_type), resourceId: String(row.resource_id),
          action: String(row.action) as AccessHistoryEntryView['action'], purpose: String(row.purpose),
          decision: String(row.decision) as AccessHistoryEntryView['decision'], decisionReason: String(row.decision_reason),
          occurredAt: asIsoDateTime(String(row.observed_at)), ...(row.device_id ? { deviceId: String(row.device_id) } : {}),
          correlationId: String(row.correlation_id), source: String(row.source) as AccessHistoryEntryView['source']
        }));
      const receiptRows=db.prepare(`SELECT receipt.receipt_hash,receipt.correlation_id,receipt.resource_type,receipt.resource_id,receipt.action,
          receipt.recorded_at,observer.id observer_account_id,observer.person_id observer_person_id,observer.display_name observer_display_name,
          json_extract(receipt.record_json,'$.request.purpose') purpose,
          json_extract(receipt.record_json,'$.request.subject.deviceId') device_id
        FROM platform_policy_transaction_receipts receipt
        JOIN accounts observer ON observer.id=json_extract(receipt.record_json,'$.request.subject.accountId')
        WHERE json_extract(receipt.record_json,'$.request.resource.familyId')=?
          AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=?
          AND json_extract(receipt.record_json,'$.decision.allowed')=1
        ORDER BY receipt.recorded_at DESC,receipt.receipt_hash LIMIT ?`).all(key.familyId,key.ownerPersonId,MAX_ACCESS) as Record<string,unknown>[];
      const receiptAccess=receiptRows.filter(row=>!observedReceiptHashes.has(String(row.receipt_hash))).map((row):AccessHistoryEntryView=>Object.freeze({
        id:`receipt/${String(row.receipt_hash)}`,key,actorAccountId:asUserId(String(row.observer_account_id)),
        ...(row.observer_person_id?{actorPersonId:asPersonId(String(row.observer_person_id))}:{}),actorDisplayName:String(row.observer_display_name),
        resourceType:String(row.resource_type),resourceId:String(row.resource_id),action:String(row.action) as AccessHistoryEntryView['action'],
        purpose:String(row.purpose),decision:'allowed',decisionReason:'policy_allowed',occurredAt:asIsoDateTime(String(row.recorded_at)),
        ...(row.device_id?{deviceId:String(row.device_id)}:{}),correlationId:String(row.correlation_id),source:'immutable_policy_receipt'}));
      const accessHistory=Object.freeze([...observedAccess,...receiptAccess].sort((left,right)=>Date.parse(right.occurredAt)-Date.parse(left.occurredAt)).slice(0,MAX_ACCESS));
      const localDeviceActivity = (db.prepare(`SELECT d.* FROM trusted_devices d JOIN accounts a ON a.id=d.account_id AND a.status='active'
        WHERE d.account_id=? ORDER BY d.last_seen_at DESC,d.id LIMIT 500`).all(key.accountId) as Record<string, unknown>[])
        .map((row): LocalDeviceActivityView => Object.freeze({
          id: String(row.id), key, deviceId: String(row.device_id), displayName: String(row.display_name),
          currentDevice: !row.revoked_at && String(row.device_id)===context.policyAuthorization.subject.deviceId,
          trustStatus: row.revoked_at ? 'revoked' : 'trusted',
          locallyObservedSession: !row.revoked_at && String(row.device_id)===context.policyAuthorization.subject.deviceId?'current_session':'recently_seen',
          lastSeenAt: asIsoDateTime(String(row.last_seen_at)), securityEpoch: Number(row.security_epoch),
          appleSyncStatus: 'not_configured', observationSource: 'local_runtime'
        }));
      const localProcessingObservations = (db.prepare(`SELECT * FROM privacy_processing_observations WHERE family_id=? AND account_id=? AND owner_person_id=? ORDER BY observed_at DESC,id LIMIT ?`)
        .all(key.familyId, key.accountId, key.ownerPersonId, MAX_PROCESSING) as Record<string, unknown>[])
        .map((row): LocalProcessingObservationView => Object.freeze({
          id: String(row.id), key, kind: String(row.processor_kind) as LocalProcessingObservationView['kind'],
          status: String(row.observation_status) as LocalProcessingObservationView['status'],
          resourceType: String(row.resource_type), resourceId: String(row.resource_id), purpose: String(row.purpose),
          processor: String(row.processor) as LocalProcessingObservationView['processor'], observedAt: asIsoDateTime(String(row.observed_at)),
          ...(row.completed_at ? { completedAt: asIsoDateTime(String(row.completed_at)) } : {}),
          observationSource: 'local_runtime', networkDeliveryObserved: false
        }));
      const derivedDataLineage = (db.prepare(`SELECT b.binding_hash,b.derived_kind,b.derived_resource_id,b.lineage_depth,b.retention_until,
           s.source_resource_type,s.source_resource_id,
           COALESCE(l.backup_propagation_pending,0) backup_pending,l.state lifecycle_state
        FROM derived_data_policy_bindings b
        JOIN derived_data_policy_sources s ON s.binding_hash=b.binding_hash
        JOIN platform_policy_transaction_receipts receipt ON receipt.receipt_hash=b.producer_receipt_hash
        LEFT JOIN data_lifecycle l ON l.resource_type=s.source_resource_type AND l.resource_id=s.source_resource_id
        WHERE b.family_id=? AND b.status='sealed'
          AND json_extract(receipt.record_json,'$.request.subject.accountId')=?
          AND json_extract(receipt.record_json,'$.request.subject.personId')=?
          AND json_extract(receipt.record_json,'$.request.resource.familyId')=?
          AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=?
        ORDER BY b.sealed_at DESC,b.binding_hash,s.source_ordinal LIMIT ?`)
        .all(key.familyId,key.accountId,key.ownerPersonId,key.familyId,key.ownerPersonId,MAX_LINEAGE) as Record<string, unknown>[]).map((row): DerivedDataLineageView => Object.freeze({
          id: `${String(row.binding_hash)}/${String(row.source_resource_type)}/${String(row.source_resource_id)}`, key,
          derivedKind: String(row.derived_kind) as DerivedDataLineageView['derivedKind'],
          sourceResourceType: String(row.source_resource_type), sourceResourceId: String(row.source_resource_id),
          derivedResourceId: String(row.derived_resource_id), depth: Number(row.lineage_depth),
          ...(row.retention_until ? { retentionUntil: asIsoDateTime(String(row.retention_until)) } : {}),
          deletionPropagation: Number(row.backup_pending) === 1 ? 'pending' : row.lifecycle_state === 'purged' ? 'locally_completed' : 'not_requested',
          payloadExposed: false
        }));
      const rightsRequests = (db.prepare(`SELECT * FROM privacy_rights_requests WHERE family_id=? AND account_id=? AND owner_person_id=? ORDER BY updated_at DESC,id LIMIT ?`)
        .all(key.familyId, key.accountId, key.ownerPersonId, MAX_RIGHTS) as Record<string, unknown>[]).map(mapRights);
      const encryptedExports=(db.prepare(`SELECT export.*,rights.request_kind FROM privacy_export_records export
        JOIN privacy_rights_requests rights ON rights.id=export.rights_request_id AND rights.family_id=export.family_id
          AND rights.account_id=export.account_id AND rights.owner_person_id=export.owner_person_id
        WHERE export.family_id=? AND export.account_id=? AND export.owner_person_id=? ORDER BY export.created_at DESC,export.id LIMIT 256`)
        .all(key.familyId,key.accountId,key.ownerPersonId) as Record<string,unknown>[]).map(mapEncryptedExport);
      const incidents = (db.prepare(`SELECT * FROM policy_incident_cases WHERE family_id=? AND account_id=? AND owner_person_id=? ORDER BY updated_at DESC,id LIMIT ?`)
        .all(key.familyId, key.accountId, key.ownerPersonId, MAX_INCIDENTS) as Record<string, unknown>[]).map(mapIncident);
      return Object.freeze({ key, aiMemoryRecords, dataInventory, accessHistory, localDeviceActivity,
        localProcessingObservations, derivedDataLineage, rightsRequests, encryptedExports, incidents, generatedAt: context.occurredAt });
    });
  }

  public findAiMemoryRecord(context: PolicyAuthorizedRepositoryExecutionContext, key: PrivacyOwnershipAggregateKey, recordId: string): RepositoryResult<AiMemoryRecordRow | null> {
    policyScope(context, key, 'ai_memory_record', recordId, ['read', 'create', 'update', 'delete']);
    return this.execute(context, () => { const row = this.database(context).prepare(`SELECT * FROM governed_ai_memory_records WHERE resource_id=? AND family_id=? AND account_id=? AND owner_person_id=?`)
      .get(recordId, key.familyId, key.accountId, key.ownerPersonId) as Record<string, unknown> | undefined; return row ? mapAiMemory(row) : null; });
  }

  public saveAiMemoryRecord(context: PolicyAuthorizedRepositoryExecutionContext, row: AiMemoryRecordRow, expectedRevision: number): RepositoryResult<boolean> {
    assertStateFingerprint(row);
    if (!rowKeyMatches(row, row.key) || row.revision !== expectedRevision + 1) throw new Error('AI memory key or revision mismatch');
    const action = expectedRevision === 0 ? 'create' : row.status === 'pending_deletion' || row.status === 'deleted' ? 'delete' : 'update';
    const policy = policyScope(context, row.key, 'ai_memory_record', row.id, [action]);
    return this.execute(context, () => {
      const binding = this.database(context).prepare(`SELECT binding.binding_hash FROM derived_data_policy_bindings binding
        JOIN platform_policy_transaction_receipts producer ON producer.receipt_hash=binding.producer_receipt_hash
        JOIN platform_policy_database_fences fence ON fence.fence_name=producer.fence_name AND fence.epoch=producer.fence_epoch AND fence.writable=1
        JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=producer.receipt_hash AND projection.record_json=producer.record_json
        WHERE binding.binding_hash=? AND binding.family_id=? AND binding.derived_kind='AI_MEMORY'
          AND binding.derived_resource_type='ai_memory' AND binding.derived_resource_id=? AND binding.status='sealed'
          AND EXISTS(SELECT 1 FROM derived_data_policy_sources source WHERE source.binding_hash=binding.binding_hash)
          AND json_extract(producer.record_json,'$.request.subject.accountId')=?
          AND json_extract(producer.record_json,'$.request.subject.personId')=?
          AND json_extract(producer.record_json,'$.request.resource.familyId')=?
          AND json_extract(producer.record_json,'$.request.resource.ownerPersonId')=?`)
        .get(row.derivedBindingHash, row.familyId, row.id, row.accountId, row.ownerPersonId, row.familyId, row.ownerPersonId) as { binding_hash?: unknown } | undefined;
      if (!binding) throw new Error('AI memory requires an active sealed derived-data binding');
      const values = [row.familyId,row.accountId,row.ownerPersonId,row.derivedBindingHash,row.title,row.statement,row.sourceResourceType,row.sourceResourceId,
        row.sourceOccurredAt??null,row.restriction.visibility,JSON.stringify(row.restriction.selectedAccountIds),JSON.stringify(row.restriction.allowedPurposes),
        row.restriction.processingAllowed?1:0,row.status,row.retentionUntil??null,row.expiredAt??null,row.deletionRequestedAt??null,row.deletedAt??null,
        row.revision,row.stateFingerprint,row.lastMutationId,row.createdAt,row.updatedAt,policy.receiptHash];
      if (expectedRevision === 0) {
        this.database(context).prepare(`INSERT INTO governed_ai_memory_records(resource_id,family_id,account_id,owner_person_id,derived_binding_hash,title,statement,
          source_resource_type,source_resource_id,source_occurred_at,restriction_visibility,selected_account_ids_json,allowed_purposes_json,processing_allowed,state,
          retention_until,expired_at,deletion_requested_at,deleted_at,revision,state_fingerprint,last_mutation_id,created_at,updated_at,policy_receipt_hash)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,...values);
        return true;
      }
      return Number(this.database(context).prepare(`UPDATE governed_ai_memory_records SET title=?,statement=?,source_resource_type=?,source_resource_id=?,source_occurred_at=?,
        restriction_visibility=?,selected_account_ids_json=?,allowed_purposes_json=?,processing_allowed=?,state=?,retention_until=?,expired_at=?,deletion_requested_at=?,deleted_at=?,
        revision=?,state_fingerprint=?,last_mutation_id=?,updated_at=?,policy_receipt_hash=? WHERE resource_id=? AND family_id=? AND account_id=? AND owner_person_id=? AND revision=?`)
        .run(row.title,row.statement,row.sourceResourceType,row.sourceResourceId,row.sourceOccurredAt??null,row.restriction.visibility,
          JSON.stringify(row.restriction.selectedAccountIds),JSON.stringify(row.restriction.allowedPurposes),row.restriction.processingAllowed?1:0,row.status,
          row.retentionUntil??null,row.expiredAt??null,row.deletionRequestedAt??null,row.deletedAt??null,row.revision,row.stateFingerprint,row.lastMutationId,row.updatedAt,
          policy.receiptHash,row.id,row.familyId,row.accountId,row.ownerPersonId,expectedRevision).changes) === 1;
    });
  }

  public findRightsRequest(context: PolicyAuthorizedRepositoryExecutionContext, key: PrivacyOwnershipAggregateKey, requestId: string): RepositoryResult<DataRightsRequestRow | null> {
    policyScope(context, key, 'data_rights_request', requestId, ['read', 'create', 'update']);
    return this.execute(context, () => { const row = this.database(context).prepare(`SELECT * FROM privacy_rights_requests WHERE id=? AND family_id=? AND account_id=? AND owner_person_id=?`)
      .get(requestId,key.familyId,key.accountId,key.ownerPersonId) as Record<string,unknown>|undefined; return row?mapRights(row):null; });
  }

  public insertRightsRequest(context: PolicyAuthorizedRepositoryExecutionContext, row: DataRightsRequestRow): RepositoryResult<void> {
    assertStateFingerprint(row); if (!rowKeyMatches(row,row.key) || row.revision!==1) throw new Error('Rights request initial state is invalid');
    const policy=policyScope(context,row.key,'data_rights_request',row.id,['create']);
    return this.execute(context,()=>{ this.database(context).prepare(`INSERT INTO privacy_rights_requests(id,family_id,account_id,owner_person_id,request_kind,
      scope_resource_type,scope_resource_id,requested_retention_until,status,reason,resolution_note,encrypted_export_required,external_copies_erasure_guaranteed,
      revision,state_fingerprint,last_mutation_id,policy_receipt_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?)`)
      .run(row.id,row.familyId,row.accountId,row.ownerPersonId,row.kind,row.scopeResourceType,row.scopeResourceId,row.requestedRetentionUntil??null,row.status,row.reason,
        row.resolutionNote??null,row.encryptedExportRequired?1:0,row.revision,row.stateFingerprint,row.lastMutationId,policy.receiptHash,row.createdAt,row.updatedAt);
      this.insertRightsEvent(context,row,policy.receiptHash); });
  }

  public saveRightsRequest(context: PolicyAuthorizedRepositoryExecutionContext,row:DataRightsRequestRow,expectedRevision:number):RepositoryResult<boolean>{
    assertStateFingerprint(row); if(!rowKeyMatches(row,row.key)||row.revision!==expectedRevision+1)throw new Error('Rights request key or revision mismatch');
    const policy=policyScope(context,row.key,'data_rights_request',row.id,['update']);
    return this.execute(context,()=>{const changed=Number(this.database(context).prepare(`UPDATE privacy_rights_requests SET requested_retention_until=?,status=?,resolution_note=?,
      encrypted_export_required=?,revision=?,state_fingerprint=?,last_mutation_id=?,policy_receipt_hash=?,updated_at=?
      WHERE id=? AND family_id=? AND account_id=? AND owner_person_id=? AND revision=?`).run(row.requestedRetentionUntil??null,row.status,row.resolutionNote??null,
      row.encryptedExportRequired?1:0,row.revision,row.stateFingerprint,row.lastMutationId,policy.receiptHash,row.updatedAt,row.id,row.familyId,row.accountId,row.ownerPersonId,expectedRevision).changes);
      if(changed===1)this.insertRightsEvent(context,row,policy.receiptHash);return changed===1;});
  }

  public findIncident(context:PolicyAuthorizedRepositoryExecutionContext,key:PrivacyOwnershipAggregateKey,incidentId:string):RepositoryResult<PrivacyIncidentRow|null>{
    policyScope(context,key,'privacy_incident',incidentId,['read','create','update']);
    return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT * FROM policy_incident_cases WHERE id=? AND family_id=? AND account_id=? AND owner_person_id=?`)
      .get(incidentId,key.familyId,key.accountId,key.ownerPersonId) as Record<string,unknown>|undefined;return row?mapIncident(row):null;});
  }

  public insertIncident(context:PolicyAuthorizedRepositoryExecutionContext,row:PrivacyIncidentRow):RepositoryResult<void>{
    assertStateFingerprint(row);if(!rowKeyMatches(row,row.key)||row.revision!==1)throw new Error('Incident initial state is invalid');
    const policy=policyScope(context,row.key,'privacy_incident',row.id,['create']);
    return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO policy_incident_cases(id,family_id,account_id,owner_person_id,title,status,severity,suspected_at,
      actions_json,evidence_reference_ids_json,resolution_note,revision,state_fingerprint,last_mutation_id,remote_wipe_performed,mdm_operation_performed,
      network_delivery_guaranteed,policy_receipt_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,0,?,?,?)`)
      .run(row.id,row.familyId,row.accountId,row.ownerPersonId,row.title,row.status,row.severity,row.suspectedAt,JSON.stringify(row.actions),
        JSON.stringify(row.evidenceReferenceIds),row.resolutionNote??null,row.revision,row.stateFingerprint,row.lastMutationId,policy.receiptHash,row.createdAt,row.updatedAt);
      this.insertIncidentEvent(context,row,policy.receiptHash);});
  }

  public saveIncident(context:PolicyAuthorizedRepositoryExecutionContext,row:PrivacyIncidentRow,expectedRevision:number):RepositoryResult<boolean>{
    assertStateFingerprint(row);if(!rowKeyMatches(row,row.key)||row.revision!==expectedRevision+1)throw new Error('Incident key or revision mismatch');
    const policy=policyScope(context,row.key,'privacy_incident',row.id,['update']);
    return this.execute(context,()=>{const changed=Number(this.database(context).prepare(`UPDATE policy_incident_cases SET status=?,resolution_note=?,revision=?,state_fingerprint=?,
      last_mutation_id=?,policy_receipt_hash=?,updated_at=? WHERE id=? AND family_id=? AND account_id=? AND owner_person_id=? AND revision=?`)
      .run(row.status,row.resolutionNote??null,row.revision,row.stateFingerprint,row.lastMutationId,policy.receiptHash,row.updatedAt,row.id,row.familyId,row.accountId,row.ownerPersonId,expectedRevision).changes);
      if(changed===1)this.insertIncidentEvent(context,row,policy.receiptHash);return changed===1;});
  }

  public recordIncidentRevocation(context:PolicyAuthorizedRepositoryExecutionContext,row:PrivacyIncidentRevocationWrite):RepositoryResult<void>{
    if(!SHA256.test(row.targetFingerprint))throw new Error('Incident revocation fingerprint is invalid');
    const policy=policyScope(context,row.key,'privacy_incident',row.incidentId,['create','update']);
    return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO policy_incident_revocations(id,incident_id,family_id,account_id,target_kind,
      target_fingerprint,outcome,policy_receipt_hash,revoked_at) VALUES(?,?,?,?,?,?,?,?,?)`).run(row.id,row.incidentId,row.key.familyId,row.key.accountId,
      row.targetKind,row.targetFingerprint,row.outcome,policy.receiptHash,row.revokedAt);});
  }

  public quarantineIncidentItem(context:PolicyAuthorizedRepositoryExecutionContext,row:PrivacyIncidentQuarantineWrite):RepositoryResult<void>{
    if(!SHA256.test(row.targetFingerprint)||!SHA256.test(row.integritySha256))throw new Error('Incident quarantine fingerprint is invalid');
    const policy=policyScope(context,row.key,'privacy_incident',row.incidentId,['create','update']);
    return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO policy_incident_quarantine_items(id,incident_id,family_id,account_id,target_kind,
      target_fingerprint,integrity_sha256,status,revision,policy_receipt_hash,quarantined_at,resolved_at) VALUES(?,?,?,?,?,?,?,'quarantined',1,?,?,NULL)`)
      .run(row.id,row.incidentId,row.key.familyId,row.key.accountId,row.targetKind,row.targetFingerprint,row.integritySha256,policy.receiptHash,row.quarantinedAt);});
  }

  public inspectLocalDerivedArtifactForIncident(context:PolicyAuthorizedRepositoryExecutionContext,key:PrivacyOwnershipAggregateKey,bindingHash:string):RepositoryResult<{readonly integritySha256:string}|null>{
    if(!SHA256.test(bindingHash))throw new Error('Incident derived binding hash is invalid');
    policyScope(context,key,'privacy_incident',context.policyAuthorization.resourceId,['create','update']);
    return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT binding.content_sha256 integrity_sha256
      FROM derived_data_policy_bindings binding
      JOIN platform_policy_transaction_receipts producer ON producer.receipt_hash=binding.producer_receipt_hash
      JOIN platform_policy_database_fences fence ON fence.fence_name=producer.fence_name AND fence.epoch=producer.fence_epoch AND fence.writable=1
      JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=producer.receipt_hash AND projection.record_json=producer.record_json
      WHERE binding.binding_hash=? AND binding.family_id=? AND binding.status='sealed'
        AND json_extract(producer.record_json,'$.request.subject.accountId')=?
        AND json_extract(producer.record_json,'$.request.subject.personId')=?
        AND json_extract(producer.record_json,'$.request.resource.familyId')=?
        AND json_extract(producer.record_json,'$.request.resource.ownerPersonId')=?`)
      .get(bindingHash,key.familyId,key.accountId,key.ownerPersonId,key.familyId,key.ownerPersonId) as {integrity_sha256?:unknown}|undefined;
      return row?Object.freeze({integritySha256:String(row.integrity_sha256)}):null;});
  }

  public recordEncryptedExport(context:PolicyAuthorizedRepositoryExecutionContext,row:EncryptedPrivacyExportRow):RepositoryResult<void>{
    const fingerprint=createHash('sha256').update(canonicalEncryptedPrivacyExportStateJson(row),'utf8').digest('hex');
    if(!SHA256.test(row.artifactSha256)||!SHA256.test(row.envelopeSha256)||!SHA256.test(row.lineageSha256)||fingerprint!==row.stateFingerprint)throw new Error('Encrypted export fingerprint is invalid');
    const policy=policyScope(context,row.key,'data_rights_request',row.requestId,['update']);
    return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO privacy_export_records(id,rights_request_id,family_id,account_id,owner_person_id,
      request_revision,artifact_sha256,envelope_sha256,lineage_snapshot_sha256,encryption_algorithm,item_count,plaintext_size_bytes,size_bytes,local_user_selected,
      delivery_guaranteed,recipient_read_guaranteed,state_fingerprint,policy_receipt_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?,'AES-256-GCM',?,?,?,1,0,0,?,?,?)`)
      .run(row.id,row.requestId,row.key.familyId,row.key.accountId,row.key.ownerPersonId,row.requestRevision,row.artifactSha256,row.envelopeSha256,row.lineageSha256,
        row.itemCount,row.plaintextSizeBytes,row.sizeBytes,row.stateFingerprint,policy.receiptHash,row.createdAt);});
  }

  public findMutationByClientOperationId(context:PolicyAuthorizedRepositoryExecutionContext,key:PrivacyOwnershipAggregateKey,clientOperationId:string):RepositoryResult<PrivacyOwnershipMutationRow|null>{
    assertKey(context,key);return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT * FROM governed_ai_memory_mutations
      WHERE family_id=? AND account_id=? AND owner_person_id=? AND client_operation_id=?`).get(key.familyId,key.accountId,key.ownerPersonId,clientOperationId) as Record<string,unknown>|undefined;
      return row?mapMutation(row):null;});
  }

  public insertMutation(context:PolicyAuthorizedRepositoryExecutionContext,row:PrivacyOwnershipMutationRow):RepositoryResult<void>{
    if(!SHA256.test(row.requestFingerprint)||!SHA256.test(row.stateFingerprint)||row.revision!==row.previousRevision+1)throw new Error('Mutation fingerprint or revision is invalid');
    const key=Object.freeze({familyId:row.familyId,accountId:row.accountId,ownerPersonId:row.ownerPersonId});
    const resourceType=row.resourceType;
    const action=row.previousRevision===0?'create':row.mutationKind==='ai_memory_delete'?'delete':'update';
    const policy=policyScope(context,key,resourceType,row.resourceId,[action]);
    return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO governed_ai_memory_mutations(id,client_operation_id,request_fingerprint,state_fingerprint,
      mutation_kind,resource_type,resource_id,family_id,account_id,owner_person_id,previous_revision,revision,policy_receipt_hash,policy_resource_type,
      policy_resource_id,policy_action,policy_capability,policy_purpose,policy_sensitivity,occurred_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(row.id,row.clientOperationId,row.requestFingerprint,row.stateFingerprint,row.mutationKind,row.resourceType,row.resourceId,row.familyId,row.accountId,
        row.ownerPersonId,row.previousRevision,row.revision,policy.receiptHash,resourceType,row.resourceId,action,policy.capability,policy.purpose,
        context.policyAuthorization.receiptRecord.request.resource.sensitivity,row.createdAt);});
  }

  private insertRightsEvent(context:PolicyAuthorizedRepositoryExecutionContext,row:DataRightsRequestRow,receiptHash:string):void{
    const eventFingerprint=createHash('sha256').update(stable({requestId:row.id,revision:row.revision,status:row.status,stateFingerprint:row.stateFingerprint})).digest('hex');
    this.database(context).prepare(`INSERT INTO privacy_rights_request_events(id,request_id,family_id,account_id,revision,state_fingerprint,event_type,event_fingerprint,
      policy_receipt_hash,occurred_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(`${row.lastMutationId}/event`,row.id,row.familyId,row.accountId,row.revision,row.stateFingerprint,
      row.status,eventFingerprint,receiptHash,row.updatedAt);
  }

  private insertIncidentEvent(context:PolicyAuthorizedRepositoryExecutionContext,row:PrivacyIncidentRow,receiptHash:string):void{
    const eventType=row.status==='open'?'opened':row.status;
    const evidenceSha256=createHash('sha256').update(stable(row.evidenceReferenceIds)).digest('hex');
    const eventFingerprint=createHash('sha256').update(stable({incidentId:row.id,revision:row.revision,eventType,stateFingerprint:row.stateFingerprint,evidenceSha256})).digest('hex');
    this.database(context).prepare(`INSERT INTO policy_incident_events(id,incident_id,family_id,account_id,revision,state_fingerprint,event_type,event_fingerprint,
      evidence_sha256,policy_receipt_hash,occurred_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(`${row.lastMutationId}/event`,row.id,row.familyId,row.accountId,row.revision,
      row.stateFingerprint,eventType,eventFingerprint,evidenceSha256,receiptHash,row.updatedAt);
  }
}
