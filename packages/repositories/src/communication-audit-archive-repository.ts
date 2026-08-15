import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type { CommunicationArchiveIntegrityCheckpointView, CommunicationAuditEventKind, CommunicationAuditEventView } from '@ppt/domain';
import type {
  CommunicationAuditArchiveKey,
  CommunicationAuditArchiveRepositoryPort,
  CommunicationAuditOperationRow,
  RepositoryExecutionContext
} from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';

const assertKey = (key: CommunicationAuditArchiveKey): void => {
  if (!String(key.familyId).trim() || !String(key.ownerPersonId).trim()) throw new Error('Communication audit archive key is invalid');
};
const mapEvent = (row: Record<string,unknown>): CommunicationAuditEventView => Object.freeze({
  id:String(row.id),familyId:String(row.family_id),ownerPersonId:String(row.owner_person_id),actorPersonId:String(row.actor_person_id),
  actorDeviceId:String(row.actor_device_id),eventKind:String(row.event_kind) as CommunicationAuditEventKind,
  resourceType:String(row.resource_type),resourceId:String(row.resource_id),resourceVersion:Number(row.resource_version),
  resourceFingerprint:String(row.resource_fingerprint),previousHash:String(row.previous_hash),eventHash:String(row.event_hash),
  sequence:Number(row.sequence_no),occurredAt:asIsoDateTime(String(row.occurred_at)),contentCopiedToAudit:false
});
const mapCheckpoint = (row: Record<string,unknown>): CommunicationArchiveIntegrityCheckpointView => Object.freeze({
  id:String(row.id),familyId:String(row.family_id),archiveGeneration:Number(row.archive_generation),
  vaultManifestSha256:String(row.vault_manifest_sha256),databaseManifestSha256:String(row.database_manifest_sha256),
  backupManifestSha256:String(row.backup_manifest_sha256),
  ...(row.replica_manifest_sha256?{replicaManifestSha256:String(row.replica_manifest_sha256)}:{}),
  ...(row.restore_manifest_sha256?{restoreManifestSha256:String(row.restore_manifest_sha256)}:{}),
  vaultVerified:Number(row.vault_verified)===1,backupVerified:Number(row.backup_verified)===1,
  replicaVerified:Number(row.replica_verified)===1,restoreVerified:Number(row.restore_verified)===1,
  externalBackupProviderVerified:false,remoteReplicationVerified:false,createdAt:asIsoDateTime(String(row.created_at))
});
const mapOperation = (row: Record<string,unknown>): CommunicationAuditOperationRow => Object.freeze({
  clientOperationId:String(row.client_operation_id),familyId:asFamilyId(String(row.family_id)),
  ownerPersonId:asPersonId(String(row.owner_person_id)),operationKind:String(row.operation_kind) as CommunicationAuditOperationRow['operationKind'],
  requestFingerprint:String(row.request_fingerprint),resultId:String(row.result_id)
});

export class SqliteCommunicationAuditArchiveRepository extends SqliteRepository implements CommunicationAuditArchiveRepositoryPort {
  public listEvents(context:RepositoryExecutionContext,key:CommunicationAuditArchiveKey){assertKey(key);return this.execute(context,()=>{
    const rows=this.database(context).prepare(`SELECT * FROM communication_audit_events WHERE family_id=? AND owner_person_id=?
      ORDER BY sequence_no LIMIT 100001`).all(key.familyId,key.ownerPersonId) as Record<string,unknown>[];
    if(rows.length>100000)throw new Error('Communication audit event bound exceeded');return Object.freeze(rows.map(mapEvent));});}
  public listCheckpoints(context:RepositoryExecutionContext,key:CommunicationAuditArchiveKey){assertKey(key);return this.execute(context,()=>{
    const rows=this.database(context).prepare(`SELECT * FROM communication_archive_integrity_checkpoints WHERE family_id=?
      AND owner_person_id=? ORDER BY archive_generation DESC LIMIT 1001`).all(key.familyId,key.ownerPersonId) as Record<string,unknown>[];
    if(rows.length>1000)throw new Error('Communication archive checkpoint bound exceeded');return Object.freeze(rows.map(mapCheckpoint));});}
  public findOperation(context:RepositoryExecutionContext,key:CommunicationAuditArchiveKey,clientOperationId:string){assertKey(key);return this.execute(context,()=>{
    const row=this.database(context).prepare(`SELECT client_operation_id,family_id,owner_person_id,operation_kind,
      request_fingerprint,result_id FROM communication_audit_operations WHERE family_id=? AND owner_person_id=?
      AND client_operation_id=?`).get(key.familyId,key.ownerPersonId,clientOperationId) as Record<string,unknown>|undefined;
    return row?mapOperation(row):null;});}
  public appendEvent(context:RepositoryExecutionContext,key:CommunicationAuditArchiveKey,event:CommunicationAuditEventView,
    operation:CommunicationAuditOperationRow){assertKey(key);return this.execute(context,()=>{const database=this.database(context);
      database.prepare(`INSERT INTO communication_audit_operations(client_operation_id,family_id,owner_person_id,
        operation_kind,request_fingerprint,result_id) VALUES(?,?,?,?,?,?)`).run(operation.clientOperationId,operation.familyId,
        operation.ownerPersonId,operation.operationKind,operation.requestFingerprint,operation.resultId);
      database.prepare(`INSERT INTO communication_audit_events(id,family_id,owner_person_id,actor_person_id,actor_device_id,
        event_kind,resource_type,resource_id,resource_version,resource_fingerprint,previous_hash,event_hash,sequence_no,
        occurred_at,content_copied) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`).run(event.id,key.familyId,key.ownerPersonId,
        event.actorPersonId,event.actorDeviceId,event.eventKind,event.resourceType,event.resourceId,event.resourceVersion,
        event.resourceFingerprint,event.previousHash,event.eventHash,event.sequence,event.occurredAt);});}
  public appendCheckpoint(context:RepositoryExecutionContext,key:CommunicationAuditArchiveKey,
    checkpoint:CommunicationArchiveIntegrityCheckpointView,operation:CommunicationAuditOperationRow){assertKey(key);
    return this.execute(context,()=>{const database=this.database(context);
      database.prepare(`INSERT INTO communication_audit_operations(client_operation_id,family_id,owner_person_id,
        operation_kind,request_fingerprint,result_id) VALUES(?,?,?,?,?,?)`).run(operation.clientOperationId,operation.familyId,
        operation.ownerPersonId,operation.operationKind,operation.requestFingerprint,operation.resultId);
      database.prepare(`INSERT INTO communication_archive_integrity_checkpoints(id,family_id,owner_person_id,archive_generation,
        vault_manifest_sha256,database_manifest_sha256,backup_manifest_sha256,replica_manifest_sha256,restore_manifest_sha256,
        vault_verified,backup_verified,replica_verified,restore_verified,external_backup_provider_verified,
        remote_replication_verified,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,?)`).run(checkpoint.id,key.familyId,
        key.ownerPersonId,checkpoint.archiveGeneration,checkpoint.vaultManifestSha256,checkpoint.databaseManifestSha256,
        checkpoint.backupManifestSha256,checkpoint.replicaManifestSha256??null,checkpoint.restoreManifestSha256??null,
        checkpoint.vaultVerified?1:0,checkpoint.backupVerified?1:0,checkpoint.replicaVerified?1:0,
        checkpoint.restoreVerified?1:0,checkpoint.createdAt);});}
}
