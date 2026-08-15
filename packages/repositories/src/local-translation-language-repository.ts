import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  LocalTranslationDictionaryCategory,
  LocalTranslationMutationKind,
  LocalTranslationProviderMode,
  LocalTranslationQualityFlag,
  LocalTranslationRequestState,
  LocalTranslationResourceType,
  LocalTranslationSourceKind
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type LocalTranslationCenterKey,
  type LocalTranslationCenterSnapshotRow,
  type LocalTranslationDictionaryEntryRow,
  type LocalTranslationEventRow,
  type LocalTranslationLanguageRepositoryPort,
  type LocalTranslationMutationRow,
  type LocalTranslationPolicyResourceRepositoryPort,
  type LocalTranslationProfileRow,
  type LocalTranslationRequestRow,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const profileSelect = `SELECT id,family_id,owner_person_id,preferred_language,secondary_languages_json,
  local_first_required,live_caption_translation_enabled,translated_speech_enabled,preserve_original_audio,
  external_provider_allowed,encrypted_sync_requested,encrypted_sync_executed,revision,state_fingerprint,
  last_mutation_id,created_at,updated_at FROM local_translation_profiles`;
const dictionarySelect = `SELECT id,family_id,owner_person_id,profile_id,category,source_language,target_language,
  source_term,preferred_term,explicit_permission_recorded,state,revision,last_mutation_id,created_at,updated_at
  FROM local_translation_dictionary_entries`;
const requestSelect = `SELECT id,family_id,owner_person_id,source_kind,source_resource_id,target_language,provider_mode,state,
  original_preservation_required,separate_translation_view_required,machine_translation_label_required,quality_flag,
  external_preview_acknowledged,explicit_external_consent,correction_sha256,correction_character_count,
  language_detection_executed,translation_executed,speech_to_text_executed,speaker_separation_executed,
  live_caption_translation_executed,text_to_speech_executed,network_used,cloud_used,revision,state_fingerprint,
  last_mutation_id,created_at,updated_at FROM local_translation_requests`;
const mutationSelect = `SELECT id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,actor_person_id,
  mutation_kind,client_operation_id,request_fingerprint,expected_revision,revision,resource_state_fingerprint,occurred_at
  FROM local_translation_mutations`;

const parseLanguages = (value: unknown): readonly string[] => {
  const parsed = JSON.parse(String(value)) as unknown;
  if (!Array.isArray(parsed) || parsed.length > 8 || parsed.some((item) => typeof item !== 'string'))
    throw new Error('Local translation secondary languages are invalid');
  return Object.freeze([...parsed]);
};
const mapProfile = (row: Record<string, unknown>): LocalTranslationProfileRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  preferredLanguage: String(row.preferred_language), secondaryLanguages: parseLanguages(row.secondary_languages_json),
  localFirstRequired: true, liveCaptionTranslationEnabled: Number(row.live_caption_translation_enabled) === 1,
  translatedSpeechEnabled: Number(row.translated_speech_enabled) === 1, preserveOriginalAudio: true,
  externalProviderAllowed: Number(row.external_provider_allowed) === 1,
  encryptedSyncRequested: Number(row.encrypted_sync_requested) === 1, encryptedSyncExecuted: false,
  revision: Number(row.revision), stateFingerprint: String(row.state_fingerprint), lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapDictionary = (row: Record<string, unknown>): LocalTranslationDictionaryEntryRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  profileId: String(row.profile_id), category: String(row.category) as LocalTranslationDictionaryCategory,
  sourceLanguage: String(row.source_language), targetLanguage: String(row.target_language), sourceTerm: String(row.source_term),
  preferredTerm: String(row.preferred_term), explicitPermissionRecorded: true,
  state: String(row.state) as 'active' | 'deleted', revision: Number(row.revision), lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapRequest = (row: Record<string, unknown>): LocalTranslationRequestRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  sourceKind: String(row.source_kind) as LocalTranslationSourceKind, sourceResourceId: String(row.source_resource_id),
  targetLanguage: String(row.target_language), providerMode: String(row.provider_mode) as LocalTranslationProviderMode,
  state: String(row.state) as LocalTranslationRequestState, originalPreservationRequired: true,
  separateTranslationViewRequired: true, machineTranslationLabelRequired: true,
  qualityFlag: String(row.quality_flag) as LocalTranslationQualityFlag,
  externalPreviewAcknowledged: Number(row.external_preview_acknowledged) === 1,
  explicitExternalConsent: Number(row.explicit_external_consent) === 1,
  ...(row.correction_sha256 ? { correctionSha256: String(row.correction_sha256),
    correctionCharacterCount: Number(row.correction_character_count) } : {}),
  languageDetectionExecuted: false, translationExecuted: false, speechToTextExecuted: false,
  speakerSeparationExecuted: false, liveCaptionTranslationExecuted: false, textToSpeechExecuted: false,
  networkUsed: false, cloudUsed: false, revision: Number(row.revision), stateFingerprint: String(row.state_fingerprint),
  lastMutationId: String(row.last_mutation_id), createdAt: asIsoDateTime(String(row.created_at)),
  updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapMutation = (row: Record<string, unknown>): LocalTranslationMutationRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  resourceType: String(row.resource_type) as LocalTranslationResourceType, resourceId: String(row.resource_id),
  actorAccountId: String(row.actor_account_id), actorPersonId: asPersonId(String(row.actor_person_id)),
  mutationKind: String(row.mutation_kind) as LocalTranslationMutationKind,
  clientOperationId: String(row.client_operation_id), requestFingerprint: String(row.request_fingerprint),
  expectedRevision: Number(row.expected_revision), revision: Number(row.revision),
  resourceStateFingerprint: String(row.resource_state_fingerprint), occurredAt: asIsoDateTime(String(row.occurred_at))
});

