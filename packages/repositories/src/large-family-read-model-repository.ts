import type {
  LargeArchiveRow,
  LargeFamilyReadModelRepositoryPort,
  LargeTimelineRow,
  LargeTimelineCursor,
  LargeTreeCursor,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { assertPolicyAuthorizedRepositoryContext } from '@ppt/repository-contracts';
import { asEventId, asIsoDateTime, asPersonId, type FamilyId, type PersonId } from '@ppt/core';
import type { FamilyEventView } from '@ppt/domain';
import { SqliteRepository } from './sqlite-base.js';

const escapeLike = (value:string):string => value.replaceAll('\\','\\\\').replaceAll('%','\\%').replaceAll('_','\\_');
const parseStringArray=(value:unknown):string[]=>{if(typeof value!=='string')return[];try{const parsed:unknown=JSON.parse(value);return Array.isArray(parsed)?parsed.filter((item):item is string=>typeof item==='string'):[];}catch{return[];}};
const parseReminderDays=(value:unknown):number[]=>{if(typeof value!=='string')return[];try{const parsed:unknown=JSON.parse(value);return Array.isArray(parsed)?parsed.map(Number).filter((item)=>Number.isInteger(item)&&item>=0&&item<=365):[];}catch{return[];}};
const mapEvent=(row:Record<string,unknown>):LargeTimelineRow=>({
  id:asEventId(String(row.id)),kind:String(row.kind),title:String(row.title),
  ...(row.description?{description:String(row.description)}:{}),startAt:asIsoDateTime(String(row.start_at)),
  ...(row.governed_location_id?{linkedLocationId:String(row.governed_location_id)}:{}),
  ...(row.freeform_location_label?{freeformLocationLabel:String(row.freeform_location_label)}:{}),
  visibility:String(row.visibility) as FamilyEventView['visibility'],participantPersonIds:parseStringArray(row.participant_person_ids),
  ...(row.invitation_text?{invitationText:String(row.invitation_text)}:{}),...(row.notes?{notes:String(row.notes)}:{}),
  attachmentCount:Number(row.attachment_count),aiProcessingAllowed:Number(row.ai_processing_allowed)===1,
  recurrence:String(row.recurrence??'none') as FamilyEventView['recurrence'],reminderDays:parseReminderDays(row.reminder_days),
  createdAt:asIsoDateTime(String(row.created_at)),...(row.updated_at?{updatedAt:asIsoDateTime(String(row.updated_at))}:{}),
  ...(row.archived_at?{archivedAt:asIsoDateTime(String(row.archived_at))}:{})
});

const assertTimelineLocationReadBinding=(context:PolicyAuthorizedRepositoryExecutionContext,familyId:FamilyId):void=>{
  assertPolicyAuthorizedRepositoryContext(context,{
    resourceType:'location',resourceId:'*',action:'read',capability:'location.read',
    correlationId:context.correlationId,resourceFamilyId:familyId
  });
  const authorization=context.policyAuthorization;const request=authorization.receiptRecord.request;
  if(
    authorization.resourceFamilyId!==familyId
    || request.resource.familyId!==familyId
    || request.resource.sensitivity!=='highly_sensitive'
    || request.purpose!=='general'
    || !authorization.subject.familyIds.includes(familyId)
    || authorization.subject.accountId!==String(context.actor.userId)
    || authorization.subject.personId!==(context.actor.personId===undefined?undefined:String(context.actor.personId))
  )throw new Error('Large timeline location read is not bound to the active family/person policy envelope');
};

export class SqliteLargeFamilyReadModelRepository extends SqliteRepository implements LargeFamilyReadModelRepositoryPort {
  public listTreePage(context:RepositoryExecutionContext,input:{familyId:FamilyId;limit:number;query:string;branch:string;generation?:number;cursor?:LargeTreeCursor}):RepositoryResult<readonly import('@ppt/repository-contracts').LargeTreeRow[]>{
    return this.execute(context,()=>{
      const where=['p.family_id=?',"p.status='active'"];const params:unknown[]=[input.familyId];
      if(input.query){where.push("p.display_name LIKE ? ESCAPE '\\' COLLATE NOCASE");params.push(`%${escapeLike(input.query)}%`);}
      if(input.branch){where.push('p.branch=? COLLATE NOCASE');params.push(input.branch);}
      if(input.generation!==undefined){where.push('p.generation=?');params.push(input.generation);}
      if(input.cursor){where.push('(p.generation>? OR (p.generation=? AND (p.display_name COLLATE NOCASE>? COLLATE NOCASE OR (p.display_name COLLATE NOCASE=? COLLATE NOCASE AND p.id>?))))');params.push(input.cursor.generation,input.cursor.generation,input.cursor.displayName,input.cursor.displayName,input.cursor.id);}
      params.push(input.limit);
      const rows=this.database(context).prepare(`
        SELECT p.id,p.display_name,p.birth_date,p.relationship_type,p.generation,p.branch,p.status,
          (SELECT COUNT(*) FROM relations r WHERE r.family_id=p.family_id AND (r.from_person_id=p.id OR r.to_person_id=p.id)) relation_count,
          (SELECT COUNT(*) FROM relations r WHERE r.family_id=p.family_id AND ((r.relation_type='parent' AND r.to_person_id=p.id) OR (r.relation_type='child' AND r.from_person_id=p.id))) parent_count,
          (SELECT COUNT(*) FROM relations r WHERE r.family_id=p.family_id AND ((r.relation_type='parent' AND r.from_person_id=p.id) OR (r.relation_type='child' AND r.to_person_id=p.id))) child_count
        FROM people p WHERE ${where.join(' AND ')}
        ORDER BY p.generation,p.display_name COLLATE NOCASE,p.id LIMIT ?
      `).all(...params) as Array<Record<string,unknown>>;
      return rows.map(row=>({id:asPersonId(String(row.id)),displayName:String(row.display_name),...(row.birth_date?{birthDate:String(row.birth_date)}:{}),relationshipType:String(row.relationship_type),generation:Number(row.generation),branch:String(row.branch),status:'active' as const,relationCount:Number(row.relation_count),parentCount:Number(row.parent_count),childCount:Number(row.child_count)}));
    });
  }

  public listTimelinePage(context:PolicyAuthorizedRepositoryExecutionContext,input:{familyId:FamilyId;limit:number;query:string;visibleLocationIds:readonly string[];locationIdsMatchingQuery?:readonly string[];personId?:PersonId;kind:string;year?:number;cursor?:LargeTimelineCursor}):RepositoryResult<readonly LargeTimelineRow[]>{
    assertTimelineLocationReadBinding(context,input.familyId);
    return this.execute(context,()=>{
      if(!Array.isArray(input.visibleLocationIds)||input.visibleLocationIds.some(id=>typeof id!=='string'||id.length===0))throw new Error('Large timeline requires a governed visible-location id snapshot');
      const visibleLocationIds=[...new Set(input.visibleLocationIds)];const visibleLocationIdSet=new Set(visibleLocationIds);const locationIdsMatchingQuery=[...new Set(input.locationIdsMatchingQuery??[])];
      if(locationIdsMatchingQuery.some(id=>!visibleLocationIdSet.has(id)))throw new Error('Large timeline location search ids must be a subset of the governed visible-location snapshot');
      const where=['e.family_id=?','e.archived_at IS NULL'];const params:unknown[]=[input.familyId];
      if(input.query){
        const pattern=`%${escapeLike(input.query)}%`;const queryClauses=["e.title LIKE ? ESCAPE '\\' COLLATE NOCASE","COALESCE(e.description,'') LIKE ? ESCAPE '\\' COLLATE NOCASE","COALESCE(e.notes,'') LIKE ? ESCAPE '\\' COLLATE NOCASE","(e.location_id IS NULL AND COALESCE(e.location_label,'') LIKE ? ESCAPE '\\' COLLATE NOCASE)"];params.push(pattern,pattern,pattern,pattern);
        if(locationIdsMatchingQuery.length){queryClauses.push('EXISTS (SELECT 1 FROM json_each(?) visible_location_match WHERE visible_location_match.value=e.location_id)');params.push(JSON.stringify(locationIdsMatchingQuery));}
        where.push(`(${queryClauses.join(' OR ')})`);
      }
      if(input.personId){where.push('EXISTS (SELECT 1 FROM json_each(e.participant_person_ids) participant WHERE participant.value=?)');params.push(input.personId);}
      if(input.kind){where.push('e.kind=?');params.push(input.kind);}
      if(input.year!==undefined){const start=`${input.year.toString().padStart(4,'0')}-01-01T00:00:00.000Z`;const end=`${String(input.year+1).padStart(4,'0')}-01-01T00:00:00.000Z`;where.push('e.start_at>=? AND e.start_at<?');params.push(start,end);}
      if(input.cursor){where.push('(e.start_at<? OR (e.start_at=? AND e.id<?))');params.push(input.cursor.startAt,input.cursor.startAt,input.cursor.id);}
      params.push(input.limit);
      const rows=this.database(context).prepare(`SELECT e.id,e.kind,e.title,e.description,e.start_at,CASE WHEN EXISTS (SELECT 1 FROM json_each(?) visible_location WHERE visible_location.value=e.location_id) THEN e.location_id ELSE NULL END governed_location_id,CASE WHEN e.location_id IS NULL THEN e.location_label ELSE NULL END freeform_location_label,e.visibility,e.participant_person_ids,e.invitation_text,e.notes,e.attachment_count,e.ai_processing_allowed,e.recurrence,e.reminder_days,e.created_at,e.updated_at,e.archived_at FROM governed_timeline_events e WHERE ${where.join(' AND ')} ORDER BY e.start_at DESC,e.id DESC LIMIT ?`).all(JSON.stringify(visibleLocationIds),...params) as Array<Record<string,unknown>>;
      return rows.map(mapEvent);
    });
  }

  public listArchivePage(context:RepositoryExecutionContext,input:{familyId:FamilyId;limit:number;query:string;categoryId:string;sensitivity:string;tag:string;mimeType:string;linkedEventId:string;cursor?:import('@ppt/repository-contracts').LargeArchiveCursor}):RepositoryResult<readonly LargeArchiveRow[]>{
    return this.execute(context,()=>{
      const where=['a.family_id=?','a.destroyed_at IS NULL'];const params:unknown[]=[input.familyId];
      if(input.query){const pattern=`%${escapeLike(input.query)}%`;where.push("(a.title LIKE ? ESCAPE '\\' COLLATE NOCASE OR a.original_name LIKE ? ESCAPE '\\' COLLATE NOCASE OR a.mime_type LIKE ? ESCAPE '\\' COLLATE NOCASE OR EXISTS(SELECT 1 FROM archive_item_tags ait JOIN archive_tags at ON at.id=ait.tag_id WHERE ait.archive_item_id=a.id AND at.name LIKE ? ESCAPE '\\' COLLATE NOCASE))");params.push(pattern,pattern,pattern,pattern);}
      if(input.categoryId){where.push('a.category_id=?');params.push(input.categoryId);}
      if(input.sensitivity){where.push('a.sensitivity=?');params.push(input.sensitivity);}
      if(input.tag){where.push("EXISTS(SELECT 1 FROM archive_item_tags ait JOIN archive_tags at ON at.id=ait.tag_id WHERE ait.archive_item_id=a.id AND at.name LIKE ? ESCAPE '\\' COLLATE NOCASE)");params.push(`%${escapeLike(input.tag)}%`);}
      if(input.mimeType){where.push("a.mime_type LIKE ? ESCAPE '\\'");params.push(`%${escapeLike(input.mimeType)}%`);}
      if(input.linkedEventId){where.push('a.linked_event_id=?');params.push(input.linkedEventId);}
      if(input.cursor){where.push('(a.created_at<? OR (a.created_at=? AND a.id<?))');params.push(input.cursor.createdAt,input.cursor.createdAt,input.cursor.id);}
      params.push(input.limit);
      const rows=this.database(context).prepare(`
        SELECT a.id,a.title,a.original_name,a.mime_type,a.size_bytes,a.sha256,a.created_at,a.linked_event_id,a.category_id,c.name category_name,a.sensitivity,
          CASE WHEN json_extract(receipt.record_json,'$.request.resource.ownerPersonId') IS NULL THEN 'legacy_unverified' ELSE 'verified_actor' END ownership_binding,
          p.id retention_policy_id,p.name retention_policy_name,p.retention_days,
          (SELECT group_concat(t.name,'|') FROM archive_item_tags it JOIN archive_tags t ON t.id=it.tag_id WHERE it.archive_item_id=a.id ORDER BY t.name COLLATE NOCASE) tag_names
        FROM archive_items a LEFT JOIN platform_policy_transaction_receipts receipt ON receipt.receipt_hash=a.policy_receipt_hash LEFT JOIN archive_categories c ON c.id=a.category_id LEFT JOIN archive_retention_policies p ON p.id=a.retention_policy_id
        WHERE ${where.join(' AND ')} ORDER BY a.created_at DESC,a.id DESC LIMIT ?
      `).all(...params) as Array<Record<string,unknown>>;
      return rows.map(row=>({id:String(row.id),title:String(row.title),originalName:String(row.original_name),mimeType:String(row.mime_type),sizeBytes:Number(row.size_bytes),sha256:String(row.sha256),createdAt:String(row.created_at),...(row.linked_event_id?{linkedEventId:String(row.linked_event_id)}:{}),...(row.category_id?{categoryId:String(row.category_id)}:{}),...(row.category_name?{categoryName:String(row.category_name)}:{}),sensitivity:String(row.sensitivity??'standard') as LargeArchiveRow['sensitivity'],tagNames:String(row.tag_names??'').split('|').filter(Boolean),...(row.retention_policy_id?{retentionPolicyId:String(row.retention_policy_id)}:{}),...(row.retention_policy_name?{retentionPolicyName:String(row.retention_policy_name)}:{}),...(row.retention_days!==null&&row.retention_days!==undefined?{retentionDays:Number(row.retention_days)}:{}),ownershipBinding:String(row.ownership_binding) as LargeArchiveRow['ownershipBinding']}));
    });
  }
}
