import type { PolicyDecisionAuditBoundaryView } from '@ppt/domain';
import { ImmutablePolicyDecisionAuditPolicy } from '@ppt/platform-policy';

const SHA256 = /^[0-9a-f]{64}$/u;

export interface PolicyDecisionAuditJournalInspection {
  readonly valid: boolean;
  readonly entryCount: number;
  readonly auditedEntryCount: number;
  readonly legacyReceiptEntryCount: number;
  readonly headHash: string;
  readonly latestAuditHash?: string;
}

export interface PolicyDecisionAuditInspectionPort {
  inspect(): PolicyDecisionAuditJournalInspection;
}

export class GetPolicyDecisionAuditBoundaryUseCase {
  public constructor(
    private readonly policy: ImmutablePolicyDecisionAuditPolicy,
    private readonly inspectionPort: PolicyDecisionAuditInspectionPort
  ) {}

  public execute(): PolicyDecisionAuditBoundaryView {
    const snapshot = this.policy.snapshot();
    const inspection = this.inspectionPort.inspect();
    if (
      !inspection.valid
      || !Number.isSafeInteger(inspection.entryCount) || inspection.entryCount < 0
      || !Number.isSafeInteger(inspection.auditedEntryCount) || inspection.auditedEntryCount < 0
      || !Number.isSafeInteger(inspection.legacyReceiptEntryCount) || inspection.legacyReceiptEntryCount < 0
      || inspection.auditedEntryCount + inspection.legacyReceiptEntryCount !== inspection.entryCount
      || !SHA256.test(inspection.headHash)
      || (inspection.latestAuditHash !== undefined && !SHA256.test(inspection.latestAuditHash))
    ) throw new Error('POLICY_DECISION_AUDIT_INSPECTION_FAILED');

    return Object.freeze({
      schemaVersion: 1,
      status: 'verified',
      enforcement: snapshot.enforcement,
      journalEntrySchemaVersion: snapshot.journalEntrySchemaVersion,
      protectedAuditEnvelopeSchemaVersion: snapshot.protectedAuditEnvelopeSchemaVersion,
      requiredFields: snapshot.requiredFields,
      allowedDecisionsRecorded: snapshot.allowedDecisionsRecorded,
      deniedDecisionsRecorded: snapshot.deniedDecisionsRecorded,
      denialReasonRequired: snapshot.denialReasonRequired,
      obligationsRecordedExactly: snapshot.obligationsRecordedExactly,
      appendOnly: snapshot.appendOnly,
      encryptedAtRest: snapshot.encryptedAtRest,
      hmacSha256Chained: snapshot.hmacSha256Chained,
      externalMonotonicCheckpointRequired: snapshot.externalMonotonicCheckpointRequired,
      payloadExposedToClient: snapshot.payloadExposedToClient,
      historicalBackfillPerformed: false,
      entryCount: inspection.entryCount,
      auditedEntryCount: inspection.auditedEntryCount,
      legacyReceiptEntryCount: inspection.legacyReceiptEntryCount,
      headHash: inspection.headHash,
      ...(inspection.latestAuditHash ? { latestAuditHash: inspection.latestAuditHash } : {})
    });
  }
}