const expectedAction = (row: LocalTranslationMutationRow): 'create' | 'update' => row.expectedRevision === 0 ? 'create' : 'update';
const assertKey = (context: PolicyAuthorizedRepositoryExecutionContext, key: LocalTranslationCenterKey, mode: 'read' | 'write'): void => {
  const expectedResourceType = mode === 'read' ? 'local_translation_center' : context.policyAuthorization.resourceType;
  if (mode === 'write' && !['local_translation_profile','local_translation_request'].includes(expectedResourceType))
    throw new Error('Local translation write resource type is unsupported');
  assertPolicyAuthorizedRepositoryContext(context, { resourceType: expectedResourceType, resourceId: mode === 'read' ? '*' : context.policyAuthorization.resourceId,
    action: context.policyAuthorization.action, capability: mode === 'read' ? 'family.read' : 'family.write',
    correlationId: context.correlationId, resourceFamilyId: key.familyId });
  const authorization = context.policyAuthorization;
  if (authorization.purpose !== 'general' || authorization.subject.accountId !== key.accountId
    || authorization.subject.personId !== key.actorPersonId || !authorization.subject.familyIds.includes(key.familyId)
    || authorization.resourceFamilyId !== key.familyId
    || authorization.receiptRecord.request.resource.ownerPersonId !== key.ownerPersonId
    || authorization.receiptRecord.request.resource.sensitivity !== 'highly_sensitive'
    || key.centerId !== `local-translation:${key.familyId}:${key.ownerPersonId}`
    || key.profileId !== `local-translation-profile:${key.familyId}:${key.ownerPersonId}`
    || (mode === 'read' && (authorization.action !== 'read' || key.actorPersonId !== key.ownerPersonId))
    || (mode === 'write' && !['create','update'].includes(authorization.action)))
    throw new Error('Local translation key does not match the exact policy receipt');
};
const assertAccess = (context: PolicyAuthorizedRepositoryExecutionContext, key: LocalTranslationCenterKey): void =>
  assertKey(context, key, context.policyAuthorization.resourceType === 'local_translation_center' ? 'read' : 'write');
const writeBinding = (context: PolicyAuthorizedRepositoryExecutionContext, row: LocalTranslationMutationRow) => {
  const binding = platformPolicyPersistenceBinding(context, row.resourceType, row.resourceId);
  if (!binding || binding.resourceFamilyId !== row.familyId || binding.purpose !== 'general'
    || binding.capability !== 'family.write' || binding.occurredAt !== row.occurredAt || binding.action !== expectedAction(row))
    throw new Error('Local translation mutation requires an exact durable policy receipt');
  return binding;
};
const currentBinding = (context: PolicyAuthorizedRepositoryExecutionContext, resourceType: LocalTranslationResourceType,
  resourceId: string, familyId: string) => {
  assertPolicyAuthorizedRepositoryContext(context, { resourceType, resourceId, action: context.policyAuthorization.action,
    capability: 'family.write', correlationId: context.correlationId, resourceFamilyId: asFamilyId(familyId) });
  const binding = platformPolicyPersistenceBinding(context, resourceType, resourceId);
  if (!binding || binding.purpose !== 'general' || binding.capability !== 'family.write')
    throw new Error('Local translation current-row receipt is missing');
  return binding;
};

