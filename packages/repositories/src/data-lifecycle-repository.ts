import { asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  DataLifecycleRepositoryPort,
  DataLifecycleResourceDescriptor,
  DataLifecycleRow,
  DataRetentionPolicyRow,
  RepositoryExecutionContext,
  RepositoryResult,
  UpsertDataLifecycleInput
} from '@ppt/repository-contracts';
import type { DataLifecycleResourceType, DataLifecycleState, RecordPrivacy } from '@ppt/domain';
import { SqliteRepository } from './sqlite-base.js';

const parseResourceTypes=(value:unknown):DataLifecycleResourceType[]=>{
  try {
    const parsed=JSON.parse(String(value)) as unknown;
    return Array.isArray(parsed)?parsed.filter((item):item is DataLifecycleResourceType=>
      item==='finance_record'||item==='health_record'||item==='medication_plan'||item==='family_health_history'||item==='life_record'):[];
  } catch { return []; }
};
const mapPolicy=(row:Record<string,unknown>):DataRetentionPolicyRow=>({
  id:String(row.id),name:String(row.name),resourceTypes:parseResourceTypes(row.resource_types),
  retentionDays:Number(row.retention_days),graceDays:Number(row.grace_days),
  requiresStrongAuth:Number(row.requires_strong_auth)===1,createdAt:asIsoDateTime(String(row.created_at))
});
const mapLifecycle=(row:Record<string,unknown>):DataLifecycleRow=>({
  resourceType:String(row.resource_type) as DataLifecycleResourceType,
  resourceId:String(row.resource_id),
  ...(row.owner_person_id?{ownerPersonId:asPersonId(String(row.owner_person_id))}:{}),
  ...(row.privacy?{privacy:String(row.privacy) as RecordPrivacy}:{}),
  state:String(row.state) as DataLifecycleState,
  ...(row.policy_id?{policyId:String(row.policy_id)}:{}),
  ...(row.archived_at?{archivedAt:asIsoDateTime(String(row.archived_at))}:{}),
  ...(row.purge_eligible_at?{purgeEligibleAt:asIsoDateTime(String(row.purge_eligible_at))}:{}),
  ...(row.purge_requested_at?{purgeRequestedAt:asIsoDateTime(String(row.purge_requested_at))}:{}),
  ...(row.purge_execute_after?{purgeExecuteAfter:asIsoDateTime(String(row.purge_execute_after))}:{}),
  legalHold:Number(row.legal_hold)===1,
  ...(row.hold_reason?{holdReason:String(row.hold_reason)}:{}),
  ...(row.purged_at?{purgedAt:asIsoDateTime(String(row.purged_at))}:{}),
  updatedAt:asIsoDateTime(String(row.updated_at)),
  backupPropagationPending:Number(row.backup_propagation_pending)===1
});

const RESOURCE_QUERIES:Record<DataLifecycleResourceType,{sql:string;ownerColumn:string;titleColumn:string}>={
  finance_record:{sql:'SELECT id,owner_person_id,privacy,title FROM finance_records WHERE id=?',ownerColumn:'owner_person_id',titleColumn:'title'},
  health_record:{sql:'SELECT id,owner_person_id,privacy,title FROM health_records WHERE id=?',ownerColumn:'owner_person_id',titleColumn:'title'},
  medication_plan:{sql:'SELECT id,owner_person_id,privacy,name AS title FROM medication_plans WHERE id=?',ownerColumn:'owner_person_id',titleColumn:'title'},
  family_health_history:{sql:'SELECT id,related_person_id AS owner_person_id,privacy,condition AS title FROM family_health_history WHERE id=?',ownerColumn:'owner_person_id',titleColumn:'title'},
  life_record:{sql:'SELECT id,owner_person_id,privacy,title FROM life_records WHERE id=?',ownerColumn:'owner_person_id',titleColumn:'title'}
};
const RESOURCE_TABLES:Record<DataLifecycleResourceType,string>={
  finance_record:'finance_records',health_record:'health_records',medication_plan:'medication_plans',
  family_health_history:'family_health_history',life_record:'life_records'
};

