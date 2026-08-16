import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  SmartHomeCameraConsentStatus,
  SmartHomeDeviceKind,
  SmartHomeDeviceStatus,
  SmartHomeMutationKind,
  SmartHomeObservationKind,
  SmartHomeObservationUnit
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult,
  type SmartHomeCameraConsentRow,
  type SmartHomeDeviceRow,
  type SmartHomeEnergyCenterKey,
  type SmartHomeEnergyCenterSnapshotRow,
  type SmartHomeEnergyPolicyResourceRepositoryPort,
  type SmartHomeEnergyRepositoryPort,
  type SmartHomeMutationRow,
  type SmartHomeObservationRow,
  type SmartHomeSettingsRow,
  type SmartHomeStorageUsageRow
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const deviceSelect = `SELECT id,family_id,owner_person_id,adapter_id,provider_id,kind,label,room,status,
  local_identifier_sha256,adapter_manifest_sha256,adapter_signer_key_id,signed_adapter_evidence_persisted,
  revision,state_fingerprint,last_mutation_id,created_at,updated_at FROM smart_home_devices`;
const observationSelect = `SELECT id,family_id,owner_person_id,device_id,kind,unit,numeric_value,boolean_value,
  observed_at,recorded_at,source_manifest_sha256,state_fingerprint,last_mutation_id FROM smart_home_observations`;
const consentSelect = `SELECT id,family_id,owner_person_id,device_id,purpose,status,granted_by_account_id,
  granted_by_person_id,visible_indicator_required,expires_at,revision,state_fingerprint,last_mutation_id,
  created_at,updated_at,revoked_at FROM smart_home_camera_consents`;
const settingsSelect = `SELECT id,family_id,owner_person_id,processing_enabled,camera_access_default_denied,
  hidden_surveillance_prohibited,revision,state_fingerprint,last_mutation_id,created_at,updated_at FROM smart_home_settings`;
const mutationSelect = `SELECT id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,
  actor_person_id,mutation_kind,client_operation_id,request_fingerprint,expected_revision,revision,
  resource_state_fingerprint,occurred_at FROM smart_home_mutations`;

const mapDevice = (row: Record<string, unknown>): SmartHomeDeviceRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  adapterId: String(row.adapter_id), providerId: String(row.provider_id), kind: String(row.kind) as SmartHomeDeviceKind,
  label: String(row.label), ...(row.room ? { room: String(row.room) } : {}), status: String(row.status) as SmartHomeDeviceStatus,
  localIdentifierSha256: String(row.local_identifier_sha256), adapterManifestSha256: String(row.adapter_manifest_sha256),
  adapterSignerKeyId: String(row.adapter_signer_key_id), signedAdapterEvidencePersisted: true,
  revision: Number(row.revision), stateFingerprint: String(row.state_fingerprint), lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapObservation = (row: Record<string, unknown>): SmartHomeObservationRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  deviceId: String(row.device_id), kind: String(row.kind) as SmartHomeObservationKind,
  unit: String(row.unit) as SmartHomeObservationUnit,
  ...(row.numeric_value === null || row.numeric_value === undefined ? {} : { numericValue: Number(row.numeric_value) }),
  ...(row.boolean_value === null || row.boolean_value === undefined ? {} : { booleanValue: Number(row.boolean_value) === 1 }),
  observedAt: asIsoDateTime(String(row.observed_at)), recordedAt: asIsoDateTime(String(row.recorded_at)),
  sourceManifestSha256: String(row.source_manifest_sha256), stateFingerprint: String(row.state_fingerprint),
  lastMutationId: String(row.last_mutation_id)
});
const mapConsent = (row: Record<string, unknown>): SmartHomeCameraConsentRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  deviceId: String(row.device_id), purpose: String(row.purpose) as SmartHomeCameraConsentRow['purpose'],
  status: String(row.status) as SmartHomeCameraConsentStatus, grantedByAccountId: String(row.granted_by_account_id),
  grantedByPersonId: String(row.granted_by_person_id), visibleIndicatorRequired: true,
  expiresAt: asIsoDateTime(String(row.expires_at)), revision: Number(row.revision),
  stateFingerprint: String(row.state_fingerprint), lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at)),
  ...(row.revoked_at ? { revokedAt: asIsoDateTime(String(row.revoked_at)) } : {})
});
const mapSettings = (row: Record<string, unknown>): SmartHomeSettingsRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  processingEnabled: Number(row.processing_enabled) === 1, cameraAccessDefaultDenied: true,
  hiddenSurveillanceProhibited: true, revision: Number(row.revision), stateFingerprint: String(row.state_fingerprint),
  lastMutationId: String(row.last_mutation_id), createdAt: asIsoDateTime(String(row.created_at)),
  updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapMutation = (row: Record<string, unknown>): SmartHomeMutationRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  resourceType: String(row.resource_type) as SmartHomeMutationRow['resourceType'], resourceId: String(row.resource_id),
  actorAccountId: String(row.actor_account_id), actorPersonId: asPersonId(String(row.actor_person_id)),
  mutationKind: String(row.mutation_kind) as SmartHomeMutationKind, clientOperationId: String(row.client_operation_id),
  requestFingerprint: String(row.request_fingerprint), expectedRevision: Number(row.expected_revision), revision: Number(row.revision),
  resourceStateFingerprint: String(row.resource_state_fingerprint), occurredAt: asIsoDateTime(String(row.occurred_at))
});

