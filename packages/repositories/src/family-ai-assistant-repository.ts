import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  FamilyAiAssistantKind,
  FamilyAiAssistantPurpose,
  FamilyAiAssistantSourceReferenceView,
  FamilyAiSuggestionMutationKind,
  FamilyAiSuggestionStatus
} from '@ppt/domain';
import { FAMILY_AI_ASSISTANT_MAX_SUGGESTIONS, FAMILY_AI_ASSISTANT_RESOURCE_TYPE_BY_MODULE } from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  canonicalFamilyAiAssistantSources,
  type FamilyAiAssistantCenterKey,
  type FamilyAiAssistantCenterSnapshotRow,
  type FamilyAiAssistantPolicyResourceRepositoryPort,
  type FamilyAiAssistantRepositoryPort,
  type FamilyAiSuggestionMutationRow,
  type FamilyAiSuggestionRow,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const suggestionSelect=`SELECT id,family_id,owner_person_id,kind,purpose,status,title,explanation,
  confidence_basis_points,sources_json,source_fingerprint,revision,state_fingerprint,last_mutation_id,
  created_at,updated_at,confirmed_at,dismissed_at FROM family_ai_suggestions`;
const mutationSelect=`SELECT id,family_id,owner_person_id,suggestion_id,actor_account_id,actor_person_id,
  mutation_kind,purpose,client_operation_id,request_fingerprint,expected_revision,revision,
  suggestion_state_fingerprint,source_fingerprint,source_count,occurred_at FROM family_ai_suggestion_mutations`;
const safeId=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{1,159}$/u.test(value);

const sources=(raw:unknown):readonly FamilyAiAssistantSourceReferenceView[]=>{
  const parsed=JSON.parse(String(raw)) as unknown;
  if(!Array.isArray(parsed)||parsed.length<1||parsed.length>24||parsed.some((value)=>!value||typeof value!=='object'
    ||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join(',')!=='module,resourceId,resourceType'
    ||typeof (value as Record<string,unknown>).module!=='string'
    ||typeof (value as Record<string,unknown>).resourceType!=='string'
    ||!safeId((value as Record<string,unknown>).resourceId)
    ||FAMILY_AI_ASSISTANT_RESOURCE_TYPE_BY_MODULE[(value as FamilyAiAssistantSourceReferenceView).module]
      !==(value as FamilyAiAssistantSourceReferenceView).resourceType))throw new Error('Family AI source ledger is invalid');
  return canonicalFamilyAiAssistantSources(parsed as FamilyAiAssistantSourceReferenceView[]);
};
const mapSuggestion=(row:Record<string,unknown>):FamilyAiSuggestionRow=>Object.freeze({
  id:String(row.id),familyId:asFamilyId(String(row.family_id)),ownerPersonId:asPersonId(String(row.owner_person_id)),
  kind:String(row.kind) as FamilyAiAssistantKind,purpose:String(row.purpose) as FamilyAiAssistantPurpose,
  status:String(row.status) as FamilyAiSuggestionStatus,title:String(row.title),explanation:String(row.explanation),
  confidenceBasisPoints:Number(row.confidence_basis_points),sources:sources(row.sources_json),
  sourceFingerprint:String(row.source_fingerprint),revision:Number(row.revision),stateFingerprint:String(row.state_fingerprint),
  lastMutationId:String(row.last_mutation_id),createdAt:asIsoDateTime(String(row.created_at)),
  updatedAt:asIsoDateTime(String(row.updated_at)),...(row.confirmed_at?{confirmedAt:asIsoDateTime(String(row.confirmed_at))}:{}),
  ...(row.dismissed_at?{dismissedAt:asIsoDateTime(String(row.dismissed_at))}:{})
});
const mapMutation=(row:Record<string,unknown>):FamilyAiSuggestionMutationRow=>Object.freeze({
  id:String(row.id),familyId:asFamilyId(String(row.family_id)),ownerPersonId:asPersonId(String(row.owner_person_id)),
  suggestionId:String(row.suggestion_id),actorAccountId:String(row.actor_account_id),actorPersonId:asPersonId(String(row.actor_person_id)),
  mutationKind:String(row.mutation_kind) as FamilyAiSuggestionMutationKind,purpose:String(row.purpose) as FamilyAiAssistantPurpose,
  clientOperationId:String(row.client_operation_id),requestFingerprint:String(row.request_fingerprint),
  expectedRevision:Number(row.expected_revision),revision:Number(row.revision),
  suggestionStateFingerprint:String(row.suggestion_state_fingerprint),sourceFingerprint:String(row.source_fingerprint),
  sourceCount:Number(row.source_count),occurredAt:asIsoDateTime(String(row.occurred_at))
});

