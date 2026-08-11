import type {
  BackupQuarantineBatchStatus,
  BackupQuarantineBatchView,
  BackupQuarantinePolicyView
} from '@ppt/domain';
import type {
  BackupQuarantineRepositoryPort,
  InsertBackupQuarantineBatchRow,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';

const mapPolicy=(row:Record<string,unknown>):BackupQuarantinePolicyView=>({
  id:'default',
  retentionDays:Number(row.retention_days),
  createdAt:String(row.created_at),
  updatedAt:String(row.updated_at)
});

const mapBatch=(row:Record<string,unknown>):BackupQuarantineBatchView=>({
  id:String(row.id),
  propagationRunId:String(row.propagation_run_id),
  targetId:String(row.target_id),
  targetName:String(row.target_name),
  quarantineDirectory:String(row.quarantine_directory),
  manifestPath:String(row.manifest_path),
  status:String(row.status) as BackupQuarantineBatchStatus,
  quarantinedArtifacts:Number(row.quarantined_artifacts),
  quarantinedAt:String(row.quarantined_at),
  retainUntil:String(row.retain_until),
  legalHold:Number(row.legal_hold)===1,
  ...(row.hold_reason?{holdReason:String(row.hold_reason)}:{}),
  ...(row.destroyed_at?{destroyedAt:String(row.destroyed_at)}:{}),
  ...(row.destroyed_artifacts!=null?{destroyedArtifacts:Number(row.destroyed_artifacts)}:{}),
  ...(row.destroyed_bytes!=null?{destroyedBytes:Number(row.destroyed_bytes)}:{}),
  updatedAt:String(row.updated_at)
});

export class SqliteBackupQuarantineRepository extends SqliteRepository implements BackupQuarantineRepositoryPort {
  getPolicy(context:RepositoryExecutionContext):RepositoryResult<BackupQuarantinePolicyView>{
    return this.execute(context,()=>{
      const row=this.database(context).prepare(`SELECT id,retention_days,created_at,updated_at FROM backup_quarantine_policy WHERE id='default'`).get() as Record<string,unknown>|undefined;
      if(!row)throw new Error('Varsayılan yedek karantina politikası bulunamadı.');
      return mapPolicy(row);
    });
  }
  updatePolicy(context:RepositoryExecutionContext,retentionDays:number,updatedAt:string):RepositoryResult<BackupQuarantinePolicyView>{
    return this.execute(context,()=>{
      this.database(context).prepare(`UPDATE backup_quarantine_policy SET retention_days=?,updated_at=? WHERE id='default'`).run(retentionDays,updatedAt);
      const row=this.database(context).prepare(`SELECT id,retention_days,created_at,updated_at FROM backup_quarantine_policy WHERE id='default'`).get() as Record<string,unknown>|undefined;
      if(!row)throw new Error('Yedek karantina politikası güncellenemedi.');
      return mapPolicy(row);
    });
  }
  insertBatch(context:RepositoryExecutionContext,row:InsertBackupQuarantineBatchRow):RepositoryResult<void>{
    return this.execute(context,()=>{
      this.database(context).prepare(`
        INSERT INTO backup_quarantine_batches(
          id,propagation_run_id,target_id,target_name,quarantine_directory,manifest_path,status,
          quarantined_artifacts,quarantined_at,retain_until,legal_hold,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(propagation_run_id,target_id) DO NOTHING
      `).run(row.id,row.propagationRunId,row.targetId,row.targetName,row.quarantineDirectory,row.manifestPath,row.status,row.quarantinedArtifacts,row.quarantinedAt,row.retainUntil,row.legalHold?1:0,row.updatedAt);
    });
  }
  listBatches(context:RepositoryExecutionContext,limit:number):RepositoryResult<readonly BackupQuarantineBatchView[]>{
    return this.execute(context,()=> (this.database(context).prepare(`SELECT * FROM backup_quarantine_batches ORDER BY quarantined_at DESC,id LIMIT ?`).all(limit) as Record<string,unknown>[]).map(mapBatch));
  }
  findBatch(context:RepositoryExecutionContext,id:string):RepositoryResult<BackupQuarantineBatchView|null>{
    return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT * FROM backup_quarantine_batches WHERE id=?`).get(id) as Record<string,unknown>|undefined;return row?mapBatch(row):null;});
  }
  setLegalHold(context:RepositoryExecutionContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly enabled:boolean;readonly reason?:string;readonly updatedAt:string}):RepositoryResult<BackupQuarantineBatchView|null>{
    return this.execute(context,()=>{
      const result=this.database(context).prepare(`
        UPDATE backup_quarantine_batches
        SET legal_hold=?,hold_reason=?,updated_at=?
        WHERE id=? AND status='retained' AND updated_at=?
      `).run(input.enabled?1:0,input.enabled?(input.reason??null):null,input.updatedAt,input.id,input.expectedUpdatedAt) as {changes?:number};
      if(Number(result.changes??0)!==1)return null;
      const row=this.database(context).prepare(`SELECT * FROM backup_quarantine_batches WHERE id=?`).get(input.id) as Record<string,unknown>|undefined;
      return row?mapBatch(row):null;
    });
  }
  beginDestruction(context:RepositoryExecutionContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly updatedAt:string}):RepositoryResult<BackupQuarantineBatchView|null>{
    return this.execute(context,()=>{
      const result=this.database(context).prepare(`
        UPDATE backup_quarantine_batches SET status='destroying',updated_at=?
        WHERE id=? AND status='retained' AND legal_hold=0 AND updated_at=?
      `).run(input.updatedAt,input.id,input.expectedUpdatedAt) as {changes?:number};
      if(Number(result.changes??0)!==1)return null;
      const row=this.database(context).prepare(`SELECT * FROM backup_quarantine_batches WHERE id=?`).get(input.id) as Record<string,unknown>|undefined;
      return row?mapBatch(row):null;
    });
  }
  completeDestruction(context:RepositoryExecutionContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly destroyedAt:string;readonly destroyedArtifacts:number;readonly destroyedBytes:number}):RepositoryResult<BackupQuarantineBatchView|null>{
    return this.execute(context,()=>{
      const result=this.database(context).prepare(`
        UPDATE backup_quarantine_batches
        SET status='destroyed',destroyed_at=?,destroyed_artifacts=?,destroyed_bytes=?,updated_at=?
        WHERE id=? AND status='destroying' AND updated_at=?
      `).run(input.destroyedAt,input.destroyedArtifacts,input.destroyedBytes,input.destroyedAt,input.id,input.expectedUpdatedAt) as {changes?:number};
      if(Number(result.changes??0)!==1)return null;
      const row=this.database(context).prepare(`SELECT * FROM backup_quarantine_batches WHERE id=?`).get(input.id) as Record<string,unknown>|undefined;
      return row?mapBatch(row):null;
    });
  }
}