const assertKey = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  key: SmartHomeEnergyCenterKey,
  mode: 'read' | 'write'
): void => {
  assertPolicyAuthorizedRepositoryContext(context, { resourceType: mode === 'read' ? 'smart_home_energy_center' : context.policyAuthorization.resourceType,
    resourceId: mode === 'read' ? '*' : context.policyAuthorization.resourceId, action: context.policyAuthorization.action,
    capability: mode === 'read' ? 'family.read' : 'family.write', correlationId: context.correlationId,
    resourceFamilyId: key.familyId });
  const authorization = context.policyAuthorization;
  if (authorization.purpose !== 'general' || authorization.subject.accountId !== key.accountId ||
    authorization.subject.personId !== key.actorPersonId || !authorization.subject.familyIds.includes(key.familyId) ||
    authorization.resourceFamilyId !== key.familyId || authorization.receiptRecord.request.resource.ownerPersonId !== key.ownerPersonId ||
    authorization.receiptRecord.request.resource.sensitivity !== 'highly_sensitive' ||
    key.centerId !== `smart-home-energy:${key.familyId}:${key.ownerPersonId}` ||
    (mode === 'read' && (authorization.action !== 'read' || key.actorPersonId !== key.ownerPersonId)) ||
    (mode === 'write' && !['create', 'update', 'delete'].includes(authorization.action)) ||
    (mode === 'write' && authorization.action === 'create' && key.actorPersonId !== key.ownerPersonId))
    throw new Error('Smart home key does not match the exact owner policy receipt');
};

const expectedAction = (kind: SmartHomeMutationKind): 'create' | 'update' | 'delete' => {
  if (['device_register', 'observation_record', 'camera_consent_grant'].includes(kind)) return 'create';
  if (kind === 'camera_consent_revoke') return 'delete';
  return 'update';
};
const writeBinding = (context: PolicyAuthorizedRepositoryExecutionContext, row: SmartHomeMutationRow) => {
  const binding = platformPolicyPersistenceBinding(context, row.resourceType, row.resourceId);
  const action = row.resourceType === 'smart_home_settings' && row.expectedRevision === 0 ? 'create' : expectedAction(row.mutationKind);
  if (!binding || binding.resourceFamilyId !== row.familyId || binding.purpose !== 'general' || binding.capability !== 'family.write' ||
    binding.occurredAt !== row.occurredAt || binding.action !== action) throw new Error('Smart home mutation requires an exact durable policy receipt');
  return binding;
};