const assertKey=(context:PolicyAuthorizedRepositoryExecutionContext,key:FamilyAiAssistantCenterKey,mode:'read'|'write',suggestionId?:string):void=>{
  assertPolicyAuthorizedRepositoryContext(context,{resourceType:mode==='read'?'family_ai_assistant_center':'family_ai_suggestion',
    resourceId:mode==='read'?'*':suggestionId!,action:context.policyAuthorization.action,
    capability:mode==='read'?'family.read':'family.write',correlationId:context.correlationId,resourceFamilyId:key.familyId});
  const authorization=context.policyAuthorization;
  if(authorization.purpose!=='general'||authorization.subject.accountId!==key.accountId
    ||authorization.subject.personId!==key.actorPersonId||key.actorPersonId!==key.ownerPersonId
    ||!authorization.subject.familyIds.includes(key.familyId)||authorization.resourceFamilyId!==key.familyId
    ||authorization.receiptRecord.request.resource.ownerPersonId!==key.ownerPersonId
    ||authorization.receiptRecord.request.resource.sensitivity!=='highly_sensitive'
    ||key.centerId!==`family-ai-assistant:${key.familyId}:${key.ownerPersonId}`
    ||(mode==='read'&&authorization.action!=='read')||(mode==='write'&&!['create','update'].includes(authorization.action)))
    throw new Error('Family AI repository key does not match the exact owner policy receipt');
};
const writeBinding=(context:PolicyAuthorizedRepositoryExecutionContext,row:FamilyAiSuggestionMutationRow)=>{
  const binding=platformPolicyPersistenceBinding(context,'family_ai_suggestion',row.suggestionId);
  if(!binding||binding.resourceFamilyId!==row.familyId||binding.purpose!=='general'||binding.capability!=='family.write'
    ||binding.occurredAt!==row.occurredAt)throw new Error('Family AI mutation requires an exact durable policy receipt');
  const action=row.mutationKind==='suggestion_generate'?'create':'update';
  if(binding.action!==action)throw new Error('Family AI mutation action does not match the receipt');
  return binding;
};

