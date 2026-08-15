import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type { CommunicationFileSharingCenterView, CommunicationFileSharingCommand } from '@ppt/domain';
import { communicationFileSharingTruth } from '@ppt/domain';
import type {
  CommunicationFileSharingCenterKey,
  CommunicationFileSharingCenterRow,
  CommunicationFileSharingMutationRow,
  CommunicationFileSharingRepositoryPort,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';

const mutationSelect = `SELECT id,family_id,owner_person_id,center_id,actor_account_id,actor_person_id,
  client_operation_id,command_kind,request_fingerprint,expected_revision,revision,policy_receipt_id,
  state_fingerprint,occurred_at FROM communication_file_sharing_mutations`;

const mapMutation = (row: Record<string, unknown>): CommunicationFileSharingMutationRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  centerId: String(row.center_id), actorAccountId: String(row.actor_account_id),
  actorPersonId: asPersonId(String(row.actor_person_id)), clientOperationId: String(row.client_operation_id),
  commandKind: String(row.command_kind) as CommunicationFileSharingCommand['kind'],
  requestFingerprint: String(row.request_fingerprint), expectedRevision: Number(row.expected_revision),
  revision: Number(row.revision), policyReceiptId: String(row.policy_receipt_id),
  stateFingerprint: String(row.state_fingerprint), occurredAt: asIsoDateTime(String(row.occurred_at))
});

const parseSnapshot = (
  json: string,
  key: CommunicationFileSharingCenterKey,
  revision: number
): CommunicationFileSharingCenterView => {
  const value = JSON.parse(json) as CommunicationFileSharingCenterView;
  if (!value || value.schemaVersion !== 1 || value.centerId !== key.centerId || value.ownerPersonId !== key.ownerPersonId
    || value.revision !== revision || !Array.isArray(value.files) || value.files.length > 10_000
    || !Array.isArray(value.emergencyAnnouncements) || value.emergencyAnnouncements.length > 1_000
    || !Array.isArray(value.remoteAssistance) || value.remoteAssistance.length > 1_000
    || !Array.isArray(value.coWatchSessions) || value.coWatchSessions.length > 1_000
    || !Array.isArray(value.voiceActions) || value.voiceActions.length > 1_000
    || JSON.stringify(value.truth) !== JSON.stringify(communicationFileSharingTruth)) {
    throw new Error('Communication file sharing snapshot is invalid');
  }
  return Object.freeze(value);
};

const assertKey = (key: CommunicationFileSharingCenterKey): void => {
  if (key.centerId !== `communication-file-sharing:${key.familyId}:${key.ownerPersonId}`)
    throw new Error('Communication file sharing key is incoherent');
};

export class SqliteCommunicationFileSharingRepository extends SqliteRepository
  implements CommunicationFileSharingRepositoryPort {
  public load(
    context: RepositoryExecutionContext,
    key: CommunicationFileSharingCenterKey
  ): RepositoryResult<CommunicationFileSharingCenterRow | null> {
    assertKey(key);
    return this.execute(context, () => {
      const row: Record<string, unknown> | undefined = this.database(context).prepare(`SELECT id,family_id,owner_person_id,snapshot_json,revision,
        state_fingerprint,last_mutation_id,updated_at FROM communication_file_sharing_centers
        WHERE id=? AND family_id=? AND owner_person_id=?`).get(key.centerId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined;
      if (!row) return null;
      return Object.freeze({ key, snapshot: parseSnapshot(String(row.snapshot_json), key, Number(row.revision)),
        stateFingerprint: String(row.state_fingerprint), lastMutationId: String(row.last_mutation_id),
        updatedAt: asIsoDateTime(String(row.updated_at)) });
    });
  }

  public findMutation(
    context: RepositoryExecutionContext,
    key: CommunicationFileSharingCenterKey,
    clientOperationId: string
  ): RepositoryResult<CommunicationFileSharingMutationRow | null> {
    assertKey(key);
    return this.execute(context, () => {
      const row: Record<string, unknown> | undefined = this.database(context).prepare(`${mutationSelect} WHERE family_id=? AND owner_person_id=?
        AND center_id=? AND client_operation_id=?`).get(key.familyId, key.ownerPersonId, key.centerId, clientOperationId) as Record<string, unknown> | undefined;
      return row ? mapMutation(row) : null;
    });
  }

  public save(
    context: RepositoryExecutionContext,
    row: CommunicationFileSharingCenterRow,
    mutation: CommunicationFileSharingMutationRow,
    expectedRevision: number
  ): RepositoryResult<void> {
    assertKey(row.key);
    return this.execute(context, () => {
      if (mutation.familyId !== row.key.familyId || mutation.ownerPersonId !== row.key.ownerPersonId
        || mutation.centerId !== row.key.centerId || mutation.expectedRevision !== expectedRevision
        || mutation.revision !== expectedRevision + 1 || row.snapshot.revision !== mutation.revision
        || row.stateFingerprint !== mutation.stateFingerprint || row.lastMutationId !== mutation.id
        || row.updatedAt !== mutation.occurredAt) throw new Error('Communication file sharing durable mutation binding is invalid');
      const database = this.database(context);
      const count = database.prepare(`SELECT COUNT(*) count FROM communication_file_sharing_mutations
        WHERE family_id=? AND owner_person_id=?`).get(row.key.familyId, row.key.ownerPersonId) as { count: number };
      if (Number(count.count) >= 50_000) throw new Error('Communication file sharing mutation quota exceeded');
      database.prepare(`INSERT INTO communication_file_sharing_mutations(
        id,family_id,owner_person_id,center_id,actor_account_id,actor_person_id,client_operation_id,command_kind,
        request_fingerprint,expected_revision,revision,policy_receipt_id,state_fingerprint,occurred_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(mutation.id, mutation.familyId, mutation.ownerPersonId, mutation.centerId,
        mutation.actorAccountId, mutation.actorPersonId, mutation.clientOperationId, mutation.commandKind,
        mutation.requestFingerprint, mutation.expectedRevision, mutation.revision, mutation.policyReceiptId,
        mutation.stateFingerprint, mutation.occurredAt);
      const snapshot = JSON.stringify(row.snapshot);
      if (expectedRevision === 0) {
        const result = database.prepare(`INSERT INTO communication_file_sharing_centers(
          id,family_id,owner_person_id,snapshot_json,revision,state_fingerprint,last_mutation_id,updated_at)
          VALUES(?,?,?,?,?,?,?,?)`).run(row.key.centerId, row.key.familyId, row.key.ownerPersonId, snapshot,
          row.snapshot.revision, row.stateFingerprint, row.lastMutationId, row.updatedAt);
        if (Number(result.changes) !== 1) throw new Error('Communication file sharing center insert failed');
      } else {
        const result = database.prepare(`UPDATE communication_file_sharing_centers SET snapshot_json=?,revision=?,
          state_fingerprint=?,last_mutation_id=?,updated_at=? WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`)
          .run(snapshot, row.snapshot.revision, row.stateFingerprint, row.lastMutationId, row.updatedAt,
            row.key.centerId, row.key.familyId, row.key.ownerPersonId, expectedRevision);
        if (Number(result.changes) !== 1) throw new Error('Communication file sharing optimistic revision conflict');
      }
    });
  }
}
