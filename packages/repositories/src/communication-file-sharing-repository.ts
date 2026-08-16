import { createHash } from 'node:crypto';
import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type { CommunicationFileShareView, CommunicationFileSharingCenterView, CommunicationFileSharingCommand } from '@ppt/domain';
import { communicationFileSharingTruth } from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type CommunicationFileSharingCenterKey,
  type CommunicationFileSharingCenterRow,
  type CommunicationFileSharingMutationRow,
  type CommunicationFileSharingPolicyResourceRepositoryPort,
  type CommunicationFileSharingRepositoryPort,
  type CommunicationFileSharingResourceType,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const mutationSelect = `SELECT id,family_id,owner_person_id,center_id,resource_type,resource_id,
  actor_account_id,actor_person_id,client_operation_id,command_kind,request_fingerprint,expected_revision,
  revision,state_fingerprint,occurred_at FROM communication_file_sharing_mutations`;
const centerSelect = `SELECT id,family_id,owner_person_id,snapshot_json,revision,state_fingerprint,
  last_mutation_id,updated_at FROM communication_file_sharing_centers`;
const SHA256 = /^[0-9a-f]{64}$/u;
const SEALED_REFERENCE = /^comm-file-[0-9a-f]{64}\.pptshare$/u;
const stable = (value: unknown): string => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');

const mapMutation = (row: Record<string, unknown>): CommunicationFileSharingMutationRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  centerId: String(row.center_id), resourceType: String(row.resource_type) as CommunicationFileSharingResourceType,
  resourceId: String(row.resource_id), actorAccountId: String(row.actor_account_id),
  actorPersonId: asPersonId(String(row.actor_person_id)), clientOperationId: String(row.client_operation_id),
  commandKind: String(row.command_kind) as CommunicationFileSharingCommand['kind'],
  requestFingerprint: String(row.request_fingerprint), expectedRevision: Number(row.expected_revision),
  revision: Number(row.revision), stateFingerprint: String(row.state_fingerprint),
  occurredAt: asIsoDateTime(String(row.occurred_at))
});

const assertFile = (file: CommunicationFileShareView): void => {
  if (!file || typeof file !== 'object' || !SEALED_REFERENCE.test(file.sealedPayloadReference)
    || file.providerId !== 'protected-side-artifact-store-v1' || !SHA256.test(file.providerEvidenceSha256)
    || !SHA256.test(file.fullContentSha256) || !Array.isArray(file.chunks) || file.chunks.length !== file.totalChunks
    || file.totalChunks < 1 || file.totalChunks > 512 || !Array.isArray(file.versions) || file.versions.length < 1
    || file.versions.length > 32 || !Array.isArray(file.comments) || file.comments.length > 256
    || !Array.isArray(file.accessGrants) || file.accessGrants.length > 256
    || file.externalLinkEnabled !== false || file.externalLinkAccessCodeRequired !== true
    || file.versions.some((version) => !SEALED_REFERENCE.test(version.sealedPayloadReference)
      || version.providerId !== 'protected-side-artifact-store-v1' || !SHA256.test(version.providerEvidenceSha256)))
    throw new Error('Communication file sharing file snapshot is invalid');
};

const parseSnapshot = (json: string, key: CommunicationFileSharingCenterKey, revision: number): CommunicationFileSharingCenterView => {
  if (Buffer.byteLength(json, 'utf8') > 8 * 1024 * 1024) throw new Error('Communication file sharing snapshot size bound exceeded');
  const value = JSON.parse(json) as CommunicationFileSharingCenterView;
  if (!value || value.schemaVersion !== 1 || value.centerId !== key.centerId || value.ownerPersonId !== key.ownerPersonId
    || value.revision !== revision || !Array.isArray(value.files) || value.files.length > 128
    || !Array.isArray(value.emergencyAnnouncements) || value.emergencyAnnouncements.length > 128
    || !Array.isArray(value.remoteAssistance) || value.remoteAssistance.length > 64
    || !Array.isArray(value.coWatchSessions) || value.coWatchSessions.length > 128
    || !Array.isArray(value.voiceActions) || value.voiceActions.length > 128
    || JSON.stringify(value.truth) !== JSON.stringify(communicationFileSharingTruth))
    throw new Error('Communication file sharing snapshot is invalid');
  value.files.forEach(assertFile);
  return Object.freeze(value);
};