export class SqliteDataLifecycleRepository extends SqliteRepository implements DataLifecycleRepositoryPort {
  listPolicies(context:RepositoryExecutionContext):RepositoryResult<readonly DataRetentionPolicyRow[]>{
    return this.execute(context,()=> (this.database(context).prepare(`SELECT id,name,resource_types,retention_days,grace_days,requires_strong_auth,created_at FROM data_retention_policies ORDER BY name COLLATE NOCASE,id`).all() as Record<string,unknown>[]).map(mapPolicy));
  }
  findPolicy(context:RepositoryExecutionContext,id:string):RepositoryResult<DataRetentionPolicyRow|null>{
    return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT id,name,resource_types,retention_days,grace_days,requires_strong_auth,created_at FROM data_retention_policies WHERE id=?`).get(id) as Record<string,unknown>|undefined;return row?mapPolicy(row):null;});
  }
  insertPolicy(context:RepositoryExecutionContext,row:DataRetentionPolicyRow):RepositoryResult<void>{
    return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO data_retention_policies(id,name,resource_types,retention_days,grace_days,requires_strong_auth,created_at) VALUES(?,?,?,?,?,?,?)`).run(row.id,row.name,JSON.stringify(row.resourceTypes),row.retentionDays,row.graceDays,row.requiresStrongAuth?1:0,row.createdAt);});
  }
  listLifecycle(context:RepositoryExecutionContext):RepositoryResult<readonly DataLifecycleRow[]>{
    return this.execute(context,()=> (this.database(context).prepare(`SELECT resource_type,resource_id,owner_person_id,privacy,state,policy_id,archived_at,purge_eligible_at,purge_requested_at,purge_execute_after,legal_hold,hold_reason,purged_at,updated_at,backup_propagation_pending FROM data_lifecycle ORDER BY updated_at DESC,resource_type,resource_id`).all() as Record<string,unknown>[]).map(mapLifecycle));
  }
  findLifecycle(context:RepositoryExecutionContext,resourceType:DataLifecycleResourceType,resourceId:string):RepositoryResult<DataLifecycleRow|null>{
    return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT resource_type,resource_id,owner_person_id,privacy,state,policy_id,archived_at,purge_eligible_at,purge_requested_at,purge_execute_after,legal_hold,hold_reason,purged_at,updated_at,backup_propagation_pending FROM data_lifecycle WHERE resource_type=? AND resource_id=?`).get(resourceType,resourceId) as Record<string,unknown>|undefined;return row?mapLifecycle(row):null;});
  }
  findResource(context:RepositoryExecutionContext,resourceType:DataLifecycleResourceType,resourceId:string):RepositoryResult<DataLifecycleResourceDescriptor|null>{
    return this.execute(context,()=>{const query=RESOURCE_QUERIES[resourceType];const row=this.database(context).prepare(query.sql).get(resourceId) as Record<string,unknown>|undefined;return row?{resourceType,resourceId:String(row.id),title:String(row.title),ownerPersonId:asPersonId(String(row.owner_person_id)),privacy:String(row.privacy) as RecordPrivacy}:null;});
  }
  upsertLifecycle(context:RepositoryExecutionContext,row:UpsertDataLifecycleInput):RepositoryResult<void>{
    return this.execute(context,()=>{this.database(context).prepare(`
      INSERT INTO data_lifecycle(resource_type,resource_id,owner_person_id,privacy,state,policy_id,archived_at,purge_eligible_at,purge_requested_at,purge_execute_after,legal_hold,hold_reason,purged_at,updated_at,backup_propagation_pending)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(resource_type,resource_id) DO UPDATE SET
        owner_person_id=excluded.owner_person_id,privacy=excluded.privacy,state=excluded.state,policy_id=excluded.policy_id,
        archived_at=excluded.archived_at,purge_eligible_at=excluded.purge_eligible_at,purge_requested_at=excluded.purge_requested_at,
        purge_execute_after=excluded.purge_execute_after,legal_hold=excluded.legal_hold,hold_reason=excluded.hold_reason,
        purged_at=excluded.purged_at,updated_at=excluded.updated_at,backup_propagation_pending=excluded.backup_propagation_pending
    `).run(row.resourceType,row.resourceId,row.ownerPersonId??null,row.privacy??null,row.state,row.policyId??null,row.archivedAt??null,row.purgeEligibleAt??null,row.purgeRequestedAt??null,row.purgeExecuteAfter??null,row.legalHold?1:0,row.holdReason??null,row.purgedAt??null,row.updatedAt,row.backupPropagationPending?1:0);});
  }
  purgeResource(context:RepositoryExecutionContext,resourceType:DataLifecycleResourceType,resourceId:string):RepositoryResult<boolean>{
    return this.execute(context,()=>{
      const database=this.database(context);
      database.exec('PRAGMA secure_delete=ON;');
      database.prepare('DELETE FROM object_permissions WHERE resource_type=? AND resource_id=?').run(resourceType,resourceId);
      database.prepare('DELETE FROM ai_consents WHERE resource_type=? AND resource_id=?').run(resourceType,resourceId);
      const table=RESOURCE_TABLES[resourceType];
      const result=database.prepare(`DELETE FROM ${table} WHERE id=?`).run(resourceId) as {changes?:number};
      return Number(result.changes??0)>0;
    });
  }


}
