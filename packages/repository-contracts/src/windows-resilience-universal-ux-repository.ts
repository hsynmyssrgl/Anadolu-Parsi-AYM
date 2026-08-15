import type { FamilyId,PersonId } from '@ppt/core';import type { PolicyWeakeningProposalInput,UniversalUxPreferencesView,WindowsResilienceEvidenceView } from '@ppt/domain';
import type { RepositoryExecutionContext,RepositoryResult } from './repository-context.js';
export interface WindowsResilienceUniversalUxKey{readonly familyId:FamilyId;readonly ownerPersonId:PersonId;}
export interface UniversalUxOperationRow{readonly clientOperationId:string;readonly familyId:FamilyId;readonly ownerPersonId:PersonId;
  readonly operationKind:'preferences_update'|'policy_weakening_record'|'resilience_evidence_record';readonly requestFingerprint:string;readonly resultId:string;}
export interface PolicyWeakeningProposalRow extends PolicyWeakeningProposalInput{readonly familyId:FamilyId;readonly ownerPersonId:PersonId;
  readonly accepted:boolean;readonly recordedAt:string;}
export interface WindowsResilienceEvidenceRow extends WindowsResilienceEvidenceView{readonly id:string;readonly familyId:FamilyId;
  readonly ownerPersonId:PersonId;readonly recordedAt:string;}
export interface WindowsResilienceUniversalUxRepositoryPort{
  loadPreferences(context:RepositoryExecutionContext,key:WindowsResilienceUniversalUxKey):RepositoryResult<UniversalUxPreferencesView|null>;
  findOperation(context:RepositoryExecutionContext,key:WindowsResilienceUniversalUxKey,clientOperationId:string):RepositoryResult<UniversalUxOperationRow|null>;
  savePreferences(context:RepositoryExecutionContext,key:WindowsResilienceUniversalUxKey,preferences:UniversalUxPreferencesView,
    operation:UniversalUxOperationRow,expectedRevision:number):RepositoryResult<void>;
  appendPolicyProposal(context:RepositoryExecutionContext,key:WindowsResilienceUniversalUxKey,proposal:PolicyWeakeningProposalRow,
    operation:UniversalUxOperationRow):RepositoryResult<void>;
  appendResilienceEvidence(context:RepositoryExecutionContext,key:WindowsResilienceUniversalUxKey,evidence:WindowsResilienceEvidenceRow,
    operation:UniversalUxOperationRow):RepositoryResult<void>;
}