export class SqliteSmartHomeEnergyRepository extends SqliteRepository implements
  SmartHomeEnergyRepositoryPort, SmartHomeEnergyPolicyResourceRepositoryPort {
  private storageUsage(context: PolicyAuthorizedRepositoryExecutionContext, key: SmartHomeEnergyCenterKey): SmartHomeStorageUsageRow {
    const database = this.database(context);
    const row = database.prepare(`SELECT
      (SELECT COUNT(*) FROM smart_home_devices WHERE family_id=? AND owner_person_id=?) device_count,
      (SELECT COUNT(*) FROM smart_home_observations WHERE family_id=? AND owner_person_id=?) observation_count,
      (SELECT COUNT(*) FROM smart_home_camera_consents WHERE family_id=? AND owner_person_id=?) camera_consent_count,
      (SELECT COUNT(*) FROM smart_home_mutations WHERE family_id=? AND owner_person_id=?) mutation_count`).get(
        key.familyId, key.ownerPersonId, key.familyId, key.ownerPersonId, key.familyId, key.ownerPersonId,
        key.familyId, key.ownerPersonId
      ) as Record<string, unknown>;
    return Object.freeze({ deviceCount: Number(row.device_count), observationCount: Number(row.observation_count),
      cameraConsentCount: Number(row.camera_consent_count), mutationCount: Number(row.mutation_count) });
  }
  public resolvePolicyResource(context: RepositoryExecutionContext, resourceType: SmartHomeMutationRow['resourceType'], resourceId: string)
  : ReturnType<SmartHomeEnergyPolicyResourceRepositoryPort['resolvePolicyResource']> {
    return this.execute(context, () => {
      const source = resourceType === 'smart_home_device'
        ? `SELECT id,family_id,owner_person_id,revision,status,state_fingerprint FROM smart_home_devices WHERE id=?`
        : resourceType === 'smart_home_observation'
          ? `SELECT id,family_id,owner_person_id,1 revision,'recorded' status,state_fingerprint FROM smart_home_observations WHERE id=?`
          : resourceType === 'smart_home_camera_consent'
            ? `SELECT id,family_id,owner_person_id,revision,status,state_fingerprint FROM smart_home_camera_consents WHERE id=?`
            : `SELECT id,family_id,owner_person_id,revision,CASE processing_enabled WHEN 1 THEN 'enabled' ELSE 'disabled' END status,
                state_fingerprint FROM smart_home_settings WHERE id=?`;
      const row = this.database(context).prepare(source).get(resourceId) as Record<string, unknown> | undefined;
      return row ? Object.freeze({ id: String(row.id), familyId: asFamilyId(String(row.family_id)),
        ownerPersonId: asPersonId(String(row.owner_person_id)), revision: Number(row.revision), status: String(row.status),
        stateFingerprint: String(row.state_fingerprint) }) : null;
    });
  }
  public loadCenter(context: PolicyAuthorizedRepositoryExecutionContext, key: SmartHomeEnergyCenterKey)
  : RepositoryResult<SmartHomeEnergyCenterSnapshotRow> {
    assertKey(context, key, 'read'); return this.execute(context, () => {
      const database = this.database(context);
      const devices = database.prepare(`${deviceSelect} WHERE family_id=? AND owner_person_id=? ORDER BY updated_at DESC,id LIMIT 500`)
        .all(key.familyId, key.ownerPersonId) as Record<string, unknown>[];
      const observations = database.prepare(`${observationSelect} WHERE family_id=? AND owner_person_id=? ORDER BY observed_at DESC,id LIMIT 500`)
        .all(key.familyId, key.ownerPersonId) as Record<string, unknown>[];
      const consents = database.prepare(`${consentSelect} WHERE family_id=? AND owner_person_id=? ORDER BY updated_at DESC,id LIMIT 500`)
        .all(key.familyId, key.ownerPersonId) as Record<string, unknown>[];
      const settings = database.prepare(`${settingsSelect} WHERE family_id=? AND owner_person_id=?`)
        .get(key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined;
      const usage = this.storageUsage(context, key);
      return Object.freeze({ devices: Object.freeze(devices.map(mapDevice)), observations: Object.freeze(observations.map(mapObservation)),
        observationTotal: usage.observationCount, cameraConsents: Object.freeze(consents.map(mapConsent)),
        cameraConsentTotal: usage.cameraConsentCount, storageUsage: usage, settings: settings ? mapSettings(settings) : null });
    });
  }
  public findDevice(context: PolicyAuthorizedRepositoryExecutionContext, key: SmartHomeEnergyCenterKey, deviceId: string)
  : RepositoryResult<SmartHomeDeviceRow | null> {
    assertKey(context, key, 'write'); return this.execute(context, () => {
      const row = this.database(context).prepare(`${deviceSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(deviceId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined; return row ? mapDevice(row) : null;
    });
  }
  public findConsent(context: PolicyAuthorizedRepositoryExecutionContext, key: SmartHomeEnergyCenterKey, consentId: string)
  : RepositoryResult<SmartHomeCameraConsentRow | null> {
    assertKey(context, key, 'write'); return this.execute(context, () => {
      const row = this.database(context).prepare(`${consentSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(consentId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined; return row ? mapConsent(row) : null;
    });
  }
  public findSettings(context: PolicyAuthorizedRepositoryExecutionContext, key: SmartHomeEnergyCenterKey)
  : RepositoryResult<SmartHomeSettingsRow | null> {
    assertKey(context, key, 'write'); return this.execute(context, () => {
      const row = this.database(context).prepare(`${settingsSelect} WHERE family_id=? AND owner_person_id=?`)
        .get(key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined; return row ? mapSettings(row) : null;
    });
  }
  public getStorageUsage(context: PolicyAuthorizedRepositoryExecutionContext, key: SmartHomeEnergyCenterKey)
  : RepositoryResult<SmartHomeStorageUsageRow> {
    assertKey(context, key, 'write'); return this.execute(context, () => this.storageUsage(context, key));
  }
  public findMutationByClientOperationId(context: PolicyAuthorizedRepositoryExecutionContext, key: SmartHomeEnergyCenterKey, clientOperationId: string)
  : RepositoryResult<SmartHomeMutationRow | null> {
    assertKey(context, key, 'write'); return this.execute(context, () => {
      const row = this.database(context).prepare(`${mutationSelect} WHERE family_id=? AND owner_person_id=? AND actor_account_id=? AND client_operation_id=?`)
        .get(key.familyId, key.ownerPersonId, key.accountId, clientOperationId) as Record<string, unknown> | undefined;
      return row ? mapMutation(row) : null;
    });
  }
  public insertMutation(context: PolicyAuthorizedRepositoryExecutionContext, row: SmartHomeMutationRow): RepositoryResult<void> {
    const binding = writeBinding(context, row);
    if (row.actorAccountId !== context.policyAuthorization.subject.accountId || row.actorPersonId !== context.policyAuthorization.subject.personId ||
      row.ownerPersonId !== context.policyAuthorization.receiptRecord.request.resource.ownerPersonId || row.revision !== row.expectedRevision + 1)
      throw new Error('Smart home mutation identity or revision is invalid');
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO smart_home_mutations(
      id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,actor_person_id,mutation_kind,client_operation_id,
      request_fingerprint,expected_revision,revision,resource_state_fingerprint,occurred_at,policy_receipt_hash,
      policy_receipt_version,policy_receipt_nonce,policy_correlation_id,policy_resource_type,policy_resource_id,policy_action,
      policy_capability) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id, row.familyId, row.ownerPersonId,
        row.resourceType, row.resourceId, row.actorAccountId, row.actorPersonId, row.mutationKind, row.clientOperationId,
        row.requestFingerprint, row.expectedRevision, row.revision, row.resourceStateFingerprint, row.occurredAt,
        binding.receiptHash, binding.receiptVersion, binding.nonce, context.correlationId, binding.resourceType,
        binding.resourceId, binding.action, binding.capability); });
  }
  public insertDevice(context: PolicyAuthorizedRepositoryExecutionContext, row: SmartHomeDeviceRow): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType: 'smart_home_device', resourceId: row.id, action: 'create',
      capability: 'family.write', correlationId: context.correlationId, resourceFamilyId: row.familyId });
    const binding = platformPolicyPersistenceBinding(context, 'smart_home_device', row.id); if (!binding) throw new Error('Smart home device receipt missing');
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO smart_home_devices(id,family_id,owner_person_id,
      adapter_id,provider_id,kind,label,room,status,local_identifier_sha256,adapter_manifest_sha256,adapter_signer_key_id,
      signed_adapter_evidence_persisted,revision,state_fingerprint,last_mutation_id,created_at,updated_at,policy_receipt_hash)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.adapterId,row.providerId,row.kind,
        row.label,row.room??null,row.status,row.localIdentifierSha256,row.adapterManifestSha256,row.adapterSignerKeyId,1,row.revision,
        row.stateFingerprint,row.lastMutationId,row.createdAt,row.updatedAt,binding.receiptHash); });
  }
  public saveDevice(context: PolicyAuthorizedRepositoryExecutionContext, row: SmartHomeDeviceRow, expectedRevision: number): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType: 'smart_home_device', resourceId: row.id, action: 'update',
      capability: 'family.write', correlationId: context.correlationId, resourceFamilyId: row.familyId });
    const binding = platformPolicyPersistenceBinding(context, 'smart_home_device', row.id); if (!binding) throw new Error('Smart home device receipt missing');
    return this.execute(context, () => { const result = this.database(context).prepare(`UPDATE smart_home_devices SET status=?,revision=?,
      state_fingerprint=?,last_mutation_id=?,updated_at=?,policy_receipt_hash=? WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`)
      .run(row.status,row.revision,row.stateFingerprint,row.lastMutationId,row.updatedAt,binding.receiptHash,row.id,row.familyId,row.ownerPersonId,expectedRevision);
      if (Number(result.changes)!==1) throw new Error('Smart home device optimistic revision conflict'); });
  }
  public insertObservation(context: PolicyAuthorizedRepositoryExecutionContext, row: SmartHomeObservationRow): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType: 'smart_home_observation', resourceId: row.id, action: 'create',
      capability: 'family.write', correlationId: context.correlationId, resourceFamilyId: row.familyId });
    const binding = platformPolicyPersistenceBinding(context, 'smart_home_observation', row.id); if (!binding) throw new Error('Smart home observation receipt missing');
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO smart_home_observations(id,family_id,owner_person_id,
      device_id,kind,unit,numeric_value,boolean_value,observed_at,recorded_at,source_manifest_sha256,state_fingerprint,last_mutation_id,
      policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.deviceId,row.kind,row.unit,
        row.numericValue??null,row.booleanValue===undefined?null:row.booleanValue?1:0,row.observedAt,row.recordedAt,row.sourceManifestSha256,
        row.stateFingerprint,row.lastMutationId,binding.receiptHash); });
  }
  public insertConsent(context: PolicyAuthorizedRepositoryExecutionContext, row: SmartHomeCameraConsentRow): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType: 'smart_home_camera_consent', resourceId: row.id, action: 'create',
      capability: 'family.write', correlationId: context.correlationId, resourceFamilyId: row.familyId });
    return this.execute(context, () => this.writeConsent(context,row,null));
  }
  public saveConsent(context: PolicyAuthorizedRepositoryExecutionContext, row: SmartHomeCameraConsentRow, expectedRevision: number): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType: 'smart_home_camera_consent', resourceId: row.id, action: 'delete',
      capability: 'family.write', correlationId: context.correlationId, resourceFamilyId: row.familyId });
    return this.execute(context, () => this.writeConsent(context,row,expectedRevision));
  }
  private writeConsent(context: PolicyAuthorizedRepositoryExecutionContext, row: SmartHomeCameraConsentRow, expectedRevision: number|null): void {
    const binding=platformPolicyPersistenceBinding(context,'smart_home_camera_consent',row.id);if(!binding)throw new Error('Smart home consent receipt missing');
    if(expectedRevision===null){this.database(context).prepare(`INSERT INTO smart_home_camera_consents(id,family_id,owner_person_id,
      device_id,purpose,status,granted_by_account_id,granted_by_person_id,visible_indicator_required,expires_at,revision,state_fingerprint,
      last_mutation_id,created_at,updated_at,revoked_at,policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,
        row.ownerPersonId,row.deviceId,row.purpose,row.status,row.grantedByAccountId,row.grantedByPersonId,1,row.expiresAt,row.revision,
        row.stateFingerprint,row.lastMutationId,row.createdAt,row.updatedAt,row.revokedAt??null,binding.receiptHash);return;}
    const result=this.database(context).prepare(`UPDATE smart_home_camera_consents SET status=?,revision=?,state_fingerprint=?,last_mutation_id=?,
      updated_at=?,revoked_at=?,policy_receipt_hash=? WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`).run(row.status,row.revision,
        row.stateFingerprint,row.lastMutationId,row.updatedAt,row.revokedAt??null,binding.receiptHash,row.id,row.familyId,row.ownerPersonId,expectedRevision);
    if(Number(result.changes)!==1)throw new Error('Smart home consent optimistic revision conflict');
  }
  public insertSettings(context: PolicyAuthorizedRepositoryExecutionContext, row: SmartHomeSettingsRow): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType: 'smart_home_settings', resourceId: row.id, action: 'create',
      capability: 'family.write', correlationId: context.correlationId, resourceFamilyId: row.familyId });
    return this.execute(context,()=>this.writeSettings(context,row,null));
  }
  public saveSettings(context: PolicyAuthorizedRepositoryExecutionContext, row: SmartHomeSettingsRow, expectedRevision: number): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType: 'smart_home_settings', resourceId: row.id, action: 'update',
      capability: 'family.write', correlationId: context.correlationId, resourceFamilyId: row.familyId });
    return this.execute(context,()=>this.writeSettings(context,row,expectedRevision));
  }
  private writeSettings(context: PolicyAuthorizedRepositoryExecutionContext,row:SmartHomeSettingsRow,expectedRevision:number|null):void{
    const binding=platformPolicyPersistenceBinding(context,'smart_home_settings',row.id);if(!binding)throw new Error('Smart home settings receipt missing');
    if(expectedRevision===null){this.database(context).prepare(`INSERT INTO smart_home_settings(id,family_id,owner_person_id,processing_enabled,
      camera_access_default_denied,hidden_surveillance_prohibited,revision,state_fingerprint,last_mutation_id,created_at,updated_at,
      policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.processingEnabled?1:0,1,1,row.revision,
        row.stateFingerprint,row.lastMutationId,row.createdAt,row.updatedAt,binding.receiptHash);return;}
    const result=this.database(context).prepare(`UPDATE smart_home_settings SET processing_enabled=?,revision=?,state_fingerprint=?,last_mutation_id=?,
      updated_at=?,policy_receipt_hash=? WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`).run(row.processingEnabled?1:0,
        row.revision,row.stateFingerprint,row.lastMutationId,row.updatedAt,binding.receiptHash,row.id,row.familyId,row.ownerPersonId,expectedRevision);
    if(Number(result.changes)!==1)throw new Error('Smart home settings optimistic revision conflict');
  }
}
