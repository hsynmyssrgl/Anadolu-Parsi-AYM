import type {
  ExternalBackupCopyKind,
  ExternalBackupCopyStatus,
  ExternalBackupCopyView,
  ExternalBackupDestructionEvidenceView,
  ExternalBackupEvidenceIssuerView,
  ExternalBackupEvidenceIssuerRotationView,
  ExternalBackupEvidenceRevocationListView,
  ExternalBackupRevocationEndpointView
} from '@ppt/domain';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface InsertExternalBackupCopyRow {
  readonly id:string;
  readonly label:string;
  readonly kind:ExternalBackupCopyKind;
  readonly locationHint:string;
  readonly custodian:string;
  readonly status:ExternalBackupCopyStatus;
  readonly containsHistoricalDataRisk:boolean;
  readonly reviewIntervalDays:number;
  readonly nextReviewAt:string;
  readonly legalHold:boolean;
  readonly createdAt:string;
  readonly updatedAt:string;
}
export interface ExternalBackupCopyAttestationRow {
  readonly id:string;
  readonly copyId:string;
  readonly action:'registered'|'reviewed'|'hold_enabled'|'hold_disabled'|'destroyed_attested';
  readonly note:string;
  readonly evidenceSha256?:string;
  readonly actorId:string;
  readonly occurredAt:string;
}

export interface InsertExternalBackupEvidenceIssuerRow {
  readonly id:string;
  readonly label:string;
  readonly algorithm:'ed25519';
  readonly publicKeyPem:string;
  readonly fingerprintSha256:string;
  readonly status:'trusted';
  readonly validFrom:string;
  readonly validUntil?:string;
  readonly predecessorIssuerId?:string;
  readonly rotationSequence:number;
  readonly rotationReceiptId?:string;
  readonly rotationVerifiedAt?:string;
  readonly verificationMethod:'legacy_unverified'|'out_of_band_dual_evidence'|'rotation_inherited';
  readonly legalEntityName?:string;
  readonly identityEvidenceReference?:string;
  readonly keyFingerprintEvidenceReference?:string;
  readonly verificationWitnessName?:string;
  readonly verificationWitnessOrganization?:string;
  readonly verificationCheckedAt?:string;
  readonly verificationReceiptSha256?:string;
  readonly addedBy:string;
  readonly addedAt:string;
  readonly updatedAt:string;
}

export interface InsertExternalBackupEvidenceIssuerRotationRow {
  readonly id:string;
  readonly predecessorIssuerId:string;
  readonly successorIssuerId:string;
  readonly receiptId:string;
  readonly schemaVersion:1;
  readonly successorFingerprintSha256:string;
  readonly effectiveAt:string;
  readonly signatureBase64:string;
  readonly canonicalPayloadJson:string;
  readonly verifiedAt:string;
  readonly createdBy:string;
  readonly createdAt:string;
}


export interface InsertExternalBackupEvidenceRevocationListRow {
  readonly id:string;
  readonly authorityRootIssuerId:string;
  readonly signerIssuerId:string;
  readonly listId:string;
  readonly sequenceNumber:number;
  readonly schemaVersion:1;
  readonly thisUpdate:string;
  readonly nextUpdate:string;
  readonly payloadSha256:string;
  readonly signatureBase64:string;
  readonly canonicalPayloadJson:string;
  readonly sourceUrl?:string;
  readonly status:'current';
  readonly verifiedAt:string;
  readonly createdBy:string;
  readonly createdAt:string;
}
export interface InsertExternalBackupEvidenceRevocationEntryRow {
  readonly id:string;
  readonly listRowId:string;
  readonly issuerId:string;
  readonly fingerprintSha256:string;
  readonly revokedAt:string;
  readonly reason:string;
}

export interface UpsertExternalBackupRevocationEndpointRow {
  readonly id:string;
  readonly issuerId:string;
  readonly sourceUrl:string;
  readonly primarySpkiSha256:string;
  readonly secondarySpkiSha256?:string;
  readonly secondaryValidFrom?:string;
  readonly primaryValidUntil?:string;
  readonly status:'active'|'disabled';
  readonly createdBy:string;
  readonly createdAt:string;
  readonly updatedAt:string;
}

export interface InsertExternalBackupDestructionEvidenceRow {
  readonly id:string;
  readonly copyId:string;
  readonly issuerId:string;
  readonly receiptId:string;
  readonly schemaVersion:1;
  readonly evidenceSha256:string;
  readonly signatureBase64:string;
  readonly canonicalPayloadJson:string;
  readonly issuedAt:string;
  readonly verificationStatus:'verified';
  readonly verifiedAt:string;
  readonly createdBy:string;
  readonly createdAt:string;
  readonly updatedAt:string;
}

