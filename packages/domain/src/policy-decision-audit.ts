export interface PolicyDecisionAuditBoundaryView {
  readonly schemaVersion: 1;
  readonly status: 'verified';
  readonly enforcement: 'fail-closed';
  readonly journalEntrySchemaVersion: 2;
  readonly protectedAuditEnvelopeSchemaVersion: 1;
  readonly requiredFields: readonly string[];
  readonly allowedDecisionsRecorded: true;
  readonly deniedDecisionsRecorded: true;
  readonly denialReasonRequired: true;
  readonly obligationsRecordedExactly: true;
  readonly appendOnly: true;
  readonly encryptedAtRest: true;
  readonly hmacSha256Chained: true;
  readonly externalMonotonicCheckpointRequired: true;
  readonly payloadExposedToClient: false;
  readonly historicalBackfillPerformed: false;
  readonly entryCount: number;
  readonly auditedEntryCount: number;
  readonly legacyReceiptEntryCount: number;
  readonly headHash: string;
  readonly latestAuditHash?: string;
}
