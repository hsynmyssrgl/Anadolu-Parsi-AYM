import type { FamilyId, PersonId, UserId } from '@ppt/core';
import type {
  PolicyWeakeningProposalInput,
  UniversalUxPreferencesView,
  WindowsResilienceEvidenceView
} from '@ppt/domain';
import type { PolicyAuthorizedRepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface WindowsResilienceUniversalUxKey {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
}

export interface UniversalUxOperationRow {
  readonly clientOperationId: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly actorAccountId: UserId;
  readonly actorPersonId: PersonId;
  readonly operationKind: 'preferences_update' | 'policy_weakening_record' | 'resilience_evidence_record';
  readonly requestFingerprint: string;
  readonly resultId: string;
  readonly policyResourceId: string;
  readonly occurredAt: string;
  readonly resultRequirementsClosed: boolean;
}

export interface PolicyWeakeningProposalRow extends PolicyWeakeningProposalInput {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly accepted: boolean;
  readonly decisionReason: string;
  readonly verificationProviderId: string;
  readonly verificationProviderProductionVerified: boolean;
  readonly verificationEvidenceSha256?: string;
  readonly networkUsed: boolean | null;
  readonly recordedAt: string;
}

export interface WindowsResilienceEvidenceRow extends WindowsResilienceEvidenceView {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly recordedAt: string;
}

export interface WindowsResilienceUniversalUxRepositoryPort {
  loadPreferences(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: WindowsResilienceUniversalUxKey
  ): RepositoryResult<UniversalUxPreferencesView | null>;
  findOperation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: WindowsResilienceUniversalUxKey,
    clientOperationId: string
  ): RepositoryResult<UniversalUxOperationRow | null>;
  savePreferences(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: WindowsResilienceUniversalUxKey,
    preferences: UniversalUxPreferencesView,
    operation: UniversalUxOperationRow,
    expectedRevision: number
  ): RepositoryResult<void>;
  appendPolicyProposal(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: WindowsResilienceUniversalUxKey,
    proposal: PolicyWeakeningProposalRow,
    operation: UniversalUxOperationRow
  ): RepositoryResult<void>;
  appendResilienceEvidence(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: WindowsResilienceUniversalUxKey,
    evidence: WindowsResilienceEvidenceRow,
    operation: UniversalUxOperationRow
  ): RepositoryResult<void>;
}