export interface ExternalBackupInventoryRepositoryPort {
  listCopies(context:RepositoryExecutionContext,limit:number):RepositoryResult<readonly ExternalBackupCopyView[]>;
  findCopy(context:RepositoryExecutionContext,id:string):RepositoryResult<ExternalBackupCopyView|null>;
  insertCopy(context:RepositoryExecutionContext,row:InsertExternalBackupCopyRow,attestation:ExternalBackupCopyAttestationRow):RepositoryResult<void>;
  reviewCopy(context:RepositoryExecutionContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly status:'active'|'unreachable'|'retired';readonly containsHistoricalDataRisk:boolean;readonly reviewIntervalDays:number;readonly note:string;readonly reviewedAt:string;readonly nextReviewAt:string;readonly actorId:string;readonly attestationId:string}):RepositoryResult<ExternalBackupCopyView|null>;
  setLegalHold(context:RepositoryExecutionContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly enabled:boolean;readonly reason?:string;readonly updatedAt:string;readonly actorId:string;readonly attestationId:string}):RepositoryResult<ExternalBackupCopyView|null>;
  attestDestroyed(context:RepositoryExecutionContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly note:string;readonly evidenceSha256?:string;readonly destroyedAt:string;readonly actorId:string;readonly attestationId:string}):RepositoryResult<ExternalBackupCopyView|null>;
  listEvidenceIssuers(context:RepositoryExecutionContext,limit:number):RepositoryResult<readonly ExternalBackupEvidenceIssuerView[]>;
  findEvidenceIssuer(context:RepositoryExecutionContext,id:string):RepositoryResult<ExternalBackupEvidenceIssuerView|null>;
  findEvidenceIssuerByFingerprint(context:RepositoryExecutionContext,fingerprintSha256:string):RepositoryResult<ExternalBackupEvidenceIssuerView|null>;
  listEvidenceIssuerRotations(context:RepositoryExecutionContext,limit:number):RepositoryResult<readonly ExternalBackupEvidenceIssuerRotationView[]>;
  findEvidenceIssuerRotationByReceipt(context:RepositoryExecutionContext,predecessorIssuerId:string,receiptId:string):RepositoryResult<ExternalBackupEvidenceIssuerRotationView|null>;
  insertEvidenceIssuer(context:RepositoryExecutionContext,row:InsertExternalBackupEvidenceIssuerRow):RepositoryResult<ExternalBackupEvidenceIssuerView>;
  rotateEvidenceIssuer(context:RepositoryExecutionContext,input:{readonly expectedPredecessorUpdatedAt:string;readonly successor:InsertExternalBackupEvidenceIssuerRow;readonly rotation:InsertExternalBackupEvidenceIssuerRotationRow;readonly eventIds:{readonly predecessor:string;readonly successor:string}}):RepositoryResult<{readonly predecessor:ExternalBackupEvidenceIssuerView;readonly successor:ExternalBackupEvidenceIssuerView;readonly rotation:ExternalBackupEvidenceIssuerRotationView}|null>;
  revokeEvidenceIssuer(context:RepositoryExecutionContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly reason:string;readonly revokedBy:string;readonly revokedAt:string}):RepositoryResult<ExternalBackupEvidenceIssuerView|null>;
  listEvidenceRevocationLists(context:RepositoryExecutionContext,limit:number):RepositoryResult<readonly ExternalBackupEvidenceRevocationListView[]>;
  findLatestEvidenceRevocationList(context:RepositoryExecutionContext,authorityRootIssuerId:string):RepositoryResult<ExternalBackupEvidenceRevocationListView|null>;
  findEvidenceRevocationListByListId(context:RepositoryExecutionContext,authorityRootIssuerId:string,listId:string):RepositoryResult<ExternalBackupEvidenceRevocationListView|null>;
  applyEvidenceRevocationList(context:RepositoryExecutionContext,input:{readonly list:InsertExternalBackupEvidenceRevocationListRow;readonly entries:readonly InsertExternalBackupEvidenceRevocationEntryRow[];readonly issuerUpdates:readonly {readonly issuerId:string;readonly expectedUpdatedAt:string;readonly revokedAt:string;readonly reason:string}[]}):RepositoryResult<ExternalBackupEvidenceRevocationListView|null>;
  listRevocationEndpoints(context:RepositoryExecutionContext,limit:number):RepositoryResult<readonly ExternalBackupRevocationEndpointView[]>;
  findRevocationEndpoint(context:RepositoryExecutionContext,id:string):RepositoryResult<ExternalBackupRevocationEndpointView|null>;
  findRevocationEndpointByIssuer(context:RepositoryExecutionContext,issuerId:string):RepositoryResult<ExternalBackupRevocationEndpointView|null>;
  upsertRevocationEndpoint(context:RepositoryExecutionContext,row:UpsertExternalBackupRevocationEndpointRow,expectedUpdatedAt?:string):RepositoryResult<ExternalBackupRevocationEndpointView|null>;
  recordRevocationEndpointFetch(context:RepositoryExecutionContext,input:{readonly id:string;readonly fetchedAt:string;readonly status:'success'|'failed';readonly error?:string}):RepositoryResult<ExternalBackupRevocationEndpointView|null>;
  listDestructionEvidence(context:RepositoryExecutionContext,copyId:string|undefined,limit:number):RepositoryResult<readonly ExternalBackupDestructionEvidenceView[]>;
  findDestructionEvidenceByReceipt(context:RepositoryExecutionContext,issuerId:string,receiptId:string):RepositoryResult<ExternalBackupDestructionEvidenceView|null>;
  insertVerifiedDestructionEvidence(context:RepositoryExecutionContext,input:{readonly expectedCopyUpdatedAt:string;readonly evidence:InsertExternalBackupDestructionEvidenceRow}):RepositoryResult<{readonly copy:ExternalBackupCopyView;readonly evidence:ExternalBackupDestructionEvidenceView}|null>;
}