export class SqliteLocalTranslationLanguageRepository extends SqliteRepository implements
  LocalTranslationLanguageRepositoryPort, LocalTranslationPolicyResourceRepositoryPort {
  public resolvePolicyResource(context: RepositoryExecutionContext, resourceType: LocalTranslationResourceType, resourceId: string)
  : ReturnType<LocalTranslationPolicyResourceRepositoryPort['resolvePolicyResource']> {
    return this.execute(context, () => {
      const table = resourceType === 'local_translation_profile' ? 'local_translation_profiles'
        : resourceType === 'local_translation_request' ? 'local_translation_requests' : null;
      if (!table) throw new Error('Local translation resource type is unsupported');
      const status = resourceType === 'local_translation_profile' ? "'active'" : 'state';
      const row = this.database(context).prepare(`SELECT id,family_id,owner_person_id,revision,${status} status,state_fingerprint
        FROM ${table} WHERE id=?`).get(resourceId) as Record<string, unknown> | undefined;
      return row ? Object.freeze({ id: String(row.id), familyId: asFamilyId(String(row.family_id)),
        ownerPersonId: asPersonId(String(row.owner_person_id)), revision: Number(row.revision),
        status: String(row.status), stateFingerprint: String(row.state_fingerprint) }) : null;
    });
  }

  public loadCenter(context: PolicyAuthorizedRepositoryExecutionContext, key: LocalTranslationCenterKey)
  : RepositoryResult<LocalTranslationCenterSnapshotRow> {
    assertKey(context, key, 'read');
    return this.execute(context, () => {
      const profileRow = this.database(context).prepare(`${profileSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(key.profileId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined;
      const dictionaryRows = this.database(context).prepare(`${dictionarySelect} WHERE family_id=? AND owner_person_id=?
        ORDER BY updated_at DESC,id LIMIT 257`).all(key.familyId, key.ownerPersonId) as Record<string, unknown>[];
      const requestRows = this.database(context).prepare(`${requestSelect} WHERE family_id=? AND owner_person_id=?
        ORDER BY updated_at DESC,id LIMIT 257`).all(key.familyId, key.ownerPersonId) as Record<string, unknown>[];
      if (dictionaryRows.length > 256 || requestRows.length > 256) throw new Error('Local translation center bound exceeded');
      return Object.freeze({ profile: profileRow ? mapProfile(profileRow) : null,
        dictionary: Object.freeze(dictionaryRows.map(mapDictionary)), requests: Object.freeze(requestRows.map(mapRequest)) });
    });
  }

  public findProfile(context: PolicyAuthorizedRepositoryExecutionContext, key: LocalTranslationCenterKey)
  : RepositoryResult<LocalTranslationProfileRow | null> {
    assertAccess(context, key);
    return this.execute(context, () => { const row = this.database(context).prepare(`${profileSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
      .get(key.profileId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined; return row ? mapProfile(row) : null; });
  }
  public findDictionaryEntry(context: PolicyAuthorizedRepositoryExecutionContext, key: LocalTranslationCenterKey, entryId: string)
  : RepositoryResult<LocalTranslationDictionaryEntryRow | null> {
    assertAccess(context, key);
    if (context.policyAuthorization.resourceType !== 'local_translation_profile') throw new Error('Dictionary lookup requires profile receipt');
    return this.execute(context, () => { const row = this.database(context).prepare(`${dictionarySelect}
      WHERE id=? AND family_id=? AND owner_person_id=? AND profile_id=?`).get(entryId,key.familyId,key.ownerPersonId,key.profileId) as Record<string, unknown> | undefined;
      return row ? mapDictionary(row) : null; });
  }
  public findRequest(context: PolicyAuthorizedRepositoryExecutionContext, key: LocalTranslationCenterKey, requestId: string)
  : RepositoryResult<LocalTranslationRequestRow | null> {
    assertAccess(context, key);
    if (context.policyAuthorization.resourceType !== 'local_translation_request'
      || context.policyAuthorization.resourceId !== requestId) throw new Error('Request lookup requires exact request receipt');
    return this.execute(context, () => { const row = this.database(context).prepare(`${requestSelect}
      WHERE id=? AND family_id=? AND owner_person_id=?`).get(requestId,key.familyId,key.ownerPersonId) as Record<string, unknown> | undefined;
      return row ? mapRequest(row) : null; });
  }
  public findMutationByClientOperationId(context: PolicyAuthorizedRepositoryExecutionContext, key: LocalTranslationCenterKey,
    clientOperationId: string): RepositoryResult<LocalTranslationMutationRow | null> {
    assertAccess(context, key);
    return this.execute(context, () => { const row = this.database(context).prepare(`${mutationSelect}
      WHERE family_id=? AND actor_account_id=? AND client_operation_id=?`).get(key.familyId,key.accountId,clientOperationId) as Record<string, unknown> | undefined;
      return row ? mapMutation(row) : null; });
  }

  public insertMutation(context: PolicyAuthorizedRepositoryExecutionContext, row: LocalTranslationMutationRow): RepositoryResult<void> {
    const binding = writeBinding(context, row);
    if (row.actorAccountId !== context.policyAuthorization.subject.accountId
      || row.actorPersonId !== context.policyAuthorization.subject.personId
      || row.ownerPersonId !== context.policyAuthorization.receiptRecord.request.resource.ownerPersonId
      || row.revision !== row.expectedRevision + 1) throw new Error('Local translation mutation identity or revision is invalid');
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO local_translation_mutations(
      id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,actor_person_id,mutation_kind,
      client_operation_id,request_fingerprint,expected_revision,revision,resource_state_fingerprint,occurred_at,
      policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,policy_resource_type,
      policy_resource_id,policy_action,policy_capability) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      row.id,row.familyId,row.ownerPersonId,row.resourceType,row.resourceId,row.actorAccountId,row.actorPersonId,row.mutationKind,
      row.clientOperationId,row.requestFingerprint,row.expectedRevision,row.revision,row.resourceStateFingerprint,row.occurredAt,
      binding.receiptHash,binding.receiptVersion,binding.nonce,context.correlationId,binding.resourceType,binding.resourceId,
      binding.action,binding.capability); });
  }

  public insertProfile(context: PolicyAuthorizedRepositoryExecutionContext, row: LocalTranslationProfileRow): RepositoryResult<void> {
    const binding = currentBinding(context, 'local_translation_profile', row.id, row.familyId);
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO local_translation_profiles(
      id,family_id,owner_person_id,preferred_language,secondary_languages_json,local_first_required,
      live_caption_translation_enabled,translated_speech_enabled,preserve_original_audio,external_provider_allowed,
      encrypted_sync_requested,encrypted_sync_executed,revision,state_fingerprint,last_mutation_id,created_at,updated_at,policy_receipt_hash)
      VALUES(?,?,?,?,?,1,?,?,1,?,?,0,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.preferredLanguage,
      JSON.stringify(row.secondaryLanguages),row.liveCaptionTranslationEnabled?1:0,row.translatedSpeechEnabled?1:0,
      row.externalProviderAllowed?1:0,row.encryptedSyncRequested?1:0,row.revision,row.stateFingerprint,row.lastMutationId,
      row.createdAt,row.updatedAt,binding.receiptHash); });
  }
  public saveProfile(context: PolicyAuthorizedRepositoryExecutionContext, row: LocalTranslationProfileRow, expectedRevision: number): RepositoryResult<void> {
    const binding = currentBinding(context, 'local_translation_profile', row.id, row.familyId);
    return this.execute(context, () => { const result = this.database(context).prepare(`UPDATE local_translation_profiles SET
      preferred_language=?,secondary_languages_json=?,live_caption_translation_enabled=?,translated_speech_enabled=?,
      external_provider_allowed=?,encrypted_sync_requested=?,encrypted_sync_executed=0,revision=?,state_fingerprint=?,
      last_mutation_id=?,updated_at=?,policy_receipt_hash=? WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`).run(
      row.preferredLanguage,JSON.stringify(row.secondaryLanguages),row.liveCaptionTranslationEnabled?1:0,row.translatedSpeechEnabled?1:0,
      row.externalProviderAllowed?1:0,row.encryptedSyncRequested?1:0,row.revision,row.stateFingerprint,row.lastMutationId,row.updatedAt,
      binding.receiptHash,row.id,row.familyId,row.ownerPersonId,expectedRevision) as {changes?:number};
      if (Number(result.changes) !== 1) throw new Error('Local translation profile optimistic revision conflict'); });
  }
  public insertDictionaryEntry(context: PolicyAuthorizedRepositoryExecutionContext, row: LocalTranslationDictionaryEntryRow): RepositoryResult<void> {
    currentBinding(context, 'local_translation_profile', row.profileId, row.familyId);
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO local_translation_dictionary_entries(
      id,family_id,owner_person_id,profile_id,category,source_language,target_language,source_term,preferred_term,
      explicit_permission_recorded,state,revision,last_mutation_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?,?)`).run(
      row.id,row.familyId,row.ownerPersonId,row.profileId,row.category,row.sourceLanguage,row.targetLanguage,row.sourceTerm,
      row.preferredTerm,row.state,row.revision,row.lastMutationId,row.createdAt,row.updatedAt); });
  }
  public saveDictionaryEntry(context: PolicyAuthorizedRepositoryExecutionContext, row: LocalTranslationDictionaryEntryRow,
    expectedRevision: number): RepositoryResult<void> {
    currentBinding(context, 'local_translation_profile', row.profileId, row.familyId);
    return this.execute(context, () => { const result = this.database(context).prepare(`UPDATE local_translation_dictionary_entries SET
      category=?,source_language=?,target_language=?,source_term=?,preferred_term=?,state=?,revision=?,last_mutation_id=?,updated_at=?
      WHERE id=? AND family_id=? AND owner_person_id=? AND profile_id=? AND revision=?`).run(row.category,row.sourceLanguage,
      row.targetLanguage,row.sourceTerm,row.preferredTerm,row.state,row.revision,row.lastMutationId,row.updatedAt,row.id,row.familyId,
      row.ownerPersonId,row.profileId,expectedRevision) as {changes?:number};
      if (Number(result.changes) !== 1) throw new Error('Local translation dictionary optimistic revision conflict'); });
  }
  public insertRequest(context: PolicyAuthorizedRepositoryExecutionContext, row: LocalTranslationRequestRow): RepositoryResult<void> {
    const binding = currentBinding(context, 'local_translation_request', row.id, row.familyId);
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO local_translation_requests(
      id,family_id,owner_person_id,source_kind,source_resource_id,target_language,provider_mode,state,
      original_preservation_required,separate_translation_view_required,machine_translation_label_required,quality_flag,
      external_preview_acknowledged,explicit_external_consent,correction_sha256,correction_character_count,
      language_detection_executed,translation_executed,speech_to_text_executed,speaker_separation_executed,
      live_caption_translation_executed,text_to_speech_executed,network_used,cloud_used,revision,state_fingerprint,
      last_mutation_id,created_at,updated_at,policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,1,1,1,?,?,?,?,?,0,0,0,0,0,0,0,0,?,?,?,?,?,?)`).run(
      row.id,row.familyId,row.ownerPersonId,row.sourceKind,row.sourceResourceId,row.targetLanguage,row.providerMode,row.state,row.qualityFlag,
      row.externalPreviewAcknowledged?1:0,row.explicitExternalConsent?1:0,row.correctionSha256??null,row.correctionCharacterCount??null,
      row.revision,row.stateFingerprint,row.lastMutationId,row.createdAt,row.updatedAt,binding.receiptHash); });
  }
  public saveRequest(context: PolicyAuthorizedRepositoryExecutionContext, row: LocalTranslationRequestRow,
    expectedRevision: number): RepositoryResult<void> {
    const binding = currentBinding(context, 'local_translation_request', row.id, row.familyId);
    return this.execute(context, () => { const result = this.database(context).prepare(`UPDATE local_translation_requests SET
      state=?,quality_flag=?,correction_sha256=?,correction_character_count=?,revision=?,state_fingerprint=?,last_mutation_id=?,
      updated_at=?,policy_receipt_hash=? WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`).run(row.state,row.qualityFlag,
      row.correctionSha256??null,row.correctionCharacterCount??null,row.revision,row.stateFingerprint,row.lastMutationId,row.updatedAt,
      binding.receiptHash,row.id,row.familyId,row.ownerPersonId,expectedRevision) as {changes?:number};
      if (Number(result.changes) !== 1) throw new Error('Local translation request optimistic revision conflict'); });
  }
  public appendEvent(context: PolicyAuthorizedRepositoryExecutionContext, row: LocalTranslationEventRow): RepositoryResult<void> {
    currentBinding(context,row.resourceType,row.resourceId,row.familyId);
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO local_translation_events(
      id,family_id,owner_person_id,resource_type,resource_id,event_kind,resource_revision,state_fingerprint,mutation_id,occurred_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.resourceType,row.resourceId,row.eventKind,
      row.resourceRevision,row.stateFingerprint,row.mutationId,row.occurredAt); });
  }
}
