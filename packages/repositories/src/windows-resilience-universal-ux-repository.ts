import { asFamilyId,asPersonId } from '@ppt/core';import type { UniversalUxPreferencesView } from '@ppt/domain';
import type { PolicyWeakeningProposalRow,RepositoryExecutionContext,UniversalUxOperationRow,WindowsResilienceEvidenceRow,
  WindowsResilienceUniversalUxKey,WindowsResilienceUniversalUxRepositoryPort } from '@ppt/repository-contracts';import { SqliteRepository } from './sqlite-base.js';
const mapOperation=(row:Record<string,unknown>):UniversalUxOperationRow=>Object.freeze({clientOperationId:String(row.client_operation_id),
  familyId:asFamilyId(String(row.family_id)),ownerPersonId:asPersonId(String(row.owner_person_id)),
  operationKind:String(row.operation_kind) as UniversalUxOperationRow['operationKind'],requestFingerprint:String(row.request_fingerprint),resultId:String(row.result_id)});
export class SqliteWindowsResilienceUniversalUxRepository extends SqliteRepository implements WindowsResilienceUniversalUxRepositoryPort{
  public loadPreferences(context:RepositoryExecutionContext,key:WindowsResilienceUniversalUxKey){return this.execute(context,()=>{const row=this.database(context)
    .prepare('SELECT preferences_json FROM universal_ux_preferences WHERE family_id=? AND owner_person_id=?').get(key.familyId,key.ownerPersonId) as {preferences_json:string}|undefined;
    if(!row)return null;const value=JSON.parse(row.preferences_json) as UniversalUxPreferencesView;if(!value||!Number.isInteger(value.revision)||value.revision<1)
      throw new Error('Universal UX preferences are invalid');return Object.freeze(value);});}
  public findOperation(context:RepositoryExecutionContext,key:WindowsResilienceUniversalUxKey,clientOperationId:string){return this.execute(context,()=>{const row=this.database(context)
    .prepare(`SELECT client_operation_id,family_id,owner_person_id,operation_kind,request_fingerprint,result_id FROM universal_ux_operations
      WHERE family_id=? AND owner_person_id=? AND client_operation_id=?`).get(key.familyId,key.ownerPersonId,clientOperationId) as Record<string,unknown>|undefined;
    return row?mapOperation(row):null;});}
  #insertOperation(context:RepositoryExecutionContext,operation:UniversalUxOperationRow){this.database(context).prepare(`INSERT INTO universal_ux_operations(
    client_operation_id,family_id,owner_person_id,operation_kind,request_fingerprint,result_id) VALUES(?,?,?,?,?,?)`).run(operation.clientOperationId,
    operation.familyId,operation.ownerPersonId,operation.operationKind,operation.requestFingerprint,operation.resultId);}
  public savePreferences(context:RepositoryExecutionContext,key:WindowsResilienceUniversalUxKey,preferences:UniversalUxPreferencesView,
    operation:UniversalUxOperationRow,expectedRevision:number){return this.execute(context,()=>{this.#insertOperation(context,operation);const database=this.database(context);
    const json=JSON.stringify(preferences);if(expectedRevision===0){const result=database.prepare(`INSERT INTO universal_ux_preferences(family_id,owner_person_id,
      preferences_json,revision,last_operation_id,updated_at) VALUES(?,?,?,?,?,?)`).run(key.familyId,key.ownerPersonId,json,preferences.revision,
      operation.resultId,preferences.updatedAt);if(Number(result.changes)!==1)throw new Error('Universal UX preference insert failed');}else{const result=database.prepare(`UPDATE universal_ux_preferences
      SET preferences_json=?,revision=?,last_operation_id=?,updated_at=? WHERE family_id=? AND owner_person_id=? AND revision=?`).run(json,preferences.revision,
      operation.resultId,preferences.updatedAt,key.familyId,key.ownerPersonId,expectedRevision);if(Number(result.changes)!==1)throw new Error('Universal UX optimistic revision conflict');}});}
  public appendPolicyProposal(context:RepositoryExecutionContext,key:WindowsResilienceUniversalUxKey,proposal:PolicyWeakeningProposalRow,
    operation:UniversalUxOperationRow){return this.execute(context,()=>{this.#insertOperation(context,operation);this.database(context).prepare(`INSERT INTO policy_weakening_proposals(
      proposal_id,family_id,owner_person_id,current_policy_version,proposed_policy_version,explicit_user_decision_id,risk_analysis_sha256,
      rollback_plan_sha256,reason,accepted,recorded_at,operation_result_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(proposal.proposalId,key.familyId,
      key.ownerPersonId,proposal.currentPolicyVersion,proposal.proposedPolicyVersion,proposal.explicitUserDecisionId,proposal.riskAnalysisSha256,
      proposal.rollbackPlanSha256,proposal.reason,proposal.accepted?1:0,proposal.recordedAt,operation.resultId);});}
  public appendResilienceEvidence(context:RepositoryExecutionContext,key:WindowsResilienceUniversalUxKey,evidence:WindowsResilienceEvidenceRow,
    operation:UniversalUxOperationRow){return this.execute(context,()=>{this.#insertOperation(context,operation);this.database(context).prepare(`INSERT INTO windows_resilience_evidence(
      id,family_id,owner_person_id,evidence_json,requirements_closed,real_windows_soak,soak_hours,people_count,event_count,document_count,recorded_at,operation_result_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(evidence.id,key.familyId,key.ownerPersonId,JSON.stringify(evidence),evidence.requirementsClosed?1:0,
      evidence.realWindowsSoak?1:0,evidence.soakHours,evidence.peopleCount,evidence.eventCount,evidence.documentCount,evidence.recordedAt,operation.resultId);});}
}
