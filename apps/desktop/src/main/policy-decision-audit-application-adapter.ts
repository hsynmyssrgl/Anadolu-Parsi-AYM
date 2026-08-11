import type { PolicyDecisionAuditInspectionPort, PolicyDecisionAuditJournalInspection } from '@ppt/application';
import type { PlatformPolicyReceiptFileSink } from './platform-policy-receipt-file-sink.js';

export class PlatformPolicyDecisionAuditInspectionAdapter implements PolicyDecisionAuditInspectionPort {
  public constructor(private readonly sink: PlatformPolicyReceiptFileSink) {}

  public inspect(): PolicyDecisionAuditJournalInspection {
    return this.sink.inspectDecisionAuditBoundary();
  }
}
