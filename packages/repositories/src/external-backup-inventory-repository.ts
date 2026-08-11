import type { DatabaseExecutor } from '@ppt/contracts';
import type {
  ExternalBackupCopyKind,
  ExternalBackupCopyStatus,
  ExternalBackupCopyView,
  ExternalBackupDestructionEvidenceView,
  ExternalBackupEvidenceIssuerView,
  ExternalBackupEvidenceIssuerRotationView,
  ExternalBackupEvidenceRevocationListView,
  ExternalBackupRevocationEndpointView,
  ExternalBackupEvidenceVerificationStatus
} from '@ppt/domain';
import type {
  ExternalBackupCopyAttestationRow,
  ExternalBackupInventoryRepositoryPort,
  InsertExternalBackupCopyRow,
  InsertExternalBackupDestructionEvidenceRow,
  InsertExternalBackupEvidenceIssuerRow,
  InsertExternalBackupEvidenceIssuerRotationRow,
  InsertExternalBackupEvidenceRevocationEntryRow,
  InsertExternalBackupEvidenceRevocationListRow,
  UpsertExternalBackupRevocationEndpointRow,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';

const copySelect = `SELECT c.*,i.label AS verified_evidence_issuer_label
FROM external_backup_copies c
LEFT JOIN external_backup_destruction_evidence e ON e.id=c.verified_evidence_id
LEFT JOIN external_backup_evidence_issuers i ON i.id=e.issuer_id`;

const mapCopy=(row:Record<string,unknown>):ExternalBackupCopyView=>({
  id:String(row.id),
  label:String(row.label),
  kind:String(row.kind) as ExternalBackupCopyKind,
  locationHint:String(row.location_hint),
  custodian:String(row.custodian),
  status:String(row.status) as ExternalBackupCopyStatus,
  containsHistoricalDataRisk:Number(row.contains_historical_data_risk)===1,
  reviewIntervalDays:Number(row.review_interval_days),
  ...(row.last_reviewed_at?{lastReviewedAt:String(row.last_reviewed_at)}:{}),
  nextReviewAt:String(row.next_review_at),
  legalHold:Number(row.legal_hold)===1,
  ...(row.hold_reason?{holdReason:String(row.hold_reason)}:{}),
  ...(row.attestation_note?{attestationNote:String(row.attestation_note)}:{}),
  ...(row.evidence_sha256?{evidenceSha256:String(row.evidence_sha256)}:{}),
  evidenceVerificationStatus:String(row.evidence_verification_status??'none') as ExternalBackupEvidenceVerificationStatus,
  ...(row.verified_evidence_id?{verifiedEvidenceId:String(row.verified_evidence_id)}:{}),
  ...(row.verified_evidence_issuer_label?{verifiedEvidenceIssuerLabel:String(row.verified_evidence_issuer_label)}:{}),
  ...(row.attested_at?{attestedAt:String(row.attested_at)}:{}),
  ...(row.attested_by?{attestedBy:String(row.attested_by)}:{}),
  ...(row.destroyed_at?{destroyedAt:String(row.destroyed_at)}:{}),
  createdAt:String(row.created_at),
  updatedAt:String(row.updated_at)
});

const issuerTrustState=(row:Record<string,unknown>):ExternalBackupEvidenceIssuerView['trustState']=>{
  if(String(row.status)==='revoked')return 'revoked';
  const now=Date.now(),validFrom=Date.parse(String(row.valid_from??row.added_at));
  const validUntil=row.valid_until?Date.parse(String(row.valid_until)):Number.POSITIVE_INFINITY;
  if(Number.isFinite(validFrom)&&now<validFrom)return 'pending';
  if(Number.isFinite(validUntil)&&now>=validUntil)return 'expired';
  return 'active';
};
const mapIssuer=(row:Record<string,unknown>):ExternalBackupEvidenceIssuerView=>({
  id:String(row.id),
  label:String(row.label),
  algorithm:'ed25519',
  publicKeyPem:String(row.public_key_pem),
  fingerprintSha256:String(row.fingerprint_sha256),
  status:String(row.status) as ExternalBackupEvidenceIssuerView['status'],
  trustState:issuerTrustState(row),
  validFrom:String(row.valid_from??row.added_at),
  ...(row.valid_until?{validUntil:String(row.valid_until)}:{}),
  ...(row.predecessor_issuer_id?{predecessorIssuerId:String(row.predecessor_issuer_id)}:{}),
  rotationSequence:Number(row.rotation_sequence??0),
  ...(row.rotation_receipt_id?{rotationReceiptId:String(row.rotation_receipt_id)}:{}),
  ...(row.rotation_verified_at?{rotationVerifiedAt:String(row.rotation_verified_at)}:{}),
  verificationMethod:String(row.verification_method??'legacy_unverified') as ExternalBackupEvidenceIssuerView['verificationMethod'],
  ...(row.legal_entity_name?{legalEntityName:String(row.legal_entity_name)}:{}),
  ...(row.identity_evidence_reference?{identityEvidenceReference:String(row.identity_evidence_reference)}:{}),
  ...(row.key_fingerprint_evidence_reference?{keyFingerprintEvidenceReference:String(row.key_fingerprint_evidence_reference)}:{}),
  ...(row.verification_witness_name?{verificationWitnessName:String(row.verification_witness_name)}:{}),
  ...(row.verification_witness_organization?{verificationWitnessOrganization:String(row.verification_witness_organization)}:{}),
  ...(row.verification_checked_at?{verificationCheckedAt:String(row.verification_checked_at)}:{}),
  ...(row.verification_receipt_sha256?{verificationReceiptSha256:String(row.verification_receipt_sha256)}:{}),
  addedBy:String(row.added_by),
  addedAt:String(row.added_at),
  ...(row.revoked_by?{revokedBy:String(row.revoked_by)}:{}),
  ...(row.revoked_at?{revokedAt:String(row.revoked_at)}:{}),
  ...(row.revocation_reason?{revocationReason:String(row.revocation_reason)}:{}),
  ...(row.revocation_source?{revocationSource:String(row.revocation_source) as 'manual'|'signed_list'}:{}),
  ...(row.revocation_list_id?{revocationListId:String(row.revocation_list_id)}:{}),
  updatedAt:String(row.updated_at)
});

const mapRotation=(row:Record<string,unknown>):ExternalBackupEvidenceIssuerRotationView=>({
  id:String(row.id),
  predecessorIssuerId:String(row.predecessor_issuer_id),
  predecessorLabel:String(row.predecessor_label),
  successorIssuerId:String(row.successor_issuer_id),
  successorLabel:String(row.successor_label),
  receiptId:String(row.receipt_id),
  schemaVersion:1,
  successorFingerprintSha256:String(row.successor_fingerprint_sha256),
  effectiveAt:String(row.effective_at),
  signatureBase64:String(row.signature_base64),
  verifiedAt:String(row.verified_at),
  createdBy:String(row.created_by),
  createdAt:String(row.created_at)
});

const mapRevocationList=(database:DatabaseExecutor,row:Record<string,unknown>):ExternalBackupEvidenceRevocationListView=>{
  const entries=(database.prepare(`SELECT e.*,i.label AS issuer_label FROM external_backup_evidence_revocation_entries e JOIN external_backup_evidence_issuers i ON i.id=e.issuer_id WHERE e.list_row_id=? ORDER BY e.fingerprint_sha256`).all(String(row.id)) as Record<string,unknown>[]).map(entry=>({issuerId:String(entry.issuer_id),issuerLabel:String(entry.issuer_label),fingerprintSha256:String(entry.fingerprint_sha256),revokedAt:String(entry.revoked_at),reason:String(entry.reason)}));
  const now=Date.now(),next=Date.parse(String(row.next_update));
  const storedStatus=String(row.status) as ExternalBackupEvidenceRevocationListView['status'];
  return {id:String(row.id),authorityRootIssuerId:String(row.authority_root_issuer_id),signerIssuerId:String(row.signer_issuer_id),signerLabel:String(row.signer_label),listId:String(row.list_id),sequenceNumber:Number(row.sequence_number),schemaVersion:1,thisUpdate:String(row.this_update),nextUpdate:String(row.next_update),entries,payloadSha256:String(row.payload_sha256),signatureBase64:String(row.signature_base64),...(row.source_url?{sourceUrl:String(row.source_url)}:{}),status:storedStatus==='current'&&Number.isFinite(next)&&now>=next?'expired':storedStatus,verifiedAt:String(row.verified_at),createdBy:String(row.created_by),createdAt:String(row.created_at)};
};

const mapRevocationEndpoint=(row:Record<string,unknown>):ExternalBackupRevocationEndpointView=>({
  id:String(row.id),
  issuerId:String(row.issuer_id),
  issuerLabel:String(row.issuer_label),
  sourceUrl:String(row.source_url),
  primarySpkiSha256:String(row.primary_spki_sha256),
  ...(row.secondary_spki_sha256?{secondarySpkiSha256:String(row.secondary_spki_sha256)}:{}),
  ...(row.secondary_valid_from?{secondaryValidFrom:String(row.secondary_valid_from)}:{}),
  ...(row.primary_valid_until?{primaryValidUntil:String(row.primary_valid_until)}:{}),
  status:String(row.status) as ExternalBackupRevocationEndpointView['status'],
  lastFetchStatus:String(row.last_fetch_status??'never') as ExternalBackupRevocationEndpointView['lastFetchStatus'],
  ...(row.last_fetched_at?{lastFetchedAt:String(row.last_fetched_at)}:{}),
  ...(row.last_fetch_error?{lastFetchError:String(row.last_fetch_error)}:{}),
  createdBy:String(row.created_by),
  createdAt:String(row.created_at),
  updatedAt:String(row.updated_at)
});

const mapEvidence=(row:Record<string,unknown>):ExternalBackupDestructionEvidenceView=>({
  id:String(row.id),
  copyId:String(row.copy_id),
  issuerId:String(row.issuer_id),
  issuerLabel:String(row.issuer_label),
  receiptId:String(row.receipt_id),
  schemaVersion:1,
  evidenceSha256:String(row.evidence_sha256),
  issuedAt:String(row.issued_at),
  signatureBase64:String(row.signature_base64),
  verificationStatus:String(row.verification_status) as ExternalBackupDestructionEvidenceView['verificationStatus'],
  ...(row.failure_reason?{failureReason:String(row.failure_reason)}:{}),
  verifiedAt:String(row.verified_at),
  createdBy:String(row.created_by),
  createdAt:String(row.created_at),
  updatedAt:String(row.updated_at)
});

const insertAttestation=(database:DatabaseExecutor,row:ExternalBackupCopyAttestationRow):void=>{
  database.prepare(`INSERT INTO external_backup_copy_attestations(id,copy_id,action,note,evidence_sha256,actor_id,occurred_at) VALUES(?,?,?,?,?,?,?)`)
    .run(row.id,row.copyId,row.action,row.note,row.evidenceSha256??null,row.actorId,row.occurredAt);
};

export class SqliteExternalBackupInventoryRepository extends SqliteRepository implements ExternalBackupInventoryRepositoryPort {
  listCopies(context:RepositoryExecutionContext,limit:number):RepositoryResult<readonly ExternalBackupCopyView[]>{
    return this.execute(context,()=> (this.database(context).prepare(`${copySelect} ORDER BY CASE c.status WHEN 'active' THEN 0 WHEN 'unreachable' THEN 1 WHEN 'retired' THEN 2 ELSE 3 END,c.next_review_at,c.id LIMIT ?`).all(limit) as Record<string,unknown>[]).map(mapCopy));
  }
  findCopy(context:RepositoryExecutionContext,id:string):RepositoryResult<ExternalBackupCopyView|null>{
    return this.execute(context,()=>{const row=this.database(context).prepare(`${copySelect} WHERE c.id=?`).get(id) as Record<string,unknown>|undefined;return row?mapCopy(row):null;});
  }
  insertCopy(context:RepositoryExecutionContext,row:InsertExternalBackupCopyRow,attestation:ExternalBackupCopyAttestationRow):RepositoryResult<void>{
    return this.execute(context,()=>{
      const database=this.database(context);
      database.prepare(`INSERT INTO external_backup_copies(id,label,kind,location_hint,custodian,status,contains_historical_data_risk,review_interval_days,next_review_at,legal_hold,evidence_verification_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(row.id,row.label,row.kind,row.locationHint,row.custodian,row.status,row.containsHistoricalDataRisk?1:0,row.reviewIntervalDays,row.nextReviewAt,row.legalHold?1:0,'none',row.createdAt,row.updatedAt);
      insertAttestation(database,attestation);
    });
  }
  reviewCopy(context:RepositoryExecutionContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly status:'active'|'unreachable'|'retired';readonly containsHistoricalDataRisk:boolean;readonly reviewIntervalDays:number;readonly note:string;readonly reviewedAt:string;readonly nextReviewAt:string;readonly actorId:string;readonly attestationId:string}):RepositoryResult<ExternalBackupCopyView|null>{
    return this.execute(context,()=>{
      const database=this.database(context);
      const result=database.prepare(`UPDATE external_backup_copies SET status=?,contains_historical_data_risk=?,review_interval_days=?,last_reviewed_at=?,next_review_at=?,attestation_note=?,attested_at=?,attested_by=?,updated_at=? WHERE id=? AND status!='destroyed' AND updated_at=?`)
        .run(input.status,input.containsHistoricalDataRisk?1:0,input.reviewIntervalDays,input.reviewedAt,input.nextReviewAt,input.note,input.reviewedAt,input.actorId,input.reviewedAt,input.id,input.expectedUpdatedAt) as {changes?:number};
      if(Number(result.changes??0)!==1)return null;
      insertAttestation(database,{id:input.attestationId,copyId:input.id,action:'reviewed',note:input.note,actorId:input.actorId,occurredAt:input.reviewedAt});
      const row=database.prepare(`${copySelect} WHERE c.id=?`).get(input.id) as Record<string,unknown>|undefined;
      return row?mapCopy(row):null;
    });
  }
  setLegalHold(context:RepositoryExecutionContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly enabled:boolean;readonly reason?:string;readonly updatedAt:string;readonly actorId:string;readonly attestationId:string}):RepositoryResult<ExternalBackupCopyView|null>{
    return this.execute(context,()=>{
      const database=this.database(context);
      const result=database.prepare(`UPDATE external_backup_copies SET legal_hold=?,hold_reason=?,updated_at=? WHERE id=? AND status!='destroyed' AND updated_at=?`)
        .run(input.enabled?1:0,input.enabled?(input.reason??null):null,input.updatedAt,input.id,input.expectedUpdatedAt) as {changes?:number};
      if(Number(result.changes??0)!==1)return null;
      insertAttestation(database,{id:input.attestationId,copyId:input.id,action:input.enabled?'hold_enabled':'hold_disabled',note:input.enabled?(input.reason??'Bekletme etkinleştirildi.'):'Bekletme kaldırıldı.',actorId:input.actorId,occurredAt:input.updatedAt});
      const row=database.prepare(`${copySelect} WHERE c.id=?`).get(input.id) as Record<string,unknown>|undefined;
      return row?mapCopy(row):null;
    });
  }
  attestDestroyed(context:RepositoryExecutionContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly note:string;readonly evidenceSha256?:string;readonly destroyedAt:string;readonly actorId:string;readonly attestationId:string}):RepositoryResult<ExternalBackupCopyView|null>{
    return this.execute(context,()=>{
      const database=this.database(context);
      const result=database.prepare(`UPDATE external_backup_copies SET status='destroyed',contains_historical_data_risk=0,attestation_note=?,evidence_sha256=?,attested_at=?,attested_by=?,destroyed_at=?,updated_at=? WHERE id=? AND status!='destroyed' AND legal_hold=0 AND updated_at=?`)
        .run(input.note,input.evidenceSha256??null,input.destroyedAt,input.actorId,input.destroyedAt,input.destroyedAt,input.id,input.expectedUpdatedAt) as {changes?:number};
      if(Number(result.changes??0)!==1)return null;
      insertAttestation(database,{id:input.attestationId,copyId:input.id,action:'destroyed_attested',note:input.note,...(input.evidenceSha256?{evidenceSha256:input.evidenceSha256}:{}),actorId:input.actorId,occurredAt:input.destroyedAt});
      const row=database.prepare(`${copySelect} WHERE c.id=?`).get(input.id) as Record<string,unknown>|undefined;
      return row?mapCopy(row):null;
    });
  }
  listEvidenceIssuers(context:RepositoryExecutionContext,limit:number):RepositoryResult<readonly ExternalBackupEvidenceIssuerView[]>{
    return this.execute(context,()=> (this.database(context).prepare(`SELECT * FROM external_backup_evidence_issuers ORDER BY CASE status WHEN 'trusted' THEN 0 ELSE 1 END,label,id LIMIT ?`).all(limit) as Record<string,unknown>[]).map(mapIssuer));
  }
  findEvidenceIssuer(context:RepositoryExecutionContext,id:string):RepositoryResult<ExternalBackupEvidenceIssuerView|null>{
    return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT * FROM external_backup_evidence_issuers WHERE id=?`).get(id) as Record<string,unknown>|undefined;return row?mapIssuer(row):null;});
  }
  findEvidenceIssuerByFingerprint(context:RepositoryExecutionContext,fingerprintSha256:string):RepositoryResult<ExternalBackupEvidenceIssuerView|null>{
    return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT * FROM external_backup_evidence_issuers WHERE fingerprint_sha256=?`).get(fingerprintSha256) as Record<string,unknown>|undefined;return row?mapIssuer(row):null;});
  }
  listEvidenceIssuerRotations(context:RepositoryExecutionContext,limit:number):RepositoryResult<readonly ExternalBackupEvidenceIssuerRotationView[]>{
    return this.execute(context,()=>{const rows=this.database(context).prepare(`SELECT r.*,p.label AS predecessor_label,s.label AS successor_label FROM external_backup_evidence_issuer_rotations r JOIN external_backup_evidence_issuers p ON p.id=r.predecessor_issuer_id JOIN external_backup_evidence_issuers s ON s.id=r.successor_issuer_id ORDER BY r.effective_at DESC,r.id LIMIT ?`).all(limit) as Record<string,unknown>[];return rows.map(mapRotation);});
  }
  findEvidenceIssuerRotationByReceipt(context:RepositoryExecutionContext,predecessorIssuerId:string,receiptId:string):RepositoryResult<ExternalBackupEvidenceIssuerRotationView|null>{
    return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT r.*,p.label AS predecessor_label,s.label AS successor_label FROM external_backup_evidence_issuer_rotations r JOIN external_backup_evidence_issuers p ON p.id=r.predecessor_issuer_id JOIN external_backup_evidence_issuers s ON s.id=r.successor_issuer_id WHERE r.predecessor_issuer_id=? AND r.receipt_id=?`).get(predecessorIssuerId,receiptId) as Record<string,unknown>|undefined;return row?mapRotation(row):null;});
  }
  insertEvidenceIssuer(context:RepositoryExecutionContext,row:InsertExternalBackupEvidenceIssuerRow):RepositoryResult<ExternalBackupEvidenceIssuerView>{
    return this.execute(context,()=>{
      const database=this.database(context);
      database.prepare(`INSERT INTO external_backup_evidence_issuers(id,label,algorithm,public_key_pem,fingerprint_sha256,status,valid_from,valid_until,predecessor_issuer_id,rotation_sequence,rotation_receipt_id,rotation_verified_at,verification_method,legal_entity_name,identity_evidence_reference,key_fingerprint_evidence_reference,verification_witness_name,verification_witness_organization,verification_checked_at,verification_receipt_sha256,added_by,added_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(row.id,row.label,row.algorithm,row.publicKeyPem,row.fingerprintSha256,row.status,row.validFrom,row.validUntil??null,row.predecessorIssuerId??null,row.rotationSequence,row.rotationReceiptId??null,row.rotationVerifiedAt??null,row.verificationMethod,row.legalEntityName??null,row.identityEvidenceReference??null,row.keyFingerprintEvidenceReference??null,row.verificationWitnessName??null,row.verificationWitnessOrganization??null,row.verificationCheckedAt??null,row.verificationReceiptSha256??null,row.addedBy,row.addedAt,row.updatedAt);
      database.prepare(`INSERT INTO external_backup_evidence_issuer_events(id,issuer_id,action,occurred_at,actor_id) VALUES(?,?,?,?,?)`)
        .run(`registered:${row.id}`.slice(0,160),row.id,'registered',row.addedAt,row.addedBy);
      const inserted=database.prepare(`SELECT * FROM external_backup_evidence_issuers WHERE id=?`).get(row.id) as Record<string,unknown>;
      return mapIssuer(inserted);
    });
  }
  rotateEvidenceIssuer(context:RepositoryExecutionContext,input:{readonly expectedPredecessorUpdatedAt:string;readonly successor:InsertExternalBackupEvidenceIssuerRow;readonly rotation:InsertExternalBackupEvidenceIssuerRotationRow;readonly eventIds:{readonly predecessor:string;readonly successor:string}}):RepositoryResult<{readonly predecessor:ExternalBackupEvidenceIssuerView;readonly successor:ExternalBackupEvidenceIssuerView;readonly rotation:ExternalBackupEvidenceIssuerRotationView}|null>{
    return this.execute(context,()=>{
      const database=this.database(context);
      const predecessorUpdate=database.prepare(`UPDATE external_backup_evidence_issuers SET valid_until=?,updated_at=? WHERE id=? AND status='trusted' AND valid_until IS NULL AND updated_at=?`)
        .run(input.rotation.effectiveAt,input.rotation.verifiedAt,input.rotation.predecessorIssuerId,input.expectedPredecessorUpdatedAt) as {changes?:number};
      if(Number(predecessorUpdate.changes??0)!==1)return null;
      database.prepare(`INSERT INTO external_backup_evidence_issuers(id,label,algorithm,public_key_pem,fingerprint_sha256,status,valid_from,valid_until,predecessor_issuer_id,rotation_sequence,rotation_receipt_id,rotation_verified_at,verification_method,legal_entity_name,identity_evidence_reference,key_fingerprint_evidence_reference,verification_witness_name,verification_witness_organization,verification_checked_at,verification_receipt_sha256,added_by,added_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(input.successor.id,input.successor.label,input.successor.algorithm,input.successor.publicKeyPem,input.successor.fingerprintSha256,input.successor.status,input.successor.validFrom,input.successor.validUntil??null,input.successor.predecessorIssuerId??null,input.successor.rotationSequence,input.successor.rotationReceiptId??null,input.successor.rotationVerifiedAt??null,input.successor.verificationMethod,input.successor.legalEntityName??null,input.successor.identityEvidenceReference??null,input.successor.keyFingerprintEvidenceReference??null,input.successor.verificationWitnessName??null,input.successor.verificationWitnessOrganization??null,input.successor.verificationCheckedAt??null,input.successor.verificationReceiptSha256??null,input.successor.addedBy,input.successor.addedAt,input.successor.updatedAt);
      database.prepare(`INSERT INTO external_backup_evidence_issuer_rotations(id,predecessor_issuer_id,successor_issuer_id,receipt_id,schema_version,successor_fingerprint_sha256,effective_at,signature_base64,canonical_payload_json,verified_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(input.rotation.id,input.rotation.predecessorIssuerId,input.rotation.successorIssuerId,input.rotation.receiptId,input.rotation.schemaVersion,input.rotation.successorFingerprintSha256,input.rotation.effectiveAt,input.rotation.signatureBase64,input.rotation.canonicalPayloadJson,input.rotation.verifiedAt,input.rotation.createdBy,input.rotation.createdAt);
      database.prepare(`INSERT INTO external_backup_evidence_issuer_events(id,issuer_id,action,related_issuer_id,occurred_at,actor_id) VALUES(?,?,?,?,?,?)`)
        .run(input.eventIds.predecessor,input.rotation.predecessorIssuerId,'rotated_out',input.rotation.successorIssuerId,input.rotation.verifiedAt,input.rotation.createdBy);
      database.prepare(`INSERT INTO external_backup_evidence_issuer_events(id,issuer_id,action,related_issuer_id,occurred_at,actor_id) VALUES(?,?,?,?,?,?)`)
        .run(input.eventIds.successor,input.rotation.successorIssuerId,'rotated_in',input.rotation.predecessorIssuerId,input.rotation.verifiedAt,input.rotation.createdBy);
      const predecessorRow=database.prepare(`SELECT * FROM external_backup_evidence_issuers WHERE id=?`).get(input.rotation.predecessorIssuerId) as Record<string,unknown>;
      const successorRow=database.prepare(`SELECT * FROM external_backup_evidence_issuers WHERE id=?`).get(input.rotation.successorIssuerId) as Record<string,unknown>;
      const rotationRow=database.prepare(`SELECT r.*,p.label AS predecessor_label,s.label AS successor_label FROM external_backup_evidence_issuer_rotations r JOIN external_backup_evidence_issuers p ON p.id=r.predecessor_issuer_id JOIN external_backup_evidence_issuers s ON s.id=r.successor_issuer_id WHERE r.id=?`).get(input.rotation.id) as Record<string,unknown>;
      return {predecessor:mapIssuer(predecessorRow),successor:mapIssuer(successorRow),rotation:mapRotation(rotationRow)};
    });
  }
  revokeEvidenceIssuer(context:RepositoryExecutionContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly reason:string;readonly revokedBy:string;readonly revokedAt:string}):RepositoryResult<ExternalBackupEvidenceIssuerView|null>{
    return this.execute(context,()=>{
      const database=this.database(context);
      const result=database.prepare(`UPDATE external_backup_evidence_issuers SET status='revoked',revoked_by=?,revoked_at=?,revocation_reason=?,updated_at=? WHERE id=? AND status='trusted' AND updated_at=?`)
        .run(input.revokedBy,input.revokedAt,input.reason,input.revokedAt,input.id,input.expectedUpdatedAt) as {changes?:number};
      if(Number(result.changes??0)!==1)return null;
      database.prepare(`INSERT INTO external_backup_evidence_issuer_events(id,issuer_id,action,reason,occurred_at,actor_id) VALUES(?,?,?,?,?,?)`)
        .run(`revoked:${input.id}:${input.revokedAt}`.slice(0,160),input.id,'revoked',input.reason,input.revokedAt,input.revokedBy);
      database.prepare(`UPDATE external_backup_destruction_evidence SET verification_status='revoked',failure_reason=?,updated_at=? WHERE issuer_id=? AND verification_status='verified' AND issued_at>=?`)
        .run(`Makbuz düzenlenme tarihinde sağlayıcı güveni geçerli değildi: ${input.reason}`,input.revokedAt,input.id,input.revokedAt);
      database.prepare(`UPDATE external_backup_copies SET evidence_verification_status='revoked',updated_at=? WHERE verified_evidence_id IN (SELECT id FROM external_backup_destruction_evidence WHERE issuer_id=? AND verification_status='revoked')`)
        .run(input.revokedAt,input.id);
      const row=database.prepare(`SELECT * FROM external_backup_evidence_issuers WHERE id=?`).get(input.id) as Record<string,unknown>|undefined;
      return row?mapIssuer(row):null;
    });
  }
  listEvidenceRevocationLists(context:RepositoryExecutionContext,limit:number):RepositoryResult<readonly ExternalBackupEvidenceRevocationListView[]>{
    return this.execute(context,()=>{const database=this.database(context);const rows=database.prepare(`SELECT l.*,i.label AS signer_label FROM external_backup_evidence_revocation_lists l JOIN external_backup_evidence_issuers i ON i.id=l.signer_issuer_id ORDER BY l.sequence_number DESC,l.verified_at DESC LIMIT ?`).all(limit) as Record<string,unknown>[];return rows.map(row=>mapRevocationList(database,row));});
  }
  findLatestEvidenceRevocationList(context:RepositoryExecutionContext,authorityRootIssuerId:string):RepositoryResult<ExternalBackupEvidenceRevocationListView|null>{
    return this.execute(context,()=>{const database=this.database(context);const row=database.prepare(`SELECT l.*,i.label AS signer_label FROM external_backup_evidence_revocation_lists l JOIN external_backup_evidence_issuers i ON i.id=l.signer_issuer_id WHERE l.authority_root_issuer_id=? ORDER BY l.sequence_number DESC LIMIT 1`).get(authorityRootIssuerId) as Record<string,unknown>|undefined;return row?mapRevocationList(database,row):null;});
  }
  findEvidenceRevocationListByListId(context:RepositoryExecutionContext,authorityRootIssuerId:string,listId:string):RepositoryResult<ExternalBackupEvidenceRevocationListView|null>{
    return this.execute(context,()=>{const database=this.database(context);const row=database.prepare(`SELECT l.*,i.label AS signer_label FROM external_backup_evidence_revocation_lists l JOIN external_backup_evidence_issuers i ON i.id=l.signer_issuer_id WHERE l.authority_root_issuer_id=? AND l.list_id=?`).get(authorityRootIssuerId,listId) as Record<string,unknown>|undefined;return row?mapRevocationList(database,row):null;});
  }
  applyEvidenceRevocationList(context:RepositoryExecutionContext,input:{readonly list:InsertExternalBackupEvidenceRevocationListRow;readonly entries:readonly InsertExternalBackupEvidenceRevocationEntryRow[];readonly issuerUpdates:readonly {readonly issuerId:string;readonly expectedUpdatedAt:string;readonly revokedAt:string;readonly reason:string}[]}):RepositoryResult<ExternalBackupEvidenceRevocationListView|null>{
    return this.execute(context,()=>{
      const database=this.database(context);
      const latest=database.prepare(`SELECT sequence_number FROM external_backup_evidence_revocation_lists WHERE authority_root_issuer_id=? ORDER BY sequence_number DESC LIMIT 1`).get(input.list.authorityRootIssuerId) as {sequence_number?:number}|undefined;
      if(Number(latest?.sequence_number??0)>=input.list.sequenceNumber)return null;
      const duplicate=database.prepare(`SELECT 1 FROM external_backup_evidence_revocation_lists WHERE authority_root_issuer_id=? AND list_id=?`).get(input.list.authorityRootIssuerId,input.list.listId);
      if(duplicate)return null;
      for(const update of input.issuerUpdates){const current=database.prepare(`SELECT updated_at,status FROM external_backup_evidence_issuers WHERE id=?`).get(update.issuerId) as {updated_at?:string;status?:string}|undefined;if(!current||current.status!=='trusted'||current.updated_at!==update.expectedUpdatedAt)return null;}
      database.prepare(`UPDATE external_backup_evidence_revocation_lists SET status='superseded' WHERE authority_root_issuer_id=? AND status='current'`).run(input.list.authorityRootIssuerId);
      database.prepare(`INSERT INTO external_backup_evidence_revocation_lists(id,authority_root_issuer_id,signer_issuer_id,list_id,sequence_number,schema_version,this_update,next_update,payload_sha256,signature_base64,canonical_payload_json,source_url,status,verified_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(input.list.id,input.list.authorityRootIssuerId,input.list.signerIssuerId,input.list.listId,input.list.sequenceNumber,input.list.schemaVersion,input.list.thisUpdate,input.list.nextUpdate,input.list.payloadSha256,input.list.signatureBase64,input.list.canonicalPayloadJson,input.list.sourceUrl??null,input.list.status,input.list.verifiedAt,input.list.createdBy,input.list.createdAt);
      for(const entry of input.entries)database.prepare(`INSERT INTO external_backup_evidence_revocation_entries(id,list_row_id,issuer_id,fingerprint_sha256,revoked_at,reason) VALUES(?,?,?,?,?,?)`).run(entry.id,entry.listRowId,entry.issuerId,entry.fingerprintSha256,entry.revokedAt,entry.reason);
      for(const update of input.issuerUpdates){
        database.prepare(`UPDATE external_backup_evidence_issuers SET status='revoked',revoked_by=?,revoked_at=?,revocation_reason=?,revocation_source='signed_list',revocation_list_id=?,updated_at=? WHERE id=? AND status='trusted' AND updated_at=?`).run(input.list.createdBy,update.revokedAt,update.reason,input.list.id,input.list.verifiedAt,update.issuerId,update.expectedUpdatedAt);
        database.prepare(`INSERT INTO external_backup_evidence_issuer_events(id,issuer_id,action,reason,occurred_at,actor_id) VALUES(?,?,?,?,?,?)`).run(`revocation-list:${input.list.id}:${update.issuerId}`.slice(0,160),update.issuerId,'revoked',update.reason,update.revokedAt,input.list.createdBy);
        database.prepare(`UPDATE external_backup_destruction_evidence SET verification_status='revoked',failure_reason=?,updated_at=? WHERE issuer_id=? AND verification_status='verified' AND issued_at>=?`).run(`İmzalı iptal listesi: ${update.reason}`,input.list.verifiedAt,update.issuerId,update.revokedAt);
        database.prepare(`UPDATE external_backup_copies SET evidence_verification_status='revoked',updated_at=? WHERE verified_evidence_id IN (SELECT id FROM external_backup_destruction_evidence WHERE issuer_id=? AND verification_status='revoked')`).run(input.list.verifiedAt,update.issuerId);
      }
      const row=database.prepare(`SELECT l.*,i.label AS signer_label FROM external_backup_evidence_revocation_lists l JOIN external_backup_evidence_issuers i ON i.id=l.signer_issuer_id WHERE l.id=?`).get(input.list.id) as Record<string,unknown>;
      return mapRevocationList(database,row);
    });
  }
  listRevocationEndpoints(context:RepositoryExecutionContext,limit:number):RepositoryResult<readonly ExternalBackupRevocationEndpointView[]>{
    return this.execute(context,()=> (this.database(context).prepare(`SELECT e.*,i.label AS issuer_label FROM external_backup_revocation_endpoints e JOIN external_backup_evidence_issuers i ON i.id=e.issuer_id ORDER BY CASE e.status WHEN 'active' THEN 0 ELSE 1 END,i.label,e.id LIMIT ?`).all(limit) as Record<string,unknown>[]).map(mapRevocationEndpoint));
  }
  findRevocationEndpoint(context:RepositoryExecutionContext,id:string):RepositoryResult<ExternalBackupRevocationEndpointView|null>{
    return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT e.*,i.label AS issuer_label FROM external_backup_revocation_endpoints e JOIN external_backup_evidence_issuers i ON i.id=e.issuer_id WHERE e.id=?`).get(id) as Record<string,unknown>|undefined;return row?mapRevocationEndpoint(row):null;});
  }
  findRevocationEndpointByIssuer(context:RepositoryExecutionContext,issuerId:string):RepositoryResult<ExternalBackupRevocationEndpointView|null>{
    return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT e.*,i.label AS issuer_label FROM external_backup_revocation_endpoints e JOIN external_backup_evidence_issuers i ON i.id=e.issuer_id WHERE e.issuer_id=?`).get(issuerId) as Record<string,unknown>|undefined;return row?mapRevocationEndpoint(row):null;});
  }
  upsertRevocationEndpoint(context:RepositoryExecutionContext,row:UpsertExternalBackupRevocationEndpointRow,expectedUpdatedAt?:string):RepositoryResult<ExternalBackupRevocationEndpointView|null>{
    return this.execute(context,()=>{
      const database=this.database(context);
      const existing=database.prepare(`SELECT id,updated_at,created_by,created_at FROM external_backup_revocation_endpoints WHERE issuer_id=?`).get(row.issuerId) as {id?:string;updated_at?:string;created_by?:string;created_at?:string}|undefined;
      if(existing){
        if(expectedUpdatedAt&&existing.updated_at!==expectedUpdatedAt)return null;
        const updated=database.prepare(`UPDATE external_backup_revocation_endpoints SET source_url=?,primary_spki_sha256=?,secondary_spki_sha256=?,secondary_valid_from=?,primary_valid_until=?,status=?,updated_at=? WHERE issuer_id=? AND updated_at=?`).run(row.sourceUrl,row.primarySpkiSha256,row.secondarySpkiSha256??null,row.secondaryValidFrom??null,row.primaryValidUntil??null,row.status,row.updatedAt,row.issuerId,existing.updated_at) as {changes?:number};
        if(Number(updated.changes??0)!==1)return null;
      }else{
        database.prepare(`INSERT INTO external_backup_revocation_endpoints(id,issuer_id,source_url,primary_spki_sha256,secondary_spki_sha256,secondary_valid_from,primary_valid_until,status,last_fetch_status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.issuerId,row.sourceUrl,row.primarySpkiSha256,row.secondarySpkiSha256??null,row.secondaryValidFrom??null,row.primaryValidUntil??null,row.status,'never',row.createdBy,row.createdAt,row.updatedAt);
      }
      const result=database.prepare(`SELECT e.*,i.label AS issuer_label FROM external_backup_revocation_endpoints e JOIN external_backup_evidence_issuers i ON i.id=e.issuer_id WHERE e.issuer_id=?`).get(row.issuerId) as Record<string,unknown>;
      return mapRevocationEndpoint(result);
    });
  }
  recordRevocationEndpointFetch(context:RepositoryExecutionContext,input:{readonly id:string;readonly fetchedAt:string;readonly status:'success'|'failed';readonly error?:string}):RepositoryResult<ExternalBackupRevocationEndpointView|null>{
    return this.execute(context,()=>{const database=this.database(context);const updated=database.prepare(`UPDATE external_backup_revocation_endpoints SET last_fetch_status=?,last_fetched_at=?,last_fetch_error=?,updated_at=? WHERE id=?`).run(input.status,input.fetchedAt,input.error??null,input.fetchedAt,input.id) as {changes?:number};if(Number(updated.changes??0)!==1)return null;const row=database.prepare(`SELECT e.*,i.label AS issuer_label FROM external_backup_revocation_endpoints e JOIN external_backup_evidence_issuers i ON i.id=e.issuer_id WHERE e.id=?`).get(input.id) as Record<string,unknown>;return mapRevocationEndpoint(row);});
  }
  listDestructionEvidence(context:RepositoryExecutionContext,copyId:string|undefined,limit:number):RepositoryResult<readonly ExternalBackupDestructionEvidenceView[]>{
    return this.execute(context,()=>{
      const database=this.database(context);
      const base=`SELECT e.*,i.label AS issuer_label FROM external_backup_destruction_evidence e JOIN external_backup_evidence_issuers i ON i.id=e.issuer_id`;
      const rows=(copyId
        ? database.prepare(`${base} WHERE e.copy_id=? ORDER BY e.verified_at DESC,e.id LIMIT ?`).all(copyId,limit)
        : database.prepare(`${base} ORDER BY e.verified_at DESC,e.id LIMIT ?`).all(limit)) as Record<string,unknown>[];
      return rows.map(mapEvidence);
    });
  }
  findDestructionEvidenceByReceipt(context:RepositoryExecutionContext,issuerId:string,receiptId:string):RepositoryResult<ExternalBackupDestructionEvidenceView|null>{
    return this.execute(context,()=>{
      const row=this.database(context).prepare(`SELECT e.*,i.label AS issuer_label FROM external_backup_destruction_evidence e JOIN external_backup_evidence_issuers i ON i.id=e.issuer_id WHERE e.issuer_id=? AND e.receipt_id=?`).get(issuerId,receiptId) as Record<string,unknown>|undefined;
      return row?mapEvidence(row):null;
    });
  }
  insertVerifiedDestructionEvidence(context:RepositoryExecutionContext,input:{readonly expectedCopyUpdatedAt:string;readonly evidence:InsertExternalBackupDestructionEvidenceRow}):RepositoryResult<{readonly copy:ExternalBackupCopyView;readonly evidence:ExternalBackupDestructionEvidenceView}|null>{
    return this.execute(context,()=>{
      const database=this.database(context);
      const issuer=database.prepare(`SELECT status,valid_from,valid_until,revoked_at,added_at FROM external_backup_evidence_issuers WHERE id=?`).get(input.evidence.issuerId) as {status?:string;valid_from?:string;valid_until?:string;revoked_at?:string;added_at?:string}|undefined;
      const issuedAt=Date.parse(input.evidence.issuedAt),validFrom=Date.parse(String(issuer?.valid_from??issuer?.added_at??'')),validUntil=issuer?.valid_until?Date.parse(issuer.valid_until):Number.POSITIVE_INFINITY,revokedAt=issuer?.revoked_at?Date.parse(issuer.revoked_at):Number.POSITIVE_INFINITY;
      if(!issuer||!Number.isFinite(issuedAt)||!Number.isFinite(validFrom)||issuedAt<validFrom||issuedAt>=validUntil||issuedAt>=revokedAt)return null;
      const update=database.prepare(`UPDATE external_backup_copies SET status='destroyed',contains_historical_data_risk=0,evidence_sha256=?,evidence_verification_status='verified',verified_evidence_id=?,destroyed_at=COALESCE(destroyed_at,?),updated_at=? WHERE id=? AND legal_hold=0 AND updated_at=?`)
        .run(input.evidence.evidenceSha256,input.evidence.id,input.evidence.issuedAt,input.evidence.verifiedAt,input.evidence.copyId,input.expectedCopyUpdatedAt) as {changes?:number};
      if(Number(update.changes??0)!==1)return null;
      database.prepare(`INSERT INTO external_backup_destruction_evidence(id,copy_id,issuer_id,receipt_id,schema_version,evidence_sha256,signature_base64,canonical_payload_json,issued_at,verification_status,verified_at,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(input.evidence.id,input.evidence.copyId,input.evidence.issuerId,input.evidence.receiptId,input.evidence.schemaVersion,input.evidence.evidenceSha256,input.evidence.signatureBase64,input.evidence.canonicalPayloadJson,input.evidence.issuedAt,input.evidence.verificationStatus,input.evidence.verifiedAt,input.evidence.createdBy,input.evidence.createdAt,input.evidence.updatedAt);
      const copyRow=database.prepare(`${copySelect} WHERE c.id=?`).get(input.evidence.copyId) as Record<string,unknown>;
      const evidenceRow=database.prepare(`SELECT e.*,i.label AS issuer_label FROM external_backup_destruction_evidence e JOIN external_backup_evidence_issuers i ON i.id=e.issuer_id WHERE e.id=?`).get(input.evidence.id) as Record<string,unknown>;
      return {copy:mapCopy(copyRow),evidence:mapEvidence(evidenceRow)};
    });
  }
}