export class SqliteFamilyAiAssistantRepository extends SqliteRepository implements
  FamilyAiAssistantRepositoryPort,FamilyAiAssistantPolicyResourceRepositoryPort {
  public findSuggestionForPolicyResolution(context:RepositoryExecutionContext,suggestionId:string)
  :ReturnType<FamilyAiAssistantPolicyResourceRepositoryPort['findSuggestionForPolicyResolution']>{
    return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT id,family_id,owner_person_id,revision,status,state_fingerprint
      FROM family_ai_suggestions WHERE id=?`).get(suggestionId) as Record<string,unknown>|undefined;
      return row?Object.freeze({id:String(row.id),familyId:asFamilyId(String(row.family_id)),ownerPersonId:asPersonId(String(row.owner_person_id)),
        revision:Number(row.revision),status:String(row.status) as FamilyAiSuggestionStatus,stateFingerprint:String(row.state_fingerprint)}):null;});
  }
  public loadCenter(context:PolicyAuthorizedRepositoryExecutionContext,key:FamilyAiAssistantCenterKey)
  :RepositoryResult<FamilyAiAssistantCenterSnapshotRow>{
    assertKey(context,key,'read');return this.execute(context,()=>{const rows=this.database(context).prepare(
      `${suggestionSelect} WHERE family_id=? AND owner_person_id=? ORDER BY updated_at DESC,id LIMIT ${FAMILY_AI_ASSISTANT_MAX_SUGGESTIONS+1}`
    ).all(key.familyId,key.ownerPersonId) as Record<string,unknown>[];
      if(rows.length>FAMILY_AI_ASSISTANT_MAX_SUGGESTIONS)throw new Error('Family AI center exceeds its bounded local result contract');
      return Object.freeze({suggestions:Object.freeze(rows.map(mapSuggestion))});});
  }
  public findSuggestion(context:PolicyAuthorizedRepositoryExecutionContext,key:FamilyAiAssistantCenterKey,suggestionId:string)
  :RepositoryResult<FamilyAiSuggestionRow|null>{assertKey(context,key,'write',suggestionId);return this.execute(context,()=>{
    const row=this.database(context).prepare(`${suggestionSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
      .get(suggestionId,key.familyId,key.ownerPersonId) as Record<string,unknown>|undefined;return row?mapSuggestion(row):null;});}
  public findMutationByClientOperationId(context:PolicyAuthorizedRepositoryExecutionContext,key:FamilyAiAssistantCenterKey,clientOperationId:string)
  :RepositoryResult<FamilyAiSuggestionMutationRow|null>{assertKey(context,key,'write',context.policyAuthorization.resourceId);
    return this.execute(context,()=>{const row=this.database(context).prepare(`${mutationSelect} WHERE family_id=? AND actor_account_id=? AND client_operation_id=?`)
      .get(key.familyId,key.accountId,clientOperationId) as Record<string,unknown>|undefined;return row?mapMutation(row):null;});}
  public insertMutation(context:PolicyAuthorizedRepositoryExecutionContext,row:FamilyAiSuggestionMutationRow):RepositoryResult<void>{
    const binding=writeBinding(context,row);if(row.actorAccountId!==context.policyAuthorization.subject.accountId
      ||row.actorPersonId!==context.policyAuthorization.subject.personId||row.ownerPersonId!==row.actorPersonId
      ||row.ownerPersonId!==context.policyAuthorization.receiptRecord.request.resource.ownerPersonId
      ||row.revision!==row.expectedRevision+1)throw new Error('Family AI mutation identity or revision is invalid');
    return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO family_ai_suggestion_mutations(
      id,family_id,owner_person_id,suggestion_id,actor_account_id,actor_person_id,mutation_kind,purpose,client_operation_id,
      request_fingerprint,expected_revision,revision,suggestion_state_fingerprint,source_fingerprint,source_count,occurred_at,
      policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,policy_resource_type,
      policy_resource_id,policy_action,policy_capability) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        row.id,row.familyId,row.ownerPersonId,row.suggestionId,row.actorAccountId,row.actorPersonId,row.mutationKind,row.purpose,
        row.clientOperationId,row.requestFingerprint,row.expectedRevision,row.revision,row.suggestionStateFingerprint,
        row.sourceFingerprint,row.sourceCount,row.occurredAt,binding.receiptHash,binding.receiptVersion,binding.nonce,
        context.correlationId,binding.resourceType,binding.resourceId,binding.action,binding.capability);});
  }
  public insertSuggestion(context:PolicyAuthorizedRepositoryExecutionContext,row:FamilyAiSuggestionRow):RepositoryResult<void>{
    assertPolicyAuthorizedRepositoryContext(context,{resourceType:'family_ai_suggestion',resourceId:row.id,action:'create',
      capability:'family.write',correlationId:context.correlationId,resourceFamilyId:row.familyId});
    return this.execute(context,()=>this.writeSuggestion(context,row,null));
  }
  public saveSuggestion(context:PolicyAuthorizedRepositoryExecutionContext,row:FamilyAiSuggestionRow,expectedRevision:number):RepositoryResult<void>{
    assertPolicyAuthorizedRepositoryContext(context,{resourceType:'family_ai_suggestion',resourceId:row.id,action:'update',
      capability:'family.write',correlationId:context.correlationId,resourceFamilyId:row.familyId});
    return this.execute(context,()=>this.writeSuggestion(context,row,expectedRevision));
  }
  private writeSuggestion(context:PolicyAuthorizedRepositoryExecutionContext,row:FamilyAiSuggestionRow,expectedRevision:number|null):void{
    const binding=platformPolicyPersistenceBinding(context,'family_ai_suggestion',row.id);if(!binding)throw new Error('Family AI current row requires receipt binding');
    if(expectedRevision===null){const count=Number((this.database(context).prepare(
      'SELECT COUNT(*) AS count FROM family_ai_suggestions WHERE family_id=? AND owner_person_id=?').get(
        row.familyId,row.ownerPersonId) as {count:number}).count);
      if(count>=FAMILY_AI_ASSISTANT_MAX_SUGGESTIONS)throw new Error('Family AI owner suggestion capacity is exhausted');
      this.database(context).prepare(`INSERT INTO family_ai_suggestions(id,family_id,owner_person_id,kind,
      purpose,status,title,explanation,confidence_basis_points,sources_json,source_fingerprint,revision,state_fingerprint,
      last_mutation_id,created_at,updated_at,confirmed_at,dismissed_at,policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        row.id,row.familyId,row.ownerPersonId,row.kind,row.purpose,row.status,row.title,row.explanation,row.confidenceBasisPoints,
        JSON.stringify(canonicalFamilyAiAssistantSources(row.sources)),row.sourceFingerprint,row.revision,row.stateFingerprint,
        row.lastMutationId,row.createdAt,row.updatedAt,row.confirmedAt??null,row.dismissedAt??null,binding.receiptHash);return;}
    const result=this.database(context).prepare(`UPDATE family_ai_suggestions SET status=?,revision=?,state_fingerprint=?,last_mutation_id=?,
      updated_at=?,confirmed_at=?,dismissed_at=?,policy_receipt_hash=? WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`).run(
        row.status,row.revision,row.stateFingerprint,row.lastMutationId,row.updatedAt,row.confirmedAt??null,row.dismissedAt??null,
        binding.receiptHash,row.id,row.familyId,row.ownerPersonId,expectedRevision);
    if(Number(result.changes)!==1)throw new Error('Family AI optimistic revision conflict');
  }
}
