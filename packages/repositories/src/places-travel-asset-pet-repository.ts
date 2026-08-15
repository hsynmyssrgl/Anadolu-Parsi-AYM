import { asFamilyId, asIsoDate, asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  PetCareWorkflow,
  PlacesTravelArea,
  PlacesTravelItemView,
  PlacesTravelKind,
  PlacesTravelMutationKind,
  PlacesTravelStatus,
  PlacesTravelVisibility,
  TravelDocumentKind,
  TravelRequirementKind
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type PlacesTravelAssetPetRepositoryPort,
  type PlacesTravelCenterKey,
  type PlacesTravelCenterSnapshotRow,
  type PlacesTravelItemRow,
  type PlacesTravelMutationRow,
  type PlacesTravelPolicyResourceRepositoryPort,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const itemSelect = `SELECT id,family_id,owner_person_id,kind,area,title,status,visibility,revision,address_label,
  latitude_e6,longitude_e6,offline_fallback_label,participant_person_ids_json,starts_at,ends_at,provider_label,
  opaque_reference,archive_item_id,expires_on,document_kind,amount_minor,currency,checklist_label,
  checklist_completed,pet_reference_id,pet_workflow,requirement_kind,opaque_requirement_reference,
  language_code,ocr_job_id,note,state_fingerprint,last_mutation_id,created_at,updated_at,deleted_at
  FROM places_travel_items`;
const mutationSelect = `SELECT id,family_id,owner_person_id,item_id,actor_account_id,actor_person_id,
  mutation_kind,client_operation_id,request_fingerprint,expected_revision,revision,item_state_fingerprint,
  occurred_at FROM places_travel_mutations`;

const participantIds=(raw:unknown):readonly string[]|undefined=>{
  if(raw===null||raw===undefined)return undefined;
  const parsed=JSON.parse(String(raw)) as unknown;
  if(!Array.isArray(parsed)||!parsed.every((value)=>typeof value==='string'))throw new Error('Places/travel participant ledger is invalid');
  return Object.freeze(parsed);
};

const mapItem=(row:Record<string,unknown>):PlacesTravelItemRow=>Object.freeze({
  id:String(row.id),familyId:asFamilyId(String(row.family_id)),ownerPersonId:asPersonId(String(row.owner_person_id)),
  kind:String(row.kind) as PlacesTravelKind,area:String(row.area) as PlacesTravelArea,title:String(row.title),
  status:String(row.status) as PlacesTravelStatus,visibility:String(row.visibility) as PlacesTravelVisibility,
  revision:Number(row.revision),...(row.address_label?{addressLabel:String(row.address_label)}:{}),
  ...(row.latitude_e6!==null&&row.latitude_e6!==undefined?{latitudeE6:Number(row.latitude_e6)}:{}),
  ...(row.longitude_e6!==null&&row.longitude_e6!==undefined?{longitudeE6:Number(row.longitude_e6)}:{}),
  ...(row.offline_fallback_label?{offlineFallbackLabel:String(row.offline_fallback_label)}:{}),
  ...(participantIds(row.participant_person_ids_json)?{participantPersonIds:participantIds(row.participant_person_ids_json)!}:{}),
  ...(row.starts_at?{startsAt:asIsoDateTime(String(row.starts_at))}:{}),...(row.ends_at?{endsAt:asIsoDateTime(String(row.ends_at))}:{}),
  ...(row.provider_label?{providerLabel:String(row.provider_label)}:{}),...(row.opaque_reference?{opaqueReference:String(row.opaque_reference)}:{}),
  ...(row.archive_item_id?{archiveItemId:String(row.archive_item_id)}:{}),...(row.expires_on?{expiresOn:asIsoDate(String(row.expires_on))}:{}),
  ...(row.document_kind?{documentKind:String(row.document_kind) as TravelDocumentKind}:{}),
  ...(row.amount_minor!==null&&row.amount_minor!==undefined?{amountMinor:Number(row.amount_minor)}:{}),
  ...(row.currency?{currency:String(row.currency)}:{}),...(row.checklist_label?{checklistLabel:String(row.checklist_label)}:{}),
  ...(row.checklist_completed!==null&&row.checklist_completed!==undefined?{checklistCompleted:Number(row.checklist_completed)===1}:{}),
  ...(row.pet_reference_id?{petReferenceId:String(row.pet_reference_id)}:{}),
  ...(row.pet_workflow?{petWorkflow:String(row.pet_workflow) as PetCareWorkflow}:{}),
  ...(row.requirement_kind?{requirementKind:String(row.requirement_kind) as TravelRequirementKind}:{}),
  ...(row.opaque_requirement_reference?{opaqueRequirementReference:String(row.opaque_requirement_reference)}:{}),
  ...(row.language_code?{languageCode:String(row.language_code)}:{}),...(row.ocr_job_id?{ocrJobId:String(row.ocr_job_id)}:{}),
  ...(row.note?{note:String(row.note)}:{}),stateFingerprint:String(row.state_fingerprint),lastMutationId:String(row.last_mutation_id),
  createdAt:asIsoDateTime(String(row.created_at)),updatedAt:asIsoDateTime(String(row.updated_at)),
  ...(row.deleted_at?{deletedAt:asIsoDateTime(String(row.deleted_at))}:{})
});

const mapMutation=(row:Record<string,unknown>):PlacesTravelMutationRow=>Object.freeze({
  id:String(row.id),familyId:asFamilyId(String(row.family_id)),ownerPersonId:asPersonId(String(row.owner_person_id)),
  itemId:String(row.item_id),actorAccountId:String(row.actor_account_id),actorPersonId:asPersonId(String(row.actor_person_id)),
  mutationKind:String(row.mutation_kind) as PlacesTravelMutationKind,clientOperationId:String(row.client_operation_id),
  requestFingerprint:String(row.request_fingerprint),expectedRevision:Number(row.expected_revision),revision:Number(row.revision),
  itemStateFingerprint:String(row.item_state_fingerprint),occurredAt:asIsoDateTime(String(row.occurred_at))
});

const assertKey=(context:PolicyAuthorizedRepositoryExecutionContext,key:PlacesTravelCenterKey,mode:'read'|'write',itemId?:string):void=>{
  assertPolicyAuthorizedRepositoryContext(context,{resourceType:mode==='read'?'places_travel_center':'places_travel_item',
    resourceId:mode==='read'?'*':itemId!,action:context.policyAuthorization.action,
    capability:mode==='read'?'family.read':'family.write',correlationId:context.correlationId,resourceFamilyId:key.familyId});
  const authorization=context.policyAuthorization;
  if(authorization.purpose!=='general'||authorization.subject.accountId!==key.accountId
    ||authorization.subject.personId!==key.actorPersonId||!authorization.subject.familyIds.includes(key.familyId)
    ||authorization.resourceFamilyId!==key.familyId||key.centerId!==`places-travel-center:${key.familyId}:${key.ownerPersonId}`
    ||(mode==='read'&&authorization.action!=='read')
    ||(mode==='write'&&!['create','update','delete'].includes(authorization.action)))
    throw new Error('Places/travel repository key does not match the exact policy receipt');
};

const writeBinding=(context:PolicyAuthorizedRepositoryExecutionContext,row:PlacesTravelMutationRow)=>{
  const binding=platformPolicyPersistenceBinding(context,'places_travel_item',row.itemId);
  if(!binding||binding.resourceFamilyId!==row.familyId||binding.purpose!=='general'||binding.capability!=='family.write'
    ||binding.occurredAt!==row.occurredAt)throw new Error('Places/travel mutation requires an exact durable policy receipt');
  const expected=row.mutationKind==='item_create'?'create':row.mutationKind==='item_delete'?'delete':'update';
  if(binding.action!==expected)throw new Error('Places/travel mutation action does not match the receipt');
  return binding;
};

export class SqlitePlacesTravelAssetPetRepository extends SqliteRepository implements
  PlacesTravelAssetPetRepositoryPort,PlacesTravelPolicyResourceRepositoryPort {
  public findItemForPolicyResolution(context:RepositoryExecutionContext,itemId:string):ReturnType<PlacesTravelPolicyResourceRepositoryPort['findItemForPolicyResolution']>{
    return this.execute(context,()=>{
      const row=this.database(context).prepare(`SELECT id,family_id,owner_person_id,revision,status,visibility,state_fingerprint
        FROM places_travel_items WHERE id=?`).get(itemId) as Record<string,unknown>|undefined;
      return row?Object.freeze({id:String(row.id),familyId:asFamilyId(String(row.family_id)),ownerPersonId:asPersonId(String(row.owner_person_id)),
        revision:Number(row.revision),status:String(row.status) as PlacesTravelStatus,visibility:String(row.visibility) as PlacesTravelVisibility,
        stateFingerprint:String(row.state_fingerprint)}):null;
    });
  }

  public loadCenter(context:PolicyAuthorizedRepositoryExecutionContext,key:PlacesTravelCenterKey):RepositoryResult<PlacesTravelCenterSnapshotRow>{
    assertKey(context,key,'read');
    return this.execute(context,()=>{
      const database=this.database(context);
      const owner=database.prepare(`SELECT id,family_id,status FROM people WHERE id=? AND family_id=?`)
        .get(key.ownerPersonId,key.familyId) as Record<string,unknown>|undefined;
      if(!owner)throw new Error('Places/travel owner profile is unavailable');
      const rows=database.prepare(`${itemSelect} WHERE family_id=? AND owner_person_id=? ORDER BY area,updated_at DESC,id LIMIT 1001`)
        .all(key.familyId,key.ownerPersonId) as Record<string,unknown>[];
      if(rows.length>1000)throw new Error('Places/travel center exceeds its bounded local result contract');
      return Object.freeze({owner:Object.freeze({id:asPersonId(String(owner.id)),familyId:asFamilyId(String(owner.family_id)),
        status:String(owner.status) as 'active'|'inactive'|'deceased'}),items:Object.freeze(rows.map(mapItem))});
    });
  }

  public findItem(context:PolicyAuthorizedRepositoryExecutionContext,key:PlacesTravelCenterKey,itemId:string):RepositoryResult<PlacesTravelItemRow|null>{
    assertKey(context,key,'write',itemId);
    return this.execute(context,()=>{const row=this.database(context).prepare(`${itemSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
      .get(itemId,key.familyId,key.ownerPersonId) as Record<string,unknown>|undefined;return row?mapItem(row):null;});
  }

  public findMutationByClientOperationId(context:PolicyAuthorizedRepositoryExecutionContext,key:PlacesTravelCenterKey,clientOperationId:string):RepositoryResult<PlacesTravelMutationRow|null>{
    assertKey(context,key,'write',context.policyAuthorization.resourceId);
    return this.execute(context,()=>{const row=this.database(context).prepare(`${mutationSelect} WHERE family_id=? AND actor_account_id=? AND client_operation_id=?`)
      .get(key.familyId,key.accountId,clientOperationId) as Record<string,unknown>|undefined;return row?mapMutation(row):null;});
  }

  public insertMutation(context:PolicyAuthorizedRepositoryExecutionContext,row:PlacesTravelMutationRow):RepositoryResult<void>{
    const binding=writeBinding(context,row);
    if(row.actorAccountId!==context.policyAuthorization.subject.accountId||row.actorPersonId!==context.policyAuthorization.subject.personId
      ||row.ownerPersonId!==context.policyAuthorization.receiptRecord.request.resource.ownerPersonId
      ||row.revision!==row.expectedRevision+1)throw new Error('Places/travel mutation identity or revision is invalid');
    return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO places_travel_mutations(
      id,family_id,owner_person_id,item_id,actor_account_id,actor_person_id,mutation_kind,client_operation_id,
      request_fingerprint,expected_revision,revision,item_state_fingerprint,occurred_at,policy_receipt_hash,
      policy_receipt_version,policy_receipt_nonce,policy_correlation_id,policy_resource_type,policy_resource_id,
      policy_action,policy_capability) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        row.id,row.familyId,row.ownerPersonId,row.itemId,row.actorAccountId,row.actorPersonId,row.mutationKind,
        row.clientOperationId,row.requestFingerprint,row.expectedRevision,row.revision,row.itemStateFingerprint,row.occurredAt,
        binding.receiptHash,binding.receiptVersion,binding.nonce,context.correlationId,binding.resourceType,binding.resourceId,
        binding.action,binding.capability);});
  }

  public insertItem(context:PolicyAuthorizedRepositoryExecutionContext,row:PlacesTravelItemRow):RepositoryResult<void>{
    assertPolicyAuthorizedRepositoryContext(context,{resourceType:'places_travel_item',resourceId:row.id,action:'create',
      capability:'family.write',correlationId:context.correlationId,resourceFamilyId:row.familyId});
    return this.execute(context,()=>this.writeItem(context,row,null));
  }

  public saveItem(context:PolicyAuthorizedRepositoryExecutionContext,row:PlacesTravelItemRow,expectedRevision:number):RepositoryResult<void>{
    assertPolicyAuthorizedRepositoryContext(context,{resourceType:'places_travel_item',resourceId:row.id,
      action:context.policyAuthorization.action,capability:'family.write',correlationId:context.correlationId,resourceFamilyId:row.familyId});
    return this.execute(context,()=>this.writeItem(context,row,expectedRevision));
  }

  private writeItem(context:PolicyAuthorizedRepositoryExecutionContext,row:PlacesTravelItemRow,expectedRevision:number|null):void{
    const values=[row.familyId,row.ownerPersonId,row.kind,row.area,row.title,row.status,row.visibility,row.revision,
      row.addressLabel??null,row.latitudeE6??null,row.longitudeE6??null,row.offlineFallbackLabel??null,
      row.participantPersonIds?JSON.stringify(row.participantPersonIds):null,row.startsAt??null,row.endsAt??null,
      row.providerLabel??null,row.opaqueReference??null,row.archiveItemId??null,row.expiresOn??null,row.documentKind??null,
      row.amountMinor??null,row.currency??null,row.checklistLabel??null,row.checklistCompleted===undefined?null:Number(row.checklistCompleted),
      row.petReferenceId??null,row.petWorkflow??null,row.requirementKind??null,row.opaqueRequirementReference??null,
      row.languageCode??null,row.ocrJobId??null,row.note??null,row.stateFingerprint,row.lastMutationId,row.updatedAt,row.deletedAt??null] as const;
    if(expectedRevision===null){this.database(context).prepare(`INSERT INTO places_travel_items(
      id,family_id,owner_person_id,kind,area,title,status,visibility,revision,address_label,latitude_e6,longitude_e6,
      offline_fallback_label,participant_person_ids_json,starts_at,ends_at,provider_label,opaque_reference,archive_item_id,
      expires_on,document_kind,amount_minor,currency,checklist_label,checklist_completed,pet_reference_id,pet_workflow,
      requirement_kind,opaque_requirement_reference,language_code,ocr_job_id,note,state_fingerprint,last_mutation_id,
      created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(row.id,...values.slice(0,33),row.createdAt,row.updatedAt,row.deletedAt??null);return;}
    const result=this.database(context).prepare(`UPDATE places_travel_items SET family_id=?,owner_person_id=?,kind=?,area=?,title=?,
      status=?,visibility=?,revision=?,address_label=?,latitude_e6=?,longitude_e6=?,offline_fallback_label=?,
      participant_person_ids_json=?,starts_at=?,ends_at=?,provider_label=?,opaque_reference=?,archive_item_id=?,expires_on=?,
      document_kind=?,amount_minor=?,currency=?,checklist_label=?,checklist_completed=?,pet_reference_id=?,pet_workflow=?,
      requirement_kind=?,opaque_requirement_reference=?,language_code=?,ocr_job_id=?,note=?,state_fingerprint=?,last_mutation_id=?,
      updated_at=?,deleted_at=? WHERE id=? AND revision=?`).run(...values,row.id,expectedRevision);
    if(result.changes!==1)throw new Error('Places/travel item optimistic revision conflict');
  }
}
