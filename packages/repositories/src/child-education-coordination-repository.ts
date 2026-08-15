import { asFamilyId, asIsoDate, asIsoDateTime, asPersonId } from '@ppt/core';
import {
  childEducationPrivacyExplanationFor,
  type ChildEducationArea,
  type ChildEducationItemView,
  type ChildEducationKind,
  type ChildEducationMutationKind,
  type ChildEducationStatus,
  type ChildEducationVisibility
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type ChildEducationCenterKey,
  type ChildEducationCenterSnapshotRow,
  type ChildEducationCoordinationRepositoryPort,
  type ChildEducationItemRow,
  type ChildEducationMutationRow,
  type ChildEducationPolicyResourceRepositoryPort,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const itemSelect = `SELECT id,family_id,child_person_id,kind,area,title,status,visibility,revision,
  institution_label,class_label,subject_label,scheduled_at,due_at,recurrence,transport_mode,
  authority_reference_id,amount_minor,currency,progress_basis_points,certificate_status,note,
  state_fingerprint,last_mutation_id,created_at,updated_at,deleted_at FROM child_education_items`;
const mutationSelect = `SELECT id,family_id,child_person_id,item_id,actor_account_id,actor_person_id,
  mutation_kind,client_operation_id,request_fingerprint,expected_revision,revision,item_state_fingerprint,
  occurred_at FROM child_education_mutations`;

const mapItem = (row: Record<string,unknown>): ChildEducationItemRow => {
  const visibility=String(row.visibility) as ChildEducationVisibility;
  return Object.freeze({
    id:String(row.id),familyId:asFamilyId(String(row.family_id)),childPersonId:asPersonId(String(row.child_person_id)),
    kind:String(row.kind) as ChildEducationKind,area:String(row.area) as ChildEducationArea,title:String(row.title),
    status:String(row.status) as ChildEducationStatus,visibility,
    privacyExplanationCode:childEducationPrivacyExplanationFor(visibility),revision:Number(row.revision),
    ...(row.institution_label?{institutionLabel:String(row.institution_label)}:{}),
    ...(row.class_label?{classLabel:String(row.class_label)}:{}),
    ...(row.subject_label?{subjectLabel:String(row.subject_label)}:{}),
    ...(row.scheduled_at?{scheduledAt:asIsoDateTime(String(row.scheduled_at))}:{}),
    ...(row.due_at?{dueAt:asIsoDateTime(String(row.due_at))}:{}),
    ...(row.recurrence?{recurrence:String(row.recurrence)}:{}),
    ...(row.transport_mode?{transportMode:String(row.transport_mode) as NonNullable<ChildEducationItemView['transportMode']>}:{}),
    ...(row.authority_reference_id?{authorityReferenceId:String(row.authority_reference_id)}:{}),
    ...(row.amount_minor!==null&&row.amount_minor!==undefined?{amountMinor:Number(row.amount_minor)}:{}),
    ...(row.currency?{currency:String(row.currency)}:{}),
    ...(row.progress_basis_points!==null&&row.progress_basis_points!==undefined?{progressBasisPoints:Number(row.progress_basis_points)}:{}),
    ...(row.certificate_status?{certificateStatus:'locally_recorded_unverified' as const}:{}),
    ...(row.note?{note:String(row.note)}:{}),stateFingerprint:String(row.state_fingerprint),
    lastMutationId:String(row.last_mutation_id),createdAt:asIsoDateTime(String(row.created_at)),
    updatedAt:asIsoDateTime(String(row.updated_at)),...(row.deleted_at?{deletedAt:asIsoDateTime(String(row.deleted_at))}:{})
  });
};

const mapMutation = (row:Record<string,unknown>):ChildEducationMutationRow=>Object.freeze({
  id:String(row.id),familyId:asFamilyId(String(row.family_id)),childPersonId:asPersonId(String(row.child_person_id)),
  itemId:String(row.item_id),actorAccountId:String(row.actor_account_id),actorPersonId:asPersonId(String(row.actor_person_id)),
  mutationKind:String(row.mutation_kind) as ChildEducationMutationKind,clientOperationId:String(row.client_operation_id),
  requestFingerprint:String(row.request_fingerprint),expectedRevision:Number(row.expected_revision),revision:Number(row.revision),
  itemStateFingerprint:String(row.item_state_fingerprint),occurredAt:asIsoDateTime(String(row.occurred_at))
});

const assertKey=(context:PolicyAuthorizedRepositoryExecutionContext,key:ChildEducationCenterKey,mode:'read'|'write',itemId?:string):void=>{
  assertPolicyAuthorizedRepositoryContext(context,{resourceType:mode==='read'?'child_education_center':'child_education_item',
    resourceId:mode==='read'?'*':itemId!,action:context.policyAuthorization.action,
    capability:mode==='read'?'family.read':'family.write',correlationId:context.correlationId,resourceFamilyId:key.familyId});
  const authorization=context.policyAuthorization;
  if(authorization.purpose!=='general'||authorization.subject.accountId!==key.accountId
    ||authorization.subject.personId!==key.actorPersonId||!authorization.subject.familyIds.includes(key.familyId)
    ||authorization.resourceFamilyId!==key.familyId||key.centerId!==`child-education-center:${key.familyId}:${key.childPersonId}`
    ||(mode==='read'&&authorization.action!=='read')
    ||(mode==='write'&&!['create','update','delete'].includes(authorization.action)))
    throw new Error('Child education repository key does not match the exact policy receipt');
};

const writeBinding=(context:PolicyAuthorizedRepositoryExecutionContext,row:ChildEducationMutationRow)=>{
  const binding=platformPolicyPersistenceBinding(context,'child_education_item',row.itemId);
  if(!binding||binding.resourceFamilyId!==row.familyId||binding.purpose!=='general'||binding.capability!=='family.write'
    ||binding.occurredAt!==row.occurredAt)throw new Error('Child education mutation requires an exact durable policy receipt');
  const expected=row.mutationKind==='item_create'?'create':row.mutationKind==='item_delete'?'delete':'update';
  if(binding.action!==expected)throw new Error('Child education mutation action does not match the receipt');
  return binding;
};

export class SqliteChildEducationCoordinationRepository extends SqliteRepository implements
  ChildEducationCoordinationRepositoryPort,ChildEducationPolicyResourceRepositoryPort {
  public findItemForPolicyResolution(context:RepositoryExecutionContext,itemId:string):ReturnType<ChildEducationPolicyResourceRepositoryPort['findItemForPolicyResolution']>{
    return this.execute(context,()=>{
      const row=this.database(context).prepare(`SELECT id,family_id,child_person_id,revision,status,visibility,state_fingerprint
        FROM child_education_items WHERE id=?`).get(itemId) as Record<string,unknown>|undefined;
      return row?Object.freeze({id:String(row.id),familyId:asFamilyId(String(row.family_id)),
        childPersonId:asPersonId(String(row.child_person_id)),revision:Number(row.revision),
        status:String(row.status) as ChildEducationStatus,visibility:String(row.visibility) as ChildEducationVisibility,
        stateFingerprint:String(row.state_fingerprint)}):null;
    });
  }

  public loadCenter(context:PolicyAuthorizedRepositoryExecutionContext,key:ChildEducationCenterKey):RepositoryResult<ChildEducationCenterSnapshotRow>{
    assertKey(context,key,'read');
    return this.execute(context,()=>{
      const database=this.database(context);
      const child=database.prepare(`SELECT id,family_id,status,birth_date FROM people WHERE id=? AND family_id=?`)
        .get(key.childPersonId,key.familyId) as Record<string,unknown>|undefined;
      if(!child)throw new Error('Child education child profile is unavailable');
      const rows=database.prepare(`${itemSelect} WHERE family_id=? AND child_person_id=? ORDER BY area,updated_at DESC,id LIMIT 1001`)
        .all(key.familyId,key.childPersonId) as Record<string,unknown>[];
      if(rows.length>1000)throw new Error('Child education center exceeds its bounded local result contract');
      return Object.freeze({child:Object.freeze({id:asPersonId(String(child.id)),familyId:asFamilyId(String(child.family_id)),
        status:String(child.status) as 'active'|'inactive'|'deceased',...(child.birth_date?{birthDate:asIsoDate(String(child.birth_date))}:{})}),
        items:Object.freeze(rows.map(mapItem))});
    });
  }

  public findItem(context:PolicyAuthorizedRepositoryExecutionContext,key:ChildEducationCenterKey,itemId:string):RepositoryResult<ChildEducationItemRow|null>{
    assertKey(context,key,'write',itemId);
    return this.execute(context,()=>{const row=this.database(context).prepare(`${itemSelect} WHERE id=? AND family_id=? AND child_person_id=?`)
      .get(itemId,key.familyId,key.childPersonId) as Record<string,unknown>|undefined;return row?mapItem(row):null;});
  }

  public findMutationByClientOperationId(context:PolicyAuthorizedRepositoryExecutionContext,key:ChildEducationCenterKey,clientOperationId:string):RepositoryResult<ChildEducationMutationRow|null>{
    assertKey(context,key,'write',context.policyAuthorization.resourceId);
    return this.execute(context,()=>{const row=this.database(context).prepare(`${mutationSelect} WHERE family_id=? AND actor_account_id=? AND client_operation_id=?`)
      .get(key.familyId,key.accountId,clientOperationId) as Record<string,unknown>|undefined;return row?mapMutation(row):null;});
  }

  public insertMutation(context:PolicyAuthorizedRepositoryExecutionContext,row:ChildEducationMutationRow):RepositoryResult<void>{
    const binding=writeBinding(context,row);
    if(row.actorAccountId!==context.policyAuthorization.subject.accountId||row.actorPersonId!==context.policyAuthorization.subject.personId
      ||row.childPersonId!==context.policyAuthorization.receiptRecord.request.resource.ownerPersonId
      ||row.revision!==row.expectedRevision+1)throw new Error('Child education mutation identity or revision is invalid');
    return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO child_education_mutations(
      id,family_id,child_person_id,item_id,actor_account_id,actor_person_id,mutation_kind,client_operation_id,
      request_fingerprint,expected_revision,revision,item_state_fingerprint,occurred_at,policy_receipt_hash,
      policy_receipt_version,policy_receipt_nonce,policy_correlation_id,policy_resource_type,policy_resource_id,
      policy_action,policy_capability) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        row.id,row.familyId,row.childPersonId,row.itemId,row.actorAccountId,row.actorPersonId,row.mutationKind,
        row.clientOperationId,row.requestFingerprint,row.expectedRevision,row.revision,row.itemStateFingerprint,row.occurredAt,
        binding.receiptHash,binding.receiptVersion,binding.nonce,context.correlationId,binding.resourceType,binding.resourceId,
        binding.action,binding.capability);});
  }

  public insertItem(context:PolicyAuthorizedRepositoryExecutionContext,row:ChildEducationItemRow):RepositoryResult<void>{
    assertPolicyAuthorizedRepositoryContext(context,{resourceType:'child_education_item',resourceId:row.id,action:'create',
      capability:'family.write',correlationId:context.correlationId,resourceFamilyId:row.familyId});
    return this.execute(context,()=>this.writeItem(context,row,null));
  }

  public saveItem(context:PolicyAuthorizedRepositoryExecutionContext,row:ChildEducationItemRow,expectedRevision:number):RepositoryResult<void>{
    assertPolicyAuthorizedRepositoryContext(context,{resourceType:'child_education_item',resourceId:row.id,
      action:context.policyAuthorization.action,capability:'family.write',correlationId:context.correlationId,resourceFamilyId:row.familyId});
    return this.execute(context,()=>this.writeItem(context,row,expectedRevision));
  }

  private writeItem(context:PolicyAuthorizedRepositoryExecutionContext,row:ChildEducationItemRow,expectedRevision:number|null):void{
    const values=[row.familyId,row.childPersonId,row.kind,row.area,row.title,row.status,row.visibility,row.revision,
      row.institutionLabel??null,row.classLabel??null,row.subjectLabel??null,row.scheduledAt??null,row.dueAt??null,
      row.recurrence??null,row.transportMode??null,row.authorityReferenceId??null,row.amountMinor??null,row.currency??null,
      row.progressBasisPoints??null,row.certificateStatus??null,row.note??null,row.stateFingerprint,row.lastMutationId,
      row.updatedAt,row.deletedAt??null] as const;
    if(expectedRevision===null){this.database(context).prepare(`INSERT INTO child_education_items(
      id,family_id,child_person_id,kind,area,title,status,visibility,revision,institution_label,class_label,subject_label,
      scheduled_at,due_at,recurrence,transport_mode,authority_reference_id,amount_minor,currency,progress_basis_points,
      certificate_status,note,state_fingerprint,last_mutation_id,created_at,updated_at,deleted_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,...values.slice(0,23),row.createdAt,row.updatedAt,row.deletedAt??null);return;}
    const result=this.database(context).prepare(`UPDATE child_education_items SET family_id=?,child_person_id=?,kind=?,area=?,title=?,
      status=?,visibility=?,revision=?,institution_label=?,class_label=?,subject_label=?,scheduled_at=?,due_at=?,recurrence=?,
      transport_mode=?,authority_reference_id=?,amount_minor=?,currency=?,progress_basis_points=?,certificate_status=?,note=?,
      state_fingerprint=?,last_mutation_id=?,updated_at=?,deleted_at=? WHERE id=? AND revision=?`)
      .run(...values,row.id,expectedRevision);
    if(result.changes!==1)throw new Error('Child education item optimistic revision conflict');
  }
}