const keyFromRow = (row: Record<string, unknown>): CommunicationFileSharingCenterKey => Object.freeze({
  familyId: asFamilyId(String(row.family_id)), accountId: String(row.owner_person_id),
  actorPersonId: asPersonId(String(row.owner_person_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  centerId: String(row.id)
});

const assertKeyShape = (key: CommunicationFileSharingCenterKey): void => {
  if (key.centerId !== `communication-file-sharing:${key.familyId}:${key.ownerPersonId}` || key.actorPersonId !== key.ownerPersonId)
    throw new Error('Communication file sharing key is incoherent');
};

const assertAccess = (context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationFileSharingCenterKey): void => {
  assertKeyShape(key);
  const authorization = context.policyAuthorization;
  const read = authorization.action === 'read' && ((authorization.resourceType === 'communication_file_sharing_center'
    && authorization.resourceId === '*') || (authorization.resourceType === 'communication_file_sharing'
    && authorization.resourceId !== '*'));
  assertPolicyAuthorizedRepositoryContext(context, { resourceType: authorization.resourceType,
    resourceId: authorization.resourceId, action: authorization.action,
    capability: read ? 'family.read' : 'family.write', correlationId: context.correlationId,
    resourceFamilyId: key.familyId });
  if (authorization.purpose !== 'general' || authorization.subject.accountId !== key.accountId
    || authorization.subject.personId !== key.actorPersonId || !authorization.subject.familyIds.includes(key.familyId)
    || authorization.resourceFamilyId !== key.familyId
    || authorization.receiptRecord.request.resource.ownerPersonId !== key.ownerPersonId
    || authorization.receiptRecord.request.resource.sensitivity !== 'highly_sensitive'
    || (read ? authorization.action !== 'read' : !['create','update','delete'].includes(authorization.action)))
    throw new Error('Communication file sharing key does not match the exact policy receipt');
};

const bindingFor = (context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationFileSharingMutationRow) => {
  const binding = platformPolicyPersistenceBinding(context, row.resourceType, row.resourceId);
  if (!binding || binding.resourceFamilyId !== row.familyId || binding.purpose !== 'general'
    || binding.capability !== 'family.write' || binding.occurredAt !== row.occurredAt
    || binding.action !== context.policyAuthorization.action
    || (row.commandKind === 'prepare_file' ? binding.action !== 'create'
      : row.commandKind === 'revoke_share' ? binding.action !== 'delete' : binding.action === 'delete'))
    throw new Error('Communication file sharing mutation requires an exact durable policy receipt');
  return binding;
};

const findFile = (snapshot: CommunicationFileSharingCenterView, fileId: string): CommunicationFileShareView | null =>
  snapshot.files.find((file) => file.id === fileId) ?? null;

export class SqliteCommunicationFileSharingRepository extends SqliteRepository implements
  CommunicationFileSharingRepositoryPort, CommunicationFileSharingPolicyResourceRepositoryPort {
  public resolvePolicyResource(context: RepositoryExecutionContext, resourceType: CommunicationFileSharingResourceType, resourceId: string)
  : ReturnType<CommunicationFileSharingPolicyResourceRepositoryPort['resolvePolicyResource']> {
    return this.execute(context, () => {
      if (resourceType === 'communication_file_sharing_center') {
        const row = this.database(context).prepare(`${centerSelect} WHERE id=?`).get(resourceId) as Record<string, unknown> | undefined;
        return row ? Object.freeze({ id: String(row.id), resourceType, familyId: asFamilyId(String(row.family_id)),
          ownerPersonId: asPersonId(String(row.owner_person_id)), revision: Number(row.revision), state: 'active',
          stateFingerprint: String(row.state_fingerprint) }) : null;
      }
      const rows = this.database(context).prepare(`${centerSelect} WHERE EXISTS(
        SELECT 1 FROM json_each(snapshot_json,'$.files') file WHERE json_extract(file.value,'$.id')=?) LIMIT 2`)
        .all(resourceId) as Record<string, unknown>[];
      if (rows.length > 1) throw new Error('Communication file sharing resource identity is ambiguous');
      if (rows.length === 0) return null;
      const row = rows[0]!; const key = keyFromRow(row);
      const snapshot = parseSnapshot(String(row.snapshot_json), key, Number(row.revision));
      const file = findFile(snapshot, resourceId); if (!file) return null;
      return Object.freeze({ id: file.id, resourceType, familyId: key.familyId, ownerPersonId: key.ownerPersonId,
        revision: file.revision, state: file.state, stateFingerprint: stable(file) });
    });
  }

  public load(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationFileSharingCenterKey)
  : RepositoryResult<CommunicationFileSharingCenterRow | null> {
    assertAccess(context, key);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`${centerSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(key.centerId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined;
      if (!row) return null;
      const snapshot = parseSnapshot(String(row.snapshot_json), key, Number(row.revision));
      if (context.policyAuthorization.resourceType === 'communication_file_sharing') {
        const existing = findFile(snapshot, context.policyAuthorization.resourceId);
        if (context.policyAuthorization.action === 'create' ? existing !== null : existing === null)
          throw new Error('Communication file sharing exact resource state does not match the policy action');
      }
      return Object.freeze({ key, snapshot, stateFingerprint: String(row.state_fingerprint),
        lastMutationId: String(row.last_mutation_id), updatedAt: asIsoDateTime(String(row.updated_at)) });
    });
  }

  public findMutation(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationFileSharingCenterKey,
    clientOperationId: string): RepositoryResult<CommunicationFileSharingMutationRow | null> {
    assertAccess(context, key);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`${mutationSelect} WHERE family_id=? AND owner_person_id=?
        AND actor_account_id=? AND client_operation_id=?`).get(key.familyId, key.ownerPersonId, key.accountId,
        clientOperationId) as Record<string, unknown> | undefined;
      return row ? mapMutation(row) : null;
    });
  }

  public save(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationFileSharingCenterRow,
    mutation: CommunicationFileSharingMutationRow, expectedRevision: number): RepositoryResult<void> {
    assertAccess(context, row.key); const binding = bindingFor(context, mutation);
    if (mutation.familyId !== row.key.familyId || mutation.ownerPersonId !== row.key.ownerPersonId
      || mutation.centerId !== row.key.centerId || mutation.actorAccountId !== row.key.accountId
      || mutation.actorPersonId !== row.key.actorPersonId || mutation.expectedRevision !== expectedRevision
      || mutation.revision !== expectedRevision + 1 || row.snapshot.revision !== mutation.revision
      || row.stateFingerprint !== mutation.stateFingerprint || row.lastMutationId !== mutation.id
      || row.updatedAt !== mutation.occurredAt || mutation.resourceType !== context.policyAuthorization.resourceType
      || mutation.resourceId !== context.policyAuthorization.resourceId)
      throw new Error('Communication file sharing durable mutation binding is invalid');
    const snapshot = JSON.stringify(row.snapshot); if (Buffer.byteLength(snapshot, 'utf8') > 8 * 1024 * 1024)
      throw new Error('Communication file sharing snapshot size bound exceeded');
    return this.execute(context, () => {
      const database = this.database(context);
      const current = database.prepare(`${centerSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(row.key.centerId, row.key.familyId, row.key.ownerPersonId) as Record<string, unknown> | undefined;
      if ((expectedRevision === 0 && current) || (expectedRevision > 0 && (!current || Number(current.revision) !== expectedRevision)))
        throw new Error('Communication file sharing optimistic revision conflict');
      if (mutation.resourceType === 'communication_file_sharing') {
        const previous = current ? parseSnapshot(String(current.snapshot_json), row.key, Number(current.revision)) : null;
        const existed = previous ? findFile(previous, mutation.resourceId) !== null : false;
        if (mutation.commandKind === 'prepare_file' ? existed : !existed)
          throw new Error('Communication file sharing resource action does not match current state');
        const duplicate = database.prepare(`SELECT id FROM communication_file_sharing_centers WHERE id<>? AND EXISTS(
          SELECT 1 FROM json_each(snapshot_json,'$.files') file WHERE json_extract(file.value,'$.id')=?) LIMIT 1`)
          .get(row.key.centerId, mutation.resourceId);
        if (duplicate) throw new Error('Communication file sharing resource identity is not globally unique');
      }
      database.prepare(`INSERT INTO communication_file_sharing_mutations(
        id,family_id,owner_person_id,center_id,resource_type,resource_id,actor_account_id,actor_person_id,
        client_operation_id,command_kind,request_fingerprint,expected_revision,revision,state_fingerprint,occurred_at,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,policy_resource_type,
        policy_resource_id,policy_action,policy_capability) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(mutation.id, mutation.familyId, mutation.ownerPersonId, mutation.centerId, mutation.resourceType,
          mutation.resourceId, mutation.actorAccountId, mutation.actorPersonId, mutation.clientOperationId,
          mutation.commandKind, mutation.requestFingerprint, mutation.expectedRevision, mutation.revision,
          mutation.stateFingerprint, mutation.occurredAt, binding.receiptHash, binding.receiptVersion, binding.nonce,
          context.correlationId, binding.resourceType, binding.resourceId, binding.action, binding.capability);
      if (expectedRevision === 0) {
        const result = database.prepare(`INSERT INTO communication_file_sharing_centers(
          id,family_id,owner_person_id,snapshot_json,revision,state_fingerprint,last_mutation_id,updated_at,policy_receipt_hash)
          VALUES(?,?,?,?,?,?,?,?,?)`).run(row.key.centerId, row.key.familyId, row.key.ownerPersonId, snapshot,
          row.snapshot.revision, row.stateFingerprint, row.lastMutationId, row.updatedAt, binding.receiptHash);
        if (Number(result.changes) !== 1) throw new Error('Communication file sharing center insert failed');
      } else {
        const result = database.prepare(`UPDATE communication_file_sharing_centers SET snapshot_json=?,revision=?,
          state_fingerprint=?,last_mutation_id=?,updated_at=?,policy_receipt_hash=? WHERE id=? AND family_id=?
          AND owner_person_id=? AND revision=?`).run(snapshot, row.snapshot.revision, row.stateFingerprint,
          row.lastMutationId, row.updatedAt, binding.receiptHash, row.key.centerId, row.key.familyId,
          row.key.ownerPersonId, expectedRevision);
        if (Number(result.changes) !== 1) throw new Error('Communication file sharing optimistic revision conflict');
      }
    });
  }
}
